import assert from "node:assert/strict";
import test from "node:test";
import { config, contractFixture, model, orgRow, targetRow } from "./small-order-test-helpers.mjs";

function assertNoNationalAuditAliases(audit) {
  ["configuredRows", "canonicalUniqueCodes", "targetTotal"].forEach((key) => {
    assert.equal(Object.hasOwn(audit || {}, key), false, key);
  });
}

function validDealersFromOrgRows(rows) {
  return (rows || []).map((row) => ({
    code: row.parent_dealer_code,
    name: row.parent_dealer_shortnm,
    areaCode: row.rfs_code,
    area: row.rfs_name,
    districtCode: row.mac_code,
    district: row.mac_name
  }));
}

function assertUnassignedAuditRow(row, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(row)), {
    canonicalCode: "",
    summaryIncluded: true,
    drilldownAttributionStatus: "unassigned",
    handling: "source_in_summary_unassigned_to_drilldown",
    ...expected
  });
}

test("固定小订期四个日期边界不读取父日期", () => {
  assert.deepEqual(model.periodInfo("2026-07-28").actualRange, null);
  assert.deepEqual(model.periodInfo("2026-07-28").todayRange, null);
  assert.equal(model.periodInfo("2026-07-28").status, "小订即将开始");
  assert.equal(model.periodInfo("2026-07-28").progressText, "0.0%");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-07-29").actualRange)), { startDate: "2026-07-29", endDate: "2026-07-29" });
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-07-29").todayRange)), { startDate: "2026-07-29", endDate: "2026-07-29" });
  assert.equal(model.periodInfo("2026-07-29").progressText, "4.0%");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-08-22").actualRange)), { startDate: "2026-07-29", endDate: "2026-08-22" });
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-08-22").todayRange)), { startDate: "2026-08-22", endDate: "2026-08-22" });
  assert.equal(model.periodInfo("2026-08-22").status, "小订进行中");
  assert.equal(model.periodInfo("2026-08-22").progressText, "100.0%");
  assert.equal(model.periodInfo("2026-08-23").status, "小订已结束");
  assert.deepEqual(JSON.parse(JSON.stringify(model.periodInfo("2026-08-23").actualRange)), { startDate: "2026-07-29", endDate: "2026-08-22" });
  assert.deepEqual(model.periodInfo("2026-08-23").todayRange, null);
});

test("目标合同排除总计空代码后守恒 403/30001/17，MQ257T 纠正到 MQ256T", () => {
  const { rows, orgRows } = contractFixture();
  const report = model.buildSmallOrderReport({ status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: rows, organizationRows: orgRows, actualRows: [], validDealers: [], roleResult: { ok: true, role: "headquarters" }, nationalComplete: true, adminAuditTargets: true }, { viewLevel: "area", drillPath: [], expanded: false });
  assert.equal(report.audit.sourceRows, 404);
  assert.equal(report.audit.summaryRows, 1);
  assert.equal(report.audit.configuredRows, 403);
  assert.equal(report.audit.targetTotal, 30001);
  assert.equal(report.audit.zeroTargetRows, 17);
  assert.equal(report.audit.areaCount, 7);
  assert.equal(report.audit.requiredCodesPresent, true);
  assert.equal(report.audit.mq257tCorrected, true);
});

test("v2.02 全国 summary 按目标源行保持 30001，未归属 287 不再扣成 29714", () => {
  const { rows, orgRows } = contractFixture();
  const missCodes = new Set(["MQ207J", "MQ256T", "MQ576H", "MQ576K", "MQ877K", "MQ9331", "SQ2547", "SQ2881"]);
  const mappedOrgRows = orgRows.filter((row) => !missCodes.has(row.parent_dealer_code));
  const validDealers = validDealersFromOrgRows(mappedOrgRows);
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: rows,
    organizationRows: mappedOrgRows,
    actualRows: [],
    validDealers,
    enforceTargetContract: true
  }, { viewLevel: "area" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 30001);
  assert.equal(report.summary.achievementRate, 0);
  assert.equal(report.audit.sourceTargetTotal, 30001);
  assert.equal(report.audit.assignedTargetTotal, 29714);
  assert.equal(report.audit.unassignedTargetTotal, 287);
  assert.equal(report.audit.unassignedRows.length, 8);
  assertUnassignedAuditRow(report.audit.unassignedRows.find((row) => row.originalCode === "MQ207J"), {
    originalCode: "MQ207J",
    dealerName: "门店MQ207J",
    target: 104,
    reason: "目标门店无法匹配权威门店"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(report.warnings)), []);
});

