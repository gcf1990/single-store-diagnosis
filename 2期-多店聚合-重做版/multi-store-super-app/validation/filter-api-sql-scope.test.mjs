import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const nationalScopeSource = await readFile(new URL("../national-scope.js", import.meta.url), "utf8");
const filterApiSource = await readFile(new URL("../filter-api.js", import.meta.url), "utf8");
const DEALER_DIM_DS_ID = "a310ff90fddff4b6283841c6";

function jsonResponse(payload, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    text: async () => JSON.stringify(payload)
  };
}

function dealerRow(code, areaCode = "SMG800", districtCode = "SMG801") {
  return [
    "M", "MG", code, `父级${code}`, code, `门店${code}`, areaCode, "8北区",
    districtCode, "北一区", `官网${code}`, "否", "开业"
  ];
}

const DEALER_SCOPE_COLUMNS = ["品牌代码", "品牌名称", "一级经销商代码", "父经销商简称", "经销商代码", "经销商简称", "大区代码", "大区简称", "小区代码", "小区简称", "官网显示名称", "是否二网经销商", "开业状态名称"];
const DEALER_PREVIEW_COLUMNS = ["品牌代码", "品牌名称", "父级经销商代码", "父级经销商简称", "经销商代码", "经销商简称", "大区代码", "大区简称", "小区代码", "小区简称", "官网显示名称", "是否二网经销商", "开业状态名称"];

function loadContext(fetchImpl) {
  const context = {
    fetch: fetchImpl,
    location: { hostname: "localhost", pathname: "/" },
    setTimeout,
    clearTimeout,
    console: { warn() {}, error() {}, log() {} },
    window: {}
  };
  vm.runInNewContext(nationalScopeSource, context);
  vm.runInNewContext(filterApiSource, context);
  return context;
}

test("有效经销商白名单成功路径使用 execute-sql-query 且不读取 preview 文件", async () => {
  const calls = [];
  const context = loadContext(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    assert.equal(url, "/api/data-source/execute-sql-query");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.inputs, [DEALER_DIM_DS_ID]);
    assert.equal(body.limit, 10000);
    assert.equal(body.disableCache, false);
    assert.match(body.query, /FROM `新双品牌经销商主数据维度表&dim_main_dealer_info_p_df_wms`/);
    assert.match(body.query, /`开业状态名称` = '开业'/);
    assert.match(body.query, /`品牌名称` = 'MG'/);
    assert.match(body.query, /`大区代码` = 'SMG800'/);
    assert.match(body.query, /`小区代码` = 'SMG801'/);
    assert.match(body.query, /`经销商代码` = 'MQ1007'/);
    assert.match(body.query, /`父级经销商代码` AS `一级经销商代码`/);
    assert.match(body.query, /`父级经销商简称` AS `父经销商简称`/);
    assert.doesNotMatch(body.query, /SELECT .*`一级经销商代码` AS `一级经销商代码`/s);
    assert.doesNotMatch(body.query, /SELECT .*`父经销商简称` AS `父经销商简称`/s);
    assert.doesNotMatch(body.query, /SELECT \*/);
    return jsonResponse({
      response: {
        columns: DEALER_SCOPE_COLUMNS.map((name) => ({ name })),
        preview: [dealerRow("MQ1007")]
      }
    });
  });

  const result = await context.window.RegionFilterApi.loadValidDealerScope({
    brand: "MG",
    areaCode: "SMG800",
    districtCode: "SMG801",
    dealerCode: "MQ1007"
  });

  assert.equal(JSON.stringify(result.dealers.map((dealer) => dealer.code)), JSON.stringify(["MQ1007"]));
  assert.equal(JSON.stringify(result.dealers.map((dealer) => dealer.parentDealerCode)), JSON.stringify(["MQ1007"]));
  assert.equal(result.evidence.source, "dealer-dimension-execute-sql-query");
  assert.equal(result.evidence.queryMode, "execute-sql-query");
  assert.equal(result.evidence.fallback, false);
  assert.equal(calls.length, 1);
  assert.equal(calls.some((call) => call.url.includes("preview-with-filter-async")), false);
  assert.equal(calls.some((call) => call.url === "/api/account/readPreviewFile"), false);
});

