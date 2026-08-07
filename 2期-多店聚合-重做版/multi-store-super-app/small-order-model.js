(function (root) {
  const {
    text,
    normalizeOrg,
    normalizeTargets,
    normalizeActuals,
    mapActuals,
    permissionScope,
    upstreamScope,
    inPermission,
    validDealerEvidenceInUpstream,
    visibleTargets,
    targetSourceRowsInSourceScope,
    applyDrill,
    normalizeAnomaly,
    auditTargets,
    auditScopedTargets
  } = root.SmallOrderContract;

  function dateAt(value) { return new Date(`${value}T00:00:00`); }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

  function periodInfo(todayInput = new Date(), period = root.SmallOrderConfig.PERIOD) {
    const today = todayInput instanceof Date ? todayInput : dateAt(String(todayInput).slice(0, 10));
    const start = dateAt(period.startDate);
    const end = dateAt(period.endDate);
    if (Number.isNaN(today.getTime())) return { status: "数据暂不可用", progress: 0, progressText: "--", cutoffDate: "", actualRange: null, todayRange: null, todayDate: "" };
    if (today < start) return { status: "小订即将开始", progress: 0, progressText: "0.0%", cutoffDate: "", actualRange: null, todayRange: null, todayDate: dateKey(today) };
    const cutoff = today > end ? end : today;
    const elapsed = Math.floor((cutoff - start) / 86400000) + 1;
    const progress = Math.min(1, Math.max(0, elapsed / period.days));
    const todayDate = dateKey(today);
    const todayRange = today > end ? null : { startDate: todayDate, endDate: todayDate };
    return {
      status: today > end ? "小订已结束" : "小订进行中",
      progress,
      progressText: `${(progress * 100).toFixed(1)}%`,
      cutoffDate: dateKey(cutoff),
      actualRange: { startDate: period.startDate, endDate: dateKey(cutoff) },
      todayRange,
      todayDate
    };
  }

  function buildRows({ targets, actuals, todayActuals, level, drillPath, period, actualUnavailable = false, todayUnavailable = true }) {
    const actualByCode = new Map(actuals.map((row) => [row.code, row]));
    const todayByCode = new Map(todayActuals.map((row) => [row.code, row]));
    const baseRows = targets.map((target) => {
      const actual = actualUnavailable ? { actual: null, retained: null, cancelled: null, updatedAt: "" } : actualByCode.get(target.canonicalCode) || { actual: 0, retained: 0, cancelled: 0, updatedAt: "" };
      const today = todayUnavailable ? { actual: null } : todayByCode.get(target.canonicalCode) || { actual: null };
      actualByCode.delete(target.canonicalCode);
      todayByCode.delete(target.canonicalCode);
      const row = { ...target, targetConfigured: true, actual: actual.actual, todayActual: today.actual, retained: actual.retained, cancelled: actual.cancelled, updatedAt: actual.updatedAt };
      return finalizeRow({ ...row, stores: [row] }, period);
    });
    const anomalies = [];
    const actualOnlyRows = applyDrill([...actualByCode.values()], drillPath);
    const actualOnlyStoreRows = actualOnlyRows
      .filter((actual) => Number(actual.actual) > 0)
      .map((actual) => {
        const today = todayUnavailable ? { actual: null } : todayByCode.get(actual.code) || { actual: null };
        todayByCode.delete(actual.code);
        const row = { ...actual, target: 0, targetConfigured: false, actual: actual.actual, todayActual: today.actual, retained: actual.retained, cancelled: actual.cancelled, updatedAt: actual.updatedAt };
        anomalies.push({ anomalyType: "unconfigured_actual", originalCode: actual.originalCode || actual.code, canonicalCode: actual.canonicalCode || actual.code, dealerName: actual.name || "", target: 0, actual: actual.actual, dataUpdatedAt: actual.updatedAt, reason: "未设目标但有实际", handling: "actual_in_summary_not_lagging" });
        return finalizeRow({ ...row, stores: [row] }, period);
      });
    const unconfiguredTodayActual = todayUnavailable ? 0 : [...todayByCode.values()].filter((row) => Number(row.actual) > 0).reduce((sum, row) => sum + row.actual, 0);
    return {
      rows: aggregate([...applyDrill(baseRows, drillPath), ...actualOnlyStoreRows], level, period),
      anomalies,
      unconfiguredActual: 0,
      unconfiguredTodayActual,
      unconfiguredRetained: 0,
      unconfiguredCancelled: 0,
      unconfiguredUpdatedAt: ""
    };
  }

  function finalizeRow(row, period) {
    if (row.actual == null) return { ...row, achievementActual: null, achievementRate: null, gapToExpected: null, status: "数据暂不可用" };
    const achievementActual = row.retained;
    const targetConfigured = row.targetConfigured === true;
    const gap = !targetConfigured || row.target === 0 ? null : Math.max(0, row.target * period.progress - achievementActual);
    const status = !targetConfigured ? "未设目标" : row.target === 0 ? "零目标" : gap > 0 ? "落后" : "领先";
    return { ...row, achievementActual, achievementRate: row.target > 0 ? achievementActual / row.target : null, gapToExpected: gap, status };
  }

  function keyFor(row, level) {
    if (level === "area") return { code: row.areaCode || row.area, name: row.area || "未知大区" };
    if (level === "district") return { code: row.districtCode || row.district, name: row.district || "未知小区" };
    return { code: row.canonicalCode || row.code, name: row.name || row.dealerShortName || row.code };
  }

  function aggregate(rows, level, period) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = keyFor(row, level);
      if (!key.code) return;
      const current = groups.get(key.code) || { code: key.code, name: key.name, level, target: 0, targetConfigured: false, configuredStoreCount: 0, actual: 0, todayActual: null, achievementActual: 0, retained: 0, cancelled: 0, stores: [], updatedAt: "" };
      current.target += row.target;
      current.targetConfigured = current.targetConfigured || row.targetConfigured === true;
      current.configuredStoreCount += row.targetConfigured === true ? 1 : 0;
      current.actual = row.actual == null || current.actual == null ? null : current.actual + row.actual;
      current.todayActual = row.todayActual == null ? current.todayActual : (current.todayActual || 0) + row.todayActual;
      current.achievementActual = row.achievementActual == null || current.achievementActual == null ? null : current.achievementActual + row.achievementActual;
      current.retained = row.retained == null || current.retained == null ? null : current.retained + row.retained;
      current.cancelled = row.cancelled == null || current.cancelled == null ? null : current.cancelled + row.cancelled;
      current.stores.push(row);
      current.updatedAt = [current.updatedAt, row.updatedAt].filter(Boolean).sort().at(-1) || "";
      groups.set(key.code, current);
    });
    return [...groups.values()].map((row) => finalizeRow(row, period)).sort((a, b) => b.gapToExpected - a.gapToExpected || text(a.code).localeCompare(text(b.code)));
  }

  function nextLevel(level) {
    if (level === "area") return "district";
    if (level === "district") return "store";
    return "store";
  }

  function summarize(rows, unconfiguredActual, unconfiguredTodayActual, unconfiguredRetained, unconfiguredCancelled, unconfiguredUpdatedAt, period, actualUnavailable = false, todayUnavailable = true, scopeMode = "", sourceTargetTotal = null) {
    const rowTarget = rows.reduce((sum, row) => sum + row.target, 0);
    const target = sourceTargetTotal == null ? rowTarget : sourceTargetTotal;
    const objectTotal = rows.length;
    if (actualUnavailable) return { target, actual: null, todayActual: null, achievementActual: null, retained: null, cancelled: null, achievementRate: null, progressText: period.progressText, laggingCount: null, objectTotal, ownStatus: "数据暂不可用", scopeMode, dataUpdatedAt: "" };
    const actual = rows.reduce((sum, row) => sum + row.actual, 0) + unconfiguredActual;
    const scopedTodayRows = rows.filter((row) => row.todayActual != null);
    const todayActual = todayUnavailable || (!scopedTodayRows.length && !unconfiguredTodayActual) ? null : scopedTodayRows.reduce((sum, row) => sum + row.todayActual, 0) + unconfiguredTodayActual;
    const retained = rows.reduce((sum, row) => sum + row.retained, 0) + unconfiguredRetained;
    const achievementActual = retained;
    const cancelled = rows.reduce((sum, row) => sum + row.cancelled, 0) + unconfiguredCancelled;
    const own = rows[0]?.status || "数据暂不可用";
    return { target, actual, todayActual, achievementActual, retained, cancelled, achievementRate: target > 0 ? achievementActual / target : null, progressText: period.progressText, laggingCount: scopeMode === "own_store" ? 0 : rows.filter((row) => row.targetConfigured === true && row.gapToExpected > 0).length, objectTotal, ownStatus: own, scopeMode, dataUpdatedAt: [...rows.map((row) => row.updatedAt), unconfiguredUpdatedAt].filter(Boolean).sort().at(-1) || "" };
  }

  function isSpecificNonMgBrand(raw) {
    const params = raw?.params || raw?.identity?.params || {};
    const brand = text(params.brand);
    return Boolean(brand) && brand !== "MG" && brand !== "全部" && brand !== "全部品牌";
  }

  function emptySummary(period, raw = {}, scopeMode = "store_list") {
    return {
      target: 0,
      actual: raw.actualStatus === "actual_unavailable" ? null : 0,
      todayActual: null,
      achievementActual: raw.actualStatus === "actual_unavailable" ? null : 0,
      retained: raw.actualStatus === "actual_unavailable" ? null : 0,
      cancelled: raw.actualStatus === "actual_unavailable" ? null : 0,
      achievementRate: null,
      progressText: period.progressText,
      laggingCount: raw.actualStatus === "actual_unavailable" ? null : 0,
      objectTotal: 0,
      ownStatus: "数据暂不可用",
      scopeMode,
      dataUpdatedAt: "",
      actualStatus: raw.actualStatus || "ready",
      todayStatus: raw.todayStatus || "not_loaded",
      actualError: actualBusinessError(raw)
    };
  }

  function emptyReport(raw, viewState, message) {
    const level = viewState.viewLevel || raw.entryLevel || "area";
    return {
      status: "empty",
      error: message,
      period: raw.period,
      identity: raw.identity,
      viewLevel: level,
      nextLevel: nextLevel(level),
      summary: emptySummary(raw.period, raw, "store_list"),
      rows: [],
      anomalies: [],
      warnings: [],
      audit: { contractOk: true, visibleRows: 0 },
      diagnostics: raw.rawError || raw.rawActualError ? { rawError: raw.rawError || "", rawActualError: raw.rawActualError || "" } : undefined
    };
  }

  function targetBusinessError(audit) {
    if (audit?.duplicateTargetRows > 0) return "当前范围存在重复目标配置";
    if (audit?.invalidTargetRows > 0) return "当前范围存在无效目标配置";
    return "MG 07 小订目标数据暂不可用";
  }

  function actualBusinessError(raw) {
    if (raw?.actualStatus !== "actual_unavailable") return raw?.actualError || "";
    return "MG 07 小订实际数据暂不可用";
  }

  function anomalyCandidateCodes(item) {
    return [item?.originalCode, item?.canonicalCode, ...(item?.candidateCanonicalCodes || [])].map(text).filter(Boolean);
  }

  function anomalyInCurrentScope(item, scope, upstream) {
    if (scope.mode === "all") return true;
    return anomalyCandidateCodes(item).some((code) => {
      if (!scope.codes?.has(code) && !scope.dealerEvidence?.has(code)) return false;
      if (!upstream || upstream.mode === "all") return true;
      const evidenceRows = scope.dealerEvidence?.get(code) || [];
      if (validDealerEvidenceInUpstream(evidenceRows, upstream)) return true;
      if (upstream.mode === "code") return text(upstream.code) === code || text(upstream.name) === code;
      return false;
    });
  }

  function buildSmallOrderReport(raw, viewState = {}) {
    if (!raw || raw.status !== "ready") return { status: raw?.status || "target_unavailable", error: raw?.error || "MG 07 小订目标数据暂不可用", summary: null, rows: [], anomalies: [], period: raw?.period || periodInfo(), diagnostics: raw?.rawError ? { rawError: raw.rawError } : undefined };
    if (raw.emptyReason === "non_mg_brand" || isSpecificNonMgBrand(raw)) return emptyReport(raw, viewState, "MG 07 当前范围暂无数据");
    const scope = permissionScope(raw);
    if (!scope.ok) return { status: "no_permission", error: scope.reason, summary: null, rows: [], anomalies: [], period: raw.period, audit: null };
    const upstream = upstreamScope(raw.params || raw.identity?.params || {});
    const isNationalContract = raw.adminAuditTargets === true && scope.mode === "all";
    const targetSourceRows = isNationalContract ? (raw.targetRows || []) : targetSourceRowsInSourceScope(raw.targetRows || [], upstream, scope.dealerEvidence);
    const mapped = normalizeTargets(targetSourceRows, raw.organizationRows || []);
    const targets = visibleTargets(mapped.targets, scope, upstream);
    const audit = isNationalContract ? auditTargets(raw.targetRows || [], mapped, raw.config) : auditScopedTargets(targetSourceRows, mapped, targets);
    if (raw.enforceTargetContract === true && !audit.contractOk) return { status: "data_incomplete", error: targetBusinessError(audit), summary: null, rows: [], anomalies: mapped.anomalies.map((item) => normalizeAnomaly(item, raw.period)), period: raw.period, audit, diagnostics: { contractError: audit.contractError } };
    const rawActualUnavailable = raw.actualStatus === "actual_unavailable";
    const actualMapping = raw.period.actualRange && !rawActualUnavailable ? mapActuals(raw.actualRows || [], mapped.orgs || []) : { actuals: [], anomalies: [] };
    const actualAnomalies = isNationalContract ? actualMapping.anomalies : actualMapping.anomalies.filter((item) => anomalyInCurrentScope(item, scope, upstream));
    const actualUnavailable = rawActualUnavailable || actualAnomalies.length > 0;
    const todayUnavailable = raw.todayStatus !== "ready" || actualUnavailable;
    const todayMapping = raw.period.todayRange && !todayUnavailable ? mapActuals(raw.todayRows || [], mapped.orgs || []) : { actuals: [], anomalies: [] };
    const actuals = actualMapping.actuals.filter((row) => inPermission(row, scope));
    const todayActuals = todayMapping.actuals.filter((row) => inPermission(row, scope));
    const todayAnomalies = isNationalContract ? todayMapping.anomalies : todayMapping.anomalies.filter((item) => anomalyInCurrentScope(item, scope, upstream));
    const level = viewState.viewLevel || raw.entryLevel || "area";
    const summaryLevel = viewState.summaryViewLevel || raw.entryLevel || level;
    const drillPath = viewState.drillPath || [];
    const built = buildRows({ targets, actuals, todayActuals, level, drillPath, period: raw.period, actualUnavailable, todayUnavailable });
    const summaryBuilt = level === summaryLevel && !drillPath.length
      ? built
      : buildRows({ targets, actuals, todayActuals, level: summaryLevel, drillPath: [], period: raw.period, actualUnavailable, todayUnavailable });
    const zeroTarget = actualUnavailable ? [] : built.rows.flatMap((row) => row.stores || []).filter((row) => row.target === 0 && row.actual > 0).map((row) => ({ anomalyType: "zero_target_actual", originalCode: row.originalCode, canonicalCode: row.canonicalCode, dealerName: row.name, target: row.target, actual: row.actual, reason: "零目标有实际", handling: "actual_in_summary_and_parent_achievement" }));
    const rows = built.rows;
    const sourceTargetTotal = audit.sourceTargetTotal ?? audit.scopeSourceTargetTotal ?? null;
    const status = rows.length || sourceTargetTotal > 0 ? (actualUnavailable ? "partial" : "ready") : "empty";
    return {
      status,
      error: status === "empty" ? "当前范围暂无 MG 07 小订战报数据" : "",
      period: raw.period,
      identity: raw.identity,
      viewLevel: level,
      summaryViewLevel: summaryLevel,
      nextLevel: nextLevel(level),
      summary: { ...summarize(summaryBuilt.rows, summaryBuilt.unconfiguredActual, summaryBuilt.unconfiguredTodayActual, summaryBuilt.unconfiguredRetained, summaryBuilt.unconfiguredCancelled, summaryBuilt.unconfiguredUpdatedAt, raw.period, actualUnavailable, todayUnavailable, scopeMode(raw, upstream, targets), sourceTargetTotal), actualStatus: actualUnavailable ? "actual_unavailable" : raw.actualStatus || "ready", todayStatus: raw.todayStatus || "not_loaded", actualError: actualUnavailable ? "MG 07 小订实际数据暂不可用" : actualBusinessError(raw) },
      rows,
      anomalies: [...mapped.anomalies, ...actualAnomalies, ...todayAnomalies, ...built.anomalies, ...zeroTarget].map((item) => normalizeAnomaly(item, raw.period)),
      warnings: [],
      audit: { ...audit, visibleRows: targets.length },
      diagnostics: raw.rawActualError || (raw.actualStatus === "actual_unavailable" && raw.actualError) ? { rawActualError: raw.rawActualError || raw.actualError } : undefined
    };
  }

  function scopeMode(raw, upstream, targets) {
    if (upstream?.mode === "code") return "own_store";
    if ((raw.validDealers || []).length === 1 && targets.length === 1) return "own_store";
    return "store_list";
  }

  root.SmallOrderModel = { periodInfo, buildSmallOrderReport };
  if (root.__SMALL_ORDER_TEST__ === true) root.SmallOrderModel.__test = { normalizeTargets, normalizeActuals, buildSmallOrderReport, periodInfo, normalizeOrg, targetSourceRowsInSourceScope, auditScopedTargets };
})(typeof window !== "undefined" ? window : globalThis);
