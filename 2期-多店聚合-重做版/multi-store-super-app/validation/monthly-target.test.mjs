import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadScript(path, context) {
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), "utf8"), context);
}

function jsonResponse(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}

async function loadDataApiWithMonthlyTargetRequests(today = "2026-07-21", options = {}) {
  const calls = [];
  const orderTargetFieldNames = options.orderTargetFields || ["日期", "品牌", "大区", "大区代码", "小区", "小区代码", "经销商", "经销商代码", "车系", "订单目标"];
  const retailTargetFieldNames = options.retailTargetFields || options.targetFields || ["目标日期", "rfs_code", "mac_code", "dealer_code", "车系", "总零售目标"];
  const legacyTargetPreviewRows = options.targetPreviewRows || [];
  const expandOrderRow = (row) => row.length === 5
    ? [row[0], row[1], "大区1", "A1", "小区1", "D1", `门店${row[2]}`, row[2], row[3], row[4]]
    : row;
  const orderTargetPreviewRows = (options.orderTargetPreviewRows || legacyTargetPreviewRows.map((row) => [row[0], "MG", "大区1", "A1", "小区1", "D1", `门店${row[1]}`, row[1], row[2], row[3]])).map(expandOrderRow);
  const retailTargetPreviewRows = options.retailTargetPreviewRows || legacyTargetPreviewRows.map((row) => [row[0], row[1], row[2], row[4]]);
  const orderTargetPreviewColumns = ["日期", "品牌", "大区", "大区代码", "小区", "小区代码", "经销商", "经销商代码", "车系", "订单目标"];
  const retailTargetPreviewColumns = ["目标日期", "dealer_code", "车系", "总零售目标"];
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [`${today}T12:00:00`])); }
    static now() { return new Date(`${today}T12:00:00`).getTime(); }
  }
  const fetch = async (url, init = {}) => {
    const request = { url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null };
    calls.push(request);
    if (url === "/api/data-source/u32cb7e789f7443ff84160b4") {
      if (options.failOrderTarget) throw new Error(options.failOrderTarget);
      return jsonResponse({ dsId: "u32cb7e789f7443ff84160b4", fields: orderTargetFieldNames.map((name) => ({ name })) });
    }
    if (url === "/api/data-source/r05b1e3995b0b4480991a4b8") {
      if (options.failRetailTarget) throw new Error(options.failRetailTarget);
      return jsonResponse({ dsId: "r05b1e3995b0b4480991a4b8", fields: retailTargetFieldNames.map((name) => ({ name })) });
    }
    if (url === "/api/data-source/u32cb7e789f7443ff84160b4/preview-with-filter-async") return jsonResponse({ taskId: "monthly-order-target-task" });
    if (url === "/api/data-source/r05b1e3995b0b4480991a4b8/preview-with-filter-async") return jsonResponse({ taskId: "monthly-retail-target-task" });
    if (url === "/api/task/monthly-order-target-task") return jsonResponse({ status: "FINISHED", result: { response: { value: "monthly-order-target-preview" } } });
    if (url === "/api/task/monthly-retail-target-task") return jsonResponse({ status: "FINISHED", result: { response: { value: "monthly-retail-target-preview" } } });
    if (url === "/api/account/readPreviewFile") {
      if (request.body.taskId === "monthly-order-target-task") return jsonResponse({ preview: orderTargetPreviewRows, columns: orderTargetPreviewColumns.map((name) => ({ name })) });
      if (request.body.taskId === "monthly-retail-target-task") return jsonResponse({ preview: retailTargetPreviewRows, columns: retailTargetPreviewColumns.map((name) => ({ name })) });
    }
    if (url === "/api/data-source/execute-sql-query") return jsonResponse({ preview: [], columns: [] });
    throw new Error(`Unexpected request: ${url}`);
  };
  const context = { window: { __IRON_METRICS_TEST__: true, location: { hostname: "localhost", pathname: "/" } }, globalThis: {}, location: { hostname: "localhost", pathname: "/" }, fetch, Date: FixedDate, setTimeout };
  await loadScript("../vehicle-series.js", context);
  await loadScript("../data-api.js", context);
  return { dataApi: context.window.RegionDataApi, calls };
}

const dataContext = { window: { __IRON_METRICS_TEST__: true, location: { hostname: "localhost", pathname: "/" } }, globalThis: {} };
await loadScript("../vehicle-series.js", dataContext);
await loadScript("../data-api.js", dataContext);
const dataApi = dataContext.window.RegionDataApi;

const productionDataContext = { window: { location: { hostname: "localhost", pathname: "/" } }, globalThis: {}, location: { hostname: "localhost", pathname: "/" }, fetch: async () => { throw new Error("Unexpected fetch"); }, setTimeout };
await loadScript("../vehicle-series.js", productionDataContext);
await loadScript("../data-api.js", productionDataContext);
assert.equal(Object.hasOwn(productionDataContext.window.RegionDataApi, "__test"), false);

const metricsContext = { window: {}, globalThis: {} };
await loadScript("../metrics.js", metricsContext);
await loadScript("../organization-view.js", metricsContext);
const metrics = metricsContext.window.RegionMetrics;
const organization = metricsContext.window.OrganizationView;
const realTargetAudit = JSON.parse(await readFile(new URL("./fixtures/mg-order-retail-target-202607-audit.json", import.meta.url), "utf8"));
const realOrderTargetAudit = JSON.parse(await readFile(new URL("./fixtures/mg-order-target-u32-202607-audit.json", import.meta.url), "utf8"));