test("execute-sql-query 失败时才回退 preview 并保持区域白名单过滤", async () => {
  const calls = [];
  const tasks = new Map();
  let taskSequence = 0;
  let sqlShouldFail = true;
  const context = loadContext(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    if (url === "/api/data-source/execute-sql-query") {
      if (sqlShouldFail) {
        sqlShouldFail = false;
        return jsonResponse({ error: { message: "sql boom" } });
      }
      return jsonResponse({
        response: {
          columns: DEALER_SCOPE_COLUMNS.map((name) => ({ name })),
          preview: [dealerRow("MQ1007", "SMG800", "SMG801")]
        }
      });
    }
    if (url === `/api/data-source/${DEALER_DIM_DS_ID}`) {
      const fields = ["开业状态名称", "品牌名称", "大区代码", "大区简称", "小区代码", "小区简称", "父级经销商代码", "父级经销商简称", "经销商代码", "经销商简称", "品牌代码", "官网显示名称", "是否二网经销商"]
        .map((name) => ({ name, alias: name }));
      return jsonResponse({ response: { dsId: DEALER_DIM_DS_ID, fields } });
    }
    if (url === `/api/data-source/${DEALER_DIM_DS_ID}/preview-with-filter-async`) {
      const taskId = `task-${++taskSequence}`;
      tasks.set(taskId, JSON.parse(options.body));
      return jsonResponse({ response: { taskId } });
    }
    if (url === "/api/task/task-1") {
      return jsonResponse({ response: { status: "FINISHED", result: { value: "file-task-1" } } });
    }
    if (url === "/api/account/readPreviewFile") {
      const body = JSON.parse(options.body);
      assert.equal(body.taskId, "task-1");
      return jsonResponse({
        response: {
          columns: DEALER_PREVIEW_COLUMNS.map((name) => ({ name })),
          preview: [
            dealerRow("MQ1007", "SMG800", "SMG801"),
            dealerRow("MQ2000", "SQR307", "SMG205")
          ]
        }
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  const result = await context.window.RegionFilterApi.loadValidDealerScope({
    brand: "MG",
    regionCode: "SMG800",
    districtCode: "SMG801",
    dealerCode: "MQ1007"
  });

  assert.equal(JSON.stringify(result.dealers.map((dealer) => dealer.code)), JSON.stringify(["MQ1007"]));
  assert.equal(result.evidence.source, "dealer-dimension-preview-fallback");
  assert.equal(result.evidence.queryMode, "preview-with-filter-async");
  assert.equal(result.evidence.fallback, true);
  assert.equal(calls.filter((call) => call.url === "/api/data-source/execute-sql-query").length, 1);
  assert.equal(calls.filter((call) => call.url.includes("preview-with-filter-async")).length, 1);
  assert.equal(calls.filter((call) => call.url === "/api/account/readPreviewFile").length, 1);
  assert.equal(tasks.get("task-1").limit, 10000);
  const fallbackConditions = tasks.get("task-1").filter.conditions.map((item) => item.value);
  assert.equal(fallbackConditions.some((item) => item.name === "大区代码" && item.filterValue[0] === "SMG800"), true);
  assert.equal(fallbackConditions.some((item) => item.name === "小区代码" && item.filterValue[0] === "SMG801"), true);
  assert.equal(fallbackConditions.some((item) => item.name === "经销商代码" && item.filterValue[0] === "MQ1007"), true);

  const retried = await context.window.RegionFilterApi.loadValidDealerScope({
    brand: "MG",
    regionCode: "SMG800",
    districtCode: "SMG801",
    dealerCode: "MQ1007"
  });
  assert.equal(JSON.stringify(retried.dealers.map((dealer) => dealer.code)), JSON.stringify(["MQ1007"]));
  assert.equal(retried.evidence.source, "dealer-dimension-execute-sql-query");
  assert.equal(calls.filter((call) => call.url === "/api/data-source/execute-sql-query").length, 2);
  assert.equal(calls.filter((call) => call.url.includes("preview-with-filter-async")).length, 1);
});

test("execute-sql-query 成功返回 0 行时不触发 fallback 并保持空白名单语义", async () => {
  const calls = [];
  const context = loadContext(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    assert.equal(url, "/api/data-source/execute-sql-query");
    return jsonResponse({
      response: {
        columns: DEALER_SCOPE_COLUMNS.map((name) => ({ name })),
        preview: []
      }
    });
  });

  const result = await context.window.RegionFilterApi.loadValidDealerScope({
    brand: "MG",
    areaCode: "SMG800"
  });

  assert.equal(result.dealers.length, 0);
  assert.equal(result.evidence.source, "dealer-dimension-execute-sql-query");
  assert.equal(result.evidence.rowCount, 0);
  assert.equal(result.evidence.complete, true);
  assert.equal(result.evidence.fallback, false);
  assert.equal(calls.length, 1);
});