test("zero_target_actual、unconfigured_actual、organization_unmapped 异常语义固定", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 0, 1, 0), targetRow("BAD", 5, 2, 0)],
    organizationRows: [orgRow("S1"), orgRow("S2"), orgRow("S3")],
    actualRows: [
      { dealer_code: "S1", actual_small_order: 1, retained_small_order: 1 },
      { dealer_code: "S2", actual_small_order: 3, retained_small_order: 3 },
      { dealer_code: "S3", actual_small_order: 4, retained_small_order: 4 }
    ],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D1" }, { code: "S3", areaCode: "A1", districtCode: "D1" }, { code: "BAD", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "sales_director" }
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store", drillPath: [], expanded: true });
  assert.equal(report.summary.target, 15);
  assert.equal(report.summary.actual, 8);
  assert.equal(report.summary.achievementActual, 8);
  assert.equal(report.rows.find((row) => row.code === "S2").achievementRate, null);
  assert.equal(report.rows.find((row) => row.code === "S3").targetConfigured, false);
  assert.equal(report.rows.find((row) => row.code === "S3").status, "未设目标");
  assert.equal(report.rows.find((row) => row.code === "S3").gapToExpected, null);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "zero_target_actual" && item.canonicalCode === "S2"), true);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S3"), true);
  assert.equal(report.anomalies.some((item) => item.anomalyType === "organization_unmapped" && item.originalCode === "BAD"), true);
});

test("非总部空授权 fail-closed，不把空 S 当全量", () => {
  const raw = { status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: [targetRow("S1", 10, 0)], organizationRows: [], actualRows: [], validDealers: [], roleResult: { ok: true, role: "region" } };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district" });
  assert.equal(report.status, "no_permission");
});

test("v2.02 运行时不依赖角色或 nationalComplete 重建小订权限", () => {
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: false, role: "unknown" },
    nationalComplete: false,
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 10);
  assertNoNationalAuditAliases(report.audit);
});

test("v2.02 空 validDealers 不回退 HQ、nationalComplete、organizationRows 或全国合同", () => {
  const runtime = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [],
    roleResult: { ok: true, role: "headquarters" },
    nationalComplete: true,
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(runtime.status, "no_permission");
  assert.equal(runtime.error, "小订顶部范围为空");

  const scoped = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(scoped.status, "ready");
  assert.equal(scoped.audit.scopeSourceRows, 2);
  assert.equal(scoped.audit.scopeTargetTotal, 10);
  assert.equal(scoped.audit.sourceTargetTotal, 30);
  assert.equal(scoped.summary.target, 30);
  assertNoNationalAuditAliases(scoped.audit);
});

test("大区权限按 validDealers areaCode 扩展到同权威组织特殊状态目标", () => {
  const raw = { status: "ready", config, period: model.periodInfo("2026-08-23"), targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)], organizationRows: [orgRow("S1", 0), { ...orgRow("S2", 0), open_mec_stat_name: "预留" }], actualRows: [], validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D1" }], roleResult: { ok: true, role: "region" } };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S1", "S2"]);
});

test("授权收窄后旧 organizationRows 不得与 current validDealers 并集扩权", () => {
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 0)],
    organizationRows: [orgRow("S1", 0), orgRow("S2", 0)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "S2", actual_small_order: 8 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 30);
  assert.equal(report.summary.actual, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code))), ["S1"]);
  assert.equal(report.anomalies.some((item) => item.canonicalCode === "S2" || item.originalCode === "S2"), false);
});

function scopedFixture(areaIndex = 0) {
  const fixture = contractFixture();
  const orgRows = fixture.orgRows.filter((row) => row.rfs_code === ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"][areaIndex]);
  const areaNames = new Set(orgRows.map((row) => row.rfs_name));
  const rows = fixture.rows.filter((row) => !row.一级经销商 || areaNames.has(row.区域));
  const validDealers = validDealersFromOrgRows(orgRows);
  return { ...fixture, rows, orgRows, validDealers };
}

test("v2.02 scoped contract 先按目标 DS RLS 源行范围汇总，不被全国 403/30001/7 误伤", () => {
  const { rows, orgRows, validDealers } = scopedFixture(0);
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: rows,
    organizationRows: orgRows,
    actualRows: [],
    validDealers,
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.contractOk, true);
  assert.equal(report.audit.scopeUnmapped, 0);
  assert.equal(report.audit.scopeSourceRows, orgRows.length);
  assert.equal(report.audit.scopeMappedRows, orgRows.length);
  assert.equal(report.audit.scopeUniqueDealerCount, orgRows.length);
  assert.equal(report.audit.scopeSourceTargetTotal, report.audit.scopeMappedTargetTotal);
  assert.equal(report.audit.assignedTargetTotal, report.audit.scopeTargetTotal);
  assert.notEqual(report.audit.scopeTargetTotal, 30001);
  assertNoNationalAuditAliases(report.audit);
  assert.equal(report.rows.every((row) => row.stores.every((store) => store.areaCode === "SMG310")), true);
});

