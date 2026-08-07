import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";

test.describe.configure({ mode: "serial" });

const outputDir = fileURLToPath(new URL("../../qa-screenshots/mg07-small-order-demo-repair/", import.meta.url));
const screenshotResults = [];

const appSmallOrderRaw = {
  status: "ready",
  config: { qa: { requiredCodes: ["S1"] } },
  targetRows: [{ 区域: "大区1", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "100" }],
  organizationRows: [{ 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1" }],
  actualRows: [{ dealer_code: "S1", actual_small_order: 42, retained_small_order: 40, cancelled_small_order: 2, data_updated_at: "2026-08-12 16:00:00" }]
  ,
  todayRows: [{ dealer_code: "S1", actual_small_order: 6, data_updated_at: "2026-08-12 16:00:00" }],
  todayStatus: "ready"
};

const demoReport = {
  status: "ready",
  viewLevel: "area",
  nextLevel: "district",
  period: { status: "小订进行中", progressText: "58.8%" },
  summary: {
    target: 1500,
    actual: 642,
    todayActual: 216,
    achievementActual: 642,
    retained: 621,
    cancelled: 21,
    achievementRate: 0.428,
    progressText: "58.8%",
    laggingCount: 2,
    objectTotal: 7,
    scopeMode: "store_list",
    dataUpdatedAt: "demo fixture 今天 16:00",
    actualStatus: "ready"
  },
  rows: [
    row("东南大区", "A3", 320, 91, 25, 86, 5, 0.284, 30.4, "落后"),
    row("华中大区", "A5", 260, 102, 44, 97, 5, 0.392, 19.6, "落后"),
    row("华东大区", "A2", 290, 181, 69, 176, 5, 0.624, 0, "领先"),
    row("华北大区", "A1", 190, 88, 27, 86, 2, 0.463, 0, "领先"),
    row("西南大区", "A6", 170, 70, 19, 68, 2, 0.412, 0, "领先"),
    row("华南大区", "A4", 150, 63, 18, 61, 2, 0.42, 0, "领先"),
    row("西北大区", "A7", 120, 47, 14, 47, 0, 0.392, 0, "领先")
  ],
  anomalies: []
};

function row(name, code, target, actual, todayActual, retained, cancelled, rate, gap, status) {
  return { name, code, level: "area", target, actual, todayActual, achievementActual: actual, retained, cancelled, achievementRate: rate, gapToExpected: gap, status };
}

function parseColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  const [r, g, b, alpha] = match[1].split(",").map((part) => Number(part.trim()));
  const a = Number.isFinite(alpha) ? alpha : 1;
  return { r, g, b, a };
}

function composite(fg, bg) {
  const alpha = fg.a + bg.a * (1 - fg.a);
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha,
    a: alpha
  };
}

function luminance(color) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background, base) {
  const fg = parseColor(foreground);
  const bg = composite(parseColor(background), parseColor(base));
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

async function boot(page, theme = "light") {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-08-12" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: appSmallOrderRaw });
  await page.goto(`/?theme=${theme}&fixture=mg07-small-order-demo`);
  await page.waitForFunction(() => window.__retailPcApp?.getStateSnapshot?.().smallOrderReportStatus === "ready");
}

async function renderDemo(page, expanded = false) {
  await page.evaluate(({ report, viewState }) => {
    window.SmallOrderView.render(document.getElementById("smallOrderRoot"), report, viewState);
  }, { report: demoReport, viewState: { viewLevel: "area", drillPath: [], expanded } });
}

test("DOM 顺序、六卡、Badge、副标题、比较条和按钮符合 MG07 demo fixture", async ({ page }) => {
  await boot(page);
  const domOrder = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".funnel-overview-header, #smallOrderRoot, .funnel-overview-panels, .panel-head h3, .store-tabs-panel")];
    return nodes.map((node) => node.textContent.trim());
  });
  expect(domOrder.findIndex((text) => text.includes("销售总览"))).toBeLessThan(domOrder.findIndex((text) => text.includes("MG 07小订战报")));
  expect(domOrder.findIndex((text) => text.includes("MG 07小订战报"))).toBeLessThan(domOrder.findIndex((text) => text.includes("销售指标")));
  expect(domOrder.findIndex((text) => text.includes("销售指标"))).toBeLessThan(domOrder.findIndex((text) => text.includes("销售表现")));

  await renderDemo(page);
  await expect(page.locator(".small-order-badge")).toHaveText("小订进行中");
  await expect(page.locator(".small-order-title-row p")).toContainText("小订期 2026/07/29—2026/08/22 · 数据截至 demo fixture 今天 16:00 · 独立于销售日期和车系筛选");
  await expect(page.locator(".small-order-metric > span")).toHaveText(["小订目标", "留存小订", "今日新增", "目标达成", "时间进度", "落后大区"]);
  await expect(page.locator(".small-order-metric").nth(1)).toContainText("累计 642");
  await expect(page.locator(".small-order-metric").nth(1).locator("strong")).toHaveText("621");
  await expect(page.locator(".small-order-metric").nth(1)).not.toContainText("退订 21");
  await expect(page.locator(".small-order-metric").nth(2)).toContainText("+216");
  await expect(page.locator(".small-order-metric").nth(2)).not.toContainText("当日小订");
  await expect(page.locator(".small-order-metric").nth(5)).toContainText("共 7 个大区");
  await expect(page.locator(".small-order-pace-label")).toContainText("落后时间进度 16.0pp");
  const paceLabelStyle = await page.locator(".small-order-pace-label").evaluate((node) => {
    const style = getComputedStyle(node);
    return { whiteSpace: style.whiteSpace, height: node.getBoundingClientRect().height };
  });
  expect(paceLabelStyle.whiteSpace).toBe("nowrap");
  expect(paceLabelStyle.height).toBeLessThan(18);
  await expect(page.locator(".small-order-toggle")).toHaveText("查看小订达成表现（7）");
  await expect(page.locator(".small-order-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".small-order-toggle-icon")).toHaveAttribute("data-material-symbol", "expand_more");
  await expect(page.locator(".small-order-toggle")).not.toContainText("⌄");
  await expect(page.locator(".small-order-toggle")).not.toContainText("⌃");
  expect(await page.locator(".small-order-bar i").evaluate((node) => node.style.width)).toBe("42.8%");
  expect(await page.locator(".small-order-bar em").evaluate((node) => node.style.left)).toBe("58.8%");
  const targetColor = await page.locator(".small-order-metric.blue strong").evaluate((node) => getComputedStyle(node).color);
  const todayColor = await page.locator(".small-order-metric.green strong").evaluate((node) => getComputedStyle(node).color);
  const riskColor = await page.locator(".small-order-metric.red strong").first().evaluate((node) => getComputedStyle(node).color);
  expect(targetColor).toBe("rgb(49, 94, 251)");
  expect(todayColor).toBe("rgb(6, 118, 71)");
  expect(riskColor).toBe("rgb(217, 45, 32)");
});

