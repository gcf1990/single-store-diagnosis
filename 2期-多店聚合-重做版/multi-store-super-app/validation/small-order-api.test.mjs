import assert from "node:assert/strict";
import test from "node:test";
import { contractFixture, loadSmallOrderContext, targetRow, windowContext } from "./small-order-test-helpers.mjs";

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

test("生产读取硬验目标数据集元数据且不再读取小订专用组织 DS", async () => {
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  let detail = targetDetail(win);
  const calls = [];
  const { rows } = contractFixture();
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async (dsId) => {
      calls.push(`allRows:${dsId}`);
      if (dsId === win.SmallOrderConfig.TARGET_DS_ID) return rows.slice(0, 2);
      if (dsId === win.SmallOrderConfig.ORGANIZATION_DS_ID) throw new Error("小订不应读取组织维表");
      return [];
    },
    executeSqlRows: async () => {
      calls.push("actual");
      return [];
    }
  } };
  const options = { today: "2026-07-29", entryLevel: "district" };
  const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u1" }, [{ code: "S1", name: "门店S1", areaCode: "A1", districtCode: "D1" }], options);
  assert.equal(raw.status, "ready");
  assert.equal(raw.targetRows.length, 2);
  assert.deepEqual(raw.organizationRows.map((row) => row.parent_dealer_code), ["S1"]);
  assert.equal(calls.filter((item) => item === "actual").length, 2);
  assert.equal(calls.includes(`allRows:${win.SmallOrderConfig.ORGANIZATION_DS_ID}`), false);
  detail = { ...detail, parentDirId: "wrong" };
  const failed = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u2" }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], options);
  assert.equal(failed.status, "target_unavailable");
  assert.equal(failed.error, "MG 07 小订数据暂不可用");
  assert.match(failed.rawError, /parentDirId/);
});

test("空 validDealers 顶部范围不读取目标、实际或组织 DS", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  const calls = [];
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async (dsId) => {
      calls.push(`allRows:${dsId}`);
      return [];
    },
    executeSqlRows: async () => {
      calls.push("actual");
      return [];
    }
  } };
  const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u-empty", brand: "MG" }, [], { today: "2026-07-29", entryLevel: "area" });
  assert.equal(raw.status, "ready");
  assert.deepEqual(JSON.parse(JSON.stringify(raw.validDealers)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.targetRows)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.actualRows)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), []);
});

test("具体非 MG 品牌即使 validDealers 非空也不读取目标、实际或组织 DS", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  const calls = [];
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async (dsId) => {
      calls.push(`allRows:${dsId}`);
      return [];
    },
    executeSqlRows: async () => {
      calls.push("actual");
      return [];
    }
  } };
  const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "rw-user", brand: "荣威" }, [{ code: "RW1", areaCode: "R1", districtCode: "RD1" }], { today: "2026-07-29", entryLevel: "area" });
  assert.equal(raw.status, "ready");
  assert.equal(raw.emptyReason, "non_mg_brand");
  assert.deepEqual(JSON.parse(JSON.stringify(raw.validDealers)), [{ code: "RW1", areaCode: "R1", districtCode: "RD1" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.targetRows)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.actualRows)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), []);
  const report = win.SmallOrderModel.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "empty");
  assert.equal(report.error, "MG 07 当前范围暂无数据");
  assert.equal(report.summary.target, 0);
});

test("transport 缺失和请求失败均返回安全业务错误且不产生额外 unhandled rejection", async () => {
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
    const missingTransport = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "missing-transport" }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-07-29" });
    assert.equal(missingTransport.status, "target_unavailable");
    assert.equal(missingTransport.error, "MG 07 小订数据暂不可用");
    assert.match(missingTransport.rawError, /小订数据传输接口不可用/);
    win.RegionDataApi = { __transport: { allRows: async () => [], executeSqlRows: async () => [] } };
    const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "request-failed" }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-07-29" });
    assert.equal(raw.status, "target_unavailable");
    assert.equal(raw.error, "MG 07 小订数据暂不可用");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("目标或实际底层敏感错误只进入诊断字段，不进入业务错误", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async () => { throw new Error("sensitive dsId parentDirId execute-sql secret"); },
    executeSqlRows: async () => []
  } };
  const targetRaw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u-sensitive" }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-07-29" });
  assert.equal(targetRaw.status, "target_unavailable");
  assert.equal(targetRaw.error, "MG 07 小订数据暂不可用");
  assert.match(targetRaw.rawError, /sensitive dsId parentDirId execute-sql secret/);
  const targetReport = win.SmallOrderModel.buildSmallOrderReport(targetRaw, { viewLevel: "store" });
  assert.equal(targetReport.error, "MG 07 小订数据暂不可用");

  const { rows } = contractFixture();
  win.RegionDataApi = { __transport: {
    allRows: async () => rows.slice(0, 1),
    executeSqlRows: async () => { throw new Error("sensitive dsId parentDirId execute-sql secret"); }
  } };
  const actualRaw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "u-actual-sensitive" }, [{ code: "S1", name: "门店S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-07-29" });
  assert.equal(actualRaw.status, "ready");
  assert.equal(actualRaw.actualError, "MG 07 小订实际数据暂不可用");
  assert.match(actualRaw.rawActualError, /sensitive dsId parentDirId execute-sql secret/);
  const actualReport = win.SmallOrderModel.buildSmallOrderReport(actualRaw, { viewLevel: "store" });
  assert.equal(actualReport.summary.actualError, "MG 07 小订实际数据暂不可用");
  assert.match(actualReport.diagnostics.rawActualError, /sensitive dsId parentDirId execute-sql secret/);
});

