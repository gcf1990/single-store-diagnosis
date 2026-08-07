(function () {
  const ALL = "全部";
  const DEALER_DIM_DS_ID = window.RetailNationalScope?.CONFIG?.sourceDsId || "a310ff90fddff4b6283841c6";
  const DEALER_DIM_TABLE = "新双品牌经销商主数据维度表&dim_main_dealer_info_p_df_wms";
  const DEALER_SCOPE_SQL_LIMIT = 10000;
  const DEALER_SCOPE_FIELDS = [
    "品牌代码", "品牌名称",
    { source: "父级经销商代码", alias: "一级经销商代码" },
    { source: "父级经销商简称", alias: "父经销商简称" },
    "经销商代码", "经销商简称", "大区代码", "大区简称",
    "小区代码", "小区简称", "官网显示名称", "是否二网经销商", "开业状态名称"
  ];
  const cache = new Map();

  function clean(value) { return String(value || "").trim(); }
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

  async function getJson(url) {
    return readJson(await fetch(resourceUrl(url), { headers: { "raw-backend-response": "TRUE" } }));
  }

  async function postJson(url, body) {
    return readJson(await fetch(resourceUrl(url), {
      method: "POST",
      headers: { "content-type": "application/json;charset=UTF-8", "raw-backend-response": "TRUE" },
      body: JSON.stringify(body)
    }));
  }

  function sqlIdentifier(value) {
    return `\`${String(value).replace(/`/g, "``")}\``;
  }

  function sqlString(value) {
    return `'${String(value ?? "").replace(/'/g, "''")}'`;
  }

  function sqlEq(field, value) {
    return `${sqlIdentifier(field)} = ${sqlString(value)}`;
  }

  function sqlIn(field, values) {
    const normalized = values.map(clean).filter(Boolean);
    if (!normalized.length) return "";
    return `${sqlIdentifier(field)} IN (${normalized.map(sqlString).join(", ")})`;
  }

  async function datasetDetail() {
    if (!cache.has("detail")) cache.set("detail", getJson(`/api/data-source/${DEALER_DIM_DS_ID}`));
    return cache.get("detail");
  }

  function fieldsOf(detail) {
    return [...(detail.fields || []), ...(detail.columns || []), ...(detail.virtualColumns || [])];
  }

  function findField(detail, name) {
    const field = fieldsOf(detail).find((item) => clean(item.name) === name || clean(item.alias) === name);
    if (!field) throw new Error(`筛选数据集缺少字段：${name}`);
    return field;
  }

  function buildFilter(detail, filters) {
    return {
      combineType: "AND",
      conditions: filters.map((filter) => {
        const field = findField(detail, filter.field);
        return {
          type: "condition",
          value: {
            ...field,
            dsId: detail.dsId,
            level: "dataset",
            filterType: filter.type,
            filterValue: Array.isArray(filter.value) ? filter.value : [filter.value]
          }
        };
      })
    };
  }

  async function waitTask(taskId) {
    for (let index = 0; index < 45; index += 1) {
      const task = await getJson(`/api/task/${taskId}`);
      if (task.status === "FINISHED") {
        const result = typeof task.result === "string" ? JSON.parse(task.result) : task.result;
        return result?.response?.value || result?.value || result;
      }
      if (task.status === "FAILED" || task.status === "CANCELED") throw new Error(`筛选数据预览任务失败：${task.status}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("筛选数据预览任务超时");
  }

  function rowsFromPreview(result) {
    return (result.preview || []).map((row) => Object.fromEntries((result.columns || []).flatMap((column, index) => {
      const value = row[index] ?? "";
      return [column.name, column.alias].filter(Boolean).map((key) => [key, value]);
    })));
  }

  function rowsFromSqlResult(result) {
    return (result.preview || []).map((row) => Object.fromEntries((result.columns || []).flatMap((column, index) => {
      const value = row[index] ?? "";
      return [column.name, column.alias, typeof column === "string" ? column : ""].filter(Boolean).map((key) => [key, value]);
    })));
  }

  async function executeSqlRows(query, limit = DEALER_SCOPE_SQL_LIMIT) {
    return rowsFromSqlResult(await postJson("/api/data-source/execute-sql-query", {
      inputs: [DEALER_DIM_DS_ID],
      query,
      limit,
      disableCache: false
    }));
  }

  async function previewPayload(filters) {
    const detail = await datasetDetail();
    const limit = 10000;
    const task = await postJson(`/api/data-source/${DEALER_DIM_DS_ID}/preview-with-filter-async`, {
      offset: 0,
      limit,
      filter: filters.length ? buildFilter(detail, filters) : undefined
    });
    const fileName = await waitTask(task.taskId);
    const rows = rowsFromPreview(await postJson("/api/account/readPreviewFile", { taskId: task.taskId, fileName }));
    return { rows, evidence: { source: "dealer-dimension-preview", sourceDsId: DEALER_DIM_DS_ID, rowCount: rows.length, limit, hitLimit: rows.length >= limit, complete: rows.length < limit } };
  }

  async function previewRows(filters) { return (await previewPayload(filters)).rows; }

  function isRegionName(value) { return /^\d+.+区$/.test(clean(value)); }
  function uniq(values) {
    return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function baseFilters(brand) {
    const filters = [{ field: "开业状态名称", type: "EQ", value: "开业" }];
    if (brand && brand !== ALL) filters.push({ field: "品牌名称", type: "EQ", value: brand });
    return filters;
  }

  function brandValue(params) {
    return params.brand && params.brand !== ALL ? params.brand : "MG";
  }

  function dealerScopeSql(params) {
    const brand = brandValue(params);
    const areaCode = params.areaCode || params.regionCode || "";
    const area = params.area || params.region || "";
    const areaCodes = window.RetailNationalScope?.getBrandAreaCodes(brand);
    const excludedAreaNames = window.RetailNationalScope?.CONFIG?.filters?.excludedAreaNames || [];
    const conditions = [
      sqlEq("开业状态名称", "开业"),
      sqlEq("品牌名称", brand),
      sqlEq("是否二网经销商", "否"),
      `${sqlIdentifier("官网显示名称")} IS NOT NULL`,
      `${sqlIdentifier("官网显示名称")} <> ''`
    ];
    const areaCodeCondition = areaCodes ? sqlIn("大区代码", areaCodes) : "";
    if (areaCodeCondition) conditions.push(areaCodeCondition);
    if (excludedAreaNames.length) conditions.push(`NOT (${sqlIn("大区简称", excludedAreaNames)})`);
    if (areaCode) conditions.push(sqlEq("大区代码", areaCode));
    else if (area && area !== ALL) conditions.push(sqlEq("大区简称", area));
    if (params.districtCode) conditions.push(sqlEq("小区代码", params.districtCode));
    else if (params.district && params.district !== ALL) conditions.push(sqlEq("小区简称", params.district));
    if (params.dealerCode) conditions.push(sqlEq("经销商代码", params.dealerCode));
    else if (params.store && params.store !== ALL) conditions.push(sqlEq("经销商简称", params.store));
    return [
      `SELECT ${DEALER_SCOPE_FIELDS.map((field) => {
        const source = typeof field === "string" ? field : field.source;
        const alias = typeof field === "string" ? field : field.alias;
        return `${sqlIdentifier(source)} AS ${sqlIdentifier(alias)}`;
      }).join(", ")}`,
      `FROM ${sqlIdentifier(DEALER_DIM_TABLE)}`,
      `WHERE ${conditions.filter(Boolean).join(" AND ")}`,
      `LIMIT ${DEALER_SCOPE_SQL_LIMIT}`
    ].join("\n");
  }

  async function dealerScopeSqlPayload(params) {
    const query = dealerScopeSql(params);
    const rows = await executeSqlRows(query);
    return {
      rows,
      evidence: {
        source: "dealer-dimension-execute-sql-query",
        sourceDsId: DEALER_DIM_DS_ID,
        queryMode: "execute-sql-query",
        rowCount: rows.length,
        limit: DEALER_SCOPE_SQL_LIMIT,
        hitLimit: rows.length >= DEALER_SCOPE_SQL_LIMIT,
        complete: rows.length < DEALER_SCOPE_SQL_LIMIT,
        fallback: false
      }
    };
  }

  async function dealerScopePayload(params) {
    const key = `dealer-scope-sql:${JSON.stringify({
      brand: brandValue(params),
      area: params.area || params.region || "",
      areaCode: params.areaCode || params.regionCode || "",
      district: params.district || "",
      districtCode: params.districtCode || "",
      store: params.store || "",
      dealerCode: params.dealerCode || ""
    })}`;
    if (!cache.has(key)) {
      cache.set(key, dealerScopeSqlPayload(params).catch(async (error) => {
        cache.delete(key);
        console.warn?.("[RegionFilterApi] execute-sql-query for dealer scope failed, fallback to preview", error);
        const fallback = await previewPayload(dealerScopeFilters(params));
        return {
          rows: fallback.rows,
          evidence: {
            ...fallback.evidence,
            source: "dealer-dimension-preview-fallback",
            queryMode: "preview-with-filter-async",
            fallback: true,
            fallbackReason: error?.message || String(error)
          }
        };
      }));
    }
    return cache.get(key);
  }

  function scopedFilters(params) {
    const filters = baseFilters(params.brand || "MG");
    const areaCode = params.areaCode || params.regionCode || "";
    const area = params.area || params.region || "";
    if (areaCode) filters.push({ field: "大区代码", type: "EQ", value: areaCode });
    else if (area && area !== ALL) filters.push({ field: "大区简称", type: "EQ", value: area });
    if (params.districtCode) filters.push({ field: "小区代码", type: "EQ", value: params.districtCode });
    else if (params.district && params.district !== ALL) filters.push({ field: "小区简称", type: "EQ", value: params.district });
    return filters;
  }

  function dealerScopeFilters(params) {
    const filters = scopedFilters(params);
    if (params.dealerCode) filters.push({ field: "经销商代码", type: "EQ", value: params.dealerCode });
    else if (params.store && params.store !== ALL) filters.push({ field: "经销商简称", type: "EQ", value: params.store });
    return filters;
  }

  function isRealOpenPrimaryDealer(row) {
    return clean(row["是否二网经销商"]) === "否" && Boolean(clean(row["官网显示名称"]));
  }

  function isWithinConfiguredNationalScope(row, brand) {
    const areaCodes = window.RetailNationalScope?.getBrandAreaCodes(brand);
    if (!areaCodes) return true;
    const excludedAreaNames = window.RetailNationalScope.CONFIG.filters.excludedAreaNames || [];
    return !excludedAreaNames.includes(clean(row["大区简称"])) && areaCodes.includes(clean(row["大区代码"]));
  }

  async function cachedRows(key, filters) {
    if (!cache.has(key)) cache.set(key, previewRows(filters));
    return cache.get(key);
  }

  async function brandPayload() {
    const key = "brands-payload";
    if (!cache.has(key)) cache.set(key, previewPayload([{ field: "开业状态名称", type: "EQ", value: "开业" }]));
    return cache.get(key);
  }

  async function brandRows() { return (await brandPayload()).rows; }

  async function dealerRowsByBrand(brand) {
    const rows = await brandRows();
    return brand && brand !== ALL ? rows.filter((row) => clean(row["品牌名称"]) === brand) : rows;
  }

  function toDealer(row) {
    const code = clean(row["经销商代码"]);
    const name = clean(row["经销商简称"]);
    const parentDealerCode = clean(row["一级经销商代码"]) || clean(row["父级经销商代码"]) || code;
    const parentDealerShortName = clean(row["父经销商简称"]) || clean(row["父级经销商简称"]) || name;
    return {
      code,
      name,
      parentDealerCode,
      parentDealerShortName,
      brandCode: clean(row["品牌代码"]),
      areaCode: clean(row["大区代码"]),
      area: clean(row["大区简称"]),
      districtCode: clean(row["小区代码"]),
      district: clean(row["小区简称"]),
      officialName: clean(row["官网显示名称"])
    };
  }

  function filterValidDealers(rows, params) {
    const brand = brandValue(params);
    const areaCode = params.areaCode || params.regionCode || "";
    const area = params.area || params.region || "";
    return [...new Map(rows
      .filter(isRealOpenPrimaryDealer)
      .filter((row) => isWithinConfiguredNationalScope(row, brand))
      .filter((row) => !areaCode || clean(row["大区代码"]) === areaCode)
      .filter((row) => !area || area === ALL || areaCode || clean(row["大区简称"]) === area)
      .filter((row) => !params.districtCode || clean(row["小区代码"]) === params.districtCode)
      .filter((row) => !params.district || params.district === ALL || params.districtCode || clean(row["小区简称"]) === params.district)
      .filter((row) => !params.dealerCode || clean(row["经销商代码"]) === params.dealerCode)
      .filter((row) => !params.store || params.store === ALL || params.dealerCode || clean(row["经销商简称"]) === params.store)
      .map(toDealer)
      .filter((item) => item.code && item.name)
      .map((item) => [item.code, item])).values()];
  }

  async function loadValidDealerScope(params) {
    const payload = await dealerScopePayload(params);
    const brand = brandValue(params);
    const rows = brand && brand !== ALL ? payload.rows.filter((row) => clean(row["品牌名称"]) === brand) : payload.rows;
    return { dealers: filterValidDealers(rows, params), evidence: payload.evidence };
  }

  async function loadValidDealers(params) { return (await loadValidDealerScope(params)).dealers; }

  async function loadFilterOptions(params) {
    const brand = brandValue(params);
    const [allBrandRows, brandDealerRows] = await Promise.all([
      brandRows(),
      dealerRowsByBrand(brand)
    ]);
    const validBrandRows = allBrandRows.filter(isRealOpenPrimaryDealer)
      .filter((row) => isWithinConfiguredNationalScope(row, clean(row["品牌名称"])));
    const validRows = brandDealerRows.filter(isRealOpenPrimaryDealer)
      .filter((row) => isWithinConfiguredNationalScope(row, brand));
    const brandOptions = uniq(validBrandRows.map((row) => row["品牌名称"]));
    const areaOptions = uniq(validRows.map((row) => row["大区简称"])).filter(isRegionName);
    const defaultArea = params.area && params.area !== ALL && areaOptions.includes(params.area) ? params.area : areaOptions[0] || ALL;
    const districtRows = validRows.filter((row) => defaultArea === ALL || clean(row["大区简称"]) === defaultArea);
    const districtOptions = uniq(districtRows.map((row) => row["小区简称"]));
    const defaultDistrict = params.district && params.district !== ALL && districtOptions.includes(params.district)
      ? params.district
      : districtOptions[0] || ALL;
    const dealerRows = districtRows.filter((row) => defaultDistrict === ALL || clean(row["小区简称"]) === defaultDistrict);
    const dealers = [...new Map(dealerRows.map(toDealer).filter((item) => item.code && item.name).map((item) => [item.code, item])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
    return { brandOptions: brandOptions.length ? brandOptions : ["MG"], areaOptions, districtOptions, dealers, defaultArea, defaultDistrict };
  }

  window.RegionFilterApi = { loadFilterOptions, loadValidDealers, loadValidDealerScope, filterValidDealers, ALL, DEALER_DIM_DS_ID };
})();
