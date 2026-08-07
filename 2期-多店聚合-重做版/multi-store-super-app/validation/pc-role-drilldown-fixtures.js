export const profiles = {
  headquarters: { marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部" },
  region: { marketing_userType: 4, marketing_orgType: "RFS", marketing_orgName: "大区1" },
  district: { marketing_userType: 4, marketing_orgType: "MAC", marketing_orgName: "小区1" },
  salesDirector: { marketing_userType: 2, marketing_orgName: "门店销售部" },
  investor: { marketing_userType: 6, marketing_orgName: "投资人集团" },
  unknown: { marketing_userType: 9, marketing_orgType: "OTHER" }
};

const ZERO = { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 };

function process(total, negative, problemName, problemCount) {
  return {
    total, negative, rate: total ? negative / total * 100 : null,
    problems: [{ name: problemName, count: problemCount, denominator: total, rate: total ? problemCount / total * 100 : null, children: [] }]
  };
}

function store({ code, name, areaCode, area, districtCode, district, current, monthlyTarget }) {
  const previous = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Math.max(0, value - 1)]));
  const week = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Math.max(0, value - 2)]));
  return {
    code, name, areaCode, area, districtCode, district, current: { ...ZERO, ...current }, previous: { ...ZERO, ...previous }, week: { ...ZERO, ...week },
    ip: process(20, 4, "零钩子", 3), ipPrev: process(18, 3, "零钩子", 2), ipWeek: process(16, 2, "零钩子", 2),
    driveTag: process(10, 2, "版本未推荐", 2), drivePrev: process(9, 1, "版本未推荐", 1), driveWeek: process(8, 1, "版本未推荐", 1),
    monthlyTarget: monthlyTarget || dualTarget(),
    issue: "暂无负向问题", direction: "逻辑待确认", totalNegative: 6
  };
}

