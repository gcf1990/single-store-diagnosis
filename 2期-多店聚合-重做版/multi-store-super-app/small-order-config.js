(function (root) {
  const TARGET_DS_ID = "h8ae7b66fd5d141ec95bd246";
  const TARGET_PARENT_DIR_ID = "r0d6927b9b1d640d7ac3eabb";
  const ACTUAL_DS_ID = "k4c14c31c595540a0a771f50";
  const ORGANIZATION_DS_ID = "a310ff90fddff4b6283841c6";
  const PERIOD = Object.freeze({ startDate: "2026-07-29", endDate: "2026-08-22", days: 25 });
  const TARGET_DATASET_NAME = "MG07小订目标_20260727";
  const TARGET_FIELDS = Object.freeze(["区域", "省份", "城市", "MAC", "一级经销商", "经销商简称", "MG07小订目标"]);
  const TARGET_QA = Object.freeze({
    sourceRows: 404,
    columnCount: 8,
    datasetStatus: "FINISHED",
    configuredRows: 403,
    sourceUniqueCodes: 403,
    canonicalUniqueCodes: 403,
    targetTotal: 30001,
    zeroTargetRows: 17,
    areaCount: 7,
    requiredCodes: Object.freeze(["MQ856G", "MQ877K"]),
    validPrimaryHits: 395,
    specialStatusRows: 8,
    specialStatusTarget: 287,
    validPrimaryMissTargetTotal: 287,
    validPrimaryMisses: Object.freeze({ MQ207J: 104, MQ257T: 45, MQ576H: 0, MQ576K: 78, MQ877K: 44, MQ9331: 0, SQ2547: 0, SQ2881: 16 })
  });

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function resolveSmallOrderConfig(source) {
    const targetDsId = text(source?.mg07SmallOrderTargetDsId);
    const ok = targetDsId === TARGET_DS_ID;
    return Object.freeze({
      ok,
      targetDsId,
      expectedTargetDsId: TARGET_DS_ID,
      expectedTargetParentDirId: TARGET_PARENT_DIR_ID,
      actualDsId: ACTUAL_DS_ID,
      organizationDsId: ORGANIZATION_DS_ID,
      period: PERIOD,
      targetDatasetName: TARGET_DATASET_NAME,
      targetFields: TARGET_FIELDS,
      qa: TARGET_QA,
      error: ok ? "" : `缺少运行时配置 mg07SmallOrderTargetDsId=${TARGET_DS_ID}`
    });
  }

  function currentSmallOrderConfig() {
    return resolveSmallOrderConfig(root.RetailRuntimeConfig?.getConfig?.() || {});
  }

  root.SmallOrderConfig = {
    TARGET_DS_ID,
    TARGET_PARENT_DIR_ID,
    ACTUAL_DS_ID,
    ORGANIZATION_DS_ID,
    PERIOD,
    TARGET_DATASET_NAME,
    TARGET_FIELDS,
    TARGET_QA,
    resolveSmallOrderConfig,
    currentSmallOrderConfig
  };
})(typeof window !== "undefined" ? window : globalThis);
