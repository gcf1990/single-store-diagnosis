import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadScript(path, context) {
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), "utf8"), context);
}

const context = { window: {}, globalThis: {} };
await loadScript("../metrics.js", context);
await loadScript("../organization-view.js", context);
const metrics = context.window.RegionMetrics;
const organization = context.window.OrganizationView;

const dealer = (code, areaCode, districtCode) => ({ code, name: `门店${code}`, areaCode, area: `大区${areaCode.slice(-1)}`, districtCode, district: `小区${districtCode.slice(-1)}` });
const sales = (code, values = {}) => ({
  "经销商代码": code,
  "经销商名称": `门店${code}`,
  "大区名称": values.area || "大区1",
  "小区名称": values.district || "小区1",
  "当日下发线索数": values.leads || 0,
  "当日首触客流数": values.arrivals || 0,
  "当日首触试驾数": values.drives || 0,
  "当日订单数（首触）": values.orders || 0,
  "当日零售数": values.retail || 0
});
const process = (code, total, negative, count = negative) => ({
  code,
  name: `门店${code}`,
  total,
  negative,
  rate: total ? negative / total * 100 : null,
  problems: [{ name: "零钩子", count, denominator: total, rate: total ? count / total * 100 : null, children: [{ name: "子问题", count }] }]
});
const driveProblem = (code, total, negative, denominator = total) => ({
  code,
  name: `门店${code}`,
  total,
  negative,
  rate: total ? negative / total * 100 : null,
  problems: [{ name: "版本推荐", count: negative, denominator, rate: denominator ? negative / denominator * 100 : null, children: [{ name: "版本讲解不足", count: negative }] }]
});
const driveTag = (code, id) => ({
  "经销商代码": code,
  "试驾清单ID": id,
  "一级标签": "版本推荐",
  "二级标签": "版本讲解不足",
  "是否判定正负向": "已判向",
  "标签正负向": "负向"
});
const target = (dealerCode, orderTarget, retailTarget, series = "全新MG4") => ({
  month: "2026-07",
  brand: "MG",
  dealerCode,
  dealerName: `门店${dealerCode}`,
  vehicleSeries: series,
  orderTarget,
  retailTarget,
  orderHasTarget: true,
  retailHasTarget: true
});
const actual = (dealerCode, orders, retail, series = "全新MG4") => ({
  month: "2026-07",
  brand: "MG",
  dealerCode,
  vehicleSeries: series,
  actualOrders: orders,
  actualRetail: retail
});

function raw(overrides = {}) {
  return {
    sales: [], salesPrev: [], salesWeek: [], dcc: [], dccPrev: [], drive: [], drivePrev: [], orders: [], ordersPrev: [],
    ipTags: [], ipTagsPrev: [], ipTagsWeek: [], driveTags: [], driveTagsPrev: [], driveTagsWeek: [],
    ...overrides
  };
}

test("顶部过程 overall 仅由白名单内 per-store 原始分子分母求和", () => {
  const valid = [dealer("S1", "A1", "D1")];
  const data = metrics.buildWorkbench(raw({
    sales: [sales("S1", { leads: 10 })],
    ipAgg: process("__ALL__", 100, 91), ipAggPrev: process("__ALL__", 90, 81), ipAggWeek: process("__ALL__", 80, 71),
    ipAggStores: [process("S1", 10, 2), process("S2", 90, 89)],
    ipAggStoresPrev: [process("S1", 8, 1), process("S2", 82, 80)],
    ipAggStoresWeek: [process("S1", 6, 1), process("S2", 74, 70)],
    driveTagAgg: process("__ALL__", 50, 40), driveTagAggPrev: process("__ALL__", 40, 30), driveTagAggWeek: process("__ALL__", 30, 20),
    driveTagAggStores: [process("S1", 5, 1), process("S2", 45, 39)],
    driveTagAggStoresPrev: [process("S1", 4, 1), process("S2", 36, 29)],
    driveTagAggStoresWeek: [process("S1", 3, 0), process("S2", 27, 20)]
  }), { validDealers: valid });

  assert.deepEqual({ total: data.ip.total, negative: data.ip.negative, rate: data.ip.rate }, { total: 10, negative: 2, rate: 20 });
  assert.deepEqual({ total: data.ipPrev.total, negative: data.ipPrev.negative }, { total: 8, negative: 1 });
  assert.deepEqual({ total: data.ipWeek.total, negative: data.ipWeek.negative }, { total: 6, negative: 1 });
  assert.deepEqual({ total: data.driveTags.total, negative: data.driveTags.negative }, { total: 5, negative: 1 });
  assert.equal(data.ip.problems[0].denominator, 10);
  assert.equal(data.ip.problems[0].children[0].count, 2);

  const empty = metrics.buildWorkbench(raw({ ipAgg: process("__ALL__", 100, 99), ipAggStores: [process("S2", 100, 99)] }), { validDealers: valid });
  assert.deepEqual({ total: empty.ip.total, negative: empty.ip.negative, rate: empty.ip.rate }, { total: 0, negative: 0, rate: null });
});

