import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = {
  setTimeout,
  clearTimeout,
  AbortController,
  window: {
    AbortController,
    __IRON_METRICS_TEST__: true,
    RegionDataApi: {
      ALL: "全部",
      __transport: {
        resolveDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-07-20" }),
        executeSqlRows: async () => [],
        allRows: async () => []
      }
    }
  }
};
vm.runInNewContext(await readFile(new URL("../iron-metrics-contract.js", import.meta.url), "utf8"), context);
vm.runInNewContext(await readFile(new URL("../iron-metrics-api.js", import.meta.url), "utf8"), context);
vm.runInNewContext(await readFile(new URL("../iron-metrics-model.js", import.meta.url), "utf8"), context);
const api = context.window.IronMetricsApi.__test;
const model = context.window.IronMetricsModel;

const productionContext = {
  setTimeout,
  clearTimeout,
  AbortController,
  window: {
    AbortController,
    RegionDataApi: {
      ALL: "全部",
      __transport: {
        resolveDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-07-20" }),
        executeSqlRows: async () => [],
        allRows: async () => []
      }
    }
  }
};
vm.runInNewContext(await readFile(new URL("../iron-metrics-contract.js", import.meta.url), "utf8"), productionContext);
vm.runInNewContext(await readFile(new URL("../iron-metrics-api.js", import.meta.url), "utf8"), productionContext);
assert.equal(Object.hasOwn(productionContext.window.IronMetricsApi, "__test"), false);

test("页面打铁导出相关脚本使用同一 cache busting 版本，发布后强制拉取新包", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const versions = [...html.matchAll(/<script src="\.\/iron-metrics-(?:contract|model|api|view)\.js\?v=([^"]+)"><\/script>/g)].map((match) => match[1]);
  assert.equal(versions.length, 4);
  assert.deepEqual([...new Set(versions)], ["20260731-iron-export-v213"]);
  assert.match(html, /<script src="\.\/data-api\.js\?v=20260727-vehicle-linkage1"><\/script>/);
  assert.match(html, /<script src="\.\/app\.js\?v=20260731-iron-export-v213"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\.\/visual-sync\.css\?v=20260806-series-filter-v244" \/>/);
  assert.match(html, /<link rel="stylesheet" href="\.\/iron-metrics\.css\?v=20260806-button-size-v234" \/>/);
});

test("SQL 聚合别名被模型消费，打铁指标不会因去除明细行变空", () => {
  const raw = {
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 1, wechat_apply_mention_denominator: 2 }],
    intentLevelRows: [{ dealer_code: "S1", high_intent_low_level_numerator: 1, high_intent_low_level_denominator: 4 }],
    dccRows: [{ dealer_code: "S1", first_follow_call_60s_numerator: 1, first_follow_call_60s_denominator: 2, follow_30min_numerator: 1, follow_30min_denominator: 4, follow_24h_numerator: 3, follow_24h_denominator: 4, two_day_three_call_numerator: 1, two_day_three_call_denominator: 5 }],
    qualityTrialRows: [{ dealer_code: "S1", "优质试驾数": 2, "常规试驾数": 5 }],
    trialRecordRows: [{ dealer_code: "S1", trial_record_numerator: 3, trial_record_denominator: 4 }],
    trialTalkRows: [
      { dealer_code: "S1", "试驾体验点": "手机互联", trial_talk_numerator: 1, trial_talk_denominator: 2 },
      { dealer_code: "S1", "试驾体验点": "全场景自动泊车-离车泊入", trial_talk_numerator: 2, trial_talk_denominator: 4 }
    ]
  };
  const states = Object.fromEntries(["inviteMention", "intentLevel", "dcc", "qualityTrial", "trialRecord", "trialTalk"].map((name) => [name, { status: "success", complete: true }]));
  const records = Object.fromEntries(model.aggregateRows(model.buildStoreFacts(raw, [{ code: "S1", name: "门店1" }]), states).map((row) => [row.metric_code, row]));
  assert.equal(records.invite_trial_mention_rate.metric_value, 0.5);
  assert.equal(records.high_intent_low_level_rate.metric_value, 0.25);
  assert.equal(records.first_follow_call_60s_rate.metric_value, 0.5);
  assert.equal(records.follow_30min_rate.metric_value, 0.25);
  assert.equal(records.follow_24h_rate.metric_value, 0.75);
  assert.equal(records.two_day_three_call_rate.metric_value, 0.2);
  assert.equal(records.quality_trial_rate.metric_value, 0.4);
  assert.equal(records.trial_record_upload_rate.metric_value, 0.75);
  assert.equal(records.phone_car_interconnect_mention_rate.metric_value, 0.5);
  assert.equal(records.remote_parking_mention_rate.metric_value, 0.5);
});