test("district 和 store scoped contract 使用当前权限目标守恒", () => {
  const { rows, orgRows } = scopedFixture(1);
  const districtDealers = orgRows.slice(0, 3).map((row) => ({ code: row.parent_dealer_code, areaCode: row.rfs_code, districtCode: row.mac_code }));
  const district = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: rows,
    organizationRows: orgRows.slice(0, 3),
    actualRows: [],
    validDealers: districtDealers,
    roleResult: { ok: true, role: "district" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(district.status, "ready");
  assert.equal(district.audit.scopeMappedRows, 3);
  assert.equal(district.audit.assignedTargetTotal, district.audit.scopeTargetTotal);
  assert.equal(district.audit.sourceTargetTotal, district.summary.target);

  const storeDealer = districtDealers[0];
  const store = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: rows,
    organizationRows: orgRows.slice(0, 1),
    actualRows: [],
    validDealers: [storeDealer],
    roleResult: { ok: true, role: "sales_director" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(store.status, "ready");
  assert.equal(store.audit.scopeMappedRows, 1);
  assert.equal(store.audit.scopeUniqueDealerCount, 1);
  assert.equal(store.rows.length, 1);
});

test("scope 外未映射目标不报错、不可见、不可进入 anomaly", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { dealerCode: "S1" },
    targetRows: [targetRow("S1", 10, 0), targetRow("OUTSIDE_BAD", 20, 2)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 10);
  assert.equal(report.audit.scopeSourceRows, 1);
  assert.equal(report.anomalies.some((item) => item.originalCode === "OUTSIDE_BAD"), false);
});

test("v2.02 上游小区 params 按目标源 MAC 匹配 summary", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { district: "小区1" },
    targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)],
    organizationRows: [orgRow("S1", 0), { ...orgRow("S2", 0), mac_code: "D2", mac_name: "MAC(MG品牌1测试区-小区2)", mac_shortnm: "小区2" }],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D2" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeSourceRows, 1);
  assert.equal(report.audit.sourceTargetTotal, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S1"]);
});

test("v2.02 areaCode-only params 通过授权证据匹配目标源区域且不扩到范围外", () => {
  const baseRaw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("UNMAPPED_AREA", 20, 1, 0), targetRow("OUT_AREA", 30, 2, 1)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", name: "门店S1", areaCode: "A1", area: "RFS(MG品牌1测试区-负责人)", districtCode: "D1", district: "小区1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const byCode = model.buildSmallOrderReport({ ...baseRaw, params: { areaCode: "A1" } }, { viewLevel: "store" });
  const byName = model.buildSmallOrderReport({ ...baseRaw, params: { area: "RFS(MG品牌1测试区-负责人)" } }, { viewLevel: "store" });
  [byCode, byName].forEach((report) => {
    assert.equal(report.status, "ready");
    assert.equal(report.summary.target, 30);
    assert.equal(report.audit.scopeSourceRows, 2);
    assert.equal(report.audit.sourceTargetTotal, 30);
    assert.equal(report.audit.assignedTargetTotal, 10);
    assert.equal(report.audit.unassignedTargetTotal, 20);
    assertUnassignedAuditRow(report.audit.unassignedRows[0], {
      originalCode: "UNMAPPED_AREA",
      dealerName: "门店UNMAPPED_AREA",
      target: 20,
      reason: "目标门店无法匹配权威门店"
    });
    assert.deepEqual(JSON.parse(JSON.stringify(report.warnings)), []);
    assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S1"]);
    assert.equal(report.anomalies.some((item) => item.originalCode === "UNMAPPED_AREA" && item.anomalyType === "organization_unmapped"), true);
    assert.equal(report.anomalies.some((item) => item.originalCode === "OUT_AREA"), false);
  });
});

test("v2.02 districtCode-only params 通过授权证据匹配目标源 MAC 且不扩到范围外", () => {
  const baseRaw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("UNMAPPED_DISTRICT", 20, 1, 0), targetRow("OUT_DISTRICT", 30, 2, 1)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", name: "门店S1", areaCode: "A1", area: "RFS(MG品牌1测试区-负责人)", districtCode: "D1", district: "小区1" }],
    roleResult: { ok: true, role: "district" },
    enforceTargetContract: true
  };
  const byCode = model.buildSmallOrderReport({ ...baseRaw, params: { districtCode: "D1" } }, { viewLevel: "store" });
  const byName = model.buildSmallOrderReport({ ...baseRaw, params: { district: "小区1" } }, { viewLevel: "store" });
  [byCode, byName].forEach((report) => {
    assert.equal(report.status, "ready");
    assert.equal(report.summary.target, 30);
    assert.equal(report.audit.scopeSourceRows, 2);
    assert.equal(report.audit.sourceTargetTotal, 30);
    assert.equal(report.audit.assignedTargetTotal, 10);
    assert.equal(report.audit.unassignedTargetTotal, 20);
    assert.deepEqual(JSON.parse(JSON.stringify(report.warnings)), []);
    assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S1"]);
    assert.equal(report.anomalies.some((item) => item.originalCode === "UNMAPPED_DISTRICT" && item.anomalyType === "organization_unmapped"), true);
    assert.equal(report.anomalies.some((item) => item.originalCode === "OUT_DISTRICT"), false);
  });
});

