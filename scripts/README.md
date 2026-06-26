# Codex 诊断联调脚本

## 0. 一键诊断任务入口

正式联调优先使用一键入口，串联真实指标取数、HYBRID 输出生成、当前态 upsert 写表和表单层反查：

```bash
END_DATE=$(date -v-1d +%Y-%m-%d)
END_MONTH=${END_DATE%-*}
python3 scripts/run_codex_diagnosis_job.py --start-month 2026-03 --end-month "$END_MONTH" --end-date "$END_DATE" --dealer-codes MQ2051 --brand-name MG --yes
```

按大区运行时使用 `--region-name`，脚本会从销售漏斗源自动识别该大区下的 MG 一网门店：

```bash
python3 scripts/run_codex_diagnosis_job.py --start-month 2026-06 --end-month 2026-06 --end-date 2026-06-24 --region-name 东南 --brand-name MG --dcc-limit 50000 --dcc-chunk-size 10 --dry-run-write
```

写表前验证可使用 dry-run：

```bash
python3 scripts/run_codex_diagnosis_job.py --start-month 2026-03 --end-month "$END_MONTH" --end-date "$END_DATE" --dealer-codes MQ2051 --brand-name MG --dry-run-write
```

说明：

- 一键入口固定使用当前已确认的口径参数。
- 正式定时任务统计范围固定为 `2026-03-01` 至昨天；`--end-date` 包含该日期，不包含今天数据。
- 实际写表使用 `--current-state-upsert`，不会先删除旧数据。
- `--dry-run-write` 只模拟写表，不校验未写入批次的表单可见性。
- `--dealer-codes` 和 `--region-name` 二选一；区域任务的 DCC 话务数据会按 `--dcc-chunk-size` 分片读取，避免触发观远 preview 单次 60,000 行上限。

## 1. 全 mock 批次输出

仅用于验证本地生成、表单写入、upsert 和表单反查链路，不代表真实业务数据。

```bash
python3 scripts/run_mock_codex_diagnosis.py --stat-month 2026-03
```

输出目录：

```text
outputs/mock_codex_run/<MOCK批次ID>/
```

目录内会生成：

- `门店诊断结果表.csv/json`
- `官方排名分位结果表.csv/json`
- `Codex批次状态表.csv/json`
- `mock_inputs/IP电话顾问邀约问题诊断表_mock.csv/json`
- `mock_inputs/试驾顾问接待问题诊断表_mock.csv/json`
- `manifest.json`

## 2. 真实指标 + mock 打标批次输出

用于当前更接近正式链路的联调：

```text
真实销售漏斗指标
+ 真实 DCC 话务指标
+ 真实试驾指标
+ mock IP/试驾打标明细
-> 三张 Codex 输出表
```

该脚本不会默认猜测关键统计口径。以下参数必须显式传入，否则直接中止：

| 参数 | 当前可选值 | 含义 |
|---|---|---|
| `--confirm-sales-scope` | `brand_all_series_all_channel` | 确认销售漏斗按指定品牌、全部车系、全部渠道聚合 |
| `--confirm-dcc-dedup` | `lead_any_row` | 确认 DCC 同一线索多行时任一行满足即计入分子 |
| `--confirm-drive-month-field` | `trial_recv_date` | 确认试驾按试驾接待日期归属自然月 |
| `--confirm-mock-tags` | `selected_dealers_only` | 确认 mock 打标明细只为本轮选定经销商生成 |

示例命令需在上述口径确认后再执行：

```bash
python3 scripts/run_hybrid_codex_diagnosis.py \
  --start-month 2026-03 \
  --end-month 2026-06 \
  --end-date 2026-06-24 \
  --dealer-codes MQ2051 \
  --brand-name MG \
  --confirm-sales-scope brand_all_series_all_channel \
  --confirm-dcc-dedup lead_any_row \
  --confirm-drive-month-field trial_recv_date \
  --confirm-mock-tags selected_dealers_only
```

输出目录：

```text
outputs/hybrid_codex_run/<HYBRID批次ID>/
```

目录内除三张输出表和 mock 打标明细外，还会生成：

- `source_snapshots/sales_rows.csv/json`
- `source_snapshots/rank_scope_sales_rows.csv/json`
- `source_snapshots/dcc_metrics.json`
- `source_snapshots/drive_metrics.json`

