import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("小订资源使用最新统一 cache busting 版本", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const version = "20260806-toggle-icon-gap-v240";
  [
    "small-order.css",
    "small-order-responsive.css",
    "small-order-config.js",
    "small-order-api.js",
    "small-order-contract.js",
    "small-order-model.js",
    "small-order-view.js"
  ].forEach((file) => {
    assert.match(html, new RegExp(`\\./${file}\\?v=${version}`), file);
    assert.doesNotMatch(html, new RegExp(`\\./${file}\\?v=20260729-mg07-small-order-v204`), file);
    assert.doesNotMatch(html, new RegExp(`\\./${file}\\?v=20260801-mg07-investor-scope-v215`), file);
  });
  assert.match(html, /<script src="\.\/app\.js\?v=20260731-iron-export-v213"><\/script>/);
  assert.match(html, /<script src="\.\/organization-view\.js\?v=20260729-empty-role-hq-v205"><\/script>/);
  assert.match(html, /<script src="\.\/demo-fixture\.js\?v=20260806-standalone-demo-v237"><\/script>/);
});

test("build 产物保留最新小订 cache busting 版本", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const version = "20260806-toggle-icon-gap-v240";
  [
    "small-order-config.js",
    "small-order-api.js",
    "small-order-contract.js",
    "small-order-model.js",
    "small-order-view.js"
  ].forEach((file) => {
    assert.match(html, new RegExp(`\\./${file}\\?v=${version}`), file);
    assert.doesNotMatch(html, new RegExp(`\\./${file}\\?v=20260729-mg07-small-order-v204`), file);
    assert.doesNotMatch(html, new RegExp(`\\./${file}\\?v=20260801-mg07-investor-scope-v215`), file);
  });
});

test("v1.99 build 显式声明 Vite 相对 base 并挂接 dist CSS 子路径门禁", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.scripts.build, /vite build --base=\.\/(?:\s|$)/);
  assert.match(pkg.scripts.build, /node validation\/assert-dist-css-path\.mjs/);
});

