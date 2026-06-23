#!/usr/bin/env python3
"""Generate Codex diagnosis outputs from real Guandata metrics plus mock tag details."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from run_mock_codex_diagnosis import (
    BATCH_HEADERS,
    DIAGNOSIS_HEADERS,
    DRIVE_MIN_SAMPLE,
    IP_MIN_SAMPLE,
    MODEL_VERSION,
    PROMPT_VERSION,
    RANK_HEADERS,
    build_batch_rows,
    build_rank_rows,
    evidence_summary,
    pct,
    write_table,
)


SCRIPT_VERSION = "hybrid_diagnosis_v0.1"
MIN_MONTH = "2026-03"

SALES_DS_ID = "gae00de628b274fdf837719d"
SALES_DS_NAME = "[华为云][微批][三品牌]新零售门店级每日全量指标宽表&ads_sale_mart_new_sale_store_lvl_day_exnorm_comb_wms_his"
DCC_DS_ID = "fa1bfbd7736f34d1d8633883"
DRIVE_DS_ID = "c6428f1c9ca204859b553421"
DRIVE_DS_NAME = "[准实时]试驾明细宽表&ads_sale_mart_trial_dtl_wide_comb_wms"


@dataclass(frozen=True)
class Store:
    region_code: str
    region_name: str
    district_code: str
    district_name: str
    dealer_code: str
    dealer_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stat-month", help="单个统计月份，格式 YYYY-MM，必须 >= 2026-03")
    parser.add_argument("--start-month", help="统计开始月份，格式 YYYY-MM，必须 >= 2026-03")
    parser.add_argument("--end-month", help="统计结束月份，格式 YYYY-MM，必须 >= start-month")
    parser.add_argument("--dealer-codes", required=True, help="逗号分隔的真实经销商代码")
    parser.add_argument("--brand-name", required=True, help="品牌名称，例如 MG")
    parser.add_argument("--batch-id", help="默认 HYBRID_<stat_month>_<timestamp>")
    parser.add_argument("--output-dir", default="outputs/hybrid_codex_run", help="输出根目录")
    parser.add_argument("--dcc-limit", type=int, default=50000, help="DCC 话务 preview 最大读取行数")
    parser.add_argument("--allow-dcc-truncated", action="store_true", help="允许 DCC preview 命中读取上限后继续生成")
    parser.add_argument(
        "--confirm-sales-scope",
        choices=["brand_all_series_all_channel", "all_brand_all_series_all_channel"],
        required=True,
        help="显式确认销售漏斗聚合范围；未确认不生成结果",
    )
    parser.add_argument(
        "--confirm-dcc-dedup",
        choices=["lead_any_row"],
        required=True,
        help="显式确认 DCC 同一线索多行时任一行满足即计入分子",
    )
    parser.add_argument(
        "--confirm-drive-month-field",
        choices=["trial_recv_date"],
        required=True,
        help="显式确认试驾按试驾接待日期归属自然月",
    )
    parser.add_argument(
        "--confirm-mock-tags",
        choices=["selected_dealers_only"],
        required=True,
        help="显式确认 mock 打标明细只为本轮选定经销商生成",
    )
    return parser.parse_args()


def ensure_month(month: str) -> None:
    if month < MIN_MONTH:
        raise ValueError(f"统计月份必须为 {MIN_MONTH} 及之后，当前为 {month}")


def month_range(args: argparse.Namespace) -> list[str]:
    if args.stat_month and (args.start_month or args.end_month):
        raise ValueError("--stat-month 不能和 --start-month/--end-month 同时使用")
    if args.stat_month:
        ensure_month(args.stat_month)
        return [args.stat_month]
    if not args.start_month or not args.end_month:
        raise ValueError("请提供 --stat-month，或同时提供 --start-month 和 --end-month")
    ensure_month(args.start_month)
    if args.end_month < args.start_month:
        raise ValueError("--end-month 必须大于等于 --start-month")
    months = []
    year, month = (int(part) for part in args.start_month.split("-"))
    end_year, end_month = (int(part) for part in args.end_month.split("-"))
    while (year, month) <= (end_year, end_month):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            month = 1
            year += 1
    return months


def run_json(command: list[str]) -> list[dict[str, Any]]:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            "guancli 查询失败：\n"
            f"command={' '.join(command)}\n"
            f"stdout={result.stdout}\n"
            f"stderr={result.stderr}"
        )
    return json.loads(result.stdout or "[]")


def quote_list(values: list[str]) -> str:
    return ",".join(f'"{value}"' for value in values)


def to_number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    return float(value)


def brand_filter_sql(brand_name: str) -> str:
    return f'  AND `品牌名称` = "{brand_name}"'


def fetch_selected_sales(month: str, dealer_codes: list[str], brand_name: str) -> list[dict[str, Any]]:
    sql = f"""
