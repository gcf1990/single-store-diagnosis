(function (root) {
  const CONFIG = Object.freeze({
    schemaVersion: 1,
    configVersion: "2026-07-15.1",
    sourceDsId: "a310ff90fddff4b6283841c6",
    sourceUpdatedAt: "2026-07-15 05:30:07+0800",
    validThrough: "2026-08-15",
    filters: Object.freeze({
      openStatus: Object.freeze({ field: "开业状态名称", value: "开业" }),
      secondaryDealer: Object.freeze({ field: "是否二网经销商", value: "否" }),
      officialName: Object.freeze({ field: "官网显示名称", requireNonEmpty: true }),
      excludedAreaNames: Object.freeze(["其它"])
    }),
    brands: Object.freeze({
      MG: Object.freeze({ areaCodes: Object.freeze(["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"]) }),
      "荣威": Object.freeze({ areaCodes: Object.freeze(["SQR400", "SQRR30", "SQRW10", "SQRW20", "SQRW30", "SQRW40", "SQRW50", "SQRW60", "SQRW70"]) })
    })
  });

  function text(value) { return value == null ? "" : String(value).trim(); }

  function getBrandScope(brand, config = CONFIG) {
    const value = text(brand);
    return value ? config?.brands?.[value] || null : null;
  }

  function getBrandAreaCodes(brand, config = CONFIG) {
    const areaCodes = getBrandScope(brand, config)?.areaCodes;
    return Array.isArray(areaCodes) ? areaCodes.map(text).filter(Boolean) : null;
  }

  function isConfigFresh(config = CONFIG, currentDate = new Date()) {
    const validThrough = text(config?.validThrough);
    const now = new Date(currentDate).getTime();
    const deadline = Date.parse(`${validThrough}T23:59:59.999+08:00`);
    return Boolean(validThrough) && Number.isFinite(now) && Number.isFinite(deadline) && now <= deadline;
  }

  function specific(value) { const valueText = text(value); return Boolean(valueText && valueText !== "全部"); }

  function evaluateNationalScopeEvidence({ roleResult, params = {}, dealerEvidence, salesEvidence, validDealers = [], salesRows = [], nationalScopeConfig, currentDate }) {
    const noOrgFilter = ![params.areaCode, params.districtCode, params.dealerCode].some(specific)
      && ![params.area, params.district, params.store].some(specific);
    if (roleResult?.role !== "headquarters" || !roleResult.ok || !noOrgFilter || !nationalScopeConfig) return false;
    if (!isConfigFresh(nationalScopeConfig, currentDate || new Date())) return false;
    const brand = specific(params.brand) ? text(params.brand) : "MG";
    const configuredAreas = getBrandAreaCodes(brand, nationalScopeConfig);
    if (!configuredAreas?.length || new Set(configuredAreas).size !== configuredAreas.length) return false;
    if (!dealerEvidence || dealerEvidence.sourceDsId !== nationalScopeConfig.sourceDsId || dealerEvidence.hitLimit || dealerEvidence.complete !== true) return false;
    if (!salesEvidence || salesEvidence.source !== "aggregate-sql" || salesEvidence.hitLimit || salesEvidence.complete !== true) return false;
    if (!validDealers.length || validDealers.some((dealer) => !text(dealer.code) || !text(dealer.areaCode) || !text(dealer.area) || !text(dealer.districtCode) || !text(dealer.district))) return false;
    const configuredAreaSet = new Set(configuredAreas);
    const excludedAreaNames = new Set((nationalScopeConfig.filters?.excludedAreaNames || []).map(text));
    if (validDealers.some((dealer) => !configuredAreaSet.has(text(dealer.areaCode)) || excludedAreaNames.has(text(dealer.area)))) return false;
    const dealerByCode = new Map(validDealers.map((dealer) => [text(dealer.code), dealer]));
    const authorizedAreas = new Set(validDealers.map((dealer) => text(dealer.areaCode)));
    const factAreas = new Set(salesRows.map((row) => dealerByCode.get(text(row["经销商代码"] || row.code))?.areaCode).map(text).filter(Boolean));
    return authorizedAreas.size === configuredAreaSet.size
      && [...configuredAreaSet].every((areaCode) => authorizedAreas.has(areaCode) && factAreas.has(areaCode));
  }

  root.RetailNationalScope = { CONFIG, getBrandScope, getBrandAreaCodes, isConfigFresh, evaluateNationalScopeEvidence };
})(typeof window !== "undefined" ? window : globalThis);
