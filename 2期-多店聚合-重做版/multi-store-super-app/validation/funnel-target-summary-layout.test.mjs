import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("月目标摘要只渲染在销售总览标题旁，不再进入销售指标卡片标题", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const overview = source.match(/function renderFunnelOverview[\s\S]*?function group/)?.[0] || "";

  assert.match(overview, /<div class="funnel-overview-title">[\s\S]*?<h2>销售总览<\/h2>[\s\S]*?\$\{targetSummary\(monthlyTarget\)\}[\s\S]*?<\/div>[\s\S]*?\$\{renderVehicleSeriesFilter\(\)\}/);
  assert.match(overview, /group\("销售指标", salesCards, "sales"\)/);
  assert.doesNotMatch(overview, /group\("销售指标", salesCards, "sales",\s*targetSummary/);
});

test("月目标 loading 骨架采用紧凑单行尺寸，避免旧版大块占位回退", async () => {
  const css = await readFile(new URL("../visual-sync.css", import.meta.url), "utf8");
  const loadingRule = css.match(/\.sales-target-summary\.loading\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body || "";
  const spanRule = css.match(/\.sales-target-summary\.loading span\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body || "";

  assert.match(loadingRule, /flex:\s*0 0 auto/);
  assert.match(loadingRule, /height:\s*12px/);
  assert.match(loadingRule, /gap:\s*6px/);
  assert.match(spanRule, /flex:\s*0 0 auto/);
  assert.match(spanRule, /height:\s*12px/);
  assert.match(css, /\.sales-target-summary\.loading span:nth-child\(1\),[\s\S]*?width:\s*32px/);
  assert.match(css, /\.sales-target-summary\.loading span:nth-child\(2\),[\s\S]*?width:\s*26px/);
  assert.match(css, /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.funnel-overview-title\s*\{[\s\S]*?flex-wrap:\s*wrap/);
});

test("销售总览空态由 raw sales 与目标展示态分离驱动，无销售事实时七卡占位但保留目标摘要", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const renderFunnel = source.match(/function renderFunnel\(\) \{[\s\S]*?function renderFunnelPlaceholder/)?.[0] || "";

  assert.match(renderFunnel, /const hasRawSalesData = typeof d\?\.hasRawSalesData === "boolean" \? d\.hasRawSalesData : Boolean\(d\?\.stores\?\.length\);/);
  assert.match(renderFunnel, /const hasTargetDisplayState = typeof d\?\.hasTargetDisplayState === "boolean"[\s\S]*?\? d\.hasTargetDisplayState[\s\S]*?: Boolean\(/);
  assert.match(renderFunnel, /!hasRawSalesData && !hasTargetDisplayState && !d\.stores\.length/);
  assert.doesNotMatch(renderFunnel, /hasSummaryData/);
  assert.match(renderFunnel, /if \(!hasRawSalesData\) \{[\s\S]*?renderFunnelOverview\(placeholderSalesCards\(\), placeholderProcessCards\(\), d\.monthlyTarget\);[\s\S]*?return;/);
  assert.match(source, /function placeholderSalesCards\(\) \{[\s\S]*?\["订单", "单"\][\s\S]*?\["交付率", ""\][\s\S]*?\["零售", "台"\][\s\S]*?card\(label, "--", unit, null, null\)/);
  assert.match(source, /function placeholderProcessCards\(\) \{[\s\S]*?card\("线索到店率", "--", "", null, null\)[\s\S]*?card\("线索订单率", "--", "", null, null\)/);
});