test("顶部日期和车系变化不进入小订请求，目标范围只随 RLS 源行和顶部 params 变化", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  const calls = [];
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async (dsId, filters, limit, options) => {
      calls.push({ type: "allRows", dsId, options });
      if (dsId === win.SmallOrderConfig.TARGET_DS_ID) return [targetRow("S1", 10, 0), targetRow("S2", 20, 0)];
      if (dsId === win.SmallOrderConfig.ORGANIZATION_DS_ID) throw new Error("小订不应读取组织维表");
      return [];
    },
    executeSqlRows: async (dsId, sql, limit, options) => {
      calls.push({ type: options?.smallOrderTodayQuery ? "today" : "actual", dsId, sql, options });
      return [{ dealer_code: "S1", actual_small_order: 3 }, { dealer_code: "S2", actual_small_order: 8 }];
    }
  } };
  const firstRaw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "same-user", startDate: "2026-07-01", endDate: "2026-07-27", vehicleSeries: ["MG5"] }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-08-22" });
  const secondRaw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "same-user", startDate: "2026-08-01", endDate: "2026-08-12", vehicleSeries: ["MG 07", "MG4"] }, [{ code: "S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-08-22" });
  const secondReport = win.SmallOrderModel.buildSmallOrderReport(secondRaw, { viewLevel: "store" });
  assert.deepEqual(firstRaw.identity.permissionScope, secondRaw.identity.permissionScope);
  assert.equal(calls.filter((item) => item.dsId === win.SmallOrderConfig.ORGANIZATION_DS_ID).length, 0);
  assert.equal(calls.filter((item) => item.type === "actual").length, 2);
  assert.equal(calls.filter((item) => item.type === "today").length, 2);
  assert.equal(calls.every((item) => JSON.stringify(item.options || {}).includes("vehicleSeries") === false), true);
  assert.match(calls.find((item) => item.type === "actual").sql, /2026-07-29/);
  assert.match(calls.find((item) => item.type === "actual").sql, /2026-08-22/);
  assert.match(calls.find((item) => item.type === "today").sql, /`日yyyy-mm-dd` >= '2026-08-22'/);
  assert.match(calls.find((item) => item.type === "today").sql, /`日yyyy-mm-dd` <= '2026-08-22'/);
  assert.equal(secondReport.status, "ready");
  assert.equal(secondReport.summary.target, 30);
  assert.equal(secondReport.summary.actual, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(secondReport.rows.map((row) => row.code))), ["S1"]);
});

