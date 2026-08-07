import { expect, test } from "@playwright/test";
import { makeFixture, profiles, storesFor } from "./pc-role-drilldown-fixtures.js";

const smallOrderRaw = {
  status: "ready",
  config: {
    qa: { requiredCodes: ["S1", "S2"] }
  },
  targetRows: [
    { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "10" },
    { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S2", 经销商简称: "门店2", MG07小订目标: "10" },
    { 区域: "大区2", 省份: "安徽", 城市: "合肥", MAC: "小区3", 一级经销商: "S4", 经销商简称: "门店4", MG07小订目标: "10" }
  ],
  organizationRows: [
    { 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" },
    { 品牌名称: "MG", 一级经销商代码: "S2", 经销商简称: "门店2", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" },
    { 品牌名称: "MG", 一级经销商代码: "S4", 经销商简称: "门店4", 大区代码: "A2", 大区名称: "大区2", 小区代码: "D3", 小区名称: "小区3", MAC: "小区3" }
  ],
  actualRows: [
    { dealer_code: "S1", actual_small_order: 1, retained_small_order: 1, cancelled_small_order: 0, data_updated_at: "2026-07-29 09:00:00" },
    { dealer_code: "S2", actual_small_order: 0, retained_small_order: 0, cancelled_small_order: 0, data_updated_at: "2026-07-29 09:00:00" },
    { dealer_code: "S4", actual_small_order: 9, retained_small_order: 8, cancelled_small_order: 1, data_updated_at: "2026-07-29 09:00:00" }
  ]
};

async function waitForSmallOrder(page) {
  await page.waitForFunction(() => Boolean(window.__retailPcApp?.getStateSnapshot));
  await page.waitForFunction(() => {
    const snapshot = window.__retailPcApp?.getStateSnapshot?.();
    return Boolean(snapshot?.smallOrderReportStatus && snapshot.smallOrderReportStatus !== "loading");
  });
  return page.evaluate(() => window.__retailPcApp.getStateSnapshot());
}

async function bootSmallOrderFixture(page, { smallOrderValue = smallOrderRaw, today = "2026-07-29", profileValue = profiles.headquarters, fixtureValue = makeFixture(), url = "/" } = {}) {
  await page.addInitScript(({ profile, fixture, smallOrder, todayValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profile));
    window.__retailPcFixture = { ...fixture, smallOrderRaw: smallOrder, smallOrderToday: todayValue };
  }, { profile: profileValue, fixture: fixtureValue, smallOrder: smallOrderValue, todayValue: today });
  await page.goto(url);
  return waitForSmallOrder(page);
}

async function expandedTodayCells(page) {
  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  return page.locator(".small-order-table tbody tr td:nth-child(5)").allTextContents();
}

function rowTodayText(value) {
  return value == null ? "--" : `+${Number(value).toLocaleString("zh-CN")}`;
}

test("MG 07 小订战报默认收起，展开和下钻只改变 smallOrderViewState", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  await expect(page.locator("#smallOrderRoot")).toContainText("MG 07小订战报");
  await expect(page.locator("#smallOrderBody")).toBeHidden();
  let snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderText).toContain("小订目标");
  expect(snapshot.smallOrderText).toContain("留存小订");
  expect(snapshot.smallOrderText).not.toContain("累计小订");
  expect(snapshot.smallOrderText).toContain("目标达成");
  expect(snapshot.smallOrderText).toContain("时间进度");
  expect(snapshot.smallOrderText).toContain("落后大区");
  expect(snapshot.smallOrderText).toContain("累计 10");
  expect(snapshot.smallOrderText).not.toContain("退订 1");
  expect(snapshot.smallOrderSummary.actual).toBe(10);
  expect(snapshot.smallOrderSummary.cancelled).toBe(1);
  expect(snapshot.smallOrderSummary.retained).toBe(9);
  expect(snapshot.smallOrderSummary.objectTotal).toBe(2);
  expect(snapshot.smallOrderViewState.expanded).toBe(false);
  expect(snapshot.viewLevel).toBe("area");
  expect(snapshot.drillPath).toEqual([]);

  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  await expect(page.locator("#smallOrderBody")).toBeVisible();
  await page.getByRole("button", { name: "查看小区" }).first().click();
  snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.smallOrderViewState.expanded).toBe(true);
  expect(snapshot.smallOrderViewState.viewLevel).toBe("district");
  expect(snapshot.smallOrderViewState.drillPath).toHaveLength(1);
  expect(snapshot.viewLevel).toBe("area");
  expect(snapshot.drillPath).toEqual([]);

  await page.reload();
  await expect(page.locator("#smallOrderBody")).toBeHidden();
  snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderViewState.expanded).toBe(false);
});

