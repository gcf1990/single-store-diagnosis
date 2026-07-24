import { expect, test } from "@playwright/test";
import { makeFixture, profiles, storesFor } from "./pc-role-drilldown-fixtures.js";

async function openFixture(page, profile, query = "", fixture = makeFixture()) {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profile, fixtureValue: fixture });
  await page.goto(`/${query ? `?${query}` : ""}`);
  await expect(page.locator("#funnelGrid")).not.toContainText("--", { timeout: 10_000 });
}

async function mockRuntimeDate(page, isoDate) {
  await page.addInitScript((value) => {
    const fixed = new Date(value);
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixed.getTime());
        } else {
          super(...args);
        }
      }
      static now() {
        return fixed.getTime();
      }
    }
    FixedDate.UTC = NativeDate.UTC;
    FixedDate.parse = NativeDate.parse;
    window.Date = FixedDate;
  }, isoDate);
}

function contrastRatio(foreground, background) {
  const parseRgb = (value) => {
    const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(`Unsupported color: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fg = luminance(parseRgb(foreground));
  const bg = luminance(parseRgb(background));
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

test("本地显式 Demo URL 自动注入总部画像并支持销售和过程全部经销商", async ({ page }) => {
  await page.goto("/?demo=all-dealers");
  await expect(page.locator("#funnelGrid")).not.toContainText("--", { timeout: 10_000 });
  await expect(page.locator("#funnelGrid")).not.toContainText("角色识别异常");
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("查看所有经销商");
  await page.locator("#toggleAllDealersSales").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商销售表现");
  await expect(page.locator("#salesPagination [data-pagination-info]")).toContainText("共 26 条");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toHaveLength(26);

  await page.locator("#processTab").click();
  await expect(page.locator("#toggleAllDealersProcess")).toBeVisible();
  await expect(page.locator("#toggleAllDealersProcess")).toHaveText("返回分层查看");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商过程表现");
  await expect(page.locator("#processPagination [data-pagination-info]")).toContainText("共 26 条");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleProcessStoreCodes).toHaveLength(26);

  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("返回分层查看");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  await expect(page.locator("#ironPagination [data-pagination-info]")).toContainText("共 26 条");
  await expect(page.locator("#ironMetricsRoot")).toContainText("目标 53%");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleIronCodes).toHaveLength(26);
});

test("裸地址缺人员画像时保持真实安全降级", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#funnelGrid")).toContainText("角色识别异常：未获取到人员画像", { timeout: 10_000 });
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
});

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;
  const source = String(text || "").replace(/^\ufeff/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && quoted && source[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

function normalizeExcelTextRank(value) {
  return String(value || "").replace(/^\t(?=\d+\/\d+$)/, "");
}

function deneutralizeCsvPlaceholder(value) {
  return String(value || "").replace(/^'(?=--$)/, "");
}

async function captureSalesCsv(page) {
  return page.evaluate(async () => {
    window.__salesCsvText = "";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      blob.text().then((text) => { window.__salesCsvText = text; });
      return "blob:monthly-target-test";
    };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    document.getElementById("exportSales").click();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    for (let index = 0; index < 20 && !window.__salesCsvText; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return window.__salesCsvText || "";
  });
}

async function captureProcessCsv(page) {
  return page.evaluate(async () => {
    window.__processCsvText = "";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      blob.text().then((text) => { window.__processCsvText = text; });
      return "blob:process-test";
    };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    document.getElementById("exportProcess").click();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    for (let index = 0; index < 20 && !window.__processCsvText; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return window.__processCsvText || "";
  });
}

async function captureIronCsv(page) {
  return page.evaluate(async () => {
    window.__ironCsvText = "";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      blob.text().then((text) => { window.__ironCsvText = text; });
      return "blob:iron-flat-test";
    };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    document.getElementById("exportSales").click();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    for (let index = 0; index < 20 && !window.__ironCsvText; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return window.__ironCsvText || "";
  });
}

async function gridSlots(locator) {
  return locator.evaluate((grid) => Array.from(grid.children).map((child, index) => ({
    index,
    text: child.textContent.trim(),
    ariaHidden: child.getAttribute("aria-hidden"),
    className: child.className
  })));
}

function flatDealerStore(index, overrides = {}) {
  const areaIndex = Math.floor(index / 17) + 1;
  const districtIndex = Math.floor(index / 8) + 1;
  const code = `F${String(index + 1).padStart(2, "0")}`;
  const orders = overrides.orders ?? Math.max(1, 50 - index);
  const retail = overrides.retail ?? Math.max(1, 30 - Math.floor(index / 2));
  const aggregate = (total, negative, name, count) => ({
    total,
    negative,
    rate: total ? negative / total * 100 : null,
    problems: [{ name, count, denominator: total, rate: total ? count / total * 100 : null, children: [] }]
  });
  const current = { leads: 100 + index, arrivals: 40 + index, drives: 20 + index, orders, retail };
  const previous = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Math.max(0, value - 2)]));
  const week = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Math.max(0, value - 3)]));
  return {
    code,
    name: overrides.name || `扁平经销商${String(index + 1).padStart(2, "0")}`,
    areaCode: overrides.areaCode || `A${areaIndex}`,
    area: overrides.area || `大区${areaIndex}`,
    districtCode: overrides.districtCode || `D${districtIndex}`,
    district: overrides.district || `小区${districtIndex}`,
    current,
    previous,
    week,
    ip: aggregate(20 + index, 2, "零钩子", 1),
    ipPrev: aggregate(18 + index, 1, "零钩子", 1),
    ipWeek: aggregate(16 + index, 1, "零钩子", 1),
    driveTag: aggregate(12 + index, 1, "版本未推荐", 1),
    drivePrev: aggregate(10 + index, 1, "版本未推荐", 1),
    driveWeek: aggregate(9 + index, 1, "版本未推荐", 1),
    monthlyTarget: { order: { status: "no_target", target: 0, actual: 0, achievement: null, hasTarget: false }, retail: { status: "no_target", target: 0, actual: 0, achievement: null, hasTarget: false }, status: "no_target", validDealerMissingRows: 0 }
  };
}

function makeFlatDealerFixture(count = 34, overrides = {}) {
  const stores = Array.from({ length: count }, (_, index) => flatDealerStore(index, overrides.storeOverrides?.[index] || {}));
  const currentRange = { startDate: "2026-07-01", endDate: "2026-07-14" };
  return makeFixture({
    stores,
    nationalComplete: true,
    ironRaw: createTestIronRaw(stores, currentRange, 1),
    ironMonthRaw: createTestIronRaw(stores, { startDate: "2026-06-01", endDate: "2026-06-14" }, 0.9),
    ironWeekRaw: createTestIronRaw(stores, { startDate: "2026-06-17", endDate: "2026-06-30" }, 0.95),
    ...overrides
  });
}

function createTestIronRaw(stores, range, scale = 1) {
  const n = (value) => Math.max(0, Math.round(value * scale));
  return {
    range,
    sourceStates: {
      inviteMention: { status: "success", complete: true },
      intentLevel: { status: "success", complete: true },
      dcc: { status: "success", complete: true },
      qualityTrial: { status: "success", complete: true },
      trialRecord: { status: "success", complete: true },
      trialTalk: { status: "success", complete: true }
    },
    inviteMentionRows: stores.map((store, index) => ({
      dealer_code: store.code,
      invite_trial_mention_numerator: n(28 + (index % 9)),
      invite_trial_mention_denominator: n(50 + (index % 13)),
      wechat_apply_mention_numerator: n(30 + (index % 8)),
      wechat_apply_mention_denominator: n(54 + (index % 11))
    })),
    intentLevelRows: stores.map((store, index) => ({
      dealer_code: store.code,
      high_intent_low_level_numerator: n(1 + (index % 3)),
      high_intent_low_level_denominator: n(42 + (index % 10))
    })),
    dccRows: stores.map((store, index) => ({
      dealer_code: store.code,
      first_follow_call_60s_numerator: n(31 + (index % 10)),
      first_follow_call_60s_denominator: n(56 + (index % 15)),
      follow_30min_numerator: n(45 + (index % 12)),
      follow_30min_denominator: n(54 + (index % 15)),
      follow_24h_numerator: n(48 + (index % 10)),
      follow_24h_denominator: n(55 + (index % 13)),
      two_day_three_call_numerator: n(42 + (index % 11)),
      two_day_three_call_denominator: n(53 + (index % 14))
    })),
    qualityTrialRows: stores.map((store, index) => ({
      "经销商代码": store.code,
      "优质试驾数": n(9 + (index % 7)),
      "常规试驾数": n(24 + (index % 8))
    })),
    trialRecordRows: stores.map((store, index) => ({
      dealer_code: store.code,
      trial_record_numerator: n(13 + (index % 8)),
      trial_record_denominator: n(24 + (index % 10))
    })),
    trialTalkRows: stores.flatMap((store, index) => [
      {
        dealer_code: store.code,
        point: "手机互联",
        trial_talk_numerator: n(10 + (index % 6)),
        trial_talk_denominator: n(24 + (index % 8))
      },
      {
        dealer_code: store.code,
        point: "全场景自动泊车-离车泊入",
        trial_talk_numerator: n(8 + (index % 6)),
        trial_talk_denominator: n(24 + (index % 8))
      }
    ])
  };
}

async function openProcessKindScenario(page, { failIp = false, failDrive = false, failIpStages = [], failDriveStages = [] } = {}) {
  const dealerRows = [{ code: "S1", name: "测试门店", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }];
  const salesRow = (leads, arrivals, drives, orders, retail) => ({
    "经销商代码": "S1",
    "经销商简称": "测试门店",
    "大区简称": "大区1",
    "小区简称": "小区1",
    "当日下发线索数": leads,
    "当日首触客流数": arrivals,
    "当日首触试驾数": drives,
    "当日订单数（首触）": orders,
    "当日零售数": retail
  });
  const salesRaw = {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
    weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
    sales: [salesRow(100, 20, 10, 5, 2)],
    salesPrev: [salesRow(80, 8, 4, 2, 1)],
    salesWeek: [salesRow(50, 5, 2, 1, 1)],
    scopeEvidence: { source: "test-sales", complete: true, hitLimit: false }
  };
  const processAgg = (total, negative, problems) => ({ total, negative, rate: total ? negative / total * 100 : null, problems });
  const withStore = (agg) => ({ code: "S1", name: "测试门店", ...agg });
  const ipAgg = processAgg(12, 3, [
    { name: "零钩子", count: 0, denominator: 5, rate: 0, children: [] },
    { name: "未锁定时间", count: 1, denominator: 5, rate: 20, children: [] },
    { name: "报价承接不足", count: 2, denominator: 10, rate: 20, children: [] },
    { name: "竞品比较转化不足", count: 0, denominator: 0, rate: null, children: [] }
  ]);
  const driveAgg = processAgg(29, 3, [
    { name: "版本推荐", count: 1, denominator: 6, rate: 16.6667, children: [] },
    { name: "顾虑承接", count: 1, denominator: 13, rate: 7.6923, children: [] },
    { name: "竞品攻防", count: 1, denominator: 10, rate: 10, children: [] }
  ]);
  await page.addInitScript(({ dealerRowsValue, rawValue, ipAggValue, driveAggValue, failIpValue, failDriveValue, failIpStagesValue, failDriveStagesValue }) => {
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4"],
          loadSalesRaw: async () => rawValue,
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            window.__processKindCalls = [...(window.__processKindCalls || []), `${kind}:${stage}`];
            if (kind === "ip" && (failIpValue || failIpStagesValue.includes(stage))) throw new Error(`${stage} IP 模拟失败`);
            if (kind === "drive" && (failDriveValue || failDriveStagesValue.includes(stage))) throw new Error(`${stage} drive 模拟失败`);
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            if (kind === "ip") return { [`ipAgg${suffix}`]: ipAggValue, [`ipAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...ipAggValue }] };
            return { [`driveTagAgg${suffix}`]: driveAggValue, [`driveTagAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...driveAggValue }] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRowsValue, evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRowsValue
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" }));
  }, { dealerRowsValue: dealerRows, rawValue: salesRaw, ipAggValue: ipAgg, driveAggValue: driveAgg, failIpValue: failIp, failDriveValue: failDrive, failIpStagesValue: failIpStages, failDriveStagesValue: failDriveStages });
  await page.goto("/");
  await expect(page.locator(".process-panel .funnel-kpi-card").nth(0)).toContainText("20.0%", { timeout: 10_000 });
  await page.locator("#processTab").click();
}

test("PC 门店表现 Tab 使用新展示名并保持语义和切换契约", async ({ page }) => {
  await openFixture(page, profiles.headquarters);

  const salesTab = page.locator("#salesTab");
  const processTab = page.locator("#processTab");
  await expect(salesTab).toHaveText("销售概览");
  await expect(salesTab).toHaveAttribute("role", "tab");
  await expect(salesTab).toHaveAttribute("aria-controls", "salesTabPanel");
  await expect(salesTab).toHaveAttribute("data-store-tab", "sales");
  await expect(salesTab).toHaveAttribute("aria-selected", "true");
  await expect(processTab).toHaveText("过程分析");
  await expect(processTab).toHaveAttribute("role", "tab");
  await expect(processTab).toHaveAttribute("aria-controls", "processTabPanel");
  await expect(processTab).toHaveAttribute("data-store-tab", "process");
  await expect(processTab).toHaveAttribute("aria-selected", "false");

  await processTab.click();
  await expect(salesTab).toHaveAttribute("aria-selected", "false");
  await expect(processTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#salesTabPanel")).toBeHidden();
  await expect(page.locator("#processTabPanel")).toBeVisible();
});

test("PC 车系筛选严格复用单店菜单交互、URL 和过程口径边界", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, profiles.headquarters);
  const trigger = page.locator("#vehicleSeriesTrigger");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAttribute("aria-label", "按车系筛选整个应用数据");
  await expect(trigger).toContainText("车系");
  await expect(trigger).toContainText("全部车系");
  const overviewHeader = page.locator("#funnelGrid .funnel-overview-header");
  const overviewPanels = page.locator("#funnelGrid .funnel-overview-panels");
  await expect(overviewHeader).toContainText("销售总览");
  await expect(overviewHeader.locator("#vehicleSeriesFilter")).toHaveCount(1);
  await expect(page.locator(".metric-panel #vehicleSeriesFilter")).toHaveCount(0);
  expect(await page.locator("#vehicleSeriesFilter").evaluate((element) => {
    const header = element.closest(".funnel-overview-header");
    const metricPanel = element.closest(".metric-panel");
    const filterBox = element.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const panelsBox = document.querySelector("#funnelGrid .funnel-overview-panels")?.getBoundingClientRect();
    return {
      isOverviewChild: element.parentElement === header,
      isOutsideMetricPanel: metricPanel === null,
      headerAlignedRight: Math.abs((headerBox?.right || 0) - filterBox.right) < 1,
      panelsBelowHeader: (panelsBox?.top || 0) >= (headerBox?.bottom || 0)
    };
  })).toEqual({
    isOverviewChild: true,
    isOutsideMetricPanel: true,
    headerAlignedRight: true,
    panelsBelowHeader: true
  });
  await expect(overviewPanels.locator(".metric-panel")).toHaveCount(2);
  expect(await trigger.evaluate((element) => {
    const style = getComputedStyle(element.closest(".vehicle-series-filter"));
    return { minWidth: style.minWidth, height: style.height, borderRadius: style.borderRadius };
  })).toEqual({ minWidth: "176px", height: "36px", borderRadius: "8px" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#vehicleSeriesFilter")).toHaveClass(/is-open/);
  await expect(trigger.locator(".vehicle-series-icon")).toHaveText("⌃");
  expect(await trigger.locator(".vehicle-series-icon").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return matrix.a > 0 && matrix.d > 0;
  })).toBe(true);
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  expect(await page.locator(".vehicle-series-option span:last-child").allTextContents()).toEqual(["全部车系", "全新MG4", "MG 4X", "MG 07", "Cyberster", "MG ES5", "MG5", "其他车系", "未知车系", "位置车系"]);
  await expect(page.locator("#vehicleSeriesMenu")).toHaveAttribute("aria-multiselectable", "true");
  await expect(page.locator('[data-vehicle-series="全部车系"]')).toHaveAttribute("aria-selected", "true");
  expect(await page.locator("#vehicleSeriesMenu").evaluate((element) => {
    const style = getComputedStyle(element);
    const triggerBox = document.getElementById("vehicleSeriesTrigger")?.getBoundingClientRect();
    const menuBox = element.getBoundingClientRect();
    return { maxHeight: style.maxHeight, borderRadius: style.borderRadius, padding: style.padding, sameWidth: Math.abs(menuBox.width - (triggerBox?.width || 0)) < 1, scrolls: element.scrollHeight > element.clientHeight };
  })).toEqual({ maxHeight: "260px", borderRadius: "8px", padding: "6px", sameWidth: true, scrolls: true });
  await page.locator(".vehicle-series-option").nth(1).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#vehicleSeriesMenu")).toBeHidden();
  await expect(page.locator("#vehicleSeriesFilter")).not.toHaveClass(/is-open/);
  await expect(trigger.locator(".vehicle-series-icon")).toHaveText("⌄");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await expect(trigger).toContainText("全新MG4");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4/);
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("22");
  expect(await page.locator('#diagnosisTableBody [data-row-level="area"] .dealer strong').allTextContents()).toEqual(["大区1", "大区2"]);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual(["全新MG4"]);
  await expect(page.locator('[data-vehicle-series="全新MG4"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-vehicle-series="全新MG4"] .vehicle-series-check')).toHaveText("✓");
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await expect(trigger).toContainText("已选 2 个车系");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG(?:\+|%20)4X/);
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("29");
  await expect(page.locator('[data-vehicle-series="MG 4X"]')).toHaveAttribute("aria-selected", "true");
  await page.locator('[data-vehicle-series="MG 07"]').click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await expect(trigger).toContainText("已选 3 个车系");
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await expect(trigger).toContainText("已选 2 个车系");
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await page.screenshot({ path: "validation/pc-vehicle-series-multiselect-expanded-1440x900.png", fullPage: true });
  await page.locator('[data-vehicle-series="MG 07"]').click();
  await expect(trigger).toContainText("已选 2 个车系");
  await page.locator("#processTab").click();
  await expect(page.locator("#vehicleSeriesProcessNotice")).toBeVisible();
  await expect(page.locator("#vehicleSeriesProcessNotice")).toContainText("车系筛选仅覆盖销售漏斗及销售表现");
  await page.reload();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("已选 2 个车系");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual(["全新MG4", "MG 4X"]);
  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("MG 4X");
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await expect(page).not.toHaveURL(/vehicleSeries=/);
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await page.locator('[data-vehicle-series="全部车系"]').click();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator("#storeTableTitle").click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeHidden();
  await openFixture(page, profiles.headquarters, "brand=%E8%8D%A3%E5%A8%81&vehicleSeries=%E5%85%A8%E6%96%B0MG4", makeFixture({
    vehicleSeriesOptionsByBrand: { "荣威": ["MG7"] }
  }));
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await expect(page).not.toHaveURL(/vehicleSeries=/);
  await openFixture(page, profiles.headquarters, "vehicleSeries=MG%204X&vehicleSeries=%E5%85%A8%E6%96%B0MG4&carSeries=Cyberster");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG(?:\+|%20)4X/);
  await expect(page).not.toHaveURL(/Cyberster/);
  await openFixture(page, profiles.headquarters, "carSeries=%E5%85%A8%E6%96%B0MG4");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4/);
  await expect(page).not.toHaveURL(/carSeries=/);
  await openFixture(page, profiles.headquarters, "series=%E5%85%A8%E6%96%B0MG4");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4/);
  await expect(page).not.toHaveURL(/series=/);
});

test("正式异步加载期间车系多选菜单保留枚举并支持连续复选", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dealers = [
    { code: "S1", name: "门店1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
    { code: "S2", name: "门店2", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
  ];
  await page.addInitScript(({ dealerRows }) => {
    const makeRaw = (selected) => {
      const key = (selected || []).join("|");
      const sales = key === "全新MG4|MG 4X"
        ? [
            { code: "S1", name: "门店1", orders: 14 },
            { code: "S2", name: "门店2", orders: 15 }
          ]
        : key === "全新MG4"
          ? [{ code: "S1", name: "门店1", orders: 22 }]
          : [
              { code: "S1", name: "门店1", orders: 5 },
              { code: "S2", name: "门店2", orders: 7 }
            ];
      const row = (item) => ({
        "经销商代码": item.code,
        "经销商名称": item.name,
        "大区名称": "大区1",
        "小区名称": "小区1",
        "当日下发线索数": item.orders * 10,
        "当日首触客流数": item.orders * 4,
        "当日首触试驾数": item.orders * 2,
        "当日订单数（首触）": item.orders,
        "当日零售数": Math.max(0, item.orders - 2)
      });
      return {
        range: { startDate: "2026-07-01", endDate: "2026-07-20" },
        previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
        weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
        sales: sales.map(row),
        salesPrev: sales.map((item) => row({ ...item, orders: Math.max(0, item.orders - 1) })),
        salesWeek: sales.map((item) => row({ ...item, orders: Math.max(0, item.orders - 2) })),
        monthlyTarget: { status: "ready", targets: [], targetActuals: [], audit: {}, months: [] },
        scopeEvidence: { source: "async-test", complete: true, hitLimit: false }
      };
    };
    let salesCall = 0;
    window.__salesSelections = [];
    window.__pendingSales = [];
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4", "MG 4X", "MG 07"],
          loadSalesRaw: (params) => {
            const selected = [...(params.vehicleSeries || [])];
            window.__salesSelections.push(selected);
            salesCall += 1;
            if (salesCall === 1) return Promise.resolve(makeRaw(selected));
            return new Promise((resolve) => {
              window.__pendingSales.push({ selected, resolve });
            });
          },
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            const empty = { total: 0, negative: 0, rate: null, problems: [] };
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: empty, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: empty, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    window.__resolveAllPendingSales = () => {
      window.__pendingSales.splice(0).forEach((item) => item.resolve(makeRaw(item.selected)));
    };
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" }));
  }, { dealerRows: dealers });

  await page.goto("/");
  const trigger = page.locator("#vehicleSeriesTrigger");
  await expect(trigger).toContainText("全部车系");
  await trigger.click();
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await expect(page.locator('[data-vehicle-series="MG 4X"]')).toBeVisible();
  await expect(page.locator(".vehicle-series-option span:last-child")).toHaveText(["全部车系", "全新MG4", "MG 4X", "MG 07"]);
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await expect(trigger).toContainText("已选 2 个车系");
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG(?:\+|%20)4X/);
  await page.evaluate(() => window.__resolveAllPendingSales());
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("29");
  const salesSelections = await page.evaluate(() => window.__salesSelections);
  expect(salesSelections.filter((selection) => selection.length)).toEqual([["全新MG4"], ["全新MG4", "MG 4X"]]);
  expect(salesSelections.filter((selection) => selection.length === 0).length).toBeGreaterThanOrEqual(3);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual(["全新MG4", "MG 4X"]);
});

test("浏览器前进后退会恢复车系筛选、查询缓存上下文和埋点截图上下文", async ({ page }) => {
  const dealers = [
    { code: "S1", name: "门店1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
    { code: "S2", name: "门店2", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
  ];
  await page.addInitScript(({ dealerRows }) => {
    const row = (dealer, orders) => ({
      "经销商代码": dealer.code,
      "经销商名称": dealer.name,
      "大区名称": dealer.area,
      "小区名称": dealer.district,
      "当日下发线索数": orders * 10,
      "当日首触客流数": orders * 4,
      "当日首触试驾数": orders * 2,
      "当日订单数（首触）": orders,
      "当日零售数": Math.max(0, orders - 2)
    });
    const makeRaw = (selected) => {
      const key = [...selected].join("\u0001");
      const sales = key === "全新MG4"
        ? [{ dealer: dealerRows[0], orders: 22 }]
        : key === "全新MG4\u0001MG 4X"
          ? [
              { dealer: dealerRows[0], orders: 22 },
              { dealer: dealerRows[1], orders: 7 }
            ]
          : dealerRows.map((dealer, index) => ({ dealer, orders: index === 0 ? 22 : 13 }));
      return {
        range: { startDate: "2026-07-01", endDate: "2026-07-20" },
        previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
        weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
        sales: sales.map((item) => row(item.dealer, item.orders)),
        salesPrev: sales.map((item) => row(item.dealer, Math.max(0, item.orders - 1))),
        salesWeek: sales.map((item) => row(item.dealer, Math.max(0, item.orders - 2))),
        monthlyTarget: { status: "ready", targets: [], targetActuals: [], audit: {}, months: [] },
        scopeEvidence: { source: "aggregate-sql", complete: true, hitLimit: false, scenario: `sales-${key || "all"}` }
      };
    };
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4", "MG 4X"],
          loadSalesRaw: async (params) => {
            const selected = [...(params.vehicleSeries || [])];
            window.__salesKeys = [...(window.__salesKeys || []), selected.join("\u0001") || "ALL"];
            return makeRaw(selected);
          },
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            const empty = { total: 0, negative: 0, rate: null, problems: [] };
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: empty, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: empty, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部" }));
  }, { dealerRows: dealers });

  const waitForSelection = async (expected, trackingText, triggerText, orderText) => {
    await expect(page.locator("#vehicleSeriesTrigger")).toContainText(triggerText);
    await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText(orderText);
    await page.waitForFunction(({ key, tracking }) => {
      return window.__salesKeys?.includes(key) && window.__retailGioEvent?.vehicleSeries === tracking;
    }, { key: expected.join("\u0001") || "ALL", tracking: trackingText });
    expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual(expected);
    expect(await page.locator("#vehicleSeriesTrigger").textContent()).toContain(triggerText);
  };

  await page.goto("/");
  await waitForSelection([], "全部车系", "全部车系", "35");
  await page.evaluate(() => {
    history.pushState({}, "", "?carSeries=%E5%85%A8%E6%96%B0MG4");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/vehicleSeries=%E5%85%A8%E6%96%B0MG4/);
  await expect(page).not.toHaveURL(/carSeries=/);
  await waitForSelection(["全新MG4"], "全新MG4", "全新MG4", "22");

  await page.evaluate(() => {
    history.pushState({}, "", "?vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG%204X");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitForSelection(["全新MG4", "MG 4X"], "全新MG4、MG 4X", "已选 2 个车系", "29");

  await page.goBack();
  await waitForSelection(["全新MG4"], "全新MG4", "全新MG4", "22");
  expect(await page.evaluate(() => window.__salesKeys.slice(-2))).toContain("全新MG4");

  await page.goForward();
  await waitForSelection(["全新MG4", "MG 4X"], "全新MG4、MG 4X", "已选 2 个车系", "29");
  expect(await page.locator("#vehicleSeriesTrigger").textContent()).toContain("已选 2 个车系");
});

test("浏览器历史品牌切换会强制清空同名车系并重建新品牌上下文", async ({ page }) => {
  const dealers = [
    { code: "M1", name: "MG门店", areaCode: "A1", area: "MG大区", districtCode: "D1", district: "MG小区" },
    { code: "R1", name: "荣威门店", areaCode: "R1", area: "荣威大区", districtCode: "RD1", district: "荣威小区" }
  ];
  await page.addInitScript(({ dealerRows }) => {
    const makeRow = (dealer, orders) => ({
      "经销商代码": dealer.code,
      "经销商名称": dealer.name,
      "大区名称": dealer.area,
      "小区名称": dealer.district,
      "当日下发线索数": orders * 10,
      "当日首触客流数": orders * 4,
      "当日首触试驾数": orders * 2,
      "当日订单数（首触）": orders,
      "当日零售数": Math.max(0, orders - 2)
    });
    const rawFor = (brand, selected) => {
      const isRoewe = brand === "荣威";
      const dealer = isRoewe ? dealerRows[1] : dealerRows[0];
      const orders = isRoewe ? 31 : 22;
      return {
        range: { startDate: "2026-07-01", endDate: "2026-07-20" },
        previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
        weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
        sales: [makeRow(dealer, orders)],
        salesPrev: [makeRow(dealer, orders - 1)],
        salesWeek: [makeRow(dealer, orders - 2)],
        monthlyTarget: isRoewe ? { status: "non_mg", targets: [], targetActuals: [], audit: {}, months: [] } : { status: "ready", targets: [], targetActuals: [], audit: {}, months: [] },
        scopeEvidence: { source: "aggregate-sql", complete: true, hitLimit: false, brand, selectedKey: selected.join("\u0001") || "ALL" }
      };
    };
    const emptyAgg = { total: 0, negative: 0, rate: null, problems: [] };
    window.__pendingBrandSales = [];
    window.__brandSalesCalls = [];
    window.__resolveBrandSales = (brand) => {
      const ready = window.__pendingBrandSales.filter((item) => item.brand === brand);
      window.__pendingBrandSales = window.__pendingBrandSales.filter((item) => item.brand !== brand);
      ready.forEach((item) => item.resolve(rawFor(item.brand, item.selected)));
    };
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async (params) => {
            window.__brandOptionCalls = [...(window.__brandOptionCalls || []), params.brand];
            return params.brand === "荣威" ? ["全新MG4", "荣威D7"] : ["全新MG4", "MG 4X"];
          },
          loadSalesRaw: (params) => {
            const selected = [...(params.vehicleSeries || [])];
            const brand = params.brand;
            window.__brandSalesCalls.push({ brand, selected });
            if (brand === "MG") {
              return new Promise((resolve) => {
                window.__pendingBrandSales.push({ brand, selected, resolve });
              });
            }
            return Promise.resolve(rawFor(brand, selected));
          },
          loadNegativeProcessKindStageRaw: async (kind, stage, params) => {
            window.__brandProcessCalls = [...(window.__brandProcessCalls || []), { brand: params.brand, selected: [...(params.vehicleSeries || [])], kind, stage }];
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: emptyAgg, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: emptyAgg, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async (params) => ({ dealers: params.brand === "荣威" ? [dealerRows[1]] : [dealerRows[0]], evidence: { sourceDsId: "brand-test", complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "品牌测试总部" }));
  }, { dealerRows: dealers });

  await page.goto("/?brand=MG&vehicleSeries=%E5%85%A8%E6%96%B0MG4");
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全新MG4");
  await page.waitForFunction(() => (window.__pendingBrandSales || []).some((item) => item.brand === "MG"));

  await page.evaluate(() => {
    history.pushState({}, "", "?brand=%E8%8D%A3%E5%A8%81&vehicleSeries=%E5%85%A8%E6%96%B0MG4&carSeries=MG%204X");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/brand=%E8%8D%A3%E5%A8%81/);
  await expect(page).not.toHaveURL(/vehicleSeries=/);
  await expect(page).not.toHaveURL(/carSeries=/);
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("31");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual([]);
  await page.locator("#vehicleSeriesTrigger").click();
  await expect(page.locator(".vehicle-series-option span:last-child")).toHaveText(["全部车系", "全新MG4", "荣威D7"]);
  await page.keyboard.press("Escape");
  expect(await page.locator('#diagnosisTableBody [data-row-level="area"] .dealer strong').allTextContents()).toEqual(["荣威大区"]);
  expect(await page.locator("#vehicleSeriesTrigger").textContent()).toContain("全部车系");
  expect(await page.locator("#funnelGrid > .sales-target-summary").count()).toBe(0);
  await page.waitForFunction(() => window.__retailGioEvent?.vehicleSeries === "全部车系" && window.__retailGioEvent?.vehicleSeriesCount === 0);
  expect(await page.evaluate(() => window.__brandSalesCalls.filter((call) => call.brand === "荣威").map((call) => call.selected))).toEqual([[]]);
  expect(await page.evaluate(() => window.__brandProcessCalls.every((call) => call.brand === "荣威" && call.selected.length === 0))).toBe(true);

  await page.evaluate(() => window.__resolveBrandSales("MG"));
  await page.waitForTimeout(50);
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("31");
  expect(await page.locator('#diagnosisTableBody [data-row-level="area"] .dealer strong').allTextContents()).toEqual(["荣威大区"]);

  await page.goBack();
  await expect(page).toHaveURL(/brand=MG/);
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await page.evaluate(() => window.__resolveBrandSales("MG"));
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("22");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).vehicleSeries).toEqual([]);

  await page.goForward();
  await expect(page).toHaveURL(/brand=%E8%8D%A3%E5%A8%81/);
  await expect(page).not.toHaveURL(/vehicleSeries=/);
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全部车系");
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("31");
});

test("车系多选只过滤销售表现，过程表和过程导出保持原组织日期口径", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const salesOrderBefore = await page.locator(".sales-panel .funnel-kpi-card").first().textContent();
  await page.locator("#processTab").click();
  const processTableBefore = await page.locator("#processListTableBody").innerText();
  const processCsvBefore = parseCsvRows(await captureProcessCsv(page));
  const processRowsBefore = processCsvBefore.slice(1);
  expect(processRowsBefore.length).toBeGreaterThan(0);

  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await page.locator('[data-vehicle-series="MG 4X"]').click();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("已选 2 个车系");
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).not.toHaveText(salesOrderBefore || "");
  await page.locator("#processTab").click();
  await expect(page.locator("#vehicleSeriesProcessNotice")).toBeVisible();
  expect(await page.locator("#processListTableBody").innerText()).toBe(processTableBefore);
  const processCsvAfter = parseCsvRows(await captureProcessCsv(page));
  expect(processCsvAfter.slice(2)).toEqual(processRowsBefore);
  expect(processCsvAfter[0][0]).toBe("说明");
  expect(processCsvAfter[0][1]).toContain("车系筛选仅覆盖销售漏斗及销售表现");
});

test("单一车系只命中部分组织时过程表和 CSV 仍按无车系基线展示", async ({ page }) => {
  const fixture = makeFixture();
  fixture.vehicleSeriesData = {
    ...fixture.vehicleSeriesData,
    "全新MG4": { ...fixture.data, stores: fixture.data.stores.filter((store) => store.code === "S1") }
  };
  await openFixture(page, profiles.headquarters, "", fixture);

  const processSnapshot = async () => ({
    rows: await page.locator("#processListTableBody [data-organization-row]").evaluateAll((items) => items.map((item) => ({
      code: item.getAttribute("data-organization-row"),
      level: item.getAttribute("data-row-level"),
      text: item.innerText
    }))),
    csv: parseCsvRows(await captureProcessCsv(page))
  });
  const processDataRows = (rows) => rows.filter((row) => row[0] !== "说明" && row[0] !== "大区" && row[0] !== "小区" && row[0] !== "门店");
  const assertProcessStableAfterFilter = async (before, restoreDrill = async () => {}) => {
    await page.locator("#vehicleSeriesTrigger").click();
    await page.locator('[data-vehicle-series="全新MG4"]').click();
    await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全新MG4");
    await page.locator("#processTab").click();
    await restoreDrill();
    const after = await processSnapshot();
    expect(after.rows).toEqual(before.rows);
    expect(processDataRows(after.csv)).toEqual(processDataRows(before.csv));
    expect(after.csv[0][0]).toBe("说明");
  };

  await page.locator("#processTab").click();
  const hqBefore = await processSnapshot();
  expect(hqBefore.rows.map((row) => row.code)).toEqual(["A1", "A2"]);
  await assertProcessStableAfterFilter(hqBefore);
  await page.locator("#salesTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toEqual([]);

  await page.locator("#processTab").click();
  await page.locator('#processListTableBody [data-organization-row="A1"]').click();
  const areaBefore = await processSnapshot();
  expect(areaBefore.rows.map((row) => row.code)).toEqual(["D1", "D2"]);
  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator('[data-vehicle-series="全部车系"]').click();
  await page.locator("#processTab").click();
  await assertProcessStableAfterFilter(areaBefore, async () => {
    await page.locator('#processListTableBody [data-organization-row="A1"]').click();
  });
  await page.locator("#salesTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toEqual([]);

  await page.locator("#processTab").click();
  await page.locator('#processListTableBody [data-organization-row="D1"]').click();
  const districtBefore = await processSnapshot();
  expect(districtBefore.rows.map((row) => row.code)).toEqual(["S1", "S2"]);
  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator('[data-vehicle-series="全部车系"]').click();
  await page.locator("#processTab").click();
  await assertProcessStableAfterFilter(districtBefore, async () => {
    await page.locator('#processListTableBody [data-organization-row="A1"]').click();
    await page.locator('#processListTableBody [data-organization-row="D1"]').click();
  });
  await page.locator("#salesTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toEqual(["S1"]);
});

test("打铁组织范围文案不被销售车系结果收窄", async ({ page }) => {
  const fixture = makeFlatDealerFixture(34);
  fixture.vehicleSeriesData = {
    ...fixture.vehicleSeriesData,
    "全新MG4": { ...fixture.data, stores: fixture.data.stores.filter((store) => store.code === "F01") }
  };
  await openFixture(page, profiles.headquarters, "areaCode=A2", fixture);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区2");

  await page.locator("#vehicleSeriesTrigger").click();
  await page.locator('[data-vehicle-series="全新MG4"]').click();
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全新MG4");

  await page.locator("#ironTab").click();
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区2");
});

test("正式异步车系过滤缺少部分大区事实时仍展示动态排名和占比", async ({ page }) => {
  const areaCodes = ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"];
  const dealers = areaCodes.map((areaCode, index) => ({
    code: `S${index + 1}`,
    name: `门店${index + 1}`,
    areaCode,
    area: `大区${index + 1}`,
    districtCode: `D${index + 1}`,
    district: `小区${index + 1}`
  }));
  await page.addInitScript(({ dealerRows }) => {
    const row = (dealer, orders) => ({
      "经销商代码": dealer.code,
      "经销商名称": dealer.name,
      "大区名称": dealer.area,
      "小区名称": dealer.district,
      "当日下发线索数": orders * 10,
      "当日首触客流数": orders * 4,
      "当日首触试驾数": orders * 2,
      "当日订单数（首触）": orders,
      "当日零售数": Math.max(0, orders - 1)
    });
    const makeRaw = (selected) => {
      const rows = selected.length ? dealerRows.slice(0, 6) : dealerRows;
      return {
        range: { startDate: "2026-07-01", endDate: "2026-07-20" },
        previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
        weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
        sales: rows.map((dealer, index) => row(dealer, 20 - index)),
        salesPrev: rows.map((dealer, index) => row(dealer, 18 - index)),
        salesWeek: rows.map((dealer, index) => row(dealer, 16 - index)),
        monthlyTarget: { status: "ready", targets: [], targetActuals: [], audit: {}, months: [] },
        scopeEvidence: { source: "aggregate-sql", complete: true, hitLimit: false }
      };
    };
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4", "MG 4X"],
          loadSalesRaw: async (params) => makeRaw([...(params.vehicleSeries || [])]),
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            const empty = { total: 0, negative: 0, rate: null, problems: [] };
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: empty, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: empty, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: window.RetailNationalScope.CONFIG.sourceDsId, complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部" }));
  }, { dealerRows: dealers });
  await page.goto("/?vehicleSeries=%E5%85%A8%E6%96%B0MG4");
  await expect(page.locator("#vehicleSeriesTrigger")).toContainText("全新MG4");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).nationalComplete).toBe(true);
  const rowTexts = await page.locator('#diagnosisTableBody [data-row-level="area"]').allInnerTexts();
  expect(rowTexts).toHaveLength(6);
  expect(rowTexts.every((text) => /排名\s+\d+\/6/.test(text))).toBe(true);
  expect(rowTexts.every((text) => /占比\s+\d+%/.test(text))).toBe(true);
});

test("正式异步过程基线不反向扩大车系筛选后的销售组织集合", async ({ page }) => {
  const areaCodes = ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"];
  const dealers = areaCodes.map((areaCode, index) => ({
    code: `S${index + 1}`,
    name: `门店${index + 1}`,
    areaCode,
    area: `大区${index + 1}`,
    districtCode: `D${index + 1}`,
    district: `小区${index + 1}`
  }));
  await page.addInitScript(({ dealerRows }) => {
    const salesRow = (dealer, orders) => ({
      "经销商代码": dealer.code,
      "经销商名称": dealer.name,
      "大区名称": dealer.area,
      "小区名称": dealer.district,
      "当日下发线索数": orders * 10,
      "当日首触客流数": orders * 4,
      "当日首触试驾数": orders * 2,
      "当日订单数（首触）": orders,
      "当日零售数": Math.max(0, orders - 2)
    });
    const makeRaw = (selected) => {
      const key = [...selected].join("\u0001");
      const rows = key === "全新MG4"
        ? [{ dealer: dealerRows[0], orders: 22 }]
        : key === "MG 4X"
          ? [{ dealer: dealerRows[1], orders: 17 }]
          : [
              { dealer: dealerRows[0], orders: 22 },
              { dealer: dealerRows[1], orders: 17 },
              ...dealerRows.slice(2).map((dealer, index) => ({ dealer, orders: 10 - index }))
            ];
      return {
        range: { startDate: "2026-07-01", endDate: "2026-07-20" },
        previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
        weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
        sales: rows.map((item) => salesRow(item.dealer, item.orders)),
        salesPrev: rows.map((item) => salesRow(item.dealer, Math.max(0, item.orders - 1))),
        salesWeek: rows.map((item) => salesRow(item.dealer, Math.max(0, item.orders - 2))),
        monthlyTarget: { status: "ready", targets: [], targetActuals: [], audit: {}, months: [] },
        scopeEvidence: { source: "aggregate-sql", complete: true, hitLimit: false, scenario: `sales-${key || "all"}` }
      };
    };
    const processAgg = (total, negative, name, count) => ({
      total,
      negative,
      rate: total ? negative / total * 100 : null,
      problems: [{ name, count, denominator: total, rate: total ? count / total * 100 : null, children: [] }]
    });
    const processRaw = (stage) => {
      const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
      const ipRows = dealerRows.slice(0, 2).map((dealer, index) => ({
        code: dealer.code,
        name: dealer.name,
        ...processAgg(20 + index * 5, 4 + index, "零钩子", 3 + index)
      }));
      const driveRows = dealerRows.slice(0, 2).map((dealer, index) => ({
        code: dealer.code,
        name: dealer.name,
        ...processAgg(10 + index * 5, 2 + index, "版本未推荐", 2 + index)
      }));
      return {
        [`ipAgg${suffix}`]: processAgg(45, 9, "零钩子", 7),
        [`ipAggStores${suffix}`]: ipRows,
        [`driveTagAgg${suffix}`]: processAgg(25, 5, "版本未推荐", 5),
        [`driveTagAggStores${suffix}`]: driveRows
      };
    };
    window.__pendingProcess = [];
    window.__resolveProcessFor = (nav) => {
      const ready = window.__pendingProcess.filter((item) => item.nav === nav);
      window.__pendingProcess = window.__pendingProcess.filter((item) => item.nav !== nav);
      ready.forEach((item) => item.resolve(processRaw(item.stage)));
    };
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4", "MG 4X"],
          loadSalesRaw: async (params) => makeRaw([...(params.vehicleSeries || [])]),
          loadNegativeProcessKindStageRaw: async (kind, stage) => new Promise((resolve) => {
            const search = window.location.search;
            const nav = search.includes("MG%204X") || search.includes("MG+4X") ? "mg4x" : search.includes("%E5%85%A8%E6%96%B0MG4") ? "mg4" : "all";
            window.__pendingProcess.push({ nav, kind, stage, resolve });
          })
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: window.RetailNationalScope.CONFIG.sourceDsId, complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部" }));
  }, { dealerRows: dealers });

  const currentWave = ["ip:current", "drive:current"];
  const comparisonWave = ["ip:previous", "drive:previous", "ip:week", "drive:week"];
  const resolveProcessWave = async (nav, expectedWave) => {
    await page.waitForFunction(({ target, expectedCount }) => (window.__pendingProcess || []).filter((item) => item.nav === target).length >= expectedCount, { target: nav, expectedCount: expectedWave.length });
    const pending = await page.evaluate((target) => (window.__pendingProcess || []).filter((item) => item.nav === target).map((item) => `${item.kind}:${item.stage}`), nav);
    expect(pending).toEqual(expectedWave);
    await page.evaluate((target) => window.__resolveProcessFor(target), nav);
  };
  const assertNoPendingProcessFor = async (nav) => {
    expect(await page.evaluate((target) => (window.__pendingProcess || []).filter((item) => item.nav === target).map((item) => `${item.kind}:${item.stage}`), nav)).toEqual([]);
  };
  const salesAreaNames = async () => page.locator('#diagnosisTableBody [data-row-level="area"] .dealer strong').allTextContents();
  const salesCsvNames = async () => parseCsvRows(await captureSalesCsv(page)).slice(1).map((row) => row[0]);
  const assertSalesOnly = async (areaName, orderText) => {
    await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText(orderText);
    expect(await salesAreaNames()).toEqual([areaName]);
    expect(await salesCsvNames()).toEqual([areaName]);
    const rowTexts = await page.locator('#diagnosisTableBody [data-row-level="area"]').allInnerTexts();
    expect(rowTexts).toHaveLength(1);
    expect(rowTexts[0]).toContain(areaName);
    expect(rowTexts[0]).not.toContain(areaName === "大区1" ? "大区2" : "大区1");
  };
  const processAreaNames = async () => page.locator('#processListTableBody [data-row-level="area"] .dealer strong').allTextContents();
  const processCsvNames = async () => parseCsvRows(await captureProcessCsv(page)).filter((row) => !["说明", "大区"].includes(row[0])).map((row) => row[0]);

  await page.goto("/?vehicleSeries=%E5%85%A8%E6%96%B0MG4");
  await assertSalesOnly("大区1", "22");
  await page.locator("#processTab").click();
  expect(await processAreaNames()).toEqual(["大区1", "大区2", "大区3", "大区4", "大区5", "大区6", "大区7"]);

  await page.locator("#salesTab").click();
  await resolveProcessWave("mg4", currentWave);
  await resolveProcessWave("mg4", comparisonWave);
  await assertSalesOnly("大区1", "22");
  await page.locator("#processTab").click();
  expect(await processAreaNames()).toEqual(["大区1", "大区2", "大区3", "大区4", "大区5", "大区6", "大区7"]);
  expect(await processCsvNames()).toEqual(["大区1", "大区2", "大区3", "大区4", "大区5", "大区6", "大区7"]);

  await page.goto("/?vehicleSeries=%E5%85%A8%E6%96%B0MG4");
  await assertSalesOnly("大区1", "22");
  await page.waitForFunction(() => (window.__pendingProcess || []).filter((item) => item.nav === "mg4").length >= 2);
  await page.evaluate(() => {
    history.pushState({}, "", "?vehicleSeries=MG%204X");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await assertSalesOnly("大区2", "17");
  await resolveProcessWave("mg4", currentWave);
  await page.waitForTimeout(50);
  await assertNoPendingProcessFor("mg4");
  await assertSalesOnly("大区2", "17");
  await resolveProcessWave("mg4x", currentWave);
  await resolveProcessWave("mg4x", comparisonWave);
  await assertSalesOnly("大区2", "17");
  await page.locator("#processTab").click();
  expect(await processAreaNames()).toEqual(["大区1", "大区2", "大区3", "大区4", "大区5", "大区6", "大区7"]);
});

test("过程四卡加载占位与标签阶段非阻塞销售转化率", async ({ page }) => {
  const dealers = [{ code: "S1", name: "测试门店", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }];
  const salesRow = (leads, arrivals, drives, orders, retail) => ({
    "经销商代码": "S1",
    "经销商简称": "测试门店",
    "大区简称": "大区1",
    "小区简称": "小区1",
    "当日下发线索数": leads,
    "当日首触客流数": arrivals,
    "当日首触试驾数": drives,
    "当日订单数（首触）": orders,
    "当日零售数": retail
  });
  const salesRaw = {
    sales: [salesRow(100, 20, 10, 5, 2)],
    salesPrev: [salesRow(80, 8, 4, 2, 1)],
    salesWeek: [salesRow(50, 5, 2, 1, 1)],
    scopeEvidence: { source: "test-sales", complete: true, hitLimit: false }
  };

  await page.addInitScript(({ dealerRows, raw }) => {
    const rejecters = [];
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4", "MG 4X"],
          loadSalesRaw: () => new Promise((resolve) => {
            window.__resolvePcSales = () => resolve(raw);
          }),
          loadNegativeProcessStageRaw: () => new Promise((_, reject) => {
            window.__rejectPcProcessStage = () => reject(new Error("标签阶段模拟失败"));
          }),
          loadNegativeProcessKindStageRaw: () => new Promise((_, reject) => {
            rejecters.push(reject);
            window.__rejectPcProcessStage = () => {
              rejecters.splice(0).forEach((rejectItem) => rejectItem(new Error("标签阶段模拟失败")));
            };
          })
        };
      }
    });

    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({
            dealers: dealerRows,
            evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false }
          }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ" }));
  }, { dealerRows: dealers, raw: salesRaw });

  await page.goto("/");
  await page.waitForFunction(() => typeof window.__resolvePcSales === "function");
  const processCards = page.locator(".process-panel .funnel-kpi-card");
  await expect(processCards).toHaveCount(4);
  expect(await processCards.locator(".funnel-kpi-label").allTextContents()).toEqual(["线索到店率", "到店试驾率", "试驾订单率", "线索订单率"]);
  await expect(page.locator(".process-panel")).toContainText("--");

  await page.evaluate(() => window.__resolvePcSales());
  await expect(processCards.nth(0)).toContainText("20.0%");
  await expect(processCards.nth(1)).toContainText("50.0%");
  await expect(processCards.nth(2)).toContainText("50.0%");
  await expect(processCards.nth(3)).toContainText("5.0%");
  await page.waitForFunction(() => typeof window.__rejectPcProcessStage === "function");
  await page.evaluate(() => {
    window.__rejectPcProcessStage();
  });
  await expect(page.locator(".process-error-row")).toContainText("邀约四项数据不完整：标签阶段模拟失败");
  await expect(page.locator(".process-panel .funnel-kpi-card").nth(1)).toContainText("50.0%");
  await expect(page.locator(".process-panel .funnel-kpi-card").nth(3)).toContainText("5.0%");
  await page.locator("#processTab").click();
  await expect(page.locator(".process-error-row")).toContainText("邀约四项数据不完整：标签阶段模拟失败");
  await expect(page.locator(".process-error-row")).toContainText("试驾三项数据不完整：标签阶段模拟失败");
  const processRow = page.locator("#processListTableBody [data-organization-row]").first();
  await expect(processRow.locator("td").nth(1).locator(".metric-value")).toHaveText("20.0%");
  await expect(processRow.locator("td").nth(6).locator(".metric-value")).toHaveText("50.0%");
  await expect(processRow.locator("td").nth(7).locator(".metric-value")).toHaveText("数据不完整");
  await expect(processRow.locator("td").nth(8).locator(".metric-value")).toHaveText("数据不完整");
  await expect(processRow.locator("td").nth(9).locator(".metric-value")).toHaveText("数据不完整");
  await expect(processRow.locator("td").nth(7)).not.toContainText("--");
  await expect(processRow.locator("td").nth(8)).not.toContainText("--");
  await expect(processRow.locator("td").nth(9)).not.toContainText("--");
});

test("PC 顶部过程指标统一展示四项正向销售转化率", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const processCards = page.locator(".process-panel .funnel-kpi-card");

  await expect(processCards).toHaveCount(4);
  expect(await processCards.locator(".funnel-kpi-label").allTextContents()).toEqual(["线索到店率", "到店试驾率", "试驾订单率", "线索订单率"]);
  await expect(processCards.nth(1)).toContainText("56.0%");
  await expect(processCards.nth(1)).toContainText("+8.4%");
  await expect(processCards.nth(1)).toContainText("+14.8%");
  await expect(processCards.nth(3)).toContainText("25.0%");
  await expect(processCards.nth(3)).toContainText("+2.2%");
  await expect(processCards.nth(3)).toContainText("+4.5%");
  expect(await processCards.locator(".funnel-kpi-icon").allTextContents()).toEqual(["%", "%", "%", "%"]);
  await expect(page.locator(".process-panel")).not.toContainText("负向邀约占比");
  await expect(page.locator(".process-panel")).not.toContainText("负向试驾接待占比");
  await expect(processCards.nth(1).locator(".funnel-kpi-meta .up")).toHaveCount(2);
  await expect(processCards.nth(3).locator(".funnel-kpi-meta .up")).toHaveCount(2);
});

test("IP 失败时仅邀约四项数据不完整，试驾三项和顶部四率保持成功值", async ({ page }) => {
  await openProcessKindScenario(page, { failIp: true });
  const cards = page.locator(".process-panel .funnel-kpi-card");
  await expect(cards.nth(0)).toContainText("20.0%");
  await expect(cards.nth(1)).toContainText("50.0%");
  await expect(cards.nth(2)).toContainText("50.0%");
  await expect(cards.nth(3)).toContainText("5.0%");
  await expect(page.locator(".process-error-row")).toContainText("邀约四项数据不完整：current IP 模拟失败");
  await expect(page.locator(".process-error-row")).not.toContainText("试驾三项数据不完整");
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  await expect(row.locator("td").nth(2).locator(".metric-value")).toHaveText("数据不完整");
  await expect(row.locator("td").nth(5).locator(".metric-value")).toHaveText("数据不完整");
  await expect(row.locator("td").nth(7).locator(".metric-value")).toHaveText("16.7%");
  await expect(row.locator("td").nth(8).locator(".metric-value")).toHaveText("7.7%");
  await expect(row.locator("td").nth(9).locator(".metric-value")).toHaveText("10.0%");
  expect(await page.evaluate(() => window.__processKindCalls)).toEqual(["ip:current", "drive:current", "ip:previous", "drive:previous", "ip:week", "drive:week"]);
});

test("试驾失败时仅试驾三项数据不完整，邀约四项和顶部四率保持成功值", async ({ page }) => {
  await openProcessKindScenario(page, { failDrive: true });
  const cards = page.locator(".process-panel .funnel-kpi-card");
  await expect(cards.nth(0)).toContainText("20.0%");
  await expect(cards.nth(1)).toContainText("50.0%");
  await expect(cards.nth(2)).toContainText("50.0%");
  await expect(cards.nth(3)).toContainText("5.0%");
  await expect(page.locator(".process-error-row")).toContainText("试驾三项数据不完整：current drive 模拟失败");
  await expect(page.locator(".process-error-row")).not.toContainText("邀约四项数据不完整");
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  await expect(row.locator("td").nth(2).locator(".metric-value")).toHaveText("0.0%");
  await expect(row.locator("td").nth(3).locator(".metric-value")).toHaveText("20.0%");
  await expect(row.locator("td").nth(5).locator(".metric-value")).toHaveText("--");
  await expect(row.locator("td").nth(7).locator(".metric-value")).toHaveText("数据不完整");
  await expect(row.locator("td").nth(9).locator(".metric-value")).toHaveText("数据不完整");
});

test("IP 和试驾均成功时过程七项按各自口径展示 0.0% 与 --", async ({ page }) => {
  await openProcessKindScenario(page);
  await expect(page.locator(".process-error-row")).toHaveCount(0);
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  await expect(row.locator("td").nth(2).locator(".metric-value")).toHaveText("0.0%");
  await expect(row.locator("td").nth(3).locator(".metric-value")).toHaveText("20.0%");
  await expect(row.locator("td").nth(5).locator(".metric-value")).toHaveText("--");
  await expect(row.locator("td").nth(7).locator(".metric-value")).toHaveText("16.7%");
  await expect(row.locator("td").nth(8).locator(".metric-value")).toHaveText("7.7%");
  await expect(row.locator("td").nth(9).locator(".metric-value")).toHaveText("10.0%");
});

test("IP 和试驾均失败时过程七项数据不完整但销售概览与顶部四率保留", async ({ page }) => {
  await openProcessKindScenario(page, { failIp: true, failDrive: true });
  await expect(page.locator(".sales-panel")).toContainText("订单");
  const cards = page.locator(".process-panel .funnel-kpi-card");
  await expect(cards.nth(0)).toContainText("20.0%");
  await expect(cards.nth(3)).toContainText("5.0%");
  await expect(page.locator(".process-error-row")).toContainText("邀约四项数据不完整：current IP 模拟失败");
  await expect(page.locator(".process-error-row")).toContainText("试驾三项数据不完整：current drive 模拟失败");
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  for (const index of [2, 3, 4, 5, 7, 8, 9]) {
    await expect(row.locator("td").nth(index).locator(".metric-value")).toHaveText("数据不完整");
  }
});

test("IP previous 阶段失败时保留当前值，仅月环比显示加载失败且继续请求 week", async ({ page }) => {
  await openProcessKindScenario(page, { failIpStages: ["previous"] });
  await expect(page.locator(".process-error-row")).toContainText("previous IP 模拟失败");
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  const cell = row.locator("td").nth(2);
  await expect(cell.locator(".metric-value")).toHaveText("0.0%");
  await expect(cell.locator('[data-kind="month"] .trend-change')).toHaveText("加载失败");
  await expect(cell.locator('[data-kind="week"] .trend-change')).toHaveText("--");
  expect(await page.evaluate(() => window.__processKindCalls)).toEqual(["ip:current", "drive:current", "ip:previous", "drive:previous", "ip:week", "drive:week"]);
});

test("drive week 阶段失败时保留当前值和月环比，仅周环比显示加载失败", async ({ page }) => {
  await openProcessKindScenario(page, { failDriveStages: ["week"] });
  await expect(page.locator(".process-error-row")).toContainText("week drive 模拟失败");
  const row = page.locator('#processListTableBody [data-organization-row="S1"]');
  const cell = row.locator("td").nth(7);
  await expect(cell.locator(".metric-value")).toHaveText("16.7%");
  await expect(cell.locator('[data-kind="month"] .trend-change')).toHaveText("--");
  await expect(cell.locator('[data-kind="week"] .trend-change')).toHaveText("加载失败");
  expect(await page.evaluate(() => window.__processKindCalls)).toEqual(["ip:current", "drive:current", "ip:previous", "drive:previous", "ip:week", "drive:week"]);
});

test("过程表试驾问题有分母且 0 负向时展示 0.0%", async ({ page }) => {
  const current = { leads: 40, arrivals: 20, drives: 10, orders: 4, retail: 3 };
  const previous = { leads: 20, arrivals: 8, drives: 3, orders: 1, retail: 1 };
  const week = { leads: 24, arrivals: 10, drives: 4, orders: 1, retail: 1 };
  const processAgg = (total, negative, problems = []) => ({ total, negative, rate: total ? negative / total * 100 : null, problems });
  const store = {
    code: "MQ8530",
    name: "测试门店",
    areaCode: "A1",
    area: "大区1",
    districtCode: "D1",
    district: "小区1",
    current,
    previous,
    week,
    ip: processAgg(0, 0),
    ipPrev: processAgg(0, 0),
    ipWeek: processAgg(0, 0),
    driveTag: processAgg(31, 2, [
      { name: "版本推荐", count: 0, denominator: 6, rate: 0, children: [] },
      { name: "顾虑承接", count: 1, denominator: 13, rate: 7.6923, children: [] },
      { name: "竞品攻防", count: 1, denominator: 10, rate: 10, children: [] }
    ]),
    drivePrev: processAgg(0, 0),
    driveWeek: processAgg(0, 0),
    issue: "顾虑承接",
    direction: "逻辑待确认",
    totalNegative: 2
  };

  await openFixture(page, profiles.district, "", makeFixture({ stores: [store] }));
  await page.locator("#processTab").click();
  const row = page.locator('#processListTableBody [data-organization-row="MQ8530"]');
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(7).locator(".metric-value")).toHaveText("0.0%");
  await expect(row.locator("td").nth(8).locator(".metric-value")).toHaveText("7.7%");
  await expect(row.locator("td").nth(9).locator(".metric-value")).toHaveText("10.0%");
});

test("过程表试驾问题正常空样本仍展示 --", async ({ page }) => {
  const current = { leads: 40, arrivals: 20, drives: 10, orders: 4, retail: 3 };
  const previous = { leads: 20, arrivals: 8, drives: 3, orders: 1, retail: 1 };
  const week = { leads: 24, arrivals: 10, drives: 4, orders: 1, retail: 1 };
  const processAgg = (total, negative, problems = []) => ({ total, negative, rate: total ? negative / total * 100 : null, problems });
  const store = {
    code: "MQ8530",
    name: "测试门店",
    areaCode: "A1",
    area: "大区1",
    districtCode: "D1",
    district: "小区1",
    current,
    previous,
    week,
    ip: processAgg(0, 0),
    ipPrev: processAgg(0, 0),
    ipWeek: processAgg(0, 0),
    driveTag: processAgg(0, 0),
    drivePrev: processAgg(0, 0),
    driveWeek: processAgg(0, 0),
    issue: "暂无负向问题",
    direction: "逻辑待确认",
    totalNegative: 0
  };

  await openFixture(page, profiles.district, "", makeFixture({ stores: [store] }));
  await page.locator("#processTab").click();
  await expect(page.locator(".process-error-row")).toHaveCount(0);
  const row = page.locator('#processListTableBody [data-organization-row="MQ8530"]');
  await expect(row.locator("td").nth(7).locator(".metric-value")).toHaveText("--");
  await expect(row.locator("td").nth(8).locator(".metric-value")).toHaveText("--");
  await expect(row.locator("td").nth(9).locator(".metric-value")).toHaveText("--");
});

test("五类角色进入正确首层，未知角色安全降级", async ({ page }) => {
  const cases = [
    [profiles.headquarters, "area", "大区"], [profiles.region, "district", "小区"], [profiles.district, "store", "经销商名称"],
    [profiles.salesDirector, "store", "经销商名称"], [profiles.investor, "store", "经销商名称"]
  ];
  for (const [profile, level, heading] of cases) {
    await openFixture(page, profile);
    expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe(level);
    await expect(page.locator("#salesFirstColumn")).toHaveText(heading);
  }
  await openFixture(page, profiles.unknown);
  await expect(page.locator("#funnelGrid")).toContainText("角色识别异常");
});

test("投资人门店层跨小区统一排名，小区角色仍按所属小区排名", async ({ page }) => {
  await openFixture(page, profiles.investor);
  await expect(page.locator('#diagnosisTableBody [data-row-level="store"]')).toHaveCount(4);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).role).toBe("investor");
  expect(await page.locator('#diagnosisTableBody [data-row-level="store"] .dealer span').evaluateAll((cells) => [...new Set(cells.map((cell) => cell.textContent.trim()).filter(Boolean))].length)).toBeGreaterThanOrEqual(2);

  const investorRanks = {};
  for (const code of ["S1", "S2", "S3", "S4"]) {
    investorRanks[code] = {
      order: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .order-rank-cell .rank-main`).textContent(),
      orderShare: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .order-rank-cell .rank-sub-value`).textContent(),
      retail: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .retail-rank-cell .rank-main`).textContent(),
      retailShare: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .retail-rank-cell .rank-sub-value`).textContent()
    };
  }
	  expect(investorRanks).toMatchObject({
	    S4: { order: "1/4", orderShare: "43%", retail: "1/4", retailShare: "53%" },
	    S1: { order: "2/4", orderShare: "20%", retail: "2/4", retailShare: "20%" },
	    S2: { order: "3/4", orderShare: "20%", retail: "3/4", retailShare: "13%" },
	    S3: { order: "4/4", orderShare: "17%", retail: "4/4", retailShare: "13%" }
	  });

  await openFixture(page, profiles.district);
  const districtRanks = {};
  for (const code of ["S1", "S2", "S3", "S4"]) {
    districtRanks[code] = {
      order: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .order-rank-cell .rank-main`).textContent(),
      orderShare: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .order-rank-cell .rank-sub-value`).textContent(),
      retail: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .retail-rank-cell .rank-main`).textContent(),
      retailShare: await page.locator(`#diagnosisTableBody [data-organization-row="${code}"] .retail-rank-cell .rank-sub-value`).textContent()
    };
  }
	  expect(districtRanks).toMatchObject({
	    S1: { order: "1/2", orderShare: "50%", retail: "1/2", retailShare: "60%" },
	    S2: { order: "2/2", orderShare: "50%", retail: "2/2", retailShare: "40%" },
    S3: { order: "1/1", orderShare: "100%", retail: "1/1", retailShare: "100%" },
    S4: { order: "1/1", orderShare: "100%", retail: "1/1", retailShare: "100%" }
  });

  await openFixture(page, profiles.investor, "dealerCode=S1", makeFixture({ stores: storesFor({ storeCode: "S1" }), diagnosisStores: storesFor() }));
  await expect(page.locator('#diagnosisTableBody [data-row-level="store"]')).toHaveCount(1);
  expect(await page.evaluate(() => ({
    display: window.__retailPcApp.getStateSnapshot().visibleStoreCodes,
    diagnosisCount: window.__retailPcFixture.diagnosisStores.length,
    diagnosisDistrictCount: new Set(window.__retailPcFixture.diagnosisStores.map((store) => store.districtCode)).size
  }))).toEqual({ display: ["S1"], diagnosisCount: 4, diagnosisDistrictCount: 3 });
  const investorSingleStore = page.locator('#diagnosisTableBody [data-organization-row="S1"]');
  await expect(investorSingleStore.locator(".order-rank-cell .rank-main")).toHaveText("1/1");
  await expect(investorSingleStore.locator(".order-rank-cell .rank-sub-value")).toHaveText("100%");
  await expect(investorSingleStore.locator(".retail-rank-cell .rank-main")).toHaveText("1/1");
  await expect(investorSingleStore.locator(".retail-rank-cell .rank-sub-value")).toHaveText("100%");
});

