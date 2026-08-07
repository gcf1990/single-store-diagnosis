import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");
const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
const metricsSource = await readFile(new URL("../metrics.js", import.meta.url), "utf8");
const SALES_DS_ID = "k4c14c31c595540a0a771f50";
const CANONICAL_FIELDS = [
  "经销商代码", "经销商名称", "大区名称", "小区名称", "当日下发线索数",
  "当日首触客流数", "当日首触试驾数", "当日订单数（首触）", "当日零售数"
];
const RAW_FIELDS = ["一级经销商代码", "父经销商简称", "经销商代码", ...CANONICAL_FIELDS.slice(2)];
const ALL_FILTER_FIELDS = [
  "品牌名称", "大区代码", "小区代码", "一级经销商代码", "日期", "经销商代码", "下发CRM时间",
  "线索渠道大类名称", "开业状态", "data_type_ch", "线索免考核", "需跟进", "试驾接待大区代码",
  "试驾接待小区代码", "试驾接待经销商代码", "试驾接待日期", "是否成功试驾", "订单经销商代码",
  "订单创建时间", "是否当天订当天退", "呼叫开始时间", "试驾接待时间", "汇报车系名称"
];
const responsePayloads = new Map();
let responseSequence = 0;

function response(payload, ok = true) {
  const token = `mock-response-${++responseSequence}`;
  responsePayloads.set(token, payload);
  return { ok, status: ok ? 200 : 500, text: async () => token };
}

function loadContext(fetchImpl, includeMetrics = false) {
  const context = {
    fetch: fetchImpl,
    location: { hostname: "localhost", pathname: "/" },
    setTimeout,
    clearTimeout,
    console: { warn() {}, error() {}, log() {} },
    JSON: {
      parse: (value) => responsePayloads.has(value) ? responsePayloads.get(value) : JSON.parse(value),
      stringify: (value) => JSON.stringify(value)
    },
    window: {}
  };
  vm.runInNewContext(vehicleSeriesSource, context);
  vm.runInNewContext(dataApiSource, context);
  if (includeMetrics) vm.runInNewContext(metricsSource, context);
  return context;
}

function rawRow(parentCode, parentName, originalCode, orders, retail, leads = 0) {
  const values = {
    "一级经销商代码": parentCode,
    "父经销商简称": parentName,
    "经销商代码": originalCode,
    "大区名称": "大区一",
    "小区名称": "小区一",
    "当日下发线索数": leads,
    "当日首触客流数": 0,
    "当日首触试驾数": 0,
    "当日订单数（首触）": orders,
    "当日零售数": retail
  };
  return RAW_FIELDS.map((field) => values[field] ?? "");
}

