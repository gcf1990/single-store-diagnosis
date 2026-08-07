(function () {
  const APP_CODE = "multip-stores";

  function safeText(value) {
    return value == null ? "" : String(value).trim();
  }

  function readPersonnelProfile() {
    return window.OrganizationView?.readPersonnelProfile()?.profile || {};
  }

  window.trackRetailView = function trackRetailView(params, stores, allValue) {
    const profile = readPersonnelProfile();
    const storeOrgCodes = stores.map((store) => store.code).slice(0, 5).join(",");
    const vehicleSeries = window.RetailVehicleSeries?.normalizeVehicleSeriesSelection(params.vehicleSeries) || [];
    const vehicleSeriesText = window.RetailVehicleSeries?.vehicleSeriesTrackingValue(vehicleSeries) || "全部车系";
    const payload = {
      trackId: "smartmind_sale_View",
      app_code: APP_CODE,
      pageAction: 0,
      pageName: "零售过程-多店销售诊断",
      eventTime: Date.now(),
      personId: safeText(profile.marketing_id) || safeText(profile.luopan_id) || safeText(params.userId) || safeText(params.loginId),
      personName: safeText(profile.luopan_name) || safeText(params.userName),
      McharacterName: safeText(profile.marketing_roleNames) || safeText(profile.marketing_roleCodes) || safeText(profile.luopan_role) || safeText(params.role),
      OrgName: safeText(profile.marketing_orgName) || safeText(profile.luopan_position) || safeText(params.department),
      RegionName: params.area === allValue ? "" : params.area,
      SubRegionName: params.district === allValue ? "" : params.district,
      OrgCode: safeText(profile.marketing_orgCode) || safeText(profile.luopan_orgCode) || safeText(profile.marketing_companyCode) || storeOrgCodes,
      vehicleSeries: vehicleSeriesText,
      vehicleSeriesCount: vehicleSeries.length
    };
    window.__retailGioEvent = payload;
    if (typeof window.gio === "function") {
      window.gio("track", "smartmind_sale_View", {
        app_code: payload.app_code,
        pageAction: String(payload.pageAction),
        pageName: payload.pageName,
        eventTime: String(payload.eventTime),
        personId: payload.personId || "",
        personName: payload.personName || "",
        McharacterName: payload.McharacterName || "",
        OrgName: payload.OrgName || "",
        RegionName: payload.RegionName || "",
        SubRegionName: payload.SubRegionName || "",
        OrgCode: payload.OrgCode || "",
        vehicleSeries: payload.vehicleSeries,
        vehicleSeriesCount: String(payload.vehicleSeriesCount)
      });
    }
  };
})();