test("空 marketing_userType 在页面按总部进入大区清单", async ({ page }) => {
  const cases = [
    ["null", { marketing_userType: null }],
    ["undefined", { marketing_userType: undefined }],
    ["空字符串", { marketing_userType: "" }],
    ["纯空白", { marketing_userType: "  " }]
  ];
  for (const [name, profile] of cases) {
    await openFixture(page, profile);
    const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
    expect(snapshot.role, name).toBe("headquarters");
    expect(snapshot.viewLevel, name).toBe("area");
    await expect(page.locator("#funnelGrid"), name).not.toContainText("角色识别异常");
    await expect(page.locator("#storeTableTitle"), name).toHaveText("大区销售表现");
    await expect(page.locator("#salesFirstColumn"), name).toHaveText("大区");
    await expect(page.locator('#diagnosisTableBody [data-row-level="area"]'), name).toHaveCount(2);
  }
});

test("PC 实际范围随手动下钻、Tab 和返回同步，顶部快照不变", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const funnelBefore = await page.locator("#funnelGrid").innerText();
  await expect(page.locator("#storeTableTitle")).toHaveText("大区销售表现");
  await expect(page.locator("#organizationBreadcrumb")).toBeHidden();
  await expect(page.locator(".organization-role")).toBeHidden();
  await expect(page.locator('#diagnosisTableBody [data-row-level="area"]')).toHaveCount(2);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" }).locator("[data-organization-drill]").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await expect(page.locator("#storeTableTitle")).toHaveText("小区销售表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await expect(page.locator(".organization-pc-scope")).toBeVisible();
  await expect(page.locator(".organization-role")).toBeHidden();
  await expect(page.locator(".organization-path")).toBeHidden();
  await page.locator("#processTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await expect(page.locator("#storeTableTitle")).toHaveText("小区过程表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await page.locator("#processListTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("store");
  await expect(page.locator("#storeTableTitle")).toHaveText("门店过程表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
  await expect(page.locator(".organization-pc-back")).toBeVisible();
  await expect(page.locator('#processListTableBody [data-row-level="store"]')).toHaveCount(2);
  expect(await page.evaluate(() => {
    const titleBox = document.getElementById("storeTableTitle")?.getBoundingClientRect();
    const breadcrumb = document.getElementById("organizationBreadcrumb");
    const breadcrumbBox = breadcrumb?.getBoundingClientRect();
    const rightToolsBox = document.querySelector(".store-panel-head-right")?.getBoundingClientRect();
    return {
      sameLine: Boolean(titleBox && breadcrumbBox && Math.abs((titleBox.top + titleBox.height / 2) - (breadcrumbBox.top + breadcrumbBox.height / 2)) <= 2),
      breadcrumbNotClipped: Boolean(breadcrumb && breadcrumb.scrollWidth <= breadcrumb.clientWidth),
      clearsRightTools: Boolean(breadcrumbBox && rightToolsBox && breadcrumbBox.right <= rightToolsBox.left),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
    };
  })).toEqual({ sameLine: true, breadcrumbNotClipped: true, clearsRightTools: true, noHorizontalOverflow: true });
  expect(await page.locator("#funnelGrid").innerText()).toBe(funnelBefore);
  await page.screenshot({ path: "validation/pc-actual-scope-drilled-1440x900.png", fullPage: true });
  await page.locator(".organization-pc-back").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await expect(page.locator("#storeTableTitle")).toHaveText("小区过程表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await page.locator(".organization-pc-back").click();
  await expect(page.locator("#organizationBreadcrumb")).toBeHidden();
});

test("1024px 最深层过程态标题导航完整且不与右侧工具重叠", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await openFixture(page, profiles.headquarters);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" }).locator("[data-organization-drill]").click();
  await page.locator("#processTab").click();
  await page.locator("#processListTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("门店过程表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");

  expect(await page.evaluate(() => {
    const titleBox = document.getElementById("storeTableTitle")?.getBoundingClientRect();
    const breadcrumb = document.getElementById("organizationBreadcrumb");
    const breadcrumbBox = breadcrumb?.getBoundingClientRect();
    const rightToolsBox = document.querySelector(".store-panel-head-right")?.getBoundingClientRect();
    return {
      sameLine: Boolean(titleBox && breadcrumbBox && Math.abs((titleBox.top + titleBox.height / 2) - (breadcrumbBox.top + breadcrumbBox.height / 2)) <= 2),
      breadcrumbNotClipped: Boolean(breadcrumb && breadcrumb.scrollWidth <= breadcrumb.clientWidth),
      clearsRightTools: Boolean(breadcrumbBox && rightToolsBox && breadcrumbBox.right <= rightToolsBox.left),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
    };
  })).toEqual({ sameLine: true, breadcrumbNotClipped: true, clearsRightTools: true, noHorizontalOverflow: true });
  await page.screenshot({ path: "validation/pc-actual-scope-1024x900.png", fullPage: true });
});

test("390px 响应式页面保持层级导航在标题头主行下方独立占行", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, profiles.headquarters);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" }).locator("[data-organization-drill]").click();
  await page.locator("#processTab").click();
  await page.locator("#processListTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("门店过程表现");
  await expect(page.locator(".organization-pc-scope")).toBeHidden();
  await expect(page.locator(".organization-mobile-legacy")).toBeVisible();
  await expect(page.locator(".organization-mobile-legacy")).toContainText("总部");
  await expect(page.locator(".organization-mobile-legacy")).toContainText("大区1");
  await expect(page.locator(".organization-mobile-legacy")).toContainText("小区1");
  await expect(page.locator(".organization-mobile-legacy")).toContainText("门店");

  expect(await page.evaluate(() => {
    const headingBox = document.querySelector(".store-tabs-head")?.getBoundingClientRect();
    const titleBox = document.getElementById("storeTableTitle")?.getBoundingClientRect();
    const breadcrumb = document.getElementById("organizationBreadcrumb");
    const breadcrumbBox = breadcrumb?.getBoundingClientRect();
    const rightToolsBox = document.querySelector(".store-panel-head-right")?.getBoundingClientRect();
    return {
      notOnTitleLine: Boolean(titleBox && breadcrumbBox && breadcrumbBox.top >= titleBox.bottom),
      belowMainHeaderContent: Boolean(rightToolsBox && breadcrumbBox && breadcrumbBox.top >= rightToolsBox.bottom),
      spansOwnRow: Boolean(headingBox && breadcrumbBox && breadcrumbBox.width >= headingBox.width - 2),
      breadcrumbNotClipped: Boolean(breadcrumb && breadcrumb.scrollWidth <= breadcrumb.clientWidth),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
    };
  })).toEqual({
    notOnTitleLine: true,
    belowMainHeaderContent: true,
    spansOwnRow: true,
    breadcrumbNotClipped: true,
    noHorizontalOverflow: true
  });
  await page.screenshot({ path: "validation/pc-actual-scope-mobile-legacy-390x844.png", fullPage: true });
});

test("上游具体大区、小区、门店自动跳层并限制展示范围", async ({ page }) => {
  await openFixture(page, profiles.headquarters, "regionCode=A1&region=未知&districtCode=D1&district=未知", makeFixture());
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
  expect(await page.locator("#organizationBreadcrumb").textContent()).not.toContain("未知");
  await openFixture(page, profiles.headquarters, "regionCode=A1&region=大区", makeFixture());
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await expect(page.locator(".organization-pc-scope")).not.toHaveText("大区");
  await openFixture(page, profiles.headquarters, "regionCode=A1", makeFixture({ stores: storesFor({ areaCode: "A1" }) }));
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await expect(page.locator('#diagnosisTableBody [data-row-level="district"]')).toHaveCount(2);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await expect(page.locator(".organization-pc-back")).toHaveCount(0);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
  await page.locator(".organization-pc-back").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await expect(page.locator(".organization-pc-back")).toHaveCount(0);
  await openFixture(page, profiles.headquarters, "districtCode=D1", makeFixture({ stores: storesFor({ districtCode: "D1" }) }));
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("store");
  await expect(page.locator('#diagnosisTableBody [data-row-level="store"]')).toHaveCount(2);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
  await openFixture(page, profiles.region, "dealerCode=S1", makeFixture({ stores: storesFor({ storeCode: "S1" }) }));
  await expect(page.locator('#diagnosisTableBody [data-row-level="store"]')).toHaveCount(1);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
});

test("已下钻后父应用 URL 筛选变化会清空手动路径并重新自动跳层", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" }).locator("[data-organization-drill]").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).drillPath).toHaveLength(1);

  const areaFixture = makeFixture({ stores: storesFor({ areaCode: "A1" }) });
  await page.evaluate(async ({ fixture }) => {
    history.replaceState(null, "", "/?regionCode=A1&region=%E5%A4%A7%E5%8C%BA1");
    window.__retailPcFixture = fixture;
    await window.__retailPcApp.reload();
  }, { fixture: areaFixture });
  let snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.viewLevel).toBe("district");
  expect(snapshot.drillPath).toEqual([]);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");

  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  const districtFixture = makeFixture({ stores: storesFor({ districtCode: "D1" }) });
  await page.evaluate(async ({ fixture }) => {
    history.replaceState(null, "", "/?regionCode=A1&districtCode=D1&district=%E5%B0%8F%E5%8C%BA1");
    window.__retailPcFixture = fixture;
    await window.__retailPcApp.reload();
  }, { fixture: districtFixture });
  snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.viewLevel).toBe("store");
  expect(snapshot.drillPath).toEqual([]);
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1 - 小区1");
});