SELECT
  `月份`,
  `大区代码`,
  `大区简称`,
  `小区代码`,
  `小区简称`,
  `经销商代码`,
  `经销商简称`,
  SUM(`当日下发线索数`) AS assigned_leads,
  SUM(`当日首触客流数`) AS arrivals,
  SUM(`当日首触试驾数`) AS test_drives,
  SUM(`当日订单数（首触）`) AS orders
FROM `{SALES_DS_NAME}`
WHERE `月份` = "{month}"
{brand_filter_sql(brand_name)}
  AND `经销商代码` IN ({quote_list(dealer_codes)})
GROUP BY `月份`, `大区代码`, `大区简称`, `小区代码`, `小区简称`, `经销商代码`, `经销商简称`
""".strip()
    rows = run_json(["guancli", "ds", "execute-sql", "-inputs", SALES_DS_ID, "-sql", sql, "-f", "json"])
    return [normalize_sales_row(row) for row in rows]


def fetch_rank_scope_sales(month: str, district_codes: list[str], brand_name: str) -> list[dict[str, Any]]:
    sql = f"""
SELECT
  `月份`,
  `大区代码`,
  `大区简称`,
  `小区代码`,
  `小区简称`,
  `经销商代码`,
  `经销商简称`,
  SUM(`当日下发线索数`) AS assigned_leads,
  SUM(`当日首触客流数`) AS arrivals,
  SUM(`当日首触试驾数`) AS test_drives,
  SUM(`当日订单数（首触）`) AS orders
FROM `{SALES_DS_NAME}`
WHERE `月份` = "{month}"
{brand_filter_sql(brand_name)}
  AND `小区代码` IN ({quote_list(district_codes)})
  AND LENGTH(`经销商代码`) = 6
