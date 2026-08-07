import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const metricsSource = await readFile(new URL("../metrics.js", import.meta.url), "utf8");
const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");
const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
let responseSequence = 0;

function response(payload, ok = true) {
  return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(payload ?? { code: 0, response: { token: ++responseSequence } }) };
}

function loadMetrics() {
  const context = { window: {}, globalThis: {} };
  vm.runInNewContext(metricsSource, context);
  return context.window.RegionMetrics;
}

function loadDataApi(fetchImpl = async () => {
  throw new Error("Unexpected fetch");
}) {
  const context = {
    fetch: fetchImpl,
    location: { hostname: "localhost", pathname: "/" },
    setTimeout,
    clearTimeout,
    console: { warn() {}, error() {}, log() {} },
    window: { __IRON_METRICS_TEST__: true }
  };
  vm.runInNewContext(vehicleSeriesSource, context);
  vm.runInNewContext(dataApiSource, context);
  return context.window.RegionDataApi;
}

function tagRow({ id, tag1, tag2 = "默认子标签", judged = "", polarity = "", code = "MQ8530", time = "2026-07-01 10:00:00", brand = "MG" }) {
  return {
    "试驾清单ID": id,
    "品牌名称": brand,
    "经销商代码": code,
    "经销商简称": "测试门店",
    "大区代码": "A1",
    "小区代码": "D1",
    "试驾接待时间": time,
    "一级标签": tag1,
    "二级标签": tag2,
    "是否判定正负向": judged,
    "标签正负向": polarity
  };
}

function salesRow(code = "MQ8530") {
  return {
    "经销商代码": code,
    "经销商名称": "测试门店",
    "大区名称": "大区1",
    "小区名称": "小区1",
    "当日下发线索数": 100,
    "当日首触客流数": 40,
    "当日首触试驾数": 20,
    "当日订单数（首触）": 5,
    "当日零售数": 3
  };
}

function rawWithDriveTags(rows) {
  return {
    sales: [salesRow()],
    salesPrev: [],
    salesWeek: [],
    dcc: [],
    dccPrev: [],
    drive: [],
    drivePrev: [],
    orders: [],
    ordersPrev: [],
    ipTags: [],
    ipTagsPrev: [],
    ipTagsWeek: [],
    driveTags: rows,
    driveTagsPrev: [],
    driveTagsWeek: []
  };
}

function problemMap(aggregate) {
  return new Map((aggregate.problems || []).map((item) => [item.name, item]));
}

test("试驾标签明细 fallback 按一级标签提及分母和有效判向负向分子去重", () => {
  const metrics = loadMetrics();
  const rows = [
    ...Array.from({ length: 6 }, (_, index) => tagRow({ id: `V${index + 1}`, tag1: "版本推荐", tag2: index === 0 ? "版本讲解不足" : "版本已提及" })),
    tagRow({ id: "V1", tag1: "版本推荐", tag2: "预算版本未收口", judged: "已判向", polarity: "负向" }),
    tagRow({ id: "V1", tag1: "版本推荐", tag2: "配置差异未说明", judged: "已判向", polarity: "负向" }),
    ...Array.from({ length: 13 }, (_, index) => tagRow({ id: `C${index + 1}`, tag1: "顾虑承接", tag2: index === 0 ? "价格顾虑未承接" : "顾虑已承接" })),
    tagRow({ id: "C1", tag1: "顾虑承接", tag2: "价格顾虑未承接", judged: "是", polarity: "負向" }),
    ...Array.from({ length: 10 }, (_, index) => tagRow({ id: `K${index + 1}`, tag1: "竞品攻防", tag2: index === 0 ? "竞品对比不足" : "竞品已回应" })),
    tagRow({ id: "K1", tag1: "竞品攻防", tag2: "竞品贬低", judged: "负向", polarity: "反向" }),
    tagRow({ id: "IGNORED_EMPTY_CHILD", tag1: "版本推荐", tag2: "", judged: "已判向", polarity: "负向" }),
    tagRow({ id: "V2", tag1: "版本推荐", tag2: "版本讲解不足", judged: "未判向", polarity: "负向" }),
    tagRow({ id: "C2", tag1: "顾虑承接", tag2: "价格顾虑未承接", judged: "无法判定", polarity: "负向" })
  ];

  const workbench = metrics.buildWorkbench(rawWithDriveTags(rows), {
    validDealers: [{ code: "MQ8530", name: "测试门店", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }]
  });
  const store = workbench.stores.find((item) => item.code === "MQ8530");
  const problems = problemMap(store.driveTag);

  assert.deepEqual({ total: store.driveTag.total, negative: store.driveTag.negative }, { total: 29, negative: 3 });
  assert.deepEqual(
    ["版本推荐", "顾虑承接", "竞品攻防"].map((name) => [name, problems.get(name).count, problems.get(name).denominator, Number(problems.get(name).rate.toFixed(1))]),
    [["版本推荐", 1, 6, 16.7], ["顾虑承接", 1, 13, 7.7], ["竞品攻防", 1, 10, 10.0]]
  );
  assert.equal(problems.get("版本推荐").children.reduce((sum, item) => sum + item.count, 0), 2);
});

