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

  function parseTargetValue(row) {
    const valueText = text(row?.MG07小订目标);
    if (!/^\d+$/.test(valueText)) return { ok: false, value: 0, reason: "目标配置不是非负整数" };
    return { ok: true, value: Number(valueText), reason: "" };
  }

  function targetValue(row) {
    const parsed = parseTargetValue(row);
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.value;
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
      const parsedTarget = parseTargetValue(row);
      const base = {
        sourceRowNumber: index + 1,
        originalCode: rawCode,
        dealerShortName: text(row["经销商简称"]) || rawCode,
        sourceArea: text(row["区域"]),
        sourceMac: text(row.MAC),
        target: parsedTarget.value
      };
      if (!parsedTarget.ok) {
        anomalies.push({ anomalyType: "target_invalid", originalCode: rawCode, canonicalCode: rawCode, dealerName: base.dealerShortName, target: 0, actual: 0, reason: parsedTarget.reason, handling: "fail-closed" });
        return;
      }
      const exact = rawCode === "MQ257T" ? [] : uniqueCanonical(disambiguate(byCode.get(rawCode) || [], base));
      const fallback = exact.length ? exact : uniqueCanonical(matchByText(orgs, base));
      if (fallback.length !== 1) {
        anomalies.push({ anomalyType: "organization_unmapped", originalCode: rawCode, canonicalCode: "", dealerName: base.dealerShortName, target: base.target, actual: 0, reason: fallback.length > 1 ? "目标门店匹配到多个权威门店" : "目标门店无法匹配权威门店", handling: "source_in_summary_unassigned_to_drilldown" });
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
        anomalies.push({ anomalyType: "organization_unmapped", originalCode: row.code, canonicalCode: "", candidateCanonicalCodes: candidates.map((item) => item.code).filter(Boolean), dealerName: candidates[0]?.name || "", target: 0, actual: row.actual, reason: candidates.length > 1 ? "实际权威维表多命中" : "实际权威维表0命中", handling: "fail-closed" });
        return;
      }
      const org = candidates[0];
      actuals.push({ ...row, code: org.code, originalCode: row.code, canonicalCode: org.code, name: org.name, areaCode: org.areaCode, area: org.area, areaShortName: org.areaShortName, districtCode: org.districtCode, district: org.district, districtShortName: org.districtShortName });
    });
    return { actuals, anomalies };
  }

  function permissionScope(raw) {
    if (raw.adminAuditTargets === true) return { ok: true, reason: "", codes: null, areaCodes: null, districtCodes: null, dealerEvidence: new Map(), nationalComplete: raw.nationalComplete === true, mode: "all" };
    const validDealers = raw.validDealers || [];
    const authorityRows = validDealers.map((row) => ({
      code: text(row.parentDealerCode || row.parent_dealer_code || row.parentDealerCompanyCode || row.parentCompanyCode || row.dealerCompanyCode || row.code || row.dealerCode),
      leafCode: text(row.code || row.dealerCode || row.dealer_code),
      name: text(pick(row, ["name", "dealerName", "dealerShortName", "store", "storeName"])),
      areaCode: text(row.areaCode || row.rfsCode),
      area: text(pick(row, ["area", "areaName", "areaShortName"])),
      districtCode: text(row.districtCode || row.macCode),
      district: text(pick(row, ["district", "districtName", "districtShortName"]))
    })).filter((row) => row.code);
    const codes = new Set(authorityRows.map((row) => row.code));
    const areaCodes = new Set(authorityRows.map((row) => row.areaCode).filter(Boolean));
    const districtCodes = new Set(authorityRows.map((row) => row.districtCode).filter(Boolean));
    const dealerEvidence = new Map();
    authorityRows.forEach((row) => {
      const code = text(row.code);
      if (!code) return;
      const evidence = {
        code,
        name: row.name,
        areaCode: text(row.areaCode),
        area: row.area,
        districtCode: text(row.districtCode),
        district: row.district
      };
      dealerEvidence.set(code, [...(dealerEvidence.get(code) || []), evidence]);
      if (row.leafCode && row.leafCode !== code) dealerEvidence.set(row.leafCode, [...(dealerEvidence.get(row.leafCode) || []), { ...evidence, code: row.leafCode, canonicalCode: code }]);
    });
    if (!codes.size) return { ok: false, reason: "小订顶部范围为空", codes, areaCodes, districtCodes, mode: "none" };
    return { ok: true, reason: "", codes, areaCodes, districtCodes, dealerEvidence, mode: "top_scope" };
  }

  function inPermission(row, scope) {
    if (scope.mode === "all") return true;
    if (scope.codes?.has(text(row.canonicalCode || row.code))) return true;
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

  function inSourceRowScope(row, upstream, dealerEvidence) {
    const rawCode = text(row?.["一级经销商"]);
    if (!rawCode) return false;
    if (!upstream || upstream.mode === "all") return true;
    const sourceArea = text(row?.["区域"]);
    const sourceMac = text(row?.MAC);
    const sourceDealerName = text(row?.["经销商简称"]);
    if (upstream.mode === "area") {
      if ([upstream.name, upstream.code].map(text).filter(Boolean).includes(sourceArea)) return true;
      if (sourceNamesFromDealerEvidence(dealerEvidence, upstream).areas.has(sourceArea)) return true;
      return [rawCode, ...canonicalScopeCandidateCodes(rawCode)].some((code) => validDealerEvidenceInUpstream(dealerEvidence?.get(code) || [], upstream));
    }
    if (upstream.mode === "district") {
      if ([upstream.name, upstream.code].map(text).filter(Boolean).includes(sourceMac)) return true;
      if (sourceNamesFromDealerEvidence(dealerEvidence, upstream).districts.has(sourceMac)) return true;
      return [rawCode, ...canonicalScopeCandidateCodes(rawCode)].some((code) => validDealerEvidenceInUpstream(dealerEvidence?.get(code) || [], upstream));
    }
    if (upstream.mode === "code") {
      const candidateCodes = [rawCode, ...canonicalScopeCandidateCodes(rawCode)];
      const upstreamCode = text(upstream.code);
      const upstreamName = text(upstream.name);
      if (upstreamCode && candidateCodes.includes(upstreamCode)) return true;
      if (upstreamName && [sourceDealerName, rawCode, ...candidateCodes].includes(upstreamName)) return true;
      return candidateCodes.some((code) => validDealerEvidenceInUpstream(dealerEvidence?.get(code) || [], upstream));
    }
    return false;
  }

  function sourceNamesFromDealerEvidence(dealerEvidence, upstream) {
    const rows = [];
    if (dealerEvidence?.values) {
      Array.from(dealerEvidence.values()).forEach((items) => {
        (items || []).forEach((row) => {
          if (validDealerEvidenceInUpstream([row], upstream)) rows.push(row);
        });
      });
    }
    return {
      areas: new Set(rows.map((row) => text(row.area)).filter(Boolean)),
      districts: new Set(rows.map((row) => text(row.district)).filter(Boolean))
    };
  }

  function targetSourceRowsInSourceScope(sourceRows, upstream, dealerEvidence) {
    return (sourceRows || []).filter((row) => inSourceRowScope(row, upstream, dealerEvidence));
  }

  function targetSourceRowsInScope(sourceRows, orgRows, scope, upstream) {
    if (!scope.ok) return [];
    if (scope.mode === "all") return sourceRows || [];
    const orgs = (orgRows || []).map(normalizeOrg).filter((row) => row.brand === "MG" && row.code);
    const byCode = buildOrgIndex(orgs);
    return (sourceRows || []).filter((row) => {
      const rawCode = text(row?.["一级经销商"]);
      if (!rawCode) return false;
      const base = {
        originalCode: rawCode,
        dealerShortName: text(row?.["经销商简称"]) || rawCode,
        sourceArea: text(row?.["区域"]),
        sourceMac: text(row?.MAC)
      };
      const exact = rawCode === "MQ257T" ? [] : uniqueCanonical(disambiguate(byCode.get(rawCode) || [], base));
      const fallback = exact.length ? exact : uniqueCanonical(matchByText(orgs, base));
      if (fallback.length) return fallback.some((org) => inPermission(org, scope) && inUpstream(org, upstream));
      return [rawCode, ...canonicalScopeCandidateCodes(rawCode)].some((code) => validDealerEvidenceInUpstream(scope.dealerEvidence?.get(code) || [], upstream));
    });
  }

  function duplicateSourceRows(sourceRows) {
    const seen = new Set();
    let duplicates = 0;
    (sourceRows || []).forEach((row) => {
      const rawCode = text(row?.["一级经销商"]);
      if (!rawCode) return;
      const key = canonicalScopeCandidateCodes(rawCode)[0] || rawCode;
      if (seen.has(key)) duplicates += 1;
      else seen.add(key);
    });
    return duplicates;
  }

  function canonicalScopeCandidateCodes(rawCode) {
    if (text(rawCode) === "MQ257T") return ["MQ256T"];
    return [];
  }

  function validDealerEvidenceInUpstream(evidenceRows, upstream) {
    if (!evidenceRows.length) return false;
    if (!upstream || upstream.mode === "all") return true;
    if (upstream.mode === "area") return evidenceRows.some((row) => (upstream.code && text(row.areaCode) === upstream.code) || (upstream.name && text(row.area) === upstream.name));
    if (upstream.mode === "district") return evidenceRows.some((row) => (upstream.code && text(row.districtCode) === upstream.code) || (upstream.name && text(row.district) === upstream.name));
    if (upstream.mode === "code") return evidenceRows.some((row) => (upstream.code && text(row.code) === upstream.code) || (upstream.name && text(row.name) === upstream.name));
    return false;
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
      dataUpdatedAt: text(item.dataUpdatedAt),
      periodStart: text(period?.actualRange?.startDate || period?.startDate || root.SmallOrderConfig?.PERIOD?.startDate),
      periodEnd: text(period?.actualRange?.endDate || period?.endDate || root.SmallOrderConfig?.PERIOD?.endDate),
      reason: text(item.reason),
      handling: text(item.handling)
    };
  }

  function auditUnassignedRow(row) {
    return {
      originalCode: text(row.originalCode),
      canonicalCode: text(row.canonicalCode),
      dealerName: text(row.dealerName),
      target: number(row.target),
      reason: text(row.reason),
      summaryIncluded: true,
      drilldownAttributionStatus: "unassigned",
      handling: "source_in_summary_unassigned_to_drilldown"
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
    const sourceTargetTotal = sourceRows
      .filter((row) => text(row?.["一级经销商"]))
      .map((row) => parseTargetValue(row))
      .reduce((sum, row) => sum + row.value, 0);
    const assignedTargetTotal = mapped.targets.reduce((sum, row) => sum + row.target, 0);
    const unassignedRows = mapped.anomalies.filter((item) => item.anomalyType === "organization_unmapped");
    const audit = {
      sourceRows: sourceRows.length,
      summaryRows: mapped.summaryRows,
      configuredRows: mapped.targets.length,
      sourceUniqueCodes: new Set(sourceCodes).size,
      canonicalUniqueCodes: new Set(mapped.targets.map((row) => row.canonicalCode).filter(Boolean)).size,
      targetTotal: assignedTargetTotal,
      sourceTargetTotal,
      assignedTargetTotal,
      unassignedTargetTotal: unassignedRows.reduce((sum, row) => sum + number(row.target), 0),
      unassignedRows: unassignedRows.map(auditUnassignedRow),
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

  function auditScopedTargets(sourceRows, mapped, targets) {
    const scopeSourceRows = (sourceRows || []).filter((row) => text(row?.["一级经销商"])).length;
    const scopedParsedTargets = (sourceRows || []).filter((row) => text(row?.["一级经销商"])).map((row) => parseTargetValue(row));
    const scopeSourceTargetTotal = scopedParsedTargets.reduce((sum, row) => sum + row.value, 0);
    const invalidTargetRows = scopedParsedTargets.filter((row) => !row.ok).length;
    const scopeMappedRows = mapped.targets.length;
    const scopeMappedTargetTotal = mapped.targets.reduce((sum, row) => sum + row.target, 0);
    const scopeUniqueDealerCount = new Set(mapped.targets.map((row) => row.canonicalCode).filter(Boolean)).size;
    const scopeTargetTotal = (targets || []).reduce((sum, row) => sum + row.target, 0);
    const scopeUnmapped = mapped.anomalies.filter((item) => item.anomalyType === "organization_unmapped").length;
    const duplicateTargetRows = Math.max(0, scopeMappedRows - scopeUniqueDealerCount);
    const scopeUnmappedTargetTotal = mapped.anomalies.filter((item) => item.anomalyType === "organization_unmapped").reduce((sum, row) => sum + number(row.target), 0);
    const sourceDuplicateTargetRows = duplicateSourceRows(sourceRows);
    const audit = {
      scopeSourceRows,
      scopeMappedRows,
      scopeSourceTargetTotal,
      scopeMappedTargetTotal,
      scopeUniqueDealerCount,
      scopeTargetTotal,
      sourceTargetTotal: scopeSourceTargetTotal,
      assignedTargetTotal: scopeMappedTargetTotal,
      unassignedTargetTotal: scopeUnmappedTargetTotal,
      unassignedRows: mapped.anomalies.filter((item) => item.anomalyType === "organization_unmapped").map(auditUnassignedRow),
      scopeUnmapped,
      scopeUnmappedTargetTotal,
      invalidTargetRows,
      duplicateTargetRows,
      sourceDuplicateTargetRows
    };
    const checks = [
      ["invalidTargetRows", audit.invalidTargetRows === 0],
      ["duplicateTargetRows", audit.duplicateTargetRows === 0 && audit.sourceDuplicateTargetRows === 0]
    ];
    audit.contractOk = checks.every(([, ok]) => ok);
    const failedKeys = checks.filter(([, ok]) => !ok).map(([key]) => key);
    if (audit.contractOk) audit.contractError = "";
    else if (failedKeys.includes("duplicateTargetRows")) audit.contractError = "当前范围存在重复目标配置，小订战报数据暂不完整";
    else if (failedKeys.includes("invalidTargetRows")) audit.contractError = "当前范围存在无效目标配置，小订战报数据暂不完整";
    else audit.contractError = "当前范围目标配置不完整，小订战报数据暂不可用";
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
    targetSourceRowsInScope,
    canonicalScopeCandidateCodes,
    sourceNamesFromDealerEvidence,
    validDealerEvidenceInUpstream,
    inSourceRowScope,
    targetSourceRowsInSourceScope,
    applyDrill,
    normalizeAnomaly,
    auditTargets,
    auditScopedTargets,
    parseTargetValue
  };
})(typeof window !== "undefined" ? window : globalThis);