这些快照用于核验本次联调的真实输入和聚合结果。

## 3. 当前态写表 dry-run

```bash
python3 scripts/guancli_form_load.py outputs/hybrid_codex_run/<HYBRID批次ID> --current-state-upsert --dry-run
```

正式 Codex 定时任务使用 `--current-state-upsert`：

- 先完成真实数据取数和本地输出生成。
- 再按不含批次的当前态主键更新表单现有行。
- 当前态主键命中则 `form update`，未命中才 `form add`。
- 不会在写入前删除旧数据，避免新批次失败导致表单为空。
- 前端只需要按经销商、日期区间和指标读取当前态数据，不需要筛选批次。

安全保护：

- 当前态主键字段不能为空，否则脚本直接中止。
- 取数或本地生成失败时，不会进入表单写入步骤，旧数据保留。
- 写表中途失败时，不会因为预删除导致表单为空；但 `guancli form update/add` 不是事务，可能存在部分行已更新，需要依赖日志排查并在生产化前补充快照回滚。
- 实际写入必须加 `--yes`。

测试或排障时仍可使用普通 `upsert`：

- 先读取表单中已有业务主键。
- 主键存在则 `form update`。
- 主键不存在则 `form add`。
- 因此定时任务复跑同一个批次时，不会重复插入同一业务主键记录。

如果只想强制新增，可显式传入：

```bash
python3 scripts/guancli_form_load.py outputs/mock_codex_run/<MOCK批次ID> --mode add --dry-run
```

## 4. 删除某个批次后重灌

如需清理测试批次或完整重灌某个批次，可以先按 `诊断批次ID` 删除三张表单中的对应记录，再重新写入。这个流程只用于测试清理或错误批次处理，不作为正式定时任务流程。

先 dry-run：

```bash
python3 scripts/guancli_form_delete_batch.py --batch-id <诊断批次ID> --dry-run
```

确认匹配行数无误后再实际删除：

```bash
python3 scripts/guancli_form_delete_batch.py --batch-id <诊断批次ID> --yes
```

删除后如需重写正式当前态：

```bash
python3 scripts/guancli_form_load.py outputs/hybrid_codex_run/<HYBRID批次ID> --current-state-upsert --yes
```

建议：按批次删除只用于测试批次、错误批次清理；正式定时任务使用 `--current-state-upsert`，不先删除旧数据。

## 5. 写入观远表单

首轮建议限制每张表少量记录：

```bash
python3 scripts/guancli_form_load.py outputs/mock_codex_run/<MOCK批次ID> --limit 1 --yes
```

正式链路写入完整 HYBRID 批次：

```bash
python3 scripts/guancli_form_load.py outputs/hybrid_codex_run/<HYBRID批次ID> --current-state-upsert --yes
```

正式链路请使用：

```bash
python3 scripts/guancli_form_load.py outputs/hybrid_codex_run/<HYBRID批次ID> --current-state-upsert --yes
```

## 6. 当前边界

- mock 批次使用 `诊断批次ID` 前缀 `MOCK_`。
- 真实指标 + mock 打标批次使用 `诊断批次ID` 前缀 `HYBRID_`。
- 批次状态表 `触发方式 = Mock测试`。
- 默认只处理 `2026-03-01` 及之后至昨天的数据，不包含今天；当前月按 `--end-date` 截断。
- 当前脚本使用本地精确匹配 upsert：读取表单已有记录后在本地按业务主键匹配，避免依赖 `form query --filter` 的过滤结果。
- 在业务口径未明确前，不执行真实指标批次写表。

## 7. 校验指定批次是否已写入表单

写表后，用以下脚本区分两层状态：

```bash
python3 scripts/validate_codex_batch_visibility.py --batch-id <诊断批次ID>
```

输出含义：

| 字段 | 含义 |
|---|---|
| `form_layer_ok` | 三张表单是否都能通过 `guancli form query` 读到该批次 |
| `dataset_layer_ok` | 默认不校验；只有添加 `--check-dataset` 时才检查表单数据集层 |

Codex 定时任务验收只要求 `form_layer_ok = true`。表单数据集由观远每日定时刷新，不作为 Codex 写表任务的即时验收项。
