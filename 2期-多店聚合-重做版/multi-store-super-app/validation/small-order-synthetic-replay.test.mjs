import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { config, contractFixture, model, orgRow, targetRow } from "./small-order-test-helpers.mjs";

async function withTmpReplay(payload, run) {
  const dir = await mkdtemp("/tmp/mg07-small-order-");
  const file = join(dir, "synthetic-fixture-replay.json");
  await writeFile(file, JSON.stringify(payload), "utf8");
  try {
    return await run(JSON.parse(await readFile(file, "utf8")), file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function rawFromFixture(overrides = {}) {
  const { rows, orgRows } = contractFixture();
  return {
    status: "ready",
    config,
    period: model.periodInfo("2026-08-23"),
    targetRows: rows,
    organizationRows: orgRows,
    actualRows: [],
    validDealers: [],
    enforceTargetContract: true,
    ...overrides
  };
}

test("后台全国 QA 硬合同门禁不守恒时不得 ready", () => {
  const raw = rawFromFixture({ adminAuditTargets: true });
  raw.targetRows = raw.targetRows.map((row) => row.一级经销商 === "MQ856G" ? { ...row, MG07小订目标: "1" } : row);
  const report = model.buildSmallOrderReport(raw, { viewLevel: "area" });
  assert.equal(report.status, "data_incomplete");
  assert.equal(report.error, "MG 07 小订目标数据暂不可用");
  assert.match(report.diagnostics.contractError, /targetTotal/);
});

test("合同失败早退仍返回完整 anomaly schema 和固定窗口", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("BAD", 10, 0)],
    organizationRows: [],
    actualRows: [],
    validDealers: [],
    roleResult: { ok: true, role: "headquarters" },
    nationalComplete: true,
    adminAuditTargets: true,
    enforceTargetContract: true
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "data_incomplete");
  assert.equal(report.rows.length, 0);
  assert.equal(report.anomalies[0].anomalyType, "organization_unmapped");
  assert.equal(report.anomalies[0].periodStart, "2026-07-29");
  assert.equal(report.anomalies[0].periodEnd, "2026-07-29");
  assert.equal(typeof report.anomalies[0].handling, "string");
});

test("实际源不可用时保留目标但不构造0实际、达成率和落后缺口", () => {
  const raw = {
    status: "ready",
    config,
    period: model.periodInfo("2026-07-29"),
    targetRows: [targetRow("S1", 10, 0)],
    organizationRows: [{ ...orgRow("S1"), web_display_name: "门店S1", rfs_code: "SMG310" }],
    actualRows: [{ dealer_code: "S1", actual_small_order: 3 }],
    actualStatus: "actual_unavailable",
    actualError: "timeout",
    validDealers: [{ code: "S1", areaCode: "SMG310", districtCode: "D1" }],
    enforceTargetContract: false
  };
  const report = model.buildSmallOrderReport(raw, { viewLevel: "store" });
  assert.equal(report.status, "partial");
  assert.equal(report.summary.target, 10);
  assert.equal(report.summary.actual, null);
  assert.equal(report.summary.achievementRate, null);
  assert.equal(report.rows[0].actual, null);
  assert.equal(report.rows[0].gapToExpected, null);
  assert.equal(report.summary.actualStatus, "actual_unavailable");
});

test("synthetic fixture / 临时文件回放达到 403 mapped、0 unmapped、30001、17、7 和 MQ257T 修正", async () => {
  await withTmpReplay(contractFixture(), ({ rows, orgRows }, file) => {
    assert.match(file, /\/tmp\/mg07-small-order-/);
    const report = model.buildSmallOrderReport(rawFromFixture({ targetRows: rows, organizationRows: orgRows, adminAuditTargets: true }), { viewLevel: "area" });
    assert.equal(report.status, "ready");
    assert.equal(report.audit.configuredRows, 403);
    assert.equal(report.audit.unmappedRows, 0);
    assert.equal(report.audit.targetTotal, 30001);
    assert.equal(report.audit.zeroTargetRows, 17);
    assert.equal(report.audit.areaCount, 7);
    assert.equal(report.audit.mq257tCorrected, true);
    assert.equal(report.audit.contractOk, true);
  });
});