function target(date, dealerCode, series, orderValue, retailValue) {
  return { 日期: date, 品牌: "MG", 大区: "大区1", 大区代码: "A1", 小区: "小区1", 小区代码: "D1", 经销商: `门店${dealerCode}`, 经销商代码: dealerCode, 订单目标: orderValue, 目标日期: date, dealer_code: dealerCode, 车系: series, 总订单目标: "不应读取", 总零售目标: retailValue, area: "目标表错区", city_name: "目标表错城市", rfs_name: "目标表错大区", mac_name: "目标表错小区" };
}

function actual(month, dealerCode, series, orders, retail) {
  return { month, brand: "MG", dealerCode, vehicleSeries: series, actualOrders: orders, actualRetail: retail };
}

function dealer(code, areaCode = "A1", districtCode = "D1") {
  return { code, name: `门店${code}`, areaCode, area: `大区${areaCode.slice(-1)}`, districtCode, district: `小区${districtCode.slice(-1)}` };
}

function sale(code, orders, retail = 0, series = "全新MG4") {
  return { 经销商代码: code, 经销商名称: `门店${code}`, 当日下发线索数: orders * 10, 当日首触客流数: orders * 4, 当日首触试驾数: orders * 2, "当日订单数（首触）": orders, 当日零售数: retail, 汇报车系名称: series };
}

test("目标 DS 拆源：订单读取 u32，零售读取 r05", () => {
  assert.equal(dataApi.__test.DS.monthlyOrderTarget, "u32cb7e789f7443ff84160b4");
  assert.equal(dataApi.__test.DS.monthlyRetailTarget, "r05b1e3995b0b4480991a4b8");
});

test("订单目标保留每条 u32 输出，零售目标按 r05 自然键处理冲突、空键、负数和0目标", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  const result = dataApi.__test.normalizeMonthlyTargets([
    target("2026-07-01", "S1", "全新MG4", 10, 8),
    target("2026-07-15", "S1", "全新MG4", 10, 8),
    target("2026-07-01", "S2", "MG7", 5, 4),
    target("2026-07-02", "S2", "MG7", 6, 4),
    target("2026-07-01", "S3", "MG5", 3, 2),
    target("2026-07-02", "S3", "MG5", 3, 9),
    target("2026-07-01", "", "MG5", 3, 1),
    target("2026-07-01", "S4", "MG5", -1, -2),
    target("2026-07-01", "S5", "Cyberster", 0, 0)
  ], dateInfo);
  const orderRows = result.targets.filter((row) => row.orderHasTarget);
  const retailRows = result.targets.filter((row) => row.retailHasTarget);
  assert.equal(orderRows.length, 8);
  assert.equal(retailRows.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(orderRows.filter((row) => row.dealerCode === "S1").map((row) => row.orderTarget))), [10, 10]);
  assert.equal(orderRows.filter((row) => row.dealerCode === "S2").reduce((sum, row) => sum + row.orderTarget, 0), 11);
  assert.equal(orderRows.filter((row) => row.dealerCode === "").reduce((sum, row) => sum + row.orderTarget, 0), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(retailRows.map((row) => [row.dealerCode, row.retailTarget]).sort())), [["S1", 8], ["S2", 4], ["S5", 0]]);
  assert.equal(result.audit.duplicateRows, 5);
  assert.equal(result.audit.conflictOrderKeys, 0);
  assert.equal(result.audit.conflictRetailKeys, 1);
  assert.equal(result.audit.conflictByStore.order.S2, undefined);
  assert.equal(result.audit.conflictByStore.retail.S3, 1);
  assert.equal(result.audit.invalidKeyRows, 1);
  assert.equal(result.audit.negativeOrderRows, 1);
  assert.equal(result.audit.negativeRetailRows, 1);
});

test("u32 订单目标空品牌不自动补 MG，剔除该行并计入 invalidKeyRows", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  const result = dataApi.__test.normalizeOrderTargets([
    { 日期: "2026-07-01", 品牌: "", 经销商代码: "S_EMPTY_BRAND", 车系: "全新MG4", 订单目标: 99 },
    { 日期: "2026-07-01", 品牌: "MG", 经销商代码: "S_VALID", 车系: "全新MG4", 订单目标: 10 }
  ], dateInfo);
  assert.deepEqual(JSON.parse(JSON.stringify(result.targets.map((row) => [row.brand, row.dealerCode, row.orderTarget]))), [
    ["MG", "S_VALID", 10]
  ]);
  assert.equal(result.audit.invalidKeyRows, 1);
});

test("目标值为空字符串、全空格、null、undefined 时不进入订单/零售目标分母并计入无效审计", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  const result = dataApi.__test.normalizeMonthlyTargets([
    target("2026-07-01", "S_EMPTY", "全新MG4", "", ""),
    target("2026-07-01", "S_SPACE", "全新MG4", "  ", "  "),
    target("2026-07-01", "S_NULL", "全新MG4", null, null),
    target("2026-07-01", "S_UNDEFINED", "全新MG4", undefined, undefined)
  ], dateInfo);
  assert.equal(result.targets.length, 0);
  assert.equal(result.audit.invalidOrderRows, 4);
  assert.equal(result.audit.invalidRetailRows, 4);
  assert.equal(result.audit.negativeOrderRows, 0);
  assert.equal(result.audit.negativeRetailRows, 0);
  assert.equal(result.audit.invalidKeyRows, 0);
});

