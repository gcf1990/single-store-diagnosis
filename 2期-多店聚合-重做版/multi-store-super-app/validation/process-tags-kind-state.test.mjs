import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function makeRaw(kind, stage) {
  return {
    stores: [{ code: `${kind}-${stage}`, current: {}, previous: {}, week: {} }],
    [`${kind}_${stage}`]: true
  };
}

function createHarness({ onRequest } = {}) {
  const calls = [];
  const buildCalls = [];
  const pending = new Map();
  const hooks = {
    renderFunnel: () => calls.push({ type: "renderFunnel" }),
    rebuildIronStores: () => calls.push({ type: "rebuild" }),
    renderProcessComparisonList: (state) => calls.push({ type: "processList", stage: state.processStage, loading: state.processLoading }),
    refreshDynamicDiagnoses: (state) => calls.push({ type: "dynamic", stage: state.processStage, loading: state.processLoading })
  };
  const window = {
    __RETAIL_PC_APP_TEST__: true,
    __RETAIL_PC_APP_TEST_HOOKS__: hooks,
    RetailVehicleSeries: { ALL: "全部车系" },
    RetailUtils: {
      readRetailParams: () => ({ startDate: "2026-07-01", endDate: "2026-07-23", brand: "MG" }),
      pct: () => "--",
      deltaPercent: () => "--",
      buildSingleStoreLink: () => "#"
    },
    RegionDataApi: {
      loadSalesRaw: async () => ({}),
      loadVehicleSeriesOptions: async () => [],
      loadMonthlyTargetRaw: async () => ({}),
      loadNegativeProcessStageRaw: async () => ({}),
      loadNegativeProcessKindStageRaw: (kind, stage) => {
        const key = `${kind}:${stage}`;
        calls.push({ type: "request", key, kind, stage });
        const d = deferred();
        pending.set(key, d);
        onRequest?.({ kind, stage, key, deferred: d });
        return d.promise;
      },
      resolveDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-07-23" }),
      previousMonthRange: () => ({ startDate: "2026-06-01", endDate: "2026-06-23" }),
      previousWeekRange: () => ({ startDate: "2026-06-24", endDate: "2026-07-16" })
    },
    IronMetricsApi: { loadIronMetricsRaw: async () => ({}) },
    IronMetricsModel: {
      buildStoreFacts: () => [],
      aggregateRows: () => ({}),
      attachComparisonRecords: () => []
    },
    RegionMetrics: {
      buildWorkbench: (raw, options) => {
        buildCalls.push({ raw, options });
        return { raw, stores: raw?.stores || [] };
      },
      buildDynamicStoreDiagnoses: () => [],
      pct: () => "--"
    },
    OrganizationView: {
      LEVEL_META: {},
      readPersonnelProfile: () => ({}),
      resolveRole: () => ({ role: "hq" }),
      createViewState: () => ({ role: { role: "hq" }, viewLevel: "region", drillPath: [] }),
      drillDown: () => undefined,
      drillBack: () => undefined,
      buildViewRows: () => [],
      evaluateNationalScopeEvidence: () => ({})
    },
    OrganizationScope: { resolveActualScope: () => ({}) }
  };
  const context = vm.createContext({ window, console, setTimeout, clearTimeout });
  new vm.Script(appSource, { filename: "app.js" }).runInContext(context);
  const api = window.__retailPcAppTest;
  api.state.loadToken = 1;
  api.state.raw = { stores: [{ code: "base" }] };
  api.state.data = { stores: [{ code: "base" }] };
  api.state.processBaselineRaw = null;
  api.state.processBaselineData = null;
  api.state.processLoading = true;
  api.state.processStage = "idle";
  api.state.processError = "";
  api.state.processErrors = api.emptyProcessErrors();
  return { api, calls, buildCalls, pending };
}

function settleSuccess(pending, key) {
  assert.ok(pending.has(key), `${key} should be pending`);
  pending.get(key).resolve(makeRaw(...key.split(":")));
}

