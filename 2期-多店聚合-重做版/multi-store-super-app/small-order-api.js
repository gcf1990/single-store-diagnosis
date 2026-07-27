(function (root) {
  const cfg = () => root.SmallOrderConfig;
  const pendingRequests = new Map();
  const organizationRowsCache = new Map();

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function sqlIdent(name) {
    return `\`${String(name).replace(/`/g, "``")}\``;
  }

  function sqlString(value) {
    return `'${String(value ?? "").replace(/'/g, "''")}'`;
  }

  function textExpr(field) {
    return `TRIM(CAST(${sqlIdent(field)} AS STRING))`;
  }

  function numberExpr(field) {
    return `CAST(${sqlIdent(field)} AS DOUBLE)`;
  }

  function resourceUrl(path) {
    if (!path.startsWith("/api/")) return path;
    if (root.location?.hostname === "localhost") return path;
    const match = root.location?.pathname?.match(/^(.*)\/open-apps(?:\/|$)/);
    return `${match?.[1] || ""}${path}`;
  }

  async function readJson(response) {
    const text = await response.text();
    if (!response.ok) throw new Error(`观远接口请求失败：${response.status}`);
    if (text.trim().startsWith("<")) throw new Error("观远接口返回 HTML，请检查登录态或开放应用路由");
    const payload = JSON.parse(text || "{}");
    if (payload?.error) throw new Error(payload.error.message || "观远接口返回错误");
    if (payload?.code !== undefined && payload.code !== 0) throw new Error(payload.msg || `观远接口返回错误：${payload.code}`);
    return payload.response ?? payload.data ?? payload;
  }

  function smallOrderActualSql(range) {
    const fields = {
      date: "日yyyy-mm-dd",
      brand: "品牌名称",
      dealer: "一级经销商代码",
      vehicleSeries: "汇报车系名称",
      smallOrder: "当日首触小订数",
      retained: "当日首触留存小订数",
      cancelled: "当日首触小订退订数",
      updatedAt: "调度时间"
    };
    return `
      SELECT
        ${textExpr(fields.dealer)} AS dealer_code,
        SUM(${numberExpr(fields.smallOrder)}) AS actual_small_order,
        SUM(${numberExpr(fields.retained)}) AS retained_small_order,
        SUM(${numberExpr(fields.cancelled)}) AS cancelled_small_order,
        MAX(${textExpr(fields.updatedAt)}) AS data_updated_at
      FROM ${sqlIdent("[微批][三品牌]新零售门店级每日全量指标宽表&ads_sale_mart_new_sale_store_lvl_day_exnorm_comb_wms_his")}
      WHERE ${sqlIdent(fields.brand)} = ${sqlString("MG")}
        AND ${sqlIdent(fields.vehicleSeries)} = ${sqlString("MG 07")}
        AND ${sqlIdent(fields.date)} >= ${sqlString(range.startDate)}
        AND ${sqlIdent(fields.date)} <= ${sqlString(range.endDate)}
        AND ${textExpr(fields.dealer)} <> ''
      GROUP BY ${textExpr(fields.dealer)}
    `;
  }

  async function datasetDetail(dsId, options = {}) {
    return readJson(await fetch(resourceUrl(`/api/data-source/${dsId}`), { headers: { "raw-backend-response": "TRUE" }, signal: options.signal }));
  }

  function fieldsOf(detail) {
    return [...(detail?.fields || []), ...(detail?.columns || []), ...(detail?.virtualColumns || [])];
  }

  function detailValue(detail, names) {
    return names.map((name) => detail?.[name]).find((value) => clean(value)) || "";
  }

  function assertTargetDataset(detail, rows, config) {
    if (clean(detailValue(detail, ["dsId", "id", "dataSourceId"])) !== config.targetDsId) throw new Error(`目标数据集 dsId 不匹配：${clean(detailValue(detail, ["dsId", "id", "dataSourceId"])) || "--"}`);
    if (clean(detailValue(detail, ["name", "dataSourceName"])) !== cfg().TARGET_DATASET_NAME) throw new Error(`目标数据集名称不匹配：${clean(detailValue(detail, ["name", "dataSourceName"])) || "--"}`);
    if (clean(detailValue(detail, ["parentDirId", "parent_id", "parentId"])) !== config.expectedTargetParentDirId) throw new Error(`目标数据集 parentDirId 不匹配：${clean(detailValue(detail, ["parentDirId", "parent_id", "parentId"])) || "--"}`);
    if (clean(detailValue(detail, ["status", "syncStatus", "state"])) !== config.qa.datasetStatus) throw new Error(`目标数据集状态不是 ${config.qa.datasetStatus}`);
    if (fieldsOf(detail).length !== config.qa.columnCount) throw new Error(`目标数据集列数不是 ${config.qa.columnCount}`);
    if ((rows || []).length !== config.qa.sourceRows) throw new Error(`目标数据集行数不是 ${config.qa.sourceRows}`);
  }

  function assertFields(detail, fields) {
    const names = new Set(fieldsOf(detail).flatMap((field) => [clean(field.name), clean(field.alias)].filter(Boolean)));
    const missing = fields.filter((field) => !names.has(field));
    if (missing.length) throw new Error(`目标数据集缺少必需字段：${missing.join("、")}`);
  }

  function requestKey({ params, validDealers, options, config, period }) {
    const scope = [...new Set((validDealers || []).map((dealer) => clean(dealer.code)).filter(Boolean))].sort();
    return JSON.stringify({
      module: "mg07SmallOrder",
      user: params.personId || params.userId || "",
      role: options.roleResult?.role || "",
      roleOk: options.roleResult?.ok === true,
      entryLevel: options.entryLevel || "",
      permissionScope: scope,
      drillPath: options.drillPath || [],
      targetDsId: config.targetDsId,
      actualDsId: config.actualDsId,
      organizationDsId: config.organizationDsId,
      period: config.period,
      cutoffDate: period.cutoffDate,
      params: { areaCode: clean(params.areaCode), area: clean(params.area), districtCode: clean(params.districtCode), district: clean(params.district), dealerCode: clean(params.dealerCode), store: clean(params.store) }
    });
  }

  function periodActualRange(todayInput) {
    return root.SmallOrderModel.periodInfo(todayInput, cfg().PERIOD).actualRange;
  }

  function organizationCacheKey(config, brand = "MG") {
    return JSON.stringify({ organizationDsId: config.organizationDsId, brand });
  }

  function organizationBrandFilters(brand = "MG") {
    return [{ field: "brand_name", type: "EQ", value: brand }];
  }

  function loadOrganizationRows(config, transport, options = {}) {
    const key = organizationCacheKey(config, "MG");
    if (organizationRowsCache.has(key)) return organizationRowsCache.get(key);
    const promise = transport.allRows(config.organizationDsId, organizationBrandFilters("MG"), 200000, options).then((rows) => {
      const resolved = Promise.resolve(rows);
      organizationRowsCache.set(key, resolved);
      return rows;
    }, (error) => {
      organizationRowsCache.delete(key);
      throw error;
    });
    organizationRowsCache.set(key, promise);
    return promise;
  }

  async function loadSmallOrderRaw(params = {}, validDealers = [], options = {}) {
    const config = cfg().currentSmallOrderConfig();
    const period = root.SmallOrderModel.periodInfo(options.today, config.period);
    const cacheKey = requestKey({ params, validDealers, options, config, period });
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
    const promise = loadSmallOrderRawOnce(params, validDealers, options, config, period);
    pendingRequests.set(cacheKey, promise);
    const clear = () => pendingRequests.delete(cacheKey);
    promise.then(clear, clear);
    return promise;
  }

  async function loadSmallOrderRawOnce(params = {}, validDealers = [], options = {}, config, period) {
    const identity = {
      module: "mg07SmallOrder",
      user: params.personId || params.userId || "",
      role: options.roleResult?.role || "",
      roleOk: options.roleResult?.ok === true,
      entryLevel: options.entryLevel || "",
      permissionScope: validDealers.map((dealer) => clean(dealer.code)).sort(),
      targetDsId: config.targetDsId,
      actualDsId: config.actualDsId,
      organizationDsId: config.organizationDsId,
      period: config.period,
      cutoffDate: period.cutoffDate,
      drillPath: options.drillPath || [],
      params: { areaCode: clean(params.areaCode), area: clean(params.area), districtCode: clean(params.districtCode), district: clean(params.district), dealerCode: clean(params.dealerCode), store: clean(params.store) }
    };
    if (!config.ok) return { status: "target_unavailable", error: config.error, config, period, identity, params, targetRows: [], actualRows: [], organizationRows: [], validDealers, roleResult: options.roleResult, entryLevel: options.entryLevel, enforceTargetContract: true };
    const transport = root.RegionDataApi?.__transport;
    if (!transport?.allRows || !transport?.executeSqlRows) throw new Error("小订数据传输接口不可用");
    try {
      const targetPromise = Promise.all([
        datasetDetail(config.targetDsId, options),
        transport.allRows(config.targetDsId, [], 10000, options),
        loadOrganizationRows(config, transport, options)
      ]);
      const actualPromise = period.actualRange
        ? transport.executeSqlRows(config.actualDsId, smallOrderActualSql(period.actualRange), 5000, { ...options, failOnLimit: true })
        : Promise.resolve([]);
      const [targetResult, actualResult] = await Promise.allSettled([targetPromise, actualPromise]);
      if (targetResult.status === "rejected") throw targetResult.reason;
      const [targetDetail, targetRows, organizationRows] = targetResult.value;
      assertTargetDataset(targetDetail, targetRows, config);
      assertFields(targetDetail, config.targetFields);
      const actualRows = actualResult.status === "fulfilled" ? actualResult.value : [];
      const actualStatus = period.actualRange ? actualResult.status === "fulfilled" ? "ready" : "actual_unavailable" : "not_started";
      const actualError = actualResult.status === "rejected" ? actualResult.reason instanceof Error ? actualResult.reason.message : String(actualResult.reason) : "";
      return { status: "ready", error: "", config, period, identity, params, targetDetail, targetRows, actualRows, actualStatus, actualError, organizationRows, validDealers, roleResult: options.roleResult, entryLevel: options.entryLevel, enforceTargetContract: true };
    } catch (error) {
      return { status: "target_unavailable", error: error instanceof Error ? error.message : String(error), config, period, identity, params, targetRows: [], actualRows: [], actualStatus: "not_loaded", organizationRows: [], validDealers, roleResult: options.roleResult, entryLevel: options.entryLevel, enforceTargetContract: true };
    }
  }

  root.SmallOrderApi = { loadSmallOrderRaw, smallOrderActualSql, periodActualRange, datasetDetail };
  if (root.__SMALL_ORDER_TEST__ === true) root.SmallOrderApi.__test = { organizationBrandFilters, loadOrganizationRows };
})(typeof window !== "undefined" ? window : globalThis);