test("v2.02 上游门店 params 按目标源一级经销商匹配 summary", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { dealerCode: "S2" },
    targetRows: [targetRow("S1", 10, 0), targetRow("S2", 20, 1)],
    organizationRows: [orgRow("S1", 0), { ...orgRow("S2", 0), mac_code: "D2", mac_name: "MAC(MG品牌1测试区-小区2)", mac_shortnm: "小区2" }],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "S2", areaCode: "A1", districtCode: "D2" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeSourceRows, 1);
  assert.equal(report.audit.sourceTargetTotal, 20);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S2"]);
});

test("scope 内缺组织映射隔离目标并仅内部审计，不阻断其余目标", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0), targetRow("MISSING_IN_SCOPE", 20, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }, { code: "MISSING_IN_SCOPE", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeUnmapped, 1);
  assert.equal(report.audit.scopeUnmappedTargetTotal, 20);
  assert.deepEqual(JSON.parse(JSON.stringify(report.warnings)), []);
  assert.equal(report.summary.target, 30);
  assert.equal(report.audit.assignedTargetTotal, 10);
  assert.equal(report.audit.unassignedTargetTotal, 20);
  assertUnassignedAuditRow(report.audit.unassignedRows[0], {
    originalCode: "MISSING_IN_SCOPE",
    dealerName: "门店MISSING_IN_SCOPE",
    target: 20,
    reason: "目标门店无法匹配权威门店"
  });
  assert.equal(report.anomalies.some((item) => item.originalCode === "MISSING_IN_SCOPE" && item.anomalyType === "organization_unmapped"), true);
});

test("scope 外 actual 映射失败不泄露为非 HQ 可见 anomaly", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "OUTSIDE_ACTUAL", actual_small_order: 9 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.actual, 2);
  assert.equal(report.anomalies.some((item) => item.originalCode === "OUTSIDE_ACTUAL"), false);
});

test("v2.15 当前范围内 actual 0 命中时降级为实际不可用，不静默补 0", () => {
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    params: {},
    targetRows: [targetRow("S1", 507, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [{ dealer_code: "LEAF_ONLY", actual_small_order: 120, retained_small_order: 108, cancelled_small_order: 12 }],
    validDealers: [{ parentDealerCode: "S1", code: "LEAF_ONLY", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "partial");
  assert.equal(report.summary.actualStatus, "actual_unavailable");
  assert.equal(report.summary.actual, null);
  assert.equal(report.summary.retained, null);
  assert.equal(report.summary.achievementActual, null);
  assert.notEqual(report.summary.actual, 0);
  assert.equal(report.rows[0].actual, null);
  assert.equal(report.anomalies.some((item) => item.originalCode === "LEAF_ONLY" && item.reason === "实际权威维表0命中"), true);
});

test("v2.15 当前范围内 actual 多命中时降级为实际不可用，不选择任一候选伪成功", () => {
  const ambiguousOrgRows = [
    { ...orgRow("S1", 0), dealer_code: "LEAF_DUP" },
    { ...orgRow("S2", 0), dealer_code: "LEAF_DUP" }
  ];
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 250, 0), targetRow("S2", 257, 1)],
    organizationRows: ambiguousOrgRows,
    actualRows: [{ dealer_code: "LEAF_DUP", actual_small_order: 120, retained_small_order: 108, cancelled_small_order: 12 }],
    validDealers: validDealersFromOrgRows(ambiguousOrgRows),
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "partial");
  assert.equal(report.summary.actualStatus, "actual_unavailable");
  assert.equal(report.summary.actual, null);
  assert.equal(report.summary.retained, null);
  assert.equal(report.summary.achievementRate, null);
  assert.equal(report.rows.every((row) => row.actual == null), true);
  assert.equal(report.anomalies.some((item) => item.originalCode === "LEAF_DUP" && item.reason === "实际权威维表多命中"), true);
});

test("v2.15 范围外 actual 0 命中或多命中不污染当前范围", () => {
  const ambiguousOrgRows = [
    orgRow("S1", 0),
    { ...orgRow("O1", 1), dealer_code: "OUT_DUP" },
    { ...orgRow("O2", 1), dealer_code: "OUT_DUP" }
  ];
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    params: { dealerCode: "S1" },
    targetRows: [targetRow("S1", 507, 0), targetRow("O1", 100, 1), targetRow("O2", 100, 1)],
    organizationRows: ambiguousOrgRows,
    actualRows: [
      { dealer_code: "S1", actual_small_order: 120, retained_small_order: 108, cancelled_small_order: 12 },
      { dealer_code: "OUT_MISSING", actual_small_order: 99, retained_small_order: 88 },
      { dealer_code: "OUT_DUP", actual_small_order: 77, retained_small_order: 66 }
    ],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 507);
  assert.equal(report.summary.actualStatus, "ready");
  assert.equal(report.summary.actual, 120);
  assert.equal(report.summary.retained, 108);
  assert.equal(report.summary.achievementActual, 108);
  assert.equal(report.anomalies.some((item) => item.originalCode === "OUT_MISSING" || item.originalCode === "OUT_DUP"), false);
});

