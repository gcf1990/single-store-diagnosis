(function (root) {
  const { METRICS, SOURCE_NAMES, SOURCE_STATUS, targetLabel } = root.IronMetricsContract;

  function clean(value) { return String(value ?? "").trim(); }
  function num(value) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function dealerCode(row) { return clean(row.dealer_code || row["经销商代码"] || row["试驾接待经销商代码"]); }
  function dealerName(row) { return clean(row.dealer_name || row["经销商简称"] || row["父级经销商简称"] || row["经销商"]); }
  function rowKey(row, validDealers = []) {
    const code = dealerCode(row);
    if (code) return code;
    const name = dealerName(row);
    const match = validDealers.find((dealer) => clean(dealer.name) === name);
    return match?.code || "";
  }
  function authorizedMap(validDealers) {
    return new Map((Array.isArray(validDealers) ? validDealers : []).map((dealer) => [clean(dealer.code), dealer]).filter(([code]) => code));
  }
  function orgPath(dealer, code) {
    return {
      ...(dealer || {}),
      code,
      name: clean(dealer?.name) || code,
      area: clean(dealer?.area),
      areaCode: clean(dealer?.areaCode) || clean(dealer?.area),
      district: clean(dealer?.district),
      districtCode: clean(dealer?.districtCode) || clean(dealer?.district)
    };
  }
  function dccOrgPath(row, code) {
    return {
      code,
      name: clean(row.dealer_name || row["经销商简称"] || row["经销商名称"]) || code,
      area: clean(row.area_name || row["大区简称"] || row["大区名称"]),
      areaCode: clean(row.area_code || row["大区代码"]) || clean(row.area_name || row["大区简称"] || row["大区名称"]),
      district: clean(row.district_name || row["小区简称"] || row["小区名称"]),
      districtCode: clean(row.district_code || row["小区代码"]) || clean(row.district_name || row["小区简称"] || row["小区名称"]),
      dealerCode: code,
      ironDccDealerCode: code
    };
  }
  function storeOrg(store) {
    return {
      area: clean(store?.area),
      areaCode: clean(store?.areaCode) || clean(store?.area),
      district: clean(store?.district),
      districtCode: clean(store?.districtCode) || clean(store?.district)
    };
  }
  function sourceOrg(store, source) {
    return source === "dcc" && store?.ironDccOrg ? store.ironDccOrg : storeOrg(store);
  }
  function sameOrg(left, right) {
    return clean(left?.areaCode || left?.area) === clean(right?.areaCode || right?.area)
      && clean(left?.districtCode || left?.district) === clean(right?.districtCode || right?.district);
  }
  function emptyFact() { return { numerator: 0, denominator: 0, samples: new Set(), hits: new Set() }; }
  function ensureMetric(store, metricCode) {
    store.ironMetrics = store.ironMetrics || {};
    store.ironMetrics[metricCode] = store.ironMetrics[metricCode] || emptyFact();
    return store.ironMetrics[metricCode];
  }
  function ensureStore(map, code, validByCode) {
    if (!code) return null;
    if (!validByCode.has(code)) return null;
    if (!map.has(code)) map.set(code, orgPath(validByCode.get(code), code));
    return map.get(code);
  }
  function addRatioFact(map, validByCode, code, metricCode, numerator, denominator) {
    const store = ensureStore(map, code, validByCode);
    if (!store) return;
    addRatioFactToStore(store, metricCode, numerator, denominator);
  }
  function addRatioFactToStore(store, metricCode, numerator, denominator) {
    const fact = ensureMetric(store, metricCode);
    fact.numerator += num(numerator);
    fact.denominator += num(denominator);
  }
  function addDistinctFact(map, validByCode, code, metricCode, id, hit) {
    const store = ensureStore(map, code, validByCode);
    if (!store || !id) return;
    addDistinctFactToStore(store, metricCode, id, hit);
  }
  function addDistinctFactToStore(store, metricCode, id, hit) {
    if (!store || !id) return;
    const fact = ensureMetric(store, metricCode);
    fact.samples.add(id);
    if (hit) fact.hits.add(id);
  }
  function ensureDccStore(map, row, validByCode) {
    const code = dealerCode(row);
    if (!code) return null;
    const dccDealer = dccOrgPath(row, code);
    const validDealer = validByCode.get(code);
    const existing = map.get(code);
    if (!existing) {
      map.set(code, validDealer ? orgPath(validDealer, code) : dccDealer);
    }
    const store = map.get(code);
    store.ironDccOrg = {
      area: dccDealer.area,
      areaCode: dccDealer.areaCode,
      district: dccDealer.district,
      districtCode: dccDealer.districtCode,
      dealerCode: code,
      dealerName: dealerName(row)
    };
    store.ironDccDealerCode = code;
    if (!clean(store.name) || store.name === code) store.name = dccDealer.name || code;
    if (!validDealer) Object.assign(store, dccDealer, { code });
    return store;
  }
  function completeFact(fact) {
    if (!fact) return { numerator: null, denominator: null };
    if (fact.samples?.size) return { numerator: fact.hits.size, denominator: fact.samples.size };
    return { numerator: fact.numerator, denominator: fact.denominator };
  }
  function mergeFacts(facts) {
    return facts.reduce((total, fact) => {
      if (!fact) return total;
      if (fact.samples?.size) {
        fact.samples.forEach((id) => total.samples.add(id));
        fact.hits?.forEach((id) => total.hits.add(id));
        return total;
      }
      const counts = completeFact(fact);
      total.numerator += num(counts.numerator);
      total.denominator += num(counts.denominator);
      return total;
    }, emptyFact());
  }
  function statusFor(fact, sourceState) {
    if (sourceState?.status === SOURCE_STATUS.loading) return SOURCE_STATUS.loading;
    if (sourceState?.status === SOURCE_STATUS.incomplete || sourceState?.complete === false) return SOURCE_STATUS.incomplete;
    const done = completeFact(fact);
    return done.denominator > 0 ? SOURCE_STATUS.success : SOURCE_STATUS.empty;
  }
  function mergedFact(row, metricCode) {
    if (row?.ironMetricStores) {
      const scopedStores = row.ironMetricStores[metricCode] || [];
      return mergeFacts(scopedStores.map((store) => store.ironMetrics?.[metricCode]));
    }
    if (!row?.stores?.length) return row?.ironMetrics?.[metricCode];
    return mergeFacts(row.stores.map((store) => store.ironMetrics?.[metricCode]));
  }
  function recordFor(row, metric, sourceState) {
    const fact = mergedFact(row, metric.code);
    const counts = completeFact(fact);
    const sourceStatus = statusFor(fact, sourceState);
    const complete = sourceStatus !== SOURCE_STATUS.incomplete && sourceStatus !== SOURCE_STATUS.loading;
    return {
      section_code: metric.section,
      page_order: metric.order,
      organization_level: row.level === "area" ? "region" : row.level === "district" ? "district" : "dealer",
      organization_code: row.code || null,
      organization_name: row.name,
      metric_code: metric.code,
      display_name: metric.name,
      source_code: metric.source,
      metric_value: complete && counts.denominator > 0 ? counts.numerator / counts.denominator : null,
      numerator: complete ? counts.numerator : null,
      denominator: complete ? counts.denominator : null,
      target_value: metric.target,
      target_label: targetLabel(metric.target),
      unit: "%",
      precision: "1 decimal percent",
      dataset_name: SOURCE_NAMES[metric.source],
      dataset_id: metric.ds,
      source_status: sourceStatus,
      source_error: sourceState?.error || "",
      fieldGapReason: sourceState?.fieldGapReason || "",
      complete
    };
  }
  function buildStoreFacts(raw = {}, validDealers = []) {
    const validByCode = authorizedMap(validDealers);
    const stores = new Map();
    (Array.isArray(validDealers) ? validDealers : []).forEach((dealer) => ensureStore(stores, clean(dealer.code), validByCode));
    (raw.inviteMentionRows || []).forEach((row) => {
      const code = rowKey(row, validDealers);
      if (Object.hasOwn(row, "invite_trial_mention_denominator")) {
        addRatioFact(stores, validByCode, code, "invite_trial_mention_rate", row.invite_trial_mention_numerator, row.invite_trial_mention_denominator);
        addRatioFact(stores, validByCode, code, "wechat_apply_mention_rate", row.wechat_apply_mention_numerator, row.wechat_apply_mention_denominator);
        return;
      }
      const id = clean(row.record_id || row["呼叫编码"]);
      const qc = clean(row.ai_qc_score ?? row["AI质检得分"]);
      if (!id || !qc) return;
      addDistinctFact(stores, validByCode, code, "invite_trial_mention_rate", id, num(row.rw_invite_execut ?? row["荣威-邀约执行"]) > 0 || num(row.mg_inv_in_trial ?? row["MG-邀约进店试驾"]) > 0);
      addDistinctFact(stores, validByCode, code, "wechat_apply_mention_rate", id, num(row.rw_add_micro_execut ?? row["荣威-加微执行"]) > 0 || num(row.mg_plus_micro_apply ?? row["MG-加微申请"]) > 0);
    });
    (raw.intentLevelRows || []).forEach((row) => {
      const code = rowKey(row, validDealers);
      if (Object.hasOwn(row, "high_intent_low_level_denominator")) {
        addRatioFact(stores, validByCode, code, "high_intent_low_level_rate", row.high_intent_low_level_numerator, row.high_intent_low_level_denominator);
        return;
      }
      if (clean(row["意向等级"]) !== "高意向") return;
      addRatioFact(stores, validByCode, code, "high_intent_low_level_rate", clean(row["销售等级"]) === "低" ? 1 : 0, 1);
    });
    (raw.dccRows || []).forEach((row) => {
      if (!Object.hasOwn(row, "first_follow_call_60s_denominator")) return;
      const store = ensureDccStore(stores, row, validByCode);
      addRatioFactToStore(store, "first_follow_call_60s_rate", row.first_follow_call_60s_numerator, row.first_follow_call_60s_denominator);
      addRatioFactToStore(store, "follow_30min_rate", row.follow_30min_numerator, row.follow_30min_denominator);
      addRatioFactToStore(store, "follow_24h_rate", row.follow_24h_numerator, row.follow_24h_denominator);
      addRatioFactToStore(store, "two_day_three_call_rate", row.two_day_three_call_numerator, row.two_day_three_call_denominator);
    });
    const inRange = (row, field) => {
      const value = clean(row[field]).slice(0, 10);
      return Boolean(value && raw.range?.startDate && raw.range?.endDate && value >= raw.range.startDate && value <= raw.range.endDate);
    };
    (raw.dccRows || []).filter((row) => !Object.hasOwn(row, "first_follow_call_60s_denominator") && inRange(row, "下发CRM时间")).forEach((row) => {
      const store = ensureDccStore(stores, row, validByCode);
      const id = clean(row["线索编码"]);
      if (!id) return;
      addDistinctFactToStore(store, "first_follow_call_60s_rate", clean(row["首次通话时长"]) && clean(row["是否接通"]) === "是" ? id : "", num(row["首次通话时长(秒)"] || row["首次通话时长"]) >= 60);
      addDistinctFactToStore(store, "follow_30min_rate", clean(row["是否工作时段线索（10-18）"]) === "工作时段" ? id : "", clean(row["工作时段30分钟跟进（10-18）"]) === "是");
      addDistinctFactToStore(store, "follow_24h_rate", id, clean(row["是否24小时外呼"]) === "是");
    });
    (raw.dccThreeCallRows || raw.dccRows || []).filter((row) => inRange(row, "日期-门店看板")).forEach((row) => {
      const store = ensureDccStore(stores, row, validByCode);
      const id = clean(row["线索编码"]);
      if (!id) return;
      addDistinctFactToStore(store, "two_day_three_call_rate", id, clean(row["是否完成48小时三呼"]) === "是");
    });
    (raw.qualityTrialRows || []).forEach((row) => addRatioFact(stores, validByCode, rowKey(row, validDealers), "quality_trial_rate", row["优质试驾数"], row["常规试驾数"]));
    (raw.trialRecordRows || []).forEach((row) => {
      const code = rowKey(row, validDealers);
      if (Object.hasOwn(row, "trial_record_denominator")) {
        addRatioFact(stores, validByCode, code, "trial_record_upload_rate", row.trial_record_numerator, row.trial_record_denominator);
        return;
      }
      addDistinctFact(stores, validByCode, code, "trial_record_upload_rate", clean(row["试驾接待编码(PK)"] || row.trial_recv_id), clean(row["是否有录音"] || row.is_have_recording) === "Y");
    });
    (raw.trialTalkRows || []).forEach((row) => {
      const point = clean(row["试驾体验点"] || row.point);
      const code = rowKey(row, validDealers);
      if (Object.hasOwn(row, "trial_talk_denominator")) {
        if (point === "手机互联") addRatioFact(stores, validByCode, code, "phone_car_interconnect_mention_rate", row.trial_talk_numerator, row.trial_talk_denominator);
        if (point === "全场景自动泊车-离车泊入") addRatioFact(stores, validByCode, code, "remote_parking_mention_rate", row.trial_talk_numerator, row.trial_talk_denominator);
        return;
      }
      const id = clean(row["试驾清单ID"] || row.receive_id);
      const hit = clean(row["是否提及"] || row.mention) === "是";
      if (point === "手机互联") addDistinctFact(stores, validByCode, code, "phone_car_interconnect_mention_rate", id, hit);
      if (point === "全场景自动泊车-离车泊入") addDistinctFact(stores, validByCode, code, "remote_parking_mention_rate", id, hit);
    });
    return [...stores.values()];
  }
  function aggregateRows(viewRows, sourceStates = {}) {
    return (viewRows || []).flatMap((row) => METRICS.map((metric) => recordFor(row, metric, sourceStates[metric.source])));
  }
  function orgIdentityFromOrg(org, level) {
    if (level === "area") return { code: clean(org.areaCode) || clean(org.area), name: clean(org.area) || "未知大区" };
    if (level === "district") return { code: clean(org.districtCode) || clean(org.district), name: clean(org.district) || "未知小区" };
    return null;
  }
  function sourceMatchesDrillPath(store, source, drillPath = []) {
    const org = sourceOrg(store, source);
    return drillPath.every((item) => {
      if (item.level === "area") return orgIdentityFromOrg(org, "area").code === clean(item.code);
      if (item.level === "district") return orgIdentityFromOrg(org, "district").code === clean(item.code);
      return true;
    });
  }
  function ensureIronRow(groups, key, identity, level, store, org, preferIdentityName = false) {
    const group = groups.get(key) || {
      ...identity,
      level,
      area: clean(org?.area) || clean(store.area),
      areaCode: clean(org?.areaCode) || clean(store.areaCode),
      district: level === "district" ? clean(org?.district) || clean(store.district) : "",
      districtCode: level === "district" ? clean(org?.districtCode) || clean(store.districtCode) : "",
      stores: [],
      ironMetricStores: {}
    };
    if (preferIdentityName && clean(identity.name)) group.name = clean(identity.name);
    if (!group.stores.some((item) => clean(item.code) === clean(store.code))) group.stores.push(store);
    groups.set(key, group);
    return group;
  }
  function sortIronRows(rows, level) {
    return [...rows].sort((left, right) => {
      if (level === "area") {
        const leftPrefix = clean(left.name).match(/^(\d+)/);
        const rightPrefix = clean(right.name).match(/^(\d+)/);
        if (leftPrefix && rightPrefix) {
          const diff = Number(leftPrefix[1]) - Number(rightPrefix[1]);
          if (diff) return diff;
        } else if (leftPrefix || rightPrefix) {
          return leftPrefix ? -1 : 1;
        }
      }
      return clean(left.code).localeCompare(clean(right.code));
    });
  }
  function buildIronViewRows({ displayStores = [], level = "store", drillPath = [] } = {}) {
    const groups = new Map();
    METRICS.forEach((metric) => {
      (displayStores || []).forEach((store) => {
        if (!sourceMatchesDrillPath(store, metric.source, drillPath)) return;
        const org = sourceOrg(store, metric.source);
        const identity = level === "store"
          ? {
            code: clean(store.code),
            name: metric.source === "dcc"
              ? clean(store.ironDccOrg?.dealerName) || clean(store.name) || clean(store.code) || "未知门店"
              : clean(store.name) || clean(store.code) || "未知门店"
          }
          : orgIdentityFromOrg(org, level);
        if (!identity.code) return;
        const key = `${level}:${identity.code}`;
        const group = ensureIronRow(groups, key, identity, level, store, org, level === "store" && metric.source === "dcc");
        group.ironMetricStores[metric.code] = [...(group.ironMetricStores[metric.code] || []), store];
      });
    });
    return sortIronRows([...groups.values()], level);
  }
  function keyOf(record) {
    return `${record.organization_code || ""}\u0001${record.metric_code || ""}`;
  }
  function comparableValue(record) {
    if (!record || !record.complete || record.source_status === SOURCE_STATUS.incomplete || record.source_status === SOURCE_STATUS.loading) return null;
    if (record.denominator == null || record.denominator <= 0) return null;
    const value = Number(record.metric_value);
    return Number.isFinite(value) ? value : null;
  }
  function comparisonState(current, compare) {
    if (!current || current.source_status === SOURCE_STATUS.loading) return { loading: true, delta: null, error: "" };
    if (!current.complete || current.source_status === SOURCE_STATUS.incomplete) return { loading: false, delta: null, error: "加载失败" };
    if (!compare || compare.source_status === SOURCE_STATUS.loading) return { loading: true, delta: null, error: "" };
    if (!compare.complete || compare.source_status === SOURCE_STATUS.incomplete) return { loading: false, delta: null, error: "加载失败" };
    const currentValue = comparableValue(current);
    const compareValue = comparableValue(compare);
    if (currentValue == null || compareValue == null) return { loading: false, delta: null, error: "" };
    return { loading: false, delta: (currentValue - compareValue) * 100, error: "" };
  }
  function missingComparisonRecord(current, sourceStates = {}) {
    const sourceState = sourceStates?.[current?.source_code];
    const sourceStatus = sourceState?.status === SOURCE_STATUS.loading || !sourceState
      ? SOURCE_STATUS.loading
      : sourceState.status === SOURCE_STATUS.incomplete || sourceState.complete === false
        ? SOURCE_STATUS.incomplete
        : SOURCE_STATUS.empty;
    const complete = sourceStatus === SOURCE_STATUS.empty;
    return {
      ...current,
      metric_value: null,
      numerator: complete ? 0 : null,
      denominator: complete ? 0 : null,
      source_status: sourceStatus,
      source_error: sourceState?.error || "",
      fieldGapReason: sourceState?.fieldGapReason || "",
      complete
    };
  }
  function attachComparisonRecords(currentRecords, monthRecords = [], weekRecords = [], monthSourceStates = {}, weekSourceStates = {}) {
    const monthByKey = new Map((monthRecords || []).map((record) => [keyOf(record), record]));
    const weekByKey = new Map((weekRecords || []).map((record) => [keyOf(record), record]));
    return (currentRecords || []).map((record) => {
      const monthRecord = monthByKey.get(keyOf(record)) || missingComparisonRecord(record, monthSourceStates);
      const weekRecord = weekByKey.get(keyOf(record)) || missingComparisonRecord(record, weekSourceStates);
      const month = comparisonState(record, monthRecord);
      const week = comparisonState(record, weekRecord);
      return {
        ...record,
        month_value: comparableValue(monthRecord),
        week_value: comparableValue(weekRecord),
        month_source_status: monthRecord?.source_status || "",
        week_source_status: weekRecord?.source_status || "",
        monthFieldGapReason: monthRecord?.fieldGapReason || "",
        weekFieldGapReason: weekRecord?.fieldGapReason || "",
        monthDelta: month.delta,
        weekDelta: week.delta,
        monthLoading: month.loading,
        weekLoading: week.loading,
        monthError: month.error,
        weekError: week.error
      };
    });
  }
  function displayValue(record) {
    if (!record || record.source_status === SOURCE_STATUS.loading) return "loading";
    if (!record.complete || record.source_status === SOURCE_STATUS.incomplete) return "数据不完整";
    if (record.denominator == null || record.denominator <= 0) return "--";
    return `${(record.metric_value * 100).toFixed(1)}%`;
  }
  const api = { buildStoreFacts, buildIronViewRows, aggregateRows, attachComparisonRecords, displayValue };
  if (root.__IRON_METRICS_TEST__ === true) {
    api[["__", "test"].join("")] = { completeFact, statusFor, mergeFacts, comparisonState, missingComparisonRecord };
  }
  root.IronMetricsModel = api;
})(window);
