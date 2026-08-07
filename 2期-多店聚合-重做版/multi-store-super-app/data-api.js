(function () {
  const ALL = "全部";
  const VEHICLE_ALL = window.RetailVehicleSeries?.ALL || "全部车系";
  const DS = {
    sales: "k4c14c31c595540a0a771f50",
    dcc: "fa1bfbd7736f34d1d8633883",
    drive: "c6428f1c9ca204859b553421",
    order: "m349be19f5f4c4fcc8f82d69",
    ipTag: "n418e47dacdb94291993d3d9",
    driveTag: "g9da02067b8a6432486f58f9",
    ipTagRealtime: "ta1978fc86ae745009d0eff4",
    driveTagRealtime: "ie2f283f63154402282c4968",
    monthlyOrderTarget: "u32cb7e789f7443ff84160b4",
    monthlyRetailTarget: "r05b1e3995b0b4480991a4b8"
  };
  const CHANNELS = ["厂方新媒体", "媒介投放", "官网及电商", "经销商新媒体", "网销平台", "基地", "官方新媒体", "MCN"];
  const PROCESS_TARGET_TAGS = {
    ip: ["到店理由构建", "到店时间锁定", "报价到店承接", "竞品比较转化"],
    drive: ["版本推荐", "顾虑承接", "竞品攻防"]
  };
  const PROCESS_EVIDENCE_LIMIT = 5000;
  const DETAIL_FALLBACK_LIMIT = 200000;
  const TAG_TABLES = {
    ip: {
      history: {
        dsId: DS.ipTag,
        table: "IP电话邀约问题诊断明细表-202606后",
        fields: { record: "呼叫编码", brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码", dealerName: "经销商简称", time: "呼叫开始时间", vehicleSeries: "周期首次意向闭环车系名称", tag1: "一级标签", tag2: "二级标签", polarity: "标签正负向" },
        vehicleSeriesMode: "exact",
        otherMode: "exact"
      },
      realtime: {
        dsId: DS.ipTagRealtime,
        table: "[直连][市场营销数据应用集市]IP电话顾问邀约问题诊断表&ads_sale_mart_ipcall_cons_follow_ai_analy_e_problem_diag_comb_wms",
        inlineBase: true,
        fields: { record: "IP呼叫ID", brand: "品牌名称", area: "大区编码", district: "小区编码", dealer: "经销商代码", dealerName: "经销商简称", time: "呼叫开始时间", vehicleSeries: "周期首次意向闭环车系名称", tag1: "一级标签", tag2: "二级标签", polarity: "标签正负向" },
        vehicleSeriesMode: "ipRealtimeRaw",
        otherMode: "mgComplement"
      }
    },
    drive: {
      history: {
        dsId: DS.driveTag,
        table: "试驾接待问题诊断明细表-202606后",
        fields: { record: "试驾清单ID", brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码", dealerName: "经销商简称", time: "试驾接待时间", vehicleSeries: "车系名称", tag1: "一级标签", tag2: "二级标签", polarity: "标签正负向", judged: "是否判定正负向" },
        vehicleSeriesMode: "driveHistoryRaw",
        otherMode: "mgComplement"
      },
      realtime: {
        dsId: DS.driveTagRealtime,
        table: "[直连][市场营销数据应用集市]试驾顾问接待问题诊断表&ads_sale_mart_trial_cons_recv_prob_diag_comb_wms",
        inlineBase: true,
        fields: { record: "试驾清单ID", brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码", dealerName: "经销商简称", time: "试驾接待时间", vehicleSeries: "闭环车系", tag1: "一级标签", tag2: "二级标签", polarity: "标签正负向", judged: "是否判定正负向" },
        vehicleSeriesMode: "exact",
        otherMode: "exact"
      }
    }
  };
  const SALES_VEHICLE_SERIES = ["MG5", "全新MG4", "MG7", "其他车系", "未知车系", "MG ES5", "MG 4X", "Cyberster", "MG 07"];
  const MG_07_PROCESS_ALIASES = Object.freeze(["MG 07", "MG07 EV", "MG07 DMH"]);
  const PROCESS_VEHICLE_SERIES_MAPS = {
    exact: {
      MG5: ["MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["Cyberster"], "MG 07": MG_07_PROCESS_ALIASES
    },
    ipRealtimeRaw: {
      MG5: ["新一代MG5", "2023款MG5", "全新MG5天蝎座"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["MG Cyberster"], "MG 07": MG_07_PROCESS_ALIASES
    },
    driveHistoryRaw: {
      MG5: ["新一代MG5", "2023款MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["MG Cyberster"], "MG 07": MG_07_PROCESS_ALIASES
    }
  };
  const DRIVE_TAG_REALTIME_FIELD_MAP = {
    "试驾清单ID": ["receive_id"],
    "品牌名称": ["brand_name"],
    "经销商代码": ["trial_recv_dealer_code"],
    "经销商简称": ["dealer_shortnm"],
    "大区代码": ["rfs_code"],
    "大区名称": ["rfs_name"],
    "大区简称": ["rfs_shortnm"],
    "小区代码": ["mac_code"],
    "小区名称": ["mac_name"],
    "小区简称": ["mac_shortnm"],
    "试驾接待时间": ["trial_recv_time"],
    "一级标签": ["tag_level_1"],
    "二级标签": ["tag_level_2"],
    "是否判定正负向": ["judgement_status"],
    "标签正负向": ["sentiment"]
  };
  const SALES_TABLE = {
    dsId: DS.sales,
    table: "[微批][三品牌]新零售门店级每日全量指标宽表&ads_sale_mart_new_sale_store_lvl_day_exnorm_comb_wms_his",
    fields: {
      date: "日yyyy-mm-dd",
      brand: "品牌名称",
      area: "大区代码",
      areaName: "大区名称",
      district: "小区代码",
      districtName: "小区名称",
      sourceDealer: "一级经销商代码",
      sourceDealerName: "父经销商简称",
      dealer: "经销商代码",
      dealerName: "经销商名称",
      vehicleSeries: "汇报车系名称",
      leads: "当日下发线索数",
      arrivals: "当日首触客流数",
      drives: "当日首触试驾数",
      orders: "当日订单数（首触）",
      retail: "当日零售数"
    }
  };
  const ORDER_TARGET_FIELDS = {
    date: "日期",
    brand: "品牌",
    area: "大区",
    areaCode: "大区代码",
    district: "小区",
    districtCode: "小区代码",
    dealerName: "经销商",
    dealerCode: "经销商代码",
    vehicleSeries: "车系",
    orderTarget: "订单目标"
  };
  const RETAIL_TARGET_FIELDS = {
    date: "目标日期",
    dealerCode: "dealer_code",
    vehicleSeries: "车系",
    retailTarget: "总零售目标"
  };
  const TARGET_BRAND = "MG";
  const detailCache = new Map();
  const rowsCache = new Map();
  const vehicleSeriesOptionsCache = new Map();
  const MAX_ROWS_CACHE_ENTRIES = 48;

  function clean(value) { return String(value || "").trim(); }
  function selectedVehicleSeries(params) {
    return window.RetailVehicleSeries?.normalizeVehicleSeriesSelection(params?.vehicleSeries) || [];
  }
  function pad(value) { return String(value).padStart(2, "0"); }
  function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function addDays(date, offset) { const next = new Date(date); next.setDate(next.getDate() + offset); return next; }
  function addMonths(date, offset) { const next = new Date(date); next.setMonth(next.getMonth() + offset); return next; }
  function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function endOfPrevMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 0); }
  function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
  function monthKey(value) {
    const text = clean(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
    return `${text.slice(0, 7)}-01`;
  }

  function resolveDateRange(input) {
    if (input && typeof input === "object" && input.startDate && input.endDate) {
      return input.startDate <= input.endDate
        ? { startDate: input.startDate, endDate: input.endDate }
        : { startDate: input.endDate, endDate: input.startDate };
    }
    const period = typeof input === "string" ? input : input?.period;
    const today = new Date();
    const yesterday = addDays(today, -1);
    if (period === "今日") return { startDate: dateKey(today), endDate: dateKey(today) };
    if (period === "昨日") return { startDate: dateKey(yesterday), endDate: dateKey(yesterday) };
    if (period === "近7天") return { startDate: dateKey(addDays(yesterday, -6)), endDate: dateKey(yesterday) };
    if (period === "本月") {
      const end = today.getDate() === 1 ? endOfPrevMonth(today) : yesterday;
      return { startDate: dateKey(startOfMonth(end)), endDate: dateKey(end) };
    }
    const end = today.getDate() === 1 ? endOfPrevMonth(today) : yesterday;
    return { startDate: dateKey(startOfMonth(end)), endDate: dateKey(end) };
  }

  function previousMonthRange(range) {
    return {
      startDate: dateKey(addMonths(new Date(`${range.startDate}T00:00:00`), -1)),
      endDate: dateKey(addMonths(new Date(`${range.endDate}T00:00:00`), -1))
    };
  }

  function previousWeekRange(range) {
    return {
      startDate: dateKey(addDays(new Date(`${range.startDate}T00:00:00`), -7)),
      endDate: dateKey(addDays(new Date(`${range.endDate}T00:00:00`), -7))
    };
  }

  function resourceUrl(path) {
    if (!path.startsWith("/api/")) return path;
    if (location.hostname === "localhost") return path;
    const match = location.pathname.match(/^(.*)\/open-apps(?:\/|$)/);
    return `${match?.[1] || ""}${path}`;
  }

  async function readJson(response) {
    const text = await response.text();
    if (!response.ok) throw new Error(`观远接口请求失败：${response.status}`);
    if (text.trim().startsWith("<")) throw new Error("观远接口返回 HTML，请检查登录态或开放应用路由");
    const payload = JSON.parse(text);
    if (payload?.error) throw new Error(payload.error.message || "观远接口返回错误");
    if (payload?.code !== undefined && payload.code !== 0) throw new Error(payload.msg || `观远接口返回错误：${payload.code}`);
    return payload.response ?? payload.data ?? payload;
  }

  async function getJson(url, options = {}) {
    return readJson(await fetch(resourceUrl(url), { headers: { "raw-backend-response": "TRUE" }, signal: options.signal }));
  }

  async function postJson(url, body, options = {}) {
    return readJson(await fetch(resourceUrl(url), {
      method: "POST",
      headers: { "content-type": "application/json;charset=UTF-8", "raw-backend-response": "TRUE" },
      body: JSON.stringify(body),
      signal: options.signal
    }));
  }

  function rowsFromSqlResult(result) {
    return (result.preview || []).map((row) => Object.fromEntries((result.columns || []).map((column, index) => [column.name, row[index] ?? ""])));
  }

  async function executeSqlRows(dsId, query, limit = 5000, options = {}) {
    const rows = rowsFromSqlResult(await postJson("/api/data-source/execute-sql-query", {
      inputs: [dsId],
      query,
      limit,
      disableCache: false
    }, { signal: options.signal }));
    if (options.failOnLimit && rows.length >= limit) throw new Error(`SQL 聚合结果达到安全上限 ${limit} 行，完整性不可证`);
    return rows;
  }

  function abortReason(signal) {
    return signal?.reason || new Error("请求已取消");
  }

  function abortableRace(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(abortReason(signal)), { once: true });
      promise.then(resolve, reject);
    });
  }

  async function datasetDetail(dsId, options = {}) {
    const cached = detailCache.get(dsId);
    if (cached) return abortableRace(cached, options.signal);
    if (options.signal) {
      const detail = await getJson(`/api/data-source/${dsId}`, { signal: options.signal });
      detailCache.set(dsId, Promise.resolve(detail));
      return detail;
    }
    const request = getJson(`/api/data-source/${dsId}`).catch((error) => {
      detailCache.delete(dsId);
      throw error;
    });
    detailCache.set(dsId, request);
    return request;
  }

  function fieldsOf(detail) {
    return [...(detail.fields || []), ...(detail.columns || []), ...(detail.virtualColumns || [])];
  }

  function findField(detail, name) {
    const expected = clean(name);
    const field = fieldsOf(detail).find((item) => clean(item.name) === expected || clean(item.alias) === expected);
    if (!field) throw new Error(`数据集 ${detail.dsId} 缺少字段：${name}`);
    return field;
  }

  function hasField(detail, name) {
    const expected = clean(name);
    return fieldsOf(detail).some((item) => clean(item.name) === expected || clean(item.alias) === expected);
  }

  function assertRequiredFields(detail, fieldNames) {
    const missing = fieldNames.filter((name) => !hasField(detail, name));
    if (missing.length) throw new Error(`数据集 ${detail.dsId} 缺少必需字段：${missing.join("、")}`);
  }

  function buildFilter(detail, conditions) {
    return {
      combineType: "AND",
      conditions: conditions.map((condition) => {
        const field = findField(detail, condition.field);
        return {
          type: "condition",
          value: {
            ...field,
            dsId: detail.dsId,
            level: "dataset",
            filterType: condition.type,
            filterValue: Array.isArray(condition.value) ? condition.value : [condition.value]
          }
        };
      })
    };
  }

  function rowsFromPreview(result) {
    return (result.preview || []).map((row) => Object.fromEntries((result.columns || []).flatMap((column, index) => {
      const value = row[index] ?? "";
      return [column.name, column.alias].filter(Boolean).map((key) => [key, value]);
    })));
  }

  function abortableDelay(ms, signal) {
    if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
    if (signal.aborted) return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(abortReason(signal));
      }, { once: true });
    });
  }

  async function waitTask(taskId, options = {}) {
    for (let index = 0; index < 45; index += 1) {
      const task = await getJson(`/api/task/${taskId}`, { signal: options.signal });
      if (task.status === "FINISHED") {
        const result = typeof task.result === "string" ? JSON.parse(task.result) : task.result;
        return result?.response?.value || result?.value || result;
      }
      if (task.status === "FAILED" || task.status === "CANCELED") throw new Error(`观远预览任务失败：${task.status}`);
      await abortableDelay(500, options.signal);
    }
    throw new Error("观远预览任务超时");
  }

  async function previewRows(dsId, filters, limit = 5000, offset = 0, options = {}) {
    const detail = await datasetDetail(dsId, { signal: options.signal });
    const task = await postJson(`/api/data-source/${dsId}/preview-with-filter-async`, {
      offset,
      limit,
      filter: filters.length ? buildFilter(detail, filters) : undefined
    }, { signal: options.signal });
    const fileName = await waitTask(task.taskId, { signal: options.signal });
    return rowsFromPreview(await postJson("/api/account/readPreviewFile", { taskId: task.taskId, fileName }, { signal: options.signal }));
  }

  function cacheKey(dsId, filters, maxRows) {
    return JSON.stringify({ dsId, filters, maxRows });
  }

  function rememberRows(key, promise) {
    if (rowsCache.size >= MAX_ROWS_CACHE_ENTRIES) rowsCache.delete(rowsCache.keys().next().value);
    const guarded = promise.catch((error) => {
      rowsCache.delete(key);
      throw error;
    });
    rowsCache.set(key, guarded);
    return guarded;
  }

  function rememberResolvedRows(key, rows) {
    if (rowsCache.size >= MAX_ROWS_CACHE_ENTRIES) rowsCache.delete(rowsCache.keys().next().value);
    const resolved = Promise.resolve(rows);
    rowsCache.set(key, resolved);
    return resolved;
  }

  async function allRows(dsId, filters, maxRows = 200000, options = {}) {
    const key = cacheKey(dsId, filters, maxRows);
    if (rowsCache.has(key)) return abortableRace(rowsCache.get(key), options.signal);
    // A caller-owned AbortSignal must never become a shared pending cache entry.
    // A refresh can then start an independent request while the prior load times out.
    if (options.signal) {
      const rows = await readAllRows(dsId, filters, maxRows, options);
      return rememberResolvedRows(key, rows);
    }
    return rememberRows(key, readAllRows(dsId, filters, maxRows, options));
  }

  async function readAllRows(dsId, filters, maxRows, options = {}) {
    const limit = 5000;
    const pages = [];
    for (let offset = 0; offset < maxRows; offset += limit) {
      const rows = await previewRows(dsId, filters, limit, offset, options);
      pages.push(...rows);
      if (rows.length < limit) break;
      if (offset + limit >= maxRows) throw new Error(`数据明细分页达到安全上限 ${maxRows} 行，未读到末页，完整性不可证`);
    }
    return pages;
  }

  async function mapLimit(items, limit, iteratee) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await iteratee(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  function dealerScope(params, validDealers) {
    if (params.dealerCode || (params.store && params.store !== ALL)) return [];
    return (validDealers || []).filter((dealer) => clean(dealer.name));
  }

  async function scopedAllRows(dsId, filterFactory, params, range, maxRows, validDealers) {
    const dealers = dealerScope(params, validDealers);
    if (!dealers.length) return allRows(dsId, filterFactory(params, range), maxRows);
    const chunks = await mapLimit(dealers, 4, (dealer) => allRows(dsId, filterFactory({
      ...params,
      areaCode: dealer.areaCode || params.areaCode,
      districtCode: dealer.districtCode || params.districtCode,
      dealerCode: dealer.code,
      store: dealer.name
    }, range), maxRows));
    return chunks.flat();
  }

  function condition(field, value, type = "EQ") { return field && value && value !== ALL ? [{ field, type, value }] : []; }
  function eq(field, value) { return condition(field, value, "EQ"); }
  function sqlIdent(name) { return `\`${String(name).replace(/`/g, "``")}\``; }
  function sqlString(value) { return `'${String(value ?? "").replace(/'/g, "''")}'`; }
  function textExpr(field) { return `TRIM(CAST(${sqlIdent(field)} AS STRING))`; }
  function numberExpr(field) { return `CAST(${sqlIdent(field)} AS DOUBLE)`; }

  function sqlOrgWhere(params, fields) {
    const clauses = [`${sqlIdent(fields.brand)} = ${sqlString(params.brand === ALL ? "MG" : params.brand)}`];
    if (params.areaCode) clauses.push(`${sqlIdent(fields.area)} = ${sqlString(params.areaCode)}`);
    if (params.districtCode) clauses.push(`${sqlIdent(fields.district)} = ${sqlString(params.districtCode)}`);
    if (params.dealerCode) clauses.push(`${sqlIdent(fields.dealer)} = ${sqlString(params.dealerCode)}`);
    return clauses;
  }

  function sqlDateWhere(fields, range) {
    return [
      `${sqlIdent(fields.time)} >= ${sqlString(range.startDate)}`,
      `${sqlIdent(fields.time)} <= ${sqlString(`${range.endDate} 23:59:59`)}`
    ];
  }

  function orgFilters(params, fields) {
    return [
      ...condition(fields.brand || "品牌名称", params.brand === ALL ? "MG" : params.brand, fields.brandType || "EQ"),
      ...condition(fields.areaCode, params.areaCode, fields.areaCodeType || "EQ"),
      ...condition(fields.districtCode, params.districtCode, fields.districtCodeType || "EQ"),
      ...condition(fields.storeCode, params.dealerCode, fields.storeCodeType || "EQ")
    ];
  }

  function dateFilter(field, range) { return { field, type: "BT", value: [range.startDate, range.endDate] }; }
  function vehicleSeriesFilter(field, params) {
    const selected = selectedVehicleSeries(params);
    return selected.length ? [{ field, type: "IN", value: selected }] : [];
  }
  function vehicleSeriesSqlCondition(field, params) {
    const selected = selectedVehicleSeries(params);
    return selected.length ? `${sqlIdent(field)} IN (${selected.map(sqlString).join(", ")})` : "";
  }
  function processVehicleFieldGap(reason) {
    const error = new Error(reason);
    error.fieldGapReason = reason;
    return error;
  }
  function processMappedValues(config) {
    const map = PROCESS_VEHICLE_SERIES_MAPS[config.vehicleSeriesMode];
    return [...new Set(Object.values(map || {}).flat())];
  }
  function processVehicleSeriesSqlCondition(kind, config, params) {
    const selected = selectedVehicleSeries(params);
    if (!selected.length) return "";
    const field = config.fields?.vehicleSeries;
    const map = PROCESS_VEHICLE_SERIES_MAPS[config.vehicleSeriesMode];
    if (!field || !map) throw processVehicleFieldGap(`过程${kind}车系字段未审计，已 fail-closed`);
    if (selected.some((value) => !SALES_VEHICLE_SERIES.includes(value) || (value !== "其他车系" && !map[value]))) {
      throw processVehicleFieldGap(`过程${kind}车系映射未审计：${selected.join("、")}，已 fail-closed`);
    }
    const clauses = [];
    const exactValues = [...new Set(selected.flatMap((value) => map[value] || []))];
    if (exactValues.length) clauses.push(`${sqlIdent(field)} IN (${exactValues.map(sqlString).join(", ")})`);
    if (selected.includes("其他车系")) {
      if (config.otherMode === "exact") {
        clauses.push(`${sqlIdent(field)} IN (${sqlString("其他车系")})`);
      } else if (config.otherMode === "mgComplement") {
        clauses.push(`(${sqlIdent(config.fields.brand)} = ${sqlString("MG")} AND ${textExpr(field)} <> '' AND ${sqlIdent(field)} NOT IN (${processMappedValues(config).map(sqlString).join(", ")}))`);
      } else {
        throw processVehicleFieldGap(`过程${kind}其他车系策略未审计，已 fail-closed`);
      }
    }
    if (!clauses.length) throw processVehicleFieldGap(`过程${kind}车系条件为空，已 fail-closed`);
    return `(${clauses.join(" OR ")})`;
  }

  function salesFilters(params, range) {
    const filters = [...orgFilters(params, { brand: "品牌名称", areaCode: "大区代码", districtCode: "小区代码", storeCode: SALES_TABLE.fields.sourceDealer }), dateFilter("日期", range)];
    return [...filters, ...vehicleSeriesFilter(SALES_TABLE.fields.vehicleSeries, params)];
  }

  function targetDateInfo(range, todayInput) {
    const start = new Date(`${range.startDate}T00:00:00`);
    const end = new Date(`${range.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || range.startDate > range.endDate) {
      return { valid: false, reason: "目标日期范围无效", months: [], targetRange: null, targetActualRange: null, actualRange: null };
    }
    if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) {
      return { valid: false, reason: "月目标仅支持单一自然月", months: [], targetRange: null, targetActualRange: null, actualRange: null };
    }
    const today = todayInput ? new Date(`${todayInput}T00:00:00`) : new Date();
    const monthStart = startOfMonth(start);
    const monthEnd = endOfMonth(start);
    if (!Number.isNaN(today.getTime()) && today < monthStart) {
      return { valid: false, reason: "目标日期范围无效", months: [], targetRange: null, targetActualRange: null, actualRange: null };
    }
    const targetActualEnd = Number.isNaN(today.getTime()) || today > monthEnd ? monthEnd : today;
    const targetActualRange = { startDate: dateKey(monthStart), endDate: dateKey(targetActualEnd) };
    return {
      valid: true,
      reason: "",
      months: [dateKey(monthStart)],
      targetRange: { startDate: dateKey(monthStart), endDate: dateKey(monthEnd) },
      targetActualRange,
      actualRange: targetActualRange
    };
  }

  function targetFilters(params, range, options = {}) {
    const fields = options.fields || RETAIL_TARGET_FIELDS;
    const filters = [
      dateFilter(fields.date, range)
    ];
    if (fields.brand) filters.push({ field: fields.brand, type: "EQ", value: TARGET_BRAND });
    if (options.includeOrganization === false) return [...filters, ...vehicleSeriesFilter(fields.vehicleSeries, params)];
    const orgFieldMap = [
      ["areaCode", fields.areaCode || "rfs_code"],
      ["districtCode", fields.districtCode || "mac_code"],
      ["dealerCode", fields.dealerCode || "dealer_code"]
    ];
    orgFieldMap.forEach(([paramKey, field]) => {
      const value = clean(params[paramKey]);
      if (options.detail && !hasField(options.detail, field)) return;
      if (value) filters.push({ field, type: "EQ", value });
    });
    return [...filters, ...vehicleSeriesFilter(fields.vehicleSeries, params)];
  }

  function monthlyTargetLoadingRaw(params, range) {
    const dateInfo = targetDateInfo(range);
    return {
      status: "loading",
      error: "",
      targets: [],
      targetActuals: [],
      audit: emptyTargetAudit(),
      months: dateInfo.months || [],
      dateInfo
    };
  }

  function dccFilters(params, range) {
    return [
      ...orgFilters(params, { brand: "品牌名称", areaCode: "大区代码", districtCode: "小区代码", storeCode: "经销商代码" }),
      dateFilter("下发CRM时间", range),
      { field: "线索渠道大类名称", type: "IN", value: CHANNELS },
      { field: "开业状态", type: "EQ", value: "1" },
      { field: "data_type_ch", type: "NE", value: "来电咨询" },
      { field: "线索免考核", type: "EQ", value: "待考核" },
      { field: "需跟进", type: "EQ", value: "需跟进" }
    ];
  }

  function driveFilters(params, range) {
    return [
      ...orgFilters(params, { brand: "品牌名称", areaCode: "试驾接待大区代码", districtCode: "试驾接待小区代码", storeCode: "试驾接待经销商代码" }),
      dateFilter("试驾接待日期", range),
      { field: "是否成功试驾", type: "EQ", value: "是" }
    ];
  }

  function orderFilters(params, range) {
    return [
      ...orgFilters(params, { brand: "品牌名称", areaCode: "大区代码", districtCode: "小区代码", storeCode: "订单经销商代码" }),
      dateFilter("订单创建时间", range),
      { field: "是否当天订当天退", type: "EQ", value: "0" }
    ];
  }

  function tagFilters(params, range, timeField) {
    return [...orgFilters(params, { brand: "品牌名称", areaCode: "大区代码", districtCode: "小区代码", storeCode: "经销商代码" }), dateFilter(timeField, range)];
  }

  function salesAggregateSql(params, range) {
    const f = SALES_TABLE.fields;
    const where = [
      `${sqlIdent(f.brand)} = ${sqlString(params.brand === ALL ? "MG" : params.brand)}`,
      `${sqlIdent(f.date)} >= ${sqlString(range.startDate)}`,
      `${sqlIdent(f.date)} <= ${sqlString(range.endDate)}`,
      `${textExpr(f.sourceDealer)} <> ''`
    ];
    if (params.areaCode) where.push(`${sqlIdent(f.area)} = ${sqlString(params.areaCode)}`);
    if (params.districtCode) where.push(`${sqlIdent(f.district)} = ${sqlString(params.districtCode)}`);
    if (params.dealerCode) where.push(`${sqlIdent(f.sourceDealer)} = ${sqlString(params.dealerCode)}`);
    const vehicleWhere = vehicleSeriesSqlCondition(f.vehicleSeries, params);
    if (vehicleWhere) where.push(vehicleWhere);
    return `
      SELECT
        ${textExpr(f.sourceDealer)} AS ${sqlIdent(f.dealer)},
        MAX(${textExpr(f.sourceDealerName)}) AS ${sqlIdent(f.dealerName)},
        MAX(${textExpr(f.areaName)}) AS ${sqlIdent(f.areaName)},
        MAX(${textExpr(f.districtName)}) AS ${sqlIdent(f.districtName)},
        SUM(${numberExpr(f.leads)}) AS ${sqlIdent(f.leads)},
        SUM(${numberExpr(f.arrivals)}) AS ${sqlIdent(f.arrivals)},
        SUM(${numberExpr(f.drives)}) AS ${sqlIdent(f.drives)},
        SUM(${numberExpr(f.orders)}) AS ${sqlIdent(f.orders)},
        SUM(${numberExpr(f.retail)}) AS ${sqlIdent(f.retail)}
      FROM ${sqlIdent(SALES_TABLE.table)}
      WHERE ${where.join("\n        AND ")}
      GROUP BY ${textExpr(f.sourceDealer)}
    `;
  }

  function targetActualSql(params, range) {
    const f = SALES_TABLE.fields;
    const monthExpr = `CONCAT(SUBSTR(CAST(${sqlIdent(f.date)} AS STRING), 1, 7), '-01')`;
    const where = [
      `${sqlIdent(f.brand)} = ${sqlString(TARGET_BRAND)}`,
      `${sqlIdent(f.date)} >= ${sqlString(range.startDate)}`,
      `${sqlIdent(f.date)} <= ${sqlString(range.endDate)}`,
      `${textExpr(f.sourceDealer)} <> ''`,
      `${textExpr(f.vehicleSeries)} <> ''`
    ];
    if (params.areaCode) where.push(`${sqlIdent(f.area)} = ${sqlString(params.areaCode)}`);
    if (params.districtCode) where.push(`${sqlIdent(f.district)} = ${sqlString(params.districtCode)}`);
    if (params.dealerCode) where.push(`${sqlIdent(f.sourceDealer)} = ${sqlString(params.dealerCode)}`);
    const vehicleWhere = vehicleSeriesSqlCondition(f.vehicleSeries, params);
    if (vehicleWhere) where.push(vehicleWhere);
    return `
      SELECT
        ${monthExpr} AS target_month,
        ${textExpr(f.brand)} AS brand_name,
        ${textExpr(f.sourceDealer)} AS dealer_code,
        ${textExpr(f.vehicleSeries)} AS vehicle_series,
        SUM(${numberExpr(f.orders)}) AS target_actual_orders,
        SUM(${numberExpr(f.retail)}) AS target_actual_retail
      FROM ${sqlIdent(SALES_TABLE.table)}
      WHERE ${where.join("\n        AND ")}
      GROUP BY ${monthExpr}, ${textExpr(f.brand)}, ${textExpr(f.sourceDealer)}, ${textExpr(f.vehicleSeries)}
    `;
  }

  function targetKey({ month, brand, dealerCode, vehicleSeries }) {
    return [month, brand, dealerCode, vehicleSeries].map(clean).join("\u0000");
  }

  function emptyTargetAudit() {
    return {
      invalidKeyRows: 0,
      invalidOrderRows: 0,
      invalidRetailRows: 0,
      negativeOrderRows: 0,
      negativeRetailRows: 0,
      conflictOrderKeys: 0,
      conflictRetailKeys: 0,
      conflictKeys: 0,
      duplicateRows: 0,
      outOfRangeRows: 0,
      orderOutputRows: 0,
      orderOutputTarget: 0,
      orderNameIdentityRows: 0,
      unmappedOrderActualRows: 0,
      unmappedOrderActualTarget: 0,
      orderScopeStatus: "ready",
      orderScopeLevel: "",
      orderScopeCode: "",
      orderScopeError: "",
      conflictByStore: { order: {}, retail: {} },
      validDealerMissingRows: 0
    };
  }

  function parseTargetValue(value) {
    if (value == null) return null;
    const normalized = String(value).replace(/,/g, "").trim();
    if (normalized === "") return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function baseTargetItem({ key, month, brand, dealerCode, vehicleSeries, ...organization }) {
    return {
      key,
      month,
      brand,
      dealerCode,
      vehicleSeries,
      ...organization,
      orderTarget: 0,
      retailTarget: 0,
      orderHasTarget: false,
      retailHasTarget: false,
      orderConflict: false,
      retailConflict: false,
      duplicateRows: 0
    };
  }

  function organizationIdentity(level, parentIdentity, code, name, codesByName) {
    const cleanCode = clean(code);
    const cleanName = clean(name);
    const nameKey = `${parentIdentity}\u0000${cleanName}`;
    const knownCodes = cleanName ? codesByName.get(nameKey) : null;
    if (cleanCode && (!cleanName || (knownCodes?.size || 0) <= 1)) return `${level}:code:${cleanCode}`;
    if (cleanName) return `${level}:name:${parentIdentity}:${cleanName}`;
    return `${level}:missing:${parentIdentity}`;
  }

  function addOrganizationCode(map, parentIdentity, name, code) {
    const cleanName = clean(name);
    const cleanCode = clean(code);
    if (!cleanName || !cleanCode) return;
    const key = `${parentIdentity}\u0000${cleanName}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(cleanCode);
  }

  function resolveOrderRowsInScope(rows, params = {}) {
    const unrestricted = (value) => {
      const normalized = clean(value);
      return !normalized || normalized === ALL || normalized === VEHICLE_ALL;
    };
    const selectedDealerName = [params.dealer, params.store, params.dealerShortName].find((value) => !unrestricted(value)) || "";
    const levels = [
      { level: "area", label: "大区", codeField: ORDER_TARGET_FIELDS.areaCode, nameField: ORDER_TARGET_FIELDS.area, selectedCode: params.areaCode, selectedName: params.area },
      { level: "district", label: "小区", codeField: ORDER_TARGET_FIELDS.districtCode, nameField: ORDER_TARGET_FIELDS.district, selectedCode: params.districtCode, selectedName: params.district },
      { level: "dealer", label: "经销商", codeField: ORDER_TARGET_FIELDS.dealerCode, nameField: ORDER_TARGET_FIELDS.dealerName, selectedCode: params.dealerCode, selectedName: selectedDealerName }
    ];
    let scopedRows = [...(rows || [])];
    for (const item of levels) {
      const scopeCode = unrestricted(item.selectedCode) ? "" : clean(item.selectedCode);
      const scopeName = unrestricted(item.selectedName) ? "" : clean(item.selectedName);
      if (scopeCode) {
        const canonicalNames = new Set(scopedRows
          .filter((row) => clean(row[item.codeField]) === scopeCode)
          .map((row) => clean(row[item.nameField])));
        const canonicalName = canonicalNames.size === 1 ? [...canonicalNames][0] : "";
        if (!canonicalName) {
          const reason = canonicalNames.size === 0 ? "未在当前 u32 范围命中" : "在当前 u32 范围映射到多个名称";
          return {
            rows: [],
            error: `订单目标${item.label}代码 ${scopeCode} ${reason}`,
            audit: {
              orderScopeStatus: "unavailable",
              orderScopeLevel: item.level,
              orderScopeCode: scopeCode,
              orderScopeError: reason
            }
          };
        }
        scopedRows = scopedRows.filter((row) => clean(row[item.nameField]) === canonicalName);
      } else if (scopeName) {
        scopedRows = scopedRows.filter((row) => clean(row[item.nameField]) === scopeName);
      }
    }
    return { rows: scopedRows, error: "", audit: { orderScopeStatus: "ready", orderScopeLevel: "", orderScopeCode: "", orderScopeError: "" } };
  }

  function orderRowsInScope(rows, params = {}) {
    return resolveOrderRowsInScope(rows, params).rows;
  }

  function normalizeOrderTargets(rows, dateInfo) {
    const audit = emptyTargetAudit();
    const targetMonths = new Set(dateInfo.months || []);
    const validRows = [];
    const seenNaturalKeys = new Set();
    (rows || []).forEach((row, sourceIndex) => {
      const month = monthKey(row[ORDER_TARGET_FIELDS.date]);
      const brand = clean(row[ORDER_TARGET_FIELDS.brand]);
      const dealerCode = clean(row[ORDER_TARGET_FIELDS.dealerCode]);
      const vehicleSeries = clean(row[ORDER_TARGET_FIELDS.vehicleSeries]);
      const orderTarget = parseTargetValue(row[ORDER_TARGET_FIELDS.orderTarget]);
      if (!month || brand !== TARGET_BRAND || !vehicleSeries) {
        audit.invalidKeyRows += 1;
        return;
      }
      if (targetMonths.size && !targetMonths.has(month)) {
        audit.outOfRangeRows += 1;
        return;
      }
      const orderValid = orderTarget != null && orderTarget >= 0;
      if (orderTarget == null) audit.invalidOrderRows += 1;
      if (orderTarget != null && orderTarget < 0) audit.negativeOrderRows += 1;
      if (!orderValid) return;
      const actualKey = targetKey({ month, brand, dealerCode, vehicleSeries });
      if (seenNaturalKeys.has(actualKey)) {
        audit.duplicateRows += 1;
      }
      seenNaturalKeys.add(actualKey);
      audit.orderOutputRows += 1;
      audit.orderOutputTarget += orderTarget;
      validRows.push({
        sourceIndex,
        month,
        brand,
        area: clean(row[ORDER_TARGET_FIELDS.area]),
        areaCode: clean(row[ORDER_TARGET_FIELDS.areaCode]),
        district: clean(row[ORDER_TARGET_FIELDS.district]),
        districtCode: clean(row[ORDER_TARGET_FIELDS.districtCode]),
        dealerName: clean(row[ORDER_TARGET_FIELDS.dealerName]),
        dealerCode,
        vehicleSeries,
        orderTarget,
        actualKey
      });
    });
    const areaCodesByName = new Map();
    validRows.forEach((row) => addOrganizationCode(areaCodesByName, "root", row.area, row.areaCode));
    validRows.forEach((row) => {
      row.orderAreaIdentity = organizationIdentity("area", "root", row.areaCode, row.area, areaCodesByName);
    });
    const districtCodesByName = new Map();
    validRows.forEach((row) => addOrganizationCode(districtCodesByName, row.orderAreaIdentity, row.district, row.districtCode));
    validRows.forEach((row) => {
      row.orderDistrictIdentity = organizationIdentity("district", row.orderAreaIdentity, row.districtCode, row.district, districtCodesByName);
    });
    const dealerCodesByName = new Map();
    validRows.forEach((row) => addOrganizationCode(dealerCodesByName, row.orderDistrictIdentity, row.dealerName, row.dealerCode));
    const targets = validRows.map((row) => {
      const orderDealerIdentity = organizationIdentity("dealer", row.orderDistrictIdentity, row.dealerCode, row.dealerName, dealerCodesByName);
      if (!row.areaCode || !row.districtCode || !row.dealerCode) audit.orderNameIdentityRows += 1;
      return {
        ...baseTargetItem({
          ...row,
          key: `order-row\u0000${row.sourceIndex}\u0000${row.actualKey}`,
          orderDealerIdentity
        }),
        orderTarget: row.orderTarget,
        orderHasTarget: true
      };
    });
    return { status: "ready", targets, audit, months: dateInfo.months || [], dateInfo };
  }

  function normalizeRetailTargets(rows, dateInfo) {
    const audit = emptyTargetAudit();
    const byKey = new Map();
    const targetMonths = new Set(dateInfo.months || []);
    (rows || []).forEach((row) => {
      const month = monthKey(row[RETAIL_TARGET_FIELDS.date]);
      const brand = TARGET_BRAND;
      const dealerCode = clean(row[RETAIL_TARGET_FIELDS.dealerCode]);
      const vehicleSeries = clean(row[RETAIL_TARGET_FIELDS.vehicleSeries]);
      const retailTarget = parseTargetValue(row[RETAIL_TARGET_FIELDS.retailTarget]);
      if (!month || !dealerCode || !vehicleSeries) {
        audit.invalidKeyRows += 1;
        return;
      }
      if (targetMonths.size && !targetMonths.has(month)) {
        audit.outOfRangeRows += 1;
        return;
      }
      const retailValid = retailTarget != null && retailTarget >= 0;
      if (retailTarget == null) audit.invalidRetailRows += 1;
      if (retailTarget != null && retailTarget < 0) audit.negativeRetailRows += 1;
      if (!retailValid) return;
      const key = targetKey({ month, brand, dealerCode, vehicleSeries });
      const item = byKey.get(key) || baseTargetItem({ key, month, brand, dealerCode, vehicleSeries });
      if (byKey.has(key)) {
        if (!item.retailHasTarget) {
          item.retailHasTarget = true;
          item.retailTarget = retailTarget;
        } else if (item.retailTarget !== retailTarget) item.retailConflict = true;
        if (item.retailTarget === retailTarget) {
          item.duplicateRows += 1;
          audit.duplicateRows += 1;
        }
      } else {
        item.retailTarget = retailTarget;
        item.retailHasTarget = true;
      }
      byKey.set(key, item);
    });
    const targets = [];
    byKey.forEach((item) => {
      if (item.retailConflict) {
        audit.conflictRetailKeys += 1;
        audit.conflictByStore.retail[item.dealerCode] = (audit.conflictByStore.retail[item.dealerCode] || 0) + 1;
      }
      item.retailHasTarget = item.retailHasTarget && !item.retailConflict;
      if (!item.retailHasTarget) return;
      targets.push(item);
    });
    audit.conflictKeys = audit.conflictOrderKeys + audit.conflictRetailKeys;
    return { status: "ready", targets, audit, months: dateInfo.months || [], dateInfo };
  }

  function mergeAudit(left = {}, right = {}) {
    return {
      invalidKeyRows: (left.invalidKeyRows || 0) + (right.invalidKeyRows || 0),
      invalidOrderRows: left.invalidOrderRows || 0,
      invalidRetailRows: right.invalidRetailRows || 0,
      negativeOrderRows: left.negativeOrderRows || 0,
      negativeRetailRows: right.negativeRetailRows || 0,
      conflictOrderKeys: left.conflictOrderKeys || 0,
      conflictRetailKeys: right.conflictRetailKeys || 0,
      conflictKeys: (left.conflictOrderKeys || 0) + (right.conflictRetailKeys || 0),
      duplicateRows: (left.duplicateRows || 0) + (right.duplicateRows || 0),
      outOfRangeRows: (left.outOfRangeRows || 0) + (right.outOfRangeRows || 0),
      orderOutputRows: left.orderOutputRows || 0,
      orderOutputTarget: left.orderOutputTarget || 0,
      orderNameIdentityRows: left.orderNameIdentityRows || 0,
      unmappedOrderActualRows: left.unmappedOrderActualRows || 0,
      unmappedOrderActualTarget: left.unmappedOrderActualTarget || 0,
      orderScopeStatus: left.orderScopeStatus || "ready",
      orderScopeLevel: left.orderScopeLevel || "",
      orderScopeCode: left.orderScopeCode || "",
      orderScopeError: left.orderScopeError || "",
      validDealerMissingRows: Math.max(left.validDealerMissingRows || 0, right.validDealerMissingRows || 0),
      conflictByStore: {
        order: { ...(left.conflictByStore?.order || {}) },
        retail: { ...(right.conflictByStore?.retail || {}) }
      }
    };
  }

  function mergeTargetResults(orderResult, retailResult, dateInfo) {
    const orderStatus = orderResult.status || "ready";
    const retailStatus = retailResult.status || "ready";
    return {
      status: orderStatus === "unavailable" && retailStatus === "unavailable" ? "unavailable" : orderStatus === "loading" || retailStatus === "loading" ? "loading" : orderStatus === "invalid_range" || retailStatus === "invalid_range" ? "invalid_range" : orderStatus === "non_mg" || retailStatus === "non_mg" ? "non_mg" : "ready",
      error: orderResult.error || retailResult.error || "",
      orderStatus,
      retailStatus,
      orderError: orderResult.error || "",
      retailError: retailResult.error || "",
      targets: [...(orderResult.targets || []), ...(retailResult.targets || [])],
      audit: mergeAudit(orderResult.audit, retailResult.audit),
      months: dateInfo.months || [],
      dateInfo
    };
  }

  function normalizeMonthlyTargets(rows, dateInfo) {
    return mergeTargetResults(normalizeOrderTargets(rows, dateInfo), normalizeRetailTargets(rows, dateInfo), dateInfo);
  }

  function normalizeTargetActualRows(rows) {
    return (rows || []).flatMap((row) => {
      const month = monthKey(row.target_month);
      const brand = clean(row.brand_name);
      const dealerCode = clean(row.dealer_code);
      const vehicleSeries = clean(row.vehicle_series);
      if (!month || !brand || !dealerCode || !vehicleSeries) return [];
      return [{
        month,
        brand,
        dealerCode,
        vehicleSeries,
        actualOrders: Number(row.target_actual_orders || 0) || 0,
        actualRetail: Number(row.target_actual_retail || 0) || 0
      }];
    });
  }

  async function loadMonthlyTargetRaw(params, range) {
    const dateInfo = targetDateInfo(range);
    const emptyAudit = emptyTargetAudit();
    if (params.brand !== TARGET_BRAND) return { status: "non_mg", error: "", targets: [], targetActuals: [], audit: emptyAudit, months: [], dateInfo };
    if (!dateInfo.valid) return { status: "invalid_range", error: "", targets: [], targetActuals: [], audit: emptyAudit, months: [], dateInfo };
    const unavailableResult = (error, audit = {}) => ({ status: "unavailable", error: error instanceof Error ? error.message : String(error), targets: [], audit: { ...emptyTargetAudit(), ...audit }, months: dateInfo.months || [], dateInfo });
    const readOrderTargets = async () => {
      const targetDetail = await datasetDetail(DS.monthlyOrderTarget);
      assertRequiredFields(targetDetail, [
        ORDER_TARGET_FIELDS.date,
        ORDER_TARGET_FIELDS.brand,
        ORDER_TARGET_FIELDS.vehicleSeries,
        ORDER_TARGET_FIELDS.orderTarget
      ]);
      const targetPreviewFilters = targetFilters(params, dateInfo.targetRange, { detail: targetDetail, fields: ORDER_TARGET_FIELDS, includeOrganization: false });
      const rows = await allRows(DS.monthlyOrderTarget, targetPreviewFilters, 120000);
      const scoped = resolveOrderRowsInScope(rows, params);
      if (scoped.error) return unavailableResult(scoped.error, scoped.audit);
      return normalizeOrderTargets(scoped.rows, dateInfo);
    };
    const readRetailTargets = async () => {
      const targetDetail = await datasetDetail(DS.monthlyRetailTarget);
      assertRequiredFields(targetDetail, [
        RETAIL_TARGET_FIELDS.date,
        RETAIL_TARGET_FIELDS.dealerCode,
        RETAIL_TARGET_FIELDS.vehicleSeries,
        RETAIL_TARGET_FIELDS.retailTarget
      ]);
      const targetPreviewFilters = targetFilters(params, dateInfo.targetRange, { detail: targetDetail, fields: RETAIL_TARGET_FIELDS });
      return normalizeRetailTargets(await allRows(DS.monthlyRetailTarget, targetPreviewFilters, 120000), dateInfo);
    };
    const [orderSettled, retailSettled, actualSettled] = await Promise.allSettled([
      readOrderTargets(),
      readRetailTargets(),
      executeSqlRows(SALES_TABLE.dsId, targetActualSql(params, dateInfo.targetActualRange), 5000, { failOnLimit: true })
    ]);
    if (actualSettled.status === "rejected") {
      return { ...mergeTargetResults(unavailableResult(actualSettled.reason), unavailableResult(actualSettled.reason), dateInfo), targetActuals: [] };
    }
    const orderResult = orderSettled.status === "fulfilled" ? orderSettled.value : unavailableResult(orderSettled.reason);
    const retailResult = retailSettled.status === "fulfilled" ? retailSettled.value : unavailableResult(retailSettled.reason);
    return { ...mergeTargetResults(orderResult, retailResult, dateInfo), targetActuals: normalizeTargetActualRows(actualSettled.value) };
  }

  function salesStageAggregateSql(stage, params, range) {
    const f = SALES_TABLE.fields;
    const body = salesAggregateSql(params, range).replace(/^\s*SELECT\s*/i, `SELECT ${sqlString(stage)} AS stage,\n        `);
    return body;
  }

  function salesBundleAggregateSql(params, ranges) {
    return [
      salesStageAggregateSql("current", params, ranges.current),
      salesStageAggregateSql("previous", params, ranges.previous),
      salesStageAggregateSql("week", params, ranges.week)
    ].join("\n      UNION ALL\n");
  }

  async function salesAggregateRows(params, range) {
    return executeSqlRows(SALES_TABLE.dsId, salesAggregateSql(params, range), 5000);
  }

  function normalizeSalesRows(rows) {
    const f = SALES_TABLE.fields;
    return (rows || []).flatMap((row) => {
      const dealerCode = clean(row[f.sourceDealer]);
      if (!dealerCode) return [];
      return [{
        [f.dealer]: dealerCode,
        [f.dealerName]: clean(row[f.sourceDealerName]),
        [f.areaName]: clean(row[f.areaName]),
        [f.districtName]: clean(row[f.districtName]),
        [f.leads]: row[f.leads] ?? 0,
        [f.arrivals]: row[f.arrivals] ?? 0,
        [f.drives]: row[f.drives] ?? 0,
        [f.orders]: row[f.orders] ?? 0,
        [f.retail]: row[f.retail] ?? 0
      }];
    });
  }

  async function readCompleteSalesPreviewRows(filters, maxRows) {
    const pageSize = 5000;
    const pages = [];
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const limit = Math.min(pageSize, maxRows - offset);
      const rows = await previewRows(DS.sales, filters, limit, offset);
      pages.push(...rows);
      if (rows.length < limit) return normalizeSalesRows(pages);
    }
    throw new Error(`销售明细分页达到安全上限 ${maxRows} 行，未读到末页，完整性不可证`);
  }

  async function loadSalesPreviewRows(params, range, maxRows = 120000) {
    const filters = salesFilters(params, range);
    const key = salesPreviewCacheKey(params, range, maxRows);
    if (rowsCache.has(key)) return rowsCache.get(key);
    return rememberRows(key, readCompleteSalesPreviewRows(filters, maxRows));
  }

  function salesPreviewCacheKey(params, range, maxRows = 120000) {
    return `complete-sales:${cacheKey(DS.sales, salesFilters(params, range), maxRows)}`;
  }

  async function loadSalesRows(params, range) {
    try {
      return await salesAggregateRows(params, range);
    } catch (error) {
      console.warn("销售主表聚合 SQL 读取失败，降级为明细分页读取", error);
      return loadSalesPreviewRows(params, range);
    }
  }

  async function loadSalesBundleRows(params, ranges) {
    const limit = 15000;
    try {
      const rows = await executeSqlRows(SALES_TABLE.dsId, salesBundleAggregateSql(params, ranges), limit);
      const rowsForStage = (stage) => rows
        .filter((row) => row.stage === stage)
        .map(({ stage: ignored, ...row }) => row);
      return {
        sales: rowsForStage("current"),
        salesPrev: rowsForStage("previous"),
        salesWeek: rowsForStage("week"),
        scopeEvidence: { source: "aggregate-sql", rowCount: rows.length, limit, hitLimit: rows.length >= limit, complete: rows.length < limit }
      };
    } catch (error) {
      console.warn("销售主表合并聚合 SQL 读取失败，降级为分段读取", error);
      const [sales, salesPrev, salesWeek] = await Promise.all([
        loadSalesRows(params, ranges.current),
        loadSalesRows(params, ranges.previous),
        loadSalesRows(params, ranges.week)
      ]);
      return { sales, salesPrev, salesWeek, scopeEvidence: { source: "fallback", rowCount: sales.length + salesPrev.length + salesWeek.length, limit, hitLimit: false, complete: false } };
    }
  }

  function vehicleSeriesOptionsSql(brand) {
    const f = SALES_TABLE.fields;
    return `
      SELECT DISTINCT ${textExpr(f.vehicleSeries)} AS ${sqlIdent(f.vehicleSeries)}
      FROM ${sqlIdent(SALES_TABLE.table)}
      WHERE ${sqlIdent(f.brand)} = ${sqlString(brand === ALL ? "MG" : brand)}
        AND ${textExpr(f.vehicleSeries)} <> ''
    `;
  }

  async function loadVehicleSeriesOptions(params) {
    const brand = params?.brand === ALL || !params?.brand ? "MG" : params.brand;
    if (!vehicleSeriesOptionsCache.has(brand)) {
      const request = executeSqlRows(SALES_TABLE.dsId, vehicleSeriesOptionsSql(brand), 5000)
        .then((rows) => window.RetailVehicleSeries.sortVehicleSeriesOptions(rows.map((row) => row[SALES_TABLE.fields.vehicleSeries])));
      vehicleSeriesOptionsCache.set(brand, request);
      request.catch(() => vehicleSeriesOptionsCache.delete(brand));
    }
    return vehicleSeriesOptionsCache.get(brand);
  }

  function realtimeIpTagFilters(params, range, timeField) {
    return [...orgFilters(params, {
      brand: "品牌名称",
      areaCode: "大区编码",
      districtCode: "小区编码",
      storeCode: "经销商代码"
    }), dateFilter(timeField, range)];
  }

  function realtimeDriveTagFilters(params, range) {
    return [...orgFilters(params, {
      brand: "brand_name",
      areaCode: "rfs_code",
      districtCode: "mac_code",
      storeCode: "trial_recv_dealer_code"
    }), { field: "trial_recv_time", type: "BT", value: [range.startDate, `${range.endDate} 23:59:59`] }];
  }

  function splitRealtime(range) {
    const today = dateKey(new Date());
    if (range.startDate > today || range.endDate < today) return { history: range, today: null };
    const historyEnd = dateKey(addDays(new Date(`${today}T00:00:00`), -1));
    return {
      history: range.startDate <= historyEnd ? { startDate: range.startDate, endDate: historyEnd } : null,
      today: { startDate: today, endDate: today }
    };
  }

  function tagTargetWhere(kind, field) {
    const tags = PROCESS_TARGET_TAGS[kind] || [];
    return tags.length ? `${textExpr(field)} IN (${tags.map(sqlString).join(", ")})` : "1 = 1";
  }

  function baseTagSelect(kind, config, range, params) {
    const f = config.fields;
    const where = [
      ...sqlOrgWhere(params, f),
      ...sqlDateWhere(f, range),
      `${textExpr(f.record)} <> ''`
    ];
    const vehicleWhere = processVehicleSeriesSqlCondition(kind, config, params);
    if (vehicleWhere) where.push(vehicleWhere);
    return `
      SELECT
        ${textExpr(f.record)} AS record_id,
        ${textExpr(f.dealer)} AS dealer_code,
        ${textExpr(f.dealerName)} AS dealer_name,
        ${textExpr(f.tag1)} AS tag1,
        ${textExpr(f.tag2)} AS tag2,
        ${textExpr(f.polarity)} AS polarity
        ${f.judged ? `, ${textExpr(f.judged)} AS judged` : ""}
      FROM ${sqlIdent(config.table)}
      WHERE ${where.join("\n        AND ")}
    `;
  }

  function tagAggregateQuery(config, baseSelect, body) {
    const source = config.inlineBase ? `(${baseSelect}) base` : "base";
    return config.inlineBase ? body(source) : `WITH base AS (${baseSelect}) ${body(source)}`;
  }

  function ipAggregateSql(config, range, params) {
    const negative = "polarity IN ('负向', '負向', '反向')";
    return tagAggregateQuery(config, baseTagSelect("ip", config, range, params), (source) => `
      SELECT 'summary' AS row_type, '__ALL__' AS dealer_code, '全部' AS dealer_name, '' AS tag1, '' AS tag2,
        COUNT(DISTINCT record_id) AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        0 AS mention_count
      FROM ${source}
      UNION ALL
      SELECT 'summary' AS row_type, dealer_code, MAX(dealer_name) AS dealer_name, '' AS tag1, '' AS tag2,
        COUNT(DISTINCT record_id) AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        0 AS mention_count
      FROM ${source} GROUP BY dealer_code
      UNION ALL
      SELECT 'problem_parent' AS row_type, '__ALL__' AS dealer_code, '全部' AS dealer_name, tag1, '' AS tag2,
        0 AS total_count, COUNT(DISTINCT record_id) AS negative_count, 0 AS mention_count
      FROM ${source} WHERE ${negative} AND tag1 <> '' AND ${tagTargetWhere("ip", "tag1")} GROUP BY tag1
      UNION ALL
      SELECT 'problem_parent' AS row_type, dealer_code, MAX(dealer_name) AS dealer_name, tag1, '' AS tag2,
        0 AS total_count, COUNT(DISTINCT record_id) AS negative_count, 0 AS mention_count
      FROM ${source} WHERE ${negative} AND tag1 <> '' AND ${tagTargetWhere("ip", "tag1")} GROUP BY dealer_code, tag1
    `);
  }

  function driveAggregateSql(config, range, params) {
    const mentioned = "tag1 <> '' AND tag2 <> ''";
    const judged = "(judged = '' OR (judged NOT LIKE '%未判%' AND judged NOT LIKE '%无法%' AND judged IN ('是', '已判向', '已判定', '已判定正负向', '正向', '负向')))";
    const negative = `${mentioned} AND ${judged} AND polarity IN ('负向', '負向', '反向')`;
    return tagAggregateQuery(config, baseTagSelect("drive", config, range, params), (source) => `
      SELECT 'summary' AS row_type, '__ALL__' AS dealer_code, '全部' AS dealer_name, '' AS tag1, '' AS tag2,
        COUNT(DISTINCT CASE WHEN ${mentioned} THEN record_id END) AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        0 AS mention_count
      FROM ${source}
      UNION ALL
      SELECT 'summary' AS row_type, dealer_code, MAX(dealer_name) AS dealer_name, '' AS tag1, '' AS tag2,
        COUNT(DISTINCT CASE WHEN ${mentioned} THEN record_id END) AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        0 AS mention_count
      FROM ${source} GROUP BY dealer_code
      UNION ALL
      SELECT 'problem_parent' AS row_type, '__ALL__' AS dealer_code, '全部' AS dealer_name, tag1, '' AS tag2,
        0 AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        COUNT(DISTINCT CASE WHEN ${mentioned} THEN record_id END) AS mention_count
      FROM ${source} WHERE tag1 <> '' AND ${tagTargetWhere("drive", "tag1")} GROUP BY tag1
      UNION ALL
      SELECT 'problem_parent' AS row_type, dealer_code, MAX(dealer_name) AS dealer_name, tag1, '' AS tag2,
        0 AS total_count,
        COUNT(DISTINCT CASE WHEN ${negative} THEN record_id END) AS negative_count,
        COUNT(DISTINCT CASE WHEN ${mentioned} THEN record_id END) AS mention_count
      FROM ${source} WHERE tag1 <> '' AND ${tagTargetWhere("drive", "tag1")} GROUP BY dealer_code, tag1
    `);
  }

  function mergeAggregateRows(rows) {
    const byCode = new Map();
    function entry(code, name) {
      const key = code || "__UNKNOWN__";
      if (!byCode.has(key)) byCode.set(key, { code: key, name: name || "", total: 0, negative: 0, problemParents: new Map(), problemChildren: new Map() });
      const current = byCode.get(key);
      if (!current.name && name) current.name = name;
      return current;
    }
    rows.forEach((row) => {
      const item = entry(clean(row.dealer_code), clean(row.dealer_name));
      const type = clean(row.row_type);
      const tag1 = clean(row.tag1);
      const tag2 = clean(row.tag2);
      const negative = Number(row.negative_count || 0);
      const mention = Number(row.mention_count || 0);
      if (type === "summary") {
        item.total += Number(row.total_count || 0);
        item.negative += negative;
      } else if (type === "problem_parent" && tag1) {
        const parent = item.problemParents.get(tag1) || { name: tag1, count: 0, mention: 0 };
        parent.count += negative;
        parent.mention += mention;
        item.problemParents.set(tag1, parent);
      } else if (type === "problem_child" && tag1 && tag2) {
        const key = `${tag1}\u0000${tag2}`;
        const child = item.problemChildren.get(key) || { parent: tag1, name: tag2, count: 0 };
        child.count += negative;
        item.problemChildren.set(key, child);
      }
    });
    return [...byCode.values()].map((item) => {
      const problems = [...item.problemParents.values()].map((parent) => ({
        name: parent.name,
        count: parent.count,
        denominator: parent.mention || item.total,
        rate: (parent.mention || item.total) > 0 ? (parent.count / (parent.mention || item.total)) * 100 : null,
        children: [...item.problemChildren.values()]
          .filter((child) => child.parent === parent.name)
          .map((child) => ({ name: child.name, count: child.count }))
          .sort((left, right) => right.count - left.count)
      })).sort((left, right) => right.count - left.count);
      return {
        code: item.code,
        name: item.name,
        total: item.total,
        negative: item.negative,
        rate: item.total > 0 ? (item.negative / item.total) * 100 : null,
        problems
      };
    });
  }

  function aggregatePayload(rows, kind = "") {
    const merged = mergeAggregateRows(rows);
    const overall = normalizeProcessAggregate(kind, merged.find((item) => item.code === "__ALL__") || { total: 0, negative: 0, rate: null, problems: [] });
    const stores = merged.filter((item) => item.code && item.code !== "__ALL__").map((item) => normalizeProcessAggregate(kind, item));
    return { overall, stores };
  }

  function normalizeProcessAggregate(kind, aggregate) {
    if (kind !== "ip" || !aggregate || Number(aggregate.total || 0) <= 0) return aggregate;
    const existing = new Map((aggregate.problems || []).map((item) => [clean(item.name), item]));
    const problems = PROCESS_TARGET_TAGS.ip.map((name) => {
      const current = existing.get(name);
      if (current) return current;
      return { name, count: 0, denominator: Number(aggregate.total || 0), rate: 0, children: [] };
    });
    const extras = (aggregate.problems || []).filter((item) => !PROCESS_TARGET_TAGS.ip.includes(clean(item.name)));
    return { ...aggregate, problems: [...problems, ...extras] };
  }

  async function sqlTagAggregate(kind, params, range) {
    const parts = splitRealtime(range);
    const requests = [];
    if (parts.history) {
      const config = TAG_TABLES[kind].history;
      const query = kind === "ip" ? ipAggregateSql(config, parts.history, params) : driveAggregateSql(config, parts.history, params);
      requests.push(executeSqlRows(config.dsId, query, PROCESS_EVIDENCE_LIMIT).then((rows) => ({ rows, evidence: processEvidence({ kind, stage: "", source: "aggregate-sql", part: "history", dsId: config.dsId, rowCount: rows.length, limit: PROCESS_EVIDENCE_LIMIT }) })));
    }
    if (parts.today) {
      const config = TAG_TABLES[kind].realtime;
      const query = kind === "ip" ? ipAggregateSql(config, parts.today, params) : driveAggregateSql(config, parts.today, params);
      requests.push(executeSqlRows(config.dsId, query, PROCESS_EVIDENCE_LIMIT).then((rows) => ({ rows, evidence: processEvidence({ kind, stage: "", source: "aggregate-sql", part: "realtime", dsId: config.dsId, rowCount: rows.length, limit: PROCESS_EVIDENCE_LIMIT }) })));
    }
    const results = await Promise.all(requests);
    const evidence = {
      kind,
      source: "aggregate-sql",
      rowCount: results.reduce((sum, item) => sum + item.evidence.rowCount, 0),
      limit: PROCESS_EVIDENCE_LIMIT,
      hitLimit: results.some((item) => item.evidence.hitLimit),
      complete: results.every((item) => item.evidence.complete),
      parts: results.map((item) => item.evidence),
      error: ""
    };
    if (evidence.hitLimit || !evidence.complete) {
      evidence.error = `SQL 聚合结果达到安全上限 ${PROCESS_EVIDENCE_LIMIT} 行，完整性不可证`;
      const error = new Error(evidence.error);
      error.evidence = evidence;
      throw error;
    }
    const payload = aggregatePayload(results.flatMap((item) => item.rows), kind);
    payload.evidence = evidence;
    return payload;
  }

  function processEvidence({ kind, stage = "", source, part = "", dsId = "", rowCount = 0, limit = PROCESS_EVIDENCE_LIMIT, error = "", parts = [] }) {
    const hitLimit = rowCount >= limit;
    const message = error || (hitLimit ? `SQL 聚合结果达到安全上限 ${limit} 行，完整性不可证` : "");
    return { kind, stage, source, part, dsId, rowCount, limit, hitLimit, complete: !hitLimit && !message, error: message, parts };
  }

  function processErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }

  function processErrorWithEvidence(evidence, cause) {
    const error = new Error(evidence.error || processErrorMessage(cause));
    error.cause = cause;
    error.evidence = evidence;
    return error;
  }

  function mergeProcessEvidence(base, extraParts) {
    const parts = [...(extraParts || []), ...(base.parts || [])].filter(Boolean);
    return {
      ...base,
      parts
    };
  }

  function mappedValue(row, aliases) {
    for (const key of aliases) {
      const value = row?.[key];
      if (value !== undefined && value !== null && clean(value) !== "") return value;
    }
    return "";
  }

  function normalizeRealtimeDriveTagRows(rows) {
    return (rows || []).map((row) => {
      const mapped = { ...row };
      Object.entries(DRIVE_TAG_REALTIME_FIELD_MAP).forEach(([target, aliases]) => {
        if (mapped[target] === undefined || mapped[target] === null || clean(mapped[target]) === "") mapped[target] = mappedValue(row, aliases);
      });
      return mapped;
    });
  }

  function isRealtimeDriveTag(dsId) {
    return dsId === DS.driveTagRealtime;
  }

  async function tagRows(params, range, historyDs, realtimeDs, timeField, realtimeFilters = tagFilters) {
    const parts = splitRealtime(range);
    const requests = [];
    if (parts.history) requests.push(allRows(historyDs, tagFilters(params, parts.history, timeField)));
    if (parts.today) requests.push(allRows(realtimeDs, realtimeFilters(params, parts.today, timeField)).then((rows) => isRealtimeDriveTag(realtimeDs) ? normalizeRealtimeDriveTagRows(rows) : rows));
    return (await Promise.all(requests)).flat();
  }

  async function scopedTagRows(params, range, historyDs, realtimeDs, timeField, realtimeFilters, validDealers) {
    if (shouldTryDirectTagScope(params)) {
      try {
        return await tagRows(params, range, historyDs, realtimeDs, timeField, realtimeFilters);
      } catch (error) {
        console.warn("标签数据按组织范围直查失败，降级为按门店分片读取", error);
      }
    }
    const dealers = dealerScope(params, validDealers);
    if (!dealers.length) return tagRows(params, range, historyDs, realtimeDs, timeField, realtimeFilters);
    const chunks = await mapLimit(dealers, 4, (dealer) => tagRows({
      ...params,
      areaCode: dealer.areaCode || params.areaCode,
      districtCode: dealer.districtCode || params.districtCode,
      dealerCode: dealer.code,
      store: dealer.name
    }, range, historyDs, realtimeDs, timeField, realtimeFilters));
    return chunks.flat();
  }

  async function scopedTagRowsWithEvidence(kind, stage, params, range, historyDs, realtimeDs, timeField, realtimeFilters, validDealers) {
    const parts = splitRealtime(range);
    const results = [];
    async function readPart(part, dsId, targetRange) {
      try {
        const rows = await scopedTagRows(params, targetRange, historyDs, realtimeDs, timeField, realtimeFilters, validDealers);
        return { rows, evidence: processEvidence({ kind, stage, source: "detail-fallback", part, dsId, rowCount: rows.length, limit: DETAIL_FALLBACK_LIMIT }) };
      } catch (error) {
        const partEvidence = processEvidence({
          kind,
          stage,
          source: "detail-fallback",
          part,
          dsId,
          rowCount: 0,
          limit: DETAIL_FALLBACK_LIMIT,
          error: processErrorMessage(error)
        });
        const evidence = processEvidence({
          kind,
          stage,
          source: "detail-fallback",
          rowCount: results.reduce((sum, item) => sum + item.evidence.rowCount, 0),
          limit: DETAIL_FALLBACK_LIMIT,
          error: partEvidence.error,
          parts: [...results.map((item) => item.evidence), partEvidence]
        });
        throw processErrorWithEvidence(evidence, error);
      }
    }
    if (parts.history) {
      results.push(await readPart("history", historyDs, parts.history));
    }
    if (parts.today) {
      results.push(await readPart("realtime", realtimeDs, parts.today));
    }
    const rowCount = results.reduce((sum, item) => sum + item.evidence.rowCount, 0);
    return {
      rows: results.flatMap((item) => item.rows),
      evidence: processEvidence({ kind, stage, source: "detail-fallback", rowCount, limit: DETAIL_FALLBACK_LIMIT, parts: results.map((item) => item.evidence) })
    };
  }

  function shouldTryDirectTagScope(params) {
    if (params.dealerCode || (params.store && params.store !== ALL)) return true;
    return Boolean(params.districtCode || (params.district && params.district !== ALL));
  }

  async function loadRegionRaw(params) {
    const range = resolveDateRange(params);
    const previousRange = previousMonthRange(range);
    const [sales, salesPrev, dcc, dccPrev, drive, drivePrev, orders, ordersPrev, ipTags, ipTagsPrev, driveTags, driveTagsPrev] = await Promise.all([
      loadSalesPreviewRows(params, range, 200000),
      loadSalesPreviewRows(params, previousRange, 200000),
      allRows(DS.dcc, dccFilters(params, range)),
      allRows(DS.dcc, dccFilters(params, previousRange)),
      allRows(DS.drive, driveFilters(params, range)),
      allRows(DS.drive, driveFilters(params, previousRange)),
      allRows(DS.order, orderFilters(params, range)),
      allRows(DS.order, orderFilters(params, previousRange)),
      tagRows(params, range, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters),
      tagRows(params, previousRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters),
      tagRows(params, range, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters),
      tagRows(params, previousRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters)
    ]);
    return { range, previousRange, sales, salesPrev, dcc, dccPrev, drive, drivePrev, orders, ordersPrev, ipTags, ipTagsPrev, driveTags, driveTagsPrev, ipTagsWeek: [], driveTagsWeek: [] };
  }

  async function loadSalesRaw(params, options = {}) {
    const includeMonthlyTarget = options.includeMonthlyTarget !== false && options.skipMonthlyTarget !== true;
    const includeVehicleSeriesOptions = options.includeVehicleSeriesOptions !== false && options.skipVehicleSeriesOptions !== true;
    const range = resolveDateRange(params);
    const previousRange = previousMonthRange(range);
    const weekRange = previousWeekRange(range);
    const loaders = [
      loadSalesBundleRows(params, { current: range, previous: previousRange, week: weekRange }),
      includeVehicleSeriesOptions ? loadVehicleSeriesOptions(params) : Promise.resolve(options.vehicleSeriesOptions || [])
    ];
    if (includeMonthlyTarget) loaders.push(loadMonthlyTargetRaw(params, range));
    const [salesBundle, vehicleSeriesOptions, monthlyTargetResult] = await Promise.all(loaders);
    const monthlyTarget = includeMonthlyTarget ? monthlyTargetResult : monthlyTargetLoadingRaw(params, range);
    const { sales, salesPrev, salesWeek, scopeEvidence } = salesBundle;
    return { range, previousRange, weekRange, sales, salesPrev, salesWeek, vehicleSeriesOptions, monthlyTarget, scopeEvidence, dcc: [], dccPrev: [], drive: [], drivePrev: [], orders: [], ordersPrev: [], ipTags: [], ipTagsPrev: [], driveTags: [], driveTagsPrev: [], ipTagsWeek: [], driveTagsWeek: [] };
  }
  loadSalesRaw.supportsMonthlyTargetOptions = true;
  loadSalesRaw.supportsVehicleSeriesOptions = true;

  function isBroadProcessScope(params) {
    return (!params.district || params.district === ALL) && (!params.store || params.store === ALL);
  }

  async function loadInviteRaw(params, baseRaw, validDealers = []) {
    if (isBroadProcessScope(params)) {
      throw new Error("当前为全部小区/全部经销商，过程明细数据量过大。请在父应用选择具体小区或经销商后查看邀约、试驾过程指标。");
    }
    const range = baseRaw.range || resolveDateRange(params);
    const previousRange = baseRaw.previousRange || previousMonthRange(range);
    const weekRange = previousWeekRange(range);
    const [dcc, dccPrev, ipTags, ipTagsPrev, ipTagsWeek] = await Promise.all([
      scopedAllRows(DS.dcc, dccFilters, params, range, 80000, validDealers),
      scopedAllRows(DS.dcc, dccFilters, params, previousRange, 80000, validDealers),
      scopedTagRows(params, range, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
      scopedTagRows(params, previousRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
      scopedTagRows(params, weekRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers)
    ]);
    return { dcc, dccPrev, ipTags, ipTagsPrev, ipTagsWeek };
  }

  async function loadDriveRaw(params, baseRaw, validDealers = []) {
    if (isBroadProcessScope(params)) {
      throw new Error("当前为全部小区/全部经销商，过程明细数据量过大。请在父应用选择具体小区或经销商后查看邀约、试驾过程指标。");
    }
    const range = baseRaw.range || resolveDateRange(params);
    const previousRange = baseRaw.previousRange || previousMonthRange(range);
    const weekRange = previousWeekRange(range);
    const [drive, drivePrev, orders, ordersPrev, driveTags, driveTagsPrev, driveTagsWeek] = await Promise.all([
      scopedAllRows(DS.drive, driveFilters, params, range, 80000, validDealers),
      scopedAllRows(DS.drive, driveFilters, params, previousRange, 80000, validDealers),
      scopedAllRows(DS.order, orderFilters, params, range, 80000, validDealers),
      scopedAllRows(DS.order, orderFilters, params, previousRange, 80000, validDealers),
      scopedTagRows(params, range, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers),
      scopedTagRows(params, previousRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers),
      scopedTagRows(params, weekRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers)
    ]);
    return { drive, drivePrev, orders, ordersPrev, driveTags, driveTagsPrev, driveTagsWeek };
  }

  async function loadProcessRaw(params, baseRaw, validDealers = []) {
    const [inviteRaw, driveRaw] = await Promise.all([
      loadInviteRaw(params, baseRaw, validDealers),
      loadDriveRaw(params, baseRaw, validDealers)
    ]);
    return { ...baseRaw, ...inviteRaw, ...driveRaw };
  }

  async function loadNegativeProcessRaw(params, baseRaw, validDealers = []) {
    if (selectedVehicleSeries(params).length) {
      throw processVehicleFieldGap("过程标签明细 legacy 路径不支持已审计车系过滤，已阻断未过滤降级");
    }
    const range = baseRaw.range || resolveDateRange(params);
    const previousRange = baseRaw.previousRange || previousMonthRange(range);
    const weekRange = baseRaw.weekRange || previousWeekRange(range);
    const [ipTags, ipTagsPrev, ipTagsWeek, driveTags, driveTagsPrev, driveTagsWeek] = await Promise.all([
      scopedTagRows(params, range, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
      scopedTagRows(params, previousRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
      scopedTagRows(params, weekRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
      scopedTagRows(params, range, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers),
      scopedTagRows(params, previousRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers),
      scopedTagRows(params, weekRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers)
    ]);
    return { ipTags, ipTagsPrev, ipTagsWeek, driveTags, driveTagsPrev, driveTagsWeek };
  }

  async function loadNegativeProcessStageRaw(stage, params, baseRaw, validDealers = []) {
    const range = baseRaw.range || resolveDateRange(params);
    const previousRange = baseRaw.previousRange || previousMonthRange(range);
    const weekRange = baseRaw.weekRange || previousWeekRange(range);
    const targetRange = stage === "previous" ? previousRange : stage === "week" ? weekRange : range;
    const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
    try {
      const [ipAgg, driveAgg] = await Promise.all([
        sqlTagAggregate("ip", params, targetRange),
        sqlTagAggregate("drive", params, targetRange)
      ]);
      return {
        [`ipAgg${suffix}`]: ipAgg.overall,
        [`ipAggStores${suffix}`]: ipAgg.stores,
        [`driveTagAgg${suffix}`]: driveAgg.overall,
        [`driveTagAggStores${suffix}`]: driveAgg.stores
      };
    } catch (error) {
      if (selectedVehicleSeries(params).length) {
        if (error && typeof error === "object" && error.evidence) error.evidence = { ...error.evidence, stage };
        throw error;
      }
      if (/安全上限|完整性不可证/.test(error instanceof Error ? error.message : String(error))) throw error;
      console.warn("标签聚合 SQL 读取失败，降级为明细读取", error);
      const [ipTags, driveTags] = await Promise.all([
        scopedTagRows(params, targetRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers),
        scopedTagRows(params, targetRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers)
      ]);
      return {
        [`ipTags${suffix}`]: ipTags,
        [`driveTags${suffix}`]: driveTags
      };
    }
  }

  async function loadNegativeProcessKindStageRaw(kind, stage, params, baseRaw, validDealers = []) {
    const range = baseRaw.range || resolveDateRange(params);
    const previousRange = baseRaw.previousRange || previousMonthRange(range);
    const weekRange = baseRaw.weekRange || previousWeekRange(range);
    const targetRange = stage === "previous" ? previousRange : stage === "week" ? weekRange : range;
    const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
    const evidenceKey = `${kind}TagEvidence${suffix}`;
    try {
      const aggregate = await sqlTagAggregate(kind, params, targetRange);
      const prefix = kind === "ip" ? "ipAgg" : "driveTagAgg";
      return {
        [`${prefix}${suffix}`]: aggregate.overall,
        [`${prefix}Stores${suffix}`]: aggregate.stores,
        [evidenceKey]: { ...aggregate.evidence, stage }
      };
    } catch (error) {
      if (selectedVehicleSeries(params).length) {
        if (error && typeof error === "object" && error.evidence) error.evidence = { ...error.evidence, stage };
        throw error;
      }
      if (/安全上限|完整性不可证/.test(error instanceof Error ? error.message : String(error))) {
        if (error && typeof error === "object" && error.evidence) error.evidence = { ...error.evidence, stage };
        throw error;
      }
      const sqlFailureEvidence = processEvidence({
        kind,
        stage,
        source: "aggregate-sql",
        rowCount: 0,
        limit: PROCESS_EVIDENCE_LIMIT,
        error: processErrorMessage(error),
        parts: error && typeof error === "object" && error.evidence ? [error.evidence] : []
      });
      console.warn(`${kind} 标签聚合 SQL 读取失败，降级为明细读取`, error);
      try {
        if (kind === "ip") {
          const fallback = await scopedTagRowsWithEvidence(kind, stage, params, targetRange, DS.ipTag, DS.ipTagRealtime, "呼叫开始时间", realtimeIpTagFilters, validDealers);
          return { [`ipTags${suffix}`]: fallback.rows, [evidenceKey]: mergeProcessEvidence(fallback.evidence, [sqlFailureEvidence]) };
        }
        const fallback = await scopedTagRowsWithEvidence(kind, stage, params, targetRange, DS.driveTag, DS.driveTagRealtime, "试驾接待时间", realtimeDriveTagFilters, validDealers);
        return { [`driveTags${suffix}`]: fallback.rows, [evidenceKey]: mergeProcessEvidence(fallback.evidence, [sqlFailureEvidence]) };
      } catch (fallbackError) {
        const fallbackEvidence = fallbackError && typeof fallbackError === "object" && fallbackError.evidence
          ? fallbackError.evidence
          : processEvidence({ kind, stage, source: "detail-fallback", rowCount: 0, limit: DETAIL_FALLBACK_LIMIT, error: processErrorMessage(fallbackError) });
        const evidence = mergeProcessEvidence(fallbackEvidence, [sqlFailureEvidence]);
        throw processErrorWithEvidence(evidence, fallbackError);
      }
    }
  }

  const api = { loadRegionRaw, loadSalesRaw, loadVehicleSeriesOptions, loadInviteRaw, loadDriveRaw, loadProcessRaw, loadNegativeProcessRaw, loadNegativeProcessStageRaw, loadNegativeProcessKindStageRaw, resolveDateRange, previousMonthRange, previousWeekRange, salesFilters, salesPreviewCacheKey, salesAggregateSql, vehicleSeriesOptionsSql, loadMonthlyTargetRaw, targetActualSql, targetDateInfo, ALL, __transport: { allRows, executeSqlRows, resolveDateRange } };
  if (window.__IRON_METRICS_TEST__ === true) {
    api[["__", "test"].join("")] = { ipAggregateSql, driveAggregateSql, PROCESS_TARGET_TAGS, TAG_TABLES, normalizeRealtimeDriveTagRows, realtimeIpTagFilters, realtimeDriveTagFilters, aggregatePayload, normalizeMonthlyTargets, normalizeOrderTargets, normalizeRetailTargets, normalizeTargetActualRows, targetDateInfo, targetFilters, resolveOrderRowsInScope, orderRowsInScope, targetActualSql, monthlyTargetLoadingRaw, DS };
  }
  window.RegionDataApi = api;
})();
