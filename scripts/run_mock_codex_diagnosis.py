#!/usr/bin/env python3
"""Generate mock Codex diagnosis outputs for Guandata form integration."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


SCRIPT_VERSION = "mock_diagnosis_v0.1"
MODEL_VERSION = "mock_rule_v0.1"
PROMPT_VERSION = "mock_prompt_v0.1"
MIN_MONTH = "2026-03"
IP_MIN_SAMPLE = 20
DRIVE_MIN_SAMPLE = 10

DIAGNOSIS_HEADERS = [
    "诊断结果ID",
    "诊断批次ID",
    "统计月份",
    "大区编码",
    "大区名称",
    "小区编码",
    "小区名称",
    "经销商代码",
    "经销商名称",
    "诊断状态",
    "数据状态",
    "总体诊断结论",
    "主问题编码",
    "主问题名称",
    "结果断点",
    "过程原因",
    "优先动作",
    "聚焦数据域",
    "聚焦指标编码",
    "聚焦指标名称",
    "邀约负向明细数",
    "试驾接待负向明细数",
    "总负向明细数",
    "邀约样本量",
    "试驾接待样本量",
    "总样本量",
    "邀约最小样本阈值",
    "试驾接待最小样本阈值",
    "样本不足原因",
    "高亮指标编码",
    "证据摘要",
    "AI 解释文案",
    "诊断模型版本",
    "诊断 Prompt 版本",
    "生成时间",
    "是否最新成功批次",
    "上一成功批次ID",
]

RANK_HEADERS = [
    "排名结果ID",
    "诊断批次ID",
    "统计周期类型",
    "统计日期",
    "统计月份",
    "大区编码",
    "大区名称",
    "小区编码",
    "小区名称",
    "经销商代码",
    "经销商名称",
    "指标域",
    "指标组",
    "指标编码",
    "指标名称",
    "排名范围类型",
    "排名范围编码",
    "排名范围名称",
    "官方排名",
    "排名总数",
    "官方分位",
    "排名方向",
    "并列处理规则",
    "异常门店处理",
    "排名生成时间",
    "数据完整性状态",
]

BATCH_HEADERS = [
    "批次状态ID",
    "诊断批次ID",
    "运行日期",
    "统计月份",
    "触发方式",
    "任务范围",
    "经销商代码",
    "任务环节编码",
    "任务环节名称",
    "环节状态",
    "源数据刷新状态",
    "源数据刷新时间",
    "输入行数",
    "输出行数",
    "成功门店数",
    "失败门店数",
    "目标表单名称",
    "写入状态",
    "表单数据集刷新状态",
    "表单数据集刷新时间",
    "上一成功批次ID",
    "错误编码",
    "错误信息",
    "重试次数",
    "开始时间",
    "结束时间",
    "脚本版本",
    "诊断模型版本",
    "诊断 Prompt 版本",
]


@dataclass(frozen=True)
class Store:
    region_code: str
    region_name: str
    district_code: str
    district_name: str
    dealer_code: str
    dealer_name: str


STORES = [
    Store("R_EAST", "华东大区", "D_SH", "上海小区", "310101", "上海浦东体验中心"),
    Store("R_EAST", "华东大区", "D_SH", "上海小区", "310102", "上海嘉定体验中心"),
    Store("R_EAST", "华东大区", "D_SH", "上海小区", "310103", "上海闵行体验中心"),
]

SALES_ROWS = [
    ("2026-03", "310101", 160, 34, 24, 5),
    ("2026-03", "310102", 142, 26, 18, 3),
    ("2026-03", "310103", 118, 14, 10, 1),
]

INVITATION_ROWS = [
    ("2026-03", "310101", 116, 96, 132, 160, 118, 142, 34, 142),
    ("2026-03", "310102", 88, 85, 112, 142, 92, 120, 52, 142),
    ("2026-03", "310103", 60, 74, 80, 118, 54, 94, 70, 118),
]

DRIVE_PROCESS_ROWS = [
    ("2026-03", "310101", 24, 118.0, 520.0),
    ("2026-03", "310102", 18, 66.0, 300.0),
    ("2026-03", "310103", 10, 31.0, 120.0),
]


def store_by_code() -> dict[str, Store]:
    return {store.dealer_code: store for store in STORES}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stat-month", default="2026-03", help="YYYY-MM, must be >= 2026-03")
    parser.add_argument("--batch-id", help="Defaults to MOCK_<stat_month>_<timestamp>")
    parser.add_argument("--output-dir", default="outputs/mock_codex_run", help="Output root directory")
    return parser.parse_args()


def ensure_month(month: str) -> None:
    if month < MIN_MONTH:
        raise ValueError(f"统计月份必须为 {MIN_MONTH} 及之后，当前为 {month}")


def make_ip_details(month: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    negative_plan = {
        "310101": 8,
        "310102": 13,
        "310103": 16,
    }
    sample_plan = {
        "310101": 30,
        "310102": 28,
        "310103": 24,
    }
    for dealer_code, sample_count in sample_plan.items():
        store = store_by_code()[dealer_code]
        for i in range(1, sample_count + 1):
            is_negative = i <= negative_plan[dealer_code]
            rows.append(
                {
                    "统计月份": month,
                    "大区编码": store.region_code,
                    "大区名称": store.region_name,
                    "小区编码": store.district_code,
                    "小区名称": store.district_name,
                    "经销商代码": store.dealer_code,
                    "经销商简称": store.dealer_name,
                    "IP呼叫ID": f"IP_{dealer_code}_{i:03d}",
                    "顾问编码": f"C_{dealer_code}_{(i % 4) + 1}",
                    "顾问名称": f"顾问{(i % 4) + 1}",
                    "通话原文": "客户询问价格，顾问未明确锁定到店时间。" if is_negative else "顾问说明车型亮点并邀约客户到店。",
                    "一级标签": "邀约质量" if is_negative else "正向邀约",
                    "二级标签": "到店时间锁定不足" if is_negative else "有效邀约",
                    "标签正负向": "负向" if is_negative else "正向",
                    "证据原文": "顾问没有继续确认客户可到店时间。" if is_negative else "顾问确认客户周末到店。",
                    "命中原因": "未锁定明确到店时间" if is_negative else "已完成到店邀约",
                }
            )
    return rows


def make_drive_details(month: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    negative_plan = {
        "310101": 7,
        "310102": 9,
        "310103": 12,
    }
    sample_plan = {
        "310101": 16,
        "310102": 15,
        "310103": 14,
    }
    for dealer_code, sample_count in sample_plan.items():
        store = store_by_code()[dealer_code]
        for i in range(1, sample_count + 1):
            is_negative = i <= negative_plan[dealer_code]
            rows.append(
                {
                    "统计月份": month,
                    "大区编码": store.region_code,
                    "大区名称": store.region_name,
                    "小区编码": store.district_code,
                    "小区名称": store.district_name,
                    "经销商代码": store.dealer_code,
                    "经销商简称": store.dealer_name,
                    "试驾清单ID": f"TD_{dealer_code}_{i:03d}",
                    "试驾接待顾问编码": f"TC_{dealer_code}_{(i % 3) + 1}",
                    "试驾接待顾问名称": f"试驾顾问{(i % 3) + 1}",
                    "试驾原文": "客户提出竞品配置疑问，顾问解释不充分。" if is_negative else "顾问完整介绍操控和空间体验。",
                    "一级标签": "接待技巧" if is_negative else "正向接待",
                    "二级标签": "竞品攻防不足" if is_negative else "体验讲解充分",
                    "标签正负向": "负向" if is_negative else "正向",
                    "证据原文": "客户问竞品差异，顾问只回答差不多。" if is_negative else "顾问结合试驾体验讲解产品优势。",
                    "命中原因": "竞品对比解释不足" if is_negative else "试驾讲解完整",
                }
            )
    return rows


def write_table(path: Path, rows: list[dict[str, Any]], headers: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    path.with_suffix(".json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def rank_desc(values: list[tuple[str, float]]) -> dict[str, int]:
    sorted_values = sorted(values, key=lambda item: item[1], reverse=True)
    ranks: dict[str, int] = {}
    previous_value: float | None = None
    previous_rank = 0
    for idx, (dealer_code, value) in enumerate(sorted_values, start=1):
        if previous_value is None or value != previous_value:
            previous_rank = idx
            previous_value = value
        ranks[dealer_code] = previous_rank
    return ranks


def pct(num: float, den: float) -> float | None:
    if den == 0:
        return None
    return num / den


def build_outputs(month: str, batch_id: str, generated_at: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    stores = store_by_code()
    sales = []
    for stat_month, dealer_code, leads, arrivals, drives, orders in SALES_ROWS:
        if stat_month != month:
            continue
        store = stores[dealer_code]
        sales.append(
            {
                "统计月份": stat_month,
                "大区编码": store.region_code,
                "大区名称": store.region_name,
                "小区编码": store.district_code,
                "小区名称": store.district_name,
                "经销商代码": dealer_code,
                "经销商名称": store.dealer_name,
                "下发线索": leads,
                "首触到店": arrivals,
                "首触试驾": drives,
                "首触订单": orders,
                "线索到店率": pct(arrivals, leads),
                "到店试驾率": pct(drives, arrivals),
                "试驾订单率": pct(orders, drives),
                "线索订单率": pct(orders, leads),
            }
        )

    invitation = {
        dealer_code: {
            "30分钟外呼率": pct(out_30, work_leads),
            "2天3呼达标率": pct(three_call, leads),
            "首跟接通率": pct(connect, first_call_not_null),
            "30s以下线索占比": pct(short_call, leads),
        }
        for stat_month, dealer_code, out_30, work_leads, three_call, leads, connect, first_call_not_null, short_call, _ in INVITATION_ROWS
        if stat_month == month
    }
    drive_process = {
        dealer_code: {
            "试驾过程样本量": count,
            "试驾平均里程": mileage_sum / count,
            "试驾平均时长": duration_sum / count,
        }
        for stat_month, dealer_code, count, mileage_sum, duration_sum in DRIVE_PROCESS_ROWS
        if stat_month == month
    }
    ip_details = make_ip_details(month)
    drive_details = make_drive_details(month)

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

    rank_rows = build_rank_rows(sales, batch_id, generated_at)
    percentile = {
        (row["经销商代码"], row["指标编码"]): row["官方分位"]
        for row in rank_rows
    }

    diagnosis_rows: list[dict[str, Any]] = []
    for row in sales:
        dealer_code = row["经销商代码"]
        ip_negative_count = len(ip_negative[dealer_code])
        drive_negative_count = len(drive_negative[dealer_code])
        ip_sample_count = len(ip_sample[dealer_code])
        drive_sample_count = len(drive_sample[dealer_code])
        sample_count = ip_sample_count + drive_sample_count
        low_sample_reasons = []
        if ip_sample_count < IP_MIN_SAMPLE:
            low_sample_reasons.append("邀约有通话原文样本不足")
        if drive_sample_count < DRIVE_MIN_SAMPLE:
            low_sample_reasons.append("试驾有试驾原文样本不足")

        main_issue = choose_main_issue(row, percentile, ip_negative_count, drive_negative_count, ip_sample_count, drive_sample_count)
        diagnosis_status = "样本不足" if low_sample_reasons else "成功"
        data_status = "样本不足" if low_sample_reasons else "正常"
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
                "数据状态": data_status,
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
                "总样本量": sample_count,
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

    batch_rows = build_batch_rows(month, batch_id, generated_at, len(ip_details) + len(drive_details), len(diagnosis_rows), len(rank_rows), len(diagnosis_rows))
    mock_inputs = {
        "mock_ip_tag_detail": ip_details,
        "mock_drive_tag_detail": drive_details,
    }
    return diagnosis_rows, rank_rows, batch_rows, mock_inputs


def build_rank_rows(sales: list[dict[str, Any]], batch_id: str, generated_at: str) -> list[dict[str, Any]]:
    metric_defs = [
        ("销售漏斗", "绝对量", "assigned_leads", "下发线索", "下发线索"),
        ("销售漏斗", "绝对量", "arrivals", "首触到店", "首触到店"),
        ("销售漏斗", "绝对量", "test_drives", "首触试驾", "首触试驾"),
        ("销售漏斗", "绝对量", "orders", "首触订单", "首触订单"),
        ("销售漏斗", "转化率", "lead_to_arrival_rate", "线索到店率", "线索到店率"),
        ("销售漏斗", "转化率", "arrival_to_drive_rate", "到店试驾率", "到店试驾率"),
        ("销售漏斗", "转化率", "drive_to_order_rate", "试驾订单率", "试驾订单率"),
        ("销售漏斗", "转化率", "lead_to_order_rate", "线索订单率", "线索订单率"),
    ]
    rows: list[dict[str, Any]] = []
    by_district: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in sales:
        if len(row["经销商代码"]) == 6 and row["下发线索"] > 0:
            by_district[row["小区编码"]].append(row)

    for district_rows in by_district.values():
        rank_total = len(district_rows)
        for domain, group, metric_code, metric_name, value_key in metric_defs:
            values = [(row["经销商代码"], float(row[value_key] or 0)) for row in district_rows]
            ranks = rank_desc(values)
            for row in district_rows:
                rank = ranks[row["经销商代码"]]
                percentile = round((rank_total - rank + 1) / rank_total * 100, 2)
                rows.append(
                    {
                        "排名结果ID": f"R_{row['统计月份'].replace('-', '')}_{row['经销商代码']}_{metric_code}_小区_{row['小区编码']}_{batch_id}",
                        "诊断批次ID": batch_id,
                        "统计周期类型": "月",
                        "统计日期": f"{row['统计月份']}-01 00:00:00",
                        "统计月份": row["统计月份"],
                        "大区编码": row["大区编码"],
                        "大区名称": row["大区名称"],
                        "小区编码": row["小区编码"],
                        "小区名称": row["小区名称"],
                        "经销商代码": row["经销商代码"],
                        "经销商名称": row["经销商名称"],
                        "指标域": domain,
                        "指标组": group,
                        "指标编码": metric_code,
                        "指标名称": metric_name,
                        "排名范围类型": "小区",
                        "排名范围编码": row["小区编码"],
                        "排名范围名称": row["小区名称"],
                        "官方排名": rank,
                        "排名总数": rank_total,
                        "官方分位": percentile,
                        "排名方向": "越高越好",
                        "并列处理规则": "同值同排名，下一名跳号",
                        "异常门店处理": "剔除自然月下发线索量为0的门店；仅统计一网门店",
                        "排名生成时间": generated_at,
                        "数据完整性状态": "完整",
                    }
                )
    return rows


def choose_main_issue(row: dict[str, Any], percentile: dict[tuple[str, str], float], ip_neg: int, drive_neg: int, ip_sample: int, drive_sample: int) -> dict[str, str]:
    dealer_code = row["经销商代码"]
    assigned_leads_pct = percentile.get((dealer_code, "assigned_leads"), 100)
    arrivals_pct = percentile.get((dealer_code, "arrivals"), 100)
    order_pct = percentile.get((dealer_code, "orders"), 100)
    drive_to_order_pct = percentile.get((dealer_code, "drive_to_order_rate"), 100)
    lead_to_order_pct = percentile.get((dealer_code, "lead_to_order_rate"), 100)
    lead_to_arrival_pct = percentile.get((dealer_code, "lead_to_arrival_rate"), 100)
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
    if min(order_pct, lead_to_order_pct, drive_to_order_pct) < 30:
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


def evidence_summary(dealer_code: str, ip_neg: int, drive_neg: int, ip_top_tags: dict[str, dict[str, int]], drive_top_tags: dict[str, dict[str, int]]) -> str:
    parts = []
    if ip_neg:
        top = sorted(ip_top_tags[dealer_code].items(), key=lambda item: item[1], reverse=True)[0][0]
        parts.append(f"邀约负向明细 {ip_neg} 条，主要集中在{top}")
    if drive_neg:
        top = sorted(drive_top_tags[dealer_code].items(), key=lambda item: item[1], reverse=True)[0][0]
        parts.append(f"试驾接待负向明细 {drive_neg} 条，主要集中在{top}")
    return "；".join(parts) if parts else "未发现明显负向明细集中问题"


def build_batch_rows(month: str, batch_id: str, generated_at: str, input_rows: int, diagnosis_count: int, rank_count: int, success_store_count: int) -> list[dict[str, Any]]:
    steps = [
        ("拉取数据", "拉取数据", input_rows, 0, "", ""),
        ("生成诊断", "生成诊断", input_rows, diagnosis_count + rank_count, "", ""),
        ("写入表单", "写入表单", diagnosis_count + rank_count, diagnosis_count + rank_count, "三张 Codex 输出表", "插入或更新"),
        ("刷新表单数据集", "刷新表单数据集", diagnosis_count + rank_count, diagnosis_count + rank_count, "", ""),
    ]
    rows = []
    for step_code, step_name, input_count, output_count, target_form, write_status in steps:
        rows.append(
            {
                "批次状态ID": f"S_{batch_id}_{step_code}",
                "诊断批次ID": batch_id,
                "运行日期": generated_at,
                "统计月份": month,
                "触发方式": "Mock测试",
                "任务范围": "全量",
                "经销商代码": "",
                "任务环节编码": step_code,
                "任务环节名称": step_name,
                "环节状态": "成功",
                "源数据刷新状态": "已就绪",
                "源数据刷新时间": generated_at,
                "输入行数": input_count,
                "输出行数": output_count,
                "成功门店数": success_store_count,
                "失败门店数": 0,
                "目标表单名称": target_form,
                "写入状态": write_status,
                "表单数据集刷新状态": "未知" if step_code == "刷新表单数据集" else "",
                "表单数据集刷新时间": "",
                "上一成功批次ID": "",
                "错误编码": "",
                "错误信息": "",
                "重试次数": 0,
                "开始时间": generated_at,
                "结束时间": generated_at,
                "脚本版本": SCRIPT_VERSION,
                "诊断模型版本": MODEL_VERSION,
                "诊断 Prompt 版本": PROMPT_VERSION,
            }
        )
    return rows


def main() -> None:
    args = parse_args()
    ensure_month(args.stat_month)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    batch_id = args.batch_id or f"MOCK_{args.stat_month.replace('-', '')}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    run_dir = Path(args.output_dir) / batch_id
    diagnosis_rows, rank_rows, batch_rows, mock_inputs = build_outputs(args.stat_month, batch_id, now)

    write_table(run_dir / "门店诊断结果表.csv", diagnosis_rows, DIAGNOSIS_HEADERS)
    write_table(run_dir / "官方排名分位结果表.csv", rank_rows, RANK_HEADERS)
    write_table(run_dir / "Codex批次状态表.csv", batch_rows, BATCH_HEADERS)

    input_dir = run_dir / "mock_inputs"
    write_table(input_dir / "IP电话顾问邀约问题诊断表_mock.csv", mock_inputs["mock_ip_tag_detail"], list(mock_inputs["mock_ip_tag_detail"][0].keys()))
    write_table(input_dir / "试驾顾问接待问题诊断表_mock.csv", mock_inputs["mock_drive_tag_detail"], list(mock_inputs["mock_drive_tag_detail"][0].keys()))

    manifest = {
        "batch_id": batch_id,
        "stat_month": args.stat_month,
        "generated_at": now,
        "run_dir": str(run_dir),
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
