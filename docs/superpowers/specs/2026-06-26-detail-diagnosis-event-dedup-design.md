# Detail Diagnosis Event Dedup Design

## Background

The detail diagnosis table currently displays one row per tag-hit row. In the IP tagging dataset, one call can hit multiple labels, and the same call can even hit the same primary label more than once. This makes the detail list look inflated and hard to read.

The confirmed direction is option A from the brainstorming review:

- The detail list is event-level: one call or one test-drive reception appears once.
- The row shows primary label chips and the total number of distinct problems.
- The drawer shows the full primary and secondary problem list.

## Goals

1. Remove visual inflation in the detail list.
2. Keep tag distribution accurate under event-deduplicated business counting.
3. Preserve all label evidence in the drawer.
4. Use the same display principle for invitation and test-drive tabs.

## Scope

In scope:

- Detail list aggregation and display logic.
- Tag distribution counting logic.
- Advisor distribution counting logic.
- Drawer detail structure for all labels on an event.
- Documentation updates for the new frontend display contract.

Out of scope:

- Changing source dataset schemas.
- Changing negative invitation or negative test-drive rate formulas beyond already confirmed event-level denominator rules.
- Creating new backend tables.
- Changing the upper funnel, process metric cards, or trend popovers.

## Event Grain

The event key defines one row in the detail list.

| Domain | Event key |
|---|---|
| 电话邀约 | `呼叫编码` |
| 试驾接待 | Use the true test-drive tagging table event key after the dataset is available. Preferred order: `试驾清单ID`, then `试驾接待编码`. |

If an event key is missing, the frontend may fall back to a stable composite key using customer, advisor, event time, primary label, and secondary label. This fallback is only for display resilience and must not be used as an official metric denominator.

## Counting Rules

### Detail List

- One row equals one event.
- A row is negative when the event has at least one negative tag.
- Within the same event, duplicate `一级标签 + 二级标签` combinations are deduplicated.
- The row displays unique primary labels as chips.
- If there are more primary labels than can fit, display the first few chips plus `+N`.
- The row also displays a compact problem count, for example `共 5 个问题`.

### Tag Distribution

Tag distribution must use event-distinct counting, not tag-hit-row counting.

| Level | Counting rule |
|---|---|
| 一级标签 | `count(distinct 事件ID)` within each primary label |
| 二级标签 | `count(distinct 事件ID)` within each `一级标签 + 二级标签` |

Example:

One call hits:

- 到店时间锁定 / 到店时间主动询问
- 到店时间锁定 / 具体日期/时段确认
- 到店时间锁定 / 到店时间主动询问

Then:

- Detail list count: 1 event row.
- Primary label `到店时间锁定`: count 1.
- Secondary label `到店时间主动询问`: count 1.
- Secondary label `具体日期/时段确认`: count 1.

### Advisor Distribution

Advisor distribution remains event-distinct:

- 电话邀约: count distinct `顾问编码 + 呼叫编码`.
- 试驾接待: count distinct advisor plus the confirmed test-drive event key.

## Detail Row Design

Columns remain compact and case-focused:

| Column | Display |
|---|---|
| 客户 | Event-level customer name |
| 顾问 | Event-level advisor name |
| 事件时间 | Call start time or test-drive event time |
| 命中问题 | Unique primary label chips, plus `共 N 个问题` |
| 问题摘要 | Summary sentence, not a concatenation of all hit reasons |
| 正负向 | Event-level polarity |

Summary sentence rule:

- Do not concatenate all hit reasons in the table row.
- Use a generated summary such as `命中 5 个负向问题，主要集中在到店时间锁定、到店理由构建、报价到店承接。`
- The drawer carries the full list of hit reasons and evidence.

## Drawer Design

The drawer remains the place for full diagnostic evidence.

Top fields:

- 客户
- 顾问
- 事件时间
- 正负向
- 命中问题数

Problem list:

| Field | Display |
|---|---|
| 一级问题 | Primary label |
| 二级问题 | Secondary label |
| 命中原因 | Dataset-provided hit reason |
| 证据原文 | Customer and advisor evidence snippets |

Grouping:

- Group problems by primary label.
- Within each primary label, show deduplicated secondary labels.
- If duplicate primary/secondary combinations have multiple evidence snippets, keep the strongest or latest snippet for compact display. If confidence is available, prefer higher confidence, otherwise prefer the latest event row by source order/time.

## Data Model Impact

The frontend should separate tag-hit rows from event records.

Recommended internal shapes:

```ts
interface DiagnosisProblem {
  primaryTag: string;
  secondaryTag: string;
  polarity: string;
  reason: string;
  evidence: string;
  confidence?: number;
}

interface DiagnosisRecord {
  eventId: string;
  customer: string;
  advisor: string;
  time: string;
  polarity: string;
  primaryTags: string[];
  problemCount: number;
  summary: string;
  problems: DiagnosisProblem[];
}
```

The existing `tag`, `primaryTag`, and `secondaryTag` fields can remain temporarily for compatibility, but the table should read from `primaryTags`, `problemCount`, and `problems` once the aggregation is implemented.

## Error Handling

- If an event has no primary label but is negative, show `未命中一级标签`.
- If an event has no secondary label but is negative, show `未命中二级标签` in the drawer.
- If no negative events exist, show an empty detail state instead of falling back to mock rows.
- If source fetch fails, the existing mock fallback may remain for local interaction, but the source note must clearly say it is fallback data.

## Testing

Minimum verification cases:

1. One event with one label displays one row and one problem.
2. One event with multiple primary labels displays one row, multiple primary chips, and drawer problem list.
3. One event with duplicate primary/secondary labels counts once in primary and secondary distribution.
4. Two events with the same primary label count as 2 in the primary distribution.
5. Advisor distribution counts events, not tag-hit rows.
6. Empty negative events do not display mock detail rows in live mode.

## Documentation Updates

When implemented, update:

- `单店销售诊断工作台_前端表单数据映射.md`
- `单店销售诊断工作台_数据口径文档.md`
- `单店销售诊断工作台_前端设计文档.md`
- `单店销售诊断工作台_PRD.md` only if product-facing field names change.