test("MQ257T 落在 scope 内时按 MQ256T canonical 映射并通过 scoped audit", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const org = fixture.orgRows.find((item) => item.parent_dealer_code === "MQ256T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [row],
    organizationRows: [org],
    actualRows: [],
    validDealers: [{ code: "MQ256T", areaCode: org.rfs_code, districtCode: org.mac_code }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.rows[0].stores[0].originalCode, "MQ257T");
  assert.equal(report.rows[0].stores[0].canonicalCode, "MQ256T");
  assert.equal(report.rows[0].stores[0].codeCorrectionNote, "权威维表按经销商简称唯一命中");
  assert.equal(report.audit.scopeSourceTargetTotal, 45);
  assert.equal(report.audit.scopeUnmapped, 0);
});

test("MQ257T canonical 有当前范围证据但组织映射缺失时隔离且业务静默", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [row],
    organizationRows: [],
    actualRows: [],
    validDealers: [{ code: "MQ256T", areaCode: "SMG310", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeSourceRows, 1);
  assert.equal(report.audit.scopeUnmapped, 1);
  assert.equal(report.audit.scopeUnmappedTargetTotal, 45);
  assert.equal(report.summary.target, 45);
  assert.equal(report.rows.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(report.warnings)), []);
  assertUnassignedAuditRow(report.audit.unassignedRows[0], {
    originalCode: "MQ257T",
    dealerName: "门店MQ257T",
    target: 45,
    reason: "目标门店无法匹配权威门店"
  });
  assert.equal(report.anomalies.some((item) => item.originalCode === "MQ257T" && item.anomalyType === "organization_unmapped"), true);
});

test("scope 外 MQ257T 缺组织映射不报错且不可见", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: [targetRow("S1", 10, 0), row],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    params: { dealerCode: "S1" },
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeSourceRows, 1);
  assert.equal(report.summary.target, 10);
  assert.equal(report.anomalies.some((item) => item.originalCode === "MQ257T"), false);
});

test("name-only 大区 params 下 canonical 有范围证据但组织映射缺失时隔离且业务静默", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { area: row.区域 },
    targetRows: [row],
    organizationRows: [],
    actualRows: [],
    validDealers: [{ code: "MQ256T", name: "门店MQ257T", areaCode: "SMG310", area: "1测试区", districtCode: "D1", district: "小区1" }],
    roleResult: { ok: true, role: "region" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeUnmapped, 1);
  assert.equal(report.summary.target, 45);
});

test("name-only 小区 params 下 canonical 有范围证据但组织映射缺失时隔离且业务静默", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { district: row.MAC },
    targetRows: [row],
    organizationRows: [],
    actualRows: [],
    validDealers: [{ code: "MQ256T", name: "门店MQ257T", areaCode: "SMG310", area: "1测试区", districtCode: "D1", district: "小区1" }],
    roleResult: { ok: true, role: "district" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeUnmapped, 1);
});

test("name-only 门店 params 下 canonical 有范围证据但组织映射缺失时隔离且业务静默", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    params: { store: "门店MQ257T" },
    targetRows: [row],
    organizationRows: [],
    actualRows: [],
    validDealers: [{ code: "MQ256T", name: "门店MQ257T", areaCode: "SMG310", area: "1测试区", districtCode: "D1", district: "小区1" }],
    roleResult: { ok: true, role: "sales_director" },
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.status, "ready");
  assert.equal(report.audit.scopeUnmapped, 1);
});