test("活动开始前展示即将开始、实际为0且无伪更新时间", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-27" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderText).toContain("小订即将开始");
  expect(snapshot.smallOrderSummary.actual).toBe(0);
  expect(snapshot.smallOrderSummary.progressText).toBe("0.0%");
  expect(snapshot.smallOrderText).not.toContain("数据更新于");
  expect(snapshot.smallOrderText).not.toContain("fixture");
  expect(snapshot.smallOrderText).toContain("数据截至 小订尚未开始");
});

test("v2.04 今日新增期前、期后、无当天数据和日查询失败均展示 -- 且不拖垮累计", async ({ page }) => {
  const scenarios = [
    { name: "期前", today: "2026-07-28", raw: { todayStatus: "out_of_period" }, expectedActual: 0, expectedRate: 0 },
    { name: "期后", today: "2026-08-23", raw: { todayRows: [{ dealer_code: "S1", actual_small_order: 99 }], todayStatus: "out_of_period" }, expectedActual: 10, expectedRate: 9 / 30 },
    { name: "无当天数据", today: "2026-08-12", raw: { todayRows: [], todayStatus: "no_data" }, expectedActual: 10, expectedRate: 9 / 30 },
    { name: "日查询失败", today: "2026-08-12", raw: { todayRows: [{ dealer_code: "S1", actual_small_order: 99 }], todayStatus: "today_unavailable", todayError: "MG 07 小订今日新增数据暂不可用" }, expectedActual: 10, expectedRate: 9 / 30 }
  ];
  for (const item of scenarios) {
    const raw = { ...smallOrderRaw, ...item.raw };
    const snapshot = await bootSmallOrderFixture(page, { smallOrderValue: raw, today: item.today });
    expect(snapshot.smallOrderReportStatus, item.name).toBe("ready");
    expect(snapshot.smallOrderSummary.todayActual, item.name).toBeNull();
    expect(snapshot.smallOrderSummary.actual, item.name).toBe(item.expectedActual);
    expect(snapshot.smallOrderSummary.achievementRate, item.name).toBeCloseTo(item.expectedRate, 6);
    await expect(page.locator(".small-order-metric", { hasText: "今日新增" })).toContainText("--");
    const todayValues = await expandedTodayCells(page);
    expect(todayValues.length, item.name).toBeGreaterThan(0);
    expect(todayValues.every((value) => value.trim() === "--"), item.name).toBe(true);
  }
});

