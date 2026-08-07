import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";
import { ironRaw } from "./iron-metrics-fixtures.js";

const IRON_DASHBOARD_URL = "https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845";
const QUALITY_DRIVE_DASHBOARD_URL = "https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa";

async function openIron(page, query = "") {
  return openIronFixture(page, makeFixture({ ironRaw }), query);
}

async function openIronFixture(page, fixtureValue, query = "") {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profiles.headquarters, fixtureValue });
  await page.goto(`/${query ? `?${query}` : ""}`);
  await page.waitForFunction(() => typeof window.__retailPcApp?.getStateSnapshot === "function");
  await expect(page.locator("#salesTab")).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
}

async function stubDashboardPopup(page, expectedUrl) {
  await page.context().route(expectedUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>dashboard stub</title><main>dashboard stub</main>"
    });
  });
}

test("打铁一级 Tab 顺序、默认销售和 C 方案二级切换", async ({ page }) => {
  await openIron(page);
  await expect(page.locator("[data-store-tab]")).toHaveText(["销售概览", "过程分析", "打铁指标"]);
  await expect(page.locator("#salesTabPanel")).toBeVisible();
  await expect(page.locator("#ironTab")).toHaveAttribute("aria-selected", "false");

  await page.locator("#ironTab").click();
  await expect(page.locator("#ironTabPanel")).toBeVisible();
  await expect(page.locator("[data-iron-group]")).toHaveText(["邀约指标 7", "试驾指标 4"]);
  const dashboardLinks = page.locator(".iron-dashboard-links .iron-dashboard-link");
  const dashboardLink = page.locator("[data-iron-dashboard-link]");
  const qualityDriveLink = page.locator("[data-quality-drive-dashboard-link]");
  await expect(dashboardLinks).toHaveCount(2);
  await expect(dashboardLinks).toHaveText(["打铁运营看板", "优质试驾看板"]);
  await expect(page.locator(".iron-dashboard-link-icon")).toHaveCount(2);
  await expect(dashboardLink.locator(".iron-dashboard-link-icon")).toHaveAttribute("data-material-symbol", "open_in_new");
  await expect(qualityDriveLink.locator(".iron-dashboard-link-icon")).toHaveAttribute("data-material-symbol", "open_in_new");
  await expect(page.locator("#ironDashboardLinks")).toHaveCSS("border-left-style", "solid");
  await expect(page.locator("#ironDashboardLinks")).toHaveCSS("padding-left", "16px");
  await expect(dashboardLink).toHaveCSS("font-size", "12px");
  await expect(dashboardLink).toHaveCSS("border-top-width", "0px");
  await expect(dashboardLink).toHaveAttribute("href", IRON_DASHBOARD_URL);
  await expect(qualityDriveLink).toHaveAttribute("href", QUALITY_DRIVE_DASHBOARD_URL);
  for (const link of [dashboardLink, qualityDriveLink]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
  }
  await expect(page.locator('[data-iron-group="invite"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ironMetricsTable th.metric-head")).toHaveCount(7);
  await expect(page.locator("#ironMetricsTable")).toContainText("邀约进店试驾提及率");
  await expect(page.locator("#ironMetricsTable")).toContainText("目标 53%");
  await expect(page.locator("#ironMetricsTable")).toContainText("首跟通话60s占比");
  await expect(page.locator("#ironMetricsTable")).not.toContainText("无目标");
  await expect(page.locator("#ironMetricsTable")).not.toContainText("识别状态");
  await expect(page.locator("#ironMetricsTable")).not.toContainText("达标");

  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator('[data-iron-group="trial"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-iron-group]")).toHaveText(["邀约指标 7", "试驾指标 4"]);
  await expect(dashboardLinks).toHaveText(["打铁运营看板", "优质试驾看板"]);
  await expect(dashboardLink).toHaveAttribute("href", IRON_DASHBOARD_URL);
  await expect(qualityDriveLink).toHaveAttribute("href", QUALITY_DRIVE_DASHBOARD_URL);
  await expect(dashboardLink).toHaveAttribute("target", "_blank");
  await expect(qualityDriveLink).toHaveAttribute("target", "_blank");
  await expect(page.locator("#ironMetricsTable th.metric-head")).toHaveCount(4);
  await expect(page.locator("#ironMetricsTable")).toContainText("试驾录音回收率");
  await expect(page.locator("#ironMetricsTable")).toContainText("0.0%");
});

test("一级和二级 tab 支持左右方向键并同步 aria-controls", async ({ page }) => {
  await stubDashboardPopup(page, QUALITY_DRIVE_DASHBOARD_URL);
  await openIron(page);
  await page.locator("#salesTab").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#processTab")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#ironTab")).toBeFocused();
  await expect(page.locator("#ironTab")).toHaveAttribute("aria-controls", "ironTabPanel");
  await expect(page.locator("#ironTabPanel")).toBeVisible();

  await page.locator('[data-iron-group="invite"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-iron-group="trial"]')).toBeFocused();
  await expect(page.locator('[data-iron-group="trial"]')).toHaveCSS("outline-style", "solid");
  await expect(page.locator('[data-iron-group="trial"]')).toHaveAttribute("aria-controls", "ironGroupPanel");
  await expect(page.locator("#ironGroupPanel")).toHaveAttribute("aria-labelledby", "ironGroupTab-trial");

  await page.keyboard.press("Tab");
  await expect(page.locator("[data-iron-dashboard-link]")).toBeFocused();
  await expect(page.locator("[data-iron-dashboard-link]")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-quality-drive-dashboard-link]")).toBeFocused();
  await expect(page.locator("[data-quality-drive-dashboard-link]")).toHaveCSS("outline-style", "solid");
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await expect(popup).toHaveURL(QUALITY_DRIVE_DASHBOARD_URL, { timeout: 10_000 });
  await popup.close();
});

async function expectDashboardPopupPreservesState(page, selector, expectedUrl) {
  await openIron(page);
  await page.locator("#ironTab").click();
  await page.locator('[data-iron-group="trial"]').click();
  const before = await page.evaluate(() => ({
    url: window.location.href,
    snapshot: window.__retailPcApp.getStateSnapshot()
  }));
  const popupPromise = page.waitForEvent("popup");
  await page.locator(selector).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(expectedUrl, { timeout: 10_000 });
  await popup.close();
  const after = await page.evaluate(() => ({
    url: window.location.href,
    snapshot: window.__retailPcApp.getStateSnapshot()
  }));
  expect(after.url).toBe(before.url);
  expect(after.snapshot.activeStoreTab).toBe("iron");
  expect(after.snapshot.activeMetricGroup).toBe("trial");
  expect(after.snapshot.viewLevel).toBe(before.snapshot.viewLevel);
  expect(after.snapshot.drillPath).toEqual(before.snapshot.drillPath);
  expect(after.snapshot.allDealerMode).toBe(before.snapshot.allDealerMode);
  expect(after.snapshot.tablePages).toEqual(before.snapshot.tablePages);
  expect(after.snapshot.vehicleSeries).toEqual(before.snapshot.vehicleSeries);
}

test("打铁运营看板外链新窗口打开且不改写当前页面状态", async ({ page }) => {
  await stubDashboardPopup(page, IRON_DASHBOARD_URL);
  await expectDashboardPopupPreservesState(page, "[data-iron-dashboard-link]", IRON_DASHBOARD_URL);
});

test("优质试驾看板外链新窗口打开且不改写当前页面状态", async ({ page }) => {
  await stubDashboardPopup(page, QUALITY_DRIVE_DASHBOARD_URL);
  await openIron(page, "vehicleSeries=%E5%85%A8%E6%96%B0MG4");
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全新MG4");
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await page.locator("#toggleAllDealersSales").click();
  await page.locator("#ironTab").click();
  await page.locator('[data-iron-group="trial"]').click();
  const before = await page.evaluate(() => ({
    url: window.location.href,
    snapshot: window.__retailPcApp.getStateSnapshot()
  }));
  expect(before.snapshot.vehicleSeries).toEqual(["全新MG4"]);
  expect(before.snapshot.allDealerMode).toBe(true);
  expect(before.snapshot.activeStoreTab).toBe("iron");
  expect(before.snapshot.activeMetricGroup).toBe("trial");
  await expect(page.locator("[data-quality-drive-dashboard-link]")).toHaveAttribute("href", QUALITY_DRIVE_DASHBOARD_URL);
  const popupPromise = page.waitForEvent("popup");
  await page.locator("[data-quality-drive-dashboard-link]").click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(QUALITY_DRIVE_DASHBOARD_URL, { timeout: 10_000 });
  await popup.close();
  const after = await page.evaluate(() => ({
    url: window.location.href,
    snapshot: window.__retailPcApp.getStateSnapshot()
  }));
  expect(after).toEqual(before);
});

test("点击打铁 Tab 时展示真实加载骨架而不是空表或数据不完整", async ({ page }) => {
  await openIronFixture(page, makeFixture({
    asyncIronMetrics: true,
    ironRaw: null,
    ironSourceStates: Object.fromEntries(["inviteMention", "intentLevel", "dcc", "qualityTrial", "trialRecord", "trialTalk"].map((key) => [key, { status: "loading", complete: false }]))
  }));
  await page.locator("#ironTab").click();
  await expect(page.locator("#ironTabPanel")).toBeVisible();
  await expect(page.locator("#ironMetricsTable .iron-loading")).toHaveCount(14);
  await expect(page.locator("#ironMetricsTable")).not.toContainText("数据不完整");
});

test("试驾来源完成时不被邀约和DCC加载态阻塞", async ({ page }) => {
  await openIronFixture(page, makeFixture({
    ironRaw: {
      ...ironRaw,
      inviteMentionRows: [],
      intentLevelRows: [],
      dccRows: [],
      dccThreeCallRows: [],
      sourceStates: {
        inviteMention: { status: "loading", complete: false },
        intentLevel: { status: "loading", complete: false },
        dcc: { status: "loading", complete: false },
        qualityTrial: { status: "success", complete: true },
        trialRecord: { status: "success", complete: true },
        trialTalk: { status: "success", complete: true }
      }
    }
  }));
  await page.locator("#ironTab").click();
  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator("#ironMetricsTable .iron-loading")).toHaveCount(0);
  await expect(page.locator("#ironMetricsTable")).toContainText("试驾录音回收率");
  await expect(page.locator("#ironMetricsTable")).toContainText("50.0%");
});

test("单一来源超时降级后页面退出全骨架", async ({ page }) => {
  await openIronFixture(page, makeFixture({
    ironRaw: {
      ...ironRaw,
      dccRows: [],
      dccThreeCallRows: [],
      sourceStates: {
        ...ironRaw.sourceStates,
        dcc: { status: "incomplete", complete: false, error: "打铁来源 dcc 查询超过 45000ms，已降级为数据不完整" }
      }
    }
  }));
  await page.locator("#ironTab").click();
  await expect(page.locator("#ironMetricsTable .iron-loading")).toHaveCount(0);
  await expect(page.locator("#ironMetricsTable")).toContainText("邀约进店试驾提及率");
  await expect(page.locator("#ironMetricsTable")).toContainText("33.3%");
  await expect(page.locator("#ironMetricsTable")).toContainText("数据不完整");
});

test("process baseline 组织范围为空时打铁 Tab 展示空态且不误挂全国数据", async ({ page }) => {
  await openIronFixture(page, makeFixture({
    stores: [],
    validDealers: [],
    data: { stores: [], salesCurrent: {}, salesPrevious: {}, salesWeek: {}, ip: {}, ipPrev: {}, ipWeek: {}, driveTags: {}, driveTagsPrev: {}, driveTagsWeek: {} },
    ironRaw
  }));
  await page.locator("#ironTab").click();
  await expect(page.locator("#ironMetricsTable")).toContainText("当前有效范围暂无大区打铁指标");
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.visibleIronCodes).toEqual([]);
});

test("生产包不暴露 loading 测试钩子标识", async ({ page }) => {
  await openIron(page);
  expect(await page.evaluate(() => "setIronLoadingForTest" in window.__retailPcApp)).toBe(false);
  expect(await page.evaluate(() => ({
    dataApi: Object.hasOwn(window.RegionDataApi, "__test"),
    ironApi: Object.hasOwn(window.IronMetricsApi, "__test"),
    ironModel: Object.hasOwn(window.IronMetricsModel, "__test"),
    ironView: Object.hasOwn(window.IronMetricsView, "__test")
  }))).toEqual({ dataApi: false, ironApi: false, ironModel: false, ironView: false });
});

test("dist 产物不包含 loading 测试钩子标识", async () => {
  const appDist = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
  expect(appDist).not.toContain("setIronLoadingForTest");
});