GROUP BY `月份`, `大区代码`, `大区简称`, `小区代码`, `小区简称`, `经销商代码`, `经销商简称`
HAVING SUM(`当日下发线索数`) > 0
""".strip()
    rows = run_json(["guancli", "ds", "execute-sql", "-inputs", SALES_DS_ID, "-sql", sql, "-f", "json"])
    return [normalize_sales_row(row) for row in rows]


def normalize_sales_row(row: dict[str, Any]) -> dict[str, Any]:
    leads = to_number(row.get("assigned_leads"))
    arrivals = to_number(row.get("arrivals"))
    drives = to_number(row.get("test_drives"))
    orders = to_number(row.get("orders"))
    return {
        "统计月份": row.get("月份", ""),
        "大区编码": row.get("大区代码", ""),
        "大区名称": row.get("大区简称", "") or row.get("大区代码", ""),
        "小区编码": row.get("小区代码", ""),
        "小区名称": row.get("小区简称", "") or row.get("小区代码", ""),
        "经销商代码": row.get("经销商代码", ""),
        "经销商名称": row.get("经销商简称", ""),
        "下发线索": int(leads),
        "首触到店": int(arrivals),
        "首触试驾": int(drives),
        "首触订单": int(orders),
        "线索到店率": pct(arrivals, leads),
        "到店试驾率": pct(drives, arrivals),
        "试驾订单率": pct(orders, drives),
        "线索订单率": pct(orders, leads),
    }


def fetch_dcc_rows(month: str, dealer_codes: list[str], brand_name: str, limit: int) -> list[dict[str, Any]]:
    return run_json(
        [
            "guancli",
            "ds",
            "preview",
            DCC_DS_ID,
            "--filter",
            f"下发CRM年月 EQ {month}",
            "--filter",
            f"品牌名称 EQ {brand_name}",
            "--filter",
            f"经销商代码 IN {','.join(dealer_codes)}",
            "--columns",
            "下发CRM年月,大区代码,大区简称,小区代码,小区简称,经销商代码,经销商简称,线索编码,是否工作时段线索（9-18）,工作时段30分钟跟进,是否完成72小时三呼,首次通话时长,72小时总通话时长",
            "--limit",
            str(limit),
            "-f",
            "json",
        ]
    )


def aggregate_dcc(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    by_lead: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        dealer_code = str(row.get("经销商代码", ""))
        lead_id = str(row.get("线索编码", ""))
        if not dealer_code or not lead_id:
            continue
        by_lead[(dealer_code, lead_id)].append(row)

    agg: dict[str, dict[str, Any]] = defaultdict(lambda: defaultdict(int))
    for (dealer_code, _), lead_rows in by_lead.items():
        agg[dealer_code]["lead_count"] += 1
        if any(row.get("是否工作时段线索（9-18）") == "工作时段" for row in lead_rows):
            agg[dealer_code]["work_lead_count"] += 1
        if any(row.get("工作时段30分钟跟进") == "是" for row in lead_rows):
            agg[dealer_code]["outbound_30min_count"] += 1
        if any(row.get("是否完成72小时三呼") == "是" for row in lead_rows):
            agg[dealer_code]["three_call_count"] += 1

        first_call_values = [row.get("首次通话时长") for row in lead_rows if row.get("首次通话时长") not in (None, "")]
        if first_call_values:
            agg[dealer_code]["first_call_known_count"] += 1
        if any(to_number(value) > 0 for value in first_call_values):
            agg[dealer_code]["first_call_connected_count"] += 1

        total_call_values = [row.get("72小时总通话时长") for row in lead_rows]
        if any(value in (None, "") for value in total_call_values) or all(to_number(value) < 30 for value in total_call_values):
            agg[dealer_code]["short_call_under_30s_count"] += 1

    return {
        dealer_code: {
            "30分钟外呼率": pct(values["outbound_30min_count"], values["work_lead_count"]),
            "2天3呼达标率": pct(values["three_call_count"], values["lead_count"]),
            "首跟接通率": pct(values["first_call_connected_count"], values["first_call_known_count"]),
            "30s以下线索占比": pct(values["short_call_under_30s_count"], values["lead_count"]),
            "DCC线索数": values["lead_count"],
        }
        for dealer_code, values in agg.items()
    }


def fetch_drive_process(month: str, dealer_codes: list[str], brand_name: str) -> dict[str, dict[str, Any]]:
    month_start = f"{month}-01"
    year, month_num = month.split("-")
    next_month_num = int(month_num) + 1
    next_year = int(year)
    if next_month_num == 13:
        next_month_num = 1
        next_year += 1
    next_month = f"{next_year:04d}-{next_month_num:02d}-01"
    sql = f"""
SELECT
  DATE_FORMAT(`试驾接待日期`, "%Y-%m") AS month,
  `试驾接待经销商代码` AS dealer_code,
  `试驾接待经销商简称` AS dealer_name,
  COUNT(DISTINCT `试驾接待编码`) AS cnt,
  SUM(`试驾里程`) AS mileage_sum,
  SUM(`试驾时长(分钟)`) AS duration_sum
FROM `{DRIVE_DS_NAME}`
WHERE `试驾接待日期` >= "{month_start}"
  AND `试驾接待日期` < "{next_month}"
  AND `品牌名称` = "{brand_name}"
  AND `是否成功试驾` = "是"
  AND `试驾接待经销商代码` IN ({quote_list(dealer_codes)})
