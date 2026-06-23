#!/usr/bin/env python3
"""Validate whether a Codex batch is visible in Guandata forms."""

from __future__ import annotations

import argparse
import json
import subprocess
from typing import Any


TABLE_CONFIG = {
    "门店诊断结果表": {
        "fm_id": "a_11770b-f0d7-4349-a33d-00d76e485ef2",
        "ds_id": "baf4b86a458ca4b2a8ce874d",
        "batch_field": "诊断批次ID",
        "key_field": "诊断结果ID",
    },
    "官方排名分位结果表": {
        "fm_id": "a_50f89c-da7c-46cc-aaa1-b09a8de9b5b5",
        "ds_id": "xa257b3a018be4418b6100bc",
        "batch_field": "诊断批次ID",
        "key_field": "排名结果ID",
    },
    "Codex批次状态表": {
        "fm_id": "a_1c81a3-b2b6-469d-adae-a4950184fa2f",
        "ds_id": "vef05c5e538074b2885f3445",
        "batch_field": "诊断批次ID",
        "key_field": "批次状态ID",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-id", required=True, help="要校验的诊断批次ID")
    parser.add_argument("--limit", type=int, default=5000, help="每张表读取最大行数")
    parser.add_argument("--check-dataset", action="store_true", help="可选排障：同时校验表单数据集层是否可见")
    parser.add_argument("--json-output", action="store_true", help="只输出 JSON 结果")
    return parser.parse_args()


def run_json(command: list[str]) -> tuple[list[dict[str, Any]], str | None]:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        return [], (
            "command failed: "
            + " ".join(command)
            + "\nstdout="
            + result.stdout
            + "\nstderr="
            + result.stderr
        )
    try:
        return json.loads(result.stdout or "[]"), None
    except json.JSONDecodeError as exc:
        return [], f"json decode failed: {exc}\nstdout={result.stdout}"


def local_filter(rows: list[dict[str, Any]], batch_field: str, batch_id: str) -> list[dict[str, Any]]:
    return [row for row in rows if str(row.get(batch_field, "")) == batch_id]


def key_preview(rows: list[dict[str, Any]], key_field: str, max_items: int = 5) -> list[str]:
    return [str(row.get(key_field, "")) for row in rows[:max_items]]


def validate_table(table_name: str, config: dict[str, str], batch_id: str, limit: int, skip_dataset: bool) -> dict[str, Any]:
    form_rows, form_error = run_json(
        [
            "guancli",
            "form",
            "query",
            config["fm_id"],
            "--limit",
            str(limit),
            "-f",
            "json",
        ]
    )
    form_matches = local_filter(form_rows, config["batch_field"], batch_id)

    dataset_rows: list[dict[str, Any]] = []
    dataset_error = None
    dataset_matches: list[dict[str, Any]] = []
    if not skip_dataset:
        dataset_rows, dataset_error = run_json(
            [
                "guancli",
                "ds",
                "preview",
                config["ds_id"],
                "--limit",
                str(limit),
                "-f",
                "json",
            ]
        )
        dataset_matches = local_filter(dataset_rows, config["batch_field"], batch_id)

    return {
        "table": table_name,
        "fm_id": config["fm_id"],
        "ds_id": config["ds_id"],
        "form": {
            "checked_rows": len(form_rows),
            "matched_rows": len(form_matches),
            "visible": bool(form_matches),
            "sample_keys": key_preview(form_matches, config["key_field"]),
            "error": form_error,
        },
        "dataset": {
            "checked_rows": len(dataset_rows),
            "matched_rows": len(dataset_matches),
            "visible": bool(dataset_matches),
            "sample_keys": key_preview(dataset_matches, config["key_field"]),
            "error": dataset_error,
            "skipped": skip_dataset,
        },
    }


def main() -> None:
    args = parse_args()
    skip_dataset = not args.check_dataset
    tables = [
        validate_table(table_name, config, args.batch_id, args.limit, skip_dataset)
        for table_name, config in TABLE_CONFIG.items()
    ]
    result = {
        "batch_id": args.batch_id,
        "form_layer_ok": all(table["form"]["visible"] for table in tables),
        "dataset_layer_ok": all(table["dataset"]["visible"] for table in tables) if args.check_dataset else None,
        "tables": tables,
    }
    if args.json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(f"批次ID: {args.batch_id}")
    print(f"表单层可见: {'是' if result['form_layer_ok'] else '否'}")
    if not args.check_dataset:
        print("数据集层可见: 未校验")
    else:
        print(f"数据集层可见: {'是' if result['dataset_layer_ok'] else '否'}")
    for table in tables:
        print(
            f"- {table['table']}: "
            f"form={table['form']['matched_rows']} / "
            f"dataset={'跳过' if table['dataset']['skipped'] else table['dataset']['matched_rows']}"
        )
        if table["form"]["error"]:
            print(f"  form_error: {table['form']['error']}")
        if table["dataset"]["error"]:
            print(f"  dataset_error: {table['dataset']['error']}")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