function settleFailure(pending, key, message = `${key} failed`) {
  assert.ok(pending.has(key), `${key} should be pending`);
  const error = new Error(message);
  error.evidence = { kind: key.split(":")[0], stage: key.split(":")[1], complete: false };
  pending.get(key).reject(error);
}

test("PC 过程标签生产拆分路径 current 不刷动态诊断，comparison 后只刷一次", async () => {
  const { api, calls, buildCalls, pending } = createHarness();
  const currentPromise = api.loadNegativeProcessCurrent(1, { base: true }, [{ code: "D1" }], { brand: "MG" });
  await flush();

  assert.deepEqual(calls.filter((call) => call.type === "request").map((call) => call.key), ["ip:current", "drive:current"]);
  assert.equal(pending.has("ip:previous"), false);
  assert.equal(pending.has("drive:week"), false);

  settleSuccess(pending, "ip:current");
  settleSuccess(pending, "drive:current");
  await currentPromise;

  assert.equal(buildCalls.length, 1);
  assert.deepEqual(calls.filter((call) => call.type === "processList").map((call) => call.stage), ["current"]);
  assert.equal(calls.some((call) => call.type === "dynamic"), false);
  assert.equal(api.state.processStage, "current");
  assert.equal(api.state.processLoading, true);

  const comparisonPromise = api.loadNegativeProcessComparisons(1, { base: true }, [{ code: "D1" }], { brand: "MG" });
  await flush();
  assert.deepEqual(calls.filter((call) => call.type === "request").map((call) => call.key), [
    "ip:current",
    "drive:current",
    "ip:previous",
    "drive:previous",
    "ip:week",
    "drive:week"
  ]);
  settleSuccess(pending, "ip:previous");
  settleSuccess(pending, "drive:previous");
  settleSuccess(pending, "ip:week");
  settleSuccess(pending, "drive:week");
  await comparisonPromise;

  assert.equal(buildCalls.length, 2);
  assert.equal(calls.filter((call) => call.type === "rebuild").length, 2);
  assert.equal(calls.filter((call) => call.type === "renderFunnel").length, 0);
  assert.deepEqual(calls.filter((call) => call.type === "processList").map((call) => call.stage), ["current", "week"]);
  assert.deepEqual(calls.filter((call) => call.type === "dynamic").map((call) => call.stage), ["week"]);
  assert.equal(api.state.processStage, "week");
  assert.equal(api.state.processLoading, false);
});

test("PC 过程标签比较期按 kind 和 stage 隔离失败，不抹掉另一阶段成功结果", async () => {
  const { api, pending } = createHarness();
  const loadPromise = api.loadNegativeProcess(1, {}, [], {});
  await flush();
  settleSuccess(pending, "ip:current");
  settleSuccess(pending, "drive:current");
  await flush();
  settleFailure(pending, "ip:previous", "ip previous failed");
  settleSuccess(pending, "drive:previous");
  settleSuccess(pending, "ip:week");
  settleFailure(pending, "drive:week", "drive week failed");
  await loadPromise;

  assert.match(api.state.processErrors.ip.previous, /ip previous failed/);
  assert.match(api.state.processErrors.drive.week, /drive week failed/);
  assert.equal(api.state.processErrors.drive.previous, "");
  assert.equal(api.state.processErrors.ip.week, "");
  assert.equal(api.state.raw.drive_previous, true);
  assert.equal(api.state.raw.ip_week, true);
  assert.equal(api.state.processLoading, false);
});

