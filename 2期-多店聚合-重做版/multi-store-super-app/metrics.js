(function () {
  function n(value) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function clean(value) { return String(value || "").trim(); }
  function pct(num, den) { return den > 0 ? (num / den) * 100 : null; }
  function dateOnly(value) { return clean(value).slice(0, 10); }
  function storeCode(row) { return clean(row["经销商代码"] || row["试驾接待经销商代码"] || row["订单经销商代码"] || row.dealer_code); }
  function storeName(row) { return clean(row["经销商简称"] || row["试驾接待经销商简称"] || row["订单经销商简称"] || row["经销商名称"] || "未知门店"); }
  function areaName(row) { return clean(row["大区简称"] || row["试驾接待大区简称"] || row["大区名称"]); }
  function districtName(row) { return clean(row["小区简称"] || row["试驾接待小区简称"] || row["小区名称"]); }
  function periodId(row) { return clean(row["周期编码"] || row.period_id); }
  function targetKey(item) { return [item.month, item.brand, item.dealerCode, item.vehicleSeries].map(clean).join("\u0000"); }
  const IP_TARGET_TAGS = ["到店理由构建", "到店时间锁定", "报价到店承接", "竞品比较转化"];

  function groupBy(rows, keyFn) {
    return rows.reduce((map, row) => {
      const key = keyFn(row);
      if (!key) return map;
      map.set(key, [...(map.get(key) || []), row]);
      return map;
    }, new Map());
  }

  function sumSales(rows) {
    return rows.reduce((acc, row) => {
      const code = storeCode(row);
      if (code && !acc.stores.has(code)) acc.stores.set(code, { code, name: storeName(row), area: areaName(row), district: districtName(row) });
      acc.leads += n(row["当日下发线索数"]);
      acc.arrivals += n(row["当日首触客流数"]);
      acc.drives += n(row["当日首触试驾数"]);
      acc.orders += n(row["当日订单数（首触）"]);
      acc.retail += n(row["当日零售数"]);
      return acc;
    }, { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0, stores: new Map() });
  }

  function salesByStore(rows) {
    return new Map([...groupBy(rows, storeCode)].map(([code, storeRows]) => [code, sumSales(storeRows)]));
  }

  const RESULT_RULES = {
    assigned_leads: { label: "下发线索", type: "count", issue: "线索供给不足", breakpoint: "线索规模偏低，后续转化承压" },
    arrivals: { label: "到店数", type: "count", issue: "到店转化不足", breakpoint: "到店规模偏低" },
    orders: { label: "订单数", type: "count", issue: "订单转化不足", breakpoint: "订单结果规模偏弱" },
    lead_to_arrival_rate: { label: "线索到店率", type: "rate", issue: "到店转化不足", breakpoint: "线索邀约到店转化偏弱" },
    drive_to_order_rate: { label: "试驾订单率", type: "rate", issue: "订单转化不足", breakpoint: "试驾后订单承接偏弱" },
    lead_to_order_rate: { label: "线索订单率", type: "rate", issue: "订单转化不足", breakpoint: "线索到订单整体转化偏弱" }
  };
  const RESULT_PRIORITY = [
    ["assigned_leads"],
    ["orders", "lead_to_order_rate", "drive_to_order_rate"],
    ["arrivals", "lead_to_arrival_rate"]
  ];

  function currentMetric(store, key) {
    const c = store.current || {};
    if (key === "assigned_leads") return c.leads || 0;
    if (key === "arrivals") return c.arrivals || 0;
    if (key === "orders") return c.orders || 0;
    if (key === "lead_to_arrival_rate") return pct(c.arrivals || 0, c.leads || 0);
    if (key === "drive_to_order_rate") return pct(c.orders || 0, c.drives || 0);
    if (key === "lead_to_order_rate") return pct(c.orders || 0, c.leads || 0);
    return null;
  }

  function previousMetric(store, key) {
    const p = store.previous || {};
    if (key === "assigned_leads") return p.leads || 0;
    if (key === "arrivals") return p.arrivals || 0;
    if (key === "orders") return p.orders || 0;
    if (key === "lead_to_arrival_rate") return pct(p.arrivals || 0, p.leads || 0);
    if (key === "drive_to_order_rate") return pct(p.orders || 0, p.drives || 0);
    if (key === "lead_to_order_rate") return pct(p.orders || 0, p.leads || 0);
    return null;
  }

  function valueText(value, type) {
    if (value == null || !Number.isFinite(value)) return "--";
    if (type === "rate") {
      const digits = Math.abs(value) >= 10 ? 0 : 1;
      return `${value.toFixed(digits)}%`;
    }
    return Math.round(value).toLocaleString("zh-CN");
  }

  function metricTrend(store, key) {
    const rule = RESULT_RULES[key];
    const current = currentMetric(store, key);
    const previous = previousMetric(store, key);
    if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return "环比暂无可比";
    if (rule.type === "rate") {
      const diff = current - previous;
      if (Math.abs(diff) < 0.05) return "环比基本持平";
      return diff > 0 ? "较上月改善" : "较上月下滑";
    }
    if (previous <= 0) return current > 0 ? "上月无基数，本期已有发生" : "环比暂无可比";
    const diff = ((current - previous) / previous) * 100;
    if (Math.abs(diff) < 0.5) return "环比基本持平";
    return diff > 0 ? "较上月改善" : "较上月下滑";
  }

  function rankedMap(stores, key) {
    const byDistrict = groupBy(stores, (store) => clean(store.district) || "全部");
    const result = new Map();
    byDistrict.forEach((items) => {
      const ranked = items
        .map((store) => ({ store, value: currentMetric(store, key) }))
        .filter((item) => item.value != null && Number.isFinite(item.value))
        .sort((a, b) => b.value - a.value || clean(a.store.code).localeCompare(clean(b.store.code)));
      let prevValue = null;
      let prevRank = 0;
      ranked.forEach((item, index) => {
        const rank = prevValue !== null && item.value === prevValue ? prevRank : index + 1;
        prevValue = item.value;
        prevRank = rank;
        const total = ranked.length;
        result.set(`${clean(item.store.code)}|${key}`, {
          key,
          value: item.value,
          rank,
          total,
          percentile: total ? ((total - rank + 1) / total) * 100 : null
        });
      });
    });
    return result;
  }

  function buildResultRanks(stores) {
    const map = new Map();
    Object.keys(RESULT_RULES).forEach((key) => {
      rankedMap(stores, key).forEach((value, id) => map.set(id, value));
    });
    return map;
  }

  function isLowPosition(rankInfo) {
    if (!rankInfo || !rankInfo.total) return false;
    if (rankInfo.total === 1) return false;
    if (rankInfo.total < 4) return rankInfo.rank === rankInfo.total;
    return rankInfo.percentile <= 30;
  }

  function selectResultCandidate(store, ranks) {
    const code = clean(store.code);
    const lows = [];
    RESULT_PRIORITY.forEach((keys, priority) => {
      keys.forEach((key) => {
        const rankInfo = ranks.get(`${code}|${key}`);
        if (isLowPosition(rankInfo)) lows.push({ key, priority, rankInfo });
      });
    });
    if (!lows.length) return null;
    return lows.sort((a, b) => a.priority - b.priority || a.rankInfo.percentile - b.rankInfo.percentile)[0];
  }

  function resultBreakpoint(store, candidate) {
    const rule = RESULT_RULES[candidate.key];
    const rankInfo = candidate.rankInfo;
    const percentile = rankInfo.percentile == null ? "--" : `${Math.max(1, Math.round(rankInfo.percentile))}%`;
    return `${rule.label} ${valueText(rankInfo.value, rule.type)}，小区第${rankInfo.rank}/${rankInfo.total}（后${percentile}）；断点：${rule.breakpoint}`;
  }

  function median(values) {
    const list = values.filter((value) => value != null && Number.isFinite(value)).sort((a, b) => a - b);
    if (!list.length) return null;
    const mid = Math.floor(list.length / 2);
    return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
  }

  function processFallback(store, stores) {
    const district = clean(store.district) || "全部";
    const peers = stores.filter((item) => (clean(item.district) || "全部") === district);
    const ipMedian = median(peers.map((item) => item.ip?.rate));
    const driveMedian = median(peers.map((item) => item.driveTag?.rate));
    const ipRate = store.ip?.rate;
    const driveRate = store.driveTag?.rate;
    const ipHit = (store.ip?.total || 0) >= 20 && ipMedian != null && ipMedian > 0 && ipRate > ipMedian * 1.5;
    const driveHit = (store.driveTag?.total || 0) >= 10 && driveMedian != null && driveMedian > 0 && driveRate > driveMedian * 1.5;
    if (ipHit) {
      return {
        issueName: "邀约质量不足",
        resultBreakpoint: `负向邀约占比 ${valueText(ipRate, "rate")}，小区中位值 ${valueText(ipMedian, "rate")}，高于 1.5 倍；断点：邀约负向问题集中`,
        trendNote: "结果断点不明显，过程负向指标偏高"
      };
    }
    if (driveHit) {
      return {
        issueName: "接待技巧不足",
        resultBreakpoint: `负向试驾接待占比 ${valueText(driveRate, "rate")}，小区中位值 ${valueText(driveMedian, "rate")}，高于 1.5 倍；断点：试驾接待负向问题集中`,
        trendNote: "结果断点不明显，过程负向指标偏高"
      };
    }
    return null;
  }

  function buildDynamicStoreDiagnoses(stores, options = {}) {
    const scopeStores = (stores || []).filter((store) => clean(store.code) && store.targetOnly !== true);
    const ranks = buildResultRanks(scopeStores);
    return scopeStores.map((store) => {
      const candidate = selectResultCandidate(store, ranks);
      if (candidate) {
        const rule = RESULT_RULES[candidate.key];
        return {
          code: clean(store.code),
          issueName: rule.issue,
          resultBreakpoint: resultBreakpoint(store, candidate),
          trendNote: metricTrend(store, candidate.key),
          evidence: { ...candidate.rankInfo }
        };
      }
      const process = options.processReady ? processFallback(store, scopeStores) : null;
      if (process) return { code: clean(store.code), ...process, evidence: null };
      return {
        code: clean(store.code),
        issueName: "未发现显著异常",
        resultBreakpoint: options.processReady ? "未命中小区低分位阈值；断点：未发现显著异常" : "未命中小区低分位阈值；过程数据加载中",
        trendNote: "暂无明显异常",
        evidence: null
      };
    });
  }

  function aggregateDcc(rows) {
    const leadRows = rows.filter((row) => clean(row["线索编码"]));
    const leadGroups = groupBy(leadRows, (row) => clean(row["线索编码"]));
    const connected = [...leadGroups.values()].filter((items) => items.some((row) => n(row["线索下发72小时外呼接通次数"]) > 0)).length;
    const shortCall = [...leadGroups.values()].filter((items) => items.some((row) => clean(row["72小时总通话时长"]) === "" || n(row["72小时总通话时长"]) < 30)).length;
    const worktime = leadRows.filter((row) => clean(row["是否工作时段线索（10-18）"]) === "工作时段");
    return {
      totalLeads: leadRows.length,
      distinctLeads: leadGroups.size,
      connected,
      shortCall,
      outbound30: leadRows.filter((row) => clean(row["工作时段30分钟跟进（10-18）"]) === "是").length,
      worktimeLeads: worktime.length,
      threeCall: leadRows.filter((row) => clean(row["是否完成72小时三呼"]) === "是").length
    };
  }

  function aggregateDrive(rows) {
    const events = [...groupBy(rows, (row) => clean(row["试驾接待编码"])).values()].map((items) => items[0]);
    const mileageRows = events.filter((row) => n(row["试驾里程"]) > 0);
    const durationRows = events.filter((row) => n(row["试驾时长(分钟)"]) > 0);
    return {
      totalEvents: events.length,
      mileageSum: mileageRows.reduce((sum, row) => sum + n(row["试驾里程"]), 0),
      mileageEvents: mileageRows.length,
      durationSum: durationRows.reduce((sum, row) => sum + n(row["试驾时长(分钟)"]), 0),
      durationEvents: durationRows.length
    };
  }

  function aggregateTrialOrder(trialRows, orderRows) {
    const trialDateByPeriod = new Map();
    trialRows.forEach((row) => {
      const id = periodId(row);
      const trialDate = dateOnly(row["试驾接待时间"] || row["试驾接待日期"]);
      if (!id || !trialDate) return;
      const existing = trialDateByPeriod.get(id);
      if (!existing || trialDate < existing) trialDateByPeriod.set(id, trialDate);
    });
    const ordered = new Set();
    orderRows.forEach((row) => {
      const id = periodId(row);
      const orderDate = dateOnly(row["订单创建时间"] || row["订单创建/交现车日期"] || row.order_create_time);
      if (id && orderDate && trialDateByPeriod.get(id) && orderDate >= trialDateByPeriod.get(id)) ordered.add(id);
    });
    return { trialCustomers: trialDateByPeriod.size, orderedCustomers: ordered.size };
  }

  function isDriveMention(row) { return Boolean(clean(row["一级标签"]) && clean(row["二级标签"])); }
  function isDriveJudged(row) {
    const value = clean(row["是否判定正负向"]);
    if (!value) return true;
    if (value.includes("未判") || value.includes("无法")) return false;
    return ["是", "已判向", "已判定", "已判定正负向", "正向", "负向"].includes(value);
  }
  function isNegative(row) { return ["负向", "負向", "反向"].includes(clean(row["标签正负向"])); }

  function aggregateIpTags(rows) {
    const calls = groupBy(rows, (row) => clean(row["呼叫编码"] || row["IP呼叫ID"]));
    const problemCalls = new Map();
    const childProblemCalls = new Map();
    let negativeCalls = 0;
    calls.forEach((items, callId) => {
      if (items.some(isNegative)) negativeCalls += 1;
      items.filter(isNegative).forEach((row) => {
        const tag = clean(row["一级标签"]);
        if (!tag) return;
        const set = problemCalls.get(tag) || new Set();
        set.add(callId);
        problemCalls.set(tag, set);
        const child = clean(row["二级标签"]);
        if (!child) return;
        const childKey = `${tag}\u0000${child}`;
        const childSet = childProblemCalls.get(childKey) || new Set();
        childSet.add(callId);
        childProblemCalls.set(childKey, childSet);
      });
    });
    return {
      total: calls.size,
      negative: negativeCalls,
      rate: pct(negativeCalls, calls.size),
      problems: normalizeIpProblems(calls.size, [...problemCalls.entries()].map(([name, set]) => ({
        name,
        count: set.size,
        denominator: calls.size,
        rate: pct(set.size, calls.size),
        children: [...childProblemCalls.entries()]
          .filter(([key]) => key.startsWith(`${name}\u0000`))
          .map(([key, childSet]) => ({ name: key.split("\u0000")[1], count: childSet.size }))
          .sort((a, b) => b.count - a.count)
      })).sort((a, b) => b.count - a.count))
    };
  }

  function normalizeIpProblems(total, problems) {
    if (total <= 0) return problems;
    const existing = new Map((problems || []).map((item) => [clean(item.name), item]));
    const fixed = IP_TARGET_TAGS.map((name) => existing.get(name) || { name, count: 0, denominator: total, rate: 0, children: [] });
    const extras = (problems || []).filter((item) => !IP_TARGET_TAGS.includes(clean(item.name)));
    return [...fixed, ...extras];
  }

  function aggregateDriveTags(rows) {
    const events = groupBy(rows, (row) => clean(row["试驾清单ID"]));
    const mentioned = new Map([...events].filter(([, items]) => items.some(isDriveMention)));
    const problemMention = new Map();
    const problemNegative = new Map();
    const childProblemNegative = new Map();
    let negative = 0;
    mentioned.forEach((items, eventId) => {
      const negatives = items.filter((row) => isDriveMention(row) && isDriveJudged(row) && isNegative(row));
      if (negatives.length) negative += 1;
      items.filter(isDriveMention).forEach((row) => {
        const tag = clean(row["一级标签"]);
        const mentionSet = problemMention.get(tag) || new Set();
        mentionSet.add(eventId);
        problemMention.set(tag, mentionSet);
      });
      negatives.forEach((row) => {
        const tag = clean(row["一级标签"]);
        const set = problemNegative.get(tag) || new Set();
        set.add(eventId);
        problemNegative.set(tag, set);
        const child = clean(row["二级标签"]);
        if (!child) return;
        const childKey = `${tag}\u0000${child}`;
        const childSet = childProblemNegative.get(childKey) || new Set();
        childSet.add(eventId);
        childProblemNegative.set(childKey, childSet);
      });
    });
    return {
      total: mentioned.size,
      negative,
      rate: pct(negative, mentioned.size),
      problems: [...problemMention.entries()].map(([name, mentionSet]) => {
        const negativeSet = problemNegative.get(name) || new Set();
        return {
        name,
        count: negativeSet.size,
        denominator: mentionSet.size,
        rate: pct(negativeSet.size, mentionSet.size),
        children: [...childProblemNegative.entries()]
          .filter(([key]) => key.startsWith(`${name}\u0000`))
          .map(([key, childSet]) => ({ name: key.split("\u0000")[1], count: childSet.size }))
          .sort((a, b) => b.count - a.count)
        };
      }).sort((a, b) => b.count - a.count)
    };
  }

  function byStoreAggregate(rows, aggregateFn) {
    return new Map([...groupBy(rows, storeCode)].map(([code, items]) => [code, aggregateFn(items)]));
  }

  function aggregateStoreMap(rows) {
    return new Map((rows || []).filter((row) => clean(row.code)).map((row) => [clean(row.code), row]));
  }

  function mergeProcessAggregates(rows) {
    const problems = new Map();
    let total = 0;
    let negative = 0;
    (rows || []).forEach((row) => {
      total += n(row.total);
      negative += n(row.negative);
      (row.problems || []).forEach((problem) => {
        const item = problems.get(clean(problem.name)) || { name: clean(problem.name), count: 0, denominator: 0, children: new Map() };
        item.count += n(problem.count);
        item.denominator += n(problem.denominator);
        (problem.children || []).forEach((child) => item.children.set(clean(child.name), n(item.children.get(clean(child.name))) + n(child.count)));
        problems.set(item.name, item);
      });
    });
    return {
      total,
      negative,
      rate: pct(negative, total),
      problems: [...problems.values()].filter((item) => item.name).map((item) => ({
        name: item.name,
        count: item.count,
        denominator: item.denominator,
        rate: pct(item.count, item.denominator),
        children: [...item.children].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count)
      })).sort((left, right) => right.count - left.count)
    };
  }

  function sameStoreSet(sourceRows, scopedRows, validDealerMap) {
    if (!Array.isArray(sourceRows) || !validDealerMap) return false;
    const sourceCodes = new Set(sourceRows.map((row) => clean(row.code)).filter(Boolean));
    const scopedCodes = new Set(scopedRows.map((row) => clean(row.code)).filter(Boolean));
    if (sourceCodes.size !== scopedCodes.size) return false;
    return [...sourceCodes].every((code) => scopedCodes.has(code) && validDealerMap.has(code));
  }

  function scopedProcessAggregate(sourceAgg, sourceStores, scopedStores, fallbackRows, aggregateFn, validDealerMap) {
    if (Array.isArray(sourceStores)) {
      if (sourceAgg && sameStoreSet(sourceStores, scopedStores, validDealerMap)) return sourceAgg;
      return mergeProcessAggregates(scopedStores);
    }
    return aggregateFn(fallbackRows);
  }

  function dealerMap(validDealers) {
    return new Map((validDealers || []).filter((item) => clean(item.code)).map((item) => [clean(item.code), {
      code: clean(item.code),
      name: clean(item.name),
      areaCode: clean(item.areaCode),
      area: clean(item.area),
      districtCode: clean(item.districtCode),
      district: clean(item.district)
    }]));
  }

  function rowsInDealerScope(rows, validDealerMap) {
    if (!validDealerMap) return rows;
    return (rows || []).filter((row) => validDealerMap.has(storeCode(row)));
  }

  function scopedRaw(raw, validDealerMap) {
    if (!validDealerMap) return raw;
    const targetRows = raw.monthlyTarget?.targets || [];
    const missingTargetDealerCodes = new Set(targetRows
      .filter((row) => row.retailHasTarget)
      .map((row) => clean(row.dealerCode))
      .filter((code) => code && !validDealerMap.has(code)));
    const monthlyTarget = raw.monthlyTarget ? {
      ...raw.monthlyTarget,
      targets: targetRows.flatMap((row) => {
        if (row.orderHasTarget) {
          return [{ ...row, retailHasTarget: row.retailHasTarget === true && validDealerMap.has(clean(row.dealerCode)) }];
        }
        return row.retailHasTarget && validDealerMap.has(clean(row.dealerCode)) ? [row] : [];
      }),
      targetActuals: (raw.monthlyTarget.targetActuals || []).filter((row) => validDealerMap.has(clean(row.dealerCode))),
      audit: { ...(raw.monthlyTarget.audit || {}), validDealerMissingRows: n(raw.monthlyTarget.audit?.validDealerMissingRows) + missingTargetDealerCodes.size }
    } : raw.monthlyTarget;
    const ipTags = rowsInDealerScope(raw.ipTags, validDealerMap);
    const ipTagsPrev = rowsInDealerScope(raw.ipTagsPrev, validDealerMap);
    const ipTagsWeek = rowsInDealerScope(raw.ipTagsWeek || [], validDealerMap);
    const ipAggStores = (raw.ipAggStores || []).filter((row) => validDealerMap.has(clean(row.code)));
    const ipAggStoresPrev = (raw.ipAggStoresPrev || []).filter((row) => validDealerMap.has(clean(row.code)));
    const ipAggStoresWeek = (raw.ipAggStoresWeek || []).filter((row) => validDealerMap.has(clean(row.code)));
    const driveTags = rowsInDealerScope(raw.driveTags, validDealerMap);
    const driveTagsPrev = rowsInDealerScope(raw.driveTagsPrev, validDealerMap);
    const driveTagsWeek = rowsInDealerScope(raw.driveTagsWeek || [], validDealerMap);
    const driveTagAggStores = (raw.driveTagAggStores || []).filter((row) => validDealerMap.has(clean(row.code)));
    const driveTagAggStoresPrev = (raw.driveTagAggStoresPrev || []).filter((row) => validDealerMap.has(clean(row.code)));
    const driveTagAggStoresWeek = (raw.driveTagAggStoresWeek || []).filter((row) => validDealerMap.has(clean(row.code)));
    return {
      ...raw,
      sales: rowsInDealerScope(raw.sales || [], validDealerMap),
      salesPrev: rowsInDealerScope(raw.salesPrev || [], validDealerMap),
      salesWeek: rowsInDealerScope(raw.salesWeek || [], validDealerMap),
      dcc: rowsInDealerScope(raw.dcc || [], validDealerMap),
      dccPrev: rowsInDealerScope(raw.dccPrev || [], validDealerMap),
      drive: rowsInDealerScope(raw.drive || [], validDealerMap),
      drivePrev: rowsInDealerScope(raw.drivePrev || [], validDealerMap),
      orders: rowsInDealerScope(raw.orders || [], validDealerMap),
      ordersPrev: rowsInDealerScope(raw.ordersPrev || [], validDealerMap),
      ipTags, ipTagsPrev, ipTagsWeek,
      ipAgg: scopedProcessAggregate(raw.ipAgg, raw.ipAggStores, ipAggStores, ipTags, aggregateIpTags, validDealerMap),
      ipAggPrev: scopedProcessAggregate(raw.ipAggPrev, raw.ipAggStoresPrev, ipAggStoresPrev, ipTagsPrev, aggregateIpTags, validDealerMap),
      ipAggWeek: scopedProcessAggregate(raw.ipAggWeek, raw.ipAggStoresWeek, ipAggStoresWeek, ipTagsWeek, aggregateIpTags, validDealerMap),
      ipAggStores, ipAggStoresPrev, ipAggStoresWeek,
      driveTags, driveTagsPrev, driveTagsWeek,
      driveTagAgg: scopedProcessAggregate(raw.driveTagAgg, raw.driveTagAggStores, driveTagAggStores, driveTags, aggregateDriveTags, validDealerMap),
      driveTagAggPrev: scopedProcessAggregate(raw.driveTagAggPrev, raw.driveTagAggStoresPrev, driveTagAggStoresPrev, driveTagsPrev, aggregateDriveTags, validDealerMap),
      driveTagAggWeek: scopedProcessAggregate(raw.driveTagAggWeek, raw.driveTagAggStoresWeek, driveTagAggStoresWeek, driveTagsWeek, aggregateDriveTags, validDealerMap),
      driveTagAggStores, driveTagAggStoresPrev, driveTagAggStoresWeek,
      monthlyTarget
    };
  }

  function emptyMetricTarget(status = "no_target", error = "") {
    return { status, error, target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0 };
  }

  function emptyTarget(status = "no_target", error = "") {
    return {
      status,
      error,
      order: emptyMetricTarget(status, error),
      retail: emptyMetricTarget(status, error),
      target: 0,
      actual: 0,
      achievement: null,
      unconfiguredActual: 0,
      conflictKeys: 0,
      hasTarget: false,
      validDealerMissingRows: 0
    };
  }

  function orderTargetMapsToValidDealer(group, validDealerMap) {
    const dealerCode = clean(group.realDealerCode);
    return Boolean(dealerCode && validDealerMap?.has(dealerCode));
  }

  function buildTargetSummary(raw, validDealerMap) {
    const source = raw.monthlyTarget;
    const emptySummary = (status, error = "", audit = {}, months = []) => ({
      overall: emptyTarget(status, error),
      byStore: new Map(),
      bySeries: new Map(),
      orderTargetStores: [],
      audit,
      months
    });
    if (!source) return emptySummary("no_target");
    if (source.status === "loading") return emptySummary("loading", source.error, source.audit || {}, source.months || []);
    if (source.status === "invalid_range" || source.status === "non_mg") return emptySummary(source.status, "", source.audit || {}, source.months || []);
    const sourceStatus = {
      order: source.orderStatus || source.status || "ready",
      retail: source.retailStatus || source.status || "ready",
      orderError: source.orderError || source.error || "",
      retailError: source.retailError || source.error || ""
    };
    const targets = source.targets || [];
    const months = source.months || [];
    const targetMonths = new Set(targets.map((row) => row.month));
    const completeTargetMonths = targets.length > 0 && !(months.length > 1 && months.some((month) => !targetMonths.has(month)));
    const effectiveTargets = completeTargetMonths ? targets : [];
    const actualByKey = { order: new Map(), retail: new Map() };
    (source.targetActuals || []).forEach((row) => {
      const key = targetKey(row);
      actualByKey.order.set(key, (actualByKey.order.get(key) || 0) + n(row.actualOrders));
      actualByKey.retail.set(key, (actualByKey.retail.get(key) || 0) + n(row.actualRetail));
    });
    const byStore = new Map();
    const bySeries = new Map();
    const orderGroups = new Map();
    const orderGroupsByActualKey = new Map();
    const audit = { ...(source.audit || {}), unmappedOrderActualRows: 0, unmappedOrderActualTarget: 0 };
    function ensureStore(code) {
      if (!byStore.has(code)) byStore.set(code, emptyTarget("configured"));
      return byStore.get(code);
    }
    function ensureSeries(series) {
      if (!bySeries.has(series)) bySeries.set(series, { order: emptyMetricTarget("configured"), retail: emptyMetricTarget("configured") });
      return bySeries.get(series);
    }
    const validKeys = { order: new Set(), retail: new Set() };
    effectiveTargets.forEach((row) => {
      if (!row.orderHasTarget) return;
      const actualKey = row.actualKey || targetKey(row);
      validKeys.order.add(actualKey);
      const areaIdentity = clean(row.orderAreaIdentity) || `area:${clean(row.areaCode) || clean(row.area) || "missing"}`;
      const districtIdentity = clean(row.orderDistrictIdentity) || `district:${areaIdentity}:${clean(row.districtCode) || clean(row.district) || "missing"}`;
      const dealerIdentity = clean(row.orderDealerIdentity) || `dealer:${districtIdentity}:${clean(row.dealerCode) || clean(row.dealerName) || "missing"}`;
      const group = orderGroups.get(dealerIdentity) || {
        code: dealerIdentity,
        name: clean(row.dealerName) || clean(row.dealerCode) || clean(row.district) || clean(row.area) || "订单目标",
        areaCode: areaIdentity,
        area: clean(row.area),
        districtCode: districtIdentity,
        district: clean(row.district),
        sourceAreaCode: clean(row.areaCode),
        sourceDistrictCode: clean(row.districtCode),
        realDealerCode: clean(row.dealerCode),
        targetOnly: true,
        hasValidDealerCode: Boolean(validDealerMap?.has(clean(row.dealerCode))),
        monthlyTarget: emptyTarget("no_target")
      };
      group.monthlyTarget.order.status = "configured";
      group.monthlyTarget.order.target += n(row.orderTarget);
      group.monthlyTarget.order.hasTarget = true;
      orderGroups.set(dealerIdentity, group);
      if (!orderGroupsByActualKey.has(actualKey)) orderGroupsByActualKey.set(actualKey, new Set());
      orderGroupsByActualKey.get(actualKey).add(dealerIdentity);
      const seriesMetric = ensureSeries(row.vehicleSeries).order;
      seriesMetric.target += n(row.orderTarget);
      seriesMetric.hasTarget = true;
      if (!clean(row.dealerCode) || !validDealerMap?.has(clean(row.dealerCode))) {
        audit.unmappedOrderActualRows += 1;
        audit.unmappedOrderActualTarget += n(row.orderTarget);
      }
    });
    orderGroupsByActualKey.forEach((groupIds, actualKey) => {
      const candidates = [...groupIds].map((id) => orderGroups.get(id)).filter(Boolean);
      const chosen = candidates
        .filter((group) => orderTargetMapsToValidDealer(group, validDealerMap))
        .sort((left, right) => clean(left.code).localeCompare(clean(right.code)))[0];
      if (chosen) chosen.monthlyTarget.order.actual += actualByKey.order.get(actualKey) || 0;
    });
    const actualSeriesKeys = new Set();
    effectiveTargets.forEach((row) => {
      if (!row.orderHasTarget) return;
      const actualKey = row.actualKey || targetKey(row);
      if (actualSeriesKeys.has(actualKey)) return;
      actualSeriesKeys.add(actualKey);
      ensureSeries(row.vehicleSeries).order.actual += actualByKey.order.get(actualKey) || 0;
    });
    effectiveTargets.forEach((row) => {
      if (!row.retailHasTarget) return;
      const key = targetKey(row);
      validKeys.retail.add(key);
      const actual = actualByKey.retail.get(key) || 0;
      const storeMetric = ensureStore(row.dealerCode).retail;
      storeMetric.target += n(row.retailTarget);
      storeMetric.actual += actual;
      storeMetric.hasTarget = true;
      const seriesMetric = ensureSeries(row.vehicleSeries).retail;
      seriesMetric.target += n(row.retailTarget);
      seriesMetric.actual += actual;
      seriesMetric.hasTarget = true;
    });
    Object.entries(source.audit?.conflictByStore?.order || {}).forEach(([code, count]) => {
      ensureStore(code).order.conflictKeys += n(count);
    });
    Object.entries(source.audit?.conflictByStore?.retail || {}).forEach(([code, count]) => {
      ensureStore(code).retail.conflictKeys += n(count);
    });
    (source.targetActuals || []).forEach((row) => {
      const key = targetKey(row);
      if (!validKeys.order.has(key)) ensureStore(row.dealerCode).order.unconfiguredActual += n(row.actualOrders);
      if (!validKeys.retail.has(key)) ensureStore(row.dealerCode).retail.unconfiguredActual += n(row.actualRetail);
    });
    byStore.forEach((value) => {
      if (sourceStatus.order === "unavailable") value.order = emptyMetricTarget("unavailable", sourceStatus.orderError);
      if (sourceStatus.retail === "unavailable") value.retail = emptyMetricTarget("unavailable", sourceStatus.retailError);
      finalizeMetricTarget(value.order, audit);
      finalizeMetricTarget(value.retail, audit);
      syncLegacyTargetFields(value);
    });
    bySeries.forEach((value) => {
      finalizeMetricTarget(value.order, audit);
      finalizeMetricTarget(value.retail, audit);
    });
    const orderTargetStores = [...orderGroups.values()].map((group) => {
      if (sourceStatus.order === "unavailable") group.monthlyTarget.order = emptyMetricTarget("unavailable", sourceStatus.orderError);
      if (sourceStatus.retail === "unavailable") group.monthlyTarget.retail = emptyMetricTarget("unavailable", sourceStatus.retailError);
      finalizeMetricTarget(group.monthlyTarget.order, audit);
      finalizeMetricTarget(group.monthlyTarget.retail, audit);
      syncLegacyTargetFields(group.monthlyTarget);
      return group;
    });
    const overall = [...byStore.values()].reduce((acc, item) => {
      mergeMetricTarget(acc.order, item.order);
      mergeMetricTarget(acc.retail, item.retail);
      return acc;
    }, emptyTarget("configured"));
    orderTargetStores.forEach((store) => mergeMetricTarget(overall.order, store.monthlyTarget.order));
    if (sourceStatus.order === "unavailable") overall.order = emptyMetricTarget("unavailable", sourceStatus.orderError);
    if (sourceStatus.retail === "unavailable") overall.retail = emptyMetricTarget("unavailable", sourceStatus.retailError);
    finalizeMetricTarget(overall.order, audit);
    finalizeMetricTarget(overall.retail, audit);
    syncLegacyTargetFields(overall);
    return { overall, byStore, bySeries, orderTargetStores, audit, months };
  }

  function mergeMetricTarget(total, item) {
    total.target += n(item.target);
    total.actual += n(item.actual);
    total.unconfiguredActual += n(item.unconfiguredActual);
    total.conflictKeys += n(item.conflictKeys);
    total.hasTarget = total.hasTarget || item.hasTarget === true;
  }

  function finalizeMetricTarget(target, audit = {}) {
    if (target.status !== "unavailable") target.status = target.hasTarget ? "configured" : "no_target";
    target.achievement = target.target > 0 ? (target.actual / target.target) * 100 : null;
    target.validDealerMissingRows = n(audit.validDealerMissingRows);
    return target;
  }

  function syncLegacyTargetFields(target) {
    target.target = target.order.target;
    target.actual = target.order.actual;
    target.achievement = target.order.achievement;
    target.unconfiguredActual = target.order.unconfiguredActual;
    target.conflictKeys = target.order.conflictKeys + target.retail.conflictKeys;
    target.hasTarget = target.order.hasTarget || target.retail.hasTarget;
    target.validDealerMissingRows = Math.max(n(target.order.validDealerMissingRows), n(target.retail.validDealerMissingRows));
    target.status = target.order.status === "unavailable" && target.retail.status === "unavailable"
      ? "unavailable"
      : target.hasTarget ? "configured" : target.order.status === "non_mg" || target.retail.status === "non_mg" ? "non_mg" : "no_target";
    target.error = target.order.error || target.retail.error || "";
    return target;
  }

  function targetSourceState(raw) {
    const source = raw?.monthlyTarget;
    if (!source) return { hasRows: false, status: "no_target" };
    const targets = source.targets || [];
    const actuals = source.targetActuals || [];
    return {
      hasRows: targets.length > 0 || actuals.length > 0,
      status: source.status || "ready",
      orderStatus: source.orderStatus || "",
      retailStatus: source.retailStatus || ""
    };
  }

  function hasRawSalesData(raw) {
    return (raw.sales || []).length > 0;
  }

  function hasTargetDisplayState(raw) {
    const targetState = targetSourceState(raw);
    return targetState.hasRows
      || [targetState.status, targetState.orderStatus, targetState.retailStatus].some((status) => ["loading", "unavailable"].includes(status));
  }

  function hasSummaryData(raw) {
    return hasRawSalesData(raw) || hasTargetDisplayState(raw);
  }

  function buildRawOverallTarget(raw) {
    const source = raw.monthlyTarget;
    if (!source) return emptyTarget("no_target");
    if (source.status === "loading") return emptyTarget("loading", source.error);
    if (source.status === "invalid_range" || source.status === "non_mg") return emptyTarget(source.status);
    const sourceStatus = {
      order: source.orderStatus || source.status || "ready",
      retail: source.retailStatus || source.status || "ready",
      orderError: source.orderError || source.error || "",
      retailError: source.retailError || source.error || ""
    };
    const targets = source.targets || [];
    const months = source.months || [];
    const targetMonths = new Set(targets.map((row) => row.month));
    const completeTargetMonths = targets.length > 0 && !(months.length > 1 && months.some((month) => !targetMonths.has(month)));
    const effectiveTargets = completeTargetMonths ? targets : [];
    const overall = emptyTarget("configured");
    effectiveTargets.forEach((row) => {
      if (row.orderHasTarget) {
        overall.order.target += n(row.orderTarget);
        overall.order.hasTarget = true;
      }
      if (row.retailHasTarget) {
        overall.retail.target += n(row.retailTarget);
        overall.retail.hasTarget = true;
      }
    });
    (source.targetActuals || []).forEach((row) => {
      overall.order.actual += n(row.actualOrders);
      overall.retail.actual += n(row.actualRetail);
    });
    if (sourceStatus.order === "unavailable") overall.order = emptyMetricTarget("unavailable", sourceStatus.orderError);
    if (sourceStatus.retail === "unavailable") overall.retail = emptyMetricTarget("unavailable", sourceStatus.retailError);
    finalizeMetricTarget(overall.order, source.audit || {});
    finalizeMetricTarget(overall.retail, source.audit || {});
    return syncLegacyTargetFields(overall);
  }

  function buildWorkbench(raw, options = {}) {
    const validDealerMap = options.validDealers ? dealerMap(options.validDealers) : null;
    const scoped = scopedRaw(raw, validDealerMap);
    const salesCurrent = sumSales(raw.sales || []);
    const salesPrevious = sumSales(raw.salesPrev || []);
    const salesWeek = sumSales(raw.salesWeek || []);
    const dcc = aggregateDcc(scoped.dcc);
    const dccPrev = aggregateDcc(scoped.dccPrev);
    const drive = aggregateDrive(scoped.drive);
    const drivePrev = aggregateDrive(scoped.drivePrev);
    const trialOrder = aggregateTrialOrder(scoped.drive, scoped.orders);
    const trialOrderPrev = aggregateTrialOrder(scoped.drivePrev, scoped.ordersPrev);
    const ip = scoped.ipAgg || aggregateIpTags(scoped.ipTags);
    const ipPrev = scoped.ipAggPrev || aggregateIpTags(scoped.ipTagsPrev);
    const ipWeek = scoped.ipAggWeek || aggregateIpTags(scoped.ipTagsWeek || []);
    const driveTags = scoped.driveTagAgg || aggregateDriveTags(scoped.driveTags);
    const driveTagsPrev = scoped.driveTagAggPrev || aggregateDriveTags(scoped.driveTagsPrev);
    const driveTagsWeek = scoped.driveTagAggWeek || aggregateDriveTags(scoped.driveTagsWeek || []);
    const scopedMonthlyTarget = buildTargetSummary(scoped, validDealerMap);
    const stores = buildStores(scoped, salesByStore(scoped.sales), salesByStore(scoped.salesPrev), salesByStore(scoped.salesWeek || []), validDealerMap, scopedMonthlyTarget);
    return {
      raw: scoped,
      salesCurrent,
      salesPrevious,
      salesWeek,
      dcc,
      dccPrev,
      drive,
      drivePrev,
      trialOrder,
      trialOrderPrev,
      ip,
      ipPrev,
      ipWeek,
      driveTags,
      driveTagsPrev,
      driveTagsWeek,
      monthlyTarget: buildRawOverallTarget(raw),
      targetByStore: scopedMonthlyTarget.byStore,
      targetBySeries: scopedMonthlyTarget.bySeries,
      targetAudit: scopedMonthlyTarget.audit,
      hasRawSalesData: hasRawSalesData(raw),
      hasTargetDisplayState: hasTargetDisplayState(raw),
      hasSummaryData: hasSummaryData(raw),
      stores
    };
  }

  function buildStores(raw, currentSales, previousSales, weekSales, validDealerMap, monthlyTarget) {
    const ipByStore = raw.ipAggStores?.length ? aggregateStoreMap(raw.ipAggStores) : byStoreAggregate(raw.ipTags, aggregateIpTags);
    const ipPrevByStore = raw.ipAggStoresPrev?.length ? aggregateStoreMap(raw.ipAggStoresPrev) : byStoreAggregate(raw.ipTagsPrev, aggregateIpTags);
    const ipWeekByStore = raw.ipAggStoresWeek?.length ? aggregateStoreMap(raw.ipAggStoresWeek) : byStoreAggregate(raw.ipTagsWeek || [], aggregateIpTags);
    const driveByStore = raw.driveTagAggStores?.length ? aggregateStoreMap(raw.driveTagAggStores) : byStoreAggregate(raw.driveTags, aggregateDriveTags);
    const drivePrevByStore = raw.driveTagAggStoresPrev?.length ? aggregateStoreMap(raw.driveTagAggStoresPrev) : byStoreAggregate(raw.driveTagsPrev, aggregateDriveTags);
    const driveWeekByStore = raw.driveTagAggStoresWeek?.length ? aggregateStoreMap(raw.driveTagAggStoresWeek) : byStoreAggregate(raw.driveTagsWeek || [], aggregateDriveTags);
    const factCodes = new Set([currentSales, previousSales, weekSales, ipByStore, ipPrevByStore, ipWeekByStore, driveByStore, drivePrevByStore, driveWeekByStore, monthlyTarget?.byStore || new Map()].flatMap((map) => [...map.keys()]));
    const emptySales = () => ({ leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0, stores: new Map() });
    const targetForStore = (code) => {
      if (monthlyTarget?.byStore?.has(code)) return monthlyTarget.byStore.get(code);
      if (monthlyTarget?.overall?.status === "loading" || monthlyTarget?.overall?.status === "invalid_range" || monthlyTarget?.overall?.status === "non_mg") return emptyTarget(monthlyTarget.overall.status, monthlyTarget.overall.error);
      if (monthlyTarget?.overall?.order?.status === "unavailable" || monthlyTarget?.overall?.retail?.status === "unavailable") {
        const target = emptyTarget("no_target");
        if (monthlyTarget.overall.order?.status === "unavailable") target.order = emptyMetricTarget("unavailable", monthlyTarget.overall.order.error);
        if (monthlyTarget.overall.retail?.status === "unavailable") target.retail = emptyMetricTarget("unavailable", monthlyTarget.overall.retail.error);
        return syncLegacyTargetFields(target);
      }
      return emptyTarget("no_target");
    };
    const factStores = [...factCodes].filter((code) => !validDealerMap || validDealerMap.has(code)).map((code) => {
      const current = currentSales.get(code) || emptySales();
      const previous = previousSales.get(code) || emptySales();
      const week = weekSales.get(code) || emptySales();
      const info = validDealerMap?.get(code) || current.stores?.get(code) || previous.stores?.get(code) || week.stores?.get(code) || { code, name: "未知门店", area: "", district: "" };
      const ip = ipByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const ipPrev = ipPrevByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const ipWeek = ipWeekByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const driveTag = driveByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const drivePrev = drivePrevByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const driveWeek = driveWeekByStore.get(code) || { total: 0, negative: 0, rate: null, problems: [] };
      const issue = [...ip.problems, ...driveTag.problems].filter((item) => (item.count || 0) > 0).sort((a, b) => b.count - a.count)[0]?.name || "暂无负向问题";
      return { ...info, current, previous, week, monthlyTarget: targetForStore(code), ip, ipPrev, ipWeek, driveTag, drivePrev, driveWeek, issue, direction: "逻辑待确认", totalNegative: (ip.negative || 0) + (driveTag.negative || 0) };
    });
    const emptyProcess = () => ({ total: 0, negative: 0, rate: null, problems: [] });
    const targetOnlyStores = (monthlyTarget?.orderTargetStores || []).map((store) => ({
      ...store,
      current: emptySales(),
      previous: emptySales(),
      week: emptySales(),
      ip: emptyProcess(),
      ipPrev: emptyProcess(),
      ipWeek: emptyProcess(),
      driveTag: emptyProcess(),
      drivePrev: emptyProcess(),
      driveWeek: emptyProcess(),
      issue: "样本不足",
      direction: "逻辑待确认",
      totalNegative: 0
    }));
    return [...factStores, ...targetOnlyStores].sort((a, b) => (pct(a.current.orders, a.current.leads) ?? 999) - (pct(b.current.orders, b.current.leads) ?? 999));
  }

  window.RegionMetrics = { buildWorkbench, buildDynamicStoreDiagnoses, pct, n };
})();
