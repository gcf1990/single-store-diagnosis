import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { ironRaw } from "./iron-metrics-fixtures.js";

async function load(path, context) {
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), "utf8"), context);
}

const context = { window: { __IRON_METRICS_TEST__: true } };
await load("../iron-metrics-contract.js", context);
await load("../iron-metrics-model.js", context);
await load("../iron-metrics-view.js", context);
await load("../organization-view.js", context);
const contract = context.window.IronMetricsContract;
const model = context.window.IronMetricsModel;
const view = context.window.IronMetricsView;
const organizationView = context.window.OrganizationView;

const productionContext = { window: {} };
await load("../iron-metrics-contract.js", productionContext);
await load("../iron-metrics-model.js", productionContext);
await load("../iron-metrics-view.js", productionContext);
await load("../organization-view.js", productionContext);
assert.equal(Object.hasOwn(productionContext.window.IronMetricsModel, "__test"), false);
assert.equal(Object.hasOwn(productionContext.window.IronMetricsView, "__test"), false);

const validDealers = [
  { code: "S1", name: "门店1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
  { code: "S2", name: "门店2", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" }
];

test("打铁 11 项指标合同、顺序、目标和首跟无目标符合 REQ-012", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(contract.metricsFor("invite").map((metric) => metric.code))), [
    "invite_trial_mention_rate",
    "wechat_apply_mention_rate",
    "high_intent_low_level_rate",
    "first_follow_call_60s_rate",
    "follow_30min_rate",
    "follow_24h_rate",
    "two_day_three_call_rate"
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(contract.metricsFor("trial").map((metric) => metric.name))), ["优质试驾率", "试驾录音回收率", "手车互联开口率", "离车泊入开口率"]);
  assert.equal(contract.metricByCode("first_follow_call_60s_rate").target, null);
  assert.equal(contract.targetLabel(null), null);
  assert.equal(contract.targetLabel(0.53), "目标 53%");
});

test("模型以 0~1 底值输出，不包含官方 status_value/status_label", () => {
  const stores = model.buildStoreFacts(ironRaw, validDealers);
  const row = { level: "district", code: "D1", name: "小区1", stores };
  const records = model.aggregateRows([row], ironRaw.sourceStates);
  const asObject = Object.fromEntries(records.map((record) => [record.metric_code, record]));
  assert.equal(asObject.invite_trial_mention_rate.metric_value, 1 / 3);
  assert.equal(asObject.wechat_apply_mention_rate.metric_value, 1 / 3);
  assert.equal(asObject.high_intent_low_level_rate.metric_value, 1 / 3);
  assert.equal(asObject.quality_trial_rate.metric_value, 1 / 3);
  assert.equal(asObject.trial_record_upload_rate.metric_value, 1 / 2);
  assert.equal(asObject.phone_car_interconnect_mention_rate.metric_value, 1 / 2);
  assert.equal(asObject.remote_parking_mention_rate.metric_value, 0);
  assert.equal(model.displayValue(asObject.remote_parking_mention_rate), "0.0%");
  assert.equal(asObject.first_follow_call_60s_rate.target_label, null);
  assert.ok(records.every((record) => !("status_value" in record) && !("status_label" in record)));
});

test("来源失败只影响同源指标，成功来源不被清空", () => {
  const states = { ...ironRaw.sourceStates, dcc: { status: "incomplete", complete: false, error: "DCC 模拟失败" } };
  const stores = model.buildStoreFacts(ironRaw, validDealers);
  const row = { level: "district", code: "D1", name: "小区1", stores };
  const records = Object.fromEntries(model.aggregateRows([row], states).map((record) => [record.metric_code, record]));
  assert.equal(records.first_follow_call_60s_rate.source_status, "incomplete");
  assert.equal(records.follow_30min_rate.complete, false);
  assert.equal(records.invite_trial_mention_rate.source_status, "success");
  assert.equal(model.displayValue(records.invite_trial_mention_rate), "33.3%");
});

