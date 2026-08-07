(function (root) {
  const PROFILE_KEY = "retail-cockpit:personnel-profile";
  const LEVELS = { area: 0, district: 1, store: 2 };
  const ROLE_DEFAULT_LEVEL = { headquarters: "area", region: "district", district: "store", sales_director: "store", investor: "store" };
  const LEVEL_META = {
    area: { firstColumn: "大区", action: "查看小区", title: "大区", scope: "全国" },
    district: { firstColumn: "小区", action: "查看门店", title: "小区", scope: "大区" },
    store: { firstColumn: "经销商名称", action: "门店详情", title: "门店", scope: "小区" }
  };

  function text(value) { return value == null ? "" : String(value).trim(); }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function rate(numerator, denominator) { return denominator > 0 ? (numerator / denominator) * 100 : null; }
  function specific(value) { const valueText = text(value); return Boolean(valueText && valueText !== "全部"); }

  function readPersonnelProfile(storage = root.sessionStorage) {
    try {
      const raw = storage?.getItem(PROFILE_KEY);
      if (!raw) return { ok: false, profile: {}, reason: "未获取到人员画像" };
      const profile = JSON.parse(raw);
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { ok: false, profile: {}, reason: "人员画像格式无效" };
      return { ok: true, profile, reason: "" };
    } catch (error) {
      return { ok: false, profile: {}, reason: "人员画像 JSON 无效" };
    }
  }

  function resolveRole(profileResult) {
    if (!profileResult?.ok) return { ok: false, role: "unknown", label: "未知角色", reason: profileResult?.reason || "人员画像缺失" };
    const profile = profileResult.profile || {};
    const rawUserType = profile.marketing_userType;
    const rawOrgType = profile.marketing_orgType;
    const userType = text(rawUserType);
    const hasUserType = rawUserType != null && (!(typeof rawUserType === "string") || Boolean(userType));
    const hasOrgType = rawOrgType != null && (!(typeof rawOrgType === "string") || Boolean(text(rawOrgType)));
    const resolveOrgTypeRole = () => {
      if (typeof rawOrgType !== "string") return { ok: false, role: "unknown", label: "未知角色", reason: "marketing_orgType 类型无效", profile };
      const orgType = rawOrgType.trim().toUpperCase();
      if (!orgType) return { ok: false, role: "unknown", label: "未知角色", reason: "marketing_orgType 缺失", profile };
      if (orgType === "MAC") return { ok: true, role: "district", label: "小区", profile };
      if (orgType === "RFS") return { ok: true, role: "region", label: "大区", profile };
      if (orgType === "HQ") return { ok: true, role: "headquarters", label: "总部", profile };
      if (userType === "4") {
        return {
          ok: true,
          role: "headquarters",
          label: "总部",
          compatibility: true,
          inferred: true,
          reason: `marketing_userType=4 且 marketing_orgType=${orgType} 未识别，按兼容总部候选态加载`,
          profile
        };
      }
      return { ok: false, role: "unknown", label: "未知角色", reason: "marketing_orgType 不在已配置范围", profile };
    };
    if (!hasUserType) {
      return hasOrgType ? resolveOrgTypeRole() : { ok: true, role: "headquarters", label: "总部", inferred: true, reason: "marketing_userType 和 marketing_orgType 双空，按总部入口加载", profile };
    }
    if (!(["string", "number"].includes(typeof rawUserType)) || (typeof rawUserType === "number" && !Number.isFinite(rawUserType))) {
      return { ok: false, role: "unknown", label: "未知角色", reason: "marketing_userType 类型无效", profile };
    }
    if (userType === "2") return { ok: true, role: "sales_director", label: "销售总监", profile };
    if (userType === "6") return { ok: true, role: "investor", label: "投资人", profile };
    if (userType !== "4") return { ok: false, role: "unknown", label: "未知角色", reason: "marketing_userType 不在已配置范围", profile };
    return resolveOrgTypeRole();
  }

  function resolveEntryLevel(role, params = {}) {
    const defaultLevel = ROLE_DEFAULT_LEVEL[role];
    if (!defaultLevel) return null;
    if (specific(params.dealerCode) || specific(params.store)) return "store";
    if (specific(params.districtCode) || specific(params.district)) return "store";
    if (specific(params.areaCode) || specific(params.area)) return LEVELS[defaultLevel] < LEVELS.district ? "district" : defaultLevel;
    return defaultLevel;
  }

  function createViewState(roleResult, params = {}) {
    const entryLevel = roleResult?.ok ? resolveEntryLevel(roleResult.role, params) : null;
    return { role: roleResult, entryLevel, viewLevel: entryLevel, drillPath: [] };
  }

  function drillDown(viewState, row) {
    if (!viewState?.viewLevel || viewState.viewLevel === "store") return viewState;
    const nextLevel = viewState.viewLevel === "area" ? "district" : "store";
    return { ...viewState, viewLevel: nextLevel, drillPath: [...viewState.drillPath, { level: viewState.viewLevel, code: row.code, name: row.name }] };
  }

  function drillBack(viewState) {
    if (!viewState?.drillPath?.length) return viewState;
    const drillPath = viewState.drillPath.slice(0, -1);
    const viewLevel = viewState.drillPath[viewState.drillPath.length - 1].level;
    return { ...viewState, viewLevel, drillPath };
  }

  function sumMeasures(stores, field) {
    return stores.reduce((total, store) => {
      const values = store[field] || {};
      ["leads", "arrivals", "drives", "orders", "retail"].forEach((key) => { total[key] += number(values[key]); });
      return total;
    }, { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 });
  }

  function sumTarget(stores) {
    return stores.reduce((total, store) => {
      const target = store.monthlyTarget || {};
      mergeMetricTarget(total.order, target.order || target);
      mergeMetricTarget(total.retail, target.retail || {});
      return total;
    }, emptyTarget("configured"));
  }

  function finalizeTarget(target) {
    const result = {
      ...target,
      order: finalizeMetricTarget({ ...(target.order || target) }),
      retail: finalizeMetricTarget({ ...(target.retail || {}) })
    };
    result.target = result.order.target;
    result.actual = result.order.actual;
    result.achievement = result.order.achievement;
    result.unconfiguredActual = result.order.unconfiguredActual;
    result.conflictKeys = number(result.order.conflictKeys) + number(result.retail.conflictKeys);
    result.hasTarget = result.order.hasTarget || result.retail.hasTarget;
    result.validDealerMissingRows = Math.max(number(result.order.validDealerMissingRows), number(result.retail.validDealerMissingRows));
    result.status = result.order.status === "unavailable" && result.retail.status === "unavailable"
      ? "unavailable"
      : result.hasTarget ? "configured" : result.order.status === "non_mg" || result.retail.status === "non_mg" ? "non_mg" : "no_target";
    result.error = result.order.error || result.retail.error || "";
    return result;
  }

  function emptyMetricTarget(status = "no_target", error = "") {
    return { status, error, target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0 };
  }

  function emptyTarget(status = "no_target", error = "") {
    return { status, error, order: emptyMetricTarget(status, error), retail: emptyMetricTarget(status, error), target: 0, actual: 0, achievement: null, unconfiguredActual: 0, conflictKeys: 0, hasTarget: false, validDealerMissingRows: 0 };
  }

  function mergeMetricTarget(total, target) {
    if (target.status === "unavailable") {
      total.status = "unavailable";
      total.error = total.error || target.error || "月目标数据暂不可用";
    }
    if (target.status === "invalid_range" && total.status !== "unavailable") total.status = "invalid_range";
    if (target.status === "non_mg" && total.status !== "unavailable") total.status = "non_mg";
    total.target += number(target.target);
    total.actual += number(target.actual);
    total.unconfiguredActual += number(target.unconfiguredActual);
    total.conflictKeys += number(target.conflictKeys);
    total.validDealerMissingRows = Math.max(number(total.validDealerMissingRows), number(target.validDealerMissingRows));
    total.hasTarget = total.hasTarget || target.hasTarget === true || number(target.target) > 0;
  }

  function finalizeMetricTarget(target) {
    const status = target.status === "unavailable" ? "unavailable" : target.status === "invalid_range" ? "invalid_range" : target.status === "non_mg" ? "non_mg" : target.hasTarget ? "configured" : "no_target";
    return { ...target, status, achievement: target.target > 0 ? rate(target.actual, target.target) : null };
  }

  function sumProcess(stores, field) {
    const problems = new Map();
    const problemNames = new Set();
    const absentProblemUsesAggregateTotal = ["ip", "ipPrev", "ipWeek"].includes(field);
    let total = 0;
    let negative = 0;
    stores.forEach((store) => {
      ((store[field] || {}).problems || []).forEach((problem) => problemNames.add(problem.name));
    });
    stores.forEach((store) => {
      const aggregate = store[field] || {};
      const presentProblems = new Set();
      total += number(aggregate.total);
      negative += number(aggregate.negative);
      (aggregate.problems || []).forEach((problem) => {
        const item = problems.get(problem.name) || { name: problem.name, count: 0, denominator: 0, children: new Map() };
        item.count += number(problem.count);
        item.denominator += number(problem.denominator ?? aggregate.total);
        (problem.children || []).forEach((child) => item.children.set(child.name, number(item.children.get(child.name)) + number(child.count)));
        problems.set(problem.name, item);
        presentProblems.add(problem.name);
      });
      problemNames.forEach((name) => {
        if (!absentProblemUsesAggregateTotal || presentProblems.has(name)) return;
        const item = problems.get(name) || { name, count: 0, denominator: 0, children: new Map() };
        item.denominator += number(aggregate.total);
        problems.set(name, item);
      });
    });
    return {
      total, negative, rate: rate(negative, total),
      problems: [...problems.values()].map((item) => ({
        name: item.name, count: item.count, denominator: item.denominator, rate: rate(item.count, item.denominator),
        children: [...item.children].map(([name, count]) => ({ name, count }))
      })).sort((left, right) => right.count - left.count)
    };
  }

  function groupIdentity(store, level) {
    if (level === "area") return { code: text(store.areaCode) || text(store.area), name: text(store.area) || "未知大区" };
    if (level === "district") return { code: text(store.districtCode) || text(store.district), name: text(store.district) || "未知小区" };
    return { code: text(store.code), name: text(store.name) || "未知门店" };
  }

  function targetMatchesOrganization(store, candidate, level) {
    if (store.targetOnly !== true) return false;
    const sourceCode = level === "area" ? text(store.sourceAreaCode) : level === "district" ? text(store.sourceDistrictCode) : text(store.realDealerCode);
    const sourceName = level === "area" ? text(store.area) : level === "district" ? text(store.district) : text(store.name);
    if (sourceCode && sourceCode === text(candidate.code)) return true;
    return Boolean(sourceName && sourceName === text(candidate.name));
  }

  function targetMatchesStore(target, store) {
    if (!targetMatchesOrganization(target, { code: store.code, name: store.name }, "store")) return false;
    return targetMatchesOrganization(target, { code: store.areaCode, name: store.area }, "area")
      && targetMatchesOrganization(target, { code: store.districtCode, name: store.district }, "district");
  }

  function aggregateStores(stores, level) {
    if (level === "store") {
      const rows = [];
      const standardRows = (stores || []).filter((store) => store.targetOnly !== true);
      standardRows.forEach((store) => rows.push({ ...store, level, stores: [store], validStoreCount: 1, targetOnly: false }));
      (stores || []).filter((store) => store.targetOnly === true).forEach((target) => {
        const match = rows.find((row) => targetMatchesStore(target, row));
        if (match) match.stores.push(target);
        else rows.push({ ...target, level, stores: [target], validStoreCount: 0, targetOnly: true });
      });
      return rows.map((row) => ({ ...row, monthlyTarget: finalizeTarget(sumTarget(row.stores)) }));
    }
    const groups = new Map();
    const addToGroup = (store, preferredGroup) => {
      const identity = groupIdentity(store, level);
      if (!identity.code) return;
      const key = `${level}:${identity.code}`;
      const group = preferredGroup || groups.get(key) || { ...identity, level, area: store.area, areaCode: store.areaCode, district: level === "district" ? store.district : "", districtCode: level === "district" ? store.districtCode : "", stores: [] };
      group.stores.push(store);
      groups.set(`${level}:${group.code}`, group);
    };
    (stores || []).filter((store) => store.targetOnly !== true).forEach((store) => addToGroup(store));
    (stores || []).filter((store) => store.targetOnly === true).forEach((store) => {
      const matchingGroup = [...groups.values()].find((group) => targetMatchesOrganization(store, group, level));
      addToGroup(store, matchingGroup);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      validStoreCount: group.stores.filter((store) => store.targetOnly !== true).length,
      targetOnly: group.stores.every((store) => store.targetOnly === true),
      current: sumMeasures(group.stores, "current"), previous: sumMeasures(group.stores, "previous"), week: sumMeasures(group.stores, "week"),
      monthlyTarget: finalizeTarget(sumTarget(group.stores)),
      ip: sumProcess(group.stores, "ip"), ipPrev: sumProcess(group.stores, "ipPrev"), ipWeek: sumProcess(group.stores, "ipWeek"),
      driveTag: sumProcess(group.stores, "driveTag"), drivePrev: sumProcess(group.stores, "drivePrev"), driveWeek: sumProcess(group.stores, "driveWeek")
    }));
  }

  function applyDrillPath(stores, drillPath = []) {
    return (stores || []).filter((store) => drillPath.every((item) => {
      if (item.level !== "area" && item.level !== "district") return true;
      const identity = groupIdentity(store, item.level);
      if (identity.code === item.code) return true;
      return store.targetOnly === true && targetMatchesOrganization(store, item, item.level);
    }));
  }

  function comparisonKey(row, level, rankScope = "default") {
    if (rankScope === "portfolio" && level === "store") return "__PORTFOLIO__";
    if (level === "area") return "__NATIONAL__";
    if (level === "district") return text(row.areaCode) || text(row.area) || "__AREA__";
    return text(row.districtCode) || text(row.district) || "__DISTRICT__";
  }

  function rankRows(rows, metric, level, nationalComplete = true, rankScope = "default") {
    const result = new Map();
    if (level === "area" && !nationalComplete) return result;
    const groups = new Map();
    rows.forEach((row) => {
      const key = comparisonKey(row, level, rankScope);
      groups.set(key, [...(groups.get(key) || []), row]);
    });
    groups.forEach((items) => {
      const ranked = [...items].sort((a, b) => number(b.current?.[metric]) - number(a.current?.[metric]) || text(a.code).localeCompare(text(b.code)));
      const denominator = ranked.reduce((sum, row) => sum + number(row.current?.[metric]), 0);
      ranked.forEach((row, index) => {
        const value = number(row.current?.[metric]);
        const rankValue = index + 1;
        result.set(row.code, { text: `${rankValue}/${ranked.length}`, rank: rankValue, total: ranked.length, value, share: rate(value, denominator) });
      });
    });
    return result;
  }

  function sortViewRows(rows, level) {
    return [...rows].sort((left, right) => {
      if (level === "area") {
        const leftPrefix = text(left.name).match(/^(\d+)/);
        const rightPrefix = text(right.name).match(/^(\d+)/);
        if (leftPrefix && rightPrefix) {
          const prefixDifference = Number(leftPrefix[1]) - Number(rightPrefix[1]);
          if (prefixDifference) return prefixDifference;
        } else if (leftPrefix || rightPrefix) {
          return leftPrefix ? -1 : 1;
        }
      } else {
        const orderDifference = number(right.current?.orders) - number(left.current?.orders);
        if (orderDifference) return orderDifference;
      }
      return text(left.code).localeCompare(text(right.code));
    });
  }

  function metricValue(row, key) {
    const current = row.current || {};
    if (key === "leads") return number(current.leads);
    if (key === "arrivals") return number(current.arrivals);
    if (key === "orders") return number(current.orders);
    if (key === "leadArrival") return rate(number(current.arrivals), number(current.leads));
    if (key === "driveOrder") return rate(number(current.orders), number(current.drives));
    return rate(number(current.orders), number(current.leads));
  }

  function previousMetricValue(row, key) {
    const current = row.previous || {};
    if (key === "leads") return number(current.leads);
    if (key === "arrivals") return number(current.arrivals);
    if (key === "orders") return number(current.orders);
    if (key === "leadArrival") return rate(number(current.arrivals), number(current.leads));
    if (key === "driveOrder") return rate(number(current.orders), number(current.drives));
    return rate(number(current.orders), number(current.leads));
  }

  function rankValues(rows, level, valueGetter) {
    const result = new Map();
    const groups = new Map();
    rows.forEach((row) => {
      const value = valueGetter(row);
      if (value == null || !Number.isFinite(value)) return;
      const key = comparisonKey(row, level);
      groups.set(key, [...(groups.get(key) || []), { row, value }]);
    });
    groups.forEach((items) => {
      items.sort((left, right) => right.value - left.value || text(left.row.code).localeCompare(text(right.row.code)));
      let previousValue = null;
      let previousRank = 0;
      items.forEach((item, index) => {
        const rankValue = previousValue !== null && item.value === previousValue ? previousRank : index + 1;
        previousValue = item.value;
        previousRank = rankValue;
        result.set(item.row.code, { rank: rankValue, total: items.length, text: `${rankValue}/${items.length}`, value: item.value });
      });
    });
    return result;
  }

  function lowPosition(rank) {
    if (!rank || rank.total < 2) return false;
    return rank.total < 4 ? rank.rank === rank.total : rank.rank / rank.total >= 0.7;
  }

  function significantDecline(current, previous, isRate) {
    if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return false;
    if (isRate) return current - previous <= -5;
    return previous > 0 && ((current - previous) / previous) * 100 <= -20;
  }

  function rowHasSample(row) {
    const sales = [row.current, row.previous].some((values) => ["leads", "arrivals", "drives", "orders", "retail"].some((key) => number(values?.[key]) > 0));
    return sales || number(row.ip?.total) > 0 || number(row.driveTag?.total) > 0;
  }

  function diagnoseRows(rows, level) {
    const rules = [
      { key: "leads", label: "下发线索", issue: "线索供给不足", breakpoint: "线索规模偏低" },
      { key: "orders", label: "订单数", issue: "订单转化不足", breakpoint: "订单结果规模偏弱" },
      { key: "leadOrder", label: "线索订单率", issue: "订单转化不足", breakpoint: "线索到订单整体转化偏弱" },
      { key: "arrivals", label: "到店数", issue: "到店转化不足", breakpoint: "到店规模偏低" },
      { key: "leadArrival", label: "线索到店率", issue: "到店转化不足", breakpoint: "线索邀约到店转化偏弱" }
    ];
    const rankByKey = new Map(rules.map((rule) => [rule.key, rankValues(rows, level, (row) => metricValue(row, rule.key))]));
    const processRules = [
      { key: "ip", label: "负向邀约占比", issue: "邀约过程不足", breakpoint: "邀约过程负向率偏高" },
      { key: "driveTag", label: "负向试驾占比", issue: "试驾过程不足", breakpoint: "试驾过程负向率偏高" }
    ];
    const processRanks = new Map(processRules.map((rule) => [rule.key, rankValues(rows, level, (row) => number(row[rule.key]?.total) >= 5 ? rate(number(row[rule.key]?.negative), number(row[rule.key]?.total)) : null)]));
    return new Map(rows.map((row) => {
      if (!rowHasSample(row)) return [row.code, { issueName: "样本不足", resultBreakpoint: `当前${LEVEL_META[level].scope}范围暂无有效样本；断点：--` }];
      const candidate = rules.map((rule) => ({ rule, rank: rankByKey.get(rule.key).get(row.code), value: metricValue(row, rule.key) }))
        .find((item) => lowPosition(item.rank));
      if (candidate) {
        const isRate = ["leadOrder", "leadArrival", "driveOrder"].includes(candidate.rule.key);
        const valueText = isRate ? `${candidate.value.toFixed(1)}%` : Math.round(candidate.value).toLocaleString("zh-CN");
        return [row.code, { issueName: candidate.rule.issue, resultBreakpoint: `${candidate.rule.label} ${valueText}，${LEVEL_META[level].scope}第${candidate.rank.text}；断点：${candidate.rule.breakpoint}` }];
      }
      const decline = rules.map((rule) => {
        const value = metricValue(row, rule.key);
        const previous = previousMetricValue(row, rule.key);
        const isRate = ["leadOrder", "leadArrival", "driveOrder"].includes(rule.key);
        return { rule, value, previous, isRate, rank: rankByKey.get(rule.key).get(row.code) };
      }).find((item) => significantDecline(item.value, item.previous, item.isRate));
      if (decline) {
        const change = decline.isRate ? `${(decline.value - decline.previous).toFixed(1)}pp` : `${(((decline.value - decline.previous) / decline.previous) * 100).toFixed(1)}%`;
        const rankText = decline.rank ? `，${LEVEL_META[level].scope}第${decline.rank.text}` : "";
        return [row.code, { issueName: decline.rule.issue, resultBreakpoint: `${decline.rule.label}环比${change}${rankText}；断点：${decline.rule.breakpoint}` }];
      }
      const processCandidate = processRules.map((rule) => ({ rule, rank: processRanks.get(rule.key).get(row.code), value: number(row[rule.key]?.total) >= 5 ? rate(number(row[rule.key]?.negative), number(row[rule.key]?.total)) : null }))
        .find((item) => item.rank && item.value != null && item.rank.total > 1 && (item.rank.total < 4 ? item.rank.rank === 1 : item.rank.rank / item.rank.total <= 0.3));
      if (processCandidate) return [row.code, {
        issueName: processCandidate.rule.issue,
        resultBreakpoint: `${processCandidate.rule.label} ${processCandidate.value.toFixed(1)}%，${LEVEL_META[level].scope}高位第${processCandidate.rank.text}；断点：${processCandidate.rule.breakpoint}`
      }];
      return [row.code, { issueName: "未发现显著异常", resultBreakpoint: `未命中${LEVEL_META[level].scope}同级低分位、环比下滑或过程异常阈值；断点：未发现显著异常` }];
    }));
  }

  function evaluateNationalScopeEvidence({ roleResult, params = {}, dealerEvidence, salesEvidence, validDealers = [], salesRows = [], nationalScopeConfig, currentDate }) {
    return root.RetailNationalScope?.evaluateNationalScopeEvidence({ roleResult, params, dealerEvidence, salesEvidence, validDealers, salesRows, nationalScopeConfig, currentDate }) === true;
  }

  function buildViewRows({ displayStores = [], peerStores = displayStores, level = "store", drillPath = [], nationalComplete = false, rankScope = "default", storeDiagnosis }) {
    const visibleRows = aggregateStores(applyDrillPath(displayStores, drillPath), level);
    const peerRows = aggregateStores(applyDrillPath(peerStores, drillPath), level);
    const rankedPeerRows = peerRows.filter((row) => row.targetOnly !== true);
    const orderRanks = rankRows(rankedPeerRows, "orders", level, nationalComplete, rankScope);
    const retailRanks = rankRows(rankedPeerRows, "retail", level, nationalComplete, rankScope);
    const diagnoses = level === "store" ? null : level === "area" && !nationalComplete
      ? new Map(rankedPeerRows.map((row) => [row.code, { issueName: "排名不可用", resultBreakpoint: "无法证明当前数据覆盖全国完整大区集合，暂不输出全国排名诊断" }]))
      : diagnoseRows(rankedPeerRows, level);
    const rows = visibleRows.map((row) => {
      const order = orderRanks.get(row.code);
      const retail = retailRanks.get(row.code);
      const diagnosis = row.targetOnly === true
        ? { issueName: "样本不足", resultBreakpoint: `当前${LEVEL_META[level].scope}仅有订单目标，暂无有效销售样本；断点：--` }
        : level === "store" ? storeDiagnosis?.(row) : diagnoses.get(row.code);
      return { ...row, orderRank: order?.text || "--", orderShare: order?.share ?? null, retailRank: retail?.text || "--", retailShare: retail?.share ?? null, issue: diagnosis?.issueName || "未发现显著异常", breakpoint: diagnosis?.resultBreakpoint || "暂无诊断结论" };
    });
    return sortViewRows(rows, level);
  }

  root.OrganizationView = { PROFILE_KEY, LEVEL_META, readPersonnelProfile, resolveRole, resolveEntryLevel, createViewState, drillDown, drillBack, aggregateStores, applyDrillPath, rankRows, sortViewRows, diagnoseRows, buildViewRows, evaluateNationalScopeEvidence, rate };
})(typeof window !== "undefined" ? window : globalThis);
