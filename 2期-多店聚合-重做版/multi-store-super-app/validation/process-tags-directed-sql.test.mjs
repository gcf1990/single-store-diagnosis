import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");
const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");

function response(payload, ok = true) {
  return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(payload) };
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

const params = { brand: "MG" };
const range = { startDate: "2026-07-01", endDate: "2026-07-20" };

function assertMg07Aliases(sql, field) {
  const condition = extractVehicleCondition(sql, field);
  assert.match(sql, new RegExp(field + "` IN \\('MG 07', 'MG07 EV', 'MG07 DMH'\\)"));
  assert.doesNotMatch(sql, new RegExp(field + "` IN \\([^)]*'MG7'"));
  assert.doesNotMatch(condition, / LIKE |REGEXP|REPLACE\(|LOWER\(|UPPER\(/i);
}

function extractVehicleCondition(sql, field) {
  return sql.match(new RegExp("`" + field + "` IN \\([^)]*\\)"))?.[0] || "";
}

test("IP 定向聚合 SQL 只包含邀约四项一级标签且不返回 problem_child", () => {
  const api = loadDataApi();
  const sql = api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, params);

  assert.match(sql, /IN \('到店理由构建', '到店时间锁定', '报价到店承接', '竞品比较转化'\)/);
  assert.doesNotMatch(sql.match(/SELECT\s+row_type[\s\S]*?FROM `IP电话邀约问题诊断明细表-202606后`/)?.[0] || "", /IN \('到店理由构建'/);
  assert.doesNotMatch(sql, /problem_child/);
  assert.doesNotMatch(sql, /GROUP BY tag1, tag2|GROUP BY dealer_code, tag1, tag2/);
});

test("试驾定向聚合 SQL 只包含试驾三项一级标签且不返回 problem_child", () => {
  const api = loadDataApi();
  const sql = api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, params);

  assert.match(sql, /IN \('版本推荐', '顾虑承接', '竞品攻防'\)/);
  assert.doesNotMatch(sql.match(/SELECT\s+row_type[\s\S]*?FROM `试驾接待问题诊断明细表-202606后`/)?.[0] || "", /IN \('版本推荐'/);
  assert.doesNotMatch(sql, /problem_child/);
  assert.doesNotMatch(sql, /GROUP BY tag1, tag2|GROUP BY dealer_code, tag1, tag2/);
});

test("kind 阶段加载只返回请求类别字段，非目标标签计入 summary 但不输出 problem", async () => {
  const calls = [];
  const api = loadDataApi(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return response({
      code: 0,
      response: {
        columns: ["row_type", "dealer_code", "dealer_name", "tag1", "tag2", "total_count", "negative_count", "mention_count"].map((name) => ({ name })),
        preview: [
          ["summary", "__ALL__", "全部", "", "", 12, 3, 0],
          ["summary", "S1", "测试门店", "", "", 12, 3, 0],
          ["problem_parent", "__ALL__", "全部", "到店理由构建", "", 0, 1, 0],
          ["problem_parent", "S1", "测试门店", "到店理由构建", "", 0, 1, 0]
        ]
      }
    });
  });

  const raw = await api.loadNegativeProcessKindStageRaw("ip", "previous", params, {
    range,
    previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
    weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" }
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(raw).sort(), ["ipAggPrev", "ipAggStoresPrev", "ipTagEvidencePrev"]);
  assert.equal(raw.ipAggPrev.total, 12);
  assert.equal(raw.ipAggPrev.negative, 3);
  assert.equal(raw.ipAggPrev.problems.map((item) => `${item.name}:${item.count}:${item.denominator}:${item.rate}`).join("|"), "到店理由构建:1:12:8.333333333333332|到店时间锁定:0:12:0|报价到店承接:0:12:0|竞品比较转化:0:12:0");
  assert.equal(raw.ipTagEvidencePrev.rowCount, 4);
  assert.equal(raw.ipTagEvidencePrev.hitLimit, false);
  assert.equal(raw.ipTagEvidencePrev.complete, true);
  assert.equal(raw.ipTagEvidencePrev.error, "");
  assert.equal(raw.ipTagEvidencePrev.source, "aggregate-sql");
  assert.equal(raw.ipTagEvidencePrev.stage, "previous");
  assert.equal(raw.ipTagEvidencePrev.limit, 5000);
  assert.equal(raw.ipTagEvidencePrev.parts[0].rowCount, 4);
});

test("IP 聚合 total 大于 0 时缺失目标项补 0，total 为 0 时不伪造样本", async () => {
  const responses = [
    {
      columns: ["row_type", "dealer_code", "dealer_name", "tag1", "tag2", "total_count", "negative_count", "mention_count"].map((name) => ({ name })),
      preview: [["summary", "__ALL__", "全部", "", "", 7, 0, 0], ["summary", "S1", "测试门店", "", "", 7, 0, 0]]
    },
    {
      columns: ["row_type", "dealer_code", "dealer_name", "tag1", "tag2", "total_count", "negative_count", "mention_count"].map((name) => ({ name })),
      preview: [["summary", "__ALL__", "全部", "", "", 0, 0, 0]]
    }
  ];
  const api = loadDataApi(async () => response({ code: 0, response: responses.shift() }));

  const withTotal = await api.loadNegativeProcessKindStageRaw("ip", "current", params, { range });
  assert.equal(withTotal.ipAgg.problems.map((item) => `${item.name}:${item.count}:${item.denominator}:${item.rate}`).join("|"), "到店理由构建:0:7:0|到店时间锁定:0:7:0|报价到店承接:0:7:0|竞品比较转化:0:7:0");

  const empty = await api.loadNegativeProcessKindStageRaw("ip", "week", params, { range, weekRange: range });
  assert.equal(empty.ipAggWeek.total, 0);
  assert.equal(empty.ipAggWeek.problems.length, 0);
});

test("SQL 返回触达 5000 上限时保持 fail-closed", async () => {
  const api = loadDataApi(async () => response({
    code: 0,
    response: {
      columns: [{ name: "row_type" }],
      preview: Array.from({ length: 5000 }, () => ["summary"])
    }
  }));

  await assert.rejects(api.loadNegativeProcessKindStageRaw("drive", "current", params, { range }), (error) => {
    assert.match(error.message, /SQL 聚合结果达到安全上限 5000 行，完整性不可证/);
    assert.equal(error.evidence.kind, "drive");
    assert.equal(error.evidence.rowCount, 5000);
    assert.equal(error.evidence.hitLimit, true);
    assert.equal(error.evidence.complete, false);
    assert.equal(error.evidence.error, "SQL 聚合结果达到安全上限 5000 行，完整性不可证");
    assert.equal(error.evidence.stage, "current");
    assert.equal(error.evidence.parts[0].hitLimit, true);
    return true;
  });
});

test("过程标签四来源按车系字段过滤，三阶段同构且 MG4 EV 不并入全新MG4", async () => {
  const api = loadDataApi();
  const selected = { brand: "MG", vehicleSeries: ["全新MG4", "MG 07"] };
  const baseRaw = {
    range,
    previousRange: { startDate: "2026-06-01", endDate: "2026-06-20" },
    weekRange: { startDate: "2026-06-24", endDate: "2026-07-13" }
  };
  const calls = [];
  const vehicleApi = loadDataApi(async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push(body.query || "");
    return response({ code: 0, response: { columns: [{ name: "row_type" }], preview: [] } });
  });
  await vehicleApi.loadNegativeProcessKindStageRaw("ip", "current", selected, baseRaw);
  await vehicleApi.loadNegativeProcessKindStageRaw("ip", "previous", selected, baseRaw);
  await vehicleApi.loadNegativeProcessKindStageRaw("drive", "week", selected, baseRaw);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((sql) => /全新MG4/.test(sql)));
  assert.ok(calls.every((sql) => /'MG 07'/.test(sql)));
  assert.ok(calls.every((sql) => /'MG07 EV'/.test(sql)));
  assert.ok(calls.every((sql) => /'MG07 DMH'/.test(sql)));
  assert.ok(calls.every((sql) => !/MG4 EV/.test(sql)));

  const ipHistorySql = api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, selected);
  const ipRealtimeSql = api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, range, selected);
  const driveHistorySql = api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, selected);
  const driveRealtimeSql = api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, range, selected);
  assert.match(ipHistorySql, /`周期首次意向闭环车系名称` IN \('全新MG4', 'MG 07', 'MG07 EV', 'MG07 DMH'\)/);
  assert.match(ipRealtimeSql, /`周期首次意向闭环车系名称` IN \('全新MG4', 'MG 07', 'MG07 EV', 'MG07 DMH'\)/);
  assert.match(driveHistorySql, /`车系名称` IN \('全新MG4', 'MG 07', 'MG07 EV', 'MG07 DMH'\)/);
  assert.match(driveRealtimeSql, /`闭环车系` IN \('全新MG4', 'MG 07', 'MG07 EV', 'MG07 DMH'\)/);
  assert.doesNotMatch(driveRealtimeSql, /`车系名称` IN/);
});

