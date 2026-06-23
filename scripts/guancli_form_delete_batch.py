#!/usr/bin/env python3
"""Delete one Codex batch from Guandata forms through guancli."""

from __future__ import annotations

import argparse
import json
import subprocess
from typing import Any


FORM_CONFIG = {
    "门店诊断结果表": {
        "fm_id": "a_11770b-f0d7-4349-a33d-00d76e485ef2",
        "key": "诊断结果ID",
        "batch_field": "诊断批次ID",
    },
    "官方排名分位结果表": {
        "fm_id": "a_50f89c-da7c-46cc-aaa1-b09a8de9b5b5",
        "key": "排名结果ID",
        "batch_field": "诊断批次ID",
    },
    "Codex批次状态表": {
        "fm_id": "a_1c81a3-b2b6-469d-adae-a4950184fa2f",
        "key": "批次状态ID",
        "batch_field": "诊断批次ID",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-id", required=True, help="要删除的诊断批次ID")
    parser.add_argument("--tables", nargs="*", choices=FORM_CONFIG.keys(), default=list(FORM_CONFIG.keys()))
    parser.add_argument("--query-limit", type=int, default=10000, help="每张表最多读取行数")
    parser.add_argument("--dry-run", action="store_true", help="只打印将删除的记录，不实际删除")
    parser.add_argument("--yes", action="store_true", help="实际删除必须添加该参数")
    return parser.parse_args()


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


def form_delete(fm_id: str, row_id: str) -> None:
    subprocess.run(["guancli", "form", "delete", fm_id, row_id], check=True)


def main() -> None:
    args = parse_args()
    if not args.dry_run and not args.yes:
        raise SystemExit("实际删除请添加 --yes；建议先运行 --dry-run")

    summary = []
    for table_name in args.tables:
        config = FORM_CONFIG[table_name]
        records = run_json(
            [
                "guancli",
                "form",
                "query",
                config["fm_id"],
                "--limit",
                str(args.query_limit),
                "-f",
                "json",
            ]
        )
        matches = [record for record in records if str(record.get(config["batch_field"], "")) == args.batch_id]
        for record in matches:
            row_id = record.get("rowId") or record.get("row_id")
            key_value = record.get(config["key"], "")
            if not row_id:
                raise RuntimeError(f"{table_name} 匹配到记录但缺少 rowId：{key_value}")
            if args.dry_run:
                print(f"[dry-run] {table_name} delete {config['key']}={key_value} rowId={row_id}")
            else:
                print(f"[delete] {table_name} {config['key']}={key_value} rowId={row_id}")
                form_delete(config["fm_id"], str(row_id))
        summary.append(
            {
                "table": table_name,
                "fm_id": config["fm_id"],
                "matched_rows": len(matches),
                "deleted_rows": 0 if args.dry_run else len(matches),
            }
        )
    print(json.dumps({"batch_id": args.batch_id, "dry_run": args.dry_run, "summary": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
