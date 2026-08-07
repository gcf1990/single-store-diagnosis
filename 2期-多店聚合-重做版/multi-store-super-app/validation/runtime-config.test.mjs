import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const productionUrl = "https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/";
const testUrl = "https://rdata-pv.rauto.com/open-apps/r8ce093b6d93143d8aa6852f/";
const runtimeConfigSource = await readFile(new URL("../runtime-config.js", import.meta.url), "utf8");
const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
const utilsSource = await readFile(new URL("../utils.js", import.meta.url), "utf8");
const actualSettings = JSON.parse(await readFile(new URL("../settings.json", import.meta.url), "utf8"));

async function loadRuntimeConfig({ settings, reject = false } = {}) {
  const context = {
    URL,
    URLSearchParams,
    Promise,
    window: {}
  };
  context.window.fetch = async () => {
    if (reject) throw new Error("settings unavailable");
    return {
      ok: true,
      json: async () => settings
    };
  };
  vm.runInNewContext(runtimeConfigSource, context);
  await context.window.RetailRuntimeConfig.ready;
  return context;
}

test("production 配置使用生产单店地址", async () => {
  const context = await loadRuntimeConfig({
    settings: {
      environment: "production",
      singleStoreAppUrls: { production: productionUrl }
    }
  });

  assert.equal(context.window.RetailRuntimeConfig.getConfig().environment, "production");
  assert.equal(context.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);
});

test("q084 当前发布配置使用生产单店地址并保留测试映射", async () => {
  const context = await loadRuntimeConfig({ settings: actualSettings });

  assert.equal(actualSettings.environment, "production");
  assert.equal(actualSettings.singleStoreAppUrls.test, testUrl);
  assert.equal(actualSettings.singleStoreAppUrls.production, productionUrl);
  assert.equal(context.window.RetailRuntimeConfig.getConfig().environment, "production");
  assert.equal(context.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);
});

for (const environment of ["development", "test"]) {
  test(`${environment} 配置的单店地址优先于生产地址`, async () => {
    const environmentUrl = environment === "test"
      ? testUrl
      : "https://development.example.com/open-apps/single-store/";
    const context = await loadRuntimeConfig({
      settings: {
        environment,
        singleStoreAppUrls: { production: productionUrl, [environment]: environmentUrl }
      }
    });

    assert.equal(context.window.RetailRuntimeConfig.getSingleStoreAppUrl(), environmentUrl);
  });

  test(`${environment} 空地址回退生产地址`, async () => {
    const context = await loadRuntimeConfig({
      settings: {
        environment,
        singleStoreAppUrls: { production: productionUrl, [environment]: "  " }
      }
    });

    assert.equal(context.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);
  });
}

test("无效环境和配置加载失败均回退安全生产地址", async () => {
  const invalidEnvironmentContext = await loadRuntimeConfig({
    settings: {
      environment: "staging",
      singleStoreAppUrls: { production: productionUrl, development: "https://dev.example.com/" }
    }
  });
  assert.equal(invalidEnvironmentContext.window.RetailRuntimeConfig.getConfig().environment, "production");
  assert.equal(invalidEnvironmentContext.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);

  const failedContext = await loadRuntimeConfig({ reject: true });
  assert.equal(failedContext.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);
});

test("门店详情链接从运行时配置读取地址且保留既有 Query 参数", async () => {
  const context = await loadRuntimeConfig({
    settings: {
      environment: "test",
      singleStoreAppUrls: {
        production: productionUrl,
        test: testUrl
      }
    }
  });
  vm.runInNewContext(utilsSource, context);

  const href = context.window.RetailUtils.buildSingleStoreLink({
    period: "自定义",
    startDate: "2026-07-01",
    endDate: "2026-07-16",
    brand: "MG",
    brandCode: "MG",
    area: "大区1",
    areaCode: "A1",
    district: "小区1",
    districtCode: "D1",
    theme: "light"
  }, {
    name: "门店1",
    code: "S1",
    area: "大区1",
    areaCode: "A1",
    district: "小区1",
    districtCode: "D1"
  });
  const url = new URL(href);

  assert.equal(`${url.origin}${url.pathname}`, testUrl);
  assert.equal(url.searchParams.get("source"), "region-workbench");
  assert.equal(url.searchParams.get("sourceApp"), "multi-store-workbench");
  assert.equal(url.searchParams.get("sourceModule"), "store-sales-list");
  assert.equal(url.searchParams.get("period"), "自定义");
  assert.equal(url.searchParams.get("brand"), "MG");
  assert.equal(url.searchParams.get("brandCode"), "MG");
  assert.equal(url.searchParams.get("region"), "大区1");
  assert.equal(url.searchParams.get("area"), "大区1");
  assert.equal(url.searchParams.get("district"), "小区1");
  assert.equal(url.searchParams.get("dealer"), "门店1");
  assert.equal(url.searchParams.get("dealerShortName"), "门店1");
  assert.equal(url.searchParams.get("store"), "门店1");
  assert.equal(url.searchParams.get("dealerCode"), "S1");
  assert.equal(url.searchParams.get("dealerCompanyCode"), "S1");
  assert.equal(url.searchParams.get("storeCode"), "S1");
  assert.equal(url.searchParams.get("regionCode"), "A1");
  assert.equal(url.searchParams.get("districtCode"), "D1");
  assert.equal(url.searchParams.get("startDate"), "2026-07-01");
  assert.equal(url.searchParams.get("endDate"), "2026-07-16");
  assert.equal(url.searchParams.get("theme"), "light");
  assert.equal(url.searchParams.get("previewMode"), "light");
});

test("q084 当前 settings 构造门店详情链接指向生产单店且保留既有 Query 参数", async () => {
  const context = await loadRuntimeConfig({ settings: actualSettings });
  vm.runInNewContext(vehicleSeriesSource, context);
  vm.runInNewContext(utilsSource, context);

  const href = context.window.RetailUtils.buildSingleStoreLink({
    period: "自定义",
    startDate: "2026-07-01",
    endDate: "2026-07-16",
    brand: "MG",
    brandCode: "MG",
    area: "大区1",
    areaCode: "A1",
    district: "小区1",
    districtCode: "D1",
    theme: "dark",
    vehicleSeries: ["MG5", "MG7"]
  }, {
    name: "门店1",
    code: "S1",
    area: "大区1",
    areaCode: "A1",
    district: "小区1",
    districtCode: "D1"
  });
  const url = new URL(href);

  assert.equal(context.window.RetailRuntimeConfig.getConfig().environment, "production");
  assert.equal(context.window.RetailRuntimeConfig.getSingleStoreAppUrl(), productionUrl);
  assert.equal(`${url.origin}${url.pathname}`, productionUrl);
  assert.equal(url.searchParams.get("dealerCode"), "S1");
  assert.equal(url.searchParams.get("dealer"), "门店1");
  assert.equal(url.searchParams.get("startDate"), "2026-07-01");
  assert.equal(url.searchParams.get("endDate"), "2026-07-16");
  assert.equal(url.searchParams.get("brand"), "MG");
  assert.equal(url.searchParams.get("brandCode"), "MG");
  assert.equal(url.searchParams.get("regionCode"), "A1");
  assert.equal(url.searchParams.get("districtCode"), "D1");
  assert.deepEqual(url.searchParams.getAll("vehicleSeries"), ["MG5", "MG7"]);
  assert.equal(url.searchParams.get("source"), "region-workbench");
  assert.equal(url.searchParams.get("sourceApp"), "multi-store-workbench");
  assert.equal(url.searchParams.get("sourceModule"), "store-sales-list");
});
