import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
const dataApiSource = await readFile(new URL("../data-api.js", import.meta.url), "utf8");
const utilsSource = await readFile(new URL("../utils.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const sortContract = JSON.parse(await readFile(new URL("./fixtures/vehicle-series-sort-contract.json", import.meta.url), "utf8"));

async function readOptionalSingleStoreSource() {
  try {
    return await readFile(new URL("../../../super-app/src/services/storeDiagnosis.ts", import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

const singleStoreSource = await readOptionalSingleStoreSource();

function api() {
  const context = { window: {}, location: { hostname: "localhost", pathname: "/", search: "" }, URL, URLSearchParams };
  vm.runInNewContext(source, context);
  vm.runInNewContext(dataApiSource, context);
  return context.window;
}

test("车系排序遵守单店排序契约：置顶、中间 zh-CN、置底", () => {
  const vehicle = api().RetailVehicleSeries;
  assert.deepEqual(
    Array.from(vehicle.sortVehicleSeriesOptions(["未知车系", "MG5", "MG 07", "其他车系", "Cyberster", "全新MG4", "位置车系", "MG 4X"])),
    ["全新MG4", "MG 4X", "MG 07", "Cyberster", "MG5", "其他车系", "未知车系", "位置车系"]
  );
  assert.equal(vehicle.normalizeVehicleSeries("全部"), vehicle.ALL);
  assert.deepEqual(
    JSON.parse(JSON.stringify(vehicle.normalizeVehicleSeriesSelection(["MG 4X", "全部车系", "全新MG4", "MG 4X", "不存在"], ["全新MG4", "MG 4X"]))),
    ["全新MG4", "MG 4X"]
  );
  assert.equal(vehicle.vehicleSeriesSummary([]), "全部车系");
  assert.equal(vehicle.vehicleSeriesSummary(["全新MG4"]), "全新MG4");
  assert.equal(vehicle.vehicleSeriesSummary(["全新MG4", "MG 4X"]), "已选 2 个车系");
});

test("多店车系排序逐项对齐单店排序契约；相邻源码存在时阻断漂移", () => {
  const readPriority = (name) => {
    const matched = singleStoreSource.match(new RegExp(`const ${name} = \\[(.*?)\\];`));
    return matched ? [...matched[1].matchAll(/'([^']+)'/g)].map((item) => item[1]) : null;
  };
  assert.equal(sortContract.sourceFile, "../../super-app/src/services/storeDiagnosis.ts");
  assert.equal(sortContract.verifiedAt, "2026-07-16");
  const top = sortContract.topPriority;
  const bottom = sortContract.bottomPriority;
  assert.deepEqual(top, ["全新MG4", "MG 4X", "MG 07"]);
  assert.deepEqual(bottom, ["其他车系", "未知车系", "位置车系"]);
  if (singleStoreSource) {
    const sourceTop = readPriority("VEHICLE_SERIES_TOP_ORDER");
    const sourceBottom = readPriority("VEHICLE_SERIES_BOTTOM_ORDER");
    if (sourceTop && sourceBottom) {
      assert.deepEqual(sourceTop, top);
      assert.deepEqual(sourceBottom, bottom);
    }
  }
  const compareSingle = (left, right) => {
    const leftTop = top.indexOf(left); const rightTop = top.indexOf(right);
    const leftBottom = bottom.indexOf(left); const rightBottom = bottom.indexOf(right);
    const group = (topIndex, bottomIndex) => topIndex >= 0 ? 0 : bottomIndex >= 0 ? 2 : 1;
    const leftGroup = group(leftTop, leftBottom); const rightGroup = group(rightTop, rightBottom);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftGroup === 0) return leftTop - rightTop;
    if (leftGroup === 2) return leftBottom - rightBottom;
    return left.localeCompare(right, "zh-CN");
  };
  const input = ["未知车系", "MG5", "MG 07", "其他车系", "Cyberster", "全新MG4", "位置车系", "MG 4X", "MG ES5"];
  const expected = [...input].sort(compareSingle);
  assert.deepEqual(Array.from(api().RetailVehicleSeries.sortVehicleSeriesOptions(input)), expected);
});

test("销售过滤和品牌全量枚举查询只使用汇报车系名称，且多选集合使用 IN", () => {
  const region = api().RegionDataApi;
  const params = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "P1", vehicleSeries: ["全新MG4", "MG 4X"] };
  const filters = region.salesFilters(params, { startDate: "2026-07-01", endDate: "2026-07-02" });
  assert.deepEqual(JSON.parse(JSON.stringify(filters.find((filter) => filter.field === "汇报车系名称"))), { field: "汇报车系名称", type: "IN", value: ["全新MG4", "MG 4X"] });
  assert.match(region.salesAggregateSql({ ...params, vehicleSeries: ["全新MG4", "MG 'X"] }, { startDate: "2026-07-01", endDate: "2026-07-02" }), /`汇报车系名称` IN \('全新MG4', 'MG ''X'\)/);
  const optionsSql = region.vehicleSeriesOptionsSql("MG");
  assert.match(optionsSql, /SELECT DISTINCT/);
  assert.match(optionsSql, /`品牌名称` = 'MG'/);
  assert.doesNotMatch(optionsSql, /日yyyy-mm-dd|大区代码|小区代码|一级经销商代码/);
  const range = { startDate: "2026-07-01", endDate: "2026-07-02" };
  assert.equal(region.salesPreviewCacheKey(params, range), region.salesPreviewCacheKey({ ...params, vehicleSeries: ["MG 4X", "全新MG4"] }, range));
  assert.notEqual(region.salesPreviewCacheKey(params, range), region.salesPreviewCacheKey({ ...params, vehicleSeries: ["MG 4X"] }, range));
});

test("车系枚举请求失败不缓存 rejected Promise，后续刷新可重试", async () => {
  let calls = 0;
  const context = {
    window: {}, location: { hostname: "localhost", pathname: "/", search: "" }, URL, URLSearchParams,
    fetch: async () => {
      calls += 1;
      return { ok: false, status: 500, text: async () => "{}" };
    }
  };
  vm.runInNewContext(source, context);
  vm.runInNewContext(dataApiSource, context);
  await assert.rejects(context.window.RegionDataApi.loadVehicleSeriesOptions({ brand: "MG" }));
  await assert.rejects(context.window.RegionDataApi.loadVehicleSeriesOptions({ brand: "MG" }));
  assert.equal(calls, 2);
});

test("URL 兼容重复 vehicleSeries、历史别名，并统一为空数组表示全部车系", () => {
  ["vehicleSeries", "carSeries", "series"].forEach((key) => {
    const context = { window: { location: { search: `?${key}=%E5%85%A8%E6%96%B0MG4` } }, URLSearchParams };
    vm.runInNewContext(source, context);
    vm.runInNewContext(utilsSource, context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.RetailUtils.readRetailParams("全部").vehicleSeries)), ["全新MG4"]);
  });
  const repeated = { window: { location: { search: "?vehicleSeries=MG%204X&vehicleSeries=%E5%85%A8%E6%96%B0MG4&carSeries=Cyberster" } }, URLSearchParams };
  vm.runInNewContext(source, repeated);
  vm.runInNewContext(utilsSource, repeated);
  assert.deepEqual(JSON.parse(JSON.stringify(repeated.window.RetailUtils.readRetailParams("全部").vehicleSeries)), ["全新MG4", "MG 4X"]);

  const context = { window: { location: { search: "?vehicleSeries=%E5%85%A8%E9%83%A8" } }, URLSearchParams };
  vm.runInNewContext(source, context);
  vm.runInNewContext(utilsSource, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.RetailUtils.readRetailParams("全部").vehicleSeries)), []);

  const linkContext = { window: { location: { search: "" }, RetailRuntimeConfig: { getSingleStoreAppUrl: () => "https://example.test/store" } }, URLSearchParams };
  vm.runInNewContext(source, linkContext);
  vm.runInNewContext(utilsSource, linkContext);
  const link = linkContext.window.RetailUtils.buildSingleStoreLink({ startDate: "2026-07-01", endDate: "2026-07-02", brand: "MG", vehicleSeries: ["MG 4X", "全新MG4"] }, { code: "S1", name: "门店1" });
  assert.match(link, /vehicleSeries=%E5%85%A8%E6%96%B0MG4&vehicleSeries=MG\+4X/);
  assert.match(appSource, /function normalizeVehicleSeriesUrl[\s\S]*search\.has\("carSeries"\)[\s\S]*search\.has\("series"\)[\s\S]*writeVehicleSeriesToUrl/);
});