test("门店集合由当期、上期、周期和过程事实代码并集生成，不补纯白名单零事实门店", () => {
  const valid = [dealer("S1", "A1", "D1"), dealer("S2", "A1", "D1"), dealer("S3", "A1", "D2"), dealer("S4", "A2", "D3")];
  const data = metrics.buildWorkbench(raw({
    sales: [sales("S1", { leads: 10, orders: 2 })],
    salesPrev: [sales("S2", { leads: 20, orders: 4 })],
    ipAggStores: [process("S3", 5, 1)]
  }), { validDealers: valid });

  assert.deepEqual(Array.from(data.stores, (item) => item.code).sort(), ["S1", "S2", "S3"]);
  assert.equal(data.stores.find((item) => item.code === "S2").current.orders, 0);
  assert.equal(data.stores.find((item) => item.code === "S2").previous.orders, 4);
  const [district] = organization.aggregateStores(data.stores.filter((item) => item.districtCode === "D1"), "district");
  assert.equal(district.current.orders, 2);
  assert.equal(district.previous.orders, 4);
});

test("v2.16 顶部 sales 和月目标使用 raw summary，门店明细仍按 validDealers scoped", () => {
  const valid = [dealer("S1", "A1", "D1")];
  const data = metrics.buildWorkbench(raw({
    sales: [
      sales("S1", { leads: 10, arrivals: 5, drives: 3, orders: 2, retail: 1 }),
      sales("S2", { leads: 20, arrivals: 8, drives: 4, orders: 3, retail: 2 })
    ],
    salesPrev: [
      sales("S1", { leads: 4, arrivals: 2, drives: 1, orders: 1, retail: 1 }),
      sales("S2", { leads: 6, arrivals: 3, drives: 2, orders: 2, retail: 1 })
    ],
    salesWeek: [
      sales("S1", { leads: 5, arrivals: 2, drives: 1, orders: 1, retail: 0 }),
      sales("S2", { leads: 7, arrivals: 4, drives: 3, orders: 2, retail: 1 })
    ],
    monthlyTarget: {
      status: "ready",
      targets: [target("S1", 10, 8), target("S2", 5, 4)],
      targetActuals: [actual("S1", 2, 1), actual("S2", 3, 2), actual("S3", 4, 3)],
      audit: {},
      months: ["2026-07"]
    }
  }), { validDealers: valid });

  assert.equal(data.hasSummaryData, true);
  assert.deepEqual(
    { leads: data.salesCurrent.leads, arrivals: data.salesCurrent.arrivals, drives: data.salesCurrent.drives, orders: data.salesCurrent.orders, retail: data.salesCurrent.retail },
    { leads: 30, arrivals: 13, drives: 7, orders: 5, retail: 3 }
  );
  assert.deepEqual({ orders: data.salesPrevious.orders, retail: data.salesPrevious.retail }, { orders: 3, retail: 2 });
  assert.deepEqual({ orders: data.salesWeek.orders, retail: data.salesWeek.retail }, { orders: 3, retail: 1 });
  assert.equal(data.monthlyTarget.order.target, 15);
  assert.equal(data.monthlyTarget.order.actual, 9);
  assert.equal(data.monthlyTarget.retail.target, 12);
  assert.equal(data.monthlyTarget.retail.actual, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(data.stores.filter((item) => !item.targetOnly).map((item) => item.code))), ["S1"]);
  assert.equal(data.stores.filter((item) => item.targetOnly).some((item) => item.realDealerCode === "S2"), true);
  assert.equal(data.stores.some((item) => item.realDealerCode === "S3"), false);
  assert.deepEqual(JSON.parse(JSON.stringify([...data.targetByStore.keys()])), ["S1"]);
});