test("父级组织对跨门店相同业务ID重新distinct且命中按any-hit合并", () => {
  const raw = {
    ...ironRaw,
    inviteMentionRows: [
      { dealer_code: "S1", record_id: "DUP-CALL", ai_qc_score: 98, mg_inv_in_trial: 1, mg_plus_micro_apply: 0 },
      { dealer_code: "S2", record_id: "DUP-CALL", ai_qc_score: 96, mg_inv_in_trial: 0, mg_plus_micro_apply: 0 }
    ],
    dccRows: [
      { "经销商代码": "S1", "线索编码": "DUP-LEAD", "下发CRM时间": "2026-07-02", "是否24小时外呼": "是" },
      { "经销商代码": "S2", "线索编码": "DUP-LEAD", "下发CRM时间": "2026-07-02", "是否24小时外呼": "否" }
    ],
    trialTalkRows: [
      { "经销商代码": "S1", "试驾清单ID": "DUP-TRIAL", "试驾体验点": "手机互联", "是否提及": "是" },
      { "经销商代码": "S2", "试驾清单ID": "DUP-TRIAL", "试驾体验点": "手机互联", "是否提及": "否" }
    ]
  };
  const stores = model.buildStoreFacts(raw, validDealers);
  const records = Object.fromEntries(model.aggregateRows([{ level: "district", code: "D1", name: "小区1", stores }], raw.sourceStates).map((record) => [record.metric_code, record]));
  assert.equal(records.invite_trial_mention_rate.numerator, 1);
  assert.equal(records.invite_trial_mention_rate.denominator, 1);
  assert.equal(records.invite_trial_mention_rate.metric_value, 1);
  assert.equal(records.follow_24h_rate.metric_value, 1);
  assert.equal(records.phone_car_interconnect_mention_rate.metric_value, 1);
});

test("模型层空授权门店集合拒绝非 DCC 返回行，但保留 DCC 自身授权行", () => {
  const raw = {
    ...ironRaw,
    inviteMentionRows: [{ dealer_code: "OUTSIDE", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 1 }],
    intentLevelRows: [],
    dccRows: [{
      dealer_code: "DCC1",
      dealer_name: "DCC门店1",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 2,
      follow_30min_denominator: 4,
      follow_24h_numerator: 3,
      follow_24h_denominator: 4,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 5
    }],
    dccThreeCallRows: [],
    qualityTrialRows: [],
    trialRecordRows: [],
    trialTalkRows: []
  };
  const stores = model.buildStoreFacts(raw, []);
  assert.equal(stores.length, 1);
  assert.equal(stores[0].code, "DCC1");
  assert.equal(stores[0].areaCode, "DA1");
  const records = Object.fromEntries(model.aggregateRows([{ level: "store", code: "DCC1", name: "DCC门店1", stores: [stores[0]] }], raw.sourceStates).map((record) => [record.metric_code, record]));
  assert.equal(model.displayValue(records.invite_trial_mention_rate), "--");
  assert.equal(records.follow_30min_rate.metric_value, 0.5);
});

test("loading 状态优先于 complete=false 并保持加载态", () => {
  const sourceState = { status: "loading", complete: false };
  assert.equal(model.__test.statusFor(null, sourceState), "loading");
  const record = model.aggregateRows([{ level: "store", code: "S1", name: "门店1", ironMetrics: {} }], { dcc: sourceState })
    .find((item) => item.metric_code === "follow_24h_rate");
  assert.equal(record.source_status, "loading");
  assert.equal(model.displayValue(record), "loading");
  assert.match(context.window.IronMetricsView.__test.cellHtml(record), /class="iron-loading"/);
  assert.doesNotMatch(context.window.IronMetricsView.__test.cellHtml(record), /数据不完整/);
});