test("MG 07 过程别名四来源完整覆盖、排除 MG7，且 current/month/week 条件无日期差异", () => {
  const api = loadDataApi();
  const selected = { brand: "MG", vehicleSeries: ["MG 07"] };
  const previousRange = { startDate: "2026-06-01", endDate: "2026-06-20" };
  const weekRange = { startDate: "2026-06-24", endDate: "2026-07-13" };
  const configs = [
    { name: "ip.history", sql: (targetRange) => api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, targetRange, selected), field: "周期首次意向闭环车系名称" },
    { name: "ip.realtime", sql: (targetRange) => api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, targetRange, selected), field: "周期首次意向闭环车系名称" },
    { name: "drive.history", sql: (targetRange) => api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, targetRange, selected), field: "车系名称" },
    { name: "drive.realtime", sql: (targetRange) => api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, targetRange, selected), field: "闭环车系" }
  ];

  configs.forEach(({ name, sql, field }) => {
    const currentSql = sql(range);
    const previousSql = sql(previousRange);
    const weekSql = sql(weekRange);
    assertMg07Aliases(currentSql, field);
    assert.equal(extractVehicleCondition(previousSql, field), extractVehicleCondition(currentSql, field), name);
    assert.equal(extractVehicleCondition(weekSql, field), extractVehicleCondition(currentSql, field), name);
  });
});