test("小订达成表现 HQ 连续下钻只改变表格，摘要六卡和进度条保持顶部范围", async ({ page }) => {
  const hierarchyRaw = {
    ...smallOrderRaw,
    targetRows: [
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "100" },
      { 区域: "大区1", 省份: "江苏", 城市: "苏州", MAC: "小区2", 一级经销商: "S2", 经销商简称: "门店2", MG07小订目标: "100" },
      { 区域: "大区2", 省份: "安徽", 城市: "合肥", MAC: "小区3", 一级经销商: "S3", 经销商简称: "门店3", MG07小订目标: "100" },
      { 区域: "大区2", 省份: "安徽", 城市: "芜湖", MAC: "小区3", 一级经销商: "S4", 经销商简称: "门店4", MG07小订目标: "100" }
    ],
    organizationRows: [
      { 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" },
      { 品牌名称: "MG", 一级经销商代码: "S2", 经销商简称: "门店2", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D2", 小区名称: "小区2", MAC: "小区2" },
      { 品牌名称: "MG", 一级经销商代码: "S3", 经销商简称: "门店3", 大区代码: "A2", 大区名称: "大区2", 小区代码: "D3", 小区名称: "小区3", MAC: "小区3" },
      { 品牌名称: "MG", 一级经销商代码: "S4", 经销商简称: "门店4", 大区代码: "A2", 大区名称: "大区2", 小区代码: "D3", 小区名称: "小区3", MAC: "小区3" }
    ],
    actualRows: [
      { dealer_code: "S1", actual_small_order: 50, retained_small_order: 49, cancelled_small_order: 1, data_updated_at: "2026-08-12 09:00:00" },
      { dealer_code: "S2", actual_small_order: 0, retained_small_order: 0, cancelled_small_order: 0, data_updated_at: "2026-08-12 09:00:00" },
      { dealer_code: "S3", actual_small_order: 40, retained_small_order: 39, cancelled_small_order: 1, data_updated_at: "2026-08-12 09:00:00" },
      { dealer_code: "S4", actual_small_order: 40, retained_small_order: 39, cancelled_small_order: 1, data_updated_at: "2026-08-12 09:00:00" }
    ],
    todayRows: [
      { dealer_code: "S1", actual_small_order: 1000 },
      { dealer_code: "S2", actual_small_order: 0 },
      { dealer_code: "S3", actual_small_order: 4000 },
      { dealer_code: "S4", actual_small_order: 5999 }
    ],
    todayStatus: "ready"
  };
  const fixture = makeFixture({ stores: storesFor({}) });
  const snapshot = await bootSmallOrderFixture(page, { smallOrderValue: hierarchyRaw, today: "2026-08-12", fixtureValue: fixture });
  expect(snapshot.smallOrderSummary.actual).toBe(130);
  expect(snapshot.smallOrderSummary.todayActual).toBe(10999);
  expect(snapshot.smallOrderSummary.retained).toBe(127);
  expect(snapshot.smallOrderSummary.achievementRate).toBeCloseTo(127 / 400, 6);
  expect(snapshot.smallOrderSummary.objectTotal).toBe(2);
  const baseSummary = JSON.stringify(snapshot.smallOrderSummary);
  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  const baseCards = await page.locator(".small-order-summary").textContent();
  const basePace = await page.locator(".small-order-pace-label").textContent();
  let rows = page.locator(".small-order-table tbody tr");
  await expect(rows.first().locator("td").nth(0)).toHaveText("大区1");
  await expect(rows.first().locator("td").nth(4)).toHaveText(rowTodayText(1000));
  await expect(rows.nth(1).locator("td").nth(0)).toHaveText("大区2");
  await expect(rows.nth(1).locator("td").nth(4)).toHaveText(rowTodayText(9999));

  await page.getByRole("button", { name: "查看小区" }).first().click();
  let drilled = await waitForSmallOrder(page);
  expect(JSON.stringify(drilled.smallOrderSummary)).toBe(baseSummary);
  expect(await page.locator(".small-order-summary").textContent()).toBe(baseCards);
  expect(await page.locator(".small-order-pace-label").textContent()).toBe(basePace);
  rows = page.locator(".small-order-table tbody tr");
  await expect(rows.first().locator("td").nth(0)).toHaveText("小区2");
  await expect(rows.first().locator("td").nth(4)).toHaveText("+0");
  await expect(rows.nth(1).locator("td").nth(0)).toHaveText("小区1");
  await expect(rows.nth(1).locator("td").nth(4)).toHaveText(rowTodayText(1000));

  await page.getByRole("button", { name: "查看门店" }).first().click();
  drilled = await waitForSmallOrder(page);
  expect(JSON.stringify(drilled.smallOrderSummary)).toBe(baseSummary);
  expect(await page.locator(".small-order-summary").textContent()).toBe(baseCards);
  expect(await page.locator(".small-order-pace-label").textContent()).toBe(basePace);
  rows = page.locator(".small-order-table tbody tr");
  await expect(rows.first().locator("td").nth(0)).toHaveText("门店2");
  await expect(rows.first().locator("td").nth(4)).toHaveText("+0");
  await expect(rows.first().locator("td").nth(6)).toHaveText("60.0%");

  await page.getByRole("button", { name: "返回上一级" }).click();
  drilled = await waitForSmallOrder(page);
  expect(JSON.stringify(drilled.smallOrderSummary)).toBe(baseSummary);
  expect(await page.locator(".small-order-summary").textContent()).toBe(baseCards);
  expect(await page.locator(".small-order-pace-label").textContent()).toBe(basePace);
  rows = page.locator(".small-order-table tbody tr");
  await expect(rows.first().locator("td").nth(0)).toHaveText("小区2");
});

test("具体非 MG 品牌下小订展示业务空态而非权限错误", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/?brand=%E8%8D%A3%E5%A8%81");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderReportStatus).toBe("empty");
  expect(snapshot.smallOrderSummary.target).toBe(0);
  expect(snapshot.smallOrderText).toContain("MG 07 当前范围暂无数据");
  expect(snapshot.smallOrderText).not.toContain("无权限");
  expect(snapshot.smallOrderText).not.toContain("权限");
});