test("同月使用整月目标与月初至今天实际，目标过滤下推组织字段并保留无 code fallback", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-10", endDate: "2026-07-15" }, "2026-07-21");
  assert.deepEqual(JSON.parse(JSON.stringify(dateInfo.targetRange)), { startDate: "2026-07-01", endDate: "2026-07-31" });
  assert.deepEqual(JSON.parse(JSON.stringify(dateInfo.targetActualRange)), { startDate: "2026-07-01", endDate: "2026-07-21" });
  const filters = dataApi.__test.targetFilters({ brand: "MG", areaCode: "A1", districtCode: "D1", vehicleSeries: ["全新MG4", "MG 4X"] }, dateInfo.targetRange);
  assert.deepEqual(JSON.parse(JSON.stringify(filters.map((item) => item.field))), ["目标日期", "rfs_code", "mac_code", "车系"]);
  assert.deepEqual(JSON.parse(JSON.stringify(filters.find((item) => item.field === "rfs_code"))), { field: "rfs_code", type: "EQ", value: "A1" });
  assert.deepEqual(JSON.parse(JSON.stringify(filters.find((item) => item.field === "mac_code"))), { field: "mac_code", type: "EQ", value: "D1" });
  assert.deepEqual(JSON.parse(JSON.stringify(filters.find((item) => item.field === "车系"))), { field: "车系", type: "IN", value: ["全新MG4", "MG 4X"] });
  const dealerFilters = dataApi.__test.targetFilters({ brand: "MG", dealerCode: "S1", vehicleSeries: [] }, dateInfo.targetRange);
  assert.deepEqual(JSON.parse(JSON.stringify(dealerFilters.map((item) => item.field))), ["目标日期", "dealer_code"]);
  const fallbackFilters = dataApi.__test.targetFilters({ brand: "MG", areaCode: "", districtCode: "", dealerCode: "", vehicleSeries: [] }, dateInfo.targetRange);
  assert.deepEqual(JSON.parse(JSON.stringify(fallbackFilters.map((item) => item.field))), ["目标日期"]);
});

test("SMG310 类组织筛选映射到目标表 rfs_code/mac_code/dealer_code 字段", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" }, "2026-07-21");
  const filters = dataApi.__test.targetFilters({ brand: "MG", areaCode: "SMG310", districtCode: "MAC310", dealerCode: "S31001", vehicleSeries: ["全新MG4"] }, dateInfo.targetRange);
  const byField = Object.fromEntries(filters.map((item) => [item.field, item.value]));
  assert.equal(byField.rfs_code, "SMG310");
  assert.equal(byField.mac_code, "MAC310");
  assert.equal(byField.dealer_code, "S31001");
  assert.deepEqual(JSON.parse(JSON.stringify(byField["车系"])), ["全新MG4"]);
});

test("订单/零售目标实际 SQL 保留自然月、MG、一级经销商代码和汇报车系维度", () => {
  const sql = dataApi.__test.targetActualSql({ brand: "MG", vehicleSeries: ["全新MG4", "MG 4X"] }, { startDate: "2026-07-01", endDate: "2026-07-20" });
  assert.match(sql, /`品牌名称` = 'MG'/);
  assert.match(sql, /一级经销商代码/);
  assert.match(sql, /汇报车系名称/);
  assert.match(sql, /`汇报车系名称` IN \('全新MG4', 'MG 4X'\)/);
  assert.match(sql, /当日订单数（首触）/);
  assert.match(sql, /target_actual_orders/);
  assert.match(sql, /当日零售数/);
  assert.match(sql, /target_actual_retail/);
  assert.match(sql, /GROUP BY[\s\S]*品牌名称[\s\S]*一级经销商代码[\s\S]*汇报车系名称/);
});

test("生产读取路径对跨月、未来月和非 MG 零请求；当前 MG 单月请求新 DS 和双实际 SQL", async () => {
  const future = await loadDataApiWithMonthlyTargetRequests();
  assert.equal((await future.dataApi.loadMonthlyTargetRaw({ brand: "MG" }, { startDate: "2026-08-10", endDate: "2026-08-15" })).status, "invalid_range");
  assert.equal(future.calls.length, 0);

  const crossMonth = await loadDataApiWithMonthlyTargetRequests();
  assert.equal((await crossMonth.dataApi.loadMonthlyTargetRaw({ brand: "MG" }, { startDate: "2026-06-25", endDate: "2026-07-10" })).status, "invalid_range");
  assert.equal(crossMonth.calls.length, 0);

  const nonMg = await loadDataApiWithMonthlyTargetRequests();
  assert.equal((await nonMg.dataApi.loadMonthlyTargetRaw({ brand: "荣威" }, { startDate: "2026-07-01", endDate: "2026-07-20" })).status, "non_mg");
  assert.equal(nonMg.calls.length, 0);

  const currentMonth = await loadDataApiWithMonthlyTargetRequests();
  assert.equal((await currentMonth.dataApi.loadMonthlyTargetRaw({ brand: "MG", vehicleSeries: ["全新MG4"] }, { startDate: "2026-07-10", endDate: "2026-07-15" })).status, "ready");
  const orderTargetRequest = currentMonth.calls.find((call) => call.url.includes("u32cb7e789f7443ff84160b4/preview-with-filter-async"));
  const retailTargetRequest = currentMonth.calls.find((call) => call.url.includes("r05b1e3995b0b4480991a4b8/preview-with-filter-async"));
  const actualRequest = currentMonth.calls.find((call) => call.url === "/api/data-source/execute-sql-query");
  assert.ok(orderTargetRequest);
  assert.ok(retailTargetRequest);
  assert.deepEqual(orderTargetRequest.body.filter.conditions.find((condition) => condition.value.name === "日期").value.filterValue, ["2026-07-01", "2026-07-31"]);
  assert.deepEqual(orderTargetRequest.body.filter.conditions.find((condition) => condition.value.name === "品牌").value.filterValue, ["MG"]);
  assert.deepEqual(retailTargetRequest.body.filter.conditions.find((condition) => condition.value.name === "目标日期").value.filterValue, ["2026-07-01", "2026-07-31"]);
  assert.match(actualRequest.body.query, /target_actual_orders/);
  assert.match(actualRequest.body.query, /target_actual_retail/);
});

