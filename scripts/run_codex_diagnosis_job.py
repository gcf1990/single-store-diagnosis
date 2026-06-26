#!/usr/bin/env python3
"""Run the Codex diagnosis job: generate outputs, then current-state upsert forms."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-month", required=True, help="统计开始月份，格式 YYYY-MM")
    parser.add_argument("--end-month", required=True, help="统计结束月份，格式 YYYY-MM")
    parser.add_argument("--end-date", help="统计截止日期，格式 YYYY-MM-DD；包含该日期，不包含之后数据")
    parser.add_argument("--dealer-codes", help="逗号分隔经销商代码；和 --region-name / --all-brand 三选一")
    parser.add_argument("--region-name", help="按大区简称模糊匹配自动取一网门店，例如 东南 或 6东南区；和 --dealer-codes / --all-brand 三选一")
    parser.add_argument("--all-brand", action="store_true", help="按品牌自动取全部一网门店；和 --dealer-codes / --region-name 三选一")
    parser.add_argument("--brand-name", required=True, help="品牌名称，例如 MG")
    parser.add_argument("--output-dir", default="outputs/hybrid_codex_run", help="输出根目录")
    parser.add_argument("--batch-id", help="可选指定批次ID")
    parser.add_argument("--dcc-limit", type=int, default=50000, help="DCC 话务 preview 最大读取行数")
    parser.add_argument("--dcc-chunk-size", type=int, default=10, help="区域运行时 DCC 按经销商分片读取的每片门店数")
    parser.add_argument("--allow-dcc-truncated", action="store_true", help="允许 DCC preview 命中读取上限后继续生成")
    parser.add_argument("--validate-limit", type=int, default=500, help="写表后表单反查最大行数")
    parser.add_argument("--dry-run-write", action="store_true", help="只生成输出并 dry-run 写表，不实际更新表单")
    parser.add_argument("--yes", action="store_true", help="实际写入表单必须添加该参数")
    return parser.parse_args()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    print(" ".join(command))
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        raise subprocess.CalledProcessError(result.returncode, command, output=result.stdout, stderr=result.stderr)
    return result


def main() -> None:
    args = parse_args()
    if not args.dry_run_write and not args.yes:
        raise SystemExit("实际写入表单请添加 --yes；建议先运行 --dry-run-write")
    scope_count = sum(bool(value) for value in (args.dealer_codes, args.region_name, args.all_brand))
    if scope_count != 1:
        raise SystemExit("--dealer-codes、--region-name 和 --all-brand 必须三选一且只能提供一个")

    generate_command = [
        "python3",
        "scripts/run_hybrid_codex_diagnosis.py",
        "--start-month",
        args.start_month,
        "--end-month",
        args.end_month,
        "--brand-name",
        args.brand_name,
        "--output-dir",
        args.output_dir,
        "--dcc-limit",
        str(args.dcc_limit),
        "--dcc-chunk-size",
        str(args.dcc_chunk_size),
        "--confirm-sales-scope",
        "brand_all_series_all_channel",
        "--confirm-dcc-dedup",
        "lead_any_row",
        "--confirm-drive-month-field",
        "trial_recv_date",
        "--confirm-mock-tags",
        "selected_dealers_only",
    ]
    if args.end_date:
        generate_command.extend(["--end-date", args.end_date])
    if args.dealer_codes:
        generate_command.extend(["--dealer-codes", args.dealer_codes])
    if args.region_name:
        generate_command.extend(["--region-name", args.region_name])
    if args.all_brand:
        generate_command.append("--all-brand")
    if args.allow_dcc_truncated:
        generate_command.append("--allow-dcc-truncated")
    if args.batch_id:
        generate_command.extend(["--batch-id", args.batch_id])

    generated = run(generate_command)
    print(generated.stdout)
    manifest = json.loads(generated.stdout)
    run_dir = Path(manifest["run_dir"])

    write_command = [
        "python3",
        "scripts/guancli_form_load.py",
        str(run_dir),
        "--current-state-upsert",
    ]
    if args.dry_run_write:
        write_command.append("--dry-run")
    else:
        write_command.append("--yes")

    written = run(write_command)
    print(written.stdout)

    if args.dry_run_write:
        print(json.dumps({"batch_id": manifest["batch_id"], "validation_skipped": "dry-run write did not update forms"}, ensure_ascii=False))
        return

    validate_command = [
        "python3",
        "scripts/validate_codex_batch_visibility.py",
        "--batch-id",
        manifest["batch_id"],
        "--limit",
        str(args.validate_limit),
        "--json-output",
    ]
    validated = run(validate_command)
    print(validated.stdout)


if __name__ == "__main__":
    main()