test("打铁比较记录按百分点计算月环比和周环比，比较期空分母显示中性 --", () => {
  const validDealers = [{ code: "S1", name: "门店1" }];
  const states = { inviteMention: { status: "success", complete: true } };
  const currentRaw = {
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 0, wechat_apply_mention_denominator: 0 }]
  };
  const monthRaw = {
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 0, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 0, wechat_apply_mention_denominator: 0 }]
  };
  const weekRaw = {
    inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 2, invite_trial_mention_denominator: 2, wechat_apply_mention_numerator: 0, wechat_apply_mention_denominator: 0 }]
  };
  const currentRows = model.buildStoreFacts(currentRaw, validDealers);
  const monthRows = model.buildStoreFacts(monthRaw, validDealers);
  const weekRows = model.buildStoreFacts(weekRaw, validDealers);
  const records = Object.fromEntries(model.attachComparisonRecords(
    model.aggregateRows(currentRows, states),
    model.aggregateRows(monthRows, states),
    model.aggregateRows(weekRows, states)
  ).map((row) => [row.metric_code, row]));
  assert.equal(records.invite_trial_mention_rate.monthDelta, 50);
  assert.equal(records.invite_trial_mention_rate.weekDelta, -50);
  assert.equal(records.wechat_apply_mention_rate.monthDelta, null);
  assert.equal(records.wechat_apply_mention_rate.weekDelta, null);
  assert.equal(model.displayValue(records.wechat_apply_mention_rate), "--");
});

test("打铁当前失败时两期环比都加载失败；仅比较期失败不阻塞另一比较期", () => {
  const validDealers = [{ code: "S1", name: "门店1" }];
  const currentRaw = { inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 1, invite_trial_mention_denominator: 2 }] };
  const compareRaw = { inviteMentionRows: [{ dealer_code: "S1", invite_trial_mention_numerator: 0, invite_trial_mention_denominator: 2 }] };
  const success = { inviteMention: { status: "success", complete: true } };
  const failed = { inviteMention: { status: "incomplete", complete: false, error: "boom" } };
  const currentFailed = model.attachComparisonRecords(
    model.aggregateRows(model.buildStoreFacts(currentRaw, validDealers), failed),
    model.aggregateRows(model.buildStoreFacts(compareRaw, validDealers), success),
    model.aggregateRows(model.buildStoreFacts(compareRaw, validDealers), success)
  ).find((row) => row.metric_code === "invite_trial_mention_rate");
  assert.equal(model.displayValue(currentFailed), "数据不完整");
  assert.equal(currentFailed.monthError, "加载失败");
  assert.equal(currentFailed.weekError, "加载失败");

  const oneCompareFailed = model.attachComparisonRecords(
    model.aggregateRows(model.buildStoreFacts(currentRaw, validDealers), success),
    model.aggregateRows(model.buildStoreFacts(compareRaw, validDealers), failed),
    model.aggregateRows(model.buildStoreFacts(compareRaw, validDealers), success)
  ).find((row) => row.metric_code === "invite_trial_mention_rate");
  assert.equal(model.displayValue(oneCompareFailed), "50.0%");
  assert.equal(oneCompareFailed.monthError, "加载失败");
  assert.equal(oneCompareFailed.weekDelta, 50);
});