test("当前期 DCC-only 组织在月周比较期缺行时按已结算源状态对齐为空，不永久 loading 或按 0% 环比", () => {
  const currentRaw = {
    sourceStates: { dcc: { status: "success", complete: true } },
    dccRows: [{
      dealer_code: "DCC-ONLY",
      dealer_name: "DCC专属店",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 1,
      follow_30min_denominator: 2,
      follow_24h_numerator: 1,
      follow_24h_denominator: 2,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 2
    }]
  };
  const currentRows = model.buildIronViewRows({
    displayStores: model.buildStoreFacts(currentRaw, []),
    level: "store"
  });
  const currentRecords = model.aggregateRows(currentRows, currentRaw.sourceStates);
  const records = model.attachComparisonRecords(
    currentRecords,
    [],
    [],
    { dcc: { status: "success", complete: true } },
    { dcc: { status: "empty", complete: true } }
  );
  const record = records.find((item) => item.metric_code === "follow_30min_rate");
  assert.equal(record.month_source_status, "empty");
  assert.equal(record.week_source_status, "empty");
  assert.equal(record.monthLoading, false);
  assert.equal(record.weekLoading, false);
  assert.equal(record.monthError, "");
  assert.equal(record.weekError, "");
  assert.equal(record.month_value, null);
  assert.equal(record.week_value, null);
  assert.equal(record.monthDelta, null);
  assert.equal(record.weekDelta, null);
  const html = view.__test.cellHtml(record);
  assert.doesNotMatch(html, /加载中|加载失败/);
  assert.equal((html.match(/>--</g) || []).length, 2);
});

test("比较期组织缺行时仅 sourceState loading 显示加载中，incomplete 显示加载失败", () => {
  const currentRaw = {
    sourceStates: { dcc: { status: "success", complete: true } },
    dccRows: [{
      dealer_code: "DCC-ONLY",
      dealer_name: "DCC专属店",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 1,
      follow_30min_denominator: 2,
      follow_24h_numerator: 1,
      follow_24h_denominator: 2,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 2
    }]
  };
  const currentRows = model.buildIronViewRows({
    displayStores: model.buildStoreFacts(currentRaw, []),
    level: "store"
  });
  const record = model.attachComparisonRecords(
    model.aggregateRows(currentRows, currentRaw.sourceStates),
    [],
    [],
    { dcc: { status: "incomplete", complete: false, error: "月比较失败", fieldGapReason: "月字段缺口" } },
    { dcc: { status: "loading", complete: false } }
  ).find((item) => item.metric_code === "follow_30min_rate");
  assert.equal(record.month_source_status, "incomplete");
  assert.equal(record.monthError, "加载失败");
  assert.equal(record.monthLoading, false);
  assert.equal(record.monthFieldGapReason, "月字段缺口");
  assert.equal(record.week_source_status, "loading");
  assert.equal(record.weekError, "");
  assert.equal(record.weekLoading, true);
  const html = view.__test.cellHtml(record);
  assert.match(html, /加载失败/);
  assert.match(html, /加载中/);
});

test("打铁 CSV 宽表按前端顺序导出当前值、月环比和周环比", () => {
  const rows = [{ level: "district", code: "D1", name: "小区1", stores: model.buildStoreFacts(ironRaw, validDealers) }];
  const currentRecords = model.aggregateRows(rows, ironRaw.sourceStates);
  const monthRecords = currentRecords.map((record) => ({
    ...record,
    metric_value: Math.max(0, record.metric_value - 0.1),
    denominator: record.denominator || 1
  }));
  const weekRecords = currentRecords.map((record) => ({
    ...record,
    metric_value: record.metric_value,
    denominator: record.denominator || 1
  }));
  const records = model.attachComparisonRecords(currentRecords, monthRecords, weekRecords, ironRaw.sourceStates, ironRaw.sourceStates);
  const inviteCsv = view.exportCsvRows(records, rows, "invite", { firstColumn: "小区名称" });
  const trialCsv = view.exportCsvRows(records, rows, "trial", { firstColumn: "小区名称" });
  assert.equal(inviteCsv[0].length, 22);
  assert.equal(trialCsv[0].length, 13);
  assert.deepEqual(JSON.parse(JSON.stringify(inviteCsv[0])), [
    "小区名称",
    ...contract.metricsFor("invite").flatMap((metric) => [metric.name, `${metric.name}月环比`, `${metric.name}周环比`])
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(trialCsv[0])), [
    "小区名称",
    ...contract.metricsFor("trial").flatMap((metric) => [metric.name, `${metric.name}月环比`, `${metric.name}周环比`])
  ]);
  assert.equal(inviteCsv.length, 2);
  assert.equal(inviteCsv[1][0], "小区1");
  assert.equal(inviteCsv[1][1], "33.3%");
  assert.equal(inviteCsv[1][2], "+10%");
  assert.equal(inviteCsv[1][3], "--");
  assert.equal(inviteCsv[0].includes("组织编码"), false);
  assert.equal(inviteCsv[0].includes("指标编码"), false);
  assert.equal(inviteCsv[0].includes("分子"), false);
  assert.equal(inviteCsv[0].includes("完整性"), false);
});