test("MG 07 多选去重不重复计入三别名，MG7 保持独立闭集", () => {
  const api = loadDataApi();
  const selectedWithDuplicates = { brand: "MG", vehicleSeries: ["MG 07", "MG 07", "MG7"] };
  const mg7Only = { brand: "MG", vehicleSeries: ["MG7"] };
  [
    [api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, selectedWithDuplicates), "周期首次意向闭环车系名称"],
    [api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, range, selectedWithDuplicates), "周期首次意向闭环车系名称"],
    [api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, selectedWithDuplicates), "车系名称"],
    [api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, range, selectedWithDuplicates), "闭环车系"]
  ].forEach(([sql, field]) => {
    const condition = extractVehicleCondition(sql, field);
    assert.equal((condition.match(/'MG 07'/g) || []).length, 1);
    assert.equal((condition.match(/'MG07 EV'/g) || []).length, 1);
    assert.equal((condition.match(/'MG07 DMH'/g) || []).length, 1);
    assert.equal((condition.match(/'MG7'/g) || []).length, 1);
  });

  [
    [api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, mg7Only), "周期首次意向闭环车系名称"],
    [api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, range, mg7Only), "周期首次意向闭环车系名称"],
    [api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, mg7Only), "车系名称"],
    [api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, range, mg7Only), "闭环车系"]
  ].forEach(([sql, field]) => {
    assert.equal(extractVehicleCondition(sql, field), `\`${field}\` IN ('MG7')`);
    assert.doesNotMatch(sql, /'MG 07'|'MG07 EV'|'MG07 DMH'/);
  });
});