test("小订底层敏感错误不进入业务 UI", async ({ page }) => {
  const sensitive = "sensitive dsId parentDirId execute-sql secret";
  await page.addInitScript(({ profileValue, fixtureValue, sensitiveValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = {
      ...fixtureValue,
      smallOrderRaw: {
        status: "target_unavailable",
        error: sensitiveValue,
        rawError: sensitiveValue
      },
      smallOrderToday: "2026-07-29"
    };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), sensitiveValue: sensitive });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderReportStatus).toBe("target_unavailable");
  await expect(page.locator("#smallOrderRoot")).toContainText("MG 07 小订数据暂不可用");
  for (const token of ["sensitive", "dsId", "parentDirId", "execute-sql", "secret"]) {
    expect(snapshot.smallOrderText).not.toContain(token);
    await expect(page.locator("#smallOrderRoot")).not.toContainText(token);
  }
});

test("v2.03 View 不展示旧未映射 data_incomplete 文案", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  await waitForSmallOrder(page);
  await page.evaluate(() => {
    const root = document.querySelector("#smallOrderRoot");
    window.SmallOrderView.render(root, {
      status: "data_incomplete",
      error: "当前范围部分目标门店无法匹配",
      period: { status: "小订进行中", progressText: "4.0%" },
      summary: null,
      rows: [],
      warnings: []
    }, { expanded: false });
  });
  await expect(page.locator("#smallOrderRoot")).toContainText("MG 07 小订目标数据暂不可用");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("当前范围部分目标门店无法匹配");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("未归属");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("无法匹配");
});

test("v2.03 未映射目标保留内部审计但最终 DOM 不展示未归属提示", async ({ page }) => {
  const scopedSmallOrder = {
    ...smallOrderRaw,
    enforceTargetContract: true,
    targetRows: [
      ...smallOrderRaw.targetRows,
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S_UNMAPPED", 经销商简称: "未映射门店", MG07小订目标: "7" }
    ],
    organizationRows: smallOrderRaw.organizationRows.filter((row) => row.一级经销商代码 !== "S_UNMAPPED")
  };
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: scopedSmallOrder });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderReportStatus).toBe("ready");
  expect(snapshot.smallOrderSummary.target).toBe(37);
  expect(snapshot.smallOrderAudit).toMatchObject({
    sourceTargetTotal: 37,
    assignedTargetTotal: 30,
    unassignedTargetTotal: 7
  });
  expect(snapshot.smallOrderAudit.unassignedRows).toHaveLength(1);
  expect(snapshot.smallOrderAudit.unassignedRows[0]).toMatchObject({
    originalCode: "S_UNMAPPED",
    canonicalCode: "",
    dealerName: "未映射门店",
    target: 7,
    reason: "目标门店无法匹配权威门店",
    summaryIncluded: true,
    drilldownAttributionStatus: "unassigned",
    handling: "source_in_summary_unassigned_to_drilldown"
  });
  const unmappedAnomaly = await page.evaluate(() => {
    const raw = window.__retailPcFixture.smallOrderRaw;
    const report = window.SmallOrderModel.buildSmallOrderReport({
      ...raw,
      validDealers: window.__retailPcFixture.validDealers,
      period: window.SmallOrderModel.periodInfo(window.__retailPcFixture.smallOrderToday)
    }, { viewLevel: "area" });
    return report.anomalies.find((item) => item.originalCode === "S_UNMAPPED");
  });
  expect(unmappedAnomaly).toMatchObject({
    anomalyType: "organization_unmapped",
    originalCode: "S_UNMAPPED",
    dealerName: "未映射门店",
    target: 7,
    reason: "目标门店无法匹配权威门店",
    handling: "source_in_summary_unassigned_to_drilldown"
  });
  expect(snapshot.smallOrderText).not.toContain("未归属");
  expect(snapshot.smallOrderText).not.toContain("暂未归属");
  expect(snapshot.smallOrderText).not.toContain("部分目标");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("未归属");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("暂未归属");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("部分目标");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("组织");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("source_in_summary_unassigned_to_drilldown");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("drilldownAttributionStatus");
});

