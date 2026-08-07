import { expect, test } from "@playwright/test";

const dealerRows = [
  { code: "S1", name: "测试门店", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
];

function salesRow({ orders = 5, retail = 2, leads = 20, arrivals = 8, drives = 4 } = {}) {
  return {
    "经销商代码": "S1",
    "经销商名称": "测试门店",
    "大区名称": "大区1",
    "小区名称": "小区1",
    "当日下发线索数": leads,
    "当日首触客流数": arrivals,
    "当日首触试驾数": drives,
    "当日订单数（首触）": orders,
    "当日零售数": retail
  };
}

function rawWith(row) {
  return {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
    weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" },
    sales: [row],
    salesPrev: [salesRow({ orders: 2, retail: 1, leads: 10, arrivals: 4, drives: 2 })],
    salesWeek: [salesRow({ orders: 1, retail: 1, leads: 8, arrivals: 3, drives: 1 })],
    scopeEvidence: { source: "test-sales", complete: true, hitLimit: false },
    monthlyTarget: { status: "loading", targets: [], targetActuals: [], audit: {}, months: [] }
  };
}

function processRaw(kind, stage) {
  const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
  const agg = { total: 10, negative: 2, rate: 20, problems: [] };
  if (kind === "ip") return { [`ipAgg${suffix}`]: agg, [`ipAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
  return { [`driveTagAgg${suffix}`]: agg, [`driveTagAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
}

async function openInstrumented(page, options = {}) {
  await page.addInitScript(({ config, dealerRowsValue }) => {
    window.__RETAIL_PC_LOADER_TEST__ = true;
    window.__retailPcLoaderEvents = [];
    window.__retailPcApiCalls = [];
    let callSeq = 0;
    const record = (item) => {
      window.__retailPcApiCalls.push({ seq: ++callSeq, ...item });
    };
    const processPayload = (kind, stage) => {
      const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
      const agg = { total: 10, negative: 2, rate: 20, problems: [] };
      if (kind === "ip") return { [`ipAgg${suffix}`]: agg, [`ipAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
      return { [`driveTagAgg${suffix}`]: agg, [`driveTagAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
    };
    const deferred = {};
    window.__resolveVehicleSeriesOptions = (values = ["全新MG4", "MG 4X"]) => deferred.vehicleSeries?.resolve(values);
    window.__resolveFirstSales = () => deferred.firstSales?.resolve(config.firstSalesRaw);
    window.__resolveFirstProcess = () => {
      (deferred.firstProcess || []).forEach((item) => item.resolve(processPayload(item.kind, item.stage)));
      deferred.firstProcess = [];
    };

    window.__RETAIL_PC_APP_TEST_HOOKS__ = {
      loaderEvent: (event) => record({ type: "event", eventType: event.type }),
      renderProcessComparisonList: (state) => record({ type: "process-render", stage: state.processStage, loading: state.processLoading, token: state.loadToken }),
      salesFirstFrameBarrier: async () => {
        record({ type: "barrier" });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };

    const monthlyTargetRaw = async () => {
      record({ type: "monthly" });
      return { status: "no_target", targets: [], targetActuals: [], audit: {}, months: [] };
    };

    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => window.__regionDataApi,
      set: (value) => {
        const loadSalesRaw = async (params, loadOptions = {}) => {
          record({ type: "sales", params: { ...params }, options: { ...loadOptions } });
          if (config.salesFailure) throw new Error("销售核心模拟失败");
          if (config.staleSales && !window.__firstSalesSeen) {
            window.__firstSalesSeen = true;
            deferred.firstSales = {};
            const promise = new Promise((resolve) => { deferred.firstSales.resolve = resolve; });
            return promise;
          }
          return window.__firstSalesSeen ? config.secondSalesRaw : config.salesRaw;
        };
        loadSalesRaw.supportsMonthlyTargetOptions = true;
        loadSalesRaw.supportsVehicleSeriesOptions = true;

        window.__regionDataApi = {
          ...value,
          loadSalesRaw,
          loadMonthlyTargetRaw: monthlyTargetRaw,
          loadVehicleSeriesOptions: async () => {
            record({ type: "vehicle-options" });
            if (config.pendingVehicleOptions) {
              deferred.vehicleSeries = {};
              return new Promise((resolve) => { deferred.vehicleSeries.resolve = resolve; });
            }
            return config.vehicleSeriesOptions || ["全新MG4", "MG 4X"];
          },
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            record({ type: "process", kind, stage });
            if (config.staleProcess && stage === "current" && !window.__firstProcessSeen) {
              if (!deferred.firstProcess) deferred.firstProcess = [];
              return new Promise((resolve) => {
                deferred.firstProcess.push({ kind, stage, resolve });
                if (deferred.firstProcess.length >= 2) window.__firstProcessSeen = true;
              });
            }
            return processPayload(kind, stage);
          }
        };
      }
    });

    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => window.__regionFilterApi,
      set: (value) => {
        window.__regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => {
            record({ type: "dealer-scope" });
            return { dealers: dealerRowsValue, evidence: { complete: true, hitLimit: false, sourceDsId: "test" } };
          },
          loadValidDealers: async (params) => {
            record({ type: "diagnosis-dealers", params: { ...params } });
            return dealerRowsValue;
          }
        };
      }
    });

    Object.defineProperty(window, "SmallOrderApi", {
      configurable: true,
      get: () => window.__smallOrderApi,
      set: (value) => {
        window.__smallOrderApi = {
          ...value,
          loadSmallOrderRaw: async () => {
            record({ type: "small-order" });
            return { status: "target_unavailable", organizationRows: [], targetRows: [], validDealers: dealerRowsValue };
          }
        };
      }
    });

    Object.defineProperty(window, "IronMetricsApi", {
      configurable: true,
      get: () => window.__ironMetricsApi,
      set: (value) => {
        window.__ironMetricsApi = {
          ...value,
          loadIronMetricsRaw: async (params) => {
            record({ type: "iron-sql-batch", params: { ...params } });
            return { range: { startDate: params.startDate, endDate: params.endDate }, sourceStates: {} };
          }
        };
      }
    });

    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" }));
  }, {
    dealerRowsValue: dealerRows,
    config: {
      salesRaw: rawWith(salesRow({ orders: 5 })),
      firstSalesRaw: rawWith(salesRow({ orders: 1 })),
      secondSalesRaw: rawWith(salesRow({ orders: 9 })),
      ...options
    }
  });
  await page.goto(options.query ? `/?${options.query}` : "/");
}

