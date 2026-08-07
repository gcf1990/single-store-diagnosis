import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
const utilsSource = await readFile(new URL("../utils.js", import.meta.url), "utf8");
const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

function context(search = "") {
  const sandbox = {
    window: {
      location: { search },
      RetailRuntimeConfig: { getSingleStoreAppUrl: () => "https://example.test/store" }
    },
    location: { hostname: "localhost", pathname: "/", search },
    URL,
    URLSearchParams
  };
  vm.runInNewContext(vehicleSeriesSource, sandbox);
  vm.runInNewContext(utilsSource, sandbox);
  vm.runInNewContext(dataApiSource, sandbox);
  return sandbox.window;
}

test("多选车系状态使用可选枚举归一，全部车系等价为空集合", () => {
  const vehicle = context().RetailVehicleSeries;
  const options = ["全新MG4", "MG 4X", "MG 07"];
  assert.deepEqual(
    JSON.parse(JSON.stringify(vehicle.normalizeVehicleSeriesSelection(["MG 4X", "全部车系", "全新MG4", "MG 4X", "不存在"], options))),
    ["全新MG4", "MG 4X"]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(vehicle.normalizeVehicleSeriesSelection(["全部"], options))), []);
  assert.equal(vehicle.vehicleSeriesKey(["MG 4X", "全新MG4"]), vehicle.vehicleSeriesKey(["全新MG4", "MG 4X"]));
  assert.equal(vehicle.vehicleSeriesSummary(["全新MG4", "MG 4X", "MG 07"]), "已选 3 个车系");
});

test("URL 读取优先 repeated vehicleSeries，历史别名仅在主参数缺失时兜底", () => {
  const primary = context("?vehicleSeries=MG%204X&vehicleSeries=%E5%85%A8%E6%96%B0MG4&carSeries=Cyberster");
  assert.deepEqual(JSON.parse(JSON.stringify(primary.RetailUtils.readRetailParams("全部").vehicleSeries)), ["全新MG4", "MG 4X"]);

  const alias = context("?series=MG%204X");
  assert.deepEqual(JSON.parse(JSON.stringify(alias.RetailUtils.readRetailParams("全部").vehicleSeries)), ["MG 4X"]);

  const all = context("?vehicleSeries=%E5%85%A8%E9%83%A8%E8%BD%A6%E7%B3%BB");
  assert.deepEqual(JSON.parse(JSON.stringify(all.RetailUtils.readRetailParams("全部").vehicleSeries)), []);
});

test("销售缓存键按集合稳定去重排序，且不同集合隔离", () => {
  const region = context().RegionDataApi;
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const base = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "S1" };
  const multi = region.salesPreviewCacheKey({ ...base, vehicleSeries: ["MG 4X", "全新MG4", "MG 4X"] }, range);
  const reordered = region.salesPreviewCacheKey({ ...base, vehicleSeries: ["全新MG4", "MG 4X"] }, range);
  const single = region.salesPreviewCacheKey({ ...base, vehicleSeries: ["全新MG4"] }, range);
  const all = region.salesPreviewCacheKey({ ...base, vehicleSeries: [] }, range);
  assert.equal(multi, reordered);
  assert.notEqual(multi, single);
  assert.notEqual(single, all);
});

test("销售 SQL 与单店跳转链接都保留多车系集合契约", () => {
  const win = context();
  const params = { brand: "MG", vehicleSeries: ["全新MG4", "MG 'X"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const sql = win.RegionDataApi.salesAggregateSql(params, range);
  assert.match(sql, /`汇报车系名称` IN \('全新MG4', 'MG ''X'\)/);

  const link = win.RetailUtils.buildSingleStoreLink(
    { startDate: "2026-07-01", endDate: "2026-07-20", brand: "MG", vehicleSeries: ["MG 4X", "全新MG4"] },
    { code: "S1", name: "门店1" }
  );
  assert.match(link, /vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG\+4X/);
});

test("前端注册 popstate 监听，支持浏览器前进后退恢复车系集合", () => {
  assert.match(appSource, /window\.addEventListener\("popstate", syncVehicleSeriesFromHistory\)/);
  assert.match(appSource, /function syncVehicleSeriesFromHistory\(\)[\s\S]*readRetailParams\(ALL\)[\s\S]*writeVehicleSeriesToUrl\(normalized\)[\s\S]*load\(\)/);
});