test("通用 warning 渲染机制保留给非未映射审计类警告", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  await waitForSmallOrder(page);
  await page.evaluate(() => {
    const root = document.querySelector("#smallOrderRoot");
    window.SmallOrderView.render(root, {
      status: "ready",
      period: { status: "小订进行中", progressText: "4.0%" },
      viewLevel: "area",
      nextLevel: "district",
      warnings: ["测试保留警告机制"],
      summary: {
        target: 10,
        actual: 1,
        retained: 1,
        cancelled: 0,
        achievementRate: 0.1,
        progressText: "4.0%",
        laggingCount: 0,
        objectTotal: 1,
        dataUpdatedAt: "2026-07-29 09:00:00",
        actualStatus: "ready"
      },
      rows: []
    }, { expanded: false });
  });
  await expect(page.locator("#smallOrderRoot")).toContainText("测试保留警告机制");
});

test("userType=4 未识别非空 orgType 兼容态在区域范围下可加载且小订只走顶部 scoped contract", async ({ page }) => {
  const fixture = makeFixture({
    stores: storesFor({ districtCode: "D1" }),
    nationalComplete: false
  });
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = {
      ...fixtureValue,
      smallOrderRaw: { ...smallOrderValue, targetRows: smallOrderValue.targetRows.slice(0, 2), organizationRows: smallOrderValue.organizationRows.slice(0, 2), actualRows: smallOrderValue.actualRows.slice(0, 2), enforceTargetContract: true },
      smallOrderToday: "2026-07-29"
    };
  }, {
    profileValue: { marketing_userType: 4, marketing_orgType: "RSM", marketing_orgName: "兼容组织" },
    fixtureValue: fixture,
    smallOrderValue: smallOrderRaw
  });

  await page.goto("/");
  await expect(page.locator("#funnelGrid")).not.toContainText("角色识别异常");
  await expect(page.locator("#diagnosisTableBody [data-organization-row]")).toHaveCount(1);
  await expect(page.locator("#diagnosisTableBody")).toContainText("大区1");
  await expect(page.locator("#diagnosisTableBody")).not.toContainText("大区2");
  await expect(page.locator("#diagnosisTableBody")).not.toContainText("门店4");
  await expect(page.locator("#diagnosisTableBody .rank-cell").first()).toContainText("--");
  await expect(page.locator("#diagnosisTableBody")).not.toContainText("全国第");

  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.role).toBe("headquarters");
  expect(snapshot.roleCompatibility).toBe(true);
  expect(snapshot.roleInferred).toBe(true);
  expect(snapshot.roleReason).toContain("marketing_userType=4");
  expect(snapshot.nationalComplete).toBe(false);
  expect(snapshot.smallOrderReportStatus).toBe("ready");
  expect(snapshot.smallOrderSummary.target).toBe(20);
  expect(snapshot.smallOrderAudit).toMatchObject({
    contractOk: true,
    scopeSourceRows: 2,
    scopeMappedRows: 2,
    scopeTargetTotal: 20
  });
  expect(snapshot.smallOrderAudit.configuredRows).toBeUndefined();
  expect(snapshot.smallOrderAudit.canonicalUniqueCodes).toBeUndefined();
  expect(snapshot.smallOrderAudit.targetTotal).toBeUndefined();
  await expect(page.locator("#smallOrderRoot")).not.toContainText("小订目标合同不守恒");
  await expect(page.locator("#smallOrderRoot")).not.toContainText("小订目标范围合同不守恒");
});

