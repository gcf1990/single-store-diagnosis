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
    parser.add_argument("--dealer-codes", required=True, help="逗号分隔经销商代码")
    parser.add_argument("--brand-name", required=True, help="品牌名称，例如 MG")
    parser.add_argument("--output-dir", default="outputs/hybrid_codex_run", help="输出根目录")
    parser.add_argument("--batch-id", help="可选指定批次ID")
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

    generate_command = [
        "python3",
        "scripts/run_hybrid_codex_diagnosis.py",
        "--start-month",
        args.start_month,
        "--end-month",
        args.end_month,
        "--dealer-codes",
        args.dealer_codes,
        "--brand-name",
        args.brand_name,
        "--output-dir",
        args.output_dir,
        "--confirm-sales-scope",
        "brand_all_series_all_channel",
        "--confirm-dcc-dedup",
        "lead_any_row",
        "--confirm-drive-month-field",
        "trial_recv_date",
        "--confirm-mock-tags",
        "selected_dealers_only",
    ]
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
        "--json-output",
    ]
    validated = run(validate_command)
    print(validated.stdout)


if __name__ == "__main__":
    main()