test("DCC 182 代码型组织参数优先下推自身代码字段，常规指标与2天3呼保留独立闭区间日期字段", () => {
  const params = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "S1", vehicleSeries: ["MG 4X"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const sql = api.dccSql(params, range);
  assert.match(sql, /FROM `双品牌DCC话务指标182`/);
  assert.match(sql, /AS area_code/);
  assert.match(sql, /AS area_name/);
  assert.match(sql, /AS district_code/);
  assert.match(sql, /AS district_name/);
  assert.match(sql, /AS dealer_code/);
  assert.match(sql, /date\(`下发CRM时间`\) >= '2026-07-01'/);
  assert.match(sql, /`日期-门店看板` <= '2026-07-20'/);
  assert.match(sql, /`大区简称`.*NOT IN \('', '其它', 'MG总部'\)/);
  assert.match(sql, /`线索渠道大类名称`.*媒介投放/);
  assert.match(sql, /first_follow_call_60s_denominator/);
  assert.match(sql, /two_day_three_call_numerator/);
  assert.match(sql, /`大区代码` = 'A1'/);
  assert.match(sql, /`小区代码` = 'D1'/);
  assert.match(sql, /`经销商代码` = 'S1'/);
  assert.match(sql, /`CRM闭环车系名称` IN \('MG 4X'\)/);
  assert.doesNotMatch(sql, /原始车系名称/);
  assert.doesNotMatch(sql, /`车系名称` IN/);
  assert.doesNotMatch(sql, /`大区简称` =/);
  assert.doesNotMatch(sql, /`小区简称` =/);
  assert.doesNotMatch(sql, /`经销商简称` =/);
  assert.doesNotMatch(sql, /`经销商代码` IN/);
  assert.doesNotMatch(sql, /authorizedDealerCodes|validDealers|current_date|now\(\)|yesterday/i);
});

test("DCC 182 名称型 URL 参数与代码型参数执行同等严格的组织范围下推", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const sql = api.dccSql({
    brand: "MG",
    area: "DCC大区",
    district: "DCC小区",
    store: "DCC门店"
  }, range);
  assert.match(sql, /`大区简称` = 'DCC大区'/);
  assert.match(sql, /`小区简称` = 'DCC小区'/);
  assert.match(sql, /`经销商简称` = 'DCC门店'/);
  assert.doesNotMatch(sql, /`大区代码` =/);
  assert.doesNotMatch(sql, /`小区代码` =/);
  assert.doesNotMatch(sql, /`经销商代码` =/);
  assert.match(sql, /date\(`下发CRM时间`\) >= '2026-07-01'/);
  assert.match(sql, /`日期-门店看板` <= '2026-07-20'/);
  assert.match(sql, /`线索渠道大类名称`.*媒介投放/);
});

test("DCC 182 名称 fallback 支持 dealer/dealerShortName，全部不下推且不存在名称不会扩大范围", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  ["dealer", "dealerShortName"].forEach((field) => {
    const sql = api.dccSql({ brand: "MG", [field]: "别名门店" }, range);
    assert.match(sql, /`经销商简称` = '别名门店'/);
  });
  const nonexistentSql = api.dccSql({
    brand: "MG",
    areaCode: "全部",
    area: "不存在大区",
    district: "不存在小区",
    dealer: "不存在门店"
  }, range);
  assert.match(nonexistentSql, /`大区简称` = '不存在大区'/);
  assert.match(nonexistentSql, /`小区简称` = '不存在小区'/);
  assert.match(nonexistentSql, /`经销商简称` = '不存在门店'/);
  assert.doesNotMatch(nonexistentSql, /`经销商代码` IN/);
  const allSql = api.dccSql({ brand: "MG", area: "全部", district: "", store: "全部" }, range);
  assert.doesNotMatch(allSql, /`大区简称` =/);
  assert.doesNotMatch(allSql, /`小区简称` =/);
  assert.doesNotMatch(allSql, /`经销商简称` =/);
});

