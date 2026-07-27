(function (root) {
  const PRODUCTION_SINGLE_STORE_APP_URL = "https://rdata-pv.rauto.com/open-apps/aca59d2e2e60f4be4b8b93ac/";
  const ENVIRONMENTS = new Set(["development", "test", "production"]);

  function normalizeUrl(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return "";
    try {
      const url = new URL(text);
      return /^https?:$/.test(url.protocol) ? url.toString() : "";
    } catch {
      return "";
    }
  }

  function resolveRuntimeConfig(source) {
    const requestedEnvironment = String(source?.environment || "").trim().toLowerCase();
    const environment = ENVIRONMENTS.has(requestedEnvironment) ? requestedEnvironment : "production";
    const configuredUrls = source?.singleStoreAppUrls && typeof source.singleStoreAppUrls === "object"
      ? source.singleStoreAppUrls
      : {};
    const productionUrl = normalizeUrl(configuredUrls.production) || PRODUCTION_SINGLE_STORE_APP_URL;
    const environmentUrl = normalizeUrl(configuredUrls[environment]);
    return Object.freeze({
      environment,
      singleStoreAppUrls: Object.freeze({
        development: normalizeUrl(configuredUrls.development),
        test: normalizeUrl(configuredUrls.test),
        production: productionUrl
      }),
      singleStoreAppUrl: environmentUrl || productionUrl,
      mg07SmallOrderTargetDsId: typeof source?.mg07SmallOrderTargetDsId === "string" ? source.mg07SmallOrderTargetDsId.trim() : ""
    });
  }

  let config = resolveRuntimeConfig();
  const ready = typeof root.fetch === "function"
    ? root.fetch("./settings.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`运行时配置读取失败：${response.status}`);
        return response.json();
      })
      .then((source) => {
        config = resolveRuntimeConfig(source);
        return config;
      })
      .catch(() => config)
    : Promise.resolve(config);

  root.RetailRuntimeConfig = {
    ready,
    resolveRuntimeConfig,
    getConfig: () => config,
    getSingleStoreAppUrl: () => config.singleStoreAppUrl
  };
})(window);
