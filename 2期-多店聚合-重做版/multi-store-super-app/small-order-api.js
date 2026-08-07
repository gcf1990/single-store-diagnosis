(function (root) {
  const cfg = () => root.SmallOrderConfig;

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
  }

  function assertFields(detail, fields) {
    const names = new Set(fieldsOf(detail).flatMap((field) => [clean(field.name), clean(field.alias)].filter(Boolean)));
    const missing = fields.filter((field) => !names.has(field));
    if (missing.length) throw new Error(`目标数据集缺少必需字段：${missing.join("、")}`);
  }

  function periodActualRange(todayInput) {
    return root.SmallOrderModel.periodInfo(todayInput, cfg().PERIOD).actualRange;
  }

  function isSpecificNonMgBrand(params = {}) {
    const brand = clean(params.brand);
    return Boolean(brand) && brand !== "MG" && brand !== "全部" && brand !== "全部品牌";
  }

  function errorText(error) {
    return error instanceof Error ? error.message : String(error || "");
  }

  function unavailableRaw({ config, period, identity, params, organizationRows, validDealers, entryLevel, rawError, error = "MG 07 小订数据暂不可用" }) {
    return { status: "target_unavailable", error, rawError, config, period, identity, params, targetRows: [], actualRows: [], todayRows: [], actualStatus: "not_loaded", todayStatus: "not_loaded", organizationRows: organizationRows || [], validDealers: validDealers || [], entryLevel, enforceTargetContract: true };
  }

  function dealerName(dealer) {
    return clean(dealer.name || dealer.dealerName || dealer.dealerShortName || dealer.parentDealerShortName || dealer.store || dealer.storeName);
  }

  function parentDealerCode(dealer) {
    return clean(dealer.parentDealerCode || dealer.parent_dealer_code || dealer.parentDealerCompanyCode || dealer.parentCompanyCode || dealer.dealerCompanyCode || dealer.code || dealer.dealerCode);
  }

  function dealerCode(dealer) {
    return clean(dealer.code || dealer.dealerCode || dealer.dealer_code);
  }

  function validDealerOrganizationRows(validDealers = []) {
    return (validDealers || []).map((dealer) => {
      const parentCode = parentDealerCode(dealer);
      const leafCode = dealerCode(dealer) || parentCode;
      const parentName = clean(dealer.parentDealerShortName || dealer.parentDealerName || dealer.parent_dealer_shortnm) || dealerName(dealer) || parentCode;
      const name = dealerName(dealer) || parentName || leafCode;
      return {
        brand_name: "MG",
        parent_dealer_code: parentCode,
        dealer_code: leafCode,
        parent_dealer_shortnm: parentName,
        dealer_shortnm: name,
        rfs_code: clean(dealer.areaCode || dealer.rfsCode),
        rfs_name: clean(dealer.area || dealer.areaName),
        rfs_shortnm: clean(dealer.areaShortName || dealer.area || dealer.areaName),
        mac_code: clean(dealer.districtCode || dealer.macCode),
        mac_name: clean(dealer.district || dealer.districtName),
        mac_shortnm: clean(dealer.districtShortName || dealer.district || dealer.districtName),
        open_mec_stat_name: clean(dealer.openStatus || dealer.status) || "开业",
        is_scd_net_dealer: clean(dealer.networkType || dealer.isScdNetDealer) || "否",
        web_display_name: clean(dealer.officialName || dealer.webDisplayName || name)
      };
    }).filter((row) => row.parent_dealer_code);
  }

  async function loadSmallOrderRaw(params = {}, validDealers = [], options = {}) {
    const config = cfg().currentSmallOrderConfig();
    const period = root.SmallOrderModel.periodInfo(options.today, config.period);
    return loadSmallOrderRawOnce(params, validDealers, options, config, period);
  }

  async function loadSmallOrderRawOnce(params = {}, validDealers = [], options = {}, config, period) {
    const organizationRows = validDealerOrganizationRows(validDealers);
    const identity = {
      module: "mg07SmallOrder",
      user: params.personId || params.userId || "",
      entryLevel: options.entryLevel || "",
      permissionScope: [...new Set(organizationRows.map((row) => row.parent_dealer_code))].sort(),
      targetDsId: config.targetDsId,
      actualDsId: config.actualDsId,
      period: config.period,
      cutoffDate: period.cutoffDate,
      drillPath: options.drillPath || [],
      params: { brand: clean(params.brand), areaCode: clean(params.areaCode), area: clean(params.area), districtCode: clean(params.districtCode), district: clean(params.district), dealerCode: clean(params.dealerCode), store: clean(params.store) }
    };
    if (!config.ok) return unavailableRaw({ config, period, identity, params, organizationRows: [], validDealers, entryLevel: options.entryLevel, rawError: config.error, error: "MG 07 小订目标数据暂不可用" });
    if (isSpecificNonMgBrand(params)) return { status: "ready", error: "", emptyReason: "non_mg_brand", config, period, identity, params, targetRows: [], actualRows: [], todayRows: [], actualStatus: "not_loaded", todayStatus: "not_loaded", actualError: "", todayError: "", organizationRows, validDealers, entryLevel: options.entryLevel, enforceTargetContract: true };
    if (!organizationRows.length) return { status: "ready", error: "", config, period, identity, params, targetRows: [], actualRows: [], todayRows: [], actualStatus: "not_loaded", todayStatus: "not_loaded", actualError: "", todayError: "", organizationRows: [], validDealers: [], entryLevel: options.entryLevel, enforceTargetContract: true };
    try {
      const transport = root.RegionDataApi?.__transport;
      if (!transport?.allRows || !transport?.executeSqlRows) throw new Error("小订数据传输接口不可用");
      const targetPromise = Promise.all([
        datasetDetail(config.targetDsId, options),
        transport.allRows(config.targetDsId, [], 10000, options)
      ]);
      const actualPromise = period.actualRange
        ? transport.executeSqlRows(config.actualDsId, smallOrderActualSql(period.actualRange), 5000, { ...options, failOnLimit: true })
        : Promise.resolve([]);
      const todayPromise = period.todayRange
        ? transport.executeSqlRows(config.actualDsId, smallOrderActualSql(period.todayRange), 5000, { ...options, failOnLimit: true, smallOrderTodayQuery: true })
        : Promise.resolve([]);
      const [targetResult, actualResult, todayResult] = await Promise.allSettled([targetPromise, actualPromise, todayPromise]);
      if (targetResult.status === "rejected") throw targetResult.reason;
      const [targetDetail, targetRows] = targetResult.value;
      assertTargetDataset(targetDetail, targetRows, config);
      assertFields(targetDetail, config.targetFields);
      const actualRows = actualResult.status === "fulfilled" ? actualResult.value : [];
      const todayRows = todayResult.status === "fulfilled" ? todayResult.value : [];
      const actualStatus = period.actualRange ? actualResult.status === "fulfilled" ? "ready" : "actual_unavailable" : "not_started";
      const todayStatus = period.todayRange ? todayResult.status === "fulfilled" ? (todayRows.length ? "ready" : "no_data") : "today_unavailable" : "out_of_period";
      const rawActualError = actualResult.status === "rejected" ? errorText(actualResult.reason) : "";
      const rawTodayError = todayResult.status === "rejected" ? errorText(todayResult.reason) : "";
      const actualError = rawActualError ? "MG 07 小订实际数据暂不可用" : "";
      const todayError = rawTodayError ? "MG 07 小订今日新增数据暂不可用" : "";
      return { status: "ready", error: "", config, period, identity: { ...identity, authorizedDealerCodes: identity.permissionScope }, params, targetDetail, targetRows, actualRows, todayRows, actualStatus, todayStatus, actualError, todayError, rawActualError, rawTodayError, organizationRows, validDealers, entryLevel: options.entryLevel, enforceTargetContract: true };
    } catch (error) {
      return unavailableRaw({ config, period, identity, params, organizationRows, validDealers, entryLevel: options.entryLevel, rawError: errorText(error), error: "MG 07 小订数据暂不可用" });
    }
  }

  root.SmallOrderApi = { loadSmallOrderRaw, smallOrderActualSql, periodActualRange, datasetDetail };
  if (root.__SMALL_ORDER_TEST__ === true) root.SmallOrderApi.__test = { validDealerOrganizationRows };
})(typeof window !== "undefined" ? window : globalThis);