test("非 DCC 来源使用展示日期字段、审计车系字段及已确认映射的 SQL 聚合", () => {
  const params = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "S1", vehicleSeries: ["Cyberster", "MG 07", "MG5"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const sql = [api.inviteMentionSql(params, range), api.intentLevelSql(params, range), api.qualityTrialSql(params, range), api.trialRecordSql(params, range), api.trialTalkSql(params, range)].join("\n");
  assert.match(api.inviteMentionSql(params, range), /`呼叫开始日期` >= '2026-07-01'/);
  assert.match(api.intentLevelSql(params, range), /date\(`呼叫开始时间`\) >= '2026-07-01'/);
  assert.match(api.qualityTrialSql(params, range), /date\(`日期`\) >= '2026-07-01'/);
  assert.match(api.qualityTrialSql(params, range), /date\(`日期`\) <= '2026-07-20'/);
  assert.doesNotMatch(api.qualityTrialSql(params, range), /日期（日期格式）/);
  assert.match(api.trialRecordSql(params, range), /date\(`试驾接待时间`\) >= '2026-07-01'/);
  assert.match(api.trialTalkSql(params, range), /date\(`试驾接待时间`\) <= '2026-07-20'/);
  assert.match(sql, /2026-07-01/);
  assert.match(sql, /2026-07-20/);
  assert.match(api.inviteMentionSql(params, range), /`周期首次意向闭环车系名称` IN \('Cyberster', 'MG 07', 'MG5'\)/);
  assert.match(api.intentLevelSql(params, range), /`周期最近意向闭环车系` IN \('Cyberster', 'MG 07', 'MG5'\)/);
  assert.doesNotMatch(api.intentLevelSql(params, range), /周期首次意向闭环车系名称/);
  assert.match(api.qualityTrialSql(params, range), /`车系` IN \('Cyberster', 'MG Cyberster', 'MG 07', 'MG07 EV', 'MG07 DMH', 'MG5', '新一代MG5', '2023款MG5'\)/);
  assert.match(api.trialRecordSql(params, range), /`车系名称` IN \('MG Cyberster', 'MG07 EV', '新一代MG5', '2023款MG5'\)/);
  assert.match(api.trialTalkSql(params, range), /`车系名称` IN \('MG Cyberster', 'MG 07', 'MG5'\)/);
  assert.doesNotMatch(api.trialTalkSql(params, range), /AND 1 = 0/);
  assert.doesNotMatch(api.qualityTrialSql(params, range), /`品牌`/);
  assert.doesNotMatch(sql, /汇报车系名称/);
  assert.doesNotMatch(sql, /trial_recv_time/);
  assert.doesNotMatch(sql, /today|yesterday|current_date|自然周|自然月/i);
  assert.match(api.intentLevelSql(params, range), /SUM\(CASE WHEN/);
  assert.match(api.qualityTrialSql(params, range), /SUM\(COALESCE\(`优质试驾数`/);
  assert.match(api.trialRecordSql(params, range), /COUNT\(DISTINCT/);
  assert.match(api.trialTalkSql(params, range), /试驾体验点.*手机互联/);
  assert.match(api.trialTalkSql(params, range), /全场景自动泊车-离车泊入/);
});

test("MG 4X 邀约来源区分首次/最近闭环车系字段，DCC 182 仍只用 CRM 闭环字段", () => {
  const params = { brand: "MG", areaCode: "A1", districtCode: "D1", dealerCode: "S1", vehicleSeries: ["MG 4X"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  assert.match(api.inviteMentionSql(params, range), /`周期首次意向闭环车系名称` IN \('MG 4X'\)/);
  assert.match(api.intentLevelSql(params, range), /`周期最近意向闭环车系` IN \('MG 4X'\)/);
  assert.doesNotMatch(api.intentLevelSql(params, range), /周期首次意向闭环车系名称/);
  assert.match(api.qualityTrialSql(params, range), /`车系` IN \('MG 4X'\)/);
  assert.match(api.trialRecordSql(params, range), /`车系名称` IN \('MG 4X'\)/);
  assert.match(api.trialTalkSql(params, range), /`车系名称` IN \('MG 4X'\)/);
  const dccSql = api.dccSql(params, range);
  assert.match(dccSql, /`品牌名称` = 'MG'/);
  assert.match(dccSql, /`CRM闭环车系名称` IN \('MG 4X'\)/);
  assert.doesNotMatch(dccSql, /原始车系名称/);
});

test("九个销售闭集车系六来源均不 throw，且全新MG4不默认合并 MG4 EV", () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  const closedSet = ["MG5", "全新MG4", "MG7", "其他车系", "未知车系", "MG ES5", "MG 4X", "Cyberster", "MG 07"];
  const factories = [api.inviteMentionSql, api.intentLevelSql, api.qualityTrialSql, api.trialRecordSql, api.trialTalkSql, api.dccSql];
  closedSet.forEach((vehicleSeries) => {
    factories.forEach((factory) => assert.doesNotThrow(() => factory({ brand: "MG", vehicleSeries: [vehicleSeries] }, range)));
  });
  const sql = [
    api.inviteMentionSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range),
    api.intentLevelSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range),
    api.qualityTrialSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range),
    api.trialRecordSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range),
    api.trialTalkSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range),
    api.dccSql({ brand: "MG", vehicleSeries: ["全新MG4"] }, range)
  ].join("\n");
  assert.match(sql, /全新MG4/);
  assert.doesNotMatch(sql, /MG4 EV/);
});

test("未知车系只匹配原始未知，真实空样本返回成功空值而非 incomplete", async () => {
  const params = { brand: "MG", vehicleSeries: ["未知车系"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  [
    api.inviteMentionSql(params, range),
    api.intentLevelSql(params, range),
    api.qualityTrialSql(params, range),
    api.trialRecordSql(params, range),
    api.trialTalkSql(params, range),
    api.dccSql(params, range)
  ].forEach((sql) => {
    assert.match(sql, /IN \('未知'\)/);
    assert.doesNotMatch(sql, /数据不完整|1 = 0/);
  });
  context.window.RegionDataApi.__transport.executeSqlRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(params, [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]);
  ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk", "dcc"].forEach((name) => {
    assert.equal(raw.sourceStates[name].status, "success");
    assert.equal(raw.sourceStates[name].rowCount, 0);
  });
});

test("其他车系优先精确值，录音/话术按 MG 品牌补集 NOT IN 且不会查询全部", () => {
  const params = { brand: "MG", vehicleSeries: ["其他车系"] };
  const mixedParams = { brand: "MG", vehicleSeries: ["MG 4X", "其他车系"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  [
    api.inviteMentionSql(params, range),
    api.intentLevelSql(params, range),
    api.qualityTrialSql(params, range),
    api.dccSql(params, range)
  ].forEach((sql) => {
    assert.match(sql, /IN \('其他车系'\)/);
    assert.doesNotMatch(sql, /NOT IN \('(?:MG|全新MG4)/);
  });
  assert.doesNotMatch(api.qualityTrialSql(params, range), /`品牌名称` = 'MG'/);
  assert.match(api.dccSql(params, range), /`品牌名称` = 'MG'/);
  [api.trialRecordSql(params, range), api.trialTalkSql(params, range)].forEach((sql) => {
    assert.match(sql, /`品牌名称` = 'MG'/);
    assert.match(sql, /`车系名称` NOT IN/);
    assert.doesNotMatch(sql, /`车系名称` IN \('其他车系'\)/);
    assert.match(sql, /全新MG4/);
    assert.match(sql, /MG 4X/);
    assert.match(sql, /MG Cyberster/);
    assert.doesNotMatch(sql, /荣威|飞凡/);
    assert.doesNotMatch(sql, /WHERE `品牌名称` = 'MG' AND `大区代码`/);
  });
  const mixedSql = api.trialRecordSql(mixedParams, range);
  assert.match(mixedSql, /`车系名称` IN \('MG 4X'\) OR \(`品牌名称` = 'MG' AND/);
  assert.doesNotMatch(mixedSql, /`车系名称` IN \('MG 4X'\) AND \(`品牌名称` = 'MG' AND/s);
});

test("话术来源 MG5 与 MG 07 使用真实精确条件，空样本仍是成功空值", async () => {
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  ["MG5", "MG 07"].forEach((vehicleSeries) => {
    const sql = api.trialTalkSql({ brand: "MG", vehicleSeries: [vehicleSeries] }, range);
    assert.match(sql, new RegExp("`车系名称` IN \\('" + vehicleSeries.replace(" ", "\\s+") + "'\\)"));
    assert.doesNotMatch(sql, /AND 1 = 0/);
  });
  context.window.RegionDataApi.__transport.executeSqlRows = async () => [];
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG", vehicleSeries: ["MG5", "MG 07"] },
    [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]
  );
  assert.equal(raw.sourceStates.trialTalk.status, "success");
  assert.equal(raw.sourceStates.trialTalk.rowCount, 0);
});

test("非 DCC 来源按有效门店交集单批 SQL 聚合，DCC 使用自身 scope 且不 preview", async () => {
  const calls = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query) => {
    calls.push({ type: "sql", dsId, query });
    return [{ dealer_code: "S1", record_id: `${dsId}-${calls.length}`, ai_qc_score: 90 }];
  };
  context.window.RegionDataApi.__transport.allRows = async (dsId, filters) => {
    calls.push({ type: "preview", dsId, filters });
    return [{ "经销商代码": filters.find((item) => item.field === "经销商代码")?.value || "" }];
  };
  await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG", area: "大区1", district: "小区1" },
    [
      { code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" },
      { code: "S2", name: "门店2", areaCode: "A1", districtCode: "D1" },
      { code: "S3", name: "门店3", areaCode: "A1", districtCode: "D1" }
    ]
  );
  const sqlCalls = calls.filter((call) => call.type === "sql");
  const previewCalls = calls.filter((call) => call.type === "preview");
  assert.equal(sqlCalls.length, 6);
  assert.equal(previewCalls.length, 0);
  const dccCall = sqlCalls.find((call) => call.dsId === context.window.IronMetricsContract.DS.dcc);
  const nonDccCalls = sqlCalls.filter((call) => call.dsId !== context.window.IronMetricsContract.DS.dcc);
  assert.ok(nonDccCalls.every((call) => /`经销商代码` IN \('S1', 'S2', 'S3'\)/.test(call.query)));
  assert.ok(dccCall);
  assert.doesNotMatch(dccCall.query, /`经销商代码` IN \('S1', 'S2', 'S3'\)/);
  assert.deepEqual(new Set(sqlCalls.map((call) => call.dsId)), new Set([
    context.window.IronMetricsContract.DS.inviteMention,
    context.window.IronMetricsContract.DS.intentLevel,
    context.window.IronMetricsContract.DS.qualityTrial,
    context.window.IronMetricsContract.DS.trialRecord,
    context.window.IronMetricsContract.DS.trialTalk,
    context.window.IronMetricsContract.DS.dcc
  ]));
});

test("单个SQL分片触顶时对应来源fail-closed为数据不完整", async () => {
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query, limit, options) => {
    if (options?.failOnLimit && query.includes("'S2'")) throw new Error(`SQL 聚合结果达到安全上限 ${limit} 行，完整性不可证`);
    return [];
  };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG" },
    [
      { code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" },
      { code: "S2", name: "门店2", areaCode: "A1", districtCode: "D1" }
    ]
  );
  assert.equal(raw.sourceStates.inviteMention.status, "incomplete");
  assert.equal(raw.sourceStates.intentLevel.status, "incomplete");
  assert.equal(raw.sourceStates.qualityTrial.status, "incomplete");
  assert.equal(raw.sourceStates.trialRecord.status, "incomplete");
  assert.equal(raw.sourceStates.trialTalk.status, "incomplete");
});

test("单个慢来源超时降级，不阻塞已完成的试驾指标来源", async () => {
  const settled = [];
  const abortSignals = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query, limit, options) => {
    if (dsId === context.window.IronMetricsContract.DS.dcc) {
      abortSignals.push(options?.signal);
      return new Promise((resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    }
    if (dsId === context.window.IronMetricsContract.DS.qualityTrial) {
      return [{ dealer_code: "S1", "优质试驾数": 1, "常规试驾数": 2 }];
    }
    if (dsId === context.window.IronMetricsContract.DS.trialRecord) {
      return [{ dealer_code: "S1", "试驾接待编码(PK)": "TRIAL-1", "是否有录音": "Y" }];
    }
    if (dsId === context.window.IronMetricsContract.DS.trialTalk) {
      return [{ dealer_code: "S1", "试驾清单ID": "TALK-1", "试驾体验点": "手机互联", "是否提及": "是" }];
    }
    return [];
  };

  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG" },
    [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }],
    {
      sourceTimeoutMs: 20,
      onSourceSettled: (name, partialRaw) => settled.push({ name, state: partialRaw.sourceStates[name] })
    }
  );

  assert.equal(raw.sourceStates.dcc.status, "incomplete");
  assert.match(raw.sourceStates.dcc.error, /查询超过 20ms/);
  assert.equal(raw.sourceStates.qualityTrial.status, "success");
  assert.equal(raw.sourceStates.trialRecord.status, "success");
  assert.equal(raw.sourceStates.trialTalk.status, "success");
  assert.equal(raw.trialRecordRows.length, 1);
  assert.equal(raw.trialTalkRows.length, 1);
  assert.ok(settled.some((item) => item.name === "trialTalk" && item.state.status === "success"));
  assert.ok(settled.some((item) => item.name === "dcc" && item.state.status === "incomplete"));
  assert.ok(abortSignals.length >= 1);
  assert.ok(abortSignals.every((signal) => signal?.aborted === true));
});

test("未知非销售闭集车系值 fail-closed，不扩大为全部车系 SQL", async () => {
  const params = { brand: "MG", dealerCode: "S1", vehicleSeries: ["MG4 EV"] };
  const range = { startDate: "2026-07-01", endDate: "2026-07-20" };
  assert.throws(() => api.intentLevelSql(params, range), /车系映射未审计.*MG4 EV/);
  let sqlCount = 0;
  context.window.RegionDataApi.__transport.executeSqlRows = async () => { sqlCount += 1; return []; };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(params, [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]);
  assert.equal(sqlCount, 0);
  ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk"].forEach((name) => {
    assert.equal(raw.sourceStates[name].status, "incomplete");
    assert.match(raw.sourceStates[name].error, /车系映射未审计/);
    assert.match(raw.sourceStates[name].fieldGapReason, /车系映射未审计/);
  });
  assert.equal(raw.sourceStates.dcc.status, "incomplete");
});

test("指定白名单外门店时非 DCC 零 SQL，DCC 仍按自身门店字段查询", async () => {
  let sqlCount = 0;
  const queries = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query) => { sqlCount += 1; queries.push({ dsId, query }); return []; };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG", dealerCode: "S2" },
    [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]
  );
  assert.equal(sqlCount, 1);
  assert.equal(queries[0].dsId, context.window.IronMetricsContract.DS.dcc);
  assert.match(queries[0].query, /`经销商代码` = 'S2'/);
  ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk"].forEach((name) => {
    assert.equal(raw.sourceStates[name].status, "empty");
    assert.equal(raw.sourceStates[name].completeEvidence, "empty-valid-dealer-scope");
  });
  assert.equal(raw.sourceStates.dcc.status, "success");
  assert.equal(raw.sourceStates.dcc.organizationEvidence, "dcc-own-organization-fields");
});