test("当前范围全部经销商扁平查看覆盖全国、大区、下钻路径、共享状态、返回和打铁同构", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(34, {
    storeOverrides: {
      0: { orders: 60, retail: 5, areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
      1: { orders: 60, retail: 4, areaCode: "A1", area: "大区1", districtCode: "D2", district: "小区2" },
      2: { orders: 3, retail: 1, areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
    }
  }));
  const funnelBefore = await page.locator("#funnelGrid").innerText();
  const initialSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(initialSnapshot.viewLevel).toBe("area");
  expect(initialSnapshot.drillPath).toEqual([]);
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("查看所有经销商");
  await expect(page.locator("#toggleAllDealersSales")).toHaveAttribute("aria-label", "查看当前范围全部经销商");
  expect(await page.locator("#toggleAllDealersSales").evaluate((button) => {
    const exportBox = document.getElementById("exportSales")?.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const actionHeaders = [...document.querySelectorAll("th.sticky-action")].map((item) => item.textContent.trim());
    return {
      beforeExport: Boolean(exportBox && buttonBox.right <= exportBox.left),
      outsideTableHead: button.closest("thead") === null,
      actionHeaders,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
    };
  })).toEqual({ beforeExport: true, outsideTableHead: true, actionHeaders: ["操作", "操作", "操作"], noHorizontalOverflow: true });

  await page.locator("#toggleAllDealersSales").click();
  const flatSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(flatSnapshot.viewLevel).toBe(initialSnapshot.viewLevel);
  expect(flatSnapshot.drillPath).toEqual(initialSnapshot.drillPath);
  expect(flatSnapshot.allDealerMode).toBe(true);
  expect(flatSnapshot.effectiveSalesLevel).toBe("store");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商销售表现");
  await expect(page.locator("#salesFirstColumn")).toHaveText("经销商名称");
  await expect(page.locator('#diagnosisTableBody [data-row-level="store"]')).toHaveCount(15);
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 1/3 页 · 每页 15 条");
  await expect(page.locator("#salesPagination .pager-prev")).toBeDisabled();
	  await expect(page.locator("#salesPagination .pager-next")).toBeEnabled();
	  await expect(page.locator('#diagnosisTableBody [data-organization-row="F01"] .order-rank-cell .rank-main')).toHaveText("1/34");
	  await expect(page.locator('#diagnosisTableBody [data-organization-row="F02"] .order-rank-cell .rank-main')).toHaveText("2/34");
  await expect(page.locator('#diagnosisTableBody [data-organization-row="F01"] .order-rank-cell .rank-sub-value')).toHaveText(/\d+%/);
  await expect(page.locator("#diagnosisTableBody [data-organization-drill]")).toHaveCount(0);
  await expect(page.locator("#diagnosisTableBody [data-store-detail]")).toHaveCount(15);
  expect(await page.locator("#funnelGrid").innerText()).toBe(funnelBefore);
  await page.screenshot({ path: "validation/pc-all-dealers-sales-flat-1440x900-light.png", fullPage: false });

  await page.locator("#salesPagination .pager-next").click();
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator("#salesPagination .pager-next").click();
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 4 条 · 第 3/3 页 · 每页 15 条");
  await expect(page.locator("#salesPagination .pager-next")).toBeDisabled();

  const salesCsv = parseCsvRows(await captureSalesCsv(page));
  expect(salesCsv.length).toBe(35);
  expect(salesCsv[0][0]).toBe("经销商名称");
  expect(salesCsv.slice(1).map((row) => row[0])).toContain("扁平经销商34");

  await page.locator("#processTab").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商过程表现");
  await expect(page.locator("#toggleAllDealersProcess")).toHaveText("返回分层查看");
  await expect(page.locator('#processListTableBody [data-row-level="store"]')).toHaveCount(15);
  await expect(page.locator("#processPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 1/3 页 · 每页 15 条");
  const processCsv = parseCsvRows(await captureProcessCsv(page));
  expect(processCsv.length).toBe(35);
  expect(processCsv[0][0]).toBe("经销商名称");
  await page.screenshot({ path: "validation/pc-all-dealers-process-flat-1440x900-light.png", fullPage: false });

  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("返回分层查看");
  await expect(page.locator("#toggleAllDealersProcess")).toBeHidden();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).allDealerMode).toBe(true);
  await expect(page.locator("#ironFirstColumn")).toHaveText("经销商名称");
  await expect(page.locator("#ironMetricsRoot [data-organization-row]")).toHaveCount(15);
  await expect(page.locator("#ironMetricsRoot [data-organization-drill]")).toHaveCount(0);
  await expect(page.locator("#ironMetricsRoot [data-store-detail]")).toHaveCount(15);
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 1/3 页 · 每页 15 条");
  await page.locator("#ironPagination .pager-next").click();
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).allDealerMode).toBe(true);
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  const ironCsv = parseCsvRows(await captureIronCsv(page));
  expect(ironCsv.length).toBe(137);
  expect(ironCsv[0][2]).toBe("组织名称");
  expect(ironCsv[1][0]).toBe("dealer");
  expect(ironCsv.slice(1).map((row) => row[2])).toContain("扁平经销商34");
  expect(ironCsv.map((row) => row[4])).toContain("trial_record_upload_rate");
  expect(ironCsv.map((row) => row[4])).not.toContain("invite_trial_mention_rate");
  await page.screenshot({ path: "validation/pc-all-dealers-iron-flat-1440x900-light.png", fullPage: false });

  await page.locator("#salesTab").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商销售表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toHaveLength(34);

  await page.locator("#toggleAllDealersSales").click();
  const restoredSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(restoredSnapshot.viewLevel).toBe("area");
  expect(restoredSnapshot.drillPath).toEqual([]);
  expect(restoredSnapshot.allDealerMode).toBe(false);
  expect(restoredSnapshot.allDealerSnapshot).toBe(null);
  expect(restoredSnapshot.activeMetricGroup).toBe("invite");
  expect(restoredSnapshot.tablePages.iron).toBe(0);
  await expect(page.locator("#storeTableTitle")).toHaveText("大区销售表现");
  await expect(page.locator("#salesFirstColumn")).toHaveText("大区");
  await expect(page.locator('#diagnosisTableBody [data-row-level="area"]')).toHaveCount(2);

  await page.locator('#diagnosisTableBody [data-organization-row="A1"] [data-organization-drill]').click();
  await expect(page.locator("#storeTableTitle")).toHaveText("小区销售表现");
  await expect(page.locator(".organization-pc-scope")).toHaveText("大区1");
  await page.locator("#toggleAllDealersSales").click();
  expect(await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).toMatchObject({
    viewLevel: "district",
    allDealerMode: true
  });
  expect(await page.evaluate(() => window.__retailPcApp.getStateSnapshot().drillPath)).toEqual([{ level: "area", code: "A1", name: "大区1" }]);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toHaveLength(17);
  await expect(page.locator(".organization-pc-back")).toHaveCount(0);
  await page.locator("#organizationBreadcrumb").click();
  const frozenSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(frozenSnapshot.viewLevel).toBe("district");
  expect(frozenSnapshot.drillPath).toEqual([{ level: "area", code: "A1", name: "大区1" }]);
  await page.locator("#processTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleProcessStoreCodes).toHaveLength(17);
  await page.locator("#ironTab").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleIronCodes).toHaveLength(17);
  expect(await page.locator('#diagnosisTableBody [data-organization-row]').evaluateAll((rows) => rows.every((row) => row.textContent.includes("大区1")))).toBe(true);
  await page.locator("#salesTab").click();
  await page.locator("#toggleAllDealersSales").click();
  await page.locator('#diagnosisTableBody [data-organization-row="D1"] [data-organization-drill]').click();
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  const storeLayer = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(storeLayer.viewLevel).toBe("store");
  expect(storeLayer.drillPath).toEqual([{ level: "area", code: "A1", name: "大区1" }, { level: "district", code: "D1", name: "小区1" }]);
  expect(storeLayer.visibleStoreCodes).toHaveLength(7);
});

