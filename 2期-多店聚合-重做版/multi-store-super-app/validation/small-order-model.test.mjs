import assert from "node:assert/strict";
import test from "node:test";
import { config, contractFixture, model, orgRow, targetRow } from "./small-order-test-helpers.mjs";

test("固定小订期四个日期边界不读取父日期", () => {
  assert.deepEqual(model.periodInfo("2026-07-28").actualRange, null);
  assert.equal(model.periodInfo("2026-07-28").status, "小订即将开始");
  assert.equal(model.periodInfo("2026-07-28").progressText, "0.0%");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-07-29").actualRange)), { startDate: "2026-07-29", endDate: "2026-07-29" });
  assert.equal(model.periodInfo("2026-07-29").progressText, "4.0%");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-08-22").actualRange)), { startDate: "2026-07-29", endDate: "2026-08-22" });
  assert.equal(model.periodInfo("2026-08-22").status, "小订进行中");
  assert.equal(model.periodInfo("2026-08-22").progressText, "100.0%");
  assert.equal(model.periodInfo("2026-08-23").status, "小订已结束");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-08-23").actualRange)), { startDate: "2026-07-29", endDate: "2026-08-22" });
});

test("目标合同排除总计空代码后守恒 403/30001/17，MQ257T 纠正到 MQ256T", () => {
  const { rows, orgRows } = contractFixture();
  const report = model.buildSmallOrderReport({ status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: rows, organizationRows: orgRows, actualRows: [], validDealers: [], roleResult: { ok: true, role: "headquarters" } }, { viewLevel: "area", drillPath: [], expanded: false });
  assert.equal(report.audit.sourceRows, 404);
  assert.equal(report.audit.summaryRows, 1);
  assert.equal(report.audit.configuredRows, 403);
  assert.equal(report.audit.targetTotal, 30001);
  assert.equal(report.audit.zeroTargetRows, 17);
  assert.equal(report.audit.areaCount, 7);
  assert.equal(report.audit.requiredCodesPresent, true);
  assert.equal(report.audit.mq257tCorrected, true);
});

test("zero_target_actual、unconfigured_actual、organization_unmapped 异常语义固定", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 0, 1, 0), targetRow("BAD", 5, 2, 0)],
    organizationRows: [orgRow("S1"), orgRow("S2"), orgRow("S3")],
    actualRows: [{ dealer_code: "S1", actual_small_order: 1 }, { dealer_code: "S2", actual_small_order: 3 }, { dealer_code: "S3", actual_small_order: 4 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D1" }, { code: "S3", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "sales_director" }
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store", drillPath: [], expanded: true });
  assert.equal(report.summary.target, 10);
  assert.equal(report.summary.actual, 8);
  assert.equal(report.summary.achievementActual, 4);
  assert.equal(report.rows.find((row) => row.code === "S2").achievementRate, null);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "zero_target_actual" && item.canonicalCode === "S2"), true);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S3"), true);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "organization_unmapped" && item.originalCode === "BAD"), true);
});

test("非总部空授权 fail-closed，不把空 validDealers 当全量", () => {
  const raw = { status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: [targetRow("S1", 10, 0)], organizationRows: [orgRow("S1")], actualRows: [], validDealers: [], roleResult: { ok: true, role: "region" } };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district" });
  assert.equal(report.status, "no_permission");
});

test("大区权限按 validDealers areaCode 扩展到同权威组织特殊状态目标", () => {
  const raw = { status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)], organizationRows: [orgRow("S1", 0), { ...orgRow("S2", 0), open_mec_stat_name: "预留" }], actualRows: [], validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }], roleResult: { ok: true, role: "region" } };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S1", "S2"]);
});

test("大区和小区权限下 actual 先映射权威组织后裁剪，不丢失实际和未配置实际", () => {
  const baseRaw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0)],
    organizationRows: [orgRow("S1", 0), orgRow("S2", 0), orgRow("S3", 1)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "S2", actual_small_order: 3 }, { dealer_code: "S3", actual_small_order: 5 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }]
  };
  const region = model.buildSmallOrderReport({ ...baseRaw, roleResult: { ok: true, role: "region" } }, { viewLevel: "area" });
  assert.equal(region.summary.actual, 5);
  assert.equal(region.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S2"), true);
  assert.equal(region.anomalies.some((item) => item.canonicalCode === "S3"), false);
  const district = model.buildSmallOrderReport({ ...baseRaw, roleResult: { ok: true, role: "district" } }, { viewLevel: "district" });
  assert.equal(district.summary.actual, 5);
});

test("HQ 带上游组织收窄时只展示收窄范围，不按总部全量展示", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    params: { areaCode: "A1" },
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 10, 1, 0), targetRow("S4", 10, 2, 1)],
    organizationRows: [orgRow("S1", 0), orgRow("S2", 0), orgRow("S4", 1)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 1 }, { dealer_code: "S4", actual_small_order: 9 }],
    validDealers: [],
    roleResult: { ok: true, role: "headquarters" }
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 20);
  assert.equal(report.summary.actual, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code))), ["D1"]);
});

test("下钻后未配置实际按 drillPath 裁剪，不把范围外 actual-only 串入摘要", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0)],
    organizationRows: [orgRow("S1", 0), orgRow("S2", 0), orgRow("S4", 1)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "S2", actual_small_order: 3 }, { dealer_code: "S4", actual_small_order: 9 }],
    validDealers: [],
    roleResult: { ok: true, role: "headquarters" }
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district", drillPath: [{ level: "area", code: "A1", name: "RFS(MG品牌1测试区-负责人)" }] });
  assert.equal(report.summary.actual, 5);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S2" && item.periodStart === "2026-07-29"), true);
  assert.equal(report.anomalies.some((item) => item.canonicalCode === "S4"), false);
});

test("门店层多店列表显示落后门店，精确单店才显示自身状态", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 10, 1, 0)],
    organizationRows: [orgRow("S1", 0), orgRow("S2", 0)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 0 }, { dealer_code: "S2", actual_small_order: 5 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "district" }
  };
  const listReport = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(listReport.summary.scopeMode, "store_list");
  assert.equal(listReport.summary.laggingCount, 1);
  const ownReport = model.buildSmallOrderReport({ ...raw, params: { dealerCode: "S1" }, validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }], roleResult: { ok: true, role: "headquarters" } }, { viewLevel: "store" });
  assert.equal(ownReport.summary.scopeMode, "own_store");
  assert.equal(ownReport.summary.ownStatus, "落后");
});

test("valid primary 对齐开业、非二网、官网名和权威 MG 7 区口径", () => {
  const valid = { brand_name: "MG", parent_dealer_code: "S1", dealer_code: "S1", parent_dealer_shortnm: "门店S1", rfs_code: "SQR700", rfs_shortnm: "4苏皖区", open_mec_stat_name: "开业", is_scd_net_dealer: "否", web_display_name: "官网门店" };
  assert.equal(model.__test.normalizeOrg(valid).validPrimary, true);
  assert.equal(model.__test.normalizeOrg({ ...valid, open_mec_stat_name: "" }).validPrimary, false);
  assert.equal(model.__test.normalizeOrg({ ...valid, open_mec_stat_name: "未知" }).validPrimary, false);
  assert.equal(model.__test.normalizeOrg({ ...valid, web_display_name: "" }).validPrimary, false);
  assert.equal(model.__test.normalizeOrg({ ...valid, is_scd_net_dealer: "是" }).validPrimary, false);
  assert.equal(model.__test.normalizeOrg({ ...valid, rfs_code: "OTHER" }).validPrimary, false);
});
