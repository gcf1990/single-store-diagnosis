import assert from "node:assert/strict";
import test from "node:test";
import { contractFixture, loadSmallOrderContext, windowContext } from "./small-order-test-helpers.mjs";

function targetDetail(windowRef = windowContext) {
  return {
    dsId: windowRef.SmallOrderConfig.TARGET_DS_ID,
    name: windowRef.SmallOrderConfig.TARGET_DATASET_NAME,
    parentDirId: windowRef.SmallOrderConfig.TARGET_PARENT_DIR_ID,
    status: "FINISHED",
    columns: [...windowRef.SmallOrderConfig.TARGET_FIELDS, "目标源行号"].map((name) => ({ name }))
  };
}

test("datasetDetail 解包观远真实 data.columns 响应形状", async () => {
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: targetDetail() }) })
  };
  const win = await loadSmallOrderContext(context);
  const detail = await win.SmallOrderApi.datasetDetail(win.SmallOrderConfig.TARGET_DS_ID);
  assert.equal(detail.dsId, win.SmallOrderConfig.TARGET_DS_ID);
  assert.equal(detail.name, win.SmallOrderConfig.TARGET_DATASET_NAME);
  assert.equal(detail.parentDirId, win.SmallOrderConfig.TARGET_PARENT_DIR_ID);
  assert.equal(detail.status, "FINISHED");
  assert.equal(detail.columns.length, 8);
});

test("生产读取硬验目标数据集元数据并对同一 request key 去重并发", async () => {
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  let detail = targetDetail(win);
  let releaseTargets;
  let holdTargetRows = true;
  const calls = [];
  const { rows, orgRows } = contractFixture();
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async (dsId) => {
      calls.push(`allRows:${dsId}`);
      if (dsId === win.SmallOrderConfig.TARGET_DS_ID && holdTargetRows) await new Promise((resolve) => { releaseTargets = resolve; });
      if (dsId === win.SmallOrderConfig.TARGET_DS_ID) return rows;
      if (dsId === win.SmallOrderConfig.ORGANIZATION_DS_ID) return orgRows;
      return [];
    },
    executeSqlRows: async () => {
      calls.push("actual");
      return [];
    }
  } };
  const options = { today: "2026-07-29", roleResult: { ok: true, role: "headquarters" }, entryLevel: "area" };
  const first = win.SmallOrderApi.loadSmallOrderRaw({ userId: "u1" }, [], options);
  const second = win.SmallOrderApi.loadSmallOrderRaw({ userId: "u1" }, [], options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.filter((item) => item === "actual").length, 1);
  releaseTargets();
  const [rawA, rawB] = await Promise.all([first, second]);
  assert.equal(rawA.status, "ready");
  assert.equal(rawB.status, "ready");
  assert.equal(calls.filter((item) => item.startsWith("allRows:")).length, 2);
  holdTargetRows = false;
  detail = { ...detail, parentDirId: "wrong" };
  const failed = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u2" }, [], options);
  assert.equal(failed.status, "target_unavailable");
  assert.match(failed.error, /parentDirId/);
});

test("pending request 清理不产生额外 unhandled rejection", async () => {
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => { throw new Error("request failed"); },
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  try {
    await assert.rejects(() => win.SmallOrderApi.loadSmallOrderRaw({ userId: "missing-transport" }, [], { today: "2026-07-29", roleResult: { ok: true, role: "headquarters" } }), /小订数据传输接口不可用/);
    win.RegionDataApi = { __transport: { allRows: async () => [], executeSqlRows: async () => [] } };
    const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "request-failed" }, [], { today: "2026-07-29", roleResult: { ok: true, role: "headquarters" } });
    assert.equal(raw.status, "target_unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("组织维表读取使用 MG 精确过滤、成功缓存、不同 dsId 隔离且失败可重试", async () => {
  const win = await loadSmallOrderContext();
  const calls = [];
  const transport = { allRows: async (dsId, filters) => {
    calls.push({ dsId, filters: JSON.parse(JSON.stringify(filters)) });
    if (dsId === "bad-org") throw new Error("boom");
    return [{ brand_name: "MG", parent_dealer_code: "S1" }];
  } };
  const api = win.SmallOrderApi.__test;
  const first = await api.loadOrganizationRows({ organizationDsId: "org-a" }, transport, {});
  const second = await api.loadOrganizationRows({ organizationDsId: "org-a" }, transport, {});
  assert.strictEqual(first, second);
  assert.equal(calls.filter((item) => item.dsId === "org-a").length, 1);
  assert.deepEqual(calls[0].filters, [{ field: "brand_name", type: "EQ", value: "MG" }]);
  await api.loadOrganizationRows({ organizationDsId: "org-b" }, transport, {});
  assert.equal(calls.filter((item) => item.dsId === "org-b").length, 1);
  await assert.rejects(() => api.loadOrganizationRows({ organizationDsId: "bad-org" }, transport, {}), /boom/);
  await assert.rejects(() => api.loadOrganizationRows({ organizationDsId: "bad-org" }, transport, {}), /boom/);
  assert.equal(calls.filter((item) => item.dsId === "bad-org").length, 2);
});

test("小订实际 SQL 固定 MG 07、固定窗口并隐藏转大定", () => {
  const sql = windowContext.SmallOrderApi.smallOrderActualSql({ startDate: "2026-07-29", endDate: "2026-08-22" });
  assert.match(sql, /`品牌名称` = 'MG'/);
  assert.match(sql, /`汇报车系名称` = 'MG 07'/);
  assert.match(sql, /`日yyyy-mm-dd` >= '2026-07-29'/);
  assert.match(sql, /`日yyyy-mm-dd` <= '2026-08-22'/);
  assert.match(sql, /当日首触小订数/);
  assert.doesNotMatch(sql, /转大定/);
});