test("优质试驾在非 MG 品牌 fail-closed 且不发该来源 SQL", async () => {
  const sqlCalls = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId) => { sqlCalls.push(dsId); return []; };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "荣威" },
    [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]
  );
  assert.equal(sqlCalls.includes(context.window.IronMetricsContract.DS.qualityTrial), false);
  assert.equal(raw.sourceStates.qualityTrial.status, "incomplete");
  assert.match(raw.sourceStates.qualityTrial.fieldGapReason, /无品牌字段/);
});

test("非 DCC SQL 成功状态附带聚合、日期、车系与组织交集证据", async () => {
  context.window.RegionDataApi.__transport.executeSqlRows = async () => [];
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG" },
    [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]
  );
  const expected = {
    inviteMention: ["呼叫开始日期", "周期首次意向闭环车系名称"],
    intentLevel: ["呼叫开始时间", "周期最近意向闭环车系"],
    qualityTrial: ["日期", "车系"],
    trialRecord: ["试驾接待时间", "车系名称"],
    trialTalk: ["试驾接待时间", "车系名称"]
  };
  Object.entries(expected).forEach(([name, [dateField, vehicleSeriesField]]) => {
    const state = raw.sourceStates[name];
    assert.equal(state.status, "success");
    assert.equal(state.rowCount, 0);
    assert.equal(state.queryMode, "sql_aggregate");
    assert.equal(state.dateField, dateField);
    assert.equal(state.vehicleSeriesField, vehicleSeriesField);
    assert.equal(state.organizationEvidence, "valid-dealer-code-intersection");
    assert.equal(state.authorizedDealerCount, 1);
    assert.deepEqual(Array.from(state.shards[0].dealerCodes), ["S1"]);
  });
  assert.equal(raw.sourceStates.dcc.vehicleSeriesField, "CRM闭环车系名称");
  assert.equal(raw.sourceStates.dcc.tableName, "双品牌DCC话务指标182");
  const records = model.aggregateRows(model.buildStoreFacts(raw, [{ code: "S1", name: "门店1" }]), raw.sourceStates);
  assert.ok(records.filter((record) => record.metric_code === "quality_trial_rate" || record.metric_code === "trial_record_upload_rate" || record.metric_code === "phone_car_interconnect_mention_rate" || record.metric_code === "remote_parking_mention_rate").every((record) => model.displayValue(record) === "--"));
});

