(function (root) {
  const PROFILE_KEY = "retail-cockpit:personnel-profile";
  const DEMO_NAME = "all-dealers";
  const DEMO_AREA_COUNT = 7;
  const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
  const STANDALONE_DEMO_FILES = ["外链优化-01.html", "外链优化-02.html"];
  const ZERO = { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 };

  function isExplicitLocalAllDealersDemo(locationLike = root.location) {
    try {
      const protocol = String(locationLike?.protocol || "").toLowerCase();
      const pathname = decodeURIComponent(String(locationLike?.pathname || ""));
      const hostname = String(locationLike?.hostname || "").toLowerCase();
      const standalonePage = STANDALONE_DEMO_FILES.some((file) => pathname.endsWith(`/${file}`));
      if (standalonePage && (protocol === "file:" || LOCAL_HOSTS.has(hostname))) return true;
      if (!LOCAL_HOSTS.has(hostname)) return false;
      const search = new URLSearchParams(String(locationLike?.search || ""));
      return search.get("demo") === DEMO_NAME;
    } catch (error) {
      return false;
    }
  }

  function process(total, negative, problemName, problemCount) {
    return {
      total,
      negative,
      rate: total ? (negative / total) * 100 : null,
      problems: [{
        name: problemName,
        count: problemCount,
        denominator: total,
        rate: total ? (problemCount / total) * 100 : null,
        children: []
      }]
    };
  }

  function metricTarget(status = "configured", fields = {}) {
    return {
      status,
      error: "",
      target: 0,
      actual: 0,
      achievement: null,
      unconfiguredActual: 0,
      conflictKeys: 0,
      hasTarget: false,
      validDealerMissingRows: 0,
      ...fields
    };
  }

  function dualTarget(orderTarget, retailTarget, orderActual, retailActual) {
    const order = metricTarget("configured", {
      target: orderTarget,
      actual: orderActual,
      achievement: orderTarget > 0 ? (orderActual / orderTarget) * 100 : null,
      hasTarget: orderTarget > 0
    });
    const retail = metricTarget("configured", {
      target: retailTarget,
      actual: retailActual,
      achievement: retailTarget > 0 ? (retailActual / retailTarget) * 100 : null,
      hasTarget: retailTarget > 0
    });
    return {
      status: "configured",
      error: "",
      order,
      retail,
      target: order.target,
      actual: order.actual,
      achievement: order.achievement,
      unconfiguredActual: 0,
      conflictKeys: 0,
      hasTarget: order.hasTarget || retail.hasTarget,
      validDealerMissingRows: 0
    };
  }

  function makeStore(index, areaIndex, districtIndex, storeIndex) {
    const code = `LD${String(index + 1).padStart(3, "0")}`;
    const leads = 92 + index * 5;
    const arrivals = 26 + ((index * 7) % 38);
    const drives = 12 + ((index * 5) % 24);
    const orders = 5 + ((index * 3) % 17);
    const retail = 3 + ((index * 2) % 13);
    const current = { leads, arrivals, drives, orders, retail };
    const previous = {
      leads: Math.max(0, leads - 9 + (index % 4)),
      arrivals: Math.max(0, arrivals - 4 + (index % 3)),
      drives: Math.max(0, drives - 3 + (index % 2)),
      orders: Math.max(0, orders - 2 + (index % 2)),
      retail: Math.max(0, retail - 1)
    };
    const week = {
      leads: Math.max(0, leads - 14),
      arrivals: Math.max(0, arrivals - 6),
      drives: Math.max(0, drives - 4),
      orders: Math.max(0, orders - 3),
      retail: Math.max(0, retail - 2)
    };
    const areaCode = `DA${areaIndex}`;
    const districtCode = `DD${areaIndex}${districtIndex}`;
    return {
      code,
      name: `本地样例经销商${String(index + 1).padStart(2, "0")}`,
      areaCode,
      area: `${areaIndex}样例大区`,
      districtCode,
      district: `${areaIndex}-${districtIndex}样例小区`,
      current,
      previous,
      week,
      ip: process(38 + index, 5 + (index % 7), index % 2 ? "报价承接不足" : "零钩子", 2 + (index % 5)),
      ipPrev: process(34 + index, 4 + (index % 5), "零钩子", 1 + (index % 4)),
      ipWeek: process(29 + index, 3 + (index % 4), "未锁定时间", 1 + (index % 3)),
      driveTag: process(18 + index, 3 + (index % 4), index % 2 ? "顾虑跳过" : "版本未推荐", 1 + (index % 4)),
      drivePrev: process(16 + index, 2 + (index % 3), "版本未推荐", 1 + (index % 3)),
      driveWeek: process(14 + index, 2 + (index % 2), "竞品回避及贬低", 1 + (index % 2)),
      monthlyTarget: dualTarget(orders + 8 + storeIndex, retail + 7 + storeIndex, orders, retail),
      issue: "本地演示样例",
      direction: "用于验证全部经销商入口",
      totalNegative: 8 + (index % 6)
    };
  }

  function makeDemoStores() {
    const stores = [];
    let index = 0;
    for (let areaIndex = 1; areaIndex <= DEMO_AREA_COUNT; areaIndex += 1) {
      for (let districtIndex = 1; districtIndex <= 3; districtIndex += 1) {
        for (let storeIndex = 1; storeIndex <= (areaIndex === 3 && districtIndex === 3 ? 2 : 3); storeIndex += 1) {
          stores.push(makeStore(index, areaIndex, districtIndex, storeIndex));
          index += 1;
        }
      }
    }
    return stores;
  }

  function sumRows(rows, field) {
    return rows.reduce((total, item) => {
      Object.keys(ZERO).forEach((key) => { total[key] += item[field]?.[key] || 0; });
      return total;
    }, { ...ZERO });
  }

  function mergeMetric(total, target) {
    total.target += target?.target || 0;
    total.actual += target?.actual || 0;
    total.unconfiguredActual += target?.unconfiguredActual || 0;
    total.conflictKeys += target?.conflictKeys || 0;
    total.validDealerMissingRows = Math.max(total.validDealerMissingRows || 0, target?.validDealerMissingRows || 0);
    total.hasTarget = total.hasTarget || target?.hasTarget === true || (target?.target || 0) > 0;
  }

  function finalizeMetric(target) {
    target.status = target.hasTarget ? "configured" : "no_target";
    target.achievement = target.target > 0 ? (target.actual / target.target) * 100 : null;
  }

  function sumTarget(rows) {
    const total = {
      status: "configured",
      error: "",
      order: metricTarget("configured"),
      retail: metricTarget("configured"),
      target: 0,
      actual: 0,
      achievement: null,
      unconfiguredActual: 0,
      conflictKeys: 0,
      hasTarget: false,
      validDealerMissingRows: 0
    };
    rows.forEach((item) => {
      mergeMetric(total.order, item.monthlyTarget?.order || item.monthlyTarget);
      mergeMetric(total.retail, item.monthlyTarget?.retail || {});
    });
    finalizeMetric(total.order);
    finalizeMetric(total.retail);
    total.target = total.order.target;
    total.actual = total.order.actual;
    total.achievement = total.order.achievement;
    total.conflictKeys = total.order.conflictKeys + total.retail.conflictKeys;
    total.hasTarget = total.order.hasTarget || total.retail.hasTarget;
    total.validDealerMissingRows = Math.max(total.order.validDealerMissingRows || 0, total.retail.validDealerMissingRows || 0);
    total.status = total.hasTarget ? "configured" : "no_target";
    return total;
  }

  function sumProcess(rows, field) {
    const problems = new Map();
    const total = rows.reduce((sum, item) => sum + (item[field]?.total || 0), 0);
    const negative = rows.reduce((sum, item) => sum + (item[field]?.negative || 0), 0);
    rows.forEach((item) => {
      (item[field]?.problems || []).forEach((problem) => {
        const current = problems.get(problem.name) || { name: problem.name, count: 0, denominator: 0, children: [] };
        current.count += problem.count || 0;
        current.denominator += problem.denominator || item[field]?.total || 0;
        current.rate = current.denominator ? (current.count / current.denominator) * 100 : null;
        problems.set(problem.name, current);
      });
    });
    return { total, negative, rate: total ? (negative / total) * 100 : null, problems: [...problems.values()].sort((a, b) => b.count - a.count) };
  }

  function dataFor(rows) {
    return {
      stores: rows,
      salesCurrent: sumRows(rows, "current"),
      salesPrevious: sumRows(rows, "previous"),
      salesWeek: sumRows(rows, "week"),
      monthlyTarget: sumTarget(rows),
      ip: sumProcess(rows, "ip"),
      ipPrev: sumProcess(rows, "ipPrev"),
      ipWeek: sumProcess(rows, "ipWeek"),
      driveTags: sumProcess(rows, "driveTag"),
      driveTagsPrev: sumProcess(rows, "drivePrev"),
      driveTagsWeek: sumProcess(rows, "driveWeek")
    };
  }

  function sourceStates() {
    return {
      inviteMention: { status: "success", complete: true },
      intentLevel: { status: "success", complete: true },
      dcc: { status: "success", complete: true },
      qualityTrial: { status: "success", complete: true },
      trialRecord: { status: "success", complete: true },
      trialTalk: { status: "success", complete: true }
    };
  }

  function createIronRaw(stores, range, scale = 1) {
    const n = (value) => Math.max(0, Math.round(value * scale));
    return {
      range,
      sourceStates: sourceStates(),
      inviteMentionRows: stores.map((store, index) => ({
        dealer_code: store.code,
        invite_trial_mention_numerator: n(28 + (index % 9)),
        invite_trial_mention_denominator: n(50 + (index % 13)),
        wechat_apply_mention_numerator: n(30 + (index % 8)),
        wechat_apply_mention_denominator: n(54 + (index % 11))
      })),
      intentLevelRows: stores.map((store, index) => ({
        dealer_code: store.code,
        high_intent_low_level_numerator: n(1 + (index % 3)),
        high_intent_low_level_denominator: n(42 + (index % 10))
      })),
      dccRows: stores.map((store, index) => ({
        dealer_code: store.code,
        first_follow_call_60s_numerator: n(31 + (index % 10)),
        first_follow_call_60s_denominator: n(56 + (index % 15)),
        follow_30min_numerator: n(45 + (index % 12)),
        follow_30min_denominator: n(54 + (index % 15)),
        follow_24h_numerator: n(48 + (index % 10)),
        follow_24h_denominator: n(55 + (index % 13)),
        two_day_three_call_numerator: n(42 + (index % 11)),
        two_day_three_call_denominator: n(53 + (index % 14))
      })),
      qualityTrialRows: stores.map((store, index) => ({
        "经销商代码": store.code,
        "优质试驾数": n(9 + (index % 7)),
        "常规试驾数": n(24 + (index % 8))
      })),
      trialRecordRows: stores.map((store, index) => ({
        dealer_code: store.code,
        trial_record_numerator: n(13 + (index % 8)),
        trial_record_denominator: n(24 + (index % 10))
      })),
      trialTalkRows: stores.flatMap((store, index) => [
        {
          dealer_code: store.code,
          point: "手机互联",
          trial_talk_numerator: n(10 + (index % 6)),
          trial_talk_denominator: n(24 + (index % 8))
        },
        {
          dealer_code: store.code,
          point: "全场景自动泊车-离车泊入",
          trial_talk_numerator: n(8 + (index % 6)),
          trial_talk_denominator: n(24 + (index % 8))
        }
      ])
    };
  }

  function createSmallOrderRaw(stores) {
    const targetRows = stores.map((store) => ({
      区域: store.area,
      MAC: store.district,
      一级经销商: store.code,
      经销商简称: store.name,
      MG07小订目标: "100"
    }));
    const organizationRows = stores.map((store) => ({
      品牌名称: "MG",
      一级经销商代码: store.code,
      经销商简称: store.name,
      大区代码: store.areaCode,
      大区名称: store.area,
      小区代码: store.districtCode,
      小区名称: store.district,
      MAC: store.district
    }));
    const actualRows = stores.map((store, index) => {
      const retained = index < 9 ? 45 + (index % 4) : index < 18 ? 25 + (index % 4) : 38 + (index % 5);
      const cancelled = 1 + (index % 3);
      return {
        dealer_code: store.code,
        actual_small_order: retained + cancelled,
        retained_small_order: retained,
        cancelled_small_order: cancelled,
        data_updated_at: "2026-08-05 10:30:00"
      };
    });
    const todayRows = stores.map((store, index) => ({
      dealer_code: store.code,
      actual_small_order: 2 + (index % 5)
    }));
    return {
      status: "ready",
      actualStatus: "ready",
      todayStatus: "ready",
      targetRows,
      organizationRows,
      actualRows,
      todayRows
    };
  }

  function createAllDealersFixture() {
    const stores = makeDemoStores();
    const validDealers = stores.map(({ code, name, areaCode, area, districtCode, district }) => ({ code, name, areaCode, area, districtCode, district }));
    const currentRange = { startDate: "2026-07-01", endDate: "2026-07-22" };
    return {
      localDemo: DEMO_NAME,
      nationalComplete: true,
      validDealers,
      raw: { range: currentRange },
      vehicleSeriesOptions: ["全新MG4", "MG 4X", "MG 07", "MG ES5", "Cyberster"],
      data: dataFor(stores),
      ironRaw: createIronRaw(stores, currentRange, 1),
      ironMonthRaw: createIronRaw(stores, { startDate: "2026-06-01", endDate: "2026-06-22" }, 0.9),
      ironWeekRaw: createIronRaw(stores, { startDate: "2026-06-24", endDate: "2026-07-15" }, 0.95),
      smallOrderRaw: createSmallOrderRaw(stores),
      smallOrderToday: "2026-08-05",
      diagnosisStores: stores
    };
  }

  function installDemoFixture() {
    if (!isExplicitLocalAllDealersDemo(root.location)) return false;
    const profile = { marketing_userType: 4, marketing_orgType: "HQ", marketing_orgName: "销售总部", luopan_name: "本地演示总部账号" };
    root.sessionStorage?.setItem(PROFILE_KEY, JSON.stringify(profile));
    root.__retailPcFixture = createAllDealersFixture();
    return true;
  }

  root.RetailLocalDemoFixture = {
    DEMO_NAME,
    PROFILE_KEY,
    STANDALONE_DEMO_FILES,
    isExplicitLocalAllDealersDemo,
    createAllDealersFixture,
    installDemoFixture
  };

  installDemoFixture();
})(typeof window !== "undefined" ? window : globalThis);