test("全部经销商扁平查看从非首页激活后退出精确恢复销售和过程页码", async ({ page }) => {
  const uniqueAreas = Object.fromEntries(Array.from({ length: 34 }, (_, index) => [index, {
    areaCode: `AX${index + 1}`,
    area: `大区${index + 1}`,
    districtCode: `DX${index + 1}`,
    district: `小区${index + 1}`
  }]));
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(34, { storeOverrides: uniqueAreas }));

  await page.locator("#processTab").click();
  await page.locator("#processPagination .pager-next").click();
  await expect(page.locator("#processPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator("#salesTab").click();
  await page.locator("#salesPagination .pager-next").click();
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");

  await page.locator("#toggleAllDealersSales").click();
  const flatSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(flatSnapshot.allDealerSnapshot.tablePages).toEqual({ sales: 1, process: 1, iron: 0 });
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 1/3 页 · 每页 15 条");

  await page.locator("#toggleAllDealersSales").click();
  const restored = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(restored.allDealerMode).toBe(false);
  expect(restored.tablePages.sales).toBe(1);
  expect(restored.tablePages.process).toBe(1);
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator("#processTab").click();
  await expect(page.locator("#processPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
});

test("打铁指标从非首页和试驾组进入扁平后退出恢复打铁快照", async ({ page }) => {
  const uniqueAreas = Object.fromEntries(Array.from({ length: 34 }, (_, index) => [index, {
    areaCode: `AX${index + 1}`,
    area: `大区${index + 1}`,
    districtCode: `DX${index + 1}`,
    district: `小区${index + 1}`
  }]));
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(34, { storeOverrides: uniqueAreas }));

  await page.locator("#salesPagination .pager-next").click();
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator("#processTab").click();
  await page.locator("#processPagination .pager-next").click();
  await expect(page.locator("#processPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await page.locator('[data-iron-group="trial"]').click();
  await page.locator("#ironPagination .pager-next").click();
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
  const entry = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(entry).toMatchObject({
    viewLevel: "area",
    drillPath: [],
    selectedStoreCode: "",
    activeMetricGroup: "trial",
    tablePages: { sales: 1, process: 1, iron: 1 }
  });

  await page.locator("#toggleAllDealersSales").click();
  let flat = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(flat.allDealerMode).toBe(true);
  expect(flat.effectiveIronLevel).toBe("store");
  expect(flat.activeMetricGroup).toBe("trial");
  expect(flat.selectedStoreCode).toBe("");
  expect(flat.tablePages).toEqual({ sales: 0, process: 0, iron: 0 });
  expect(flat.allDealerSnapshot).toMatchObject({
    viewLevel: "area",
    drillPath: [],
    selectedStoreCode: "",
    activeMetricGroup: "trial",
    tablePages: { sales: 1, process: 1, iron: 1 }
  });
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 1/3 页 · 每页 15 条");

  await page.locator("#ironPagination .pager-next").click();
  await page.locator('[data-iron-group="invite"]').click();
  await page.locator("#ironMetricsTableBody [data-organization-row]").nth(1).locator("td").nth(1).click();
  flat = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(flat.selectedStoreCode).toBe("F17");
  expect(flat.activeMetricGroup).toBe("invite");
  expect(flat.tablePages).toEqual({ sales: 1, process: 1, iron: 1 });
  expect(flat.allDealerSnapshot).toMatchObject({
    viewLevel: "area",
    drillPath: [],
    selectedStoreCode: "",
    activeMetricGroup: "trial",
    tablePages: { sales: 1, process: 1, iron: 1 }
  });

  await page.locator("#toggleAllDealersSales").click();
  const restored = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(restored.allDealerMode).toBe(false);
  expect(restored.allDealerSnapshot).toBe(null);
  expect(restored.viewLevel).toBe("area");
  expect(restored.drillPath).toEqual([]);
  expect(restored.selectedStoreCode).toBe("");
  expect(restored.tablePages).toEqual({ sales: 1, process: 1, iron: 1 });
  expect(restored.tablePages.iron).toBe(1);
  expect(restored.activeMetricGroup).toBe("trial");
  await expect(page.locator("#storeTableTitle")).toHaveText("大区打铁表现");
  await expect(page.locator('[data-iron-group="trial"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 34 条 · 当前展示 15 条 · 第 2/3 页 · 每页 15 条");
});

test("全部经销商入口按当前 drillPath 后有效门店数判断，当前范围仅1店时隐藏", async ({ page }) => {
  const storeOverrides = Object.fromEntries(Array.from({ length: 34 }, (_, index) => [index, index === 0
    ? { areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
    : { areaCode: "A2", area: "大区2", districtCode: `D${index + 1}`, district: `小区${index + 1}` }
  ]));
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(34, { storeOverrides }));
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();

  await page.locator('#diagnosisTableBody [data-organization-row="A1"] [data-organization-drill]').click();
  await expect(page.locator("#storeTableTitle")).toHaveText("小区销售表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toEqual([]);
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();

  await page.locator("#processTab").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("小区过程表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleProcessStoreCodes).toEqual([]);
  await expect(page.locator("#toggleAllDealersProcess")).toBeHidden();
});

test("已激活扁平模式后打铁禁用组织下钻且销售和过程仍可退出", async ({ page }) => {
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(34));
  await page.locator("#toggleAllDealersSales").click();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("返回分层查看");

  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("返回分层查看");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  await expect(page.locator("#ironMetricsRoot [data-organization-drill]")).toHaveCount(0);
  await expect(page.locator("#ironMetricsRoot [data-store-detail]")).toHaveCount(15);
  const ironFlatSnapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(ironFlatSnapshot.viewLevel).toBe("area");
  expect(ironFlatSnapshot.effectiveIronLevel).toBe("store");
  expect(ironFlatSnapshot.allDealerMode).toBe(true);
  expect(ironFlatSnapshot.visibleIronCodes).toHaveLength(34);

  await page.locator("#salesTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await expect(page.locator("#toggleAllDealersSales")).toHaveText("返回分层查看");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商销售表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toHaveLength(34);

  await page.locator("#processTab").click();
  await expect(page.locator("#toggleAllDealersProcess")).toBeVisible();
  await expect(page.locator("#toggleAllDealersProcess")).toHaveText("返回分层查看");
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商过程表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleProcessStoreCodes).toHaveLength(34);

  await page.locator("#toggleAllDealersProcess").click();
  const restored = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(restored.allDealerMode).toBe(false);
  expect(restored.allDealerSnapshot).toBe(null);
  expect(restored.viewLevel).toBe("area");
  expect(restored.drillPath).toEqual([]);
  await expect(page.locator("#storeTableTitle")).toHaveText("大区过程表现");
  await expect(page.locator("#toggleAllDealersProcess")).toBeVisible();
});

test("全部经销商扁平查看随 reload 清空并遵守权限白名单和五态隐藏", async ({ page }) => {
  const fixture = makeFlatDealerFixture(34);
  fixture.validDealers = fixture.validDealers.filter((dealer) => ["F01", "F03", "F18"].includes(dealer.code));
  await openFixture(page, profiles.headquarters, "", fixture);
  await page.locator("#toggleAllDealersSales").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).visibleStoreCodes).toEqual(["F01", "F03", "F18"]);
  const rows = parseCsvRows(await captureSalesCsv(page));
  expect(rows.slice(1).map((row) => row[0]).sort()).toEqual(["扁平经销商01", "扁平经销商03", "扁平经销商18"]);

  await page.evaluate(async () => {
    await window.__retailPcApp.reload();
  });
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.allDealerMode).toBe(false);
  expect(snapshot.viewLevel).toBe("area");
  await expect(page.locator("#storeTableTitle")).toHaveText("大区销售表现");

  await openFixture(page, profiles.district);
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await openFixture(page, profiles.unknown);
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await openFixture(page, profiles.district, "", { permissionDenied: true });
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await openFixture(page, profiles.district, "", { error: "fixture network failed" });
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(1));
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await page.evaluate(async () => {
    window.__retailPcFixture = { loading: true };
    await window.__retailPcApp.reload();
  });
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await expect(page.locator("#diagnosisTableBody")).toContainText("--");
  await openFixture(page, profiles.headquarters, "", {
    ...makeFlatDealerFixture(34),
    processErrors: { ip: { current: "fixture ip current failed", previous: "", week: "" }, drive: { current: "", previous: "", week: "" } }
  });
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await page.locator("#processTab").click();
  await expect(page.locator("#toggleAllDealersProcess")).toBeHidden();
  await expect(page.locator("#processListTableBody")).toContainText("数据不完整");
  await openFixture(page, profiles.headquarters, "", makeFixture({ stores: [], data: { stores: [], salesCurrent: {}, salesPrevious: {}, salesWeek: {}, ip: {}, ipPrev: {}, ipWeek: {}, driveTags: {}, driveTagsPrev: {}, driveTagsWeek: {} } }));
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await openFixture(page, profiles.headquarters, "", {
    ...makeFlatDealerFixture(34),
    ironRaw: {
      sourceStates: {
        inviteMention: { status: "incomplete", complete: false, error: "invite failed" },
        intentLevel: { status: "incomplete", complete: false, error: "intent failed" },
        dcc: { status: "incomplete", complete: false, error: "dcc failed" },
        qualityTrial: { status: "incomplete", complete: false, error: "quality failed" },
        trialRecord: { status: "incomplete", complete: false, error: "record failed" },
        trialTalk: { status: "incomplete", complete: false, error: "talk failed" }
      }
    }
  });
  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await expect(page.locator("#ironMetricsRoot")).toContainText("数据不完整");

  const inviteIncomplete = makeFlatDealerFixture(34);
  inviteIncomplete.ironRaw = {
    ...inviteIncomplete.ironRaw,
    sourceStates: {
      inviteMention: { status: "incomplete", complete: false, error: "invite failed" },
      intentLevel: { status: "incomplete", complete: false, error: "intent failed" },
      dcc: { status: "incomplete", complete: false, error: "dcc failed" },
      qualityTrial: { status: "success", complete: true },
      trialRecord: { status: "success", complete: true },
      trialTalk: { status: "success", complete: true }
    }
  };
  await openFixture(page, profiles.headquarters, "", inviteIncomplete);
  await page.locator("#ironTab").click();
  await expect(page.locator('[data-iron-group="invite"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();

  const trialIncomplete = makeFlatDealerFixture(34);
  trialIncomplete.ironRaw = {
    ...trialIncomplete.ironRaw,
    sourceStates: {
      inviteMention: { status: "success", complete: true },
      intentLevel: { status: "success", complete: true },
      dcc: { status: "success", complete: true },
      qualityTrial: { status: "incomplete", complete: false, error: "quality failed" },
      trialRecord: { status: "incomplete", complete: false, error: "record failed" },
      trialTalk: { status: "incomplete", complete: false, error: "talk failed" }
    }
  };
  await openFixture(page, profiles.headquarters, "", trialIncomplete);
  await page.locator("#ironTab").click();
  await expect(page.locator("#toggleAllDealersSales")).toBeVisible();
  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator("#toggleAllDealersSales")).toBeHidden();
});

test("打铁扁平分页超过7页时工具栏和跳页 aria 使用打铁指标文案", async ({ page }) => {
  await openFixture(page, profiles.headquarters, "", makeFlatDealerFixture(121));
  await page.locator("#toggleAllDealersSales").click();
  await page.locator("#ironTab").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  await expect(page.locator("#salesHeaderTools")).toHaveAttribute("aria-label", "打铁指标表工具");
  await expect(page.locator("#ironPagination [data-pagination-pager]")).toHaveAttribute("aria-label", "打铁指标分页");
  await expect(page.locator("#ironPagination input[type='number']")).toHaveAttribute("aria-label", "打铁指标跳转页码");
  await expect(page.locator("#ironPagination [data-pagination-info]")).toHaveText("共 121 条 · 当前展示 15 条 · 第 1/9 页 · 每页 15 条");

  await page.locator("#salesTab").click();
  await expect(page.locator("#salesHeaderTools")).toHaveAttribute("aria-label", "销售表工具");
});

for (const width of [1440, 1280, 900]) {
  for (const theme of ["light", "dark"]) {
    test(`全部经销商按钮 ${width}px ${theme} 响应式、明暗主题和键盘可访问`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openFixture(page, profiles.headquarters, `theme=${theme}`, makeFlatDealerFixture(34));
      const button = page.locator("#toggleAllDealersSales");
      await expect(button).toBeVisible();
      await button.focus();
      await expect(button).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(button).toHaveText("返回分层查看");
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商销售表现");
      expect(await button.evaluate((element) => {
        const exportBox = document.getElementById("exportSales")?.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        return {
          beforeExport: Boolean(exportBox && box.right <= exportBox.left + 1),
          notOverflowingText: element.scrollWidth <= element.clientWidth + 1,
          noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth,
          fontSize: styles.fontSize,
          background: styles.backgroundColor,
          color: styles.color
        };
      })).toEqual(expect.objectContaining({
        beforeExport: true,
        notOverflowingText: true,
        noPageOverflow: true,
        fontSize: width <= 900 ? "12px" : "13px"
      }));
      await page.locator("#ironTab").click();
      const ironButton = page.locator("#toggleAllDealersSales");
      await expect(ironButton).toBeVisible();
      await expect(ironButton).toHaveText("返回分层查看");
      await ironButton.focus();
      await expect(ironButton).toBeFocused();
      await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
      await expect(page.locator("#ironMetricsRoot")).not.toContainText("加载中");
      await expect(page.locator("#ironMetricsTableBody [data-organization-row]").first().locator(".metric-value").first()).toHaveText(/\d+(\.\d)?%/);
      expect(await ironButton.evaluate((element) => {
        const exportBox = document.getElementById("exportSales")?.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return {
          beforeExport: Boolean(exportBox && box.right <= exportBox.left + 1),
          notOverflowingText: element.scrollWidth <= element.clientWidth + 1,
          noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth
        };
      })).toEqual({ beforeExport: true, notOverflowingText: true, noPageOverflow: true });
      if (width === 1440) await page.screenshot({ path: `validation/pc-all-dealers-iron-flat-1440x900-${theme}.png`, fullPage: false });
    });
  }
}

test("大区全国、小区大区、门店小区三级排名与占比正确", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const area1 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" });
  const area2 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区2" });
  await expect(area1.locator(".rank-cell").first()).toContainText("1/2");
  await expect(area1.locator(".rank-cell").first()).toContainText("占比 57%");
  await expect(area2.locator(".rank-cell").first()).toContainText("2/2");
  await area1.locator("[data-organization-drill]").click();

  const district1 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区1" });
  const district2 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区2" });
  await expect(district1.locator(".rank-cell").first()).toContainText("1/2");
  await expect(district1.locator(".rank-cell").first()).toContainText("占比 70%");
  await expect(district2.locator(".rank-cell").first()).toContainText("2/2");
  await district1.locator("[data-organization-drill]").click();

  const store1 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "门店1" });
  const store2 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "门店2" });
  await expect(store1.locator(".rank-cell").first()).toContainText("1/2");
  await expect(store1.locator(".rank-cell").first()).toContainText("占比 50%");
  await expect(store2.locator(".rank-cell").first()).toContainText("2/2");
});