test("打铁 CSV 宽表阶段状态文案与页面语义一致", () => {
  const raw = {
    sourceStates: {
      dcc: { status: "incomplete", complete: false, error: "当前失败", fieldGapReason: "当前DCC组织字段缺口" }
    },
    dccRows: [{
      dealer_code: "DCC-ONLY",
      dealer_name: "DCC专属店",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 1,
      follow_30min_denominator: 2,
      follow_24h_numerator: 1,
      follow_24h_denominator: 2,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 2
    }]
  };
  const rows = model.buildIronViewRows({ displayStores: model.buildStoreFacts(raw, []), level: "store" });
  const currentRecord = model.aggregateRows(rows, raw.sourceStates)
    .find((item) => item.metric_code === "follow_30min_rate");
  assert.equal(currentRecord.fieldGapReason, "当前DCC组织字段缺口");
  const comparisonRecord = model.attachComparisonRecords(
    [currentRecord],
    [],
    [],
    { dcc: { status: "incomplete", complete: false, error: "月失败", fieldGapReason: "月DCC字段缺口" } },
    { dcc: { status: "incomplete", complete: false, error: "周失败", fieldGapReason: "周DCC字段缺口" } }
  )[0];
  assert.equal(comparisonRecord.monthFieldGapReason, "月DCC字段缺口");
  assert.equal(comparisonRecord.weekFieldGapReason, "周DCC字段缺口");
  const csvRows = view.exportCsvRows([comparisonRecord], rows, "invite", { firstColumn: "经销商名称" });
  const header = csvRows[0];
  const csvRecord = csvRows[1];
  const metricIndex = header.indexOf("30分钟跟进率");
  assert.equal(header.length, 22);
  assert.equal(csvRows.length, 2);
  assert.equal(csvRecord[0], "DCC专属店");
  assert.equal(csvRecord[metricIndex], "数据不完整");
  assert.equal(csvRecord[metricIndex + 1], "加载失败");
  assert.equal(csvRecord[metricIndex + 2], "加载失败");
  assert.equal(header.includes("当前字段缺口原因"), false);
  assert.equal(header.includes("月同期来源状态"), false);
});

test("DCC 模型不混用下发CRM时间与日期-门店看板", () => {
  const raw = {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    sourceStates: { dcc: { status: "success", complete: true } },
    dccRows: [
      { "经销商代码": "S1", "线索编码": "CRM-IN", "下发CRM时间": "2026-07-01", "日期-门店看板": "2026-06-30", "是否24小时外呼": "是" },
      { "经销商代码": "S1", "线索编码": "CRM-OUT", "下发CRM时间": "2026-06-30", "日期-门店看板": "2026-07-01", "是否24小时外呼": "是" }
    ],
    dccThreeCallRows: [
      { "经销商代码": "S1", "线索编码": "BOARD-IN", "下发CRM时间": "2026-06-30", "日期-门店看板": "2026-07-20", "是否完成48小时三呼": "是" },
      { "经销商代码": "S1", "线索编码": "BOARD-OUT", "下发CRM时间": "2026-07-01", "日期-门店看板": "2026-07-21", "是否完成48小时三呼": "是" }
    ]
  };
  const store = model.buildStoreFacts(raw, validDealers).find((item) => item.code === "S1");
  assert.equal(model.__test.completeFact(store.ironMetrics.follow_24h_rate).numerator, 1);
  assert.equal(model.__test.completeFact(store.ironMetrics.follow_24h_rate).denominator, 1);
  assert.equal(model.__test.completeFact(store.ironMetrics.two_day_three_call_rate).numerator, 1);
  assert.equal(model.__test.completeFact(store.ironMetrics.two_day_three_call_rate).denominator, 1);
});