test("validDealers 为空但 raw 顶部有事实时保留顶部渲染标记且明细为空", () => {
  const data = metrics.buildWorkbench(raw({
    sales: [sales("S2", { leads: 12, arrivals: 4, drives: 2, orders: 1, retail: 1 })]
  }), { validDealers: [] });

  assert.equal(data.hasSummaryData, true);
  assert.equal(data.hasRawSalesData, true);
  assert.equal(data.hasTargetDisplayState, false);
  assert.equal(data.salesCurrent.orders, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(data.stores)), []);
});

test("v2.16 顶部渲染状态拆分 raw sales 与 target display state", () => {
  const configuredTarget = { status: "ready", targets: [target("S2", 5, 4)], targetActuals: [], audit: {}, months: ["2026-07"] };
  const cases = [
    ["loading无sales", raw({ monthlyTarget: { status: "loading", targets: [], targetActuals: [], audit: {}, months: [] } }), false, true],
    ["单侧unavailable无sales", raw({ monthlyTarget: { status: "ready", orderStatus: "unavailable", retailStatus: "ready", targets: [], targetActuals: [], audit: {}, months: [] } }), false, true],
    ["完全无数据", raw(), false, false],
    ["raw-only", raw({ sales: [sales("S1", { orders: 0, retail: 0 })] }), true, false],
    ["configured target无sales", raw({ monthlyTarget: configuredTarget }), false, true],
    ["actual-only无sales", raw({ monthlyTarget: { status: "ready", targets: [], targetActuals: [actual("S3", 2, 1)], audit: {}, months: ["2026-07"] } }), false, true]
  ];

  cases.forEach(([name, input, expectedRawSales, expectedTargetState]) => {
    const data = metrics.buildWorkbench(input, { validDealers: [] });
    assert.equal(data.hasRawSalesData, expectedRawSales, name);
    assert.equal(data.hasTargetDisplayState, expectedTargetState, name);
    assert.equal(data.hasSummaryData, expectedRawSales || expectedTargetState, name);
  });
});

test("SQL overall 保留跨店同试驾ID distinct 语义并与 fallback 全范围一致", () => {
  const valid = [dealer("S1", "A1", "D1"), dealer("S2", "A1", "D1")];
  const sqlData = metrics.buildWorkbench(raw({
    driveTagAgg: driveProblem("__ALL__", 1, 1, 1),
    driveTagAggStores: [driveProblem("S1", 1, 1, 1), driveProblem("S2", 1, 1, 1)]
  }), { validDealers: valid });
  const fallbackData = metrics.buildWorkbench(raw({
    driveTags: [driveTag("S1", "DUPLICATED_RECEIVE_ID"), driveTag("S2", "DUPLICATED_RECEIVE_ID")]
  }), { validDealers: valid });

  const sqlProblem = sqlData.driveTags.problems.find((item) => item.name === "版本推荐");
  const fallbackProblem = fallbackData.driveTags.problems.find((item) => item.name === "版本推荐");
  assert.deepEqual(
    { total: sqlData.driveTags.total, negative: sqlData.driveTags.negative, count: sqlProblem.count, denominator: sqlProblem.denominator },
    { total: fallbackData.driveTags.total, negative: fallbackData.driveTags.negative, count: fallbackProblem.count, denominator: fallbackProblem.denominator }
  );
  assert.deepEqual({ total: sqlData.driveTags.total, negative: sqlData.driveTags.negative, count: sqlProblem.count, denominator: sqlProblem.denominator }, { total: 1, negative: 1, count: 1, denominator: 1 });
  const storeRows = JSON.parse(JSON.stringify(sqlData.stores.map((store) => [store.code, store.driveTag.total, store.driveTag.negative]).sort()));
  assert.deepEqual(storeRows, [["S1", 1, 1], ["S2", 1, 1]]);
});
