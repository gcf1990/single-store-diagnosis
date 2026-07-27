(function (root) {
  function text(value) { return value == null ? "" : String(value).trim(); }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function pick(row, names) { return names.map((name) => row?.[name]).find((value) => text(value)) || ""; }

  function normalizeOrg(row) {
    const brand = pick(row, ["brand_name", "品牌名称", "品牌", "brand"]);
    const parentCode = text(pick(row, ["parent_dealer_code", "一级经销商代码", "父经销商代码"]));
    const dealerCode = text(pick(row, ["dealer_code", "经销商代码", "dealerCode", "code"]));
    const canonicalCode = parentCode || dealerCode;
    return {
      code: canonicalCode,
      dealerCode,
      parentCode,
      name: text(pick(row, ["parent_dealer_shortnm", "经销商简称", "父经销商简称", "dealer_shortnm", "经销商名称", "dealerName", "name"])),
      dealerShortName: text(pick(row, ["dealer_shortnm", "经销商简称", "parent_dealer_shortnm"])),
      areaCode: text(pick(row, ["rfs_code", "大区代码", "areaCode"])),
      area: text(pick(row, ["rfs_name", "大区名称", "大区", "area"])),
      areaShortName: text(pick(row, ["rfs_shortnm", "大区简称"])),
      districtCode: text(pick(row, ["mac_code", "小区代码", "MAC代码", "districtCode"])),
      district: text(pick(row, ["mac_name", "小区名称", "district"])),
      districtShortName: text(pick(row, ["mac_shortnm", "MAC", "MAC姓名", "小区简称"])),
      macName: text(pick(row, ["mac_shortnm", "MAC", "MAC姓名", "小区名称"])),
      brand,
      validPrimary: isValidPrimary(row)
    };
  }

  function isValidPrimary(row) {
    const statusText = text(pick(row, ["open_mec_stat_name", "开业状态名称", "开业状态", "门店状态", "状态", "状态名称"]));
    const networkText = text(pick(row, ["is_scd_net_dealer", "是否二网经销商", "是否二网", "二网标识", "网络类型"]));
    const officialName = text(pick(row, ["web_display_name", "官网显示名称", "official_name", "officialName"]));
    const areaCode = text(pick(row, ["rfs_code", "大区代码", "areaCode"]));
    const areaName = text(pick(row, ["rfs_shortnm", "大区简称"]));
    const mgAreaCodes = root.RetailNationalScope?.getBrandAreaCodes?.("MG") || ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"];
    const excludedAreaNames = root.RetailNationalScope?.CONFIG?.filters?.excludedAreaNames || ["其它"];
    return statusText === "开业" && networkText === "否" && Boolean(officialName) && mgAreaCodes.includes(areaCode) && !excludedAreaNames.includes(areaName);
  }

  function targetValue(row) {
    const valueText = text(row?.MG07小订目标);
    if (!/^\d+$/.test(valueText)) throw new Error(`目标源行号 ${row.__rowNumber || "--"} MG07小订目标 非非负整数`);
    return Number(valueText);
  }

  function normalizeTargets(rows, orgRows) {
    const orgs = orgRows.map(normalizeOrg).filter((row) => row.brand === "MG" && row.code);
    const byCode = buildOrgIndex(orgs);
    const mapped = [];
    const anomalies = [];
    let summaryRows = 0;
    rows.forEach((row, index) => {
      const rawCode = text(row["一级经销商"]);
      if (!rawCode) {
        summaryRows += 1;
        return;
      }
      const base = {
        sourceRowNumber: index + 1,
        originalCode: rawCode,
        dealerShortName: text(row["经销商简称"]) || rawCode,
        sourceArea: text(row["区域"]),
        sourceMac: text(row.MAC),
        target: targetValue({ ...row, __rowNumber: index + 1 })
      };
      const exact = rawCode === "MQ257T" ? [] : uniqueCanonical(disambiguate(byCode.get(rawCode) || [], base));
      const fallback = exact.length ? exact : uniqueCanonical(matchByText(orgs, base));
      if (fallback.length !== 1) {
        anomalies.push({ anomalyType: "organization_unmapped", originalCode: rawCode, canonicalCode: "", dealerName: base.dealerShortName, target: base.target, actual: 0, reason: fallback.length > 1 ? "权威维表多命中" : "权威维表0命中", handling: "fail-closed" });
        return;
      }
      const org = fallback[0];
      mapped.push({
        ...base,
        canonicalCode: org.code,
        code: org.code,
        name: org.name || base.dealerShortName,
        areaCode: org.areaCode,
        area: org.area,
        areaShortName: org.areaShortName,
        districtCode: org.districtCode,
        district: org.district,
        districtShortName: org.districtShortName,
        validPrimary: org.validPrimary,
        organizationMappingStatus: "mapped",
        organizationMappingSource: exact.length ? "code_exact" : "dealer_short_name_area_mac_unique",
        codeCorrectionNote: rawCode === org.code ? "" : "权威维表按经销商简称唯一命中"
      });
    });
    return { targets: mapped, anomalies, summaryRows, orgs };
  }

  function buildOrgIndex(orgs) {
    const byCode = new Map();
    orgs.forEach((row) => {
      [row.code, row.parentCode, row.dealerCode].filter(Boolean).forEach((code) => byCode.set(code, [...(byCode.get(code) || []), row]));
    });
    return byCode;
  }

  function matchByText(orgs, target) {
    const name = text(target.dealerShortName);
    const area = text(target.sourceArea);
    const mac = text(target.sourceMac);
    return orgs.filter((org) => text(org.name) === name && (!area || text(org.area) === area) && (!mac || text(org.macName) === mac));
  }

  function disambiguate(candidates, target) {
    if (candidates.length <= 1) return candidates;
    const area = text(target.sourceArea);
    const mac = text(target.sourceMac);
    const scoped = candidates.filter((org) => (!area || text(org.area) === area) && (!mac || text(org.macName) === mac));
    if (scoped.length && !scoped.some((org) => org.validPrimary) && candidates.some((org) => org.validPrimary)) return candidates;
    return scoped.length ? scoped : candidates;
  }

  function uniqueCanonical(candidates) {
    const byCanonical = new Map();
    candidates.forEach((org) => {
      const current = byCanonical.get(org.code);
      if (!current || (org.validPrimary && !current.validPrimary)) byCanonical.set(org.code, org);
    });
    return [...byCanonical.values()];
  }

  function normalizeActuals(rows) {
    return (rows || []).map((row) => ({
      code: text(row.dealer_code || row["一级经销商代码"]),
      actual: number(row.actual_small_order ?? row["当日首触小订数"]),
      retained: number(row.retained_small_order ?? row["当日首触留存小订数"]),
      cancelled: number(row.cancelled_small_order ?? row["当日首触小订退订数"]),
      updatedAt: text(row.data_updated_at || row["调度时间"])
    })).filter((row) => row.code);
  }

  function mapActuals(rows, orgs) {
    const byCode = buildOrgIndex(orgs || []);
    const actuals = [];
    const anomalies = [];
    normalizeActuals(rows).forEach((row) => {
      const candidates = uniqueCanonical(byCode.get(row.code) || []);
      if (candidates.length !== 1) {
        anomalies.push({ anomalyType: "organization_unmapped", originalCode: row.code, canonicalCode: "", dealerName: candidates[0]?.name || "", target: 0, actual: row.actual, reason: candidates.length > 1 ? "实际权威维表多命中" : "实际权威维表0命中", handling: "fail-closed" });
        return;
      }
      const org = candidates[0];
      actuals.push({ ...row, code: org.code, originalCode: row.code, canonicalCode: org.code, name: org.name, areaCode: org.areaCode, area: org.area, areaShortName: org.areaShortName, districtCode: org.districtCode, district: org.district, districtShortName: org.districtShortName });
    });
    return { actuals, anomalies };
  }

  function permissionScope(raw) {
    const role = raw.roleResult || {};
    if (role.ok !== true) return { ok: false, reason: "小订权限不可证", codes: new Set(), areaCodes: new Set(), districtCodes: new Set(), mode: "none" };
    if (role.role === "headquarters") return { ok: true, reason: "", codes: null, areaCodes: null, districtCodes: null, mode: "all" };
    const validDealers = raw.validDealers || [];
    const codes = new Set(validDealers.map((row) => text(row.code)).filter(Boolean));
    const areaCodes = new Set(validDealers.map((row) => text(row.areaCode)).filter(Boolean));
    const districtCodes = new Set(validDealers.map((row) => text(row.districtCode)).filter(Boolean));
    if (!codes.size && !areaCodes.size && !districtCodes.size) return { ok: false, reason: "小订权限范围为空", codes, areaCodes, districtCodes, mode: "none" };
    if (role.role === "region") return { ok: true, reason: "", codes, areaCodes, districtCodes, mode: "area" };
    if (role.role === "district") return { ok: true, reason: "", codes, areaCodes, districtCodes, mode: "district" };
    return { ok: codes.size > 0, reason: codes.size ? "" : "小订授权门店为空", codes, areaCodes, districtCodes, mode: "code" };
  }

  function inPermission(row, scope) {
    if (scope.mode === "all") return true;
    if (scope.mode === "area") return scope.areaCodes.has(text(row.areaCode));
    if (scope.mode === "district") return scope.districtCodes.has(text(row.districtCode));
    if (scope.mode === "code") return scope.codes.has(text(row.canonicalCode || row.code));
    return false;
  }

  function specific(value) {
    const valueText = text(value);
    return valueText && valueText !== "全部" && valueText !== "全部车系";
  }

  function upstreamScope(params = {}) {
    if (specific(params.dealerCode) || specific(params.store)) return { mode: "code", code: text(params.dealerCode), name: text(params.store) };
    if (specific(params.districtCode) || specific(params.district)) return { mode: "district", code: text(params.districtCode), name: text(params.district) };
    if (specific(params.areaCode) || specific(params.area)) return { mode: "area", code: text(params.areaCode), name: text(params.area) };
    return { mode: "all" };
  }

  function inUpstream(row, scope) {
    if (!scope || scope.mode === "all") return true;
    if (scope.mode === "area") return (scope.code && text(row.areaCode) === scope.code) || (scope.name && [row.area, row.areaShortName].map(text).includes(scope.name));
    if (scope.mode === "district") return (scope.code && text(row.districtCode) === scope.code) || (scope.name && [row.district, row.districtShortName].map(text).includes(scope.name));
    if (scope.mode === "code") return (scope.code && text(row.canonicalCode || row.code) === scope.code) || (scope.name && text(row.name || row.dealerShortName) === scope.name);
    return false;
  }

  function visibleTargets(targets, scope, upstream) {
    if (!scope.ok) return [];
    return targets.filter((row) => inPermission(row, scope) && inUpstream(row, upstream));
  }

  function applyDrill(rows, drillPath = []) {
    return rows.filter((row) => drillPath.every((item) => item.level === "area" ? text(row.areaCode || row.area) === text(item.code || item.name) : item.level === "district" ? text(row.districtCode || row.district) === text(item.code || item.name) : true));
  }

  function normalizeAnomaly(item, period) {
    return {
      anomalyType: text(item.anomalyType),
      originalCode: text(item.originalCode),
      canonicalCode: text(item.canonicalCode),
      dealerName: text(item.dealerName),
      target: number(item.target),
      actual: number(item.actual),
      periodStart: text(period?.actualRange?.startDate || period?.startDate || root.SmallOrderConfig?.PERIOD?.startDate),
      periodEnd: text(period?.actualRange?.endDate || period?.endDate || root.SmallOrderConfig?.PERIOD?.endDate),
      reason: text(item.reason),
      handling: text(item.handling)
    };
  }

  function auditTargets(sourceRows, mapped, config) {
    const qa = config?.qa || root.SmallOrderConfig.TARGET_QA;
    const zeroTargetRows = mapped.targets.filter((row) => row.target === 0).length;
    const sourceCodes = sourceRows.map((row) => text(row["一级经销商"])).filter(Boolean);
    const validPrimaryMissCodes = new Set(Object.keys(qa.validPrimaryMisses || {}));
    const specialRows = mapped.targets.filter((row) => row.validPrimary !== true || validPrimaryMissCodes.has(row.originalCode));
    const validPrimaryMissDetails = Object.fromEntries(specialRows.map((row) => [row.originalCode, row.target]));
    const validPrimaryMissDetailsMatch = specialRows.length === validPrimaryMissCodes.size
      && Object.entries(qa.validPrimaryMisses || {}).every(([code, target]) => validPrimaryMissDetails[code] === target)
      && Object.keys(validPrimaryMissDetails).every((code) => validPrimaryMissCodes.has(code));
    const audit = {
      sourceRows: sourceRows.length,
      summaryRows: mapped.summaryRows,
      configuredRows: mapped.targets.length,
      sourceUniqueCodes: new Set(sourceCodes).size,
      canonicalUniqueCodes: new Set(mapped.targets.map((row) => row.canonicalCode).filter(Boolean)).size,
      targetTotal: mapped.targets.reduce((sum, row) => sum + row.target, 0),
      zeroTargetRows,
      areaCount: new Set(mapped.targets.map((row) => row.areaCode || row.area).filter(Boolean)).size,
      unmappedRows: mapped.anomalies.filter((item) => item.anomalyType === "organization_unmapped").length,
      validPrimaryHits: mapped.targets.length - specialRows.length,
      specialStatusRows: specialRows.length,
      specialStatusTarget: specialRows.reduce((sum, row) => sum + row.target, 0),
      validPrimaryMissDetails,
      validPrimaryMissDetailsMatch,
      requiredCodesPresent: qa.requiredCodes.every((code) => mapped.targets.some((row) => row.originalCode === code || row.canonicalCode === code)),
      mq257tCorrected: mapped.targets.some((row) => row.originalCode === "MQ257T" && row.canonicalCode === "MQ256T")
    };
    const checks = [
      ["sourceRows", audit.sourceRows === qa.sourceRows],
      ["summaryRows", audit.summaryRows === 1],
      ["configuredRows", audit.configuredRows === qa.configuredRows],
      ["sourceUniqueCodes", audit.sourceUniqueCodes === qa.sourceUniqueCodes],
      ["canonicalUniqueCodes", audit.canonicalUniqueCodes === qa.canonicalUniqueCodes],
      ["targetTotal", audit.targetTotal === qa.targetTotal],
      ["zeroTargetRows", audit.zeroTargetRows === qa.zeroTargetRows],
      ["areaCount", audit.areaCount === qa.areaCount],
      ["unmappedRows", audit.unmappedRows === 0],
      ["validPrimaryHits", audit.validPrimaryHits === qa.validPrimaryHits],
      ["specialStatusRows", audit.specialStatusRows === qa.specialStatusRows],
      ["specialStatusTarget", audit.specialStatusTarget === qa.specialStatusTarget],
      ["validPrimaryMissDetailsMatch", audit.validPrimaryMissDetailsMatch],
      ["requiredCodesPresent", audit.requiredCodesPresent],
      ["mq257tCorrected", audit.mq257tCorrected]
    ];
    audit.contractOk = checks.every(([, ok]) => ok);
    audit.contractError = audit.contractOk ? "" : `小订目标合同不守恒：${checks.filter(([, ok]) => !ok).map(([key]) => key).join("、")}`;
    return audit;
  }

  root.SmallOrderContract = {
    text,
    number,
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
  };
})(typeof window !== "undefined" ? window : globalThis);
