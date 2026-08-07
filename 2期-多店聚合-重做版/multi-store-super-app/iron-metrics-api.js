(function (root) {
  const { DS, SOURCE_STATUS } = root.IronMetricsContract;
  const SQL_LIMIT = 5000;
  const SQL_DEALER_BATCH_SIZE = 500;
  const SOURCE_TIMEOUT_MS = 45000;
  const CHANNELS = ["媒介投放", "官网及电商", "经销商新媒体", "网销平台", "官方新媒体"];
  const SALES_VEHICLE_SERIES = ["MG5", "全新MG4", "MG7", "其他车系", "未知车系", "MG ES5", "MG 4X", "Cyberster", "MG 07"];
  const SOURCE_VEHICLE_SERIES = {
    inviteMention: {
      field: "周期首次意向闭环车系名称",
      values: { MG5: ["MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["Cyberster"], "MG 07": ["MG 07"] },
      other: { mode: "exact", values: ["其他车系"] }
    },
    intentLevel: {
      field: "周期最近意向闭环车系",
      values: { MG5: ["MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["Cyberster"], "MG 07": ["MG 07"] },
      other: { mode: "exact", values: ["其他车系"] }
    },
    // `MG试驾看板数据-3试驾点` is an audited MG-only dataset boundary; it has no brand column to add an extra MG predicate.
    qualityTrial: {
      field: "车系",
      values: { MG5: ["MG5", "新一代MG5", "2023款MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["Cyberster", "MG Cyberster"], "MG 07": ["MG 07", "MG07 EV", "MG07 DMH"] },
      other: { mode: "exact", values: ["其他车系"], mgScopeEvidence: "mg-dedicated-dataset-boundary-no-brand-field" }
    },
    trialRecord: {
      field: "车系名称",
      values: { MG5: ["新一代MG5", "2023款MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["MG Cyberster"], "MG 07": ["MG07 EV"] },
      other: { mode: "complement", brandField: "品牌名称" }
    },
    trialTalk: {
      field: "车系名称",
      values: { MG5: ["MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["MG Cyberster"], "MG 07": ["MG 07"] },
      other: { mode: "complement", brandField: "品牌名称" }
    },
    dcc: {
      field: "CRM闭环车系名称",
      values: { MG5: ["MG5"], "全新MG4": ["全新MG4"], MG7: ["MG7"], "未知车系": ["未知"], "MG ES5": ["MG ES5"], "MG 4X": ["MG 4X"], Cyberster: ["Cyberster"], "MG 07": ["MG 07"] },
      other: { mode: "exact", values: ["其他车系"], brandField: "品牌名称" }
    }
  };
  const SQL_SOURCE_AUDIT = {
    inviteMention: { dateField: "呼叫开始日期", vehicleSeriesField: SOURCE_VEHICLE_SERIES.inviteMention.field },
    intentLevel: { dateField: "呼叫开始时间", vehicleSeriesField: SOURCE_VEHICLE_SERIES.intentLevel.field },
    qualityTrial: { dateField: "日期", vehicleSeriesField: SOURCE_VEHICLE_SERIES.qualityTrial.field },
    trialRecord: { dateField: "试驾接待时间", vehicleSeriesField: SOURCE_VEHICLE_SERIES.trialRecord.field },
    trialTalk: { dateField: "试驾接待时间", vehicleSeriesField: SOURCE_VEHICLE_SERIES.trialTalk.field },
    dcc: { dateField: "下发CRM时间 / 日期-门店看板", vehicleSeriesField: SOURCE_VEHICLE_SERIES.dcc.field, tableName: "双品牌DCC话务指标182" }
  };
  const SQL_DENOMINATOR_FIELD = {
    inviteMention: "invite_trial_mention_denominator",
    intentLevel: "high_intent_low_level_denominator",
    qualityTrial: "常规试驾数",
    trialRecord: "trial_record_denominator",
    trialTalk: "trial_talk_denominator",
    dcc: "first_follow_call_60s_denominator"
  };

  function clean(value) { return String(value ?? "").trim(); }
  function all() { return root.RegionDataApi?.ALL || "全部"; }
  function transport() {
    const api = root.RegionDataApi?.__transport;
    if (!api) throw new Error("打铁指标查询缺少 RegionDataApi transport");
    return api;
  }
  function condition(field, value, type = "EQ") { return field && value && value !== all() ? [{ field, type, value }] : []; }
  function orgFilters(params, fields) {
    return [
      ...condition(fields.brand, params.brand === all() ? "MG" : params.brand),
      ...condition(fields.area, params.areaCode),
      ...condition(fields.district, params.districtCode),
      ...condition(fields.dealer, params.dealerCode)
    ];
  }
  function dateFilter(field, range) { return { field, type: "BT", value: [range.startDate, range.endDate] }; }
  function textField(name) { return `TRIM(CAST(\`${name}\` AS STRING))`; }
  function sqlValue(value) { return `'${String(value ?? "").replace(/'/g, "''")}'`; }
  function sqlOrgWhere(params, fields, authorizedDealerCodes) {
    const clauses = [];
    if (fields.brand) clauses.push(`\`${fields.brand}\` = ${sqlValue(params.brand === all() ? "MG" : params.brand)}`);
    if (params.areaCode) clauses.push(`\`${fields.area}\` = ${sqlValue(params.areaCode)}`);
    if (params.districtCode) clauses.push(`\`${fields.district}\` = ${sqlValue(params.districtCode)}`);
    if (Array.isArray(authorizedDealerCodes)) {
      clauses.push(authorizedDealerCodes.length ? `\`${fields.dealer}\` IN (${authorizedDealerCodes.map(sqlValue).join(", ")})` : "1 = 0");
    } else if (params.dealerCode) {
      clauses.push(`\`${fields.dealer}\` = ${sqlValue(params.dealerCode)}`);
    }
    return clauses;
  }
  function scopedParam(...values) {
    return values.map(clean).find((value) => value && value !== all()) || "";
  }
  function dccSqlOrgWhere(params) {
    const clauses = [`\`品牌名称\` = ${sqlValue(params.brand === all() ? "MG" : params.brand)}`];
    const areaCode = scopedParam(params.areaCode);
    const districtCode = scopedParam(params.districtCode);
    const dealerCode = scopedParam(params.dealerCode);
    const areaName = areaCode ? "" : scopedParam(params.area);
    const districtName = districtCode ? "" : scopedParam(params.district);
    const dealerName = dealerCode ? "" : scopedParam(params.store, params.dealer, params.dealerShortName);
    if (areaCode) clauses.push(`\`大区代码\` = ${sqlValue(areaCode)}`);
    else if (areaName) clauses.push(`\`大区简称\` = ${sqlValue(areaName)}`);
    if (districtCode) clauses.push(`\`小区代码\` = ${sqlValue(districtCode)}`);
    else if (districtName) clauses.push(`\`小区简称\` = ${sqlValue(districtName)}`);
    if (dealerCode) clauses.push(`\`经销商代码\` = ${sqlValue(dealerCode)}`);
    else if (dealerName) clauses.push(`\`经销商简称\` = ${sqlValue(dealerName)}`);
    return clauses;
  }
  function selectedVehicleSeries(params) {
    const raw = Array.isArray(params.vehicleSeries) ? params.vehicleSeries : params.vehicleSeries == null ? [] : [params.vehicleSeries];
    return [...new Set(raw.map(clean).filter((value) => value && value !== all() && value !== "全部车系"))];
  }
  function sourceMappedValues(audited) {
    return [...new Set(Object.values(audited.values || {}).flat())];
  }
  function sqlVehicleWhere(params, source) {
    const selected = selectedVehicleSeries(params);
    if (!selected.length) return [];
    const audited = SOURCE_VEHICLE_SERIES[source];
    if (!audited || selected.some((value) => !SALES_VEHICLE_SERIES.includes(value) || (value !== "其他车系" && !audited.values[value]))) {
      throw fieldGapError(`打铁车系映射未审计：${selected.join("、")}；来源字段 ${audited?.field || source} 已 fail-closed`);
    }
    const exactValues = [...new Set(selected.flatMap((value) => audited.values[value] || []))];
    const clauses = [];
    if (exactValues.length) clauses.push(`\`${audited.field}\` IN (${exactValues.map(sqlValue).join(", ")})`);
    if (selected.includes("其他车系")) {
      if (audited.other?.mode === "exact") {
        clauses.push(`\`${audited.field}\` IN (${audited.other.values.map(sqlValue).join(", ")})`);
      } else if (audited.other?.mode === "complement") {
        const mappedValues = sourceMappedValues(audited);
        const brandClause = audited.other.brandField ? `\`${audited.other.brandField}\` = 'MG' AND ` : "";
        clauses.push(`(${brandClause}${textField(audited.field)} <> '' AND \`${audited.field}\` NOT IN (${mappedValues.map(sqlValue).join(", ")}))`);
      } else {
        throw fieldGapError(`打铁其他车系补集未审计：来源字段 ${audited.field} 已 fail-closed`);
      }
    }
    if (!clauses.length) throw fieldGapError(`打铁车系映射未生成有效 SQL：${selected.join("、")}；来源字段 ${audited.field} 已 fail-closed`);
    return [`(${clauses.join(" OR ")})`];
  }
  function completeState(name, rows, shards, limit, sourceType, metadata = {}) {
    return { source: name, status: SOURCE_STATUS.success, complete: true, rowCount: rows.length, limit, shards, sourceType, completeEvidence: "authorized-dealer-in-batches", ...metadata };
  }
  function dccCompleteState(rows, limit, metadata = {}) {
    return { source: "dcc", status: SOURCE_STATUS.success, complete: true, rowCount: rows.length, limit, shards: [{ dealerCodes: null, rowCount: rows.length, complete: true, limit }], sourceType: "SQL", completeEvidence: "dcc-scope-sql-aggregate", ...metadata };
  }
  function emptyAuthorizedState(name) {
    return { source: name, status: SOURCE_STATUS.empty, complete: true, rowCount: 0, limit: 0, shards: [], sourceType: "AUTHORIZED_SCOPE", completeEvidence: "empty-valid-dealer-scope" };
  }
  function incompleteSourceState(name, error, metadata = {}) {
    const fieldGapReason = error?.fieldGapReason || "";
    return { source: name, status: SOURCE_STATUS.incomplete, complete: false, rowCount: 0, limit: 0, error: error instanceof Error ? error.message : String(error), ...metadata, ...(fieldGapReason ? { fieldGapReason } : {}) };
  }
  function loadingSourceState(name) {
    return { source: name, status: SOURCE_STATUS.loading, complete: false, rowCount: 0, limit: 0 };
  }
  function rowsKey(name) { return `${name}Rows`; }
  function cloneRaw(raw) {
    return {
      ...raw,
      sourceStates: { ...(raw.sourceStates || {}) },
      inviteMentionRows: [...(raw.inviteMentionRows || [])],
      intentLevelRows: [...(raw.intentLevelRows || [])],
      dccRows: [...(raw.dccRows || [])],
      dccThreeCallRows: [...(raw.dccThreeCallRows || [])],
      qualityTrialRows: [...(raw.qualityTrialRows || [])],
      trialRecordRows: [...(raw.trialRecordRows || [])],
      trialTalkRows: [...(raw.trialTalkRows || [])]
    };
  }
  function notifySource(raw, name, options) {
    if (typeof options?.onSourceSettled !== "function") return;
    options.onSourceSettled(name, cloneRaw(raw));
  }
  function timeoutMs(options) {
    const value = Number(options?.sourceTimeoutMs);
    return Number.isFinite(value) && value > 0 ? value : SOURCE_TIMEOUT_MS;
  }
  function resolveIronRange(params) {
    if (params?.startDate && params?.endDate) {
      return params.startDate <= params.endDate
        ? { startDate: params.startDate, endDate: params.endDate }
        : { startDate: params.endDate, endDate: params.startDate };
    }
    return transport().resolveDateRange ? transport().resolveDateRange(params) : root.RegionDataApi.resolveDateRange(params);
  }
  function abortController() {
    const Controller = root.AbortController || (typeof AbortController !== "undefined" ? AbortController : null);
    return Controller ? new Controller() : null;
  }
  function timeoutError(name, options) {
    return new Error(`打铁来源 ${name} 查询超过 ${timeoutMs(options)}ms，已降级为数据不完整`);
  }
  function withSourceTimeout(name, run, options) {
    return new Promise((resolve, reject) => {
      const controller = abortController();
      const timer = setTimeout(() => {
        const error = timeoutError(name, options);
        if (controller) controller.abort(error);
        reject(error);
      }, timeoutMs(options));
      Promise.resolve()
        .then(() => run({ signal: controller?.signal }))
        .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
  function assignSource(raw, name, payload) {
    raw[rowsKey(name)] = payload.rows || [];
    if (name === "dcc") raw.dccThreeCallRows = payload.threeCallRows || [];
    raw.sourceStates[name] = payload.state;
  }
  function assignSourceError(raw, name, error) {
    raw[rowsKey(name)] = [];
    if (name === "dcc") raw.dccThreeCallRows = [];
    raw.sourceStates[name] = incompleteSourceState(name, error);
  }
  function hasExplicitEmptyScope(validDealers) {
    return Array.isArray(validDealers) && validDealers.length === 0;
  }
  function authorizedDealerCodes(params, validDealers) {
    const codes = [...new Set((Array.isArray(validDealers) ? validDealers : []).map((dealer) => clean(dealer?.code)).filter(Boolean))];
    const requested = clean(params.dealerCode);
    return requested ? (codes.includes(requested) ? [requested] : []) : codes;
  }
  function dealerCodeBatches(params, validDealers) {
    const codes = authorizedDealerCodes(params, validDealers);
    return Array.from({ length: Math.ceil(codes.length / SQL_DEALER_BATCH_SIZE) }, (_, index) => codes.slice(index * SQL_DEALER_BATCH_SIZE, (index + 1) * SQL_DEALER_BATCH_SIZE));
  }
  function fieldGapError(reason) {
    const error = new Error(reason);
    error.fieldGapReason = reason;
    return error;
  }
  function sqlDealerCode(row) { return clean(row?.dealer_code || row?.["经销商代码"] || row?.["试驾接待经销商代码"]); }
  function isNonZeroDenominator(value) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0;
  }
  function sqlMatchEvidence(name, rows, dealerCodes) {
    const returnedDealerCodes = new Set(rows.map(sqlDealerCode).filter(Boolean));
    const authorizedDealers = new Set(dealerCodes);
    const denominatorField = SQL_DENOMINATOR_FIELD[name];
    return {
      sqlAggregateRowCount: rows.length,
      nonZeroDenominatorRowCount: rows.filter((row) => isNonZeroDenominator(row?.[denominatorField])).length,
      returnedDealerCodeCount: returnedDealerCodes.size,
      validDealerIntersectionCount: [...returnedDealerCodes].filter((code) => authorizedDealers.has(code)).length
    };
  }
  function sourceBrandGuard(name, params) {
    if (name !== "qualityTrial") return;
    const brand = clean(params.brand);
    if (brand !== "MG" && brand !== all()) {
      throw fieldGapError("qualityTrial 来源无品牌字段，仅支持 MG 或全部品牌语义");
    }
  }
  function dccScopeMetadata(rows) {
    const dealerCodes = new Set(rows.map(sqlDealerCode).filter(Boolean));
    return {
      queryMode: "sql_aggregate",
      ...SQL_SOURCE_AUDIT.dcc,
      organizationEvidence: "dcc-own-organization-fields",
      dccScopeEvidence: "official-dcc-business-filters-with-dcc-row-permission",
      authorizedDealerCount: null,
      sqlAggregateRowCount: rows.length,
      returnedDealerCodeCount: dealerCodes.size,
      nonZeroDenominatorRowCount: rows.filter((row) => isNonZeroDenominator(row?.[SQL_DENOMINATOR_FIELD.dcc])).length
    };
  }
  function dccOrganizationGap(rows) {
    if (!rows.length) return "";
    const missing = rows.find((row) => !clean(row?.dealer_code)
      || !clean(row?.area_code)
      || !clean(row?.area_name)
      || !clean(row?.district_code)
      || !clean(row?.district_name));
    return missing ? "DCC SQL 返回行缺少 dealer_code / area_code / area_name / district_code / district_name 组织字段，已 fail-closed" : "";
  }
  async function sqlRowsByDealer(name, dsId, queryFactory, params, range, validDealers, options = {}) {
    const api = transport();
    sourceBrandGuard(name, params);
    const batches = dealerCodeBatches(params, validDealers);
    if (!batches.length) return { rows: [], state: emptyAuthorizedState(name) };
    const results = await Promise.all(batches.map(async (dealerCodes) => ({
      dealerCodes,
      rows: await api.executeSqlRows(dsId, queryFactory(params, range, dealerCodes), SQL_LIMIT, { failOnLimit: true, signal: options.signal })
    })));
    const rows = results.flatMap((result) => result.rows);
    const shards = results.map((result) => ({ dealerCodes: result.dealerCodes, rowCount: result.rows.length, complete: true, limit: SQL_LIMIT }));
    const authorizedDealerCount = batches.reduce((total, batch) => total + batch.length, 0);
    const evidence = sqlMatchEvidence(name, rows, authorizedDealerCodes(params, validDealers));
    const metadata = {
      queryMode: "sql_aggregate",
      ...SQL_SOURCE_AUDIT[name],
      organizationEvidence: "valid-dealer-code-intersection",
      authorizedDealerCount,
      ...evidence
    };
    if (rows.length > 0 && evidence.validDealerIntersectionCount === 0) {
      const error = fieldGapError(`打铁来源 ${name} 返回 ${rows.length} 条 SQL 聚合行，但经销商代码与有效白名单无交集，已降级为数据不完整`);
      return {
        rows,
        state: incompleteSourceState(name, error, {
          rowCount: rows.length,
          limit: SQL_LIMIT,
          shards,
          sourceType: "SQL",
          ...metadata
        })
      };
    }
    return {
      rows,
      state: completeState(name, rows, shards, SQL_LIMIT, "SQL", {
        ...metadata
      })
    };
  }
  async function sqlRowsForDcc(dsId, params, range, options = {}) {
    const api = transport();
    const rows = await api.executeSqlRows(dsId, dccSql(params, range), SQL_LIMIT, { failOnLimit: true, signal: options.signal });
    const organizationGap = dccOrganizationGap(rows);
    if (organizationGap) {
      return {
        rows,
        state: incompleteSourceState("dcc", fieldGapError(organizationGap), {
          rowCount: rows.length,
          limit: SQL_LIMIT,
          shards: [{ dealerCodes: null, rowCount: rows.length, complete: false, limit: SQL_LIMIT }],
          sourceType: "SQL",
          ...dccScopeMetadata(rows)
        })
      };
    }
    return {
      rows,
      state: dccCompleteState(rows, SQL_LIMIT, dccScopeMetadata(rows))
    };
  }
  function inviteMentionSql(params, range, authorizedDealerCodes) {
    const where = [
      ...sqlOrgWhere(params, { brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码" }, authorizedDealerCodes),
      `\`呼叫开始日期\` >= ${sqlValue(range.startDate)}`,
      `\`呼叫开始日期\` <= ${sqlValue(range.endDate)}`,
      ...sqlVehicleWhere(params, "inviteMention"),
      `${textField("呼叫编码")} <> ''`,
      `\`AI质检得分\` IS NOT NULL`
    ];
    const record = textField("呼叫编码");
    const inviteHit = `CASE WHEN COALESCE(\`荣威-邀约执行\`, 0) > 0 OR COALESCE(\`MG-邀约进店试驾\`, 0) > 0 THEN ${record} END`;
    const wechatHit = `CASE WHEN COALESCE(\`荣威-加微执行\`, 0) > 0 OR COALESCE(\`MG-加微申请\`, 0) > 0 THEN ${record} END`;
    return `SELECT ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商简称")}) AS dealer_name, COUNT(DISTINCT ${record}) AS invite_trial_mention_denominator, COUNT(DISTINCT ${inviteHit}) AS invite_trial_mention_numerator, COUNT(DISTINCT ${record}) AS wechat_apply_mention_denominator, COUNT(DISTINCT ${wechatHit}) AS wechat_apply_mention_numerator FROM \`[准实时]话务记录明细宽表&ads_sale_mart_ipcall_recd_dtl_wide_comb_wms\` WHERE ${where.join(" AND ")} GROUP BY ${textField("经销商代码")}`;
  }
  function intentLevelSql(params, range, authorizedDealerCodes) {
    const where = [
      ...sqlOrgWhere(params, { brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码" }, authorizedDealerCodes),
      `date(\`呼叫开始时间\`) >= ${sqlValue(range.startDate)}`,
      `date(\`呼叫开始时间\`) <= ${sqlValue(range.endDate)}`,
      ...sqlVehicleWhere(params, "intentLevel"),
      `\`意向等级\` = '高意向'`,
      `\`省份名称\` <> '新疆维吾尔自治区'`
    ];
    return `SELECT ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商简称")}) AS dealer_name, SUM(CASE WHEN ${textField("销售等级")} = '低' THEN 1 ELSE 0 END) AS high_intent_low_level_numerator, COUNT(1) AS high_intent_low_level_denominator FROM \`IP电话意向水平标签拼信息\` WHERE ${where.join(" AND ")} GROUP BY ${textField("经销商代码")}`;
  }
  function qualityTrialSql(params, range, authorizedDealerCodes) {
    const where = [
      ...sqlOrgWhere(params, { area: "大区代码", district: "小区代码", dealer: "经销商代码" }, authorizedDealerCodes),
      `date(\`日期\`) >= ${sqlValue(range.startDate)}`,
      `date(\`日期\`) <= ${sqlValue(range.endDate)}`,
      ...sqlVehicleWhere(params, "qualityTrial"),
      `\`大区\` NOT IN ('', '其它')`
    ];
    return `SELECT ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商")}) AS dealer_name, SUM(COALESCE(\`优质试驾数\`, 0)) AS \`优质试驾数\`, SUM(COALESCE(\`常规试驾数\`, 0)) AS \`常规试驾数\` FROM \`MG试驾看板数据-3试驾点\` WHERE ${where.join(" AND ")} GROUP BY ${textField("经销商代码")}`;
  }
  function trialRecordSql(params, range, authorizedDealerCodes) {
    const where = [
      ...sqlOrgWhere(params, { brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码" }, authorizedDealerCodes),
      `date(\`试驾接待时间\`) >= ${sqlValue(range.startDate)}`,
      `date(\`试驾接待时间\`) <= ${sqlValue(range.endDate)}`,
      ...sqlVehicleWhere(params, "trialRecord"),
      `${textField("试驾接待编码(PK)")} <> ''`
    ];
    const record = textField("试驾接待编码(PK)");
    return `SELECT ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商简称")}) AS dealer_name, COUNT(DISTINCT ${record}) AS trial_record_denominator, COUNT(DISTINCT CASE WHEN ${textField("是否有录音")} = 'Y' THEN ${record} END) AS trial_record_numerator FROM \`[直连][市场营销数据应用集市]全量试驾明细拼接录音画像表&ads_sale_mart_t_trial_splice_record_prt_comb_wms\` WHERE ${where.join(" AND ")} GROUP BY ${textField("经销商代码")}`;
  }
  function trialTalkSql(params, range, authorizedDealerCodes) {
    const where = [
      ...sqlOrgWhere(params, { brand: "品牌名称", area: "大区代码", district: "小区代码", dealer: "经销商代码" }, authorizedDealerCodes),
      `date(\`试驾接待时间\`) >= ${sqlValue(range.startDate)}`,
      `date(\`试驾接待时间\`) <= ${sqlValue(range.endDate)}`,
      ...sqlVehicleWhere(params, "trialTalk"),
      `${textField("试驾清单ID")} <> ''`,
      `${textField("试驾体验点")} IN ('手机互联','全场景自动泊车-离车泊入')`
    ];
    const record = textField("试驾清单ID");
    return `SELECT ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商简称")}) AS dealer_name, ${textField("试驾体验点")} AS \`试驾体验点\`, COUNT(DISTINCT ${record}) AS trial_talk_denominator, COUNT(DISTINCT CASE WHEN ${textField("是否提及")} = '是' THEN ${record} END) AS trial_talk_numerator FROM \`[直连][市场营销数据应用集市]试驾场景顾问话术质检&ads_sale_mart_t_trial_cons_talk_qi_comb_wms\` WHERE ${where.join(" AND ")} GROUP BY ${textField("经销商代码")}, ${textField("试驾体验点")}`;
  }
  function dccSql(params, range) {
    const crmRange = `date(\`下发CRM时间\`) >= ${sqlValue(range.startDate)} AND date(\`下发CRM时间\`) <= ${sqlValue(range.endDate)}`;
    const threeCallRange = `\`日期-门店看板\` >= ${sqlValue(range.startDate)} AND \`日期-门店看板\` <= ${sqlValue(range.endDate)}`;
    const lead = textField("线索编码");
    const duration = `COALESCE(CAST(NULLIF(${textField("首次通话时长(秒)")}, '') AS DOUBLE), CAST(NULLIF(${textField("首次通话时长")}, '') AS DOUBLE), 0)`;
    const firstFollowBase = `${crmRange} AND ${textField("首次通话时长")} <> '' AND ${textField("是否接通")} = '是'`;
    const followThirtyBase = `${crmRange} AND ${textField("是否工作时段线索（10-18）")} = '工作时段'`;
    const where = [
      ...dccSqlOrgWhere(params),
      `(${crmRange} OR ${threeCallRange})`,
      ...sqlVehicleWhere(params, "dcc"),
      `COALESCE(${textField("大区简称")}, '') NOT IN ('', '其它', 'MG总部')`,
      `${textField("线索渠道大类名称")} IN (${CHANNELS.map(sqlValue).join(", ")})`,
      `COALESCE(${textField("CRM线索状态名称")}, '') NOT IN ('无需处理')`,
      `${textField("开业状态")} = '1'`,
      `COALESCE(${textField("data_type_ch")}, '') NOT IN ('来电咨询')`,
      `${textField("线索免考核")} = '待考核'`,
      `COALESCE(${textField("需跟进")}, '') NOT IN ('无需跟进')`,
      `${lead} <> ''`
    ];
    return `SELECT ${textField("大区代码")} AS area_code, MAX(${textField("大区简称")}) AS area_name, ${textField("小区代码")} AS district_code, MAX(${textField("小区简称")}) AS district_name, ${textField("经销商代码")} AS dealer_code, MAX(${textField("经销商简称")}) AS dealer_name, COUNT(DISTINCT CASE WHEN ${firstFollowBase} THEN ${lead} END) AS first_follow_call_60s_denominator, COUNT(DISTINCT CASE WHEN ${firstFollowBase} AND ${duration} >= 60 THEN ${lead} END) AS first_follow_call_60s_numerator, COUNT(DISTINCT CASE WHEN ${followThirtyBase} THEN ${lead} END) AS follow_30min_denominator, COUNT(DISTINCT CASE WHEN ${followThirtyBase} AND ${textField("工作时段30分钟跟进（10-18）")} = '是' THEN ${lead} END) AS follow_30min_numerator, COUNT(DISTINCT CASE WHEN ${crmRange} THEN ${lead} END) AS follow_24h_denominator, COUNT(DISTINCT CASE WHEN ${crmRange} AND ${textField("是否24小时外呼")} = '是' THEN ${lead} END) AS follow_24h_numerator, COUNT(DISTINCT CASE WHEN ${threeCallRange} THEN ${lead} END) AS two_day_three_call_denominator, COUNT(DISTINCT CASE WHEN ${threeCallRange} AND ${textField("是否完成48小时三呼")} = '是' THEN ${lead} END) AS two_day_three_call_numerator FROM \`双品牌DCC话务指标182\` WHERE ${where.join(" AND ")} GROUP BY ${textField("大区代码")}, ${textField("小区代码")}, ${textField("经销商代码")}`;
  }
  async function loadIronMetricsRaw(params, validDealers = [], options = {}) {
    const range = resolveIronRange(params);
    const nonDccTasks = hasExplicitEmptyScope(validDealers) ? {} : {
      inviteMention: (sourceOptions) => sqlRowsByDealer("inviteMention", DS.inviteMention, inviteMentionSql, params, range, validDealers, sourceOptions),
      intentLevel: (sourceOptions) => sqlRowsByDealer("intentLevel", DS.intentLevel, intentLevelSql, params, range, validDealers, sourceOptions),
      qualityTrial: (sourceOptions) => sqlRowsByDealer("qualityTrial", DS.qualityTrial, qualityTrialSql, params, range, validDealers, sourceOptions),
      trialRecord: (sourceOptions) => sqlRowsByDealer("trialRecord", DS.trialRecord, trialRecordSql, params, range, validDealers, sourceOptions),
      trialTalk: (sourceOptions) => sqlRowsByDealer("trialTalk", DS.trialTalk, trialTalkSql, params, range, validDealers, sourceOptions)
    };
    const tasks = {
      ...nonDccTasks,
      dcc: (sourceOptions) => sqlRowsForDcc(DS.dcc, params, range, sourceOptions)
    };
    const entries = Object.entries(tasks);
    const allSourceNames = ["inviteMention", "intentLevel", "dcc", "qualityTrial", "trialRecord", "trialTalk"];
    const raw = {
      range,
      sourceStates: Object.fromEntries(allSourceNames.map((name) => [name, hasExplicitEmptyScope(validDealers) && name !== "dcc" ? emptyAuthorizedState(name) : loadingSourceState(name)])),
      inviteMentionRows: [],
      intentLevelRows: [],
      dccRows: [],
      dccThreeCallRows: [],
      qualityTrialRows: [],
      trialRecordRows: [],
      trialTalkRows: []
    };
    await Promise.all(entries.map(async ([name, run]) => {
      try {
        assignSource(raw, name, await withSourceTimeout(name, run, options));
      } catch (error) {
        assignSourceError(raw, name, error);
      }
      notifySource(raw, name, options);
    }));
    return raw;
  }
  const api = { loadIronMetricsRaw };
  if (root.__IRON_METRICS_TEST__ === true) {
    api[["__", "test"].join("")] = { dccSql, inviteMentionSql, intentLevelSql, qualityTrialSql, trialRecordSql, trialTalkSql, selectedVehicleSeries, sqlVehicleWhere };
  }
  root.IronMetricsApi = api;
})(window);