test("门店详情链接使用当前测试配置且保留品牌、大区、小区和经销商关键参数", async ({ page }) => {
  await openFixture(page, profiles.district, "regionCode=A1&districtCode=D1");
  const href = await page.locator('#diagnosisTableBody [data-organization-row="S1"] [data-store-detail]').getAttribute("href");
  const url = new URL(href, "http://localhost");
  const config = await page.evaluate(() => window.RetailRuntimeConfig.getConfig());
  expect(config.environment).toBe("test");
  expect(`${url.origin}${url.pathname}`).toBe(config.singleStoreAppUrl);
  expect(`${url.origin}${url.pathname}`).toBe("https://rdata-pv.rauto.com/open-apps/r8ce093b6d93143d8aa6852f/");
  expect(url.searchParams.get("regionCode")).toBe("A1");
  expect(url.searchParams.get("districtCode")).toBe("D1");
  expect(url.searchParams.get("dealerCode")).toBe("S1");
  expect(url.searchParams.get("brand")).toBe("MG");
});

test("权限 fixture 中组织下钻后的门店集合始终是有效经销商集合子集", async ({ page }) => {
  const fixture = makeFixture();
  fixture.validDealers = fixture.validDealers.filter((dealer) => ["S1", "S3"].includes(dealer.code));
  await openFixture(page, profiles.headquarters, "", fixture);
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" }).locator("[data-organization-drill]").click();
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.visibleStoreCodes).toEqual(["S1"]);
  expect(snapshot.visibleStoreCodes.every((code) => ["S1", "S3"].includes(code))).toBe(true);
});