test("小订与底部门店表使用相同的紧凑操作列和下钻按钮尺寸", async () => {
  const [view, smallOrderCss, visualCss] = await Promise.all([
    readFile(new URL("../small-order-view.js", import.meta.url), "utf8"),
    readFile(new URL("../small-order.css", import.meta.url), "utf8"),
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8")
  ]);
  assert.match(view, /<col class="small-order-action-col">/);
  assert.match(smallOrderCss, /\.small-order-table col\.small-order-action-col,[\s\S]*?width: 88px;[\s\S]*?min-width: 88px;[\s\S]*?max-width: 88px;/);
  assert.match(smallOrderCss, /\.small-order-link \{[\s\S]*?height: 28px;[\s\S]*?border-radius: 999px;[\s\S]*?padding: 0 11px;[\s\S]*?font-size: 12px;/);
  assert.match(visualCss, /--sales-col-action: 88px;/);
  assert.match(visualCss, /#salesTabPanel \.sales-table \.sticky-action \{[\s\S]*?width: var\(--sales-col-action\) !important;[\s\S]*?max-width: var\(--sales-col-action\) !important;/);
});

test("小订领先与落后状态使用统一胶囊尺寸和 500 字重", async () => {
  const [view, css] = await Promise.all([
    readFile(new URL("../small-order-view.js", import.meta.url), "utf8"),
    readFile(new URL("../small-order.css", import.meta.url), "utf8")
  ]);
  assert.match(view, /row\.status === "领先" \? "leading"/);
  assert.match(css, /\.small-order-status\.leading \{[\s\S]*?min-width: 49px;[\s\S]*?height: 22px;[\s\S]*?background: #10b9811f;[\s\S]*?padding: 0 8px;[\s\S]*?color: #0a7d56;[\s\S]*?font-size: 11px;[\s\S]*?font-weight: 500;/);
  assert.match(css, /\.small-order-status\.behind \{[\s\S]*?min-width: 49px;[\s\S]*?height: 22px;[\s\S]*?background: #ef44441f;[\s\S]*?padding: 0 8px;[\s\S]*?color: #c62828;[\s\S]*?font-size: 11px;[\s\S]*?font-weight: 500;/);
});

test("小订与打铁标题使用紧凑字号且小订数据行统一 500 字重", async () => {
  const [smallOrderCss, visualCss] = await Promise.all([
    readFile(new URL("../small-order.css", import.meta.url), "utf8"),
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8")
  ]);
  assert.match(smallOrderCss, /\.small-order-card \{\s*margin: 0;/);
  assert.match(smallOrderCss, /\.small-order-title-row h2 \{[\s\S]*?font-size: 16px;/);
  assert.match(smallOrderCss, /\.small-order-table td \{\s*font-weight: 500;/);
  assert.match(smallOrderCss, /\.small-order-table td:first-child \{[\s\S]*?font-weight: 500;/);
  assert.match(visualCss, /\.store-panel-title h3 \{[\s\S]*?font-size: 15px !important;/);
});

test("主表工具按钮使用 12px 字号且指标主数值降低至 600 字重", async () => {
  const css = await readFile(new URL("../visual-sync.css", import.meta.url), "utf8");
  assert.match(css, /\.funnel-kpi-value b \{[\s\S]*?font-weight: 600;/);
  assert.match(css, /\.export-btn,\s*\.all-dealers-btn \{[\s\S]*?min-height: 32px;[\s\S]*?padding: 0 12px;[\s\S]*?font-size: 12px;/);
  assert.match(css, /\.all-dealers-btn \{[\s\S]*?min-width: 124px;/);
  assert.match(css, /\.store-panel-head-right \.export-btn \{[\s\S]*?padding: 0 18px !important;/);
});

test("月环比与周环比切换文字使用 12px 字号", async () => {
  const css = await readFile(new URL("../visual-sync.css", import.meta.url), "utf8");
  assert.match(css, /\.check-toggle \{[\s\S]*?font-size: 12px;/);
  assert.match(css, /\.check-toggle \.box \{[\s\S]*?width: 16px;[\s\S]*?height: 16px;[\s\S]*?flex: 0 0 16px;/);
});

test("全部车系筛选器使用 210×34 参数和深色 Material Symbols 图标", async () => {
  const css = await readFile(new URL("../visual-sync.css", import.meta.url), "utf8");
  assert.match(css, /\.vehicle-series-filter \{[\s\S]*?width: 210px;[\s\S]*?min-width: 210px;[\s\S]*?height: 34px;[\s\S]*?flex: 0 0 210px;/);
  assert.match(css, /\.vehicle-series-trigger \{[\s\S]*?box-sizing: border-box;[\s\S]*?border: 1px solid rgba\(49, 107, 255, \.18\);[\s\S]*?background: #fffffff0;[\s\S]*?padding: 0 9px 0 11px;/);
  assert.match(css, /\.vehicle-series-icon \{[\s\S]*?position: static;[\s\S]*?flex: 0 0 18px;[\s\S]*?margin-left: auto;[\s\S]*?color: #122033;/);
});

test("小订展开按钮沿用查看所有经销商的中性色与高度", async () => {
  const [smallOrderCss, responsiveCss] = await Promise.all([
    readFile(new URL("../small-order.css", import.meta.url), "utf8"),
    readFile(new URL("../small-order-responsive.css", import.meta.url), "utf8")
  ]);
  assert.match(smallOrderCss, /\.small-order-toggle \{[\s\S]*?height: 32px;[\s\S]*?min-height: 32px;[\s\S]*?border: 1px solid #d9e2ef;[\s\S]*?background: #fff;[\s\S]*?color: #31425f;[\s\S]*?font-size: 12px;/);
  assert.match(smallOrderCss, /\.small-order-toggle \{[\s\S]*?display: inline-flex;[\s\S]*?gap: 4px;/);
  assert.match(responsiveCss, /@media \(max-width: 1366px\) and \(max-height: 820px\) \{[\s\S]*?\.small-order-toggle \{[\s\S]*?height: 30px;[\s\S]*?min-height: 30px;/);
});

test("小订表格末行不与外框叠加底部边线", async () => {
  const css = await readFile(new URL("../small-order.css", import.meta.url), "utf8");
  assert.match(css, /\.small-order-table tbody tr:last-child td \{\s*border-bottom: 0;/);
});

test("所有桌面分辨率下主表自然撑高且表头不吸顶", async () => {
  const [css, indexHtml, version01, version02] = await Promise.all([
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../外链优化-01.html", import.meta.url), "utf8"),
    readFile(new URL("../外链优化-02.html", import.meta.url), "utf8")
  ]);
  const version = "20260806-series-filter-v244";
  [indexHtml, version01, version02].forEach((html) => {
    assert.match(html, new RegExp(`\\./visual-sync\\.css\\?v=${version}`));
  });
  assert.match(css, /@media \(max-width: 1366px\) and \(max-height: 820px\) \{[\s\S]*?\.store-tabs-panel \.table-wrap \{[\s\S]*?max-height: none !important;/);
  assert.match(css, /\.store-tabs-panel th \{[\s\S]*?position: static;[\s\S]*?top: auto;[\s\S]*?z-index: auto;/);
  assert.match(css, /\.sales-table thead,\s*\.process-table thead \{[\s\S]*?position: static;[\s\S]*?top: auto;[\s\S]*?z-index: auto;/);
  assert.doesNotMatch(css, /max-height: calc\(100vh - 248px\)/);
});

test("主表 Tab 位于表格卡片外且标题保留在表格上方", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /<section class="store-tabs-panel"[^>]*>\s*<div class="store-tabs" role="tablist"[\s\S]*?<div class="store-tabs-card">/);
  assert.match(html, /<div class="store-tabs-card">\s*<div class="store-tabs-head">[\s\S]*?<div class="store-title-line">[\s\S]*?<h3 id="storeTableTitle">/);
  assert.doesNotMatch(html, /<div class="store-title-line">[\s\S]*?<div class="store-tabs" role="tablist"/);
  assert.doesNotMatch(html, /<div class="store-tabs-card">[\s\S]*?<div class="store-tab-line">\s*<div class="store-tabs"/);
  assert.match(css, /\.store-tabs-panel > \.store-tabs \{[\s\S]*?border-radius: 14px !important;[\s\S]*?background: #eef4fa !important;[\s\S]*?padding: 4px !important;[\s\S]*?margin-bottom: 8px;/);
  assert.match(css, /\.store-tabs-panel > \.store-tabs > \.store-tab\.active,[\s\S]*?background: #ffffff !important;[\s\S]*?box-shadow: 0 4px 14px rgba\(24, 39, 75, 0\.1\) !important;/);
  assert.match(css, /\.store-tabs-card > \.store-tabs-head > \.store-tab-line:not\(:has\(> :not\(\[hidden\]\)\)\) \{\s*display: none;/);
  assert.match(css, /\.store-tabs-panel \.store-tabs-card > \.store-tabs-head \{[\s\S]*?min-height: 46px !important;[\s\S]*?border-bottom: 0 !important;[\s\S]*?padding: 7px 16px !important;/);
  assert.match(css, /\.store-tabs-panel \.store-table-body \{\s*padding: 0 16px 14px !important;/);
});

test("指标展示位于查看所有经销商左侧并保持桌面端同排", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /<div id="processHeaderTools"[^>]*>[\s\S]*?<div id="processMetricToggles"[\s\S]*?<button id="toggleAllDealersProcess"[\s\S]*?<button id="exportProcess"/);
  assert.match(css, /\.process-tab-controls \{\s*margin-left: 0;/);
  assert.match(css, /@media \(min-width: 901px\) \{\s*\.process-header-tools\.is-visible \{\s*flex-wrap: nowrap;/);
});

test("打铁二级指标与看板链接位于打铁表现标题右侧", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../visual-sync.css", import.meta.url), "utf8")
  ]);
  const headStart = html.indexOf('<div class="store-tabs-head">');
  const bodyStart = html.indexOf('<div class="store-table-body">', headStart);
  const headerHtml = html.slice(headStart, bodyStart);
  assert.match(headerHtml, /<div class="store-panel-title">[\s\S]*?<div class="store-tab-line">[\s\S]*?<div id="ironMetricGroups"[\s\S]*?<div id="ironDashboardLinks"[\s\S]*?<div class="store-panel-head-right">/);
  assert.equal((html.match(/<div class="store-tab-line">/g) || []).length, 1);
  assert.match(css, /grid-template-columns: max-content minmax\(0, 1fr\) auto !important;/);
  assert.match(css, /grid-template-areas: "context subtabs tools" !important;/);
  assert.match(css, /\.store-tabs-card > \.store-tabs-head > \.store-tab-line \{[\s\S]*?grid-area: subtabs;[\s\S]*?justify-content: flex-start;/);
});

test("邀约与试驾指标使用独立圆角胶囊样式", async () => {
  const css = await readFile(new URL("../iron-metrics.css", import.meta.url), "utf8");
  assert.match(css, /\.iron-group-tab \{[\s\S]*?height: 32px;[\s\S]*?border: 1px solid transparent;[\s\S]*?border-radius: 10px;[\s\S]*?background: #f6f7f9;[\s\S]*?color: #334155;[\s\S]*?padding: 0 12px;/);
  assert.match(css, /\.iron-group-tab\.is-active \{[\s\S]*?border-color: #c7d5ff;[\s\S]*?background: #f1f5ff;[\s\S]*?color: var\(--rp-blue\);/);
  assert.doesNotMatch(css, /\.iron-group-tab::after/);
});

test("外链优化-02 独立使用左侧链条图标并保留 01 版本", async () => {
  const [v01, v02, css] = await Promise.all([
    readFile(new URL("../外链优化-01.html", import.meta.url), "utf8"),
    readFile(new URL("../外链优化-02.html", import.meta.url), "utf8"),
    readFile(new URL("../external-link-v02.css", import.meta.url), "utf8")
  ]);
  assert.match(v01, /打铁运营看板<span class="iron-dashboard-link-icon"[^>]*data-material-symbol="open_in_new"><\/span>/);
  assert.doesNotMatch(v01, /external-link-v02\.css/);
  assert.match(v02, /<body class="external-link-v02" data-theme="light">/);
  assert.match(v02, /external-link-v02\.css\?v=20260806-link-hover-v2/);
  assert.match(v02, /<span class="iron-dashboard-link-icon"[^>]*data-material-symbol="link"><\/span>打铁运营看板/);
  assert.match(v02, /<span class="iron-dashboard-link-icon"[^>]*data-material-symbol="link"><\/span>优质试驾看板/);
  assert.doesNotMatch(v02, /data-material-symbol="open_in_new"/);
  assert.match(css, /\.external-link-v02 \.iron-dashboard-link \{[\s\S]*?gap: 8px;[\s\S]*?font-size: 12px;[\s\S]*?font-weight: 600;[\s\S]*?text-decoration: none;/);
  assert.match(css, /\.external-link-v02 \.iron-dashboard-link:hover,[\s\S]*?text-decoration: underline;[\s\S]*?text-underline-offset: 3px;/);
  assert.match(css, /\.external-link-v02 \.iron-dashboard-link-icon \{[\s\S]*?width: 16px;[\s\S]*?height: 16px;/);
});