test("PC 过程标签 token 第一波失效后不启动第二波且不提交 current", async () => {
  const { api, calls, buildCalls, pending } = createHarness();
  const loadPromise = api.loadNegativeProcess(1, {}, [], {});
  await flush();
  api.state.loadToken = 2;
  settleSuccess(pending, "ip:current");
  settleSuccess(pending, "drive:current");
  await loadPromise;

  assert.deepEqual(calls.filter((call) => call.type === "request").map((call) => call.key), ["ip:current", "drive:current"]);
  assert.equal(buildCalls.length, 0);
  assert.equal(calls.some((call) => call.type === "processList"), false);
  assert.equal(api.state.processStage, "idle");
  assert.equal(api.state.processBaselineRaw, null);
});

test("PC 过程标签 token 第二波失效后不回写最终状态", async () => {
  const { api, calls, buildCalls, pending } = createHarness();
  const loadPromise = api.loadNegativeProcess(1, {}, [], {});
  await flush();
  settleSuccess(pending, "ip:current");
  settleSuccess(pending, "drive:current");
  await flush();
  api.state.loadToken = 2;
  settleSuccess(pending, "ip:previous");
  settleSuccess(pending, "drive:previous");
  settleSuccess(pending, "ip:week");
  settleSuccess(pending, "drive:week");
  await loadPromise;

  assert.equal(buildCalls.length, 1);
  assert.equal(calls.filter((call) => call.type === "renderFunnel").length, 0);
  assert.deepEqual(calls.filter((call) => call.type === "processList").map((call) => call.stage), ["current"]);
  assert.equal(calls.some((call) => call.type === "dynamic"), false);
  assert.equal(api.state.processStage, "current");
  assert.equal(api.state.processLoading, true);
  assert.equal(api.state.raw.ip_previous, undefined);
});

test("PC 过程标签 current 未完成时比较期不提交", async () => {
  const { api, calls, buildCalls, pending } = createHarness();
  const loadPromise = api.loadNegativeProcess(1, {}, [], {});
  await flush();
  settleSuccess(pending, "ip:current");
  await flush();

  assert.deepEqual(calls.filter((call) => call.type === "request").map((call) => call.key), ["ip:current", "drive:current"]);
  assert.equal(buildCalls.length, 0);
  assert.equal(calls.some((call) => call.type === "processList"), false);
  assert.equal(api.state.processStage, "idle");

  settleSuccess(pending, "drive:current");
  await flush();
  ["ip:previous", "drive:previous", "ip:week", "drive:week"].forEach((key) => settleSuccess(pending, key));
  await loadPromise;
});

test("PC 过程状态按 IP 与试驾 kind 独立保存错误", () => {
  assert.match(appSource, /processErrors:\s*\{\s*ip:\s*\{\s*current:\s*"",\s*previous:\s*"",\s*week:\s*""\s*\},\s*drive:\s*\{\s*current:\s*"",\s*previous:\s*"",\s*week:\s*""\s*\}/);
  assert.match(appSource, /problemMetric\("零钩子率",[\s\S]*"ip"\)/);
  assert.match(appSource, /problemMetric\("版本未推荐率",[\s\S]*"drive"\)/);
  assert.doesNotMatch(appSource, /state\.processError \? processErrorMetric\("版本未推荐率"\)/);
});

test("过程错误提示区分邀约四项和试驾三项，不再笼统写三项试驾", () => {
  assert.match(appSource, /邀约四项数据不完整/);
  assert.match(appSource, /试驾三项数据不完整/);
  assert.doesNotMatch(appSource, /三项试驾问题率数据不完整/);
});

test("过程标签 evidence schema 覆盖 SQL、fallback 和截断失败路径", () => {
  ["kind", "stage", "source", "rowCount", "limit", "hitLimit", "complete", "error", "parts"].forEach((field) => {
    assert.match(dataApiSource, new RegExp(`${field}`));
  });
  assert.match(dataApiSource, /source: "aggregate-sql"/);
  assert.match(dataApiSource, /source: "detail-fallback"/);
  assert.match(dataApiSource, /part: "history"/);
  assert.match(dataApiSource, /part: "realtime"/);
  assert.match(dataApiSource, /error\.evidence = \{ \.\.\.error\.evidence, stage \}/);
});