test("v2.02 name-only params 参与目标源行范围匹配，不用 validDealers 扩大 summary", () => {
  const fixture = contractFixture();
  const row = fixture.rows.find((item) => item.一级经销商 === "MQ257T");
  const mqOrg = fixture.orgRows.find((item) => item.parent_dealer_code === "MQ256T");
  const cases = [
    { params: { area: "不存在大区" }, role: "region" },
    { params: { district: "不存在小区" }, role: "district" },
    { params: { store: "其他门店" }, role: "sales_director" }
  ];
  cases.forEach(({ params, role }) => {
    const report = model.buildSmallOrderReport({
      status: "ready",
      config,
      period: model.periodInfo("2026-08-23"),
      params,
      targetRows: [targetRow("S1", 10, 0), row],
      organizationRows: [orgRow("S1", 0), mqOrg],
      actualRows: [],
      validDealers: [{ code: "S1", name: "门店S1", areaCode: "A1", area: "1测试区", districtCode: "D1", district: "小区1" }, { code: "MQ256T", name: "门店MQ257T", areaCode: "SMG310", area: "1测试区", districtCode: "D1", district: "小区1" }],
      roleResult: { ok: true, role },
      enforceTargetContract: true
    }, { viewLevel: "store" });
    assert.equal(report.status, "empty");
    assert.equal(report.audit.scopeSourceRows, 0);
    assert.equal(report.audit.scopeUnmapped, 0);
    assert.equal(report.summary.target, 0);
  });
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
  assert.equal(region.summary.actual, 2);
  assert.equal(region.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S2"), false);
  assert.equal(region.anomalies.some((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S3"), false);
  const district = model.buildSmallOrderReport({ ...baseRaw, roleResult: { ok: true, role: "district" } }, { viewLevel: "district" });
  assert.equal(district.summary.actual, 2);
});

test("v2.02 params 只用目标源字段匹配 summary，actual 仍按 validDealers 当前范围", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S4", 1)];
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    params: {},
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 10, 1, 0), targetRow("S4", 10, 2, 1)],
    organizationRows: orgRows,
    actualRows: [{ dealer_code: "S1", actual_small_order: 1 }, { dealer_code: "S4", actual_small_order: 9 }],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district" });
  assert.equal(report.status, "ready");
  assert.equal(report.summary.target, 30);
  assert.equal(report.summary.actual, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["D1", "D2"]);
});

test("小订表格下钻只裁剪行和行级异常，不污染摘要基准范围", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S4", 1)];
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0)],
    organizationRows: orgRows,
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "S2", actual_small_order: 3 }, { dealer_code: "S4", actual_small_order: 9 }],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "district", drillPath: [{ level: "area", code: "A1", name: "RFS(MG品牌1测试区-负责人)" }] });
  assert.equal(report.summaryViewLevel, "district");
  assert.equal(report.summary.target, 10);
  assert.equal(report.summary.actual, 14);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code))), ["D1"]);
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
    actualRows: [{ dealer_code: "S1", actual_small_order: 0, retained_small_order: 0 }, { dealer_code: "S2", actual_small_order: 5, retained_small_order: 5 }],
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

test("summary 输出留存、退订和当前层级对象总数，不改变主实际口径", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S3", 0)];
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 100, 0, 0), targetRow("S2", 100, 1, 0)],
    organizationRows: orgRows,
    actualRows: [
      { dealer_code: "S1", actual_small_order: 30, retained_small_order: 28, cancelled_small_order: 2, data_updated_at: "2026-08-12 16:00:00" },
      { dealer_code: "S2", actual_small_order: 40, retained_small_order: 37, cancelled_small_order: 3, data_updated_at: "2026-08-12 16:00:00" },
      { dealer_code: "S3", actual_small_order: 9, retained_small_order: 8, cancelled_small_order: 1, data_updated_at: "2026-08-12 16:00:00" }
    ],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.summary.actual, 79);
  assert.equal(report.summary.achievementActual, 73);
  assert.equal(report.summary.retained, 73);
  assert.equal(report.summary.cancelled, 6);
  assert.equal(report.summary.achievementRate, 73 / 200);
  assert.equal(report.summary.objectTotal, 3);
});

test("v2.10 目标达成、应达缺口、状态和排序使用留存小订，累计与今日新增仍独立展示", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S3", 0)];
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 100, 0, 0), targetRow("S2", 100, 1, 0)],
    organizationRows: orgRows,
    actualRows: [
      { dealer_code: "S1", actual_small_order: 30, retained_small_order: 28, cancelled_small_order: 12 },
      { dealer_code: "S2", actual_small_order: 80, retained_small_order: 77, cancelled_small_order: 3 },
      { dealer_code: "S3", actual_small_order: 9, retained_small_order: 8, cancelled_small_order: 1 }
    ],
    todayRows: [
      { dealer_code: "S1", actual_small_order: 0 },
      { dealer_code: "S2", actual_small_order: 216 },
      { dealer_code: "S3", actual_small_order: 4 }
    ],
    todayStatus: "ready",
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.summary.actual, 119);
  assert.equal(report.summary.todayActual, 220);
  assert.equal(report.summary.achievementActual, 113);
  assert.equal(report.summary.achievementRate, 113 / 200);
  assert.equal(report.summary.cancelled, 16);
  assert.equal(report.rows.find((row) => row.code === "S1").todayActual, 0);
  assert.equal(report.rows.find((row) => row.code === "S2").todayActual, 216);
  assert.equal(report.rows.find((row) => row.code === "S3").todayActual, 4);
  assert.equal(report.rows.find((row) => row.code === "S1").actual, 30);
  assert.equal(report.rows.find((row) => row.code === "S1").achievementActual, 28);
  assert.equal(report.rows.find((row) => row.code === "S1").achievementRate, 28 / 100);
  assert.equal(report.rows.find((row) => row.code === "S1").gapToExpected, 32);
  assert.equal(report.rows.find((row) => row.code === "S1").status, "落后");
  assert.equal(report.rows.find((row) => row.code === "S2").gapToExpected, 0);
  assert.equal(report.rows.find((row) => row.code === "S2").status, "领先");
  assert.equal(report.rows.find((row) => row.code === "S3").targetConfigured, false);
  assert.equal(report.rows.find((row) => row.code === "S3").status, "未设目标");
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code))), ["S1", "S2", "S3"]);
});