test("非 DCC SQL 成功返回时附带运行态匹配计数，且保留正常空样本语义", async () => {
  const rowsBySource = new Map([
    [context.window.IronMetricsContract.DS.inviteMention, [{ dealer_code: "S1", invite_trial_mention_denominator: 2, invite_trial_mention_numerator: 1 }]],
    [context.window.IronMetricsContract.DS.intentLevel, [{ dealer_code: "S1", high_intent_low_level_denominator: 2, high_intent_low_level_numerator: 1 }]],
    [context.window.IronMetricsContract.DS.qualityTrial, [{ dealer_code: "S1", "常规试驾数": 2, "优质试驾数": 1 }]],
    [context.window.IronMetricsContract.DS.trialRecord, [{ dealer_code: "S1", trial_record_denominator: 2, trial_record_numerator: 1 }]],
    [context.window.IronMetricsContract.DS.trialTalk, [{ dealer_code: "S1", trial_talk_denominator: 2, trial_talk_numerator: 1, "试驾体验点": "手机互联" }]]
  ]);
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId) => rowsBySource.get(dsId) || [];
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw(
    { brand: "MG" },
    [
      { code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" },
      { code: "S2", name: "门店2", areaCode: "A1", districtCode: "D1" }
    ]
  );
  ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk"].forEach((name) => {
    const state = raw.sourceStates[name];
    assert.equal(state.status, "success");
    assert.equal(state.rowCount, 1);
    assert.equal(state.authorizedDealerCount, 2);
    assert.equal(state.sqlAggregateRowCount, 1);
    assert.equal(state.nonZeroDenominatorRowCount, 1);
    assert.equal(state.returnedDealerCodeCount, 1);
    assert.equal(state.validDealerIntersectionCount, 1);
  });
});