test("有分母且负向为 0 时保留问题项供表格显示 0.0%", () => {
  const metrics = loadMetrics();
  const workbench = metrics.buildWorkbench(rawWithDriveTags([
    tagRow({ id: "Z1", tag1: "版本推荐", tag2: "版本已提及", judged: "已判向", polarity: "正向" }),
    tagRow({ id: "Z2", tag1: "版本推荐", tag2: "版本已提及", judged: "", polarity: "" })
  ]));
  const version = problemMap(workbench.driveTags).get("版本推荐");

  assert.deepEqual({ count: version.count, denominator: version.denominator, rate: version.rate }, { count: 0, denominator: 2, rate: 0 });
});

test("空是否判定正负向与单店一致视为有效判向", () => {
  const metrics = loadMetrics();
  const workbench = metrics.buildWorkbench(rawWithDriveTags([
    tagRow({ id: "E1", tag1: "顾虑承接", tag2: "价格顾虑未承接", judged: "", polarity: "负向" }),
    tagRow({ id: "E2", tag1: "顾虑承接", tag2: "价格顾虑未承接", judged: "无法判定", polarity: "负向" })
  ]));
  const concern = problemMap(workbench.driveTags).get("顾虑承接");

  assert.deepEqual({ total: workbench.driveTags.total, negative: workbench.driveTags.negative }, { total: 2, negative: 1 });
  assert.deepEqual({ count: concern.count, denominator: concern.denominator, rate: concern.rate }, { count: 1, denominator: 2, rate: 50 });
});


test("实时试驾标签字段统一映射到单店规范字段", () => {
  const api = loadDataApi();
  const [row] = api.__test.normalizeRealtimeDriveTagRows([{
    receive_id: "3000000001",
    brand_name: "MG",
    trial_recv_dealer_code: "MQ8530",
    trial_recv_time: "2026-07-17 09:30:00",
    tag_level_1: "版本推荐",
    tag_level_2: "版本讲解不足",
    judgement_status: "已判向",
    sentiment: "负向"
  }]);

  assert.equal(row["试驾清单ID"], "3000000001");
  assert.equal(row["经销商代码"], "MQ8530");
  assert.equal(row["试驾接待时间"], "2026-07-17 09:30:00");
  assert.equal(row["一级标签"], "版本推荐");
  assert.equal(row["二级标签"], "版本讲解不足");
  assert.equal(row["是否判定正负向"], "已判向");
  assert.equal(row["标签正负向"], "负向");
});