test("过程标签其他/未知/空值语义固定，具体车系 SQL 失败不回退明细", async () => {
  const api = loadDataApi();
  const other = { brand: "MG", vehicleSeries: ["其他车系"] };
  const unknown = { brand: "MG", vehicleSeries: ["未知车系"] };
  assert.match(api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, other), /`周期首次意向闭环车系名称` IN \('其他车系'\)/);
  assert.match(api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, range, other), /`品牌名称` = 'MG' AND TRIM\(CAST\(`周期首次意向闭环车系名称` AS STRING\)\) <> '' AND `周期首次意向闭环车系名称` NOT IN/);
  assert.match(api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, other), /`品牌名称` = 'MG' AND TRIM\(CAST\(`车系名称` AS STRING\)\) <> '' AND `车系名称` NOT IN/);
  assert.match(api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, range, other), /`闭环车系` IN \('其他车系'\)/);
  [
    api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, unknown),
    api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.realtime, range, unknown),
    api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.history, range, unknown),
    api.__test.driveAggregateSql(api.__test.TAG_TABLES.drive.realtime, range, unknown)
  ].forEach((sql) => {
    assert.match(sql, /IN \('未知'\)/);
    const vehicleWhere = sql.match(/AND \(`[^`]+` IN \('未知'\)\)/)?.[0] || "";
    assert.doesNotMatch(vehicleWhere, /''| IS NULL/);
  });
  assert.throws(
    () => api.__test.ipAggregateSql(api.__test.TAG_TABLES.ip.history, range, { brand: "MG", vehicleSeries: ["MG4 EV"] }),
    /过程ip车系映射未审计/
  );

  const calls = [];
  const failingApi = loadDataApi(async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).includes("/execute-sql-query")) return response({ code: 500, msg: "sql boom" });
    return response({ code: 0, response: {} });
  });
  await assert.rejects(
    failingApi.loadNegativeProcessKindStageRaw("ip", "current", { brand: "MG", vehicleSeries: ["全新MG4"] }, { range }),
    /sql boom/
  );
  await assert.rejects(
    failingApi.loadNegativeProcessStageRaw("current", { brand: "MG", vehicleSeries: ["全新MG4"] }, { range }),
    /sql boom/
  );
  await assert.rejects(
    failingApi.loadNegativeProcessRaw({ brand: "MG", vehicleSeries: ["全新MG4"] }, { range }),
    /过程标签明细 legacy 路径不支持已审计车系过滤/
  );
  assert.equal(calls.filter((url) => url.includes("/execute-sql-query")).length, 3);
  assert.equal(calls.some((url) => url.includes("/preview-with-filter-async")), false);
});

test("SQL 失败但明细 fallback 成功时顶层 evidence 表达最终成功且 SQL 失败仅保留在 parts", async () => {
  const calls = [];
  const api = loadDataApi(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    const target = String(url);
    if (target.includes("/api/data-source/execute-sql-query")) {
      return response({ code: 500, msg: "SQL mock failed" });
    }
    if (target.includes("/preview-with-filter-async")) {
      return response({ code: 0, response: { taskId: "fallback-task" } });
    }
    if (target.includes("/api/task/fallback-task")) {
      return response({ code: 0, response: { status: "FINISHED", result: JSON.stringify({ response: { value: "fallback-file" } }) } });
    }
    if (target.includes("/api/account/readPreviewFile")) {
      return response({
        code: 0,
        response: {
          columns: [{ name: "呼叫编码" }, { name: "一级标签" }],
          preview: [["CALL-1", "到店理由构建"]]
        }
      });
    }
    if (target.includes("/api/data-source/")) {
      return response({
        code: 0,
        response: {
          dsId: "n418e47dacdb94291993d3d9",
          fields: [{ name: "品牌名称" }, { name: "呼叫开始时间" }]
        }
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });

  const raw = await api.loadNegativeProcessKindStageRaw("ip", "current", params, { range });

  assert.equal(calls.length, 5);
  assert.deepEqual(Object.keys(raw).sort(), ["ipTagEvidence", "ipTags"]);
  assert.equal(raw.ipTags.length, 1);
  assert.equal(raw.ipTagEvidence.kind, "ip");
  assert.equal(raw.ipTagEvidence.stage, "current");
  assert.equal(raw.ipTagEvidence.source, "detail-fallback");
  assert.equal(raw.ipTagEvidence.rowCount, 1);
  assert.equal(raw.ipTagEvidence.limit, 200000);
  assert.equal(raw.ipTagEvidence.hitLimit, false);
  assert.equal(raw.ipTagEvidence.complete, true);
  assert.equal(raw.ipTagEvidence.error, "");
  assert.equal(raw.ipTagEvidence.parts.length, 2);
  assert.equal(raw.ipTagEvidence.parts[0].source, "aggregate-sql");
  assert.equal(raw.ipTagEvidence.parts[0].limit, 5000);
  assert.equal(raw.ipTagEvidence.parts[0].complete, false);
  assert.match(raw.ipTagEvidence.parts[0].error, /SQL mock failed/);
  assert.equal(raw.ipTagEvidence.parts[1].source, "detail-fallback");
  assert.equal(raw.ipTagEvidence.parts[1].part, "history");
  assert.equal(raw.ipTagEvidence.parts[1].rowCount, 1);
  assert.equal(raw.ipTagEvidence.parts[1].complete, true);
  assert.equal(raw.ipTagEvidence.parts[1].error, "");
});

test("SQL 失败且明细 fallback 也失败时抛出贯穿 kind/stage/source 的统一 evidence", async () => {
  const calls = [];
  const api = loadDataApi(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (String(url).includes("/api/data-source/execute-sql-query")) {
      return response({ code: 500, msg: "SQL mock failed" });
    }
    if (String(url).includes("/api/data-source/")) {
      return response({ code: 0, response: {} }, false);
    }
    return response({ code: 0, response: {} });
  });

  await assert.rejects(api.loadNegativeProcessKindStageRaw("ip", "current", params, { range }), (error) => {
    assert.equal(calls.length, 2);
    assert.equal(Boolean(error.cause), true);
    assert.match(error.cause.message, /观远接口请求失败：500/);
    assert.match(error.message, /观远接口请求失败：500/);
    assert.equal(error.evidence.kind, "ip");
    assert.equal(error.evidence.stage, "current");
    assert.equal(error.evidence.source, "detail-fallback");
    assert.equal(error.evidence.rowCount, 0);
    assert.equal(error.evidence.limit, 200000);
    assert.equal(error.evidence.hitLimit, false);
    assert.equal(error.evidence.complete, false);
    assert.match(error.evidence.error, /观远接口请求失败：500/);
    assert.equal(error.evidence.parts.length, 2);
    assert.equal(error.evidence.parts[0].source, "aggregate-sql");
    assert.equal(error.evidence.parts[0].limit, 5000);
    assert.equal(error.evidence.parts[0].complete, false);
    assert.match(error.evidence.parts[0].error, /SQL mock failed/);
    assert.equal(error.evidence.parts[1].source, "detail-fallback");
    assert.equal(error.evidence.parts[1].part, "history");
    assert.equal(error.evidence.parts[1].limit, 200000);
    assert.equal(error.evidence.parts[1].complete, false);
    assert.match(error.evidence.parts[1].error, /观远接口请求失败：500/);
    return true;
  });
});
