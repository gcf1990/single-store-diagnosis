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
    inUpstream,
    visibleTargets,
    applyDrill,
    normalizeAnomaly,
    auditTargets
  } = root.SmallOrderContract;

  function dateAt(value) { return new Date(`${value}T00:00:00`); }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

  function periodInfo(todayInput = new Date(), period = root.SmallOrderConfig.PERIOD) {
    const today = todayInput instanceof Date ? todayInput : dateAt(String(todayInput).slice(0, 10));
    const start = dateAt(period.startDate);
    const end = dateAt(period.endDate);
    if (Number.isNaN(today.getTime())) return { status: "数据暂不可用", progress: 0, progressText: "--", cutoffDate: "", actualRange: null };
    if (today < start) return { status: "小订即将开始", progress: 0, progressText: "0.0%", cutoffDate: "", actualRange: null };
    const cutoff = today > end ? end : today;
    const elapsed = Math.floor((cutoff - start) / 86400000) + 1;
    const progress = Math.min(1, Math.max(0, elapsed / period.days));
    return {
      status: today > end ? "小订已结束" : "小订进行中",
      progress,
      progressText: `${(progress * 100).toFixed(1)}%`,
      cutoffDate: dateKey(cutoff),
      actualRange: { startDate: period.startDate, endDate: dateKey(cutoff) }
    };
  }

  function buildRows({ targets, actuals, level, drillPath, period, actualUnavailable = false }) {
    const actualByCode = new Map(actuals.map((row) => [row.code, row]));
    const baseRows = targets.map((target) => {
      const actual = actualUnavailable ? { actual: null, retained: null, cancelled: null, updatedAt: "" } : actualByCode.get(target.canonicalCode) || { actual: 0, retained: 0, cancelled: 0, updatedAt: "" };
      actualByCode.delete(target.canonicalCode);
      return finalizeRow({ ...target, actual: actual.actual, retained: actual.retained, cancelled: actual.cancelled, updatedAt: actual.updatedAt, stores: [target] }, period);
    });
    const anomalies = [];
    const actualOnlyRows = applyDrill([...actualByCode.values()], drillPath);
    actualOnlyRows.forEach((actual) => anomalies.push({ anomalyType: "unconfigured_actual", originalCode: actual.originalCode || actual.code, canonicalCode: actual.canonicalCode || actual.code, dealerName: actual.name || "", target: 0, actual: actual.actual, reason: "实际有目标无", handling: "actual_only_in_summary" }));
    return { rows: aggregate(applyDrill(baseRows, drillPath), level, period), anomalies, unconfiguredActual: actualOnlyRows.reduce((sum, row) => sum + row.actual, 0) };
  }

  function finalizeRow(row, period) {
    if (row.actual == null) return { ...row, achievementActual: null, achievementRate: null, gapToExpected: null, status: "数据暂不可用" };
    const achievementActual = row.actual;
    const gap = row.target === 0 ? 0 : Math.max(0, row.target * period.progress - achievementActual);
    const status = row.target === 0 ? "零目标" : gap > 0 ? "落后" : "领先";
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
      const current = groups.get(key.code) || { code: key.code, name: key.name, level, target: 0, actual: 0, achievementActual: 0, retained: 0, cancelled: 0, stores: [], updatedAt: "" };
      current.target += row.target;
      current.actual = row.actual == null || current.actual == null ? null : current.actual + row.actual;
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

  function summarize(rows, unconfiguredActual, period, actualUnavailable = false, scopeMode = "") {
    const target = rows.reduce((sum, row) => sum + row.target, 0);
    if (actualUnavailable) return { target, actual: null, achievementActual: null, achievementRate: null, progressText: period.progressText, laggingCount: null, ownStatus: "数据暂不可用", scopeMode, dataUpdatedAt: "" };
    const actual = rows.reduce((sum, row) => sum + row.actual, 0) + unconfiguredActual;
    const achievementActual = rows.reduce((sum, row) => sum + row.achievementActual, 0);
    const own = rows[0]?.status || "数据暂不可用";
    return { target, actual, achievementActual, achievementRate: target > 0 ? achievementActual / target : null, progressText: period.progressText, laggingCount: scopeMode === "own_store" ? 0 : rows.filter((row) => row.gapToExpected > 0).length, ownStatus: own, scopeMode, dataUpdatedAt: rows.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) || "" };
  }

  function buildSmallOrderReport(raw, viewState = {}) {
    if (!raw || raw.status !== "ready") return { status: raw?.status || "target_unavailable", error: raw?.error || "小订目标暂不可用", summary: null, rows: [], anomalies: [], period: raw?.period || periodInfo() };
    const mapped = normalizeTargets(raw.targetRows || [], raw.organizationRows || []);
    const audit = auditTargets(raw.targetRows || [], mapped, raw.config);
    if (raw.enforceTargetContract === true && !audit.contractOk) return { status: "data_incomplete", error: audit.contractError, summary: null, rows: [], anomalies: mapped.anomalies.map((item) => normalizeAnomaly(item, raw.period)), period: raw.period, audit };
    const scope = permissionScope(raw);
    if (!scope.ok) return { status: "no_permission", error: scope.reason, summary: null, rows: [], anomalies: mapped.anomalies.map((item) => normalizeAnomaly(item, raw.period)), period: raw.period, audit };
    const upstream = upstreamScope(raw.params || raw.identity?.params || {});
    const targets = visibleTargets(mapped.targets, scope, upstream);
    const actualUnavailable = raw.actualStatus === "actual_unavailable";
    const actualMapping = raw.period.actualRange && !actualUnavailable ? mapActuals(raw.actualRows || [], mapped.orgs || []) : { actuals: [], anomalies: [] };
    const actuals = actualMapping.actuals.filter((row) => inPermission(row, scope) && inUpstream(row, upstream));
    const level = viewState.viewLevel || raw.entryLevel || "area";
    const built = buildRows({ targets, actuals, level, drillPath: viewState.drillPath || [], period: raw.period, actualUnavailable });
    const zeroTarget = actualUnavailable ? [] : built.rows.flatMap((row) => row.stores || []).filter((row) => row.target === 0 && row.actual > 0).map((row) => ({ anomalyType: "zero_target_actual", originalCode: row.originalCode, canonicalCode: row.canonicalCode, dealerName: row.name, target: row.target, actual: row.actual, reason: "零目标有实际", handling: "actual_in_summary_and_parent_achievement" }));
    const rows = built.rows;
    const status = rows.length ? (actualUnavailable ? "partial" : "ready") : "empty";
    return {
      status,
      error: status === "empty" ? "当前范围暂无 MG 07 小订战报数据" : "",
      period: raw.period,
      identity: raw.identity,
      viewLevel: level,
      nextLevel: nextLevel(level),
      summary: { ...summarize(rows, built.unconfiguredActual, raw.period, actualUnavailable, scopeMode(raw, upstream, targets)), actualStatus: raw.actualStatus || "ready", actualError: raw.actualError || "" },
      rows,
      anomalies: [...mapped.anomalies, ...actualMapping.anomalies, ...built.anomalies, ...zeroTarget].map((item) => normalizeAnomaly(item, raw.period)),
      audit: { ...audit, visibleRows: targets.length }
    };
  }

  function scopeMode(raw, upstream, targets) {
    if (upstream?.mode === "code") return "own_store";
    if ((raw.validDealers || []).length === 1 && targets.length === 1) return "own_store";
    return "store_list";
  }

  root.SmallOrderModel = { periodInfo, buildSmallOrderReport };
  if (root.__SMALL_ORDER_TEST__ === true) root.SmallOrderModel.__test = { normalizeTargets, normalizeActuals, buildSmallOrderReport, periodInfo, normalizeOrg };
})(typeof window !== "undefined" ? window : globalThis);
