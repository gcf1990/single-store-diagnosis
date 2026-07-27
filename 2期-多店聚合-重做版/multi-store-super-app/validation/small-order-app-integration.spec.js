import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";

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
    { dealer_code: "S1", actual_small_order: 1, data_updated_at: "2026-07-29 09:00:00" },
    { dealer_code: "S2", actual_small_order: 0, data_updated_at: "2026-07-29 09:00:00" },
    { dealer_code: "S4", actual_small_order: 9, data_updated_at: "2026-07-29 09:00:00" }
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
  expect(snapshot.smallOrderText).toContain("累计小订");
  expect(snapshot.smallOrderText).toContain("目标达成");
  expect(snapshot.smallOrderText).toContain("时间进度");
  expect(snapshot.smallOrderText).toContain("落后大区");
  expect(snapshot.smallOrderViewState.expanded).toBe(false);
  expect(snapshot.viewLevel).toBe("area");
  expect(snapshot.drillPath).toEqual([]);

  await page.getByRole("button", { name: "展开小订达成表现" }).click();
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
});

test("实际源不可用时页面保留目标并将实际相关字段显示为空值语义", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue, smallOrderValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = {
      ...fixtureValue,
      smallOrderRaw: { ...smallOrderValue, actualRows: [], actualStatus: "actual_unavailable", actualError: "execute-sql timeout" },
      smallOrderToday: "2026-07-29"
    };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture(), smallOrderValue: smallOrderRaw });

  await page.goto("/");
  const snapshot = await waitForSmallOrder(page);
  expect(snapshot.smallOrderReportStatus).toBe("partial");
  expect(snapshot.smallOrderSummary.target).toBe(30);
  expect(snapshot.smallOrderSummary.actual).toBeNull();
  expect(snapshot.smallOrderSummary.achievementRate).toBeNull();
  expect(snapshot.smallOrderSummary.laggingCount).toBeNull();
  expect(snapshot.smallOrderText).toContain("实际数据暂不可用");
  expect(snapshot.smallOrderText).toContain("累计小订--");
  expect(snapshot.smallOrderText).not.toContain("落后大区7个");
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
    await page.getByRole("button", { name: "展开小订达成表现" }).click();
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
