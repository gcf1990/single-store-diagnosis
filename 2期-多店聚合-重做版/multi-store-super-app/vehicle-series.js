(function () {
  const ALL = "全部车系";
  const TOP = ["全新MG4", "MG 4X", "MG 07"];
  const BOTTOM = ["其他车系", "未知车系", "位置车系"];
  function clean(value) { return String(value || "").trim(); }
  // 与一期 super-app/src/services/storeDiagnosis.ts 的 compareVehicleSeriesOptions 保持同构。
  function compareVehicleSeriesOptions(left, right) {
    const a = clean(left);
    const b = clean(right);
    const topA = TOP.indexOf(a);
    const topB = TOP.indexOf(b);
    if (topA >= 0 || topB >= 0) return topA >= 0 && topB >= 0 ? topA - topB : topA >= 0 ? -1 : 1;
    const bottomA = BOTTOM.indexOf(a);
    const bottomB = BOTTOM.indexOf(b);
    if (bottomA >= 0 || bottomB >= 0) return bottomA >= 0 && bottomB >= 0 ? bottomA - bottomB : bottomA >= 0 ? 1 : -1;
    return a.localeCompare(b, "zh-CN");
  }
  function normalizeVehicleSeries(value) {
    const series = clean(value);
    return series && series !== "全部" ? series : ALL;
  }
  function sortVehicleSeriesOptions(values) {
    return [...new Set((values || []).map(clean).filter(Boolean))].sort(compareVehicleSeriesOptions);
  }
  function isAllSeries(value) {
    const series = clean(value);
    return !series || series === ALL || series === "全部";
  }
  function normalizeVehicleSeriesSelection(values, options) {
    const source = Array.isArray(values) ? values : [values];
    const optionOrder = new Map((options || []).map((item, index) => [clean(item), index]));
    const validSet = optionOrder.size ? new Set(optionOrder.keys()) : null;
    const cleaned = [...new Set(source.map(clean).filter((item) => item && !isAllSeries(item)))];
    const valid = validSet ? cleaned.filter((item) => validSet.has(item)) : cleaned;
    return valid.sort((left, right) => {
      if (optionOrder.size) return optionOrder.get(left) - optionOrder.get(right);
      return compareVehicleSeriesOptions(left, right);
    });
  }
  function vehicleSeriesKey(values) {
    const selected = normalizeVehicleSeriesSelection(values);
    return selected.length ? selected.join("\u0001") : ALL;
  }
  function vehicleSeriesSummary(values) {
    const selected = normalizeVehicleSeriesSelection(values);
    if (!selected.length) return ALL;
    if (selected.length === 1) return selected[0];
    return `已选 ${selected.length} 个车系`;
  }
  function vehicleSeriesTrackingValue(values) {
    const selected = normalizeVehicleSeriesSelection(values);
    return selected.length ? selected.join("、") : ALL;
  }
  window.RetailVehicleSeries = {
    ALL,
    compareVehicleSeriesOptions,
    normalizeVehicleSeries,
    sortVehicleSeriesOptions,
    normalizeVehicleSeriesSelection,
    vehicleSeriesKey,
    vehicleSeriesSummary,
    vehicleSeriesTrackingValue
  };
})();