async function openProductionWithPreseededHooks(page) {
  await page.addInitScript(({ dealerRowsValue, salesRawValue }) => {
    window.__retailPcApiCalls = [];
    window.__retailPcHookCalls = [];
    let callSeq = 0;
    const record = (item) => {
      window.__retailPcApiCalls.push({ seq: ++callSeq, ...item });
    };
    const hookRecord = (type) => {
      window.__retailPcHookCalls.push(type);
    };
    const processPayload = (kind, stage) => {
      const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
      const agg = { total: 10, negative: 2, rate: 20, problems: [] };
      if (kind === "ip") return { [`ipAgg${suffix}`]: agg, [`ipAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
      return { [`driveTagAgg${suffix}`]: agg, [`driveTagAggStores${suffix}`]: [{ code: "S1", name: "测试门店", ...agg }] };
    };

    window.__RETAIL_PC_APP_TEST_HOOKS__ = {
      loaderEvent: () => hookRecord("loaderEvent"),
      salesFirstFrameBarrier: () => {
        hookRecord("salesFirstFrameBarrier");
        return new Promise(() => {});
      },
      renderProcessComparisonList: () => hookRecord("renderProcessComparisonList"),
      rebuildIronStores: () => hookRecord("rebuildIronStores"),
      refreshDynamicDiagnoses: () => hookRecord("refreshDynamicDiagnoses")
    };

    Object.defineProperty(window, "RegionDataApi", {
      configurable: true,
      get: () => window.__regionDataApi,
      set: (value) => {
        const loadSalesRaw = async (params, loadOptions = {}) => {
          record({ type: "sales", params: { ...params }, options: { ...loadOptions } });
          return salesRawValue;
        };
        loadSalesRaw.supportsMonthlyTargetOptions = true;
        loadSalesRaw.supportsVehicleSeriesOptions = true;
        window.__regionDataApi = {
          ...value,
          loadSalesRaw,
          loadMonthlyTargetRaw: async () => {
            record({ type: "monthly" });
            return { status: "no_target", targets: [], targetActuals: [], audit: {}, months: [] };
          },
          loadVehicleSeriesOptions: async () => {
            record({ type: "vehicle-options" });
            return ["全新MG4", "MG 4X"];
          },
          loadNegativeProcessKindStageRaw: async (kind, stage) => {
            record({ type: "process", kind, stage });
            return processPayload(kind, stage);
          }
        };
      }
    });

    Object.defineProperty(window, "RegionFilterApi", {
      configurable: true,
      get: () => window.__regionFilterApi,
      set: (value) => {
        window.__regionFilterApi = {
          ...value,
          loadValidDealerScope: async () => {
            record({ type: "dealer-scope" });
            return { dealers: dealerRowsValue, evidence: { complete: true, hitLimit: false, sourceDsId: "test" } };
          },
          loadValidDealers: async () => {
            record({ type: "diagnosis-dealers" });
            return dealerRowsValue;
          }
        };
      }
    });

    Object.defineProperty(window, "SmallOrderApi", {
      configurable: true,
      get: () => window.__smallOrderApi,
      set: (value) => {
        window.__smallOrderApi = {
          ...value,
          loadSmallOrderRaw: async () => {
            record({ type: "small-order" });
            return { status: "target_unavailable", organizationRows: [], targetRows: [], validDealers: dealerRowsValue };
          }
        };
      }
    });

    Object.defineProperty(window, "IronMetricsApi", {
      configurable: true,
      get: () => window.__ironMetricsApi,
      set: (value) => {
        window.__ironMetricsApi = {
          ...value,
          loadIronMetricsRaw: async (params) => {
            record({ type: "iron-sql-batch", params: { ...params } });
            return { range: { startDate: params.startDate, endDate: params.endDate }, sourceStates: {} };
          }
        };
      }
    });

    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify({ marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" }));
  }, { dealerRowsValue: dealerRows, salesRawValue: rawWith(salesRow({ orders: 5 })) });
  await page.goto("/");
}

async function events(page) {
  return page.evaluate(() => window.__retailPcLoaderEvents || []);
}

test("正式页面忽略预置 APP_TEST_HOOKS，不允许 hook 挂住首帧或替换过程渲染", async ({ page }) => {
  await openProductionWithPreseededHooks(page);

  await expect(page.locator(".funnel-kpi-card").first()).toContainText("订单", { timeout: 10_000 });
  await page.waitForFunction(() => (window.__retailPcApiCalls || []).some((call) => call.type === "monthly"));
  expect(await page.evaluate(() => window.__retailPcHookCalls)).toEqual([]);

  await page.locator("#processTab").click();
  await page.waitForFunction(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "process").length >= 6);
  await expect(page.locator("#processListTableBody")).toContainText("测试门店");
  expect(await page.evaluate(() => window.__retailPcHookCalls)).toEqual([]);
});

test("默认全部车系不等待枚举，销售首帧先于 secondary loader", async ({ page }) => {
  await openInstrumented(page, { pendingVehicleOptions: true });

  await expect(page.locator(".funnel-kpi-card").first()).toContainText("订单", { timeout: 10_000 });
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).some((event) => event.type === "process_current_start"));
  const log = await events(page);
  const indexOf = (type) => log.findIndex((event) => event.type === type);

  expect(indexOf("sales_core_start")).toBeGreaterThanOrEqual(0);
  expect(indexOf("sales_first_frame")).toBeGreaterThan(indexOf("sales_first_frame_dom"));
  expect(indexOf("monthly_target_start")).toBeGreaterThan(indexOf("sales_first_frame"));
  expect(indexOf("small_order_start")).toBeGreaterThan(indexOf("sales_first_frame"));
  expect(indexOf("process_current_start")).toBeGreaterThan(indexOf("sales_first_frame"));
  expect(log.some((event) => event.type === "process_comparison_start")).toBe(false);
  expect(log.some((event) => event.type === "iron_start")).toBe(false);

  const calls = await page.evaluate(() => window.__retailPcApiCalls);
  expect(calls.some((call) => call.type === "dealer-scope")).toBe(true);
  expect(calls.some((call) => call.type === "vehicle-options")).toBe(true);
  expect(calls.filter((call) => call.type === "iron-sql-batch")).toHaveLength(0);
  expect(calls.find((call) => call.type === "sales").options.includeVehicleSeriesOptions).toBe(false);
});

test("dealer-scoped 诊断补数在销售首帧后才启动且不重新拉车系枚举", async ({ page }) => {
  await openInstrumented(page, { query: "dealerCode=S1&districtCode=D1" });

  await page.waitForFunction(() => (window.__retailPcApiCalls || []).some((call) => call.type === "diagnosis-dealers"));
  const calls = await page.evaluate(() => window.__retailPcApiCalls);
  const frameSeq = calls.find((call) => call.type === "event" && call.eventType === "sales_first_frame")?.seq || 0;
  const diagnosisDealerCalls = calls.filter((call) => call.type === "diagnosis-dealers");
  const diagnosisSalesCalls = calls.filter((call) => call.type === "sales" && call.params?.dealerCode === "");

  expect(frameSeq).toBeGreaterThan(0);
  expect(diagnosisDealerCalls.filter((call) => call.seq < frameSeq)).toHaveLength(0);
  expect(diagnosisSalesCalls.filter((call) => call.seq < frameSeq)).toHaveLength(0);
  expect(diagnosisDealerCalls.length).toBeGreaterThanOrEqual(1);
  expect(diagnosisSalesCalls.length).toBeGreaterThanOrEqual(1);
  expect(diagnosisSalesCalls.every((call) => call.options.includeVehicleSeriesOptions === false)).toBe(true);
});

test("具体非法车系 fail-closed，不扩大成全部车系", async ({ page }) => {
  await openInstrumented(page, { query: "vehicleSeries=%E4%B8%8D%E5%AD%98%E5%9C%A8", vehicleSeriesOptions: ["全新MG4"] });

  await expect(page.locator("#funnelGrid")).toContainText("非法车系筛选", { timeout: 10_000 });
  const log = await events(page);
  const calls = await page.evaluate(() => window.__retailPcApiCalls);
  expect(log.some((event) => event.type === "sales_core_start")).toBe(false);
  expect(calls.some((call) => call.type === "dealer-scope")).toBe(false);
  expect(calls.some((call) => call.type === "sales")).toBe(false);
});

test("打铁首次进入加载并按 identity 复用，新筛选可重新加载", async ({ page }) => {
  await openInstrumented(page);
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).some((event) => event.type === "sales_first_frame"));
  expect((await events(page)).filter((event) => event.type === "iron_start")).toHaveLength(0);
  expect(await page.evaluate(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "iron-sql-batch").length)).toBe(0);

  await page.locator("#ironTab").click();
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).filter((event) => event.type === "iron_start").length === 1);
  await page.waitForFunction(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "iron-sql-batch").length === 3);
  await page.locator("#salesTab").click();
  await page.locator("#ironTab").click();
  await page.waitForTimeout(50);
  expect((await events(page)).filter((event) => event.type === "iron_start")).toHaveLength(1);
  expect(await page.evaluate(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "iron-sql-batch").length)).toBe(3);

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("endDate", "2026-07-21");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    window.__retailPcApp.reload();
  });
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).filter((event) => event.type === "sales_first_frame").length >= 2);
  await page.locator("#ironTab").click();
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).filter((event) => event.type === "iron_start").length === 2);
  await page.waitForFunction(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "iron-sql-batch").length === 6);
});

test("过程比较期首次进入过程 Tab 才启动且同 identity 不重复", async ({ page }) => {
  await openInstrumented(page);
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).some((event) => event.type === "process_current_start"));
  expect((await events(page)).filter((event) => event.type === "process_comparison_start")).toHaveLength(0);

  await page.locator("#processTab").click();
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).filter((event) => event.type === "process_comparison_start").length === 1);
  await page.locator("#salesTab").click();
  await page.locator("#processTab").click();
  await page.waitForTimeout(50);
  expect((await events(page)).filter((event) => event.type === "process_comparison_start")).toHaveLength(1);
});

test("旧 token 不写回；销售失败保持主错误态且不启动 secondary", async ({ page }) => {
  await openInstrumented(page, { staleSales: true });
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("endDate", "2026-07-21");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    window.__retailPcApp.reload();
  });
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).some((event) => event.type === "sales_first_frame"));
  await page.evaluate(() => window.__resolveFirstSales());
  await page.waitForTimeout(50);
  await expect.poll(() => page.evaluate(() => window.__retailPcApp.getStateSnapshot().salesOrders)).toBe(9);

  const failurePage = await page.context().newPage();
  await openInstrumented(failurePage, { salesFailure: true });
  await expect(failurePage.locator("#funnelGrid")).toContainText("销售核心模拟失败", { timeout: 10_000 });
  const failureLog = await events(failurePage);
  expect(failureLog.some((event) => event.type === "monthly_target_start")).toBe(false);
  expect(failureLog.some((event) => event.type === "small_order_start")).toBe(false);
  expect(failureLog.some((event) => event.type === "process_current_start")).toBe(false);
  expect(failureLog.some((event) => event.type === "iron_start")).toBe(false);
});

test("旧 process secondary 迟到不写回当前上下文", async ({ page }) => {
  await openInstrumented(page, { staleProcess: true });
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).some((event) => event.type === "process_current_start"));

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("endDate", "2026-07-21");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    window.__retailPcApp.reload();
  });
  await page.waitForFunction(() => (window.__retailPcLoaderEvents || []).filter((event) => event.type === "process_current_start").length >= 2);
  await page.waitForFunction(() => (window.__retailPcApiCalls || []).some((call) => call.type === "process-render" && call.stage === "current"));
  const before = await page.evaluate(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "process-render").length);

  await page.evaluate(() => window.__resolveFirstProcess());
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => (window.__retailPcApiCalls || []).filter((call) => call.type === "process-render").length);
  expect(after).toBe(before);
  await expect.poll(() => page.evaluate(() => window.__retailPcApp.getStateSnapshot().salesOrders)).toBe(5);
});