const stores = [
  store({ code: "S1", name: "门店1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1", current: { leads: 40, arrivals: 8, drives: 4, orders: 7, retail: 3 } }),
  store({ code: "S2", name: "门店2", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1", current: { leads: 10, arrivals: 2, drives: 1, orders: 7, retail: 2 } }),
  store({ code: "S3", name: "门店3", areaCode: "A1", area: "大区1", districtCode: "D2", district: "小区2", current: { leads: 30, arrivals: 3, drives: 3, orders: 6, retail: 2 } }),
  store({ code: "S4", name: "门店4", areaCode: "A2", area: "大区2", districtCode: "D3", district: "小区3", current: { leads: 60, arrivals: 12, drives: 6, orders: 15, retail: 8 } })
];

function sum(rows, field) {
  return rows.reduce((total, item) => {
    Object.keys(ZERO).forEach((key) => { total[key] += item[field][key]; });
    return total;
  }, { ...ZERO });
}

function sumProcess(rows, field) {
  const total = rows.reduce((sumValue, item) => sumValue + item[field].total, 0);
  const negative = rows.reduce((sumValue, item) => sumValue + item[field].negative, 0);
  return { total, negative, rate: total ? negative / total * 100 : null, problems: [] };
}

function sumTarget(rows) {
  const total = rows.reduce((acc, item) => {
    const target = item.monthlyTarget || {};
    mergeMetric(acc.order, target.order || target);
    mergeMetric(acc.retail, target.retail || {});
    return acc;
  }, dualTarget("configured"));
  finalizeMetric(total.order);
  finalizeMetric(total.retail);
  total.target = total.order.target;
  total.actual = total.order.actual;
  total.achievement = total.order.achievement;
  total.unconfiguredActual = total.order.unconfiguredActual;
  total.conflictKeys = (total.order.conflictKeys || 0) + (total.retail.conflictKeys || 0);
  total.hasTarget = total.order.hasTarget || total.retail.hasTarget;
  total.validDealerMissingRows = Math.max(total.order.validDealerMissingRows || 0, total.retail.validDealerMissingRows || 0);
  total.status = total.order.status === "unavailable" || total.retail.status === "unavailable" ? "unavailable" : total.hasTarget ? "configured" : "no_target";
  return total;
}

function metricTarget(status = "no_target", fields = {}) {
  return { status, error: "", target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0, ...fields };
}

function dualTarget(status = "no_target", fields = {}) {
  const order = metricTarget(status, fields.order || {});
  const retail = metricTarget(status, fields.retail || {});
  return { status, error: "", order, retail, target: order.target, actual: order.actual, achievement: order.achievement, unconfiguredActual: order.unconfiguredActual, conflictKeys: order.conflictKeys + retail.conflictKeys, hasTarget: order.hasTarget || retail.hasTarget, validDealerMissingRows: Math.max(order.validDealerMissingRows || 0, retail.validDealerMissingRows || 0), ...fields };
}

function mergeMetric(total, target) {
  if (target.status === "unavailable") total.status = "unavailable";
  if (target.status === "invalid_range" && total.status !== "unavailable") total.status = "invalid_range";
  if (target.status === "non_mg" && total.status !== "unavailable") total.status = "non_mg";
  total.target += target.target || 0;
  total.actual += target.actual || 0;
  total.unconfiguredActual += target.unconfiguredActual || 0;
  total.conflictKeys += target.conflictKeys || 0;
  total.validDealerMissingRows = Math.max(total.validDealerMissingRows || 0, target.validDealerMissingRows || 0);
  total.hasTarget = total.hasTarget || target.hasTarget === true || (target.target || 0) > 0;
}

function finalizeMetric(target) {
  if (!["unavailable", "invalid_range", "non_mg"].includes(target.status)) target.status = target.hasTarget ? "configured" : "no_target";
  target.achievement = target.target > 0 ? target.actual / target.target * 100 : null;
}

export function makeFixture(overrides = {}) {
  const fixtureStores = overrides.stores || stores;
  const dataFor = (rows) => ({
    stores: rows,
    salesCurrent: sum(rows, "current"), salesPrevious: sum(rows, "previous"), salesWeek: sum(rows, "week"),
    monthlyTarget: sumTarget(rows),
    ip: sumProcess(rows, "ip"), ipPrev: sumProcess(rows, "ipPrev"), ipWeek: sumProcess(rows, "ipWeek"),
    driveTags: sumProcess(rows, "driveTag"), driveTagsPrev: sumProcess(rows, "drivePrev"), driveTagsWeek: sumProcess(rows, "driveWeek")
  });
  const mg4Rows = fixtureStores.filter((item) => item.code === "S1" || item.code === "S4");
  const mg4xRows = fixtureStores.filter((item) => item.code === "S2" || item.code === "S3");
  const multiRows = fixtureStores.filter((item) => item.code === "S1" || item.code === "S2" || item.code === "S4");
  return {
    nationalComplete: overrides.nationalComplete ?? true,
    validDealers: fixtureStores.map(({ code, name, areaCode, area, districtCode, district }) => ({ code, name, areaCode, area, districtCode, district })),
    raw: { range: { startDate: "2026-07-01", endDate: "2026-07-14" } },
    vehicleSeriesOptions: overrides.vehicleSeriesOptions ?? ["未知车系", "MG5", "MG 07", "其他车系", "Cyberster", "全新MG4", "位置车系", "MG 4X", "MG ES5"],
    data: dataFor(fixtureStores),
    vehicleSeriesData: overrides.vehicleSeriesData ?? {
      "全新MG4": dataFor(mg4Rows),
      "MG 4X": dataFor(mg4xRows),
      "全新MG4\u0001MG 4X": dataFor(multiRows),
      "全新MG4\u0001MG 4X\u0001MG 07": dataFor(multiRows)
    },
    ...overrides
  };
}

export function storesFor({ areaCode, districtCode, storeCode } = {}) {
  return stores.filter((item) => (!areaCode || item.areaCode === areaCode) && (!districtCode || item.districtCode === districtCode) && (!storeCode || item.code === storeCode));
}