test("非 DCC SQL 返回行却与有效白名单零匹配时 fail-closed，不静默显示 --", async () => {
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId) => {
    const rows = {
      [context.window.IronMetricsContract.DS.inviteMention]: [{ dealer_code: "OUTSIDE", invite_trial_mention_denominator: 2 }],
      [context.window.IronMetricsContract.DS.intentLevel]: [{ dealer_code: "OUTSIDE", high_intent_low_level_denominator: 2 }],
      [context.window.IronMetricsContract.DS.qualityTrial]: [{ dealer_code: "OUTSIDE", "常规试驾数": 2 }],
      [context.window.IronMetricsContract.DS.trialRecord]: [{ dealer_code: "OUTSIDE", trial_record_denominator: 2 }],
      [context.window.IronMetricsContract.DS.trialTalk]: [{ dealer_code: "OUTSIDE", trial_talk_denominator: 2, "试驾体验点": "手机互联" }]
    };
    return rows[dsId] || [];
  };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const validDealers = [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw({ brand: "MG" }, validDealers);
  ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk"].forEach((name) => {
    const state = raw.sourceStates[name];
    assert.equal(state.status, "incomplete");
    assert.equal(state.rowCount, 1);
    assert.equal(state.sqlAggregateRowCount, 1);
    assert.equal(state.nonZeroDenominatorRowCount, 1);
    assert.equal(state.returnedDealerCodeCount, 1);
    assert.equal(state.validDealerIntersectionCount, 0);
    assert.match(state.fieldGapReason, /有效白名单无交集/);
  });
  const records = model.aggregateRows(model.buildStoreFacts(raw, validDealers), raw.sourceStates);
  assert.ok(records.filter((record) => record.source_status === "incomplete").every((record) => model.displayValue(record) === "数据不完整"));
});