test("角色异常、无权限、0行和请求失败四态文案不混淆", async ({ page }) => {
  await openFixture(page, profiles.unknown);
  await expect(page.locator("#funnelGrid")).toContainText("角色识别异常");
  await openFixture(page, profiles.district, "", { permissionDenied: true });
  await expect(page.locator("#funnelGrid")).toContainText("无权限");
  await openFixture(page, profiles.district, "", makeFixture({ stores: [], data: { stores: [], salesCurrent: {}, salesPrevious: {}, salesWeek: {}, ip: {}, ipPrev: {}, ipWeek: {}, driveTags: {}, driveTagsPrev: {}, driveTagsWeek: {} } }));
  await expect(page.locator("#funnelGrid")).toContainText("暂无销售指标数据");
  await openFixture(page, profiles.district, "", { error: "fixture network failed" });
  await expect(page.locator("#funnelGrid")).toContainText("真实数据读取失败");
});

test("请求失败文案按纯文本渲染且不能执行 DOM XSS", async ({ page }) => {
  const payload = '<img id="xss-probe" src="x" onerror="window.__xssProbe=1">';
  await openFixture(page, profiles.district, "", { error: payload });

  await expect(page.locator("#funnelGrid")).toContainText(`真实数据读取失败：${payload}`);
  await expect(page.locator("#funnelGrid #xss-probe")).toHaveCount(0);
  expect(await page.evaluate(() => window.__xssProbe)).toBeUndefined();
});

function monthlyTargetFixture(status = "configured") {
  const metric = (state, fields = {}) => ({ status: state, error: "", target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0, ...fields });
  const dual = (state, order = {}, retail = {}, extra = {}) => {
    const orderTarget = metric(state, order);
    const retailTarget = metric(state, retail);
    return {
      status: state,
      error: orderTarget.error || retailTarget.error || "",
      order: orderTarget,
      retail: retailTarget,
      target: orderTarget.target,
      actual: orderTarget.actual,
      achievement: orderTarget.achievement,
      unconfiguredActual: orderTarget.unconfiguredActual,
      conflictKeys: orderTarget.conflictKeys + retailTarget.conflictKeys,
      hasTarget: orderTarget.hasTarget || retailTarget.hasTarget,
      validDealerMissingRows: Math.max(orderTarget.validDealerMissingRows || 0, retailTarget.validDealerMissingRows || 0),
      ...extra
    };
  };
  if (status === "unavailable") {
    return makeFixture({
      stores: storesFor().map((store) => ({ ...store, monthlyTarget: dual("unavailable", { error: "403" }, { error: "403" }, { error: "403" }) }))
    });
  }
  if (status === "loading") {
    const target = dual("loading", { status: "loading" }, { status: "loading" });
    const fixture = makeFixture({
      stores: storesFor().map((store) => ({ ...store, monthlyTarget: { ...target } }))
    });
    return { ...fixture, data: { ...fixture.data, monthlyTarget: { ...target } } };
  }
  if (status === "invalid_range") {
    const target = dual("invalid_range");
    const fixture = makeFixture({
      stores: storesFor().map((store) => ({ ...store, monthlyTarget: { ...target } }))
    });
    return { ...fixture, data: { ...fixture.data, monthlyTarget: { ...target } } };
  }
  return makeFixture({
    stores: storesFor().map((store) => {
      if (store.code === "S1") return { ...store, monthlyTarget: dual("configured", { hasTarget: true, target: 10, actual: 12, achievement: 120, unconfiguredActual: 2, conflictKeys: 1, validDealerMissingRows: 5 }, { hasTarget: true, target: 8, actual: 4, achievement: 50, unconfiguredActual: 1, conflictKeys: 1, validDealerMissingRows: 5 }) };
      if (store.code === "S2") return { ...store, monthlyTarget: dual("configured", { hasTarget: true, target: 0, actual: 0, achievement: null }, { hasTarget: true, target: 0, actual: 0, achievement: null }) };
      if (store.code === "S4") return { ...store, monthlyTarget: dual("configured", { hasTarget: true, target: 15, actual: 0, achievement: 0 }, { hasTarget: true, target: 12, actual: 0, achievement: 0 }) };
      return store;
    })
  });
}

function asyncTargetDealers() {
  return [
    { code: "S1", name: "门店1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
    { code: "S2", name: "门店2", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
  ];
}

function asyncTargetRawRows(dealers = asyncTargetDealers()) {
  const row = (dealer, orders, retail) => ({
    "经销商代码": dealer.code,
    "经销商名称": dealer.name,
    "大区名称": dealer.area,
    "小区名称": dealer.district,
    "当日下发线索数": orders * 10,
    "当日首触客流数": orders * 4,
    "当日首触试驾数": orders * 2,
    "当日订单数（首触）": orders,
    "当日零售数": retail
  });
  return {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
    weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
    sales: [row(dealers[0], 9, 4), row(dealers[1], 6, 2)],
    salesPrev: [row(dealers[0], 4, 2), row(dealers[1], 3, 1)],
    salesWeek: [row(dealers[0], 5, 2), row(dealers[1], 4, 1)],
    monthlyTarget: { status: "loading", targets: [], targetActuals: [], audit: {}, months: ["2026-07-01"] },
    scopeEvidence: { source: "async-target-test", complete: true, hitLimit: false }
  };
}

function asyncTargetReadyRaw(dealerCode = "S1", orderTarget = 20, retailTarget = 10) {
  return {
    status: "ready",
    months: ["2026-07-01"],
    audit: {},
    targets: [{
      key: `2026-07-01\u0000MG\u0000${dealerCode}\u0000全新MG4`,
      month: "2026-07-01",
      brand: "MG",
      dealerCode,
      vehicleSeries: "全新MG4",
      orderHasTarget: true,
      orderTarget,
      retailHasTarget: true,
      retailTarget
    }],
    targetActuals: [{ month: "2026-07-01", brand: "MG", dealerCode, vehicleSeries: "全新MG4", actualOrders: 10, actualRetail: 5 }]
  };
}

async function openAsyncTargetPage(page, { rejectTarget = false, slowDiagnosisUniverse = false, fastTarget = false, query = "" } = {}) {
  const dealers = asyncTargetDealers();
  await page.addInitScript(({ dealerRows, rawRows, rejectTargetValue, slowDiagnosisUniverseValue, fastTargetValue, fastTargetRaw }) => {
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        const loadSalesRaw = async (params, options = {}) => {
          window.__salesRawOptions = [...(window.__salesRawOptions || []), options];
          return rawRows;
        };
        loadSalesRaw.supportsMonthlyTargetOptions = true;
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4"],
          loadSalesRaw,
          loadMonthlyTargetRaw: (params) => {
            window.__targetRequests = [...(window.__targetRequests || []), { params: { ...params } }];
            if (fastTargetValue) return Promise.resolve(fastTargetRaw);
            return new Promise((resolve, reject) => {
              window.__resolveMonthlyTarget = (payload) => resolve(payload);
              window.__rejectMonthlyTarget = (message = "目标模拟失败") => reject(new Error(message));
              if (rejectTargetValue) reject(new Error("目标模拟失败"));
            });
          },
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            const empty = { total: 0, negative: 0, rate: null, problems: [] };
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: empty, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: empty, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false } }),
          loadValidDealers: async () => {
            window.__diagnosisUniverseRequested = true;
            if (slowDiagnosisUniverseValue) return new Promise(() => {});
            return dealerRows;
          }
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部" }));
  }, { dealerRows: dealers, rawRows: asyncTargetRawRows(dealers), rejectTargetValue: rejectTarget, slowDiagnosisUniverseValue: slowDiagnosisUniverse, fastTargetValue: fastTarget, fastTargetRaw: asyncTargetReadyRaw() });
  await page.goto(`/${query ? `?${query}` : ""}`);
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("15", { timeout: 10_000 });
  return dealers;
}

async function openTargetHeaderState(page, stateName, theme) {
  if (stateName === "success") {
    await openFixture(page, profiles.headquarters, `theme=${theme}`, monthlyTargetFixture());
    return;
  }
  if (stateName === "hidden") {
    await openFixture(page, profiles.headquarters, `theme=${theme}`);
    return;
  }
  if (stateName === "loading") {
    await openFixture(page, profiles.headquarters, `theme=${theme}`, monthlyTargetFixture("loading"));
    return;
  }
  if (stateName === "error") {
    await openFixture(page, profiles.headquarters, `theme=${theme}`, monthlyTargetFixture("unavailable"));
    await expect(page.locator(".funnel-overview-header > .sales-target-summary.error")).toContainText("月目标数据暂不可用");
  }
}

async function assertTargetHeaderMatrixLayout(page, { stateName, theme, expectedHeaderHeight }) {
  const headerSummary = page.locator(".funnel-overview-header > .sales-target-summary");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator(".metric-panel .panel-head .sales-target-summary")).toHaveCount(0);

  if (stateName === "hidden") {
    await expect(headerSummary).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("时间进度");
  } else if (stateName === "loading") {
    await expect(headerSummary).toHaveCount(1);
    await expect(headerSummary).toHaveAttribute("role", "status");
    await expect(headerSummary).toHaveAttribute("aria-live", "polite");
    await expect(headerSummary).toHaveAttribute("aria-label", "月目标加载中");
    await expect(headerSummary.locator("span")).toHaveCount(5);
    expect(await headerSummary.locator("span").evaluateAll((nodes) => nodes.every((node) => node.getAttribute("aria-hidden") === "true"))).toBe(true);
  } else if (stateName === "error") {
    await expect(headerSummary).toHaveText("月目标数据暂不可用");
    await expect(headerSummary).not.toContainText("时间进度");
  } else {
    await expect(headerSummary).toContainText("订单目标：25");
    await expect(headerSummary).toContainText("订单达成：48.0%");
    await expect(headerSummary).toContainText("零售目标：20");
    await expect(headerSummary).toContainText("零售达成：20.0%");
    await expect(headerSummary).toContainText("时间进度：74.2%");
  }

  const snapshot = await page.evaluate((targetState) => {
    const header = document.querySelector(".funnel-overview-header");
    const title = header.querySelector("h2");
    const summary = header.querySelector(".sales-target-summary");
    const filter = header.querySelector("#vehicleSeriesFilter");
    const panels = document.querySelector(".funnel-overview-panels");
    const sales = document.querySelector(".sales-panel");
    const process = document.querySelector(".process-panel");
    const salesCards = Array.from(document.querySelectorAll(".sales-panel .funnel-kpi-card")).map((node) => node.getBoundingClientRect());
    const processCards = Array.from(document.querySelectorAll(".process-panel .funnel-kpi-card")).map((node) => node.getBoundingClientRect());
    const titleBox = title.getBoundingClientRect();
    const filterBox = filter.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const panelsBox = panels.getBoundingClientRect();
    const salesBox = sales.getBoundingClientRect();
    const processBox = process.getBoundingClientRect();
    const summaryBox = summary?.getBoundingClientRect();
    const verticalOverlap = (a, b) => a.bottom >= b.top && b.bottom >= a.top;
    return {
      stateName: targetState,
      pageNoOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      salesTabNoOverflow: document.querySelector("#salesTabPanel").scrollWidth <= document.querySelector("#salesTabPanel").clientWidth + 1,
      headerHeight: Math.round(headerBox.height),
      headerOrder: Array.from(header.children).map((child) => child.classList?.contains("sales-target-summary") ? "sales-target-summary" : child.id || child.className || child.tagName),
      headerNoHorizontalScroll: header.scrollWidth <= header.clientWidth + 1,
      panelsBelowHeader: panelsBox.top >= headerBox.bottom - 1,
      titleReadable: titleBox.width > 55 && titleBox.height > 0,
      filterInsideHeaderRight: Math.abs(headerBox.right - filterBox.right) < 1,
      filterUsable: filterBox.width >= 176 && filterBox.height === 36,
      titleFilterSameLine: verticalOverlap(titleBox, filterBox),
      summaryState: summary ? {
        text: summary.textContent.replace(/\s+/g, ""),
        order: Array.from(header.children).indexOf(summary),
        beforePanels: (summary.compareDocumentPosition(panels) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        flexWrap: getComputedStyle(summary).flexWrap,
        fits: summary.scrollWidth <= summary.clientWidth + 1,
        noWrapItems: Array.from(summary.children).every((child) => child.scrollWidth <= child.clientWidth + 1 && verticalOverlap(child.getBoundingClientRect(), summaryBox)),
        titleBeforeSummary: titleBox.right <= summaryBox.left + 1,
        summaryBeforeFilter: summaryBox.right <= filterBox.left + 1,
        sameLine: verticalOverlap(titleBox, summaryBox) && verticalOverlap(summaryBox, filterBox),
        borderWidth: getComputedStyle(summary).borderTopWidth,
        background: getComputedStyle(summary).backgroundImage === "none" ? getComputedStyle(summary).backgroundColor : getComputedStyle(summary).backgroundImage,
        boxShadow: getComputedStyle(summary).boxShadow
      } : null,
      hiddenNoSummarySlot: !summary && header.children.length === 2 && titleBox.right <= filterBox.left + 1,
      salesTop: Math.round(salesBox.top),
      processTop: Math.round(processBox.top),
      salesHeight: Math.round(salesBox.height),
      processHeight: Math.round(processBox.height),
      salesLeft: Math.round(salesBox.left),
      processLeft: Math.round(processBox.left),
      firstCardTop: Math.round(salesCards[0].top),
      processFirstCardTop: Math.round(processCards[0].top),
      firstCardBottom: Math.round(salesCards[0].bottom),
      processFirstCardBottom: Math.round(processCards[0].bottom)
    };
  }, stateName);

  expect(snapshot).toEqual(expect.objectContaining({
    stateName,
    pageNoOverflow: true,
    salesTabNoOverflow: true,
    headerNoHorizontalScroll: true,
    panelsBelowHeader: true,
    titleReadable: true,
    filterInsideHeaderRight: true,
    filterUsable: true,
    titleFilterSameLine: true
  }));
  if (expectedHeaderHeight != null) expect(snapshot.headerHeight).toBe(expectedHeaderHeight);
  if (stateName === "hidden") {
    expect(snapshot.headerOrder).toEqual(["H2", "vehicleSeriesFilter"]);
    expect(snapshot.hiddenNoSummarySlot).toBe(true);
  } else {
    expect(snapshot.headerOrder).toEqual(["H2", "sales-target-summary", "vehicleSeriesFilter"]);
    expect(snapshot.summaryState).toEqual(expect.objectContaining({
      order: 1,
      beforePanels: true,
      flexWrap: "nowrap",
      fits: true,
      noWrapItems: true,
      titleBeforeSummary: true,
      summaryBeforeFilter: true,
      sameLine: true,
      borderWidth: "0px",
      background: "rgba(0, 0, 0, 0)",
      boxShadow: "none"
    }));
  }
  expect(snapshot.processLeft).toBeGreaterThan(snapshot.salesLeft);
  expect(snapshot.salesTop).toBe(snapshot.processTop);
  expect(Math.abs(snapshot.salesHeight - snapshot.processHeight)).toBeLessThanOrEqual(1);
  expect(snapshot.firstCardTop).toBe(snapshot.processFirstCardTop);
  expect(Math.abs(snapshot.firstCardBottom - snapshot.processFirstCardBottom)).toBeLessThanOrEqual(1);
  await page.locator("#vehicleSeriesTrigger").click();
  await expect(page.locator("#vehicleSeriesMenu")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
  return snapshot.headerHeight;
}

test("首屏销售不等待月目标 pending，目标 resolve 后只局部回填目标槽", async ({ page }) => {
  await openAsyncTargetPage(page);
  await expect(page.locator("#diagnosisTableBody [data-organization-row]").first()).toBeVisible();
  await expect(page.locator(".funnel-overview-header > .sales-target-summary.loading")).toHaveCount(1);
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator(".rank-target")).toHaveCount(0);
  await expect(page.locator(".order-rank-cell .rank-target-loading").first()).toBeVisible();
  await expect(page.locator(".order-rank-cell .rank-target-loading").first()).toHaveAttribute("aria-label", "月目标加载中");
  await expect(page.locator(".order-rank-cell .rank-combo").first()).toContainText("排名");
  await expect(page.locator(".order-rank-cell .rank-sub").first()).toContainText("占比");
  const before = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(before).toMatchObject({
    monthlyTargetStatus: "loading",
    tablePages: { sales: 0, process: 0, iron: 0 },
    activeStoreTab: "sales",
    allDealerMode: false
  });
  expect(await page.evaluate(() => window.__salesRawOptions.every((options) => options.includeMonthlyTarget === false))).toBe(true);

  await page.evaluate((target) => window.__resolveMonthlyTarget(target), asyncTargetReadyRaw());
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("订单目标：20");
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("零售目标：10");
  await expect(page.locator(".order-rank-cell .rank-target").first()).toContainText("月目标");
  const after = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(after).toMatchObject({
    monthlyTargetStatus: "configured",
    monthlyTargetOrderTarget: 20,
    monthlyTargetRetailTarget: 10,
    tablePages: before.tablePages,
    activeStoreTab: before.activeStoreTab,
    allDealerMode: before.allDealerMode,
    selectedStoreCode: before.selectedStoreCode,
    drillPath: before.drillPath
  });
});

test("目标 fast-path 先于销售返回时会暂存并在首屏合并", async ({ page }) => {
  await openAsyncTargetPage(page, { fastTarget: true });
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("订单目标：20");
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.monthlyTargetStatus).toBe("configured");
  expect(snapshot.monthlyTargetOrderTarget).toBe(20);
});

test("目标回填不重置非默认过程 Tab 状态", async ({ page }) => {
  await openAsyncTargetPage(page);
  await page.locator("#processTab").click();
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).activeStoreTab).toBe("process");
  await page.evaluate((target) => window.__resolveMonthlyTarget(target), asyncTargetReadyRaw());
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("订单目标：20");
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.activeStoreTab).toBe("process");
  expect(snapshot.monthlyTargetOrderTarget).toBe(20);
});

test("dealerScoped 诊断 universe 慢请求不阻塞首屏销售和可见目标骨架", async ({ page }) => {
  await openAsyncTargetPage(page, { slowDiagnosisUniverse: true, query: "dealerCode=S1&districtCode=D1" });
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("15");
  await expect(page.locator("#diagnosisTableBody [data-organization-row]").first()).toBeVisible();
  await expect(page.locator(".order-rank-cell .rank-target-loading").first()).toBeVisible();
  await expect(page.locator(".order-rank-cell .rank-combo").first()).toContainText("排名");
  await expect(page.locator(".order-rank-cell .rank-sub").first()).toContainText("占比");
  expect(await page.evaluate(() => window.__diagnosisUniverseRequested === true)).toBe(true);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).monthlyTargetStatus).toBe("loading");
});