test("非 DCC 打铁事实严格使用无车系 process baseline 组织骨架与行序", () => {
  const baseline = [validDealers[1], validDealers[0]];
  const raw = { ...ironRaw, inviteMentionRows: [...ironRaw.inviteMentionRows, { dealer_code: "OUTSIDE", record_id: "X", ai_qc_score: 99, mg_inv_in_trial: 1 }] };
  const stores = model.buildStoreFacts(raw, baseline);
  assert.equal(JSON.stringify(stores.map((store) => store.code)), JSON.stringify(["S2", "S1"]));
  assert.ok(!stores.some((store) => store.code === "OUTSIDE"));
  assert.equal(stores[0].areaCode, baseline[0].areaCode);
});

test("DCC-only 门店进入安全并集，非 DCC 指标显示空值语义", () => {
  const raw = {
    sourceStates: ironRaw.sourceStates,
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 0, wechat_apply_mention_denominator: 2 }],
    dccRows: [{
      dealer_code: "DCC-ONLY",
      dealer_name: "DCC专属店",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 3,
      follow_30min_denominator: 4,
      follow_24h_numerator: 0,
      follow_24h_denominator: 1,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 1
    }]
  };
  const stores = model.buildStoreFacts(raw, validDealers);
  const dccOnly = stores.find((store) => store.code === "DCC-ONLY");
  assert.ok(dccOnly);
  assert.equal(dccOnly.areaCode, "DA1");
  const records = Object.fromEntries(model.aggregateRows([{ level: "store", code: dccOnly.code, name: dccOnly.name, stores: [dccOnly] }], raw.sourceStates).map((record) => [record.metric_code, record]));
  assert.equal(records.follow_30min_rate.metric_value, 0.75);
  assert.equal(model.displayValue(records.invite_trial_mention_rate), "--");
  assert.equal(model.displayValue(records.quality_trial_rate), "--");
});

test("DCC 行缺真实门店名时不使用 dealer_code 覆盖销售维表名称", () => {
  const raw = {
    sourceStates: ironRaw.sourceStates,
    dccRows: [{
      dealer_code: "S1",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 1,
      follow_30min_denominator: 2,
      follow_24h_numerator: 1,
      follow_24h_denominator: 2,
      two_day_three_call_numerator: 1,
      two_day_three_call_denominator: 2
    }]
  };
  const stores = model.buildStoreFacts(raw, validDealers);
  const store = stores.find((item) => item.code === "S1");
  assert.equal(store.ironDccOrg.dealerName, "");
  const rows = model.buildIronViewRows({ displayStores: stores, level: "store" });
  assert.equal(rows.find((row) => row.code === "S1").name, "门店1");
});

