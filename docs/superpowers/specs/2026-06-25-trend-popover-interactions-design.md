# Trend Popover Interactions Design

## Background

The single-store Super APP currently renders the invitation and test-drive trend popovers as static SVG line charts. The chart data is now sourced from real daily aggregates:

- Invitation trend: DCC dataset 182, grouped by `下发CRM时间`.
- Test-drive trend: test-drive wide table, grouped by `试驾接待日期`.

Negative tagging metrics remain mock-backed and must not be mixed into the real daily trend popovers.

## Goal

Add two interactions to both trend popovers:

1. Legend click toggles a metric line between hidden and visible.
2. Chart hover shows a tooltip for the nearest date and highlights the nearest visible metric line.

## Scope

In scope:

- Update only the frontend trend popover interaction and visual behavior.
- Keep the current real daily trend data contract unchanged.
- Support both invitation and test-drive trend popovers.
- Keep the current SVG implementation and no new chart dependency.

Out of scope:

- Changing DCC or test-drive metric formulas.
- Adding negative tagging metrics to real trend charts.
- Adding range zoom, brushing, export, or drill-down.
- Replacing the chart with ECharts, Recharts, or another library.

## Current Structure

Primary files:

- `super-app/src/App.tsx`
  - `TrendPopover` renders the SVG, legend, and empty state.
  - `buildTrendPoint` maps values into SVG coordinates.
- `super-app/src/types.ts`
  - `DailyTrendData` and `TrendSeries` define the trend data shape.
- `super-app/src/services/storeDiagnosis.ts`
  - Builds real `dailyTrendData` for invitation and test-drive charts.
- `super-app/src/styles.css`
  - Holds trend popover, chart, empty state, and legend styles.

## Recommended Approach

Use the existing SVG chart and add local UI state inside `TrendPopover`.

Reasons:

- Lowest delivery risk because it follows the current component structure.
- No new dependency or bundle-size impact.
- Direct control over the exact visual behavior inside the compact popover.

Rejected approaches:

- Chart library replacement: faster default tooltip and legend support, but introduces styling and packaging risk.
- Point-only tooltip: simpler but too hard to use because users must hit exact dots.

## Interaction Design

### Legend Toggle

Default state:

- All real trend series are visible.
- Invitation shows 4 real lines:
  - `线索接通率`
  - `30s以下线索占比`
  - `30分钟外呼率`
  - `2天3呼率`
- Test-drive shows 2 real lines:
  - `试驾平均里程`
  - `平均时长`

Click behavior:

- Clicking a visible legend item hides the matching line and latest point.
- Clicking a hidden legend item restores the matching line and latest point.
- Hidden legend items remain visible in the legend but appear muted.
- The chart must keep at least one visible line. If only one line remains visible, clicking it again does nothing.

Tooltip impact:

- Hidden series are excluded from hover hit testing.
- Hidden series are excluded from the tooltip list.

### Hover Tooltip

Behavior follows option C confirmed by the user:

- Mouse movement in the plot area snaps horizontally to the nearest date.
- Tooltip displays the date and all currently visible metric values for that date.
- The metric line nearest to the mouse pointer is highlighted.
- The corresponding row in the tooltip is highlighted.
- A vertical guide line marks the snapped date.
- Small points are shown for every visible metric at that date.
- Mouse leaving the chart clears the guide line, points, highlight, and tooltip.

Formatting:

- Percent metrics use one decimal place plus `%`.
- `试驾平均里程` uses one decimal place plus `km`.
- `平均时长` uses one decimal place plus `min`.

### Empty State

If a trend has no visible data:

- Existing empty state remains: `当前筛选范围暂无可展示的日趋势数据`.
- Legend and hover interactions are not shown.

If all but one series are hidden:

- The chart still renders one line.
- Tooltip still works for the remaining line.

## Visual Design

Legend:

- Use button-like legend items without heavy borders.
- Visible item: current colored dot and normal text.
- Hidden item: low-opacity text and muted dot.
- Cursor indicates clickability.

Hover:

- Vertical guide line: thin dashed gray line.
- Hover points: small filled dots using each series color.
- Highlighted line: slightly thicker and fully opaque.
- Non-highlighted visible lines: slightly lower opacity while hovering.
- Tooltip: white background, thin border, light shadow, compact rows.

Tooltip placement:

- Tooltip stays inside the chart container when possible.
- Prefer placing it to the right of the hover point.
- If it would overflow the right edge, place it to the left.
- If it would overflow vertically, clamp it inside the chart area.

## State Design

Inside `TrendPopover`:

- `hiddenSeriesNames: Set<string>`
  - Tracks hidden legend items.
  - Reset when the popover switches to a different `trend`.
- `hoverState`
  - `dayIndex`: snapped date index.
  - `nearestSeriesName`: closest visible metric line.
  - `x`: SVG/chart x coordinate for positioning.
  - `y`: SVG/chart y coordinate for positioning.

Derived values:

- `visibleSeries = trend.series.filter(series => !hiddenSeriesNames.has(series.name))`
- `chartSeries = visibleSeries` for lines, points, tooltip, and hit testing.

## Data Handling

No API or service change is required for this feature.

The existing `DailyTrendData` shape is enough:

```ts
interface DailyTrendData {
  eyebrow: string;
  title: string;
  yMin?: number;
  yMax?: number;
  ySuffix?: string;
  normalize?: boolean;
  days: string[];
  series: TrendSeries[];
}
```

The implementation must not read from `mockWorkbenchData.dailyTrendData` when live `dailyTrendData` exists.

## Error Handling

- If `trend` is null, render nothing.
- If no series or no days exist, render the existing empty state.
- If a series has missing value at a hovered day index, display `--` in the tooltip and skip its hover point.
- Do not throw if a series length is shorter than `trend.days`.

## Accessibility

- Legend items should be buttons with clear labels such as `隐藏线索接通率趋势` or `显示线索接通率趋势`.
- Hidden state should expose `aria-pressed` or equivalent.
- Tooltip is hover-only helper content and does not need keyboard focus in this version.
- Existing close button and dialog semantics remain unchanged.

## Testing And Verification

Build:

- Run `npm run build`.

Local interaction checks:

- Open invitation trend popover.
- Click each legend item and confirm matching line hides/restores.
- Confirm the last visible line cannot be hidden.
- Hover across the chart and confirm:
  - Guide line appears.
  - Tooltip date changes.
  - Tooltip includes only visible series.
  - Nearest series is highlighted.
- Repeat for test-drive trend popover.

Publish verification:

- Rebuild package.
- Upload and update the existing Guandata Super APP.
- Confirm online entry references the new JS and CSS assets.

## Acceptance Criteria

- Invitation trend supports independent hide/show for 4 real lines.
- Test-drive trend supports independent hide/show for 2 real lines.
- Hidden metrics do not appear in tooltip or hover highlight.
- At least one line always remains visible.
- Hover tooltip shows nearest date and visible metric values.
- Nearest metric line and tooltip row are highlighted.
- Existing empty state still works.
- Build passes and Guandata Super APP is updated.