test("订单 preview 始终只下推日期/品牌/车系，零售仍下推既有组织字段", async () => {
  const targetRows = [
    ["2026-07-01", "S1", "全新MG4", 10, 8],
    ["2026-07-01", "S9", "全新MG4", 99, 88]
  ];
  const params = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "S1", vehicleSeries: ["全新MG4"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };

  const fullMeta = await loadDataApiWithMonthlyTargetRequests("2026-07-21", { targetPreviewRows: targetRows });
  const fullRaw = await fullMeta.dataApi.loadMonthlyTargetRaw(params, range);
  const fullOrderFilterFields = fullMeta.calls.find((call) => call.url.includes("u32cb7e789f7443ff84160b4/preview-with-filter-async")).body.filter.conditions.map((condition) => condition.value.name);
  const fullRetailFilterFields = fullMeta.calls.find((call) => call.url.includes("r05b1e3995b0b4480991a4b8/preview-with-filter-async")).body.filter.conditions.map((condition) => condition.value.name);
  assert.deepEqual(fullOrderFilterFields, ["日期", "品牌", "车系"]);
  assert.deepEqual(fullRetailFilterFields, ["目标日期", "rfs_code", "mac_code", "dealer_code", "车系"]);

  const missingOrgMeta = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
    orderTargetFields: ["日期", "品牌", "经销商代码", "车系", "订单目标"],
    retailTargetFields: ["目标日期", "dealer_code", "车系", "总零售目标"],
    targetPreviewRows: targetRows
  });
  const fallbackRaw = await missingOrgMeta.dataApi.loadMonthlyTargetRaw(params, range);
  const fallbackOrderFilterFields = missingOrgMeta.calls.find((call) => call.url.includes("u32cb7e789f7443ff84160b4/preview-with-filter-async")).body.filter.conditions.map((condition) => condition.value.name);
  const fallbackRetailFilterFields = missingOrgMeta.calls.find((call) => call.url.includes("r05b1e3995b0b4480991a4b8/preview-with-filter-async")).body.filter.conditions.map((condition) => condition.value.name);
  assert.deepEqual(fallbackOrderFilterFields, ["日期", "品牌", "车系"]);
  assert.deepEqual(fallbackRetailFilterFields, ["目标日期", "dealer_code", "车系"]);

  const validDealers = [dealer("S1")];
  const fullWorkbench = metrics.buildWorkbench({ sales: [sale("S1", 1, 1)], salesPrev: [], salesWeek: [], monthlyTarget: fullRaw }, { validDealers });
  const fallbackWorkbench = metrics.buildWorkbench({ sales: [sale("S1", 1, 1)], salesPrev: [], salesWeek: [], monthlyTarget: fallbackRaw }, { validDealers });
  assert.equal(fullWorkbench.monthlyTarget.order.target, 10);
  assert.equal(fallbackWorkbench.monthlyTarget.order.target, fullWorkbench.monthlyTarget.order.target);
  assert.equal(fallbackWorkbench.monthlyTarget.validDealerMissingRows, 0);
  assert.equal(fallbackWorkbench.targetAudit.validDealerMissingRows, 1);
});

test("生产 loadMonthlyTargetRaw 在 u32 缺任一订单必需字段时订单侧 fail-closed，零售侧仍 ready", async () => {
  const requiredFields = ["日期", "品牌", "车系", "订单目标"];
  for (const missingField of requiredFields) {
    const context = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
      orderTargetFields: ["日期", "品牌", "大区", "大区代码", "小区", "小区代码", "经销商", "经销商代码", "车系", "订单目标"].filter((field) => field !== missingField),
      orderTargetPreviewRows: [["2026-07-01", "MG", "S1", "全新MG4", 10]],
      retailTargetPreviewRows: [["2026-07-01", "S1", "全新MG4", 8]]
    });
    const raw = await context.dataApi.loadMonthlyTargetRaw(
      { brand: "MG", vehicleSeries: ["全新MG4"] },
      { startDate: "2026-07-01", endDate: "2026-07-20" }
    );
    assert.equal(raw.orderStatus, "unavailable", `u32 缺 ${missingField} 时订单侧必须 unavailable`);
    assert.equal(raw.retailStatus, "ready", `u32 缺 ${missingField} 时零售侧必须保持 ready`);
    assert.match(raw.orderError, new RegExp(missingField));
    assert.equal(context.calls.some((call) => call.url.includes("u32cb7e789f7443ff84160b4/preview-with-filter-async")), false);
    assert.equal(context.calls.some((call) => call.url.includes("r05b1e3995b0b4480991a4b8/preview-with-filter-async")), true);
  }
});

test("生产 loadMonthlyTargetRaw 在 r05 缺任一零售必需字段时零售侧 fail-closed，订单侧仍 ready", async () => {
  const requiredFields = ["目标日期", "dealer_code", "车系", "总零售目标"];
  for (const missingField of requiredFields) {
    const context = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
      retailTargetFields: ["目标日期", "rfs_code", "mac_code", "dealer_code", "车系", "总零售目标"].filter((field) => field !== missingField),
      orderTargetPreviewRows: [["2026-07-01", "MG", "S1", "全新MG4", 10]],
      retailTargetPreviewRows: [["2026-07-01", "S1", "全新MG4", 8]]
    });
    const raw = await context.dataApi.loadMonthlyTargetRaw(
      { brand: "MG", vehicleSeries: ["全新MG4"] },
      { startDate: "2026-07-01", endDate: "2026-07-20" }
    );
    assert.equal(raw.orderStatus, "ready", `r05 缺 ${missingField} 时订单侧必须保持 ready`);
    assert.equal(raw.retailStatus, "unavailable", `r05 缺 ${missingField} 时零售侧必须 unavailable`);
    assert.match(raw.retailError, new RegExp(missingField));
    assert.equal(context.calls.some((call) => call.url.includes("u32cb7e789f7443ff84160b4/preview-with-filter-async")), true);
    assert.equal(context.calls.some((call) => call.url.includes("r05b1e3995b0b4480991a4b8/preview-with-filter-async")), false);
  }
});