test("v2.04 今日新增期外、无当前范围有效数据或日查询失败均为不可展示", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0)];
  const baseRaw = {
    status: "ready",
    config,
    targetRows: [targetRow("S1", 100, 0, 0), targetRow("S2", 100, 1, 0)],
    organizationRows: orgRows,
    actualRows: [{ dealer_code: "S1", actual_small_order: 30 }, { dealer_code: "S2", actual_small_order: 40 }],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const afterPeriod = model.buildSmallOrderReport({ ...baseRaw, period: model.periodInfo("2026-08-23"), todayRows: [{ dealer_code: "S1", actual_small_order: 99 }], todayStatus: "out_of_period" }, { viewLevel: "store" });
  assert.equal(afterPeriod.summary.todayActual, null);
  assert.equal(afterPeriod.summary.actual, 70);

  const noData = model.buildSmallOrderReport({ ...baseRaw, period: model.periodInfo("2026-08-12"), todayRows: [], todayStatus: "no_data" }, { viewLevel: "store" });
  assert.equal(noData.summary.todayActual, null);

  const failed = model.buildSmallOrderReport({ ...baseRaw, period: model.periodInfo("2026-08-12"), todayRows: [{ dealer_code: "S1", actual_small_order: 99 }], todayStatus: "today_unavailable" }, { viewLevel: "store" });
  assert.equal(failed.summary.todayActual, null);

  const outsideScope = model.buildSmallOrderReport({ ...baseRaw, period: model.periodInfo("2026-08-12"), todayRows: [{ dealer_code: "S2", actual_small_order: 8 }], todayStatus: "ready", validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }] }, { viewLevel: "store" });
  assert.equal(outsideScope.summary.todayActual, null);
  assert.equal(outsideScope.summary.actual, 30);
});

test("v2.04 累计实际源不可用时即使日查询成功，今日新增行级也不可展示", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 100, 0, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    actualStatus: "actual_unavailable",
    actualError: "MG 07 小订实际数据暂不可用",
    todayRows: [{ dealer_code: "S1", actual_small_order: 12 }],
    todayStatus: "ready",
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }]
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "partial");
  assert.equal(report.summary.actual, null);
  assert.equal(report.summary.todayActual, null);
  assert.equal(report.summary.achievementRate, null);
  assert.equal(report.rows[0].actual, null);
  assert.equal(report.rows[0].todayActual, null);
});

test("summary dataUpdatedAt 取所有计入累计小订实际源最大时间，actual-only anomaly 保留调度时间", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S3", 0)];
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 100, 0, 0)],
    organizationRows: orgRows,
    actualRows: [
      { dealer_code: "S1", actual_small_order: 30, retained_small_order: 28, cancelled_small_order: 2, data_updated_at: "2026-08-12 09:00:00" },
      { dealer_code: "S3", actual_small_order: 9, retained_small_order: 8, cancelled_small_order: 1, data_updated_at: "2026-08-12 16:00:00" }
    ],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.summary.actual, 39);
  assert.equal(report.summary.retained, 36);
  assert.equal(report.summary.cancelled, 3);
  assert.equal(report.summary.dataUpdatedAt, "2026-08-12 16:00:00");
  const actualOnly = report.anomalies.find((item) => item.anomalyType === "unconfigured_actual" && item.canonicalCode === "S3");
  assert.equal(actualOnly.dataUpdatedAt, "2026-08-12 16:00:00");
});

test("合同失败和实际源不可用不伪造 actual-only 更新时间", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S3", 0)];
  const baseRaw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-12"),
    targetRows: [targetRow("S1", 100, 0, 0)],
    organizationRows: orgRows,
    actualRows: [{ dealer_code: "S3", actual_small_order: 9, data_updated_at: "2026-08-12 16:00:00" }],
    validDealers: validDealersFromOrgRows(orgRows)
  };
  const unavailable = model.buildSmallOrderReport({ ...baseRaw, actualStatus: "actual_unavailable" }, { viewLevel: "store" });
  assert.equal(unavailable.summary.dataUpdatedAt, "");
  assert.equal(unavailable.anomalies.some((item) => item.dataUpdatedAt), false);
  const failed = model.buildSmallOrderReport({ status: "data_incomplete", error: "目标合同失败", period: baseRaw.period }, { viewLevel: "store" });
  assert.equal(failed.summary, null);
  assert.equal(failed.anomalies.some((item) => item.dataUpdatedAt), false);
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