test("浅深主题小订语义色和按钮文本对比度不低于 4.5", async ({ page }) => {
  const ratios = {};
  for (const theme of ["light", "dark"]) {
    await boot(page, theme);
    await renderDemo(page);
    const colors = await page.evaluate(() => {
      function sample(selector, backgroundSelector = null) {
        const node = document.querySelector(selector);
        const backgroundNode = backgroundSelector ? node.closest(backgroundSelector) : node;
        return {
          foreground: getComputedStyle(node).color,
          background: getComputedStyle(backgroundNode).backgroundColor,
          base: getComputedStyle(document.querySelector(".small-order-card")).backgroundColor
        };
      }
      return {
        target: sample(".small-order-metric.blue strong", ".small-order-metric"),
        today: sample(".small-order-metric.green strong", ".small-order-metric"),
        risk: sample(".small-order-metric.red strong", ".small-order-metric"),
        pp: sample(".small-order-pace-label b", ".small-order-pace-row"),
        button: sample(".small-order-toggle")
      };
    });
    ratios[theme] = Object.fromEntries(Object.entries(colors).map(([key, color]) => [key, Number(contrastRatio(color.foreground, color.background, color.base).toFixed(2))]));
    Object.values(ratios[theme]).forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5));
  }
  expect(ratios.light.target).toBeGreaterThanOrEqual(4.5);
});

test("默认收起，展开后表格只展示退订且按钮箭头和 aria 同步", async ({ page }) => {
  await boot(page);
  await renderDemo(page);
  await expect(page.locator("#smallOrderBody")).toBeHidden();
  await renderDemo(page, true);
  await expect(page.locator("#smallOrderBody")).toBeVisible();
  await expect(page.locator(".small-order-toggle")).toHaveText("收起小订达成表现");
  await expect(page.locator(".small-order-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".small-order-table thead th")).toHaveText(["对象名称", "对象代码", "小订目标", "留存小订", "今日新增", "目标达成", "时间进度", "应达缺口", "退订小订", "状态", "操作"]);
  await expect(page.locator(".small-order-table tbody tr").first().locator("td").nth(3)).toHaveText("86");
  await expect(page.locator(".small-order-table tbody tr").first().locator("td").nth(4)).toHaveText("+25");
  await expect(page.locator(".small-order-table tbody tr").first().locator("td").nth(8)).toHaveText("5");
  const leadingChip = page.locator(".small-order-status.leading").first();
  const leadingStyle = await leadingChip.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor, padding: style.padding, fontSize: style.fontSize, fontWeight: style.fontWeight };
  });
  expect(leadingStyle).toEqual({ width: 49, height: 22, color: "rgb(10, 125, 86)", background: "rgba(16, 185, 129, 0.12)", padding: "0px 8px", fontSize: "11px", fontWeight: "500" });
  const behindChip = page.locator(".small-order-status.behind").first();
  const behindStyle = await behindChip.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor, padding: style.padding, fontSize: style.fontSize, fontWeight: style.fontWeight };
  });
  expect(behindStyle).toEqual({ width: 49, height: 22, color: "rgb(198, 40, 40)", background: "rgba(239, 68, 68, 0.12)", padding: "0px 8px", fontSize: "11px", fontWeight: "500" });
});

test("1280/1366/1440 浅深主题 demo fixture 截图且无页面级横滚", async ({ page }) => {
  await mkdir(outputDir, { recursive: true });
  for (const theme of ["light", "dark"]) {
    for (const width of [1280, 1366, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
      await boot(page, theme);
      await renderDemo(page);
      const scroll = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
      expect(scroll.body).toBeLessThanOrEqual(scroll.viewport);
      const file = join(outputDir, `mg07-small-order-demo-fixture-${theme}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      screenshotResults.push({ theme, width, file, fixture: "mg07-small-order-demo", source: "SmallOrderView.render actual implementation" });
    }
  }
  await writeFile(`${outputDir}/screenshot-results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), screenshots: screenshotResults }, null, 2));
});