test("invalid_range 传播到没有单店目标的销售事实行，导出状态不降级为目标未产出", () => {
  const workbench = metrics.buildWorkbench({
    sales: [sale("S1", 2, 1)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { status: "invalid_range", targets: [], targetActuals: [], audit: {}, months: [] }
  }, { validDealers: [dealer("S1")] });
  assert.equal(workbench.monthlyTarget.status, "invalid_range");
  assert.equal(workbench.stores[0].monthlyTarget.status, "invalid_range");
  assert.equal(workbench.stores[0].monthlyTarget.order.status, "invalid_range");
  assert.equal(workbench.stores[0].monthlyTarget.retail.status, "invalid_range");
});

test("monthlyTarget loading 映射到总体和表格目标槽加载态且销售事实可用", () => {
  const workbench = metrics.buildWorkbench({
    sales: [sale("S1", 2, 1)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: dataApi.__test.monthlyTargetLoadingRaw({ brand: "MG" }, { startDate: "2026-07-01", endDate: "2026-07-20" })
  }, { validDealers: [dealer("S1")] });
  assert.equal(workbench.salesCurrent.orders, 2);
  assert.equal(workbench.salesCurrent.retail, 1);
  assert.equal(workbench.monthlyTarget.status, "loading");
  assert.equal(workbench.monthlyTarget.order.status, "loading");
  assert.equal(workbench.monthlyTarget.retail.status, "loading");
  assert.equal(workbench.stores[0].monthlyTarget.status, "loading");
  assert.equal(workbench.stores[0].monthlyTarget.order.status, "loading");
  assert.equal(workbench.stores[0].monthlyTarget.retail.status, "loading");
  assert.equal(workbench.stores[0].monthlyTarget.order.target, 0);
});

test("顶部目标 raw 汇总 actual-only，明细目标仍按 validDealers scoped", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  const normalized = dataApi.__test.normalizeMonthlyTargets([
    target("2026-07-01", "S1", "全新MG4", 10, 8),
    target("2026-07-01", "S2", "全新MG4", 6, 5),
    target("2026-07-01", "S9", "全新MG4", 99, 88)
  ], dateInfo);
  const workbench = metrics.buildWorkbench({
    sales: [sale("S1", 99, 77), sale("S3", 4, 3)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: {
      ...normalized,
      targetActuals: [
        actual("2026-07-01", "S1", "全新MG4", 4, 3),
        actual("2026-07-01", "S3", "全新MG4", 4, 3),
        actual("2026-07-01", "S9", "全新MG4", 50, 40)
      ]
    }
  }, { validDealers: [dealer("S1"), dealer("S2"), dealer("S3")] });
  assert.equal(workbench.salesCurrent.orders, 103);
  assert.equal(workbench.monthlyTarget.order.target, 115);
  assert.equal(workbench.monthlyTarget.order.actual, 58);
  assert.equal(workbench.monthlyTarget.order.unconfiguredActual, 0);
  assert.equal(workbench.monthlyTarget.retail.target, 101);
  assert.equal(workbench.monthlyTarget.retail.actual, 46);
  assert.equal(workbench.monthlyTarget.retail.unconfiguredActual, 0);
  assert.equal(workbench.monthlyTarget.validDealerMissingRows, 0);
  assert.equal(workbench.targetAudit.unmappedOrderActualRows, 1);
  assert.equal(workbench.targetAudit.unmappedOrderActualTarget, 99);
  assert.deepEqual(JSON.parse(JSON.stringify(workbench.stores.filter((row) => !row.targetOnly).map((row) => row.code).sort())), ["S1", "S2", "S3"]);
  assert.equal(workbench.stores.filter((row) => row.targetOnly).some((row) => row.realDealerCode === "S9"), true);
  assert.equal(workbench.stores.find((row) => row.code === "S2").current.orders, 0);
});

test("2026-07 真实目标对账 fixture 覆盖 1542/22578/18580 和 5 个有效门店缺口", () => {
  assert.equal(realTargetAudit.targetDsId, "r05b1e3995b0b4480991a4b8");
  assert.equal(realTargetAudit.month, "2026-07");
  assert.equal(realTargetAudit.targetRows, 1542);
  assert.equal(realTargetAudit.orderTarget, 22578);
  assert.equal(realTargetAudit.retailTarget, 18580);
  assert.equal(realTargetAudit.blankOrNullDealerRows, 2);
  assert.equal(realTargetAudit.missingDealerCodeCount, 5);
  assert.equal(realTargetAudit.missingTargetRowsForDealerCodes, 20);
  assert.deepEqual(realTargetAudit.missingDealerCodes.map((item) => item.dealerCode), ["MQ7320", "MQ9331", "SQ2547", "SQ2881", "SQ7919"]);

  const targetRows = realTargetAudit.missingDealerCodes.flatMap((item) => Array.from({ length: item.targetRows }, (_, index) => target("2026-07-01", item.dealerCode, `真实缺口车系${index + 1}`, index === 0 ? item.orderTarget : 0, index === 0 ? item.retailTarget : 0)));
  const normalized = dataApi.__test.normalizeMonthlyTargets(targetRows, dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" }));
  const workbench = metrics.buildWorkbench({
    sales: [],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { ...normalized, targetActuals: [] }
  }, { validDealers: [] });
  assert.equal(workbench.monthlyTarget.validDealerMissingRows, 0);
  assert.equal(workbench.targetAudit.validDealerMissingRows, 5);
});

test("2026-07 u32 的 1576 行经归一化和组织汇总得到真实 7 区 22824，空代码115与重复输出均保留", () => {
  assert.equal(realOrderTargetAudit.targetDsId, "u32cb7e789f7443ff84160b4");
  assert.equal(realOrderTargetAudit.upstreamUploadDsId, "h9828e20e9026475091ae6ca");
  assert.equal(realOrderTargetAudit.upstreamUploadTarget, 22614);
  assert.equal(realOrderTargetAudit.orderTarget, 22824);
  assert.equal(realOrderTargetAudit.upstreamDifference, 210);
  assert.equal(realOrderTargetAudit.differenceAudit.totalDifference, 210);
  assert.deepEqual(realOrderTargetAudit.differenceAudit.cases.map((item) => item.difference), [138, 72]);
  assert.equal(realOrderTargetAudit.rowCount, 1576);
  assert.equal(realOrderTargetAudit.rawRows.length, 1576);
  assert.deepEqual(realOrderTargetAudit.areaTargets.map((item) => item.areaName), ["1南部区", "2华中区", "3西部区", "4苏皖区", "5北方区", "6东南区", "7中南区"]);
  assert.deepEqual(realOrderTargetAudit.areaTargets.map((item) => item.orderTarget), [1995, 5597, 1950, 2850, 2615, 5179, 2638]);

  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  const normalized = dataApi.__test.normalizeOrderTargets([
    ...realOrderTargetAudit.rawRows,
    { ...realOrderTargetAudit.rawRows[0], 品牌: "", 订单目标: 999 }
  ], dateInfo);
  assert.equal(normalized.targets.length, 1576);
  assert.equal(normalized.audit.orderOutputRows, 1576);
  assert.equal(normalized.audit.orderOutputTarget, 22824);
  assert.equal(normalized.audit.orderNameIdentityRows, 12);
  assert.equal(normalized.audit.invalidKeyRows, 1);
  const validDealers = [...realOrderTargetAudit.rawRows.reduce((map, row) => {
    const code = row["经销商代码"];
    if (code && !map.has(code)) {
      map.set(code, {
        code,
        name: row["经销商"] || code,
        area: row["大区"],
        areaCode: row["大区代码"],
        district: row["小区"],
        districtCode: row["小区代码"]
      });
    }
    return map;
  }, new Map()).values()];
  const workbench = metrics.buildWorkbench({
    sales: [],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { ...normalized, targetActuals: [] }
  }, { validDealers });
  const areas = organization.aggregateStores(workbench.stores, "area");
  assert.deepEqual(JSON.parse(JSON.stringify(areas.map((row) => [row.name, row.monthlyTarget.order.target]))), [
    ["1南部区", 1995],
    ["2华中区", 5597],
    ["3西部区", 1950],
    ["4苏皖区", 2850],
    ["5北方区", 2615],
    ["6东南区", 5179],
    ["7中南区", 2638]
  ]);
  assert.equal(areas.reduce((sum, row) => sum + row.monthlyTarget.order.target, 0), 22824);
  assert.equal(workbench.monthlyTarget.order.target, 22824);
  assert.equal(workbench.targetAudit.unmappedOrderActualRows, 12);
  assert.equal(workbench.targetAudit.unmappedOrderActualTarget, 115);
  const blankCodeDealerTargets = [...normalized.targets.filter((row) => !row.dealerCode).reduce((map, row) => {
    const key = `${row.dealerName}|${row.district}`;
    map.set(key, (map.get(key) || 0) + row.orderTarget);
    return map;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
  assert.deepEqual(JSON.parse(JSON.stringify(blankCodeDealerTargets)), [
    ["富阳和铭|舍煜", 21],
    ["上海云峰|章晓东", 36],
    ["深圳标域|张宗雷", 58]
  ]);
  ["MQ2762", "SQ2748"].forEach((dealerCode) => {
    const districtTargets = [...normalized.targets.filter((row) => row.dealerCode === dealerCode).reduce((map, row) => {
      map.set(row.district, (map.get(row.district) || 0) + row.orderTarget);
      return map;
    }, new Map()).values()].sort((left, right) => left - right);
    assert.deepEqual(districtTargets, [36, 36]);
  });
  assert.equal(normalized.audit.conflictOrderKeys, 0);
});

test("u32 组织筛选逐层以代码解析唯一规范名称，忽略冲突外部名并支持真实 code-only URL", () => {
  const targetSum = (rows) => rows.reduce((sum, row) => sum + Number(row["订单目标"] || 0), 0);
  const assertScope = (params, expectedRows, expectedTarget) => {
    const scoped = dataApi.__test.orderRowsInScope(realOrderTargetAudit.rawRows, params);
    assert.equal(scoped.length, expectedRows);
    assert.equal(targetSum(scoped), expectedTarget);
    return scoped;
  };
  const allRows = dataApi.__test.orderRowsInScope(realOrderTargetAudit.rawRows, { area: "全部", district: "全部", store: "全部", vehicleSeries: "全部车系" });
  assert.equal(allRows.length, 1576);
  assert.equal(targetSum(allRows), 22824);

  const areaRows = assertScope({ areaCode: "SMG444", area: "7中南区", district: "全部", store: "全部" }, 336, 5179);
  assertScope({ areaCode: "SMG444", district: "全部", store: "全部" }, 336, 5179);
  const blankRows = areaRows.filter((row) => !row["大区代码"] && !row["小区代码"] && !row["经销商代码"]);
  assert.equal(blankRows.length, 12);
  assert.equal(targetSum(blankRows), 115);

  const districtRows = assertScope({ areaCode: "SMG444", area: "7中南区", districtCode: "SMG106", district: "舍煜", store: "全部" }, 48, 827);
  assertScope({ areaCode: "SMG444", districtCode: "SMG106", store: "全部" }, 48, 827);
  assert.equal(targetSum(districtRows.filter((row) => !row["经销商代码"] && row["经销商"] === "上海云峰")), 36);

  assertScope({ areaCode: "SMG444", area: "7中南区", districtCode: "SMG106", district: "舍煜", dealerCode: "SQ2103", store: "深圳标域" }, 12, 207);
  assertScope({ areaCode: "SMG444", districtCode: "SMG106", dealerCode: "SQ2103" }, 12, 207);

  const nameOnlyRows = assertScope({ area: "6东南区", district: "舍煜" }, 44, 562);
  assert.equal(targetSum(nameOnlyRows.filter((row) => !row["经销商代码"])), 21);

  const missingArea = dataApi.__test.resolveOrderRowsInScope(realOrderTargetAudit.rawRows, { areaCode: "NOT-IN-U32", area: "6东南区" });
  assert.deepEqual(JSON.parse(JSON.stringify(missingArea.rows)), []);
  assert.equal(missingArea.audit.orderScopeStatus, "unavailable");
  assert.equal(missingArea.audit.orderScopeLevel, "area");
  assert.equal(missingArea.audit.orderScopeCode, "NOT-IN-U32");

  const ambiguousDistrict = dataApi.__test.resolveOrderRowsInScope(realOrderTargetAudit.rawRows, { area: "7中南区", districtCode: "SMG306", district: "周星" });
  assert.deepEqual(JSON.parse(JSON.stringify(ambiguousDistrict.rows)), []);
  assert.equal(ambiguousDistrict.audit.orderScopeStatus, "unavailable");
  assert.equal(ambiguousDistrict.audit.orderScopeLevel, "district");
  assert.match(ambiguousDistrict.audit.orderScopeError, /多个名称/);
});

test("u32 代码无法在当前层级唯一解析时订单侧 unavailable，零售侧继续 ready 并保留范围审计", async () => {
  const first = realOrderTargetAudit.rawRows[0];
  const context = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
    orderTargetPreviewRows: [[
      first["日期"],
      first["品牌"],
      first["大区"],
      first["大区代码"],
      first["小区"],
      first["小区代码"],
      first["经销商"],
      first["经销商代码"],
      first["车系"],
      first["订单目标"]
    ]],
    retailTargetPreviewRows: [["2026-07-01", "S1", "全新MG4", 8]]
  });
  const result = await context.dataApi.loadMonthlyTargetRaw({
    brand: "MG",
    areaCode: "NOT-IN-U32",
    area: first["大区"],
    vehicleSeries: ["全新MG4"]
  }, { startDate: "2026-07-01", endDate: "2026-07-20" });
  assert.equal(result.orderStatus, "unavailable");
  assert.equal(result.retailStatus, "ready");
  assert.equal(result.audit.orderScopeStatus, "unavailable");
  assert.equal(result.audit.orderScopeLevel, "area");
  assert.equal(result.audit.orderScopeCode, "NOT-IN-U32");
  assert.match(result.orderError, /未在当前 u32 范围命中/);
});

test("订单源失败只让订单不可用，零售源失败只让零售不可用", async () => {
  const params = { brand: "MG", vehicleSeries: ["全新MG4"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const orderFailed = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
    failOrderTarget: "u32 403",
    retailTargetPreviewRows: [["2026-07-01", "S1", "全新MG4", 8]]
  });
  const orderFailedRaw = await orderFailed.dataApi.loadMonthlyTargetRaw(params, range);
  assert.equal(orderFailedRaw.orderStatus, "unavailable");
  assert.equal(orderFailedRaw.retailStatus, "ready");
  let workbench = metrics.buildWorkbench({
    sales: [sale("S1", 2, 1)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { ...orderFailedRaw, targetActuals: [actual("2026-07-01", "S1", "全新MG4", 2, 1)] }
  }, { validDealers: [dealer("S1")] });
  assert.equal(workbench.monthlyTarget.order.status, "unavailable");
  assert.equal(workbench.monthlyTarget.retail.status, "configured");
  assert.equal(workbench.monthlyTarget.retail.target, 8);
  assert.equal(workbench.salesCurrent.orders, 2);

  const retailFailed = await loadDataApiWithMonthlyTargetRequests("2026-07-21", {
    failRetailTarget: "r05 403",
    orderTargetPreviewRows: [["2026-07-01", "MG", "S1", "全新MG4", 10]]
  });
  const retailFailedRaw = await retailFailed.dataApi.loadMonthlyTargetRaw(params, range);
  assert.equal(retailFailedRaw.orderStatus, "ready");
  assert.equal(retailFailedRaw.retailStatus, "unavailable");
  workbench = metrics.buildWorkbench({
    sales: [sale("S1", 2, 1)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { ...retailFailedRaw, targetActuals: [actual("2026-07-01", "S1", "全新MG4", 2, 1)] }
  }, { validDealers: [dealer("S1")] });
  assert.equal(workbench.monthlyTarget.order.status, "configured");
  assert.equal(workbench.monthlyTarget.order.target, 10);
  assert.equal(workbench.monthlyTarget.retail.status, "unavailable");
  assert.equal(workbench.salesCurrent.retail, 1);
});

test("全部车系和多选集合由同一过滤结果驱动，订单/零售达成独立计算", () => {
  const dateInfo = dataApi.__test.targetDateInfo({ startDate: "2026-07-01", endDate: "2026-07-20" });
  assert.equal(dataApi.__test.targetFilters({ brand: "MG", vehicleSeries: [] }, dateInfo.targetRange).some((item) => item.field === "车系"), false);
  assert.doesNotMatch(dataApi.__test.targetActualSql({ brand: "MG", vehicleSeries: [] }, dateInfo.targetActualRange), / IN \(/);
  const normalized = dataApi.__test.normalizeMonthlyTargets([
    target("2026-07-01", "S1", "全新MG4", 10, 8),
    target("2026-07-01", "S1", "MG 4X", 6, 4)
  ], dateInfo);
  const workbench = metrics.buildWorkbench({
    sales: [sale("S1", 16, 7)],
    salesPrev: [],
    salesWeek: [],
    monthlyTarget: { ...normalized, targetActuals: [actual("2026-07-01", "S1", "全新MG4", 4, 3), actual("2026-07-01", "S1", "MG 4X", 5, 2)] }
  }, { validDealers: [dealer("S1")] });
  assert.equal(workbench.monthlyTarget.order.target, 16);
  assert.equal(workbench.monthlyTarget.order.actual, 9);
  assert.equal(Math.round(workbench.monthlyTarget.order.achievement * 10) / 10, 56.3);
  assert.equal(workbench.monthlyTarget.retail.target, 12);
  assert.equal(workbench.monthlyTarget.retail.actual, 5);
  assert.equal(Math.round(workbench.monthlyTarget.retail.achievement * 10) / 10, 41.7);
});

test("组织订单/零售目标、实际、未配置实际和冲突数逐层守恒", () => {
  const stores = [
    { ...dealer("S1", "A1", "D1"), current: { orders: 3, retail: 2 }, previous: {}, week: {}, monthlyTarget: { order: { status: "configured", hasTarget: true, target: 10, actual: 3, unconfiguredActual: 1, conflictKeys: 1 }, retail: { status: "configured", hasTarget: true, target: 8, actual: 2, unconfiguredActual: 1, conflictKeys: 0 } } },
    { ...dealer("S2", "A1", "D1"), current: { orders: 0, retail: 0 }, previous: {}, week: {}, monthlyTarget: { order: { status: "configured", hasTarget: true, target: 5, actual: 0, unconfiguredActual: 0, conflictKeys: 0 }, retail: { status: "configured", hasTarget: true, target: 4, actual: 0, unconfiguredActual: 0, conflictKeys: 1 } } }
  ];
  const [district] = organization.aggregateStores(stores, "district");
  assert.equal(district.monthlyTarget.order.target, 15);
  assert.equal(district.monthlyTarget.order.actual, 3);
  assert.equal(district.monthlyTarget.order.unconfiguredActual, 1);
  assert.equal(district.monthlyTarget.order.conflictKeys, 1);
  assert.equal(district.monthlyTarget.order.achievement, 20);
  assert.equal(district.monthlyTarget.retail.target, 12);
  assert.equal(district.monthlyTarget.retail.actual, 2);
  assert.equal(district.monthlyTarget.retail.unconfiguredActual, 1);
  assert.equal(district.monthlyTarget.retail.conflictKeys, 1);
});

test("target-only 组织进入展示和目标守恒，但不改变销售排名、占比和有效门店数", () => {
  const configuredOrder = (targetValue) => ({
    status: "configured",
    error: "",
    order: { status: "configured", error: "", target: targetValue, actual: 0, achievement: 0, unconfiguredActual: 0, conflictKeys: 0, hasTarget: true, validDealerMissingRows: 0 },
    retail: { status: "no_target", error: "", target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0 },
    target: targetValue,
    actual: 0,
    achievement: 0,
    unconfiguredActual: 0,
    conflictKeys: 0,
    hasTarget: true,
    validDealerMissingRows: 0
  });
  const standard = {
    ...dealer("S1", "A1", "D1"),
    current: { leads: 10, arrivals: 5, drives: 3, orders: 2, retail: 1 },
    previous: {},
    week: {},
    monthlyTarget: { order: {}, retail: {} }
  };
  const targetOnly = {
    code: "dealer:name:district:name:area:name:root:6东南区:舍煜:missing",
    name: "舍煜",
    areaCode: "area:name:root:6东南区",
    area: "6东南区",
    districtCode: "district:name:area:name:root:6东南区:舍煜",
    district: "舍煜",
    sourceAreaCode: "",
    sourceDistrictCode: "",
    realDealerCode: "",
    targetOnly: true,
    current: {},
    previous: {},
    week: {},
    monthlyTarget: configuredOrder(115)
  };
  const areaRows = organization.buildViewRows({
    displayStores: [standard, targetOnly],
    peerStores: [standard, targetOnly],
    level: "area",
    nationalComplete: true
  });
  const standardArea = areaRows.find((row) => row.name === "大区1");
  const targetArea = areaRows.find((row) => row.name === "6东南区");
  assert.equal(standardArea.orderRank, "1/1");
  assert.equal(standardArea.orderShare, 100);
  assert.equal(standardArea.validStoreCount, 1);
  assert.equal(targetArea.orderRank, "--");
  assert.equal(targetArea.orderShare, null);
  assert.equal(targetArea.validStoreCount, 0);
  assert.equal(targetArea.monthlyTarget.order.target, 115);
  assert.equal(targetArea.current.orders, 0);
});
