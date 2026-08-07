(function () {
  const VEHICLE_ALL = window.RetailVehicleSeries?.ALL || "全部车系";

  function readVehicleSeriesParams(search) {
    const primary = search.getAll("vehicleSeries");
    const aliases = [...search.getAll("carSeries"), ...search.getAll("series")];
    return window.RetailVehicleSeries?.normalizeVehicleSeriesSelection(primary.length ? primary : aliases) || [];
  }

  function readRetailParams(allValue) {
    const search = new URLSearchParams(window.location.search);
    const theme = search.get("theme") === "dark" ? "dark" : "light";
    const previewMode = search.get("previewMode") === "dark" ? "dark" : theme;
    const fromApp = cleanParam(search.get("fromApp"));
    const dateRange = defaultDateRange();
    const dealerShortName = cleanParam(search.get("dealerShortName"));
    const dealer = cleanParam(search.get("dealer"));
    const rawDealerCode = cleanParam(search.get("dealerCode")) || cleanParam(search.get("storeCode"));
    const dealerCompanyCode = cleanParam(search.get("dealerCompanyCode"));
    const store = dealerShortName || dealer || cleanParam(search.get("store")) || allValue;
    return {
      period: search.get("period") || "自定义",
      startDate: normalizeDate(search.get("startDate") || search.get("dateStart")) || dateRange.startDate,
      endDate: normalizeDate(search.get("endDate") || search.get("dateEnd")) || dateRange.endDate,
      brand: cleanParam(search.get("brand")) || allValue,
      brandCode: cleanParam(search.get("brandCode")),
      area: cleanParam(search.get("region")) || cleanParam(search.get("area")) || allValue,
      areaCode: cleanParam(search.get("regionCode")) || cleanParam(search.get("areaCode")),
      district: cleanParam(search.get("district")) || allValue,
      districtCode: cleanParam(search.get("districtCode")),
      dealer,
      dealerCode: dealerCompanyCode || rawDealerCode,
      vehicleSeries: readVehicleSeriesParams(search),
      dealerCompanyCode,
      rawDealerCode,
      dealerShortName,
      store,
      theme,
      previewMode,
      fromApp,
      embeddedMode: fromApp === "smartRetail-main",
      userId: search.get("userId") || "",
      loginId: search.get("loginId") || "",
      userName: search.get("userName") || "",
      department: search.get("department") || "",
      role: search.get("role") || "小区经理"
    };
  }

  function cleanParam(value) {
    const text = String(value || "").trim();
    return text && text !== "全部" ? text : "";
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function formatDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function normalizeDate(value) {
    const matched = String(value || "").match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    return matched ? `${matched[1]}-${pad(matched[2])}-${pad(matched[3])}` : "";
  }

  function defaultDateRange(today = new Date()) {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }

  function matchParam(value, filter) {
    return !filter || filter === "全部" || value === filter;
  }

  function rate(numerator, denominator) {
    return denominator > 0 ? (numerator / denominator) * 100 : null;
  }

  function pct(value, digits = 1) {
    return value === null || Number.isNaN(value) ? "--" : `${value.toFixed(digits)}%`;
  }

  function signed(value, suffix = "%") {
    if (value === null || Number.isNaN(value)) return "--";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}${suffix}`;
  }

  function deltaPercent(current, previous) {
    return previous > 0 ? ((current - previous) / previous) * 100 : null;
  }

  function avg(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function emptyHtml(text) {
    return `<div class="empty">${text}</div>`;
  }

  function buildSingleStoreLink(params, store) {
    if (!store) return "#";
    const area = store.area || params.area || "";
    const district = store.district || params.district || "";
    const dealer = store.name || params.store || "";
    const dealerCode = store.code || "";
    const query = new URLSearchParams(Object.entries({
      source: "region-workbench",
      sourceApp: "multi-store-workbench",
      sourceModule: "store-sales-list",
      period: params.period || "自定义",
      startDate: params.startDate,
      endDate: params.endDate,
      brand: params.brand && params.brand !== "全部" ? params.brand : "MG",
      brandCode: params.brandCode,
      region: area,
      regionCode: store.areaCode || params.areaCode,
      area,
      district,
      districtCode: store.districtCode || params.districtCode,
      dealer,
      dealerShortName: dealer,
      store: dealer,
      dealerCode,
      dealerCompanyCode: dealerCode,
      storeCode: dealerCode,
      theme: params.previewMode || params.theme || "light",
      previewMode: params.previewMode || params.theme || "light"
    }).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    (window.RetailVehicleSeries?.normalizeVehicleSeriesSelection(params.vehicleSeries) || [])
      .forEach((series) => query.append("vehicleSeries", series));
    const singleStoreAppUrl = window.RetailRuntimeConfig?.getSingleStoreAppUrl?.();
    if (!singleStoreAppUrl) return "#";
    return `${singleStoreAppUrl}?${query.toString()}`;
  }

  window.RetailUtils = {
    readRetailParams, matchParam, rate, pct, signed,
    deltaPercent, avg, emptyHtml, buildSingleStoreLink, defaultDateRange
  };
})();