test("实际源不可用时页面保留目标并将实际相关字段显示为空值语义", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = {
      ...fixtureValue,
      smallOrderRaw: { ...smallOrderValue, actualRows: [], actualStatus: "actual_unavailable", actualError: "execute-sql timeout", todayRows: [{ dealer_code: "S1", actual_small_order: 12 }], todayStatus: "ready" },
      smallOrderToday: "2026-07-29"
    };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderReportStatus).toBe("partial");
  expect(snapshot.smallOrderSummary.target).toBe(30);
  expect(snapshot.smallOrderSummary.actual).toBeNull();
  expect(snapshot.smallOrderSummary.todayActual).toBeNull();
  expect(snapshot.smallOrderSummary.achievementRate).toBeNull();
  expect(snapshot.smallOrderSummary.laggingCount).toBeNull();
  expect(snapshot.smallOrderText).toContain("实际数据暂不可用");
  expect(snapshot.smallOrderText).not.toContain("execute-sql");
  expect(snapshot.smallOrderText).toContain("留存小订--");
  await expect(page.locator(".small-order-metric", { hasText: "今日新增" })).toContainText("--");
  expect(snapshot.smallOrderText).not.toContain("落后大区7个");
  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  const todayValues = await page.locator(".small-order-table tbody tr td:nth-child(5)").allTextContents();
  expect(todayValues.length).toBeGreaterThan(0);
  expect(todayValues.every((value) => value.trim() === "--")).toBe(true);
  await expect(page.locator("#smallOrderRoot")).not.toContainText("+12");
});

test("实际源不可用的表格状态使用中性色而非成功或失败色", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
      sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
      window.__retailPcFixture = {
        ...fixtureValue,
        smallOrderRaw: { ...smallOrderValue, actualRows: [], actualStatus: "actual_unavailable", actualError: "execute-sql timeout" },
        smallOrderToday: "2026-07-29"
      };
    }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });
    await page.goto(`/?theme=${theme}`);
    await waitForSmallOrder(page);
    await page.getByRole("button", { name: /查看小订达成表现/ }).click();
    const color = await page.locator(".small-order-status.unknown").first().evaluate((node) => getComputedStyle(node).color);
    expect(color).not.toBe("rgb(4, 120, 87)");
    expect(color).not.toBe("rgb(180, 83, 9)");
  }
});

test("小区多门店入口展示落后门店，精确单店才展示自身进度状态", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    const scopedFixture = {
      ...fixtureValue,
      validDealers: fixtureValue.validDealers.filter((dealer) => dealer.districtCode === "D1"),
      smallOrderRaw: smallOrderValue,
      smallOrderToday: "2026-07-29"
    };
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = scopedFixture;
  }, { profileValue: profiles.district, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  let snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderViewState.viewLevel).toBe("store");
  expect(snapshot.smallOrderText).toContain("落后门店");
  expect(snapshot.smallOrderText).not.toContain("自身进度状态");

  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    const scopedFixture = {
      ...fixtureValue,
      validDealers: fixtureValue.validDealers.filter((dealer) => dealer.code === "S1"),
      smallOrderRaw: smallOrderValue,
      smallOrderToday: "2026-07-29"
    };
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = scopedFixture;
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/?dealerCode=S1");
  snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderViewState.viewLevel).toBe("store");
  expect(snapshot.smallOrderText).toContain("自身进度状态");
  expect(snapshot.smallOrderText).not.toContain("落后门店");
});

test("MG 07 小订战报 DOM 顺序位于销售总览之后、销售过程指标之前，销售空态不吞掉小订模块", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture({ data: { stores: [], salesCurrent: {}, salesPrevious: {}, salesWeek: {}, monthlyTarget: { status: "no_target" } } }), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  await waitForSmallOrder(page);
  await expect(page.locator("#smallOrderRoot")).toContainText("MG 07小订战报");
  const order = await page.evaluate(() => {
    const root = document.querySelector("#funnelGrid");
    const nodes = [...root.querySelectorAll(".funnel-overview-header, #smallOrderRoot, .empty, .funnel-overview-panels, .panel-head h3")];
    return nodes.map((node) => node.textContent.trim());
  });
  expect(order.findIndex((text) => text.includes("销售总览"))).toBeLessThan(order.findIndex((text) => text.includes("MG 07小订战报")));
  expect(order.findIndex((text) => text.includes("MG 07小订战报"))).toBeLessThan(order.findIndex((text) => text.includes("当前筛选范围暂无销售指标数据")));
});