test("空有效经销商范围只阻止非 DCC 查询，DCC 仍按 DCC 行级权限查询", async () => {
  let queryCount = 0;
  context.window.RegionDataApi.__transport.executeSqlRows = async () => { queryCount += 1; return [{ dealer_code: "DCC1", area_code: "A9", area_name: "DCC大区", district_code: "D9", district_name: "DCC小区", first_follow_call_60s_denominator: 1 }]; };
  context.window.RegionDataApi.__transport.allRows = async () => { queryCount += 1; return [{ "经销商代码": "OUTSIDE" }]; };
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw({ brand: "MG", area: "不存在大区", district: "不存在小区", store: "不存在门店" }, []);
  assert.equal(queryCount, 1);
  assert.equal(raw.inviteMentionRows.length, 0);
  assert.equal(raw.dccRows.length, 1);
  assert.equal(raw.trialTalkRows.length, 0);
  assert.equal(raw.sourceStates.inviteMention.status, "empty");
  assert.equal(raw.sourceStates.dcc.status, "success");
  assert.equal(raw.sourceStates.dcc.completeEvidence, "dcc-scope-sql-aggregate");
  assert.ok(["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk"].every((name) => raw.sourceStates[name].status === "empty"));
});

test("角色解析后无非 DCC 授权门店时仍只发 DCC 查询", async () => {
  const calls = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query) => { calls.push({ dsId, query }); return []; };
  context.window.RegionDataApi.__transport.allRows = async (dsId, filters) => { calls.push({ dsId, filters }); return []; };
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw({ brand: "MG" }, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].dsId, context.window.IronMetricsContract.DS.dcc);
  assert.equal(raw.sourceStates.qualityTrial.sourceType, "AUTHORIZED_SCOPE");
  assert.equal(raw.sourceStates.dcc.organizationEvidence, "dcc-own-organization-fields");
});

test("DCC SQL 失败时 fail-closed 为数据不完整，不回退到 validDealers 或旧缓存", async () => {
  const calls = [];
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId, query) => {
    calls.push({ dsId, query });
    if (dsId === context.window.IronMetricsContract.DS.dcc) throw new Error("DCC SQL 字段缺失");
    return [];
  };
  context.window.RegionDataApi.__transport.allRows = async () => {
    throw new Error("不应调用 preview fallback");
  };
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw({ brand: "MG" }, [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]);
  assert.equal(calls.filter((call) => call.dsId === context.window.IronMetricsContract.DS.dcc).length, 1);
  assert.equal(raw.dccRows.length, 0);
  assert.equal(raw.sourceStates.dcc.status, "incomplete");
  assert.equal(raw.sourceStates.dcc.complete, false);
  assert.match(raw.sourceStates.dcc.error, /DCC SQL 字段缺失/);
});

test("DCC SQL 有返回行但缺自身组织字段时 sourceState incomplete 并保留 fieldGapReason", async () => {
  context.window.RegionDataApi.__transport.executeSqlRows = async (dsId) => {
    if (dsId === context.window.IronMetricsContract.DS.dcc) {
      return [{ dealer_code: "S1", area_code: "A1", area_name: "大区1", follow_30min_denominator: 1 }];
    }
    return [];
  };
  context.window.RegionDataApi.__transport.allRows = async () => [];
  const raw = await context.window.IronMetricsApi.loadIronMetricsRaw({ brand: "MG" }, [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]);
  assert.equal(raw.sourceStates.dcc.status, "incomplete");
  assert.equal(raw.sourceStates.dcc.complete, false);
  assert.match(raw.sourceStates.dcc.fieldGapReason, /缺少 dealer_code/);
  assert.equal(raw.sourceStates.dcc.rowCount, 1);
  assert.equal(raw.sourceStates.dcc.organizationEvidence, "dcc-own-organization-fields");
});