test("同一门店 DCC 与非 DCC 组织归属不一致时，门店真实 code 唯一且父级按各自分子分母重聚合", () => {
  const scopedDealers = [{ code: "S1", name: "销售维表门店名", areaCode: "A1", area: "销售大区", districtCode: "D1", district: "销售小区" }];
  const raw = {
    sourceStates: ironRaw.sourceStates,
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 0, wechat_apply_mention_denominator: 2 }],
    dccRows: [{
      dealer_code: "S1",
      dealer_name: "DCC事实门店名",
      area_code: "DA1",
      area_name: "DCC大区",
      district_code: "DD1",
      district_name: "DCC小区",
      first_follow_call_60s_numerator: 1,
      first_follow_call_60s_denominator: 2,
      follow_30min_numerator: 2,
      follow_30min_denominator: 4,
      follow_24h_numerator: 3,
      follow_24h_denominator: 6,
      two_day_three_call_numerator: 4,
      two_day_three_call_denominator: 8
    }]
  };
  const stores = model.buildStoreFacts(raw, scopedDealers);
  const salesStore = stores.find((store) => store.code === "S1");
  const dccStore = stores.find((store) => store.ironDccDealerCode === "S1");
  assert.ok(salesStore);
  assert.ok(dccStore);
  assert.equal(stores.filter((store) => store.code === "S1").length, 1);
  assert.equal(salesStore.areaCode, "A1");
  assert.equal(dccStore.areaCode, "A1");
  assert.equal(dccStore.ironDccOrg.areaCode, "DA1");
  assert.equal(dccStore.ironDccOrg.dealerCode, "S1");
  assert.equal(dccStore.ironDccOrg.dealerName, "DCC事实门店名");
  assert.equal(dccStore.ironDccDealerCode, "S1");

  const storeRows = model.buildIronViewRows({ displayStores: stores, level: "store" });
  assert.equal(storeRows.filter((row) => row.code === "S1").length, 1);
  assert.equal(storeRows[0].name, "DCC事实门店名");
  const storeRecords = Object.fromEntries(model.aggregateRows(storeRows, raw.sourceStates).map((record) => [record.metric_code, record]));
  assert.equal(storeRecords.invite_trial_mention_rate.numerator, 1);
  assert.equal(storeRecords.follow_30min_rate.numerator, 2);

  const areaRows = model.buildIronViewRows({ displayStores: stores, level: "area" });
  const records = model.aggregateRows(areaRows, raw.sourceStates);
  const byAreaMetric = Object.fromEntries(records.map((record) => [`${record.organization_code}:${record.metric_code}`, record]));
  assert.equal(byAreaMetric["A1:invite_trial_mention_rate"].numerator, 1);
  assert.equal(byAreaMetric["A1:invite_trial_mention_rate"].denominator, 2);
  assert.equal(byAreaMetric["A1:follow_30min_rate"].denominator, 0);
  assert.equal(byAreaMetric["DA1:follow_30min_rate"].numerator, 2);
  assert.equal(byAreaMetric["DA1:follow_30min_rate"].denominator, 4);
  assert.equal(byAreaMetric["DA1:follow_30min_rate"].metric_value, 0.5);
  assert.equal(byAreaMetric["DA1:invite_trial_mention_rate"].denominator, 0);

  const districtRows = model.buildIronViewRows({ displayStores: stores, level: "district", drillPath: [{ level: "area", code: "DA1", name: "DCC大区" }] });
  assert.deepEqual(JSON.parse(JSON.stringify(districtRows.map((row) => row.code))), ["DD1"]);
  const dccStoreRows = model.buildIronViewRows({ displayStores: stores, level: "store", drillPath: [{ level: "area", code: "DA1", name: "DCC大区" }, { level: "district", code: "DD1", name: "DCC小区" }] });
  assert.deepEqual(JSON.parse(JSON.stringify(dccStoreRows.map((row) => row.code))), ["S1"]);
  assert.equal(dccStoreRows[0].name, "DCC事实门店名");
  const dccAction = view.__test.actionHtml(dccStoreRows[0], {}, (_params, store) => `/detail?dealerCode=${store.code}`, { store: {} });
  assert.match(dccAction, /dealerCode=S1/);
  assert.doesNotMatch(dccAction, /dcc:/);
  const dccDrillRecords = Object.fromEntries(model.aggregateRows(dccStoreRows, raw.sourceStates).map((record) => [record.metric_code, record]));
  assert.equal(dccDrillRecords.follow_30min_rate.numerator, 2);
  assert.equal(dccDrillRecords.invite_trial_mention_rate.denominator, 0);

  const salesStoreRows = model.buildIronViewRows({ displayStores: stores, level: "store", drillPath: [{ level: "area", code: "A1", name: "销售大区" }, { level: "district", code: "D1", name: "销售小区" }] });
  assert.deepEqual(JSON.parse(JSON.stringify(salesStoreRows.map((row) => row.code))), ["S1"]);
  assert.equal(salesStoreRows[0].name, "销售维表门店名");
});