test("实时试驾 SQL 使用展示名字段并按有效判向负向聚合", () => {
  const api = loadDataApi();
  const sql = api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, { startDate: "2026-07-17", endDate: "2026-07-17" }, {
    brand: "MG",
    areaCode: "A1",
    districtCode: "D1",
    dealerCode: "MQ8530"
  });

  ["试驾清单ID", "品牌名称", "大区代码", "小区代码", "经销商代码", "经销商简称", "试驾接待时间", "一级标签", "二级标签", "是否判定正负向", "标签正负向"].forEach((field) => {
    assert.match(sql, new RegExp(`\`${field}\``));
  });
  assert.match(sql, /judged = '' OR \(judged NOT LIKE '%未判%' AND judged NOT LIKE '%无法%' AND judged IN \('是', '已判向', '已判定', '已判定正负向', '正向', '负向'\)\)/);
  assert.doesNotMatch(sql, /`receive_id`|`brand_name`|`rfs_code`|`mac_code`|`trial_recv_dealer_code`|`dealer_shortnm`|`trial_recv_time`|`tag_level_1`|`tag_level_2`|`judgement_status`|`sentiment`/);
});

test("实时试驾 preview 过滤器保留物理字段且结束时间覆盖全天", () => {
  const api = loadDataApi();
  const filters = api.__test.realtimeDriveTagFilters({
    brand: "MG",
    areaCode: "A1",
    districtCode: "D1",
    dealerCode: "MQ8530"
  }, { startDate: "2026-07-17", endDate: "2026-07-17" });

  assert.deepEqual(JSON.parse(JSON.stringify(filters)), [
    { field: "brand_name", type: "EQ", value: "MG" },
    { field: "rfs_code", type: "EQ", value: "A1" },
    { field: "mac_code", type: "EQ", value: "D1" },
    { field: "trial_recv_dealer_code", type: "EQ", value: "MQ8530" },
    { field: "trial_recv_time", type: "BT", value: ["2026-07-17", "2026-07-17 23:59:59"] }
  ]);
});

test("实时 IP preview 字段契约不受试驾当天修复影响", () => {
  const api = loadDataApi();
  const filters = api.__test.realtimeIpTagFilters({
    brand: "MG",
    areaCode: "A1",
    districtCode: "D1",
    dealerCode: "MQ8530"
  }, { startDate: "2026-07-17", endDate: "2026-07-17" }, "呼叫开始时间");
  const normalized = JSON.parse(JSON.stringify(filters));
  const fields = normalized.map((item) => item.field);

  assert.deepEqual(normalized, [
    { field: "品牌名称", type: "EQ", value: "MG" },
    { field: "大区编码", type: "EQ", value: "A1" },
    { field: "小区编码", type: "EQ", value: "D1" },
    { field: "经销商代码", type: "EQ", value: "MQ8530" },
    { field: "呼叫开始时间", type: "BT", value: ["2026-07-17", "2026-07-17"] }
  ]);
  ["brand_name", "rfs_code", "mac_code", "trial_recv_dealer_code", "trial_recv_time"].forEach((field) => {
    assert.equal(fields.includes(field), false);
  });
});

test("SQL 聚合 payload 与明细 fallback 输出同一分子分母结构", () => {
  const api = loadDataApi();
  const payload = api.__test.aggregatePayload([
    { row_type: "summary", dealer_code: "MQ8530", dealer_name: "测试门店", tag1: "", tag2: "", total_count: 29, negative_count: 3, mention_count: 0 },
    { row_type: "problem_parent", dealer_code: "MQ8530", dealer_name: "测试门店", tag1: "版本推荐", tag2: "", total_count: 0, negative_count: 1, mention_count: 6 },
    { row_type: "problem_parent", dealer_code: "MQ8530", dealer_name: "测试门店", tag1: "顾虑承接", tag2: "", total_count: 0, negative_count: 1, mention_count: 13 },
    { row_type: "problem_parent", dealer_code: "MQ8530", dealer_name: "测试门店", tag1: "竞品攻防", tag2: "", total_count: 0, negative_count: 1, mention_count: 10 },
    { row_type: "problem_child", dealer_code: "MQ8530", dealer_name: "测试门店", tag1: "版本推荐", tag2: "版本讲解不足", total_count: 0, negative_count: 1, mention_count: 0 }
  ]);
  const store = payload.stores.find((item) => item.code === "MQ8530");
  const problems = problemMap(store);

  assert.deepEqual({ total: store.total, negative: store.negative, rate: Number(store.rate.toFixed(1)) }, { total: 29, negative: 3, rate: 10.3 });
  assert.deepEqual(
    ["版本推荐", "顾虑承接", "竞品攻防"].map((name) => [name, problems.get(name).count, problems.get(name).denominator, Number(problems.get(name).rate.toFixed(1))]),
    [["版本推荐", 1, 6, 16.7], ["顾虑承接", 1, 13, 7.7], ["竞品攻防", 1, 10, 10.0]]
  );
});

