(function (root) {
  const ALL = "全部";
  const FORBIDDEN_SCOPE_NAMES = new Set([
    "总部", "销售总监", "投资人", "大区", "小区", "门店",
    "未知", "未知组织", "未知角色", "未知大区", "未知小区", "未知门店",
    "总部-门店", "总部 - 门店", "大区-小区", "大区 - 小区"
  ]);

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function specific(value) {
    const valueText = text(value);
    return valueText && valueText !== ALL ? valueText : "";
  }

  function trustedName(value) {
    const valueText = specific(value);
    return valueText && !FORBIDDEN_SCOPE_NAMES.has(valueText) ? valueText : "";
  }

  function applyDrillPath(rows, drillPath) {
    return (rows || []).filter((row) => (drillPath || []).every((item) => {
      if (item.level === "area") return item.code ? text(row.areaCode) === text(item.code) : text(row.area) === text(item.name);
      if (item.level === "district") return item.code ? text(row.districtCode) === text(item.code) : text(row.district) === text(item.name);
      return true;
    }));
  }

  function uniqueName(rows, nameKey, codeKey, selectedCode = "") {
    const code = specific(selectedCode);
    const candidates = code ? rows.filter((row) => text(row[codeKey]) === code) : rows;
    const names = [...new Set(candidates.map((row) => trustedName(row[nameKey])).filter(Boolean))];
    const identities = new Set(candidates.map((row) => text(row[codeKey]) || text(row[nameKey])).filter(Boolean));
    return identities.size === 1 && names.length === 1 ? names[0] : "";
  }

  function lastPathItem(drillPath, level) {
    return [...(drillPath || [])].reverse().find((item) => item.level === level);
  }

  function resolveActualScope({ params = {}, drillPath = [], stores = [], fallbackStores = [] } = {}) {
    const sourceRows = stores.length ? stores : fallbackStores;
    const areaPath = lastPathItem(drillPath, "area");
    const districtPath = lastPathItem(drillPath, "district");
    const areaCode = specific(areaPath?.code) || specific(params.areaCode);
    const districtCode = specific(districtPath?.code) || specific(params.districtCode);
    const dealerCode = specific(params.dealerCode);
    const codeFilteredRows = sourceRows.filter((row) => (!areaCode || text(row.areaCode) === areaCode)
      && (!districtCode || text(row.districtCode) === districtCode)
      && (!dealerCode || text(row.code) === dealerCode));
    const effectiveRows = applyDrillPath(codeFilteredRows, drillPath);
    if ((areaCode || districtCode || dealerCode) && !effectiveRows.length) return { text: "", areaName: "", districtName: "" };
    const areaName = trustedName(areaPath?.name)
      || trustedName(params.area)
      || uniqueName(effectiveRows, "area", "areaCode", areaCode);
    if (!areaName) return { text: "", areaName: "", districtName: "" };
    const districtName = trustedName(districtPath?.name)
      || trustedName(params.district)
      || uniqueName(effectiveRows, "district", "districtCode", districtCode);
    return {
      text: districtName ? `${areaName} - ${districtName}` : areaName,
      areaName,
      districtName
    };
  }

  root.OrganizationScope = { FORBIDDEN_SCOPE_NAMES, resolveActualScope };
})(typeof window !== "undefined" ? window : globalThis);