GROUP BY DATE_FORMAT(`试驾接待日期`, "%Y-%m"), `试驾接待经销商代码`, `试驾接待经销商简称`
""".strip()
    rows = run_json(["guancli", "ds", "execute-sql", "-inputs", DRIVE_DS_ID, "-sql", sql, "-f", "json"])
    result = {}
    for row in rows:
        dealer_code = row.get("dealer_code", "")
        count = to_number(row.get("cnt"))
        result[dealer_code] = {
            "试驾过程样本量": int(count),
            "试驾平均里程": pct(to_number(row.get("mileage_sum")), count),
            "试驾平均时长": pct(to_number(row.get("duration_sum")), count),
        }
    return result


def make_mock_tag_details(month: str, stores: list[Store]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    ip_rows: list[dict[str, Any]] = []
    drive_rows: list[dict[str, Any]] = []
    for idx, store in enumerate(stores):
        ip_sample_count = 24 + idx * 3
        ip_negative_count = 8 + idx * 4
        drive_sample_count = 14 + idx
        drive_negative_count = 7 + idx * 3
        for i in range(1, ip_sample_count + 1):
            is_negative = i <= ip_negative_count
            ip_rows.append(
                {
                    "统计月份": month,
                    "大区编码": store.region_code,
                    "大区名称": store.region_name,
                    "小区编码": store.district_code,
                    "小区名称": store.district_name,
                    "经销商代码": store.dealer_code,
                    "经销商简称": store.dealer_name,
                    "IP呼叫ID": f"IP_{store.dealer_code}_{i:03d}",
                    "顾问编码": f"C_{store.dealer_code}_{(i % 4) + 1}",
                    "顾问名称": f"顾问{(i % 4) + 1}",
                    "通话原文": "客户询问价格，顾问未明确锁定到店时间。" if is_negative else "顾问说明车型亮点并邀约客户到店。",
                    "一级标签": "邀约质量" if is_negative else "正向邀约",
                    "二级标签": "到店时间锁定不足" if is_negative else "有效邀约",
                    "标签正负向": "负向" if is_negative else "正向",
                    "证据原文": "顾问没有继续确认客户可到店时间。" if is_negative else "顾问确认客户周末到店。",
                    "命中原因": "未锁定明确到店时间" if is_negative else "已完成到店邀约",
                }
            )
        for i in range(1, drive_sample_count + 1):
            is_negative = i <= drive_negative_count
            drive_rows.append(
                {
                    "统计月份": month,
                    "大区编码": store.region_code,
                    "大区名称": store.region_name,
                    "小区编码": store.district_code,
                    "小区名称": store.district_name,
                    "经销商代码": store.dealer_code,
                    "经销商简称": store.dealer_name,
                    "试驾清单ID": f"TD_{store.dealer_code}_{i:03d}",
                    "试驾接待顾问编码": f"TC_{store.dealer_code}_{(i % 3) + 1}",
                    "试驾接待顾问名称": f"试驾顾问{(i % 3) + 1}",
                    "试驾原文": "客户提出竞品配置疑问，顾问解释不充分。" if is_negative else "顾问完整介绍操控和空间体验。",
                    "一级标签": "接待技巧" if is_negative else "正向接待",
                    "二级标签": "竞品攻防不足" if is_negative else "体验讲解充分",
                    "标签正负向": "负向" if is_negative else "正向",
                    "证据原文": "客户问竞品差异，顾问只回答差不多。" if is_negative else "顾问结合试驾体验讲解产品优势。",
                    "命中原因": "竞品对比解释不足" if is_negative else "试驾讲解完整",
                }
            )
    return ip_rows, drive_rows


def choose_main_issue(
    row: dict[str, Any],
    percentile: dict[tuple[str, str], float],
    ip_neg: int,
    drive_neg: int,
    ip_sample: int,
    drive_sample: int,
) -> dict[str, str]:
    dealer_code = row["经销商代码"]
    assigned_leads_pct = percentile.get((dealer_code, "assigned_leads"), 100)
    arrivals_pct = percentile.get((dealer_code, "arrivals"), 100)
    orders_pct = percentile.get((dealer_code, "orders"), 100)
    lead_to_arrival_pct = percentile.get((dealer_code, "lead_to_arrival_rate"), 100)
    drive_to_order_pct = percentile.get((dealer_code, "drive_to_order_rate"), 100)
    lead_to_order_pct = percentile.get((dealer_code, "lead_to_order_rate"), 100)

    if assigned_leads_pct < 30:
        return {
            "code": "lead_volume_weak",
            "name": "线索供给不足",
            "conclusion": "本月销售漏斗基础规模偏弱，需优先关注线索供给和到店承接。",
            "breakpoint": "下发线索不足，后续转化承压",
            "reason": "线索规模偏低",
            "action": "优先检查本月线索来源结构，并结合邀约明细复盘低效渠道",
            "domain": "销售漏斗",
            "metric_code": "assigned_leads",
            "metric_name": "下发线索",
            "highlight": "assigned_leads,lead_to_arrival_rate",
            "explanation": "建议先确认线索供给和渠道结构，再结合过程指标判断是否存在承接问题。",
        }
    if min(orders_pct, lead_to_order_pct, drive_to_order_pct) < 30:
        return {
            "code": "order_conversion_weak",
            "name": "订单转化不足",
            "conclusion": "本月订单结果偏弱，主要需要复盘试驾后的顾虑承接和转订推进。",
            "breakpoint": "试驾后订单转化不足，订单结果偏弱",
            "reason": "接待技巧承接不足",
            "action": "回看 {drive} 条负向试驾接待记录，复盘顾虑承接和竞品攻防话术",
            "domain": "试驾过程",
            "metric_code": "negative_reception_rate",
            "metric_name": "负向试驾接待占比",
            "highlight": "lead_to_order_rate,negative_reception_rate",
            "explanation": "建议优先用试驾接待证据回看客户顾虑是否被充分承接，再统一转订推进话术。",
        }
    if min(arrivals_pct, lead_to_arrival_pct) < 30:
        return {
            "code": "arrival_conversion_weak",
            "name": "到店转化不足",
            "conclusion": "本月客户到店承压，邀约质量和到店理由构建需要优先复盘。",
            "breakpoint": "客户到店不足，线索订单率偏弱",
            "reason": "邀约质量不足",
            "action": "回访 {ip} 条负向邀约明细，复盘到店理由和时间锁定话术",
            "domain": "邀约过程",
            "metric_code": "negative_invitation_rate",
            "metric_name": "负向邀约占比",
            "highlight": "lead_to_arrival_rate,negative_invitation_rate,short_call_under_30s_rate",
            "explanation": "建议优先复盘负向邀约样本，确认是否存在未锁定到店时间或到店理由不足。",
        }
    if ip_sample >= IP_MIN_SAMPLE and ip_neg > 10:
        return {
            "code": "invitation_quality_weak",
            "name": "邀约质量不足",
            "conclusion": "本月结果类漏斗指标未显著落后，但邀约负向明细较多，建议优先复盘邀约质量。",
            "breakpoint": "结果断点不明显，邀约负向问题集中",
            "reason": "负向邀约明细超过阈值",
            "action": "回访 {ip} 条负向邀约明细，复盘到店理由和时间锁定话术",
            "domain": "邀约过程",
            "metric_code": "negative_invitation_rate",
            "metric_name": "负向邀约占比",
            "highlight": "negative_invitation_rate,short_call_under_30s_rate",
            "explanation": "建议在结果类指标未显著落后的前提下，先处理集中出现的邀约负向样本。",
        }
    if drive_sample >= DRIVE_MIN_SAMPLE and drive_neg > 10:
        return {
            "code": "reception_skill_weak",
            "name": "接待技巧不足",
            "conclusion": "本月结果类漏斗指标未显著落后，但试驾接待负向明细较多，建议优先复盘接待技巧。",
            "breakpoint": "结果断点不明显，试驾接待负向问题集中",
            "reason": "负向试驾接待明细超过阈值",
            "action": "回看 {drive} 条负向试驾接待记录，复盘顾虑承接和竞品攻防话术",
            "domain": "试驾过程",
            "metric_code": "negative_reception_rate",
            "metric_name": "负向试驾接待占比",
            "highlight": "negative_reception_rate",
            "explanation": "建议在结果类指标未显著落后的前提下，先处理集中出现的试驾接待负向样本。",
        }
    return {
        "code": "no_significant_issue",
        "name": "未发现显著异常",
        "conclusion": "本月核心销售漏斗指标未命中低分位阈值，负向明细也未超过阈值，暂未发现显著异常。",
        "breakpoint": "未发现显著异常",
        "reason": "未命中分位阈值或负向阈值",
        "action": "保持现有跟进节奏，持续观察销售漏斗和负向明细变化",
        "domain": "销售漏斗",
        "metric_code": "lead_to_order_rate",
        "metric_name": "线索订单率",
        "highlight": "lead_to_order_rate",
        "explanation": "本轮诊断未触发主问题阈值，建议继续观察核心漏斗指标和负向明细趋势。",
    }


def build_outputs(
    month: str,
    batch_id: str,
    generated_at: str,
    dealer_codes: list[str],
    brand_name: str,
    dcc_limit: int,
    allow_dcc_truncated: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, Any]]:
    selected_sales = fetch_selected_sales(month, dealer_codes, brand_name)
    found_dealers = {row["经销商代码"] for row in selected_sales}
    missing_dealers = [dealer_code for dealer_code in dealer_codes if dealer_code not in found_dealers]
    if missing_dealers:
        raise RuntimeError(f"销售漏斗真实数据未查到以下经销商：{','.join(missing_dealers)}")

    district_codes = sorted({row["小区编码"] for row in selected_sales if row["小区编码"]})
    rank_scope_sales = fetch_rank_scope_sales(month, district_codes, brand_name)
    rank_rows_all = build_rank_rows(rank_scope_sales, batch_id, generated_at)
    rank_rows = [row for row in rank_rows_all if row["经销商代码"] in set(dealer_codes)]

    dcc_rows = fetch_dcc_rows(month, dealer_codes, brand_name, dcc_limit)
    if len(dcc_rows) >= dcc_limit and not allow_dcc_truncated:
        raise RuntimeError(
            f"DCC 话务读取达到上限 {dcc_limit} 行，可能截断。"
            "请提高 --dcc-limit，或确认可接受后添加 --allow-dcc-truncated。"
        )
    dcc_metrics = aggregate_dcc(dcc_rows)
    drive_metrics = fetch_drive_process(month, dealer_codes, brand_name)

    stores = [
        Store(
            row["大区编码"],
            row["大区名称"],
            row["小区编码"],
            row["小区名称"],
            row["经销商代码"],
            row["经销商名称"],
        )
        for row in selected_sales
    ]
    ip_details, drive_details = make_mock_tag_details(month, stores)

    ip_sample: dict[str, set[str]] = defaultdict(set)
    ip_negative: dict[str, set[str]] = defaultdict(set)
    ip_top_tags: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in ip_details:
        dealer_code = row["经销商代码"]
        event_id = row["IP呼叫ID"]
        if row.get("通话原文"):
            ip_sample[dealer_code].add(event_id)
        if row["标签正负向"] == "负向":
            ip_negative[dealer_code].add(event_id)
            ip_top_tags[dealer_code][row["二级标签"]] += 1

    drive_sample: dict[str, set[str]] = defaultdict(set)
    drive_negative: dict[str, set[str]] = defaultdict(set)
    drive_top_tags: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in drive_details:
        dealer_code = row["经销商代码"]
        event_id = row["试驾清单ID"]
        if row.get("试驾原文"):
            drive_sample[dealer_code].add(event_id)
        if row["标签正负向"] == "负向":
            drive_negative[dealer_code].add(event_id)
            drive_top_tags[dealer_code][row["二级标签"]] += 1

    percentile = {(row["经销商代码"], row["指标编码"]): row["官方分位"] for row in rank_rows}
    diagnosis_rows: list[dict[str, Any]] = []
    for row in selected_sales:
        dealer_code = row["经销商代码"]
        ip_negative_count = len(ip_negative[dealer_code])
        drive_negative_count = len(drive_negative[dealer_code])
        ip_sample_count = len(ip_sample[dealer_code])
        drive_sample_count = len(drive_sample[dealer_code])
        low_sample_reasons = []
        if ip_sample_count < IP_MIN_SAMPLE:
            low_sample_reasons.append("邀约有通话原文样本不足")
        if drive_sample_count < DRIVE_MIN_SAMPLE:
            low_sample_reasons.append("试驾有试驾原文样本不足")
        main_issue = choose_main_issue(row, percentile, ip_negative_count, drive_negative_count, ip_sample_count, drive_sample_count)
        diagnosis_status = "样本不足" if low_sample_reasons else "成功"
        diagnosis_rows.append(
            {
                "诊断结果ID": f"D_{month.replace('-', '')}_{dealer_code}_{batch_id}",
                "诊断批次ID": batch_id,
                "统计月份": month,
                "大区编码": row["大区编码"],
                "大区名称": row["大区名称"],
                "小区编码": row["小区编码"],
                "小区名称": row["小区名称"],
                "经销商代码": dealer_code,
                "经销商名称": row["经销商名称"],
                "诊断状态": diagnosis_status,
                "数据状态": "样本不足" if low_sample_reasons else "正常",
                "总体诊断结论": main_issue["conclusion"],
                "主问题编码": main_issue["code"],
                "主问题名称": main_issue["name"],
                "结果断点": main_issue["breakpoint"],
                "过程原因": main_issue["reason"],
                "优先动作": main_issue["action"].format(ip=ip_negative_count, drive=drive_negative_count),
                "聚焦数据域": main_issue["domain"],
                "聚焦指标编码": main_issue["metric_code"],
                "聚焦指标名称": main_issue["metric_name"],
                "邀约负向明细数": ip_negative_count,
                "试驾接待负向明细数": drive_negative_count,
                "总负向明细数": ip_negative_count + drive_negative_count,
                "邀约样本量": ip_sample_count,
                "试驾接待样本量": drive_sample_count,
                "总样本量": ip_sample_count + drive_sample_count,
                "邀约最小样本阈值": IP_MIN_SAMPLE,
                "试驾接待最小样本阈值": DRIVE_MIN_SAMPLE,
                "样本不足原因": "；".join(low_sample_reasons),
                "高亮指标编码": main_issue["highlight"],
                "证据摘要": evidence_summary(dealer_code, ip_negative_count, drive_negative_count, ip_top_tags, drive_top_tags),
                "AI 解释文案": main_issue["explanation"],
                "诊断模型版本": MODEL_VERSION,
                "诊断 Prompt 版本": PROMPT_VERSION,
                "生成时间": generated_at,
                "是否最新成功批次": "TRUE" if diagnosis_status == "成功" else "FALSE",
                "上一成功批次ID": "",
            }
        )

    input_rows = len(selected_sales) + len(dcc_rows) + sum(metric.get("试驾过程样本量", 0) for metric in drive_metrics.values()) + len(ip_details) + len(drive_details)
    batch_rows = build_batch_rows(month, batch_id, generated_at, input_rows, len(diagnosis_rows), len(rank_rows), len(diagnosis_rows))
    for row in batch_rows:
        row["触发方式"] = "真实指标+Mock打标测试"
        row["脚本版本"] = SCRIPT_VERSION
        row["经销商代码"] = ",".join(dealer_codes)
        if row["任务环节编码"] == "刷新表单数据集":
            row["环节状态"] = "跳过"
            row["表单数据集刷新状态"] = "待定时刷新"
            row["错误信息"] = "表单数据集按观远每日定时刷新，不在写表后立即刷新"
        row["经销商代码"] = ",".join(dealer_codes)
        if row["任务环节编码"] == "刷新表单数据集":
            row["环节状态"] = "跳过"
            row["表单数据集刷新状态"] = "待定时刷新"
            row["错误信息"] = "表单数据集按观远每日定时刷新，不在写表后立即刷新"

    source_snapshot = {
        "sales_rows": selected_sales,
        "rank_scope_sales_rows": rank_scope_sales,
        "dcc_metrics": dcc_metrics,
        "drive_metrics": drive_metrics,
    }
    mock_inputs = {
        "mock_ip_tag_detail": ip_details,
        "mock_drive_tag_detail": drive_details,
    }
    return diagnosis_rows, rank_rows, batch_rows, mock_inputs, source_snapshot


def write_source_snapshot(run_dir: Path, source_snapshot: dict[str, Any]) -> None:
    source_dir = run_dir / "source_snapshots"
    source_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in source_snapshot.items():
        path = source_dir / f"{name}.json"
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            with (source_dir / f"{name}.csv").open("w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()), extrasaction="ignore")
                writer.writeheader()
                writer.writerows(rows)


def main() -> None:
    args = parse_args()
    months = month_range(args)
    dealer_codes = [code.strip() for code in args.dealer_codes.split(",") if code.strip()]
    if not dealer_codes:
        raise ValueError("--dealer-codes 至少提供 1 个经销商代码")
    if args.confirm_sales_scope == "all_brand_all_series_all_channel" and args.brand_name:
        raise ValueError("已提供 --brand-name 时，--confirm-sales-scope 应使用 brand_all_series_all_channel")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    month_label = months[0].replace("-", "") if len(months) == 1 else f"{months[0].replace('-', '')}_{months[-1].replace('-', '')}"
    batch_id = args.batch_id or f"HYBRID_{args.brand_name}_{month_label}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    run_dir = Path(args.output_dir) / batch_id
    diagnosis_rows: list[dict[str, Any]] = []
    rank_rows: list[dict[str, Any]] = []
    mock_inputs = {
        "mock_ip_tag_detail": [],
        "mock_drive_tag_detail": [],
    }
    source_snapshot: dict[str, Any] = {
        "months": months,
        "brand_name": args.brand_name,
        "dealer_codes": dealer_codes,
        "sales_rows": [],
        "rank_scope_sales_rows": [],
        "dcc_metrics_by_month": {},
        "drive_metrics_by_month": {},
    }
    input_row_count = 0
    for month in months:
        month_diagnosis_rows, month_rank_rows, _, month_mock_inputs, month_source_snapshot = build_outputs(
            month,
            batch_id,
            now,
            dealer_codes,
            args.brand_name,
            args.dcc_limit,
            args.allow_dcc_truncated,
        )
        diagnosis_rows.extend(month_diagnosis_rows)
        rank_rows.extend(month_rank_rows)
        mock_inputs["mock_ip_tag_detail"].extend(month_mock_inputs["mock_ip_tag_detail"])
        mock_inputs["mock_drive_tag_detail"].extend(month_mock_inputs["mock_drive_tag_detail"])
        source_snapshot["sales_rows"].extend(month_source_snapshot["sales_rows"])
        source_snapshot["rank_scope_sales_rows"].extend(month_source_snapshot["rank_scope_sales_rows"])
        source_snapshot["dcc_metrics_by_month"][month] = month_source_snapshot["dcc_metrics"]
        source_snapshot["drive_metrics_by_month"][month] = month_source_snapshot["drive_metrics"]
        input_row_count += (
            len(month_source_snapshot["sales_rows"])
            + len(month_source_snapshot["rank_scope_sales_rows"])
            + len(month_mock_inputs["mock_ip_tag_detail"])
            + len(month_mock_inputs["mock_drive_tag_detail"])
        )
    stat_month_label = months[0] if len(months) == 1 else f"{months[0]}~{months[-1]}"
    batch_rows = build_batch_rows(
        stat_month_label,
        batch_id,
        now,
        input_row_count,
        len(diagnosis_rows),
        len(rank_rows),
        len(diagnosis_rows),
    )
    for row in batch_rows:
        row["触发方式"] = "真实指标+Mock打标测试"
        row["脚本版本"] = SCRIPT_VERSION
        row["经销商代码"] = ",".join(dealer_codes)
        if row["任务环节编码"] == "刷新表单数据集":
            row["环节状态"] = "跳过"
            row["表单数据集刷新状态"] = "待定时刷新"
            row["错误信息"] = "表单数据集按观远每日定时刷新，不在写表后立即刷新"

    write_table(run_dir / "门店诊断结果表.csv", diagnosis_rows, DIAGNOSIS_HEADERS)
    write_table(run_dir / "官方排名分位结果表.csv", rank_rows, RANK_HEADERS)
    write_table(run_dir / "Codex批次状态表.csv", batch_rows, BATCH_HEADERS)
    input_dir = run_dir / "mock_inputs"
    write_table(input_dir / "IP电话顾问邀约问题诊断表_mock.csv", mock_inputs["mock_ip_tag_detail"], list(mock_inputs["mock_ip_tag_detail"][0].keys()))
    write_table(input_dir / "试驾顾问接待问题诊断表_mock.csv", mock_inputs["mock_drive_tag_detail"], list(mock_inputs["mock_drive_tag_detail"][0].keys()))
    write_source_snapshot(run_dir, source_snapshot)

    manifest = {
        "batch_id": batch_id,
        "stat_months": months,
        "brand_name": args.brand_name,
        "generated_at": now,
        "run_dir": str(run_dir),
        "input_mode": "真实销售漏斗+真实DCC话务+真实试驾过程+mock打标明细",
        "dealer_codes": dealer_codes,
        "confirmed_assumptions": {
            "sales_scope": args.confirm_sales_scope,
            "dcc_dedup": args.confirm_dcc_dedup,
            "drive_month_field": args.confirm_drive_month_field,
            "mock_tags": args.confirm_mock_tags,
        },
        "outputs": {
            "diagnosis_rows": len(diagnosis_rows),
            "rank_rows": len(rank_rows),
            "batch_rows": len(batch_rows),
        },
    }
    (run_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