function previewFetch(rowsByStart, { failSql = true } = {}) {
  const tasks = new Map();
  const previewRequests = [];
  let taskSequence = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url === "/api/data-source/execute-sql-query") {
      const query = JSON.parse(options.body).query;
      if (/SELECT DISTINCT/.test(query)) return response({ response: { columns: [{ name: "汇报车系名称" }], preview: [["全新MG4"], ["MG 4X"]] } });
      if (failSql) return response({}, false);
      throw new Error("SQL success response was not configured");
    }
    const detailMatch = url.match(/^\/api\/data-source\/([^/]+)$/);
    if (detailMatch) {
      if (detailMatch[1] === "r05b1e3995b0b4480991a4b8") {
        return response({ response: { dsId: detailMatch[1], fields: ["目标日期", "rfs_code", "mac_code", "dealer_code", "车系", "总订单目标", "总零售目标"].map((name) => ({ name })) } });
      }
      return response({ response: { dsId: detailMatch[1], fields: ALL_FILTER_FIELDS.map((name) => ({ name })) } });
    }
    const previewMatch = url.match(/^\/api\/data-source\/([^/]+)\/preview-with-filter-async$/);
    if (previewMatch) {
      const body = JSON.parse(options.body);
      const conditions = body.filter?.conditions || [];
      const values = conditions.map((item) => item.value);
      const date = values.find((item) => item.name === "日期")?.filterValue?.[0] || "";
      const taskId = `task-${++taskSequence}`;
      tasks.set(taskId, { dsId: previewMatch[1], date, offset: body.offset, limit: body.limit });
      previewRequests.push({ dsId: previewMatch[1], values, offset: body.offset, limit: body.limit });
      return response({ response: { taskId } });
    }
    const taskMatch = url.match(/^\/api\/task\/(task-\d+)$/);
    if (taskMatch) return response({ response: { status: "FINISHED", result: { value: `file-${taskMatch[1]}` } } });
    if (url === "/api/account/readPreviewFile") {
      const { taskId } = JSON.parse(options.body);
      const task = tasks.get(taskId);
      const source = task?.dsId === SALES_DS_ID ? rowsByStart[task.date] : null;
      const rows = typeof source === "function" ? source(task) : (source || []);
      return response({ response: { columns: (task?.dsId === SALES_DS_ID ? RAW_FIELDS : []).map((name) => ({ name })), preview: rows } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return { fetchImpl, previewRequests };
}

function sqlFetch(rows) {
  const queries = [];
  return {
    queries,
    fetchImpl: async (url, options = {}) => {
      assert.equal(url, "/api/data-source/execute-sql-query");
      queries.push(JSON.parse(options.body).query);
      const query = JSON.parse(options.body).query;
      if (/SELECT DISTINCT/.test(query)) return response({ response: { columns: [{ name: "汇报车系名称" }], preview: [["全新MG4"], ["MG 4X"]] } });
      return response({ response: { columns: ["stage", ...CANONICAL_FIELDS].map((name) => ({ name })), preview: rows } });
    }
  };
}

const params = {
  brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "P1",
  startDate: "2026-07-01", endDate: "2026-07-03"
};

test("loadSalesRaw 默认合同仍读取月目标，显式跳过时返回 loading 且不发目标 preview", async () => {
  const rowsByStart = {
    "2026-07-01": [rawRow("P1", "父店一", "S1", 2, 1)],
    "2026-06-01": [],
    "2026-06-24": []
  };
  const defaultMock = previewFetch(rowsByStart);
  const defaultRaw = await loadContext(defaultMock.fetchImpl).window.RegionDataApi.loadSalesRaw(params);
  assert.ok(defaultMock.previewRequests.some((request) => request.dsId === "r05b1e3995b0b4480991a4b8"));
  assert.notEqual(defaultRaw.monthlyTarget.status, "loading");

  const skippedMock = previewFetch(rowsByStart);
  const skippedRaw = await loadContext(skippedMock.fetchImpl).window.RegionDataApi.loadSalesRaw(params, { includeMonthlyTarget: false });
  assert.equal(skippedRaw.monthlyTarget.status, "loading");
  assert.equal(skippedRaw.monthlyTarget.order, undefined);
  assert.equal(skippedMock.previewRequests.some((request) => request.dsId === "r05b1e3995b0b4480991a4b8"), false);
});

test("销售 SQL 三阶段按一级代码聚合、按父简称命名并保持 canonical 输出", async () => {
  const row = (stage) => [stage, "P1", "父店一", "大区一", "小区一", 10, 4, 2, 3, 1];
  const mock = sqlFetch([row("current"), row("previous"), row("week")]);
  const api = loadContext(mock.fetchImpl).window.RegionDataApi;
  const raw = await api.loadSalesRaw({ ...params, dealerCode: "P'1" });
  const query = mock.queries[0];

  assert.equal((query.match(/GROUP BY TRIM\(CAST\(`一级经销商代码` AS STRING\)\)/g) || []).length, 3);
  assert.equal((query.match(/TRIM\(CAST\(`一级经销商代码` AS STRING\)\) AS `经销商代码`/g) || []).length, 3);
  assert.equal((query.match(/MAX\(TRIM\(CAST\(`父经销商简称` AS STRING\)\)\) AS `经销商名称`/g) || []).length, 3);
  assert.equal((query.match(/`一级经销商代码` = 'P''1'/g) || []).length, 3);
  assert.doesNotMatch(query, /`经销商代码` = 'P''1'/);
  assert.deepEqual(Object.keys(raw.sales[0]).sort(), [...CANONICAL_FIELDS].sort());
  assert.deepEqual([raw.sales.length, raw.salesPrev.length, raw.salesWeek.length], [1, 1, 1]);
});

test("明细降级三阶段归一，空一级代码排除，白名单外代码由既有 metrics 过滤", async () => {
  const current = [
    rawRow("P1", "父店一", "P1", 10, 8, 20),
    rawRow("P1", "父店一", "S1", 3, 2, 5),
    rawRow("P1", "父店一", "S2", 2, 1, 5),
    rawRow("P1", "", "S3", 0, 0),
    rawRow("PX", "白名单外父店", "SX", 99, 99, 99),
    rawRow("", "空代码", "P1", 999, 999, 999)
  ];
  const rowsByStart = {
    "2026-07-01": current,
    "2026-06-01": [rawRow("P1", "父店一", "S1", 4, 3)],
    "2026-06-24": [rawRow("P1", "父店一", "S2", 5, 4)]
  };
  const mock = previewFetch(rowsByStart);
  const context = loadContext(mock.fetchImpl, true);
  const raw = await context.window.RegionDataApi.loadSalesRaw(params);

  assert.equal(raw.scopeEvidence.source, "fallback");
  assert.deepEqual([raw.sales.length, raw.salesPrev.length, raw.salesWeek.length], [5, 1, 1]);
  assert.ok([...raw.sales, ...raw.salesPrev, ...raw.salesWeek].every((row) => Object.keys(row).sort().join("|") === [...CANONICAL_FIELDS].sort().join("|")));
  assert.ok([...raw.sales, ...raw.salesPrev, ...raw.salesWeek].every((row) => row["经销商代码"]));
  const salesRequest = mock.previewRequests.find((request) => request.dsId === SALES_DS_ID);
  assert.equal(salesRequest.values.find((value) => value.name === "一级经销商代码")?.filterValue[0], "P1");
  assert.equal(salesRequest.values.some((value) => value.name === "经销商代码"), false);

  const validDealers = [{ code: "P1", name: "父店一", areaCode: "A1", area: "大区一", districtCode: "D1", district: "小区一" }];
  const parentNames = new Set(raw.sales.filter((row) => row["经销商代码"] === "P1").map((row) => row["经销商名称"]).filter(Boolean));
  assert.equal(validDealers.filter((dealer) => dealer.code === "P1").length, 1);
  assert.deepEqual([...parentNames], [validDealers[0].name]);

  const workbench = context.window.RegionMetrics.buildWorkbench(raw, { validDealers });
  assert.deepEqual({ orders: workbench.salesCurrent.orders, retail: workbench.salesCurrent.retail }, { orders: 114, retail: 110 });
  assert.equal(workbench.stores.map((store) => `${store.code}|${store.name}`).join(","), "P1|父店一");
  assert.deepEqual({ orders: workbench.stores[0].current.orders, retail: workbench.stores[0].current.retail }, { orders: 15, retail: 11 });
});

test("loadRegionRaw 公开销售明细路径也归一为父经销商 canonical 字段", async () => {
  const mock = previewFetch({
    "2026-07-01": [rawRow("P1", "父店一", "S1", 3, 2)],
    "2026-06-01": [rawRow("P1", "父店一", "S2", 2, 1)]
  });
  const api = loadContext(mock.fetchImpl).window.RegionDataApi;
  const raw = await api.loadRegionRaw(params);

  assert.deepEqual(Object.keys(raw.sales[0]).sort(), [...CANONICAL_FIELDS].sort());
  assert.equal(raw.sales[0]["经销商代码"], "P1");
  assert.equal(raw.sales[0]["经销商名称"], "父店一");
  assert.equal("一级经销商代码" in raw.sales[0], false);
  assert.equal(raw.salesPrev[0]["经销商代码"], "P1");
});

test("销售明细首页满5000时继续读取短末页后才返回", async () => {
  const fullPage = Array(5000).fill(rawRow("P1", "父店一", "S1", 1, 1));
  const mock = previewFetch({
    "2026-07-01": ({ offset }) => offset === 0 ? fullPage : [rawRow("P1", "父店一", "S2", 1, 1)],
    "2026-06-01": [],
    "2026-06-24": []
  });
  const raw = await loadContext(mock.fetchImpl).window.RegionDataApi.loadSalesRaw(params);
  const currentRequests = mock.previewRequests.filter((request) => request.dsId === SALES_DS_ID
    && request.values.find((value) => value.name === "日期")?.filterValue?.[0] === "2026-07-01");

  assert.equal(raw.sales.length, 5001);
  assert.deepEqual(currentRequests.map((request) => [request.offset, request.limit]), [[0, 5000], [5000, 5000]]);
});

test("销售明细命中120000行安全上限仍为满页时 fail-closed", async () => {
  const fullPage = Array(5000).fill(rawRow("P1", "父店一", "S1", 1, 1));
  const mock = previewFetch({
    "2026-07-01": () => fullPage,
    "2026-06-01": [],
    "2026-06-24": []
  });
  const api = loadContext(mock.fetchImpl).window.RegionDataApi;

  await assert.rejects(api.loadSalesRaw(params), /销售明细分页达到安全上限 120000 行.*完整性不可证/);
  const currentRequests = mock.previewRequests.filter((request) => request.dsId === SALES_DS_ID
    && request.values.find((value) => value.name === "日期")?.filterValue?.[0] === "2026-07-01");
  assert.equal(currentRequests.length, 24);
  assert.equal(currentRequests.at(-1).offset, 115000);
});