test("月目标 reject 只降级目标区，不清空销售和过程主数据", async ({ page }) => {
  await openAsyncTargetPage(page);
  await page.evaluate(() => window.__rejectMonthlyTarget("目标接口 403"));
  await expect(page.locator(".funnel-overview-header > .sales-target-summary.error")).toContainText("月目标数据暂不可用");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("15");
  await expect(page.locator(".process-panel .funnel-kpi-card").first()).toContainText("40.0%");
  await expect(page.locator("#diagnosisTableBody [data-organization-row]").first()).toBeVisible();
  await expect(page.locator(".rank-target-error").first()).toContainText("月目标数据暂不可用");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).monthlyTargetStatus).toBe("unavailable");
});

test("筛选切换后旧月目标响应不回写新筛选上下文", async ({ page }) => {
  const dealers = asyncTargetDealers();
  await page.addInitScript(({ dealerRows, rawRows }) => {
    let targetCall = 0;
    let regionDataApi;
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        const loadSalesRaw = async (_params, options = {}) => {
          window.__salesRawOptions = [...(window.__salesRawOptions || []), options];
          return rawRows;
        };
        loadSalesRaw.supportsMonthlyTargetOptions = true;
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: async () => ["全新MG4"],
          loadSalesRaw,
          loadMonthlyTargetRaw: () => new Promise((resolve) => {
            targetCall += 1;
            if (targetCall === 1) window.__resolveOldMonthlyTarget = resolve;
            else window.__resolveNewMonthlyTarget = resolve;
          }),
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
            const empty = { total: 0, negative: 0, rate: null, problems: [] };
            return kind === "ip"
              ? { [`ipAgg${suffix}`]: empty, [`ipAggStores${suffix}`]: [] }
              : { [`driveTagAgg${suffix}`]: empty, [`driveTagAggStores${suffix}`]: [] };
          }
        };
      }
    });
    let regionFilterApi;
    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => regionFilterApi,
      set: (value) => {
        regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => ({ dealers: dealerRows, evidence: { sourceDsId: "test-dealers", complete: true, hitLimit: false } }),
          loadValidDealers: async () => dealerRows
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" }));
  }, { dealerRows: dealers, rawRows: asyncTargetRawRows(dealers) });
  await page.goto("/");
  await expect(page.locator(".sales-panel .funnel-kpi-card").first()).toContainText("15", { timeout: 10_000 });
  await page.evaluate(() => window.__retailPcApp.reload());
  await expect.poll(() => page.evaluate(() => typeof window.__resolveNewMonthlyTarget)).toBe("function");

  await page.evaluate((target) => window.__resolveOldMonthlyTarget(target), asyncTargetReadyRaw("S1", 99, 88));
  await expect(page.locator(".funnel-overview-header > .sales-target-summary.loading")).toHaveCount(1);
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).monthlyTargetStatus).toBe("loading");

  await page.evaluate((target) => window.__resolveNewMonthlyTarget(target), asyncTargetReadyRaw("S1", 20, 10));
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("订单目标：20");
  const snapshot = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
  expect(snapshot.monthlyTargetOrderTarget).toBe(20);
  expect(snapshot.monthlyTargetRetailTarget).toBe(10);
});

test("PC 目标摘要 loading 骨架位于销售总览标题行中间，且七张卡不泄漏目标语义", async ({ page }) => {
  await page.addInitScript((profileValue) => {
    let regionDataApi;
    const pendingVehicleSeries = new Promise(() => {});
    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => regionDataApi,
      set: (value) => {
        regionDataApi = {
          ...value,
          loadVehicleSeriesOptions: () => pendingVehicleSeries
        };
      }
    });
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
  }, profiles.headquarters);
  await page.goto("/");

  const summary = page.locator(".funnel-overview-header > .sales-target-summary.loading");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute("role", "status");
  await expect(summary).toHaveAttribute("aria-live", "polite");
  await expect(summary).toHaveAttribute("aria-label", "月目标加载中");
  await expect(summary.locator("span")).toHaveCount(5);
  expect(await summary.locator("span").evaluateAll((nodes) => nodes.every((node) => node.getAttribute("aria-hidden") === "true"))).toBe(true);
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  expect(await summary.evaluate((node) => {
    const panels = document.querySelector(".funnel-overview-panels");
    const header = document.querySelector(".funnel-overview-header");
    const [first, second] = Array.from(node.querySelectorAll("span"));
    const nodeStyle = getComputedStyle(node);
    const firstStyle = getComputedStyle(first);
    const secondStyle = getComputedStyle(second);
    return {
      isSalesPanel: node.closest(".sales-panel") !== null,
      parentClass: node.parentElement?.className,
      isHeaderChild: node.parentElement === header,
      beforePanels: (node.compareDocumentPosition(panels) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      display: nodeStyle.display,
      flexWrap: nodeStyle.flexWrap,
      first: { width: firstStyle.width, height: firstStyle.height, backgroundImage: firstStyle.backgroundImage },
      second: { width: secondStyle.width, height: secondStyle.height, backgroundImage: secondStyle.backgroundImage }
    };
  })).toEqual({
    isSalesPanel: false,
    parentClass: "funnel-overview-header",
    isHeaderChild: true,
    beforePanels: true,
    display: "flex",
    flexWrap: "nowrap",
    first: { width: "76px", height: "12px", backgroundImage: expect.stringContaining("linear-gradient") },
    second: { width: "68px", height: "12px", backgroundImage: expect.stringContaining("linear-gradient") }
  });
  const cards = page.locator(".funnel-kpi-card");
  await expect(cards).toHaveCount(7);
  expect(await cards.evaluateAll((nodes) => nodes.every((node) => {
    const text = node.textContent || "";
    return !["月目标", "目标达成", "订单目标", "达成率", "月目标数据暂不可用"].some((term) => text.includes(term));
  }))).toBe(true);
});