test("投资人组织映射保留父级与叶级经销商字段，小订实际不再附加前端范围过滤", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  const parentCodes = ["MQ2859", "MQ2852", "MQ2892", "MQ280L", "MQ280N"];
  const validDealers = parentCodes.map((code, index) => ({
    code: `${code}-LEAF`,
    name: `叶级门店${index + 1}`,
    parentDealerCode: code,
    parentDealerShortName: `投资人门店${index + 1}`,
    areaCode: "A_INV",
    area: "投资人大区",
    districtCode: "D_INV",
    district: "投资人小区",
    officialName: `官网${index + 1}`
  }));
  const targetRows = parentCodes.map((code, index) => ({
    区域: "投资人大区",
    MAC: "投资人小区",
    一级经销商: code,
    经销商简称: `投资人门店${index + 1}`,
    MG07小订目标: String(index === 4 ? 107 : 100)
  }));
  const calls = [];
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async () => targetRows,
    executeSqlRows: async (dsId, sql, limit, options) => {
      calls.push({ type: options?.smallOrderTodayQuery ? "today" : "actual", sql });
      if (options?.smallOrderTodayQuery) return [];
      return [
        { dealer_code: "MQ2859", actual_small_order: 20, retained_small_order: 20, cancelled_small_order: 0, data_updated_at: "2026-07-31 18:00:00" },
        { dealer_code: "MQ2852", actual_small_order: 20, retained_small_order: 20, cancelled_small_order: 0, data_updated_at: "2026-07-31 18:00:00" },
        { dealer_code: "MQ2892", actual_small_order: 20, retained_small_order: 20, cancelled_small_order: 0, data_updated_at: "2026-07-31 18:00:00" },
        { dealer_code: "MQ280L", actual_small_order: 25, retained_small_order: 24, cancelled_small_order: 1, data_updated_at: "2026-07-31 18:00:00" },
        { dealer_code: "MQ280N", actual_small_order: 25, retained_small_order: 24, cancelled_small_order: 1, data_updated_at: "2026-07-31 18:00:00" }
      ];
    }
  } };
  const raw = await win.SmallOrderApi.loadSmallOrderRaw({
    userId: "investor",
    brand: "MG",
    area: "全部",
    district: "全部",
    dealerCode: "",
    dealerCompanyCode: ""
  }, validDealers, { today: "2026-07-31", entryLevel: "store" });
  const actualSql = calls.find((call) => call.type === "actual").sql;
  assert.match(actualSql, /`汇报车系名称` = 'MG 07'/);
  assert.match(actualSql, /`日yyyy-mm-dd` >= '2026-07-29'/);
  assert.match(actualSql, /`日yyyy-mm-dd` <= '2026-07-31'/);
  assert.doesNotMatch(actualSql, /\bIN\s*\(/i);
  assert.doesNotMatch(actualSql, /`经销商代码`/);
  assert.deepEqual(JSON.parse(JSON.stringify(raw.organizationRows.map((row) => [row.parent_dealer_code, row.dealer_code]))), parentCodes.map((code) => [code, `${code}-LEAF`]));
  assert.deepEqual(JSON.parse(JSON.stringify(raw.identity.permissionScope)), parentCodes.slice().sort());
  assert.equal("authorizedLeafDealerCodes" in raw.identity, false);
  const report = win.SmallOrderModel.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 507);
  assert.equal(report.summary.actual, 110);
  assert.equal(report.summary.retained, 108);
  assert.equal(report.summary.achievementActual, 108);
  assert.equal(report.summary.cancelled, 2);
  assert.equal(report.rows.length, 5);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "organization_unmapped"), false);
});

test("今日新增只在固定期内发起独立日查询，且日查询失败不拖垮累计", async () => {
  const detail = targetDetail();
  const context = {
    window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } },
    globalThis: { __SMALL_ORDER_TEST__: true },
    location: { hostname: "localhost", pathname: "/" },
    fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: detail }) }),
    setTimeout
  };
  const win = await loadSmallOrderContext(context);
  const calls = [];
  win.RetailRuntimeConfig = { getConfig: () => ({ mg07SmallOrderTargetDsId: win.SmallOrderConfig.TARGET_DS_ID }) };
  win.RegionDataApi = { __transport: {
    allRows: async () => [targetRow("S1", 10, 0)],
    executeSqlRows: async (dsId, sql, limit, options) => {
      calls.push({ type: options?.smallOrderTodayQuery ? "today" : "actual", sql });
      if (options?.smallOrderTodayQuery) throw new Error("today timeout");
      return [{ dealer_code: "S1", actual_small_order: 6, retained_small_order: 6 }];
    }
  } };
  const raw = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "today-fail", brand: "MG" }, [{ code: "S1", name: "门店S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-08-12" });
  const report = win.SmallOrderModel.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(raw.status, "ready");
  assert.equal(raw.actualStatus, "ready");
  assert.equal(raw.todayStatus, "today_unavailable");
  assert.equal(report.summary.actual, 6);
  assert.equal(report.summary.todayActual, null);
  assert.equal(report.summary.achievementRate, 0.6);
  assert.equal(calls.filter((item) => item.type === "actual").length, 1);
  assert.equal(calls.filter((item) => item.type === "today").length, 1);

  calls.length = 0;
  const afterPeriod = await win.SmallOrderApi.loadSmallOrderRaw({ userId: "today-after", brand: "MG" }, [{ code: "S1", name: "门店S1", areaCode: "A1", districtCode: "D1" }], { today: "2026-08-23" });
  assert.equal(afterPeriod.todayStatus, "out_of_period");
  assert.equal(calls.filter((item) => item.type === "today").length, 0);
});

test("小订实际 SQL 固定 MG 07、固定窗口并隐藏转大定", () => {
  const sql = windowContext.SmallOrderApi.smallOrderActualSql({ startDate: "2026-07-29", endDate: "2026-08-22" });
  assert.match(sql, /`品牌名称` = 'MG'/);
  assert.match(sql, /`汇报车系名称` = 'MG 07'/);
  assert.match(sql, /`日yyyy-mm-dd` >= '2026-07-29'/);
  assert.match(sql, /`日yyyy-mm-dd` <= '2026-08-22'/);
  assert.match(sql, /当日首触小订数/);
  assert.match(sql, /当日首触留存小订数/);
  assert.match(sql, /当日首触小订退订数/);
  assert.doesNotMatch(sql, /\bIN\s*\(/i);
  assert.doesNotMatch(sql, /`经销商代码`/);
  assert.doesNotMatch(sql, /转大定/);
});