test("v2.02 顶部 params/RLS 源行范围联动目标，actual 仍按 validDealers 裁剪", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S3", 1)];
  const allDealers = validDealersFromOrgRows(orgRows);
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S2", 20, 1, 0), targetRow("S3", 30, 2, 1)],
    organizationRows: orgRows,
    actualRows: [{ dealer_code: "S1", actual_small_order: 1 }, { dealer_code: "S2", actual_small_order: 2 }, { dealer_code: "S3", actual_small_order: 3 }, { dealer_code: "OUT", actual_small_order: 99 }],
    enforceTargetContract: true
  };
  const all = model.buildSmallOrderReport({ ...raw, params: { brand: "MG" }, validDealers: allDealers }, { viewLevel: "area" });
  assert.equal(all.status, "ready");
  assert.equal(all.summary.target, 60);
  assert.equal(all.summary.actual, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(all.rows.map((row) => row.code).sort())), ["A1", "A2"]);
  assertNoNationalAuditAliases(all.audit);

  const region = model.buildSmallOrderReport({ ...raw, params: { brand: "MG", area: "RFS(MG品牌1测试区-负责人)" }, validDealers: allDealers.slice(0, 2) }, { viewLevel: "district" });
  assert.equal(region.summary.target, 30);
  assert.equal(region.summary.actual, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(region.rows.map((row) => row.code))), ["D1"]);

  const district = model.buildSmallOrderReport({ ...raw, params: { brand: "MG", district: "小区1" }, validDealers: allDealers.slice(0, 1) }, { viewLevel: "store" });
  assert.equal(district.summary.target, 30);
  assert.equal(district.audit.assignedTargetTotal, 30);
  assert.equal(district.audit.scopeTargetTotal, 10);
  assert.equal(district.summary.actual, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(district.rows.map((row) => row.code))), ["S1"]);

  const store = model.buildSmallOrderReport({ ...raw, params: { brand: "MG", dealerCode: "S2" }, validDealers: [allDealers[1]] }, { viewLevel: "store" });
  assert.equal(store.summary.target, 20);
  assert.equal(store.summary.actual, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(store.rows.map((row) => row.code))), ["S2"]);

  const nonMg = model.buildSmallOrderReport({ ...raw, params: { brand: "荣威" }, validDealers: allDealers }, { viewLevel: "area" });
  assert.equal(nonMg.status, "empty");
  assert.equal(nonMg.error, "MG 07 当前范围暂无数据");
  assert.equal(nonMg.summary.target, 0);
  assert.equal(nonMg.rows.length, 0);
});

test("v2.02 actual-only 进入父级累计和门店清单，no-target/no-actual 不出现且不落后", () => {
  const orgRows = [orgRow("S1", 0), orgRow("S2", 0), orgRow("S0", 0), orgRow("S_EMPTY", 0)];
  const report = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S0", 0, 1, 0)],
    organizationRows: orgRows,
    actualRows: [
      { dealer_code: "S1", actual_small_order: 1, retained_small_order: 1 },
      { dealer_code: "S2", actual_small_order: 5, retained_small_order: 5 },
      { dealer_code: "S0", actual_small_order: 3, retained_small_order: 3 }
    ],
    validDealers: validDealersFromOrgRows(orgRows),
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(report.summary.target, 10);
  assert.equal(report.summary.actual, 9);
  assert.equal(report.summary.achievementRate, 0.9);
  assert.equal(report.summary.laggingCount, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(report.rows.map((row) => row.code).sort())), ["S0", "S1", "S2"]);
  const actualOnly = report.rows.find((row) => row.code === "S2");
  assert.equal(actualOnly.targetConfigured, false);
  assert.equal(actualOnly.achievementRate, null);
  assert.equal(actualOnly.status, "未设目标");
  assert.equal(actualOnly.gapToExpected, null);
  assert.equal(report.rows.some((row) => row.code === "S_EMPTY"), false);
  const zero = report.rows.find((row) => row.code === "S0");
  assert.equal(zero.targetConfigured, true);
  assert.equal(zero.target, 0);
  assert.equal(zero.achievementRate, null);
  assert.equal(zero.status, "零目标");
});

test("v2.02 范围外目标、事实、非法目标和重复目标不影响当前用户，范围内异常按规则处理", () => {
  const outside = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    params: { dealerCode: "S1" },
    targetRows: [targetRow("S1", 10, 0, 0), { ...targetRow("OUT_BAD", 20, 1, 1), MG07小订目标: "-1" }],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [{ dealer_code: "S1", actual_small_order: 2 }, { dealer_code: "OUT_BAD", actual_small_order: 99 }],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(outside.status, "ready");
  assert.equal(outside.summary.target, 10);
  assert.equal(outside.summary.actual, 2);
  assert.equal(outside.anomalies.some((item) => item.originalCode === "OUT_BAD"), false);

  const invalid = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [{ ...targetRow("S1", 10, 0, 0), MG07小订目标: "1.5" }],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(invalid.status, "data_incomplete");
  assert.match(invalid.error, /无效目标配置/);

  const duplicate = model.buildSmallOrderReport({
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0, 0), targetRow("S1", 20, 1, 0)],
    organizationRows: [orgRow("S1", 0)],
    actualRows: [],
    validDealers: [{ code: "S1", areaCode: "A1", districtCode: "D1" }],
    enforceTargetContract: true
  }, { viewLevel: "store" });
  assert.equal(duplicate.status, "data_incomplete");
  assert.match(duplicate.error, /重复目标配置/);
});