test("v2.02 未设目标但有实际进入门店清单并显示未设目标和空达成", async ({ page }) => {
  const scopedSmallOrder = {
    ...smallOrderRaw,
    targetRows: [
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "10" }
    ],
    organizationRows: [
      { 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" },
      { 品牌名称: "MG", 一级经销商代码: "S2", 经销商简称: "门店2", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" }
    ],
    actualRows: [
      { dealer_code: "S1", actual_small_order: 1, retained_small_order: 1, cancelled_small_order: 0, data_updated_at: "2026-07-29 09:00:00" },
      { dealer_code: "S2", actual_small_order: 5, retained_small_order: 4, cancelled_small_order: 1, data_updated_at: "2026-07-29 10:00:00" }
    ]
  };
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.district, fixtureValue: makeFixture({ stores: storesFor({ districtCode: "D1" }) }), smallOrderValue: scopedSmallOrder });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderSummary.target).toBe(10);
  expect(snapshot.smallOrderSummary.actual).toBe(6);
  expect(snapshot.smallOrderSummary.achievementRate).toBe(0.5);
  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  const row = page.locator(".small-order-table tbody tr", { hasText: "门店2" });
  await expect(row).toContainText("未设目标");
  await expect(row).toContainText("--");
  await expect(row.locator(".small-order-status")).toContainText("未设目标");
  await expect(row.locator(".small-order-status")).not.toHaveClass(/behind/);
});

test("留存展示使用 retained，累计辅助使用 actual，退订列继续使用 cancelled", async ({ page }) => {
  const divergentSmallOrder = {
    ...smallOrderRaw,
    targetRows: [
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "100" },
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S2", 经销商简称: "门店2", MG07小订目标: "100" }
    ],
    organizationRows: [
      { 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" },
      { 品牌名称: "MG", 一级经销商代码: "S2", 经销商简称: "门店2", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" }
    ],
    actualRows: [
      { dealer_code: "S1", actual_small_order: 30, retained_small_order: 28, cancelled_small_order: 12, data_updated_at: "2026-08-12 09:00:00" },
      { dealer_code: "S2", actual_small_order: 80, retained_small_order: 77, cancelled_small_order: 3, data_updated_at: "2026-08-12 10:00:00" }
    ]
  };
  await bootSmallOrderFixture(page, { smallOrderValue: divergentSmallOrder, today: "2026-08-12" });
  const summaryLabels = page.locator(".small-order-metric > span");
  await expect(summaryLabels).toHaveText(["小订目标", "留存小订", "今日新增", "目标达成", "时间进度", "落后大区"]);
  const retainedCard = page.locator(".small-order-metric").nth(1);
  await expect(retainedCard.locator("strong")).toHaveText("105");
  await expect(retainedCard).toContainText("累计 110");
  await expect(retainedCard).not.toContainText("退订 15");

  await page.getByRole("button", { name: /查看小订达成表现/ }).click();
  await expect(page.locator(".small-order-table thead th")).toHaveText(["对象名称", "对象代码", "小订目标", "留存小订", "今日新增", "目标达成", "时间进度", "应达缺口", "退订小订", "状态", "操作"]);
  const firstRow = page.locator(".small-order-table tbody tr", { hasText: "大区1" });
  await expect(firstRow.locator("td").nth(3)).toHaveText("105");
  await expect(firstRow.locator("td").nth(8)).toHaveText("15");
});

test("v2.02 数据不完整页面不暴露全国或 scoped 技术 key", async ({ page }) => {
  const duplicatedSmallOrder = {
    ...smallOrderRaw,
    enforceTargetContract: true,
    targetRows: [
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "10" },
      { 区域: "大区1", 省份: "江苏", 城市: "南京", MAC: "小区1", 一级经销商: "S1", 经销商简称: "门店1", MG07小订目标: "20" }
    ],
    organizationRows: [
      { 品牌名称: "MG", 一级经销商代码: "S1", 经销商简称: "门店1", 大区代码: "A1", 大区名称: "大区1", 小区代码: "D1", 小区名称: "小区1", MAC: "小区1" }
    ],
    actualRows: []
  };
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, smallOrderRaw: smallOrderValue, smallOrderToday: "2026-07-29" };
  }, { profileValue: profiles.region, fixtureValue: makeFixture({ stores: storesFor({ districtCode: "D1" }) }), smallOrderValue: duplicatedSmallOrder });

  await page.goto("/");
  await waitForSmallOrder(page);
  await expect(page.locator("#smallOrderRoot")).toContainText("当前范围存在重复目标配置");
  for (const key of ["小订目标合同不守恒", "configuredRows", "canonicalUniqueCodes", "targetTotal", "areaCount", "scopeSourceTargetTotal"]) {
    await expect(page.locator("#smallOrderRoot")).not.toContainText(key);
  }
});