test("PC 标题行目标摘要按固定顺序展示目标、达成和时间进度，且不读取筛选 endDate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRuntimeDate(page, "2026-07-23T10:00:00+08:00");
  await openFixture(page, profiles.headquarters, "endDate=2026-07-05", monthlyTargetFixture());
  const summary = page.locator(".funnel-overview-header > .sales-target-summary");
  await expect(summary).toContainText("订单目标：25");
  await expect(summary).toContainText("订单达成：48.0%");
  await expect(summary).toContainText("零售目标：20");
  await expect(summary).toContainText("零售达成：20.0%");
  await expect(summary).toContainText("时间进度：74.2%");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator(".metric-panel .panel-head .sales-target-summary")).toHaveCount(0);
  await expect(page.locator(".sales-panel .panel-head")).toHaveText("销售指标");
  await expect(page.locator(".process-panel .panel-head")).toHaveText("过程指标");
  expect(await summary.locator(".summary-label").allTextContents()).toEqual(["订单目标：", "订单达成：", "零售目标：", "零售达成：", "时间进度："]);
  expect(await summary.evaluate((node) => {
    const label = node.querySelector(".summary-label");
    const targetValue = node.querySelector(".target-value");
    const achievementValue = node.querySelector(".achievement-value");
    const retailTargetValue = node.querySelector(".retail-target-value");
    const timeProgressValue = node.querySelector(".time-progress-value");
    const panels = document.querySelector(".funnel-overview-panels");
    const header = document.querySelector(".funnel-overview-header");
    const title = header.querySelector("h2");
    const filter = header.querySelector("#vehicleSeriesFilter");
    const labelStyle = getComputedStyle(label);
    const targetStyle = getComputedStyle(targetValue);
    const achievementStyle = getComputedStyle(achievementValue);
    const timeStyle = getComputedStyle(timeProgressValue);
    const nodeStyle = getComputedStyle(node);
    return {
      text: node.textContent.replace(/\s+/g, ""),
      beforePanels: (node.compareDocumentPosition(panels) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      isHeaderChild: node.parentElement === header,
      headerOrder: Array.from(header.children).map((child) => child.id || child.className || child.tagName),
      titleBeforeSummary: (title.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      summaryBeforeFilter: (node.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      display: nodeStyle.display,
      flexWrap: nodeStyle.flexWrap,
      labelFontSize: labelStyle.fontSize,
      labelFontWeight: labelStyle.fontWeight,
      targetFontSize: targetStyle.fontSize,
      targetFontWeight: targetStyle.fontWeight,
      targetColor: targetStyle.color,
      achievementColor: achievementStyle.color,
      retailTargetColor: getComputedStyle(retailTargetValue).color,
      timeProgressColor: timeStyle.color,
      borderWidth: nodeStyle.borderTopWidth,
      background: nodeStyle.backgroundImage === "none" ? nodeStyle.backgroundColor : nodeStyle.backgroundImage,
      boxShadow: nodeStyle.boxShadow
    };
  })).toEqual(expect.objectContaining({
    text: "订单目标：25订单达成：48.0%零售目标：20零售达成：20.0%时间进度：74.2%",
    beforePanels: true,
    isHeaderChild: true,
    headerOrder: ["H2", "sales-target-summary", "vehicleSeriesFilter"],
    titleBeforeSummary: true,
    summaryBeforeFilter: true,
    display: "flex",
    flexWrap: "nowrap",
    labelFontSize: "12px",
    labelFontWeight: "500",
    targetFontSize: "13px",
    targetFontWeight: "700",
    targetColor: "rgb(36, 81, 199)",
    achievementColor: "rgb(4, 120, 87)",
    retailTargetColor: "rgb(36, 81, 199)",
    timeProgressColor: "rgb(88, 112, 141)",
    borderWidth: "0px",
    background: "rgba(0, 0, 0, 0)",
    boxShadow: "none"
  }));
  const orderCard = page.locator(".sales-panel .funnel-kpi-card").first();
  await expect(orderCard).not.toContainText("月目标");
  await expect(orderCard).not.toContainText("目标达成");
  await expect(orderCard).not.toContainText("订单目标");
  await expect(orderCard).not.toContainText("达成率");
  expect(await page.locator(".funnel-kpi-card").evaluateAll((cards) => cards.every((card) => {
    const text = card.textContent;
    return !text.includes("月目标") && !text.includes("目标达成") && !text.includes("订单目标") && !text.includes("达成率");
  }))).toBe(true);
  await expect(page.locator("body")).not.toContainText("覆盖达成");
  await expect(page.locator("body")).not.toContainText("目标覆盖不足");

  expect(await gridSlots(orderCard.locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);
  expect(await gridSlots(page.locator(".sales-panel .funnel-kpi-card").nth(1).locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);
  expect(await gridSlots(page.locator(".process-panel .funnel-kpi-card").first().locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);

  const area1 = page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "大区1" });
  await expect(area1.locator(".order-rank-cell")).toContainText("月目标");
  await expect(area1.locator(".order-rank-cell")).toContainText("10");
  await expect(area1.locator(".order-rank-cell")).toContainText("120.0%");
  expect(await gridSlots(area1.locator(".order-rank-cell .rank-grid"))).toEqual([
    expect.objectContaining({ index: 0, text: "月目标10" }),
    expect.objectContaining({ index: 1, text: "目标达成120.0%" }),
    expect.objectContaining({ index: 2, text: expect.stringMatching(/^排名\d+\/\d+$/) }),
    expect.objectContaining({ index: 3, text: expect.stringMatching(/^占比 \d+%$/) })
  ]);
  expect(await gridSlots(area1.locator(".retail-rank-cell .rank-grid"))).toEqual([
    expect.objectContaining({ index: 0, text: "月目标8" }),
    expect.objectContaining({ index: 1, text: "目标达成50.0%" }),
    expect.objectContaining({ index: 2, text: expect.stringMatching(/^排名\d+\/\d+$/) }),
    expect.objectContaining({ index: 3, text: expect.stringMatching(/^占比 \d+%$/) })
  ]);
  await expect(area1.locator(".order-rank-cell .rank-label").first()).toHaveText("排名");
  await expect(area1.locator(".retail-rank-cell .rank-label").first()).toHaveText("排名");
  expect((await area1.locator(".rank-cell").allTextContents()).join(" ")).not.toMatch(/全国排名|大区排名|小区排名/);
  await area1.locator("[data-organization-drill]").click();
  await page.locator("#diagnosisTableBody [data-organization-row]", { hasText: "小区1" }).locator("[data-organization-drill]").click();
  const store2 = page.locator('#diagnosisTableBody [data-organization-row="S2"] .order-rank-cell');
  await expect(store2).toContainText("月目标");
  await expect(store2).toContainText("0");
  await expect(store2).not.toContainText("0.0%");

  const headers = parseCsvRows(await captureSalesCsv(page))[0].join(",");
  expect(headers).toContain("订单月目标");
  expect(headers).toContain("订单目标口径实际");
  expect(headers).toContain("订单目标达成率");
  expect(headers).toContain("订单目标状态");
  expect(headers).toContain("未配置订单目标实际");
  expect(headers).toContain("订单目标冲突键数");
  expect(headers).toContain("零售月目标");
  expect(headers).toContain("零售目标口径实际");
  expect(headers).toContain("目标有效门店缺口数");
});

test("销售导出区分配置0、未产出和冲突的目标字段值", async ({ page }) => {
  await openFixture(page, profiles.district, "", monthlyTargetFixture());
  const rows = parseCsvRows(await captureSalesCsv(page));
  const header = rows[0];
  const byName = new Map(rows.slice(1).map((row) => [row[0], Object.fromEntries(header.map((name, index) => [name, row[index] || ""]))]));

  expect(byName.get("门店2")["订单月目标"]).toBe("0");
  expect(byName.get("门店2")["订单目标口径实际"]).toBe("0");
  expect(byName.get("门店2")["订单目标达成率"]).toBe("");
  expect(byName.get("门店2")["订单目标状态"]).toBe("已配置");
  expect(byName.get("门店2")["零售月目标"]).toBe("0");

  expect(byName.get("门店3")["订单月目标"]).toBe("");
  expect(byName.get("门店3")["订单目标口径实际"]).toBe("");
  expect(byName.get("门店3")["订单目标达成率"]).toBe("");
  expect(byName.get("门店3")["订单目标状态"]).toBe("目标未产出");

  expect(byName.get("门店1")["订单月目标"]).toBe("");
  expect(byName.get("门店1")["订单目标口径实际"]).toBe("");
  expect(byName.get("门店1")["订单目标达成率"]).toBe("");
  expect(byName.get("门店1")["订单目标状态"]).toBe("目标冲突");
  expect(byName.get("门店1")["未配置订单目标实际"]).toBe("2");
  expect(byName.get("门店1")["订单目标冲突键数"]).toBe("1");
  expect(byName.get("门店1")["零售目标状态"]).toBe("目标冲突");
  expect(byName.get("门店1")["目标有效门店缺口数"]).toBe("5");
});

test("PC 时间进度按运行时自然月月初和月末边界计算", async ({ page }) => {
  await mockRuntimeDate(page, "2026-02-28T10:00:00+08:00");
  await openFixture(page, profiles.headquarters, "endDate=2026-02-01", monthlyTargetFixture());
  const summary = page.locator(".funnel-overview-header > .sales-target-summary");
  await expect(summary).toContainText("时间进度：100.0%");
  await expect(summary).toContainText("订单目标：25");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
});

test("PC 时间进度月初按 1 除以当月天数展示", async ({ page }) => {
  await mockRuntimeDate(page, "2026-07-01T10:00:00+08:00");
  await openFixture(page, profiles.headquarters, "endDate=2026-07-31", monthlyTargetFixture());
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toContainText("时间进度：3.2%");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
});

test("PC 无目标隐藏目标内容，目标请求失败只降级目标区且销售可用", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("时间进度");
  const noTargetOrderCard = page.locator(".sales-panel .funnel-kpi-card").first();
  await expect(noTargetOrderCard).not.toContainText("月目标");
  await expect(noTargetOrderCard).not.toContainText("目标达成");
  await expect(noTargetOrderCard).not.toContainText("订单目标");
  await expect(noTargetOrderCard).not.toContainText("达成率");
  expect(await gridSlots(noTargetOrderCard.locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);
  await openFixture(page, profiles.headquarters, "", monthlyTargetFixture("unavailable"));
  const unavailableSummary = page.locator(".funnel-overview-header > .sales-target-summary");
  await expect(unavailableSummary).toHaveText("月目标数据暂不可用");
  await expect(unavailableSummary).not.toContainText("时间进度");
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  const unavailableOrderCard = page.locator(".sales-panel .funnel-kpi-card").first();
  await expect(unavailableOrderCard).not.toContainText("月目标数据暂不可用");
  await expect(unavailableOrderCard).not.toContainText("月目标");
  await expect(unavailableOrderCard).not.toContainText("目标达成");
  await expect(unavailableOrderCard).toContainText("35");
  expect(await gridSlots(unavailableOrderCard.locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);
  await expect(page.locator("#diagnosisTableBody")).toContainText("大区1");
});

test("PC 无效月目标范围保持空槽，订单表现和销售导出不输出目标数值", async ({ page }) => {
  const fixture = monthlyTargetFixture("invalid_range");
  expect(fixture.data.monthlyTarget.status).toBe("invalid_range");
  await openFixture(page, profiles.headquarters, "", fixture);
  await expect(page.locator(".funnel-overview-header > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator("#funnelGrid > .sales-target-summary")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("时间进度");
  const orderCard = page.locator(".sales-panel .funnel-kpi-card").first();
  expect(await gridSlots(orderCard.locator(".funnel-kpi-meta"))).toEqual([
    expect.objectContaining({ index: 0, text: expect.stringContaining("月环比") }),
    expect.objectContaining({ index: 1, text: expect.stringContaining("周环比") })
  ]);
  const orderPerformance = page.locator("#diagnosisTableBody .order-rank-cell").first();
  expect(await gridSlots(orderPerformance.locator(".rank-grid"))).toEqual([
    expect.objectContaining({ index: 0, text: "", ariaHidden: "true" }),
    expect.objectContaining({ index: 1, text: "", ariaHidden: "true" }),
    expect.objectContaining({ index: 2, text: expect.stringMatching(/^排名\d+\/\d+$/) }),
    expect.objectContaining({ index: 3, text: expect.stringMatching(/^占比 \d+%$/) })
  ]);
  const rows = parseCsvRows(await captureSalesCsv(page));
  const header = rows[0];
  rows.slice(1).forEach((row) => {
    const values = Object.fromEntries(header.map((name, index) => [name, row[index] || ""]));
    expect(values["订单月目标"]).toBe("");
    expect(values["订单目标口径实际"]).toBe("");
    expect(values["订单目标达成率"]).toBe("");
    expect(values["订单目标状态"]).toBe("invalid_range");
    expect(values["零售月目标"]).toBe("");
    expect(values["零售目标口径实际"]).toBe("");
    expect(values["零售目标达成率"]).toBe("");
    expect(values["零售目标状态"]).toBe("invalid_range");
  });
});

for (const width of [1280, 1366, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`PC 标题行目标摘要 ${width}px ${theme} 四态三段布局稳定且无水平溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockRuntimeDate(page, "2026-07-23T10:00:00+08:00");
      let expectedHeaderHeight = null;
      for (const stateName of ["success", "loading", "hidden", "error"]) {
        await openTargetHeaderState(page, stateName, theme);
        const headerHeight = await assertTargetHeaderMatrixLayout(page, { stateName, theme, expectedHeaderHeight });
        if (expectedHeaderHeight == null) expectedHeaderHeight = headerHeight;
        expect(await page.locator(".funnel-kpi-card").evaluateAll((cards) => cards.every((card) => {
          const text = card.textContent;
          return !text.includes("月目标") && !text.includes("目标达成") && !text.includes("订单目标") && !text.includes("达成率") && !text.includes("月目标数据暂不可用");
        }))).toBe(true);

        if (stateName === "success") {
          const summaryContrast = await page.locator(".funnel-overview-header > .sales-target-summary").evaluate((node, mode) => {
            const background = mode === "dark" ? "rgb(17, 24, 39)" : "rgb(255, 255, 255)";
            const pick = (selector) => getComputedStyle(node.querySelector(selector)).color;
            return {
              targetValue: pick(".target-value"),
              achievementValue: pick(".achievement-value"),
              retailTargetValue: pick(".retail-target-value"),
              retailAchievementValue: pick(".retail-achievement-value"),
              timeProgressValue: pick(".time-progress-value"),
              background
            };
          }, theme);
          const contrastReport = Object.fromEntries(
            ["targetValue", "achievementValue", "retailTargetValue", "retailAchievementValue", "timeProgressValue"].map((key) => [
              key,
              Number(contrastRatio(summaryContrast[key], summaryContrast.background).toFixed(2))
            ])
          );
          expect(Object.values(contrastReport).every((value) => value >= 4.5)).toBe(true);
          expect(await page.locator(".funnel-kpi-meta").evaluateAll((items) => items.every((item) => {
            const style = getComputedStyle(item);
            const rows = style.gridTemplateRows.split(" ").length;
            const columns = style.gridTemplateColumns.split(" ").length;
            return item.children.length === 2 && rows === 2 && columns === 1 && item.scrollWidth <= item.clientWidth + 1;
          }))).toBe(true);
          expect(await page.locator(".funnel-kpi-meta > span").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".order-rank-cell .rank-grid").first().evaluate((grid) => {
            const style = getComputedStyle(grid);
            return {
              childCount: grid.children.length,
              columns: style.gridTemplateColumns.split(" ").length,
              rows: style.gridTemplateRows.split(" ").length
            };
          })).toEqual({ childCount: 4, columns: 2, rows: 2 });
          expect(await gridSlots(page.locator(".order-rank-cell .rank-grid").first())).toEqual([
            expect.objectContaining({ index: 0, text: expect.stringContaining("月目标") }),
            expect.objectContaining({ index: 1, text: expect.stringContaining("目标达成") }),
            expect.objectContaining({ index: 2, text: expect.stringMatching(/^排名\d+\/\d+$/) }),
            expect.objectContaining({ index: 3, text: expect.stringMatching(/^占比 \d+%$/) })
          ]);
          expect(await gridSlots(page.locator(".retail-rank-cell .rank-grid").first())).toEqual([
            expect.objectContaining({ index: 0, text: expect.stringContaining("月目标") }),
            expect.objectContaining({ index: 1, text: expect.stringContaining("目标达成") }),
            expect.objectContaining({ index: 2, text: expect.stringMatching(/^排名\d+\/\d+$/) }),
            expect.objectContaining({ index: 3, text: expect.stringMatching(/^占比 \d+%$/) })
          ]);
          expect(await page.locator(".rank-label").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".rank-target b").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".rank-target span").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".rank-cell").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".issue-col").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator("#salesTabPanel .issue-stack .pill.gray").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator("#salesTabPanel .issue-stack .pill.gray").evaluateAll((items) => items.every((item) => item.textContent.trim() === item.getAttribute("title")))).toBe(true);
          expect(await page.locator(".sticky-action").evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
          expect(await page.locator(".rank-label").allTextContents()).not.toEqual(expect.arrayContaining(["全国排名", "大区排名", "小区排名"]));
        }
        await page.screenshot({ path: `validation/pc-sales-target-header-${stateName}-${theme}-${width}x900.png`, fullPage: true });
      }
    });
  }
}

test("销售概览第二列展示上层五段数量和下层四个行内转化率", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const firstRow = page.locator("#diagnosisTableBody [data-organization-row]").first();
  const cell = firstRow.locator(".funnel-col");
  await expect(cell.locator(".funnel-chain .funnel-node-label")).toHaveText(["线索", "到店", "试驾", "订单", "零售"]);
  await expect(cell.locator(".funnel-conversion-item")).toHaveCount(4);
  await expect(cell.locator(".funnel-conversion-label")).toHaveText(["线索到店率", "到店试驾率", "试驾订单率", "交付率"]);
  await expect(cell.locator(".funnel-conversion-item").nth(3)).toContainText("交付率");
  await expect(cell.locator(".funnel-conversion-item").nth(3)).not.toContainText("线索订单率");
  await expect(cell.locator(".funnel-conversion-item").nth(0)).toHaveAttribute("aria-label", /线索到店率 当前 .*，月环比/);
  await expect(cell.locator(".funnel-conversion-item").nth(1)).toHaveAttribute("title", /到店试驾率 当前 .*，月环比/);
  await expect(cell.locator(".funnel-arrow[aria-hidden='true']")).toHaveCount(4);
  await expect(page.locator(".process-panel .funnel-kpi-card .funnel-kpi-label")).toHaveText(["线索到店率", "到店试驾率", "试驾订单率", "线索订单率"]);
});

test("销售概览行内四率可比 0 显示持平而不是不可比较", async ({ page }) => {
  const base = storesFor()[0];
  const equalRateStore = {
    ...base,
    current: { leads: 100, arrivals: 40, drives: 20, orders: 8, retail: 4 },
    previous: { leads: 80, arrivals: 32, drives: 16, orders: 4, retail: 2 },
    week: { leads: 70, arrivals: 28, drives: 14, orders: 4, retail: 2 }
  };
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profiles.district, fixtureValue: makeFixture({ stores: [equalRateStore] }) });
  await page.goto("/");
  await expect(page.locator("#diagnosisTableBody .funnel-conversion-item").first()).toBeVisible({ timeout: 10_000 });
  const firstConversion = page.locator("#diagnosisTableBody .funnel-conversion-item").first();
  await expect(firstConversion).toContainText("月环比0.0%");
  await expect(firstConversion).toHaveAttribute("aria-label", /线索到店率 当前 40\.0%，月环比 持平 0\.0% 个百分点/);
  await expect(firstConversion).not.toHaveAttribute("aria-label", /不可比较/);
});

test("销售概览行内四率不新增销售导出字段", async ({ page }) => {
  await openFixture(page, profiles.headquarters);
  const header = parseCsvRows(await captureSalesCsv(page))[0];
  expect(header).toEqual([
    "大区",
    "区域/负责人",
    "线索",
    "线索月环比",
    "到店",
    "到店月环比",
    "试驾",
    "试驾月环比",
    "订单",
    "订单月环比",
    "零售",
    "零售月环比",
    "订单排名",
    "订单占比",
    "订单月目标",
    "订单目标口径实际",
    "订单目标达成率",
    "订单目标状态",
    "未配置订单目标实际",
    "订单目标冲突键数",
    "零售排名",
    "零售占比",
    "零售月目标",
    "零售目标口径实际",
    "零售目标达成率",
    "零售目标状态",
    "未配置零售目标实际",
    "零售目标冲突键数",
    "目标有效门店缺口数",
    "主问题",
    "结果断点"
  ]);
  expect(header).not.toEqual(expect.arrayContaining(["线索到店率", "到店试驾率", "试驾订单率", "交付率"]));
});

test("销售导出订单和零售排名用 Excel 文本保护且可规范化还原", async ({ page }) => {
  const base = storesFor()[0];
	  const rankStores = Array.from({ length: 7 }, (_, index) => ({
	    ...base,
	    code: `R${index + 1}`,
	    name: `排名门店${index + 1}`,
	    current: {
	      ...base.current,
	      leads: 100 - index,
	      arrivals: 80 - index,
	      drives: 60 - index,
	      orders: [70, 70, 69, 68, 68, 68, 67][index],
	      retail: [35, 35, 35, 34, 34, 33, 33][index]
	    },
	    previous: { ...base.previous, leads: 90 - index, arrivals: 70 - index, drives: 50 - index, orders: 60 - index, retail: 30 - index },
	    week: { ...base.week, leads: 80 - index, arrivals: 60 - index, drives: 40 - index, orders: 50 - index, retail: 25 - index }
	  }));
	  await openFixture(page, profiles.district, "", makeFixture({ stores: rankStores }));
	  await expect(page.locator('#diagnosisTableBody [data-organization-row="R1"] .order-rank-cell')).toContainText("1/7");
	  await expect(page.locator('#diagnosisTableBody [data-organization-row="R2"] .order-rank-cell')).toContainText("2/7");
	  await expect(page.locator('#diagnosisTableBody [data-organization-row="R3"] .retail-rank-cell')).toContainText("3/7");

	  const csvText = await captureSalesCsv(page);
  const rows = parseCsvRows(csvText);
  const header = rows[0];
  const orderRankIndex = header.indexOf("订单排名");
  const orderShareIndex = header.indexOf("订单占比");
  const retailRankIndex = header.indexOf("零售排名");
  const retailShareIndex = header.indexOf("零售占比");
  expect([orderRankIndex, orderShareIndex, retailRankIndex, retailShareIndex]).not.toContain(-1);
  expect(orderShareIndex).toBe(orderRankIndex + 1);
  expect(retailShareIndex).toBe(retailRankIndex + 1);

  const dataRows = rows.slice(1);
  expect(dataRows).toHaveLength(7);
  const orderRanks = dataRows.map((row) => row[orderRankIndex]);
  const retailRanks = dataRows.map((row) => row[retailRankIndex]);
  expect(orderRanks).toEqual(["\t1/7", "\t2/7", "\t3/7", "\t4/7", "\t5/7", "\t6/7", "\t7/7"]);
  expect(retailRanks).toEqual(["\t1/7", "\t2/7", "\t3/7", "\t4/7", "\t5/7", "\t6/7", "\t7/7"]);
  expect(orderRanks.map(normalizeExcelTextRank)).toEqual(["1/7", "2/7", "3/7", "4/7", "5/7", "6/7", "7/7"]);
  expect(retailRanks.map(normalizeExcelTextRank)).toEqual(["1/7", "2/7", "3/7", "4/7", "5/7", "6/7", "7/7"]);
  expect(dataRows.map((row) => row[orderShareIndex]).every((value) => !value.startsWith("\t"))).toBe(true);
  expect(dataRows.map((row) => row[retailShareIndex]).every((value) => !value.startsWith("\t"))).toBe(true);
  expect(dataRows.map((row) => row[8]).every((value) => !value.startsWith("\t"))).toBe(true);
  expect(csvText).not.toMatch(/(^|,)"?=/);

  await openFixture(page, profiles.headquarters, "", makeFixture({ nationalComplete: false }));
  const unavailableRankRows = parseCsvRows(await captureSalesCsv(page));
  const unavailableHeader = unavailableRankRows[0];
  const unavailableOrderRankIndex = unavailableHeader.indexOf("订单排名");
  const unavailableRetailRankIndex = unavailableHeader.indexOf("零售排名");
  expect([unavailableOrderRankIndex, unavailableRetailRankIndex]).not.toContain(-1);
  unavailableRankRows.slice(1).forEach((row) => {
    expect(row[unavailableOrderRankIndex].startsWith("\t")).toBe(false);
    expect(row[unavailableRetailRankIndex].startsWith("\t")).toBe(false);
    expect(deneutralizeCsvPlaceholder(row[unavailableOrderRankIndex])).toBe("--");
    expect(deneutralizeCsvPlaceholder(row[unavailableRetailRankIndex])).toBe("--");
	  });
	});

test("53家末尾同值在PC页面和销售导出中连续唯一排名", async ({ page }) => {
  const base = storesFor()[0];
  const rankStores = Array.from({ length: 53 }, (_, index) => {
    const rankIndex = index + 1;
    const metric = rankIndex <= 45 ? 200 - rankIndex : 10;
    return {
      ...base,
      code: `U${String(rankIndex).padStart(2, "0")}`,
      name: `末尾排名门店${String(rankIndex).padStart(2, "0")}`,
      areaCode: "A1",
      area: "大区1",
      districtCode: "D1",
      district: "小区1",
      current: {
        ...base.current,
        leads: 300 - index,
        arrivals: 200 - index,
        drives: 100 - index,
        orders: metric,
        retail: metric
      },
      previous: { ...base.previous, leads: 260 - index, arrivals: 160 - index, drives: 80 - index, orders: Math.max(0, metric - 1), retail: Math.max(0, metric - 1) },
      week: { ...base.week, leads: 240 - index, arrivals: 140 - index, drives: 70 - index, orders: Math.max(0, metric - 2), retail: Math.max(0, metric - 2) }
    };
  });
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profiles.district, fixtureValue: makeFixture({ stores: rankStores }) });
  await page.goto("/");
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 53 条 · 当前展示 15 条 · 第 1/4 页 · 每页 15 条");
  for (let index = 0; index < 3; index += 1) {
    await page.locator("#salesPagination .pager-next").click();
  }
  await expect(page.locator("#salesPagination [data-pagination-info]")).toHaveText("共 53 条 · 当前展示 8 条 · 第 4/4 页 · 每页 15 条");
  await expect(page.locator('#diagnosisTableBody [data-organization-row="U46"] .order-rank-cell .rank-main')).toHaveText("46/53");
  await expect(page.locator('#diagnosisTableBody [data-organization-row="U46"] .retail-rank-cell .rank-main')).toHaveText("46/53");
  await expect(page.locator('#diagnosisTableBody [data-organization-row="U53"] .order-rank-cell .rank-main')).toHaveText("53/53");
  await expect(page.locator('#diagnosisTableBody [data-organization-row="U53"] .retail-rank-cell .rank-main')).toHaveText("53/53");

  const rows = parseCsvRows(await captureSalesCsv(page));
  const header = rows[0];
  const orderRankIndex = header.indexOf("订单排名");
  const retailRankIndex = header.indexOf("零售排名");
  expect([orderRankIndex, retailRankIndex]).not.toContain(-1);
  const rowsByName = new Map(rows.slice(1).map((row) => [row[0], row]));
  const tailRanks = Array.from({ length: 8 }, (_, index) => {
    const rank = index + 46;
    const row = rowsByName.get(`末尾排名门店${String(rank).padStart(2, "0")}`);
    return {
      order: row?.[orderRankIndex],
      retail: row?.[retailRankIndex]
    };
  });
  expect(tailRanks.map((item) => item.order)).toEqual(["\t46/53", "\t47/53", "\t48/53", "\t49/53", "\t50/53", "\t51/53", "\t52/53", "\t53/53"]);
  expect(tailRanks.map((item) => item.retail)).toEqual(["\t46/53", "\t47/53", "\t48/53", "\t49/53", "\t50/53", "\t51/53", "\t52/53", "\t53/53"]);
  expect(tailRanks.map((item) => normalizeExcelTextRank(item.order))).toEqual(["46/53", "47/53", "48/53", "49/53", "50/53", "51/53", "52/53", "53/53"]);
  expect(tailRanks.map((item) => normalizeExcelTextRank(item.retail))).toEqual(["46/53", "47/53", "48/53", "49/53", "50/53", "51/53", "52/53", "53/53"]);
});

for (const width of [1440, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`销售概览行内四率双层漏斗 ${width}px ${theme} 无新增横溢出且行高达标`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openFixture(page, profiles.headquarters, `theme=${theme}`);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      const metrics = await page.locator("#diagnosisTableBody [data-organization-row]").first().evaluate((row) => {
        const cell = row.querySelector(".funnel-col");
        const cellBox = cell.getBoundingClientRect();
        const cellStyle = getComputedStyle(cell);
        const contentLeft = cellBox.left + Number.parseFloat(cellStyle.paddingLeft);
        const contentRight = cellBox.right - Number.parseFloat(cellStyle.paddingRight);
        const withinCell = (node) => {
          const rect = node.getBoundingClientRect();
          return rect.left >= contentLeft - 1 && rect.right <= contentRight + 1 && rect.width > 0;
        };
        const conversionRow = row.querySelector(".funnel-conversion-row");
        const chain = row.querySelector(".funnel-chain");
        const nodes = Array.from(row.querySelectorAll(".funnel-node"));
        const items = Array.from(row.querySelectorAll(".funnel-conversion-item"));
        const issue = row.querySelector(".issue-col");
        const action = row.querySelector(".sticky-action");
        const labels = Array.from(row.querySelectorAll(".funnel-conversion-label"));
        const textPieces = Array.from(row.querySelectorAll(".funnel-node-label, .funnel-node-value, .funnel-node-delta, .funnel-conversion-label, .funnel-conversion-value, .funnel-conversion-delta"));
        return {
          pageNoOverflow: document.documentElement.scrollWidth <= window.innerWidth,
          panelNoOverflow: document.querySelector("#salesTabPanel").scrollWidth <= document.querySelector("#salesTabPanel").clientWidth + 1,
          rowHeight: row.getBoundingClientRect().height,
          cellHeight: cell.getBoundingClientRect().height,
          chainWithinCell: withinCell(chain),
          conversionRowWithinCell: withinCell(conversionRow),
          nodesWithinCell: nodes.every(withinCell),
          itemsWithinCell: items.every(withinCell),
          fifthNodeVisible: withinCell(nodes[4]) && nodes[4].getBoundingClientRect().width >= 24 && nodes[4].textContent.includes("零售"),
          fourthConversionVisible: withinCell(items[3]) && items[3].getBoundingClientRect().width >= 42 && items[3].textContent.includes("交付率"),
          conversionColumns: getComputedStyle(conversionRow).gridTemplateColumns.split(" ").length,
          conversionWidths: items.map((item) => Math.round(item.getBoundingClientRect().width)),
          allItemsFit: items.every((item) => item.scrollWidth <= item.clientWidth + 1),
          overflowingTextPieces: textPieces.filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => ({
            text: item.textContent.trim(),
            className: item.className,
            scrollWidth: item.scrollWidth,
            clientWidth: item.clientWidth
          })),
          allLabelsAccessible: items.every((item) => {
            const label = item.querySelector(".funnel-conversion-label")?.textContent?.trim();
            const aria = item.getAttribute("aria-label") || "";
            const title = item.getAttribute("title") || "";
            return label && aria.includes(label) && title.includes(label);
          }),
          shortLabelsConfigured: labels.map((label) => label.getAttribute("data-short-label")),
          issueReadable: issue.scrollWidth <= issue.clientWidth + 1,
          actionReadable: action.scrollWidth <= action.clientWidth + 1
        };
      });
      expect(metrics.pageNoOverflow).toBe(true);
      expect(metrics.panelNoOverflow).toBe(true);
      expect(metrics.rowHeight).toBeGreaterThanOrEqual(108);
      expect(metrics.rowHeight).toBeLessThanOrEqual(120);
      expect(metrics.cellHeight).toBeGreaterThanOrEqual(108);
      expect(metrics.cellHeight).toBeLessThanOrEqual(120);
      expect(metrics.chainWithinCell).toBe(true);
      expect(metrics.conversionRowWithinCell).toBe(true);
      expect(metrics.nodesWithinCell).toBe(true);
      expect(metrics.itemsWithinCell).toBe(true);
      expect(metrics.fifthNodeVisible).toBe(true);
      expect(metrics.fourthConversionVisible).toBe(true);
      expect(metrics.conversionColumns).toBe(4);
      expect(new Set(metrics.conversionWidths).size).toBeLessThanOrEqual(2);
      expect(metrics.allItemsFit).toBe(true);
      expect(metrics.overflowingTextPieces).toEqual([]);
      expect(metrics.allLabelsAccessible).toBe(true);
      expect(metrics.shortLabelsConfigured).toEqual(["到店率", "试驾率", "订单率", "交付率"]);
      expect(metrics.issueReadable).toBe(true);
      expect(metrics.actionReadable).toBe(true);
      await page.screenshot({ path: `validation/pc-sales-row-conversion-rates-${theme}-${width}x900.png`, fullPage: false });
    });
  }
}

for (const theme of ["light", "dark"]) {
  test(`1440px ${theme} 页面无水平溢出`, async ({ page }) => {
    await openFixture(page, profiles.headquarters, `theme=${theme}`);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: `validation/pc-role-drilldown-${theme}-1440x900.${theme === "dark" ? "jpg" : "png"}`,
      fullPage: true,
      ...(theme === "dark" ? { type: "jpeg", quality: 92 } : {})
    });
  });
}
