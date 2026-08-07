import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

function loadAppTestApi() {
  const context = {
    window: {
      __RETAIL_PC_APP_TEST__: true,
      RetailVehicleSeries: { ALL: "全部车系" },
      RetailUtils: {
        readRetailParams: () => ({}),
        pct: (value, digits = 1) => value === null || Number.isNaN(value) ? "--" : `${value.toFixed(digits)}%`,
        deltaPercent: (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : null,
        buildSingleStoreLink: () => "#"
      },
      RegionDataApi: {},
      IronMetricsApi: {},
      IronMetricsModel: {},
      RegionMetrics: {
        buildWorkbench() {},
        buildDynamicStoreDiagnoses() {},
        pct: (num, den) => den > 0 ? (num / den) * 100 : null
      },
      OrganizationView: {
        LEVEL_META: {},
        readPersonnelProfile: () => ({}),
        resolveRole: () => ({}),
        createViewState: () => ({}),
        drillDown() {},
        drillBack() {},
        buildViewRows: () => [],
        evaluateNationalScopeEvidence: () => true
      },
      OrganizationScope: { resolveActualScope: () => ({}) }
    }
  };
  vm.runInNewContext(appSource, context);
  return context.window.__retailPcAppTest;
}

const api = loadAppTestApi();

function row(current, previous = {}) {
  const empty = { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 };
  return { current: { ...empty, ...current }, previous: { ...empty, ...previous } };
}

test("销售概览行内四率按固定顺序和原始分子分母计算", () => {
  const metrics = api.salesRowConversionRates(row(
    { leads: 100, arrivals: 40, drives: 20, orders: 8, retail: 6 },
    { leads: 80, arrivals: 32, drives: 16, orders: 4, retail: 2 }
  ));
  assert.deepEqual(JSON.parse(JSON.stringify(metrics.map((item) => item.label))), ["线索到店率", "到店试驾率", "试驾订单率", "交付率"]);
  assert.deepEqual(JSON.parse(JSON.stringify(metrics.map((item) => item.valueText))), ["40.0%", "50.0%", "40.0%", "75.0%"]);
  assert.deepEqual(JSON.parse(JSON.stringify(metrics.map((item) => item.deltaText))), ["0.0%", "0.0%", "+15.0%", "+25.0%"]);
});

test("百分点月环比不是相对涨跌率", () => {
  const [leadArrival] = api.salesRowConversionRates(row(
    { leads: 100, arrivals: 50 },
    { leads: 100, arrivals: 40 }
  ));
  assert.equal(leadArrival.delta, 10);
  assert.equal(leadArrival.deltaText, "+10.0%");
});

test("分子为 0 显示 0.0%，分母为 0 显示 --", () => {
  const metrics = api.salesRowConversionRates(row(
    { leads: 10, arrivals: 0, drives: 0, orders: 0, retail: 0 },
    { leads: 10, arrivals: 2, drives: 1, orders: 1, retail: 0 }
  ));
  assert.equal(metrics[0].valueText, "0.0%");
  assert.equal(metrics[0].deltaText, "-20.0%");
  assert.equal(metrics[1].valueText, "--");
  assert.equal(metrics[1].deltaText, "--");
});

test("当前率有效但上月分母为 0 时只让月环比显示 --", () => {
  const [leadArrival] = api.salesRowConversionRates(row(
    { leads: 10, arrivals: 5 },
    { leads: 0, arrivals: 0 }
  ));
  assert.equal(leadArrival.valueText, "50.0%");
  assert.equal(leadArrival.deltaText, "--");
  assert.equal(leadArrival.tone, "neutral");
});

test("当前率和上月率相等时显示可比 0，而不是不可比较", () => {
  const [leadArrival] = api.salesRowConversionRates(row(
    { leads: 100, arrivals: 40 },
    { leads: 80, arrivals: 32 }
  ));
  assert.equal(leadArrival.valueText, "40.0%");
  assert.equal(leadArrival.deltaText, "0.0%");
  assert.equal(leadArrival.tone, "neutral");
  assert.match(api.salesFunnelCell(row(
    { leads: 100, arrivals: 40, drives: 20, orders: 8, retail: 6 },
    { leads: 80, arrivals: 32, drives: 16, orders: 4, retail: 3 }
  )), /aria-label="线索到店率 当前 40\.0%，月环比 持平 0\.0% 个百分点"/);
});

test("第四项必须是表内交付率而不是顶部线索订单率", () => {
  const metrics = api.salesRowConversionRates(row(
    { leads: 100, arrivals: 50, drives: 30, orders: 10, retail: 8 },
    { leads: 100, arrivals: 50, drives: 30, orders: 10, retail: 5 }
  ));
  const fourth = metrics[3];
  assert.equal(fourth.label, "交付率");
  assert.equal(fourth.valueText, "80.0%");
  assert.notEqual(fourth.valueText, "10.0%");
});

test("渲染 DOM 保留五段上层并在底部转化率条展示四个短标签", () => {
  const html = api.salesFunnelCell(row(
    { leads: 100, arrivals: 40, drives: 20, orders: 8, retail: 6 },
    { leads: 80, arrivals: 32, drives: 16, orders: 4, retail: 2 }
  ));
  assert.match(html, /class="funnel-chain"/);
  assert.match(html, /class="funnel-conversion-row"/);
  assert.match(html, /线索[\s\S]*到店[\s\S]*试驾[\s\S]*订单[\s\S]*零售/);
  assert.equal((html.match(/class="funnel-conversion-item"/g) || []).length, 4);
  assert.match(html, />到店率<\/span>[\s\S]*>试驾率<\/span>[\s\S]*>订单率<\/span>[\s\S]*>交付率<\/span>/);
  assert.match(html, /aria-label="交付率 当前 75\.0%，月环比 增加 25\.0% 个百分点"/);
});