test("SQL 聚合异常时降级为明细 fallback 且返回规范字段", async () => {
  const tasks = new Map();
  let taskSequence = 0;
  const fields = ["品牌名称", "大区代码", "小区代码", "经销商代码", "呼叫开始时间", "试驾接待时间"];
  const driveColumns = ["试驾清单ID", "经销商代码", "经销商简称", "一级标签", "二级标签", "是否判定正负向", "标签正负向"];
  const fetchImpl = async (url, options = {}) => {
    if (url === "/api/data-source/execute-sql-query") return response({ error: { message: "mock sql failed" } }, false);
    const detailMatch = url.match(/^\/api\/data-source\/([^/]+)$/);
    if (detailMatch) return response({ response: { dsId: detailMatch[1], fields: fields.map((name) => ({ name })) } });
    const previewMatch = url.match(/^\/api\/data-source\/([^/]+)\/preview-with-filter-async$/);
    if (previewMatch) {
      const body = JSON.parse(options.body);
      const taskId = `task-${++taskSequence}`;
      tasks.set(taskId, { dsId: previewMatch[1], offset: body.offset, limit: body.limit });
      return response({ response: { taskId } });
    }
    const taskMatch = url.match(/^\/api\/task\/(task-\d+)$/);
    if (taskMatch) return response({ response: { status: "FINISHED", result: { value: `file-${taskMatch[1]}` } } });
    if (url === "/api/account/readPreviewFile") {
      const { taskId } = JSON.parse(options.body);
      const task = tasks.get(taskId);
      const isDrive = task?.dsId === "g9da02067b8a6432486f58f9";
      return response({ response: {
        columns: (isDrive ? driveColumns : []).map((name) => ({ name })),
        preview: isDrive ? [["3001", "MQ8530", "测试门店", "版本推荐", "版本讲解不足", "已判向", "负向"]] : []
      } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const api = loadDataApi(fetchImpl);
  const raw = await api.loadNegativeProcessStageRaw("current", {
    brand: "MG",
    districtCode: "D1",
    startDate: "2026-07-01",
    endDate: "2026-07-16"
  }, { range: { startDate: "2026-07-01", endDate: "2026-07-16" } }, []);

  assert.equal(raw.driveTags.length, 1);
  assert.equal(raw.driveTags[0]["试驾清单ID"], "3001");
  assert.equal(raw.driveTags[0]["一级标签"], "版本推荐");
  assert.equal(raw.driveTagAgg, undefined);
});

test("SQL 聚合结果达到安全上限时 fail-closed，不伪装为空样本", async () => {
  const columns = ["row_type", "dealer_code", "dealer_name", "tag1", "tag2", "total_count", "negative_count", "mention_count"].map((name) => ({ name }));
  const preview = Array.from({ length: 5000 }, () => ["summary", "MQ8530", "测试门店", "", "", 1, 0, 0]);
  const api = loadDataApi(async (url) => {
    if (url === "/api/data-source/execute-sql-query") return response({ response: { columns, preview } });
    throw new Error(`Unexpected fetch: ${url}`);
  });

  await assert.rejects(
    api.loadNegativeProcessStageRaw("current", { brand: "MG", startDate: "2026-07-01", endDate: "2026-07-16" }, { range: { startDate: "2026-07-01", endDate: "2026-07-16" } }, []),
    /SQL 聚合结果达到安全上限 5000 行，完整性不可证/
  );
});