test("synthetic fixture / 临时文件回放篡改 valid primary miss 明细但总量不变时合同门禁 fail-closed", async () => {
  const fixture = contractFixture();
  fixture.rows = fixture.rows.map((row) => {
    if (row.一级经销商 === "MQ207J") return { ...row, MG07小订目标: "103" };
    if (row.一级经销商 === "T000") return { ...row, MG07小订目标: String(Number(row.MG07小订目标) + 1) };
    return row;
  });
  await withTmpReplay(fixture, ({ rows, orgRows }) => {
    const report = model.buildSmallOrderReport(rawFromFixture({ targetRows: rows, organizationRows: orgRows, adminAuditTargets: true }), { viewLevel: "area" });
    assert.equal(report.status, "data_incomplete");
    assert.equal(report.error, "MG 07 小订目标数据暂不可用");
    assert.match(report.diagnostics.contractError, /validPrimaryMissDetailsMatch|validPrimaryHits|specialStatusRows/);
  });
});

test("synthetic fixture / 临时文件回放支持顶部 validDealers 大区/小区子集筛选", async () => {
  const fixture = contractFixture();
  const scoped = fixture.orgRows.find((row) => row.mac_shortnm === "小区3");
  const scopeOrgRows = fixture.orgRows.filter((row) => row.rfs_shortnm === scoped.rfs_shortnm && row.mac_shortnm === scoped.mac_shortnm);
  const validDealers = scopeOrgRows.map((row) => ({ code: row.parent_dealer_code, areaCode: row.rfs_code, area: row.rfs_name, districtCode: row.mac_code, district: row.mac_name }));
  await withTmpReplay(fixture, ({ rows, orgRows }) => {
    const report = model.buildSmallOrderReport(rawFromFixture({
      targetRows: rows,
      organizationRows: orgRows.filter((row) => scopeOrgRows.some((scopeRow) => scopeRow.parent_dealer_code === row.parent_dealer_code)),
      validDealers
    }), { viewLevel: "store" });
    assert.equal(report.status, "ready");
    assert.ok(report.rows.length > 0);
    assert.ok(report.rows.every((row) => row.stores.every((store) => store.areaShortName === scoped.rfs_shortnm && store.districtShortName === scoped.mac_shortnm)));
  });
});

test("synthetic fixture / 临时文件回放模拟目标 DS RLS 子集时执行 scoped contract", async () => {
  const fixture = contractFixture();
  const scopeOrgRows = fixture.orgRows.filter((row) => row.rfs_code === "SMG310");
  const scopeAreaNames = new Set(scopeOrgRows.map((row) => row.rfs_name));
  const scopeTargetRows = fixture.rows.filter((row) => !row.一级经销商 || scopeAreaNames.has(row.区域));
  const validDealers = scopeOrgRows.map((row) => ({ code: row.parent_dealer_code, areaCode: row.rfs_code, districtCode: row.mac_code }));
  await withTmpReplay({ rows: scopeTargetRows, orgRows: scopeOrgRows, validDealers }, ({ rows, orgRows, validDealers }) => {
    const report = model.buildSmallOrderReport(rawFromFixture({
      targetRows: rows,
      organizationRows: orgRows,
      validDealers
    }), { viewLevel: "store" });
    assert.equal(report.status, "ready");
    assert.equal(report.audit.contractOk, true);
    assert.equal(report.audit.scopeUnmapped, 0);
    assert.equal(report.audit.scopeSourceRows, orgRows.length);
    assert.equal(report.audit.scopeMappedRows, orgRows.length);
    assert.equal(report.audit.scopeMappedTargetTotal, report.audit.scopeTargetTotal);
    assert.notEqual(report.audit.scopeTargetTotal, 30001);
    ["configuredRows", "canonicalUniqueCodes", "targetTotal"].forEach((key) => assert.equal(Object.hasOwn(report.audit, key), false, key));
    assert.equal(report.rows.every((row) => row.stores.every((store) => store.areaCode === "SMG310")), true);
  });
});

test("synthetic fixture / 临时文件回放篡改重复源代码时合同门禁 fail-closed", async () => {
  const fixture = contractFixture();
  fixture.rows = fixture.rows.map((row, index) => index === 10 ? { ...row, 一级经销商: fixture.rows[9].一级经销商, 经销商简称: fixture.rows[9].经销商简称 } : row);
  await withTmpReplay(fixture, ({ rows, orgRows }) => {
    const report = model.buildSmallOrderReport(rawFromFixture({ targetRows: rows, organizationRows: orgRows, adminAuditTargets: true }), { viewLevel: "area" });
    assert.equal(report.status, "data_incomplete");
    assert.equal(report.error, "MG 07 小订目标数据暂不可用");
    assert.match(report.diagnostics.contractError, /sourceUniqueCodes|canonicalUniqueCodes/);
  });
});
