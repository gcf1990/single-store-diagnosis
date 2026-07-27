(function () {
  const ALL = "全部";
  const VEHICLE_ALL = window.RetailVehicleSeries?.ALL || "全部车系";
  const { readRetailParams, pct, deltaPercent, buildSingleStoreLink } = window.RetailUtils;
  const { loadSalesRaw, loadVehicleSeriesOptions, loadMonthlyTargetRaw, loadNegativeProcessStageRaw, loadNegativeProcessKindStageRaw, resolveDateRange, previousMonthRange, previousWeekRange: apiPreviousWeekRange } = window.RegionDataApi;
  const { loadSmallOrderRaw } = window.SmallOrderApi || {};
  const { buildSmallOrderReport } = window.SmallOrderModel || {};
  const { render: renderSmallOrderView } = window.SmallOrderView || {};
  const { loadIronMetricsRaw } = window.IronMetricsApi;
  const { buildStoreFacts, buildIronViewRows, aggregateRows, attachComparisonRecords } = window.IronMetricsModel;
  const { buildWorkbench, buildDynamicStoreDiagnoses, pct: ratio } = window.RegionMetrics;
  const { LEVEL_META, readPersonnelProfile, resolveRole, createViewState, drillDown, drillBack, buildViewRows, evaluateNationalScopeEvidence } = window.OrganizationView;
  const { resolveActualScope } = window.OrganizationScope;
  const PROCESS_STAGE = { idle: 0, current: 1, previous: 2, week: 3, done: 4 };
  const TABLE_PAGE_SIZE = 15;
  const appTestHooks = window.__RETAIL_PC_APP_TEST__ === true ? window.__RETAIL_PC_APP_TEST_HOOKS__ || null : null;

  function previousIronWeekRange(range) {
    if (typeof apiPreviousWeekRange === "function") return apiPreviousWeekRange(range);
    const shift = (value) => {
      const date = new Date(`${value}T00:00:00`);
      date.setDate(date.getDate() - 7);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    return { startDate: shift(range.startDate), endDate: shift(range.endDate) };
  }
  const DATA_STATUS_APP_KEY = "process";
  const SHELL_ORIGIN = "https://rdata-pv.rauto.com";
  const PROCESS_TABLE_METRIC_LABELS = [
    "线索到店率",
    "零钩子率",
    "未锁定时间率",
    "报价承接不足率",
    "竞品比较转化不足率",
    "试驾订单率",
    "版本未推荐率",
    "顾虑跳过率",
    "竞品回避及贬低率"
  ];
  const PROCESS_CSV_METRIC_HEADERS = PROCESS_TABLE_METRIC_LABELS.flatMap((label) => [
    `${label}(%)`,
    `${label}月环比(百分点)`,
    `${label}周环比(百分点)`
  ]);
  const state = {
    params: readRetailParams(ALL),
    organization: null,
    data: null,
    raw: null,
    processBaselineRaw: null,
    processBaselineData: null,
    vehicleSeriesOptions: [],
    validDealers: [],
    loading: false,
    processLoading: false,
    processStage: "idle",
    processError: "",
    processErrors: { ip: { current: "", previous: "", week: "" }, drive: { current: "", previous: "", week: "" } },
    ironRaw: null,
    ironMonthRaw: null,
    ironWeekRaw: null,
    ironStores: [],
    ironSourceStates: {},
    ironLoading: false,
    ironError: "",
    activeMetricGroup: "invite",
    diagnosisStatus: "idle",
    diagnosisByStore: new Map(),
    diagnosisStores: [],
	    selectedStoreCode: "",
	    activeStoreTab: "sales",
	    allDealerMode: false,
	    allDealerSnapshot: null,
	    tablePages: { sales: 0, process: 0, iron: 0 },
    loadToken: 0,
    monthlyTargetGeneration: 0,
    pendingMonthlyTarget: null,
    vehicleSeriesMenuOpen: false,
    smallOrderRaw: null,
    smallOrderReport: { status: "loading" },
    smallOrderViewState: { viewLevel: "area", drillPath: [], expanded: false },
    smallOrderLoadToken: 0,
    dataUpdatedAt: formatDataStatusTimestamp(),
    refreshPromise: null,
    error: ""
  };
  state.organization = createViewState(resolveRole(readPersonnelProfile()), state.params);

  function setTheme() {
    const theme = state.params.previewMode || state.params.theme || "light";
    const embedded = state.params.embeddedMode || state.params.fromApp === "smartRetail-main";
    const root = document.getElementById("captureRoot");
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    if (root) root.dataset.theme = theme;
    [document.documentElement, document.body, root].forEach((element) => {
      if (!element) return;
      if (embedded) {
        element.dataset.embed = "smartRetail-main";
      } else {
        delete element.dataset.embed;
      }
    });
  }

  function empty(text) { return `<div class="empty">${esc(text)}</div>`; }
  function pad(value) { return String(value).padStart(2, "0"); }
  function formatDataStatusTimestamp(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  function reportDataStatus() {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: "retail-sub-app",
      type: "DATA_STATUS",
      appKey: DATA_STATUS_APP_KEY,
      dataUpdatedAt: state.dataUpdatedAt || formatDataStatusTimestamp()
    }, SHELL_ORIGIN);
  }
  function reportRefreshResult(requestId, success, dataUpdatedAt, message) {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: "retail-sub-app",
      type: "REFRESH_RESULT",
      appKey: DATA_STATUS_APP_KEY,
      requestId,
      success,
      ...(success ? { dataUpdatedAt } : { message: message || "数据刷新失败，请稍后重试" })
    }, SHELL_ORIGIN);
  }
  function updateDataUpdatedAt() {
    state.dataUpdatedAt = formatDataStatusTimestamp();
    const refreshNote = document.querySelector(".refresh-note");
    if (refreshNote) refreshNote.textContent = `数据更新于 ${state.dataUpdatedAt}`;
    return state.dataUpdatedAt;
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function fmtInt(value) { return Math.round(value || 0).toLocaleString("zh-CN"); }
  function fmtPct(num, den) { return pct(ratio(num, den)); }

  function formatArrowDelta(value, unit = "%") {
    if (value == null || !Number.isFinite(value)) return "--";
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) return "--";
    const digits = Number.isInteger(Math.abs(rounded)) ? 0 : 1;
    return `${rounded > 0 ? "▲" : "▼"} ${Math.abs(rounded).toFixed(digits)}${unit}`;
  }

  function formatMetricDelta(value, unit = "%") {
    if (value == null || !Number.isFinite(value)) return "--";
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) return "--";
    const digits = Number.isInteger(Math.abs(rounded)) ? 0 : 1;
    return `${rounded > 0 ? "+" : ""}${rounded.toFixed(digits)}${unit}`;
  }

  function fmtRateDelta(current, previous) {
    if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) return "--";
    return formatArrowDelta(current - previous);
  }

  function rateDiff(current, previous) {
    if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) return null;
    return current - previous;
  }

  function compareCount(current, previous) {
    return formatArrowDelta(deltaPercent(current, previous));
  }

	  function renderLoading() {
	    renderFunnelPlaceholder();
	    renderSmallOrderLoading();
	    document.getElementById("diagnosisTableBody").innerHTML = `<tr><td colspan="6">--</td></tr>`;
	    document.getElementById("processListTableBody").innerHTML = `<tr><td colspan="11">--</td></tr>`;
	    renderStorePagination("sales", 0, 0);
	    renderStorePagination("process", 0, 0);
	    syncAllDealerButtons();
	  }

  function renderError(message) {
    const text = `真实数据读取失败：${message}`;
    document.getElementById("funnelGrid").innerHTML = empty(text);
    renderSmallOrderReport({ status: "target_unavailable", error: "主链路读取失败，小订战报暂不可用" });
    document.getElementById("diagnosisTableBody").innerHTML = `<tr><td colspan="6">${esc(text)}</td></tr>`;
    document.getElementById("processListTableBody").innerHTML = `<tr><td colspan="11">${esc(text)}</td></tr>`;
	    renderStorePagination("sales", 0, 0);
	    renderStorePagination("process", 0, 0);
	    syncAllDealerButtons();
	  }

  function renderRoleError() {
    const reason = state.organization?.role?.reason || "人员画像缺失或角色未配置";
    const text = `角色识别异常：${reason}`;
    document.getElementById("funnelGrid").innerHTML = empty(text);
    renderSmallOrderReport({ status: "no_permission", error: text });
    document.getElementById("diagnosisTableBody").innerHTML = `<tr><td colspan="6">${esc(text)}</td></tr>`;
    document.getElementById("processListTableBody").innerHTML = `<tr><td colspan="11">${esc(text)}</td></tr>`;
	    renderStorePagination("sales", 0, 0);
	    renderStorePagination("process", 0, 0);
	    syncAllDealerButtons();
	  }

  function renderPermissionDenied() {
    const text = "无权限：当前账号无可访问的多店数据范围";
    document.getElementById("funnelGrid").innerHTML = empty(text);
    renderSmallOrderReport({ status: "no_permission", error: text });
    document.getElementById("diagnosisTableBody").innerHTML = `<tr><td colspan="6">${esc(text)}</td></tr>`;
    document.getElementById("processListTableBody").innerHTML = `<tr><td colspan="11">${esc(text)}</td></tr>`;
	    renderStorePagination("sales", 0, 0);
	    renderStorePagination("process", 0, 0);
	    syncAllDealerButtons();
	  }

  function renderFunnel() {
    if (appTestHooks?.renderFunnel) appTestHooks.renderFunnel(state);
    const d = state.data;
    if (!d || !d.stores.length) {
      document.getElementById("funnelGrid").innerHTML = empty("当前筛选范围暂无销售指标数据");
      return;
    }
    const c = d.salesCurrent;
    const p = d.salesPrevious;
    const pc = d.salesCurrent;
    const pp = d.salesPrevious;
    const pw = d.salesWeek;
    const cards = [
      card("订单", fmtInt(c.orders), "单", deltaPercent(c.orders, p.orders), deltaPercent(c.orders, d.salesWeek.orders)),
      card("交付率", fmtPct(c.retail, c.orders), "", rateDiff(ratio(c.retail, c.orders), ratio(p.retail, p.orders)), rateDiff(ratio(c.retail, c.orders), ratio(d.salesWeek.retail, d.salesWeek.orders))),
      card("零售", fmtInt(c.retail), "台", deltaPercent(c.retail, p.retail), deltaPercent(c.retail, d.salesWeek.retail))
    ];
    const processCards = [
      card("线索到店率", fmtPct(pc.arrivals, pc.leads), "", rateDiff(ratio(pc.arrivals, pc.leads), ratio(pp.arrivals, pp.leads)), rateDiff(ratio(pc.arrivals, pc.leads), ratio(pw.arrivals, pw.leads))),
      card("到店试驾率", fmtPct(pc.drives, pc.arrivals), "", rateDiff(ratio(pc.drives, pc.arrivals), ratio(pp.drives, pp.arrivals)), rateDiff(ratio(pc.drives, pc.arrivals), ratio(pw.drives, pw.arrivals))),
      card("试驾订单率", fmtPct(pc.orders, pc.drives), "", rateDiff(ratio(pc.orders, pc.drives), ratio(pp.orders, pp.drives)), rateDiff(ratio(pc.orders, pc.drives), ratio(pw.orders, pw.drives))),
      card("线索订单率", fmtPct(pc.orders, pc.leads), "", rateDiff(ratio(pc.orders, pc.leads), ratio(pp.orders, pp.leads)), rateDiff(ratio(pc.orders, pc.leads), ratio(pw.orders, pw.leads)))
    ];
    renderFunnelOverview(cards, processCards, d.monthlyTarget);
  }

  function renderFunnelPlaceholder() {
    const sales = [["订单", "单"], ["交付率", ""], ["零售", "台"]].map(([label, unit]) => card(label, "--", unit, null, null));
    const process = [
      card("线索到店率", "--", "", null, null),
      card("到店试驾率", "--", "", null, null),
      card("试驾订单率", "--", "", null, null),
      card("线索订单率", "--", "", null, null)
    ];
    renderFunnelOverview(sales, process, { status: "loading", order: { status: "loading" }, retail: { status: "loading" } });
  }

  function renderFunnelOverview(salesCards, processCards, monthlyTarget) {
    document.getElementById("funnelGrid").innerHTML = `
      <div class="funnel-overview-header" aria-label="销售总览">
        <div class="funnel-overview-title">
          <h2>销售总览</h2>
          ${targetSummary(monthlyTarget)}
        </div>
        ${renderVehicleSeriesFilter()}
      </div>
      <div class="funnel-overview-panels">
        ${group("销售指标", salesCards, "sales")}
        ${group("过程指标", processCards, "process")}
      </div>
    `;
  }

  function createSmallOrderViewState() {
    return { viewLevel: state.organization?.entryLevel || "area", drillPath: [], expanded: false };
  }

  function renderSmallOrderLoading() {
    state.smallOrderRaw = null;
    state.smallOrderReport = { status: "loading" };
    renderSmallOrderView(document.getElementById("smallOrderRoot"), state.smallOrderReport, state.smallOrderViewState);
  }

  function renderSmallOrderReport(report = null) {
    if (report) {
      state.smallOrderReport = report;
    } else if (state.smallOrderRaw) {
      state.smallOrderReport = buildSmallOrderReport(state.smallOrderRaw, state.smallOrderViewState);
    }
    renderSmallOrderView(document.getElementById("smallOrderRoot"), state.smallOrderReport, state.smallOrderViewState);
  }

  async function loadSmallOrder(token, paramsSnapshot, validDealers) {
    const smallOrderToken = state.smallOrderLoadToken + 1;
    state.smallOrderLoadToken = smallOrderToken;
    renderSmallOrderLoading();
    const raw = await loadSmallOrderRaw(paramsSnapshot, validDealers, { drillPath: state.smallOrderViewState.drillPath, roleResult: state.organization?.role, entryLevel: state.organization?.entryLevel });
    if (token !== state.loadToken || smallOrderToken !== state.smallOrderLoadToken) return;
    state.smallOrderRaw = raw;
    renderSmallOrderReport();
  }

  function bindSmallOrderActions() {
    const root = document.getElementById("smallOrderRoot");
    root?.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-small-order-toggle]");
      if (toggle) {
        state.smallOrderViewState = { ...state.smallOrderViewState, expanded: !state.smallOrderViewState.expanded };
        renderSmallOrderReport();
        return;
      }
      const back = event.target.closest("[data-small-order-back]");
      if (back) {
        const previous = state.smallOrderViewState.drillPath[state.smallOrderViewState.drillPath.length - 1];
        state.smallOrderViewState = {
          ...state.smallOrderViewState,
          viewLevel: previous?.level || state.organization?.entryLevel || "area",
          drillPath: state.smallOrderViewState.drillPath.slice(0, -1)
        };
        renderSmallOrderReport();
        return;
      }
      const drill = event.target.closest("[data-small-order-drill]");
      if (drill && state.smallOrderReport?.viewLevel !== "store") {
        const currentLevel = state.smallOrderReport.viewLevel;
        state.smallOrderViewState = {
          ...state.smallOrderViewState,
          viewLevel: state.smallOrderReport.nextLevel,
          drillPath: [...state.smallOrderViewState.drillPath, { level: currentLevel, code: drill.dataset.smallOrderDrill, name: drill.dataset.smallOrderName }]
        };
        renderSmallOrderReport();
      }
    });
  }

  function group(title, cards, type) {
    return `
      <article class="panel metric-panel ${esc(type)}-panel">
        <div class="panel-head">
          <h3>${esc(title)}</h3>
        </div>
        <div class="body">
          <div class="metric-grid ${esc(type)}">
            ${cards.join("")}
          </div>
        </div>
      </article>
    `;
  }

  function targetSummary(target) {
    if (target?.status === "loading") {
      return `<section class="sales-target-summary loading" role="status" aria-live="polite" aria-label="月目标加载中"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></section>`;
    }
    const order = target?.order || target;
    const retail = target?.retail || {};
    const orderUnavailable = order?.status === "unavailable";
    const retailUnavailable = retail?.status === "unavailable";
    if (target?.status === "unavailable" || (orderUnavailable && retailUnavailable)) {
      return `<section class="sales-target-summary error" aria-label="销售总览目标摘要" aria-live="polite">月目标数据暂不可用</section>`;
    }
    if (orderUnavailable || retailUnavailable || order?.hasTarget || retail?.hasTarget || order?.target > 0 || retail?.target > 0) {
      const orderTargetText = orderUnavailable ? "月目标数据暂不可用" : fmtInt(order.target || 0);
      const orderAchievementText = orderUnavailable ? "月目标数据暂不可用" : order.target > 0 ? formatAchievement(order.achievement) : "";
      const retailTargetText = retailUnavailable ? "月目标数据暂不可用" : fmtInt(retail.target || 0);
      const retailAchievementText = retailUnavailable ? "月目标数据暂不可用" : retail.target > 0 ? formatAchievement(retail.achievement) : "";
      return `
        <section class="sales-target-summary" aria-label="销售总览目标摘要">
          <span class="summary-item"><span class="summary-label">订单目标：</span><b class="target-value">${esc(orderTargetText)}</b></span>
          <span class="summary-item"><span class="summary-label">订单达成：</span><b class="achievement-value">${esc(orderAchievementText)}</b></span>
          <span class="summary-item"><span class="summary-label">零售目标：</span><b class="retail-target-value">${esc(retailTargetText)}</b></span>
          <span class="summary-item"><span class="summary-label">零售达成：</span><b class="retail-achievement-value">${esc(retailAchievementText)}</b></span>
          <span class="summary-item time-progress-item"><span class="summary-label">时间进度：</span><b class="time-progress-value">${esc(formatTimeProgress())}</b></span>
        </section>
      `;
    }
    return "";
  }

  function calculateTimeProgress(today = new Date()) {
    const date = today instanceof Date ? today : new Date(today);
    if (Number.isNaN(date.getTime())) return null;
    const dayOfMonth = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (!daysInMonth) return null;
    return (dayOfMonth / daysInMonth) * 100;
  }

  function formatTimeProgress(today = new Date()) {
    const progress = calculateTimeProgress(today);
    return progress == null ? "--" : `${progress.toFixed(1)}%`;
  }

  function vehicleSeriesOptions() {
    return window.RetailVehicleSeries.sortVehicleSeriesOptions(state.vehicleSeriesOptions || []);
  }
  function selectedVehicleSeries(options = vehicleSeriesOptions()) {
    return window.RetailVehicleSeries.normalizeVehicleSeriesSelection(state.params.vehicleSeries, options);
  }
  function vehicleSeriesSelectionKey(values = state.params.vehicleSeries) {
    return window.RetailVehicleSeries.vehicleSeriesKey(values);
  }

  function renderVehicleSeriesFilter() {
    const options = vehicleSeriesOptions();
    const selected = selectedVehicleSeries(options);
    const selectedSet = new Set(selected);
    const open = state.vehicleSeriesMenuOpen;
    const optionRows = [VEHICLE_ALL, ...options];
    const valueText = window.RetailVehicleSeries.vehicleSeriesSummary(selected);
    return `<div id="vehicleSeriesFilter" class="vehicle-series-filter${open ? " is-open" : ""}" data-open="${open ? "true" : "false"}">
      <button id="vehicleSeriesTrigger" class="vehicle-series-trigger" type="button" aria-label="按车系筛选整个应用数据" aria-haspopup="listbox" aria-expanded="${open ? "true" : "false"}" aria-controls="vehicleSeriesMenu">
        <span class="vehicle-series-label">车系</span><span class="vehicle-series-value">${esc(valueText)}</span><span class="vehicle-series-icon" aria-hidden="true" data-material-symbol="expand_more"></span>
      </button>
      <div id="vehicleSeriesMenu" class="vehicle-series-menu" role="listbox" aria-label="车系" aria-multiselectable="true"${open ? "" : " hidden"}>
        ${optionRows.map((series) => {
          const isSelected = series === VEHICLE_ALL ? selected.length === 0 : selectedSet.has(series);
          return `<button class="vehicle-series-option${isSelected ? " selected is-selected" : ""}" type="button" role="option" aria-selected="${isSelected}" data-vehicle-series="${esc(series)}"><span class="vehicle-series-check" aria-hidden="true">${isSelected ? "✓" : ""}</span><span>${esc(series)}</span></button>`;
        }).join("")}
      </div>
    </div>`;
  }

  function writeVehicleSeriesToUrl(seriesList) {
    const url = new URL(window.location.href);
    ["vehicleSeries", "carSeries", "series"].forEach((key) => url.searchParams.delete(key));
    window.RetailVehicleSeries.normalizeVehicleSeriesSelection(seriesList, vehicleSeriesOptions()).forEach((series) => {
      url.searchParams.append("vehicleSeries", series);
    });
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function closeVehicleSeriesMenu(restoreFocus = false) {
    const filter = document.getElementById("vehicleSeriesFilter");
    const trigger = document.getElementById("vehicleSeriesTrigger");
    const menu = document.getElementById("vehicleSeriesMenu");
    if (!filter || !trigger || !menu) return;
    filter.dataset.open = "false";
    filter.classList.remove("is-open");
    state.vehicleSeriesMenuOpen = false;
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    if (restoreFocus) trigger.focus();
  }

  function openVehicleSeriesMenu() {
    const filter = document.getElementById("vehicleSeriesFilter");
    const trigger = document.getElementById("vehicleSeriesTrigger");
    const menu = document.getElementById("vehicleSeriesMenu");
    if (!filter || !trigger || !menu) return;
    state.vehicleSeriesMenuOpen = true;
    filter.dataset.open = "true";
    filter.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  }

  function setVehicleSeries(series) {
    const options = vehicleSeriesOptions();
    const current = selectedVehicleSeries(options);
    const next = series === VEHICLE_ALL
      ? []
      : current.includes(series)
        ? current.filter((item) => item !== series)
        : [...current, series];
    const normalized = window.RetailVehicleSeries.normalizeVehicleSeriesSelection(next, options);
    if (vehicleSeriesSelectionKey(normalized) === vehicleSeriesSelectionKey(current)) return;
    state.params = { ...state.params, vehicleSeries: [...normalized] };
    state.vehicleSeriesMenuOpen = true;
    writeVehicleSeriesToUrl(next);
    load();
  }

  function bindVehicleSeriesFilter() {
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("#vehicleSeriesFilter")) closeVehicleSeriesMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeVehicleSeriesMenu(true);
    });
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("#vehicleSeriesTrigger");
      if (trigger) {
        const menu = document.getElementById("vehicleSeriesMenu");
        const open = menu?.hidden === false;
        if (open) closeVehicleSeriesMenu();
        else openVehicleSeriesMenu();
        return;
      }
      const option = event.target.closest("[data-vehicle-series]");
      if (option) setVehicleSeries(option.getAttribute("data-vehicle-series"));
    });
  }

  function reconcileVehicleSeriesOptions(options) {
    const normalized = window.RetailVehicleSeries.normalizeVehicleSeriesSelection(state.params.vehicleSeries, options);
    if (vehicleSeriesSelectionKey(normalized) !== vehicleSeriesSelectionKey(state.params.vehicleSeries)) {
      state.params = { ...state.params, vehicleSeries: [...normalized] };
      writeVehicleSeriesToUrl(normalized);
    } else {
      writeVehicleSeriesToUrl(normalized);
    }
  }

  function normalizeVehicleSeriesUrl(params) {
    const search = new URLSearchParams(window.location.search);
    if (search.has("carSeries") || search.has("series") || search.getAll("vehicleSeries").length > 1) writeVehicleSeriesToUrl(params.vehicleSeries || []);
  }

  function syncVehicleSeriesFromHistory() {
    const params = readRetailParams(ALL);
    const previousBrand = String(state.params?.brand || "");
    const nextBrand = String(params.brand || "");
    if (previousBrand !== nextBrand) {
      state.params = { ...state.params, ...params, vehicleSeries: [] };
      state.vehicleSeriesMenuOpen = false;
      state.vehicleSeriesOptions = [];
      writeVehicleSeriesToUrl([]);
      load();
      return;
    }
    const normalized = window.RetailVehicleSeries.normalizeVehicleSeriesSelection(params.vehicleSeries, vehicleSeriesOptions());
    const previousKey = vehicleSeriesSelectionKey(selectedVehicleSeries());
    const nextKey = vehicleSeriesSelectionKey(normalized);
    const search = new URLSearchParams(window.location.search);
    const needsUrlNormalize = search.has("carSeries")
      || search.has("series")
      || search.getAll("vehicleSeries").length > 1
      || nextKey !== vehicleSeriesSelectionKey(params.vehicleSeries);
    state.params = { ...state.params, ...params, vehicleSeries: [...normalized] };
    state.vehicleSeriesMenuOpen = false;
    if (needsUrlNormalize) writeVehicleSeriesToUrl(normalized);
    if (previousKey !== nextKey) load();
  }

  function bindHistoryNavigation() {
    window.addEventListener("popstate", syncVehicleSeriesFromHistory);
  }

  function card(label, value, unit, monthDelta, weekDelta) {
    const display = splitMetricValue(value, unit);
    const monthText = formatMetricDelta(monthDelta);
    const weekText = formatMetricDelta(weekDelta);
    return `
      <article class="funnel-kpi-card">
        <div class="funnel-kpi-top">
          <span class="funnel-kpi-label">${esc(label)}</span>
          <span class="funnel-kpi-icon">${esc(metricIcon(label))}</span>
        </div>
        <div class="funnel-kpi-value">
          <b>${esc(display.value)}</b>${display.unit ? `<small>${esc(display.unit)}</small>` : ""}
        </div>
        <div class="funnel-kpi-meta">
          <span class="${metricDeltaTone(monthDelta)}"><span class="delta-label">月环比</span><span class="delta-value">${esc(monthText)}</span></span>
          <span class="${metricDeltaTone(weekDelta)}"><span class="delta-label">周环比</span><span class="delta-value">${esc(weekText)}</span></span>
        </div>
      </article>
    `;
  }

  function formatAchievement(value) {
    if (value == null || !Number.isFinite(value)) return "";
    return `${value.toFixed(1)}%`;
  }

  function splitMetricValue(value, unit) {
    const text = String(value ?? "--");
    if (text === "--") return { value: text, unit: "" };
    if (unit) return { value: text, unit };
    if (/^-?\d+(?:\.\d+)?%$/.test(text)) return { value: text.slice(0, -1), unit: "%" };
    return { value: text, unit: "" };
  }

  function metricIcon(label) {
    return label.includes("率") || label.includes("占比") ? "%" : "↗";
  }

  function metricDeltaTone(value) {
    if (value == null || !Number.isFinite(value) || Math.round(value * 10) / 10 === 0) return "neutral";
    return value > 0 ? "up" : "down";
  }

	  function renderDiagnosisList() {
	    const rows = buildDiagnosisRows();
	    const body = document.getElementById("diagnosisTableBody");
	    syncOrganizationChrome();
	    if (!rows.length) {
	      body.innerHTML = `<tr><td colspan="6">当前有效范围暂无${esc(LEVEL_META[effectiveViewLevel("sales")]?.title || "组织")}销售表现</td></tr>`;
	      renderStorePagination("sales", 0, 0);
	      return;
	    }
    const pageRows = paginateRows("sales", rows);
    body.innerHTML = pageRows.map((row) => `
      <tr data-organization-row="${esc(row.code)}" data-row-level="${esc(row.level)}" class="${state.selectedStoreCode === row.code ? "linked-store-row" : ""}">
        <td class="sticky-col">${dealerCell(row)}</td>
        <td class="funnel-col">${salesFunnelCell(row)}</td>
        ${orderSummaryCell(row)}
        ${retailSummaryCell(row)}
        <td class="issue-col">${issueSummaryCell(row.issue, row.breakpoint)}</td>
        <td class="sticky-action">
	          <div class="store-row-actions">
	            ${row.level === "store"
	              ? row.targetOnly === true ? "" : `<a class="detail-action store-detail-link" href="${esc(buildSingleStoreLink(state.params, row.store))}" target="_blank" rel="noopener noreferrer" data-store-detail>门店详情</a>`
	              : `<button class="detail-action organization-drill-button" type="button" data-organization-drill>${esc(LEVEL_META[row.level].action)}</button>`}
          </div>
        </td>
      </tr>
    `).join("");
    renderStorePagination("sales", rows.length, pageRows.length);
  }

	  function buildDiagnosisRows() {
	    const month = String(state.raw?.range?.startDate || "").slice(0, 7) || "--";
	    const level = effectiveViewLevel("sales");
	    const nationalComplete = level !== "area" || state.raw?.nationalComplete === true;
	    const rankScope = level === "store" && (allDealerModeActive("sales") || state.organization?.role?.role === "investor") ? "portfolio" : "default";
	    const processRows = buildProcessRows();
	    const processByCode = new Map(processRows.map((row) => [row.code, row]));
	    const peerStores = level === "store" && rankScope !== "portfolio" ? diagnosisUniverseStores() : state.data?.stores || [];
	    return buildViewRows({
      displayStores: state.data?.stores || [],
      peerStores,
      level,
      drillPath: state.organization?.drillPath || [],
      nationalComplete,
      rankScope,
      storeDiagnosis: diagnosisForStore
    }).map((row) => ({
      ...row,
      month,
      store: row.level === "store" ? row : row,
      current: row.current || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      previous: row.previous || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      week: row.week || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processStore: processByCode.get(row.code) || row,
      processCurrent: processByCode.get(row.code)?.current || row.current || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processPrevious: processByCode.get(row.code)?.previous || row.previous || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processWeek: processByCode.get(row.code)?.week || row.week || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 }
    }));
  }

	  function buildProcessRows() {
	    const month = String(state.raw?.range?.startDate || state.processBaselineRaw?.range?.startDate || "").slice(0, 7) || "--";
	    const level = effectiveViewLevel("process");
	    const rankScope = level === "store" && (allDealerModeActive("process") || state.organization?.role?.role === "investor") ? "portfolio" : "default";
	    const baselineStores = (state.data?.stores || []).filter((store) => store.targetOnly !== true);
    return buildViewRows({
      displayStores: baselineStores,
      peerStores: baselineStores,
      level,
      drillPath: state.organization?.drillPath || [],
      nationalComplete: true,
      rankScope,
      storeDiagnosis: diagnosisForStore
    }).map((row) => ({
      ...row,
      month,
      store: row.level === "store" ? row : row,
      current: row.current || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      previous: row.previous || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      week: row.week || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processStore: row,
      processCurrent: row.current || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processPrevious: row.previous || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 },
      processWeek: row.week || { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 }
    }));
  }

  function buildIronRows() {
    const level = effectiveViewLevel("iron");
    const stores = state.ironStores?.length ? state.ironStores : state.processBaselineData?.stores || [];
    return buildIronViewRows({
      displayStores: stores,
      level,
      drillPath: state.organization?.drillPath || []
    }).map((row) => ({ ...row, store: row }));
  }

  function rebuildIronStores() {
    const baselineStores = state.processBaselineData?.stores || [];
    state.ironStores = state.ironRaw ? buildStoreFacts(state.ironRaw, baselineStores) : baselineStores;
  }

  function ironRowsForRaw(raw) {
    const level = effectiveViewLevel("iron");
    const baselineStores = state.processBaselineData?.stores || [];
    const stores = raw ? buildStoreFacts(raw, baselineStores) : baselineStores;
    return buildIronViewRows({
      displayStores: stores,
      level,
      drillPath: state.organization?.drillPath || []
    }).map((row) => ({ ...row, store: row }));
  }

  function loadingIronSourceStates() {
    return Object.fromEntries(Object.keys(window.IronMetricsContract.SOURCE_NAMES).map((key) => [key, { status: "loading", complete: false }]));
  }

  function diagnosisUniverseStores() {
    return (state.diagnosisStores?.length ? state.diagnosisStores : state.data?.stores || []).filter((store) => store.targetOnly !== true);
  }

  function diagnosisForStore(store) {
    if (state.diagnosisStatus === "generating") {
      return { issueName: "诊断生成中", resultBreakpoint: "正在基于当前日期范围计算指标分位" };
    }
    if (state.diagnosisStatus === "failed") {
      return { issueName: "诊断生成失败", resultBreakpoint: "基础销售数据已加载，诊断暂不可用" };
    }
    return state.diagnosisByStore.get(store.code) || { issueName: "未发现显著异常", resultBreakpoint: "未命中小区低分位阈值；断点：未发现显著异常" };
  }

	  function bindDiagnosisActions() {
	    const body = document.getElementById("diagnosisTableBody");
	    body.addEventListener("click", (event) => {
      const element = event.target.closest("[data-organization-row]");
      if (!element || event.target.closest("a")) return;
      const row = buildDiagnosisRows().find((item) => item.code === element.getAttribute("data-organization-row"));
      if (!row) return;
      if (row.level !== "store") {
        if (allDealerModeActive("sales")) return;
        state.organization = drillDown(state.organization, row);
        state.selectedStoreCode = "";
        state.tablePages = { sales: 0, process: 0, iron: 0 };
        renderOrganizationTables();
        return;
      }
      state.selectedStoreCode = row.code || "";
      setPagesForSelectedStore();
      renderOrganizationTables();
      if (state.activeStoreTab === "process") scrollSelectedProcessRow();
    });
  }

  function bindProcessListActions() {
    const body = document.getElementById("processListTableBody");
    body?.addEventListener("click", (event) => {
      const element = event.target.closest("[data-organization-row]");
      if (!element || event.target.closest("a")) return;
      const row = buildProcessRows().find((item) => item.code === element.getAttribute("data-organization-row"));
      if (!row) return;
      if (row.level !== "store") {
        if (allDealerModeActive("process")) return;
        state.organization = drillDown(state.organization, row);
        state.selectedStoreCode = "";
        state.tablePages = { sales: 0, process: 0, iron: 0 };
        renderOrganizationTables();
        return;
      }
      state.selectedStoreCode = row.code || "";
      setPagesForSelectedStore();
      renderOrganizationTables();
      scrollSelectedProcessRow();
    });
  }

  function renderProcessComparisonList() {
    const rows = buildProcessRows();
	    const body = document.getElementById("processListTableBody");
	    if (!body) return;
	    syncOrganizationChrome();
    const notice = document.getElementById("vehicleSeriesProcessNotice");
    if (notice) notice.hidden = true;
	    if (!rows.length) {
	      body.innerHTML = `<tr><td colspan="11">当前有效范围暂无${esc(LEVEL_META[effectiveViewLevel("process")]?.title || "组织")}过程指标</td></tr>`;
	      renderStorePagination("process", 0, 0);
	      return;
    }
    const pageRows = paginateRows("process", rows);
    const errorRow = processErrorMessage()
      ? `<tr class="process-error-row"><td colspan="11">${esc(processErrorMessage())}</td></tr>`
      : "";
    body.innerHTML = `${errorRow}${pageRows.map((row) => renderProcessListRow(row)).join("")}`;
    renderStorePagination("process", rows.length, pageRows.length);
    syncProcessView();
  }

  function renderIronMetrics() {
    const rows = buildIronRows();
    const root = document.getElementById("ironMetricsRoot");
    if (!root) return;
    syncIronGroupTabs();
    syncOrganizationChrome();
    if (state.ironLoading && !state.ironRaw) {
      window.IronMetricsView.render(root, {
        rows: paginateRows("iron", rows),
        records: aggregateRows(rows, loadingIronSourceStates()),
        section: state.activeMetricGroup,
        activeGroup: state.activeMetricGroup,
        emptyText: "打铁指标加载中",
        options: ironViewOptions()
      });
      bindTableScrollShadows();
      renderStorePagination("iron", rows.length, Math.min(rows.length, TABLE_PAGE_SIZE));
      return;
    }
    if (!rows.length) {
      window.IronMetricsView.render(root, {
        rows: [],
        records: [],
        section: state.activeMetricGroup,
        activeGroup: state.activeMetricGroup,
        emptyText: `当前有效范围暂无${LEVEL_META[effectiveViewLevel("iron")]?.title || "组织"}打铁指标`,
        options: ironViewOptions()
      });
      bindTableScrollShadows();
      renderStorePagination("iron", 0, 0);
      return;
    }
    const pageRows = paginateRows("iron", rows);
    const monthRows = ironRowsForRaw(state.ironMonthRaw);
    const weekRows = ironRowsForRaw(state.ironWeekRaw);
    const currentRecords = aggregateRows(rows, state.ironSourceStates);
    const monthRecords = aggregateRows(monthRows, state.ironMonthRaw?.sourceStates || loadingIronSourceStates());
    const weekRecords = aggregateRows(weekRows, state.ironWeekRaw?.sourceStates || loadingIronSourceStates());
    const records = attachComparisonRecords(
      currentRecords,
      monthRecords,
      weekRecords,
      state.ironMonthRaw?.sourceStates || loadingIronSourceStates(),
      state.ironWeekRaw?.sourceStates || loadingIronSourceStates()
    );
    window.IronMetricsView.render(root, {
      rows: pageRows,
      records,
      section: state.activeMetricGroup,
      activeGroup: state.activeMetricGroup,
      emptyText: "",
      options: ironViewOptions()
    });
    bindTableScrollShadows();
    renderStorePagination("iron", rows.length, pageRows.length);
  }

  function ironViewOptions() {
    const meta = LEVEL_META[effectiveViewLevel("iron")];
    return {
      firstColumn: meta.firstColumn,
      levelMeta: LEVEL_META,
      params: state.params,
      selectedStoreCode: state.selectedStoreCode,
      buildSingleStoreLink,
      comparisonClass: "show-both"
    };
  }

  function bindIronActions() {
    const groupTabs = document.getElementById("ironMetricGroups");
    groupTabs?.addEventListener("click", (event) => {
      const groupButton = event.target.closest("[data-iron-group]");
      if (groupButton) setIronGroup(groupButton.getAttribute("data-iron-group"));
    });
    groupTabs?.addEventListener("keydown", (event) => {
      if (!event.target.closest("[data-iron-group]") || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      setIronGroup(state.activeMetricGroup === "invite" ? "trial" : "invite", true);
    });
    document.getElementById("ironTabPanel")?.addEventListener("click", (event) => {
      const element = event.target.closest("[data-organization-row]");
      if (!element || event.target.closest("a")) return;
      const row = buildIronRows().find((item) => item.code === element.getAttribute("data-organization-row"));
      if (!row) return;
      if (row.level !== "store") {
        if (allDealerModeActive("iron")) return;
        state.organization = drillDown(state.organization, row);
        state.selectedStoreCode = "";
        state.tablePages = { sales: 0, process: 0, iron: 0 };
        renderOrganizationTables();
        return;
      }
      state.selectedStoreCode = row.code || "";
      setPagesForSelectedStore();
      renderOrganizationTables();
	    });
  }

  function syncIronGroupTabs() {
    const groupTabs = document.getElementById("ironMetricGroups");
    if (groupTabs) groupTabs.hidden = state.activeStoreTab !== "iron";
    const dashboardLinks = document.getElementById("ironDashboardLinks");
    if (dashboardLinks) dashboardLinks.hidden = state.activeStoreTab !== "iron";
    document.querySelectorAll("[data-iron-group]").forEach((button) => {
      const active = button.getAttribute("data-iron-group") === state.activeMetricGroup;
      button.classList.toggle("active", active);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function setIronGroup(group, focus = false) {
    state.activeMetricGroup = group === "trial" ? "trial" : "invite";
    renderIronMetrics();
    if (focus) document.querySelector(`[data-iron-group="${state.activeMetricGroup}"]`)?.focus();
  }

  function renderProcessListRow(row) {
    const metrics = processMetricMap(row);
    return `
      <tr id="process-row-${esc(row.code)}" data-organization-row="${esc(row.code)}" data-row-level="${esc(row.level)}" class="${state.selectedStoreCode === row.code ? "linked-store-row" : ""}">
        <td class="sticky-col"><div class="dealer"><strong title="${esc(row.name)}">${esc(row.name)}</strong></div></td>
        ${processListCell(metrics.get("线索到店率"))}
        ${processListCell(metrics.get("零钩子率"))}
        ${processListCell(metrics.get("未锁定时间率"))}
        ${processListCell(metrics.get("报价承接不足率"))}
        ${processListCell(metrics.get("竞品比较转化不足率"))}
        ${processListCell(metrics.get("试驾订单率"), "group-divider-start")}
        ${processListCell(metrics.get("版本未推荐率"))}
        ${processListCell(metrics.get("顾虑跳过率"))}
        ${processListCell(metrics.get("竞品回避及贬低率"))}
        <td class="sticky-action"><div class="store-row-actions">${row.level === "store"
          ? row.targetOnly === true ? "" : `<a class="detail-action store-detail-link" href="${esc(buildSingleStoreLink(state.params, row.store))}" target="_blank" rel="noopener noreferrer" data-store-detail>门店详情</a>`
          : `<button class="detail-action organization-drill-button" type="button" data-organization-drill>${esc(LEVEL_META[row.level].action)}</button>`}</div></td>
      </tr>
    `;
  }

  function renderOrganizationTables() {
    renderDiagnosisList();
    renderProcessComparisonList();
    renderIronMetrics();
  }

	  function syncOrganizationChrome() {
	    const level = state.organization?.viewLevel || "store";
	    const meta = LEVEL_META[level];
	    [
	      { id: "salesTabPanel", tab: "sales" },
	      { id: "processTabPanel", tab: "process" },
	      { id: "ironTabPanel", tab: "iron" }
	    ].forEach(({ id, tab }) => {
	      const panel = document.getElementById(id);
	      if (panel) panel.dataset.viewLevel = effectiveViewLevel(tab);
	    });
	    const firstSales = document.getElementById("salesFirstColumn");
	    const firstProcess = document.getElementById("processFirstColumn");
	    const firstIron = document.getElementById("ironFirstColumn");
	    [
	      { element: firstSales, tab: "sales" },
	      { element: firstProcess, tab: "process" },
	      { element: firstIron, tab: "iron" }
	    ].forEach(({ element, tab }) => {
	      if (!element) return;
	      const column = LEVEL_META[effectiveViewLevel(tab)]?.firstColumn || meta.firstColumn;
	      element.textContent = column;
	      element.title = column;
	    });
	      const title = document.getElementById("storeTableTitle");
	    if (title) {
	      if (allDealerModeActive("sales") && state.activeStoreTab === "sales") title.textContent = "全部经销商销售表现";
	      else if (allDealerModeActive("process") && state.activeStoreTab === "process") title.textContent = "全部经销商过程表现";
	      else if (allDealerModeActive("iron") && state.activeStoreTab === "iron") title.textContent = "全部经销商打铁表现";
	      else title.textContent = `${meta.title}${state.activeStoreTab === "process" ? "过程" : state.activeStoreTab === "iron" ? "打铁" : "销售"}表现`;
	    }
	    syncAllDealerButtons();
	    const breadcrumb = document.getElementById("organizationBreadcrumb");
    if (!breadcrumb) return;
    const path = state.organization?.drillPath || [];
    const freezeBack = allDealerModeActive(state.activeStoreTab);
	    const actualScope = resolveActualScope({
	      params: state.params,
	      drillPath: path,
	      stores: organizationScopeStores(state.activeStoreTab),
	      fallbackStores: state.validDealers || []
	    });
    breadcrumb.hidden = false;
    breadcrumb.classList.toggle("pc-empty", !actualScope.text && !path.length);
    breadcrumb.innerHTML = `
      ${actualScope.text ? `<span class="organization-pc-scope">${esc(actualScope.text)}</span>` : ""}
      ${path.length && !freezeBack ? `<button type="button" class="organization-back organization-pc-back" data-organization-back aria-label="返回上一级">← 返回上一级</button>` : ""}
      <span class="organization-mobile-legacy">
        <span class="organization-role">${esc(state.organization?.role?.label || "")}</span>
        ${path.length && !freezeBack ? `<button type="button" class="organization-back organization-mobile-back" data-organization-back aria-label="返回上一级">← 返回上一级</button>` : ""}
        <span class="organization-path">${[...path.map((item) => item.name), meta.title].map((item, index) => `${index ? '<span aria-hidden="true">/</span>' : ""}<span>${esc(item)}</span>`).join("")}</span>
      </span>
    `;
  }

  function bindOrganizationBreadcrumb() {
    document.getElementById("organizationBreadcrumb")?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-organization-back]")) return;
      if (allDealerModeActive(state.activeStoreTab)) return;
      state.organization = drillBack(state.organization);
      state.selectedStoreCode = "";
      state.tablePages = { sales: 0, process: 0, iron: 0 };
      renderOrganizationTables();
    });
  }

  function processMetricMap(row) {
    return new Map(processMetricGroups(row).flatMap((group) => group.metrics.map((metric) => [metric.label, metric])));
  }

  function processListCell(metric, className = "") {
    const cls = className ? ` class="${esc(className)}"` : "";
    if (!metric) {
      return `<td${cls}><div class="metric-cell"><div class="metric-value">--</div><div class="metric-trend" data-kind="month"><span class="trend-prefix">月环比</span><span class="trend-change neutral">--</span></div><div class="metric-trend" data-kind="week"><span class="trend-prefix">周环比</span><span class="trend-change neutral">--</span></div></div></td>`;
    }
    if (metric.currentError) {
      return `<td${cls}><div class="metric-cell metric-error" title="${esc(metric.currentError)}"><div class="metric-value">数据不完整</div><div class="metric-trend" data-kind="month"><span class="trend-prefix">月环比</span><span class="trend-change neutral">加载失败</span></div><div class="metric-trend" data-kind="week"><span class="trend-prefix">周环比</span><span class="trend-change neutral">加载失败</span></div></div></td>`;
    }
    const month = trendChange(metric.monthDelta);
    const week = trendChange(metric.weekDelta);
    return `
      <td${cls}>
        <div class="metric-cell">
          <div class="metric-value">${esc(pct(metric.current))}</div>
          <div class="metric-trend" data-kind="month"><span class="trend-prefix">月环比</span><span class="trend-change ${metric.monthError ? "neutral" : month.tone}">${esc(metric.monthError ? "加载失败" : month.text)}</span></div>
          <div class="metric-trend" data-kind="week"><span class="trend-prefix">周环比</span><span class="trend-change ${metric.weekError ? "neutral" : week.tone}">${esc(metric.weekError ? "加载失败" : week.text)}</span></div>
        </div>
      </td>
    `;
  }

  function trendChange(value) {
    if (value == null || !Number.isFinite(value)) return { tone: "neutral", text: "--" };
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) return { tone: "neutral", text: "--" };
    const digits = Number.isInteger(Math.abs(rounded)) ? 0 : 1;
    return {
      tone: rounded > 0 ? "up" : "down",
      text: `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toFixed(digits)}%`
    };
  }

  function scrollSelectedProcessRow() {
    if (!state.selectedStoreCode) return;
    requestAnimationFrame(() => {
      document.querySelector(`#processListTableBody [data-organization-row="${CSS.escape(state.selectedStoreCode)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  }

  function getTotalPages(totalRows) {
    return Math.max(1, Math.ceil(totalRows / TABLE_PAGE_SIZE));
  }

  function clampPage(page, totalPages) {
    return Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  }

  function paginateRows(type, rows) {
    const totalPages = getTotalPages(rows.length);
    const page = clampPage(state.tablePages[type], totalPages);
    state.tablePages[type] = page;
    return rows.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE);
  }

  function pagerItems(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index);
    if (current <= 5) return [0, 1, 2, 3, 4, 5, "next-ellipsis", total - 1];
    if (current >= total - 4) return [0, "prev-ellipsis", total - 6, total - 5, total - 4, total - 3, total - 2, total - 1];
    return [0, "prev-ellipsis", current - 1, current, current + 1, "next-ellipsis", total - 1];
  }

  function renderStorePagination(type, totalRows, pageRowsLength) {
    const footer = document.getElementById(`${type}Pagination`);
    if (!footer) return;
    const info = footer.querySelector("[data-pagination-info]");
    const pager = footer.querySelector("[data-pagination-pager]");
    if (totalRows <= 0) {
      footer.hidden = true;
      if (info) info.textContent = "";
      if (pager) pager.innerHTML = "";
      return;
    }
    const totalPages = getTotalPages(totalRows);
    const current = clampPage(state.tablePages[type], totalPages);
    state.tablePages[type] = current;
    footer.hidden = false;
    if (info) {
      info.textContent = `共 ${fmtInt(totalRows)} 条 · 当前展示 ${fmtInt(pageRowsLength)} 条 · 第 ${current + 1}/${totalPages} 页 · 每页 ${TABLE_PAGE_SIZE} 条`;
    }
    if (!pager) return;
    const paginationLabel = type === "sales" ? "销售表现" : type === "iron" ? "打铁指标" : "过程表现";
    pager.setAttribute("aria-label", `${paginationLabel}分页`);
    const jump = totalPages > 7 ? `
      <span class="pager-jump">
        <span>跳至</span>
        <input type="number" min="1" max="${totalPages}" value="${current + 1}" aria-label="${paginationLabel}跳转页码" />
        <button type="button" class="pager-btn pager-jump-btn" data-page-action="jump">确定</button>
      </span>
    ` : "";
    pager.innerHTML = `
      <button type="button" class="pager-btn pager-prev" data-page-action="prev"${current === 0 ? " disabled" : ""}>上一页</button>
      ${pagerItems(current, totalPages).map((item) => {
        if (typeof item === "string") return `<span class="pager-ellipsis">...</span>`;
        const active = item === current ? " active" : "";
        const currentAttr = item === current ? ' aria-current="page"' : "";
        return `<button type="button" class="page-number${active}" data-page-index="${item}"${currentAttr}>${item + 1}</button>`;
      }).join("")}
      <button type="button" class="pager-btn pager-next" data-page-action="next"${current >= totalPages - 1 ? " disabled" : ""}>下一页</button>
      ${jump}
    `;
    const updatePage = (page) => {
      const nextPage = clampPage(page, totalPages);
      if (nextPage === state.tablePages[type]) return;
      state.tablePages[type] = nextPage;
      renderStoreTable(type);
    };
    pager.querySelectorAll("[data-page-index]").forEach((button) => {
      button.addEventListener("click", () => updatePage(Number(button.getAttribute("data-page-index"))));
    });
    pager.querySelector('[data-page-action="prev"]')?.addEventListener("click", () => updatePage(current - 1));
    pager.querySelector('[data-page-action="next"]')?.addEventListener("click", () => updatePage(current + 1));
    const jumpInput = pager.querySelector(".pager-jump input");
    const jumpButton = pager.querySelector('[data-page-action="jump"]');
    const jumpToInput = () => updatePage(Number(jumpInput?.value || current + 1) - 1);
    jumpButton?.addEventListener("click", jumpToInput);
    jumpInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") jumpToInput();
    });
  }

  function renderStoreTable(type) {
    if (type === "process") renderProcessComparisonList();
    else if (type === "iron") renderIronMetrics();
    else renderDiagnosisList();
  }

  function setPageForSelectedStore(type) {
    if (!state.selectedStoreCode) return;
    const rows = type === "process" ? buildProcessRows() : type === "iron" ? buildIronRows() : buildDiagnosisRows();
    const index = rows.findIndex((row) => row.code === state.selectedStoreCode);
    if (index >= 0) state.tablePages[type] = Math.floor(index / TABLE_PAGE_SIZE);
  }

  function setPagesForSelectedStore() {
    setPageForSelectedStore("sales");
    setPageForSelectedStore("process");
    setPageForSelectedStore("iron");
  }

  function setStoreTab(tab) {
    state.activeStoreTab = tab === "process" || tab === "iron" ? tab : "sales";
    setPageForSelectedStore(state.activeStoreTab);
    document.querySelectorAll("[data-store-tab]").forEach((button) => {
      const active = button.getAttribute("data-store-tab") === state.activeStoreTab;
      button.classList.toggle("active", active);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const salesPanel = document.getElementById("salesTabPanel");
    const processPanel = document.getElementById("processTabPanel");
    const ironPanel = document.getElementById("ironTabPanel");
    const salesTools = document.getElementById("salesHeaderTools");
    const processTools = document.getElementById("processHeaderTools");
    const processMetricToggles = document.getElementById("processMetricToggles");
    const title = document.getElementById("storeTableTitle");
    salesPanel.hidden = state.activeStoreTab !== "sales";
    processPanel.hidden = state.activeStoreTab !== "process";
    ironPanel.hidden = state.activeStoreTab !== "iron";
    salesPanel.classList.toggle("active", state.activeStoreTab === "sales");
	    salesPanel.classList.toggle("is-active", state.activeStoreTab === "sales");
	    processPanel.classList.toggle("active", state.activeStoreTab === "process");
	    processPanel.classList.toggle("is-active", state.activeStoreTab === "process");
	    ironPanel.classList.toggle("active", state.activeStoreTab === "iron");
	    ironPanel.classList.toggle("is-active", state.activeStoreTab === "iron");
	    if (salesTools) {
	      salesTools.classList.toggle("is-visible", state.activeStoreTab === "sales" || state.activeStoreTab === "iron");
	      salesTools.setAttribute("aria-label", state.activeStoreTab === "iron" ? "打铁指标表工具" : "销售表工具");
	    }
	    if (processTools) processTools.classList.toggle("is-visible", state.activeStoreTab === "process");
	    if (processMetricToggles) processMetricToggles.hidden = state.activeStoreTab !== "process";
	    syncIronGroupTabs();
		    if (title) {
		      if (allDealerModeActive("sales") && state.activeStoreTab === "sales") title.textContent = "全部经销商销售表现";
		      else if (allDealerModeActive("process") && state.activeStoreTab === "process") title.textContent = "全部经销商过程表现";
		      else if (allDealerModeActive("iron") && state.activeStoreTab === "iron") title.textContent = "全部经销商打铁表现";
		      else title.textContent = `${LEVEL_META[state.organization?.viewLevel || "store"].title}${state.activeStoreTab === "process" ? "过程" : state.activeStoreTab === "iron" ? "打铁" : "销售"}表现`;
		    }
	    syncAllDealerButtons();
	    syncProcessView();
	    renderStoreTable(state.activeStoreTab);
    if (state.activeStoreTab === "process") scrollSelectedProcessRow();
  }

  function bindStoreTabs() {
    document.querySelectorAll("[data-store-tab]").forEach((button) => {
      button.addEventListener("click", () => setStoreTab(button.getAttribute("data-store-tab")));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll("[data-store-tab]")];
        const index = tabs.indexOf(button);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        const nextTab = tabs[next];
        nextTab.focus();
        setStoreTab(nextTab.getAttribute("data-store-tab"));
      });
    });
  }

  function bindProcessControls() {
    const month = document.getElementById("toggleMonth");
	    const week = document.getElementById("toggleWeek");
	    const salesExportButton = document.getElementById("exportSales");
	    const exportButton = document.getElementById("exportProcess");
	    const salesAllDealers = document.getElementById("toggleAllDealersSales");
	    const processAllDealers = document.getElementById("toggleAllDealersProcess");
	    month?.addEventListener("change", syncProcessView);
	    week?.addEventListener("change", syncProcessView);
	    salesAllDealers?.addEventListener("click", toggleAllDealerMode);
	    processAllDealers?.addEventListener("click", toggleAllDealerMode);
	    salesExportButton?.addEventListener("click", () => state.activeStoreTab === "iron" ? exportIronCsv() : exportSalesCsv());
	    exportButton?.addEventListener("click", exportProcessCsv);
	    syncProcessView();
	    syncAllDealerButtons();
	  }

  function syncProcessView() {
    const table = document.getElementById("processMetricsTable");
    const month = document.getElementById("toggleMonth");
    const week = document.getElementById("toggleWeek");
    if (!table || !month || !week) return;
    if (!month.checked && !week.checked) month.checked = true;
    table.classList.remove("show-both", "show-month-only", "show-week-only");
    table.classList.add(month.checked && week.checked ? "show-both" : month.checked ? "show-month-only" : "show-week-only");
  }

	  function exportSalesCsv() {
	    const meta = LEVEL_META[effectiveViewLevel("sales")];
	    const rows = [[meta.firstColumn, "区域/负责人", "线索", "线索月环比", "到店", "到店月环比", "试驾", "试驾月环比", "订单", "订单月环比", "零售", "零售月环比", "订单排名", "订单占比", "订单月目标", "订单目标口径实际", "订单目标达成率", "订单目标状态", "未配置订单目标实际", "订单目标冲突键数", "零售排名", "零售占比", "零售月目标", "零售目标口径实际", "零售目标达成率", "零售目标状态", "未配置零售目标实际", "零售目标冲突键数", "目标有效门店缺口数", "主问题", "结果断点"]];
    buildDiagnosisRows().forEach((row) => {
      const orderTarget = row.monthlyTarget?.order || row.monthlyTarget;
      const retailTarget = row.monthlyTarget?.retail || {};
      rows.push([
        row.name,
        dealerAreaText(row),
        fmtInt(row.current.leads),
        formatMetricDelta(deltaPercent(row.current.leads, row.previous.leads)),
        fmtInt(row.current.arrivals),
        formatMetricDelta(deltaPercent(row.current.arrivals, row.previous.arrivals)),
        fmtInt(row.current.drives),
        formatMetricDelta(deltaPercent(row.current.drives, row.previous.drives)),
        fmtInt(row.current.orders),
        formatMetricDelta(deltaPercent(row.current.orders, row.previous.orders)),
        fmtInt(row.current.retail),
        formatMetricDelta(deltaPercent(row.current.retail, row.previous.retail)),
        excelTextRank(row.orderRank),
        row.orderShare == null ? "--" : `${Math.round(row.orderShare)}%`,
        exportConfiguredTargetValue(orderTarget, "target"),
        exportConfiguredTargetValue(orderTarget, "actual"),
        canExportConfiguredTarget(orderTarget) && orderTarget?.target > 0 ? formatAchievement(orderTarget.achievement) : "",
        targetStatusText(orderTarget),
        exportAuditTargetValue(orderTarget, "unconfiguredActual"),
        exportAuditTargetValue(orderTarget, "conflictKeys"),
        excelTextRank(row.retailRank),
        row.retailShare == null ? "--" : `${Math.round(row.retailShare)}%`,
        exportConfiguredTargetValue(retailTarget, "target"),
        exportConfiguredTargetValue(retailTarget, "actual"),
        canExportConfiguredTarget(retailTarget) && retailTarget?.target > 0 ? formatAchievement(retailTarget.achievement) : "",
        targetStatusText(retailTarget),
        exportAuditTargetValue(retailTarget, "unconfiguredActual"),
        exportAuditTargetValue(retailTarget, "conflictKeys"),
        fmtInt(row.monthlyTarget?.validDealerMissingRows || orderTarget?.validDealerMissingRows || retailTarget?.validDealerMissingRows || 0),
        row.issue,
        row.breakpoint
      ]);
    });
	    downloadCsv(`${allDealerModeActive("sales") ? "全部经销商" : meta.title}销售表现.csv`, rows);
	  }

	  function exportProcessCsv() {
    const table = document.getElementById("processMetricsTable");
    if (!table) return;
	    const meta = LEVEL_META[effectiveViewLevel("process")];
    const rows = [[meta.firstColumn, ...PROCESS_CSV_METRIC_HEADERS]];
    buildProcessRows().forEach((rowData) => {
      const metricMap = processMetricMap(rowData);
      const row = [rowData.name];
      PROCESS_TABLE_METRIC_LABELS.forEach((label) => {
        const metric = metricMap.get(label);
        row.push(...processCsvMetricValues(metric));
      });
      rows.push(row);
    });
	    downloadCsv(`${allDealerModeActive("process") ? "全部经销商" : meta.title}过程表现.csv`, rows);
	  }

  function processCsvMetricValues(metric) {
    if (!metric || metric.currentError || !Number.isFinite(metric.current)) return ["", "", ""];
    return [
      roundedPercentNumber(metric.current),
      metric.monthError || !Number.isFinite(metric.monthDelta) ? "" : roundedPercentNumber(metric.monthDelta),
      metric.weekError || !Number.isFinite(metric.weekDelta) ? "" : roundedPercentNumber(metric.weekDelta)
    ];
  }

  function roundedPercentNumber(value) {
    return Math.round(value * 10) / 10;
  }

  function excelTextRank(value) {
    const text = value == null ? "--" : String(value);
    return /^\d+\/\d+$/.test(text) ? `\t${text}` : text;
  }

  function exportIronCsv() {
    const rowsInScope = buildIronRows();
    const monthRows = ironRowsForRaw(state.ironMonthRaw);
    const weekRows = ironRowsForRaw(state.ironWeekRaw);
    const records = attachComparisonRecords(
      aggregateRows(rowsInScope, state.ironSourceStates),
      aggregateRows(monthRows, state.ironMonthRaw?.sourceStates || loadingIronSourceStates()),
      aggregateRows(weekRows, state.ironWeekRaw?.sourceStates || loadingIronSourceStates()),
      state.ironMonthRaw?.sourceStates || loadingIronSourceStates(),
      state.ironWeekRaw?.sourceStates || loadingIronSourceStates()
    );
    const rows = window.IronMetricsView.exportCsvRows(records, rowsInScope, state.activeMetricGroup);
    const meta = LEVEL_META[effectiveViewLevel("iron")];
    downloadCsv(`${allDealerModeActive("iron") ? "全部经销商" : meta.title}${window.IronMetricsView.groupLabel(state.activeMetricGroup)}.csv`, rows);
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((cols) => cols.map((value) => csvCell(value)).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    const safe = typeof value === "number" ? text : neutralizeCsvText(text);
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function neutralizeCsvText(text) {
    const source = String(text);
    const trimmed = source.replace(/^[\s\u3000]+/, "");
    if (/^-\d+(?:\.\d+)?%?$/.test(trimmed)) {
      return source;
    }
    return /^[=+\-@\t\r\n＝＋－＠]/u.test(trimmed) ? `'${trimmed}` : source;
  }

  function processMetricGroups(row) {
    const store = row.processStore || row.store || {};
    const current = row.processCurrent || row.current || {};
    const previous = row.processPrevious || row.previous || {};
    const week = row.processWeek || row.week || {};
    return [
      {
        title: "邀约",
        metrics: [
          ratioMetric("线索到店率", current.arrivals, current.leads, previous.arrivals, previous.leads, week.arrivals, week.leads),
          problemMetric("零钩子率", store.ip, store.ipPrev, store.ipWeek, ["零钩子", "邀约零钩子", "到店理由构建"], "ip"),
          problemMetric("未锁定时间率", store.ip, store.ipPrev, store.ipWeek, ["未锁定时间", "未锁定到店时间", "到店时间锁定"], "ip"),
          problemMetric("报价承接不足率", store.ip, store.ipPrev, store.ipWeek, ["报价承接不足", "报价到店承接", "报价承接"], "ip"),
          problemMetric("竞品比较转化不足率", store.ip, store.ipPrev, store.ipWeek, ["竞品比较转化不足", "竞品比较转化", "竞品"], "ip")
        ]
      },
      {
        title: "试驾",
        metrics: [
          ratioMetric("试驾订单率", current.orders, current.drives, previous.orders, previous.drives, week.orders, week.drives),
          problemMetric("版本未推荐率", store.driveTag, store.drivePrev, store.driveWeek, ["版本未推荐", "车型版本未推荐", "版本推荐"], "drive"),
          problemMetric("顾虑跳过率", store.driveTag, store.drivePrev, store.driveWeek, ["顾虑承接", "顾虑跳过", "客户顾虑跳过", "顾虑未处理"], "drive"),
          problemMetric("竞品回避及贬低率", store.driveTag, store.drivePrev, store.driveWeek, ["竞品攻防", "竞品回避及贬低", "竞品回避", "贬低"], "drive")
        ]
      }
    ];
  }

  function ratioMetric(label, currentNum, currentDen, previousNum, previousDen, weekNum, weekDen) {
    const current = ratio(currentNum, currentDen);
    const previous = ratio(previousNum, previousDen);
    const week = ratio(weekNum, weekDen);
    return rateMetric(label, current, previous, week, false);
  }

  function problemMetric(label, currentAgg, previousAgg, weekAgg, aliases, kind = "") {
    const errors = kind ? state.processErrors[kind] || {} : {};
    const current = errors.current ? null : problemRate(currentAgg, aliases);
    const previous = errors.previous ? null : problemRate(previousAgg, aliases);
    const week = errors.week ? null : problemRate(weekAgg, aliases);
    return {
      ...rateMetric(label, current, previous, week, true),
      currentError: errors.current || "",
      monthError: errors.current ? errors.current : errors.previous || "",
      weekError: errors.current ? errors.current : errors.week || ""
    };
  }

  function processErrorMessage() {
    const messages = [];
    const ipText = processKindErrorText("ip");
    const driveText = processKindErrorText("drive");
    if (ipText) messages.push(`邀约四项数据不完整：${ipText}`);
    if (driveText) messages.push(`试驾三项数据不完整：${driveText}`);
    if (!messages.length && state.processError) messages.push(state.processError);
    return messages.length ? `过程标签数据加载失败：${messages.join("；")}。成功类别继续展示，失败类别显示数据不完整，请稍后重试。` : "";
  }

  function processKindErrorText(kind) {
    const errors = state.processErrors[kind] || {};
    return ["current", "previous", "week"].map((stage) => errors[stage]).filter(Boolean).join("；");
  }

  function emptyProcessErrors() {
    return { ip: { current: "", previous: "", week: "" }, drive: { current: "", previous: "", week: "" } };
  }

  function rateMetric(label, current, previous, week, lowerBetter) {
    return { label, current, monthDelta: rateDiff(current, previous), weekDelta: rateDiff(current, week), lowerBetter };
  }

  function problemRate(agg, aliases) {
    const problems = agg?.problems || [];
    const direct = problems.find((item) => matchesProblem(item.name, aliases));
    if (direct && direct.denominator > 0) return ratio(direct.count, direct.denominator);
    if (direct && direct.rate != null) return direct.rate;
    const childParent = problems.find((item) => (item.children || []).some((child) => matchesProblem(child.name, aliases)));
    if (!childParent || !agg?.total) return null;
    const child = (childParent.children || []).find((item) => matchesProblem(item.name, aliases));
    return child ? ratio(child.count, agg.total) : null;
  }

  function matchesProblem(name, aliases) {
    const text = String(name || "");
    return aliases.some((alias) => text.includes(alias));
  }

  function dealerCell(row) {
    const area = dealerAreaText(row);
    return `<div class="dealer"><strong title="${esc(row.name)}">${esc(row.name)}</strong>${area ? `<span title="${esc(area)}">${esc(area)}</span>` : ""}</div>`;
  }

  function dealerAreaText(row) {
    const validStoreCount = row.validStoreCount ?? (row.stores || []).filter((store) => store.targetOnly !== true).length;
    if (row.level === "area") return `${validStoreCount} 家门店`;
    if (row.level === "district") return [row.area, `${validStoreCount} 家门店`].filter(Boolean).join(" / ");
    return [row.store?.area, row.store?.district].filter((item) => item && item !== ALL).join(" / ");
  }

  function salesFunnelCell(row) {
    const steps = [
      funnelStep("线索", row.current.leads, row.previous.leads),
      funnelStep("到店", row.current.arrivals, row.previous.arrivals),
      funnelStep("试驾", row.current.drives, row.previous.drives),
      funnelStep("订单", row.current.orders, row.previous.orders),
      funnelStep("零售", row.current.retail, row.previous.retail)
    ];
    const conversions = salesRowConversionRates(row);
    return `<div class="sales-funnel-stack">
      <div class="funnel-chain">${steps.map((step, index) => `${step}${index < steps.length - 1 ? '<span class="funnel-arrow material-symbol" aria-hidden="true">arrow_forward</span>' : ""}`).join("")}</div>
      <div class="funnel-conversion-row">${conversions.map(conversionRateBlock).join("")}</div>
    </div>`;
  }

  function funnelStep(label, current, previous) {
    const delta = deltaPercent(current, previous);
    const tone = delta == null || !Number.isFinite(delta) || Math.round(delta * 10) / 10 === 0 ? "neutral" : delta > 0 ? "up" : "down";
    return `<div class="funnel-node">
      <div class="funnel-node-content">
        <span class="funnel-node-label" title="${esc(label)}">${esc(label)}</span>
        <strong class="funnel-node-value">${fmtInt(current)}</strong>
        <span class="funnel-node-delta ${tone}">${esc(formatMetricDelta(delta))}</span>
      </div>
    </div>`;
  }

  function salesRowConversionRates(row) {
    const current = row?.current || {};
    const previous = row?.previous || {};
    return [
      conversionMetric("线索到店率", "到店率", current.arrivals, current.leads, previous.arrivals, previous.leads),
      conversionMetric("到店试驾率", "试驾率", current.drives, current.arrivals, previous.drives, previous.arrivals),
      conversionMetric("试驾订单率", "订单率", current.orders, current.drives, previous.orders, previous.drives),
      conversionMetric("交付率", "交付率", current.retail, current.orders, previous.retail, previous.orders)
    ];
  }

  function conversionMetric(label, shortLabel, currentNumerator, currentDenominator, previousNumerator, previousDenominator) {
    const currentRate = ratio(currentNumerator || 0, currentDenominator || 0);
    const previousRate = ratio(previousNumerator || 0, previousDenominator || 0);
    const delta = rateDiff(currentRate, previousRate);
    return {
      label,
      shortLabel,
      currentRate,
      previousRate,
      delta,
      valueText: pct(currentRate),
      deltaText: formatConversionDelta(delta),
      tone: metricDeltaTone(delta)
    };
  }

  function formatConversionDelta(value) {
    if (value == null || !Number.isFinite(value)) return "--";
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toFixed(1)}%`;
  }

  function conversionRateBlock(item) {
    const label = esc(item.label);
    const shortLabel = esc(item.shortLabel);
    const value = esc(item.valueText);
    const delta = esc(item.deltaText);
    const deltaPhrase = item.deltaText === "--"
      ? "不可比较"
      : item.delta > 0
        ? `增加 ${item.deltaText.replace(/^\+/, "")} 个百分点`
        : item.delta < 0
          ? `减少 ${item.deltaText.replace(/^-/, "")} 个百分点`
          : `持平 ${item.deltaText} 个百分点`;
    const ariaLabel = `${item.label} 当前 ${item.valueText}，月环比 ${deltaPhrase}`;
    return `<div class="funnel-conversion-item" role="group" aria-label="${esc(ariaLabel)}" title="${label} 当前 ${value}，月环比 ${delta}"><span class="funnel-conversion-label">${shortLabel}</span><strong class="funnel-conversion-value">${value}</strong></div>`;
  }

  function rankSummaryCell(rank, share, level) {
    const shareText = share == null ? "--" : `${Math.round(share)}%`;
    return `<td class="rank-cell retail-rank-cell"><div class="rank-grid"><span class="rank-empty" aria-hidden="true"></span><span class="rank-empty" aria-hidden="true"></span><span class="rank-combo"><span class="rank-label">排名</span><span class="rank-main">${esc(rank || "--")}</span></span><span class="rank-sub">占比 <span class="rank-sub-value">${esc(shareText)}</span></span></div></td>`;
  }

  function orderSummaryCell(row) {
    const shareText = row.orderShare == null ? "--" : `${Math.round(row.orderShare)}%`;
    return `<td class="rank-cell order-rank-cell"><div class="rank-grid">${targetRankSlots(row.monthlyTarget?.order || row.monthlyTarget)}<span class="rank-combo"><span class="rank-label">排名</span><span class="rank-main">${esc(row.orderRank || "--")}</span></span><span class="rank-sub">占比 <span class="rank-sub-value">${esc(shareText)}</span></span></div></td>`;
  }

  function retailSummaryCell(row) {
    const shareText = row.retailShare == null ? "--" : `${Math.round(row.retailShare)}%`;
    return `<td class="rank-cell retail-rank-cell"><div class="rank-grid">${targetRankSlots(row.monthlyTarget?.retail || {})}<span class="rank-combo"><span class="rank-label">排名</span><span class="rank-main">${esc(row.retailRank || "--")}</span></span><span class="rank-sub">占比 <span class="rank-sub-value">${esc(shareText)}</span></span></div></td>`;
  }

  function targetRankSlots(target) {
    if (target?.status === "loading" || state.data?.monthlyTarget?.status === "loading") return `<span class="rank-target-loading" role="status" aria-label="月目标加载中"><span></span><b></b></span><span class="rank-target-loading" role="status" aria-label="目标达成加载中"><span></span><b></b></span>`;
    if (target?.status === "unavailable") return `<span class="rank-target-error" aria-live="polite">月目标数据暂不可用</span><span class="rank-empty" aria-hidden="true"></span>`;
    if (target?.hasTarget || target?.target > 0) {
      return `<span class="rank-target"><span>月目标</span><b>${esc(fmtInt(target.target))}</b></span><span class="rank-target ${target.achievement >= 100 ? "target-good" : ""}"><span>目标达成</span><b>${esc(target.target > 0 ? formatAchievement(target.achievement) : "")}</b></span>`;
    }
    return `<span class="rank-empty" aria-hidden="true"></span><span class="rank-empty" aria-hidden="true"></span>`;
  }

  function targetStatusText(target) {
    if (target?.status === "loading") return "目标加载中";
    if (target?.status === "unavailable") return "月目标数据暂不可用";
    if (target?.status === "invalid_range") return "invalid_range";
    if (target?.status === "non_mg") return "非 MG 隐藏";
    if (target?.conflictKeys > 0) return "目标冲突";
    if (target?.hasTarget || target?.target > 0) return "已配置";
    return "目标未产出";
  }

  function canExportConfiguredTarget(target) {
    return target?.status !== "unavailable" && target?.conflictKeys <= 0 && target?.hasTarget === true;
  }

  function exportConfiguredTargetValue(target, field) {
    if (!canExportConfiguredTarget(target)) return "";
    return fmtInt(target?.[field] || 0);
  }

  function exportAuditTargetValue(target, field) {
    if (target?.status === "unavailable") return "";
    return fmtInt(target?.[field] || 0);
  }

  function issueSummaryCell(issue, breakpoint) {
    return `<div class="issue-stack" title="${esc(`${issue} / ${breakpoint}`)}">
      <span class="pill amber" title="${esc(issue)}">${esc(issue)}</span>
      <span class="pill gray" title="${esc(breakpoint)}">${esc(breakpoint)}</span>
    </div>`;
  }

	  function dealerScoped(params) {
	    return Boolean(params.dealerCode || (params.store && params.store !== ALL));
	  }

	  function cloneDrillPath(path) {
	    return (path || []).map((item) => ({ ...item }));
	  }

	  function createAllDealerSnapshot() {
	    return {
	      viewLevel: state.organization?.viewLevel || "store",
	      drillPath: cloneDrillPath(state.organization?.drillPath),
	      tablePages: {
	        sales: state.tablePages.sales || 0,
	        process: state.tablePages.process || 0,
	        iron: state.tablePages.iron || 0
	      },
	      activeMetricGroup: state.activeMetricGroup || "invite",
	      selectedStoreCode: state.selectedStoreCode || ""
	    };
	  }

	  function restoreAllDealerSnapshot() {
	    if (!state.allDealerSnapshot || !state.organization) return;
	    state.organization = {
	      ...state.organization,
	      viewLevel: state.allDealerSnapshot.viewLevel,
	      drillPath: cloneDrillPath(state.allDealerSnapshot.drillPath)
	    };
	    state.tablePages.sales = state.allDealerSnapshot.tablePages?.sales || 0;
	    state.tablePages.process = state.allDealerSnapshot.tablePages?.process || 0;
	    state.tablePages.iron = state.allDealerSnapshot.tablePages?.iron || 0;
	    state.activeMetricGroup = state.allDealerSnapshot.activeMetricGroup === "trial" ? "trial" : "invite";
	    state.selectedStoreCode = state.allDealerSnapshot.selectedStoreCode || "";
	  }

	  function isAllDealerTab(tab = state.activeStoreTab) {
	    return tab === "sales" || tab === "process" || tab === "iron";
	  }

	  function allDealerModeActive(tab = state.activeStoreTab) {
	    return state.allDealerMode === true && isAllDealerTab(tab);
	  }

	  function effectiveViewLevel(tab = state.activeStoreTab) {
	    return allDealerModeActive(tab) ? "store" : state.organization?.viewLevel || "store";
	  }

	  function storesInCurrentDrillPath(tab) {
	    const stores = organizationScopeStores(tab);
	    const path = state.organization?.drillPath || [];
	    if (!path.length) return stores;
	    return stores.filter((store) => path.every((item) => {
	      if (item.level === "area") return store.areaCode === item.code;
	      if (item.level === "district") return store.districtCode === item.code;
	      if (item.level === "store") return store.code === item.code;
	      return true;
	    }));
	  }

	  function organizationScopeStores(tab = state.activeStoreTab) {
	    if (tab === "iron") return state.ironStores?.length ? state.ironStores : state.processBaselineData?.stores || [];
	    if (tab === "process") return (state.data?.stores || []).filter((store) => store.targetOnly !== true);
	    return state.data?.stores || [];
	  }

	  function allDealerButtonVisible(tab) {
	    if (state.activeStoreTab !== tab || !isAllDealerTab(tab) || state.loading || state.error || state.organization?.role?.ok !== true) return false;
	    if (state.allDealerMode) return true;
	    if (state.organization?.viewLevel === "store") return false;
	    if (tab === "process" && processErrorMessage()) return false;
	    if (tab === "iron" && ironAllDealerBlocked()) return false;
	    return storesInCurrentDrillPath(tab).filter((store) => store.targetOnly !== true).length > 1;
	  }

	  function ironAllDealerBlocked() {
	    if (state.ironLoading && !state.ironRaw) return true;
	    if (state.ironError) return true;
	    const group = state.activeMetricGroup === "trial" ? "trial" : "invite";
	    const sources = [...new Set(window.IronMetricsContract.metricsFor(group).map((metric) => metric.source).filter(Boolean))];
	    if (!sources.length) return false;
	    return sources.every((source) => {
	      const item = state.ironSourceStates?.[source];
	      return item?.status === "loading" || item?.status === "incomplete" || item?.complete === false;
	    });
	  }

	  function syncAllDealerButtons() {
	    [
	      { id: "toggleAllDealersSales", tab: state.activeStoreTab === "iron" ? "iron" : "sales" },
	      { id: "toggleAllDealersProcess", tab: "process" }
	    ].forEach(({ id, tab }) => {
	      const button = document.getElementById(id);
	      if (!button) return;
	      const visible = allDealerButtonVisible(tab);
	      const active = allDealerModeActive(tab);
	      button.hidden = !visible;
	      button.classList.toggle("is-active", active);
	      button.textContent = active ? "返回分层查看" : "查看所有经销商";
	      button.setAttribute("aria-pressed", String(active));
	      button.setAttribute("aria-label", active ? "返回分层查看" : "查看当前范围全部经销商");
	    });
	  }

	  function toggleAllDealerMode() {
	    if (!allDealerButtonVisible(state.activeStoreTab)) return;
	    if (state.allDealerMode) {
	      restoreAllDealerSnapshot();
	      state.allDealerMode = false;
	      state.allDealerSnapshot = null;
	    } else {
	      state.allDealerSnapshot = createAllDealerSnapshot();
	      state.allDealerMode = true;
	      state.selectedStoreCode = "";
	      state.tablePages.sales = 0;
	      state.tablePages.process = 0;
	      state.tablePages.iron = 0;
	    }
	    renderOrganizationTables();
	  }

	  function diagnosisScopeParams(params, validDealers) {
    if (!dealerScoped(params)) return null;
    const dealer = (validDealers || [])[0];
    const districtCode = dealer?.districtCode || params.districtCode;
    if (!districtCode) return null;
    return {
      ...params,
      districtCode,
      district: dealer?.district || params.district,
      dealerCode: "",
      dealerCompanyCode: "",
      storeCode: "",
      dealerShortName: "",
      dealer: ALL,
      store: ALL
    };
  }

  function mergeDiagnosisStores(universeStores, displayStores) {
    const displayByCode = new Map((displayStores || []).map((store) => [store.code, store]));
    return (universeStores || []).map((store) => displayByCode.has(store.code) ? { ...store, ...displayByCode.get(store.code) } : store);
  }

  async function loadDiagnosisUniverseStores(params, validDealers, displayStores) {
    const scopedParams = diagnosisScopeParams(params, validDealers);
    if (!scopedParams) return displayStores || [];
    try {
      const [diagnosisDealers, diagnosisRaw] = await Promise.all([
        window.RegionFilterApi.loadValidDealers(scopedParams),
        loadSalesRaw(scopedParams, { includeMonthlyTarget: false })
      ]);
      const diagnosisData = buildWorkbench(diagnosisRaw, { validDealers: diagnosisDealers });
      return mergeDiagnosisStores(diagnosisData.stores, displayStores || []);
    } catch (error) {
      console.warn("诊断小区分位补充数据读取失败，降级使用当前展示范围", error);
      return displayStores || [];
    }
  }

  function beginMonthlyTargetLoad(token, paramsSnapshot, rangeSnapshot) {
    const generation = state.monthlyTargetGeneration + 1;
    state.monthlyTargetGeneration = generation;
    if (typeof loadMonthlyTargetRaw !== "function" || loadSalesRaw.supportsMonthlyTargetOptions !== true) {
      return Promise.resolve(null);
    }
    return Promise.resolve(loadMonthlyTargetRaw(paramsSnapshot, rangeSnapshot))
      .then((monthlyTarget) => applyMonthlyTargetResult(token, generation, monthlyTarget))
      .catch((error) => applyMonthlyTargetResult(token, generation, {
        status: "unavailable",
        error: error instanceof Error ? error.message : String(error),
        targets: [],
        targetActuals: [],
        audit: {},
        months: []
      }));
  }

  function applyMonthlyTargetResult(token, generation, monthlyTarget) {
    if (token !== state.loadToken || generation !== state.monthlyTargetGeneration || !monthlyTarget) return;
    if (!state.raw) {
      state.pendingMonthlyTarget = { token, generation, monthlyTarget };
      return;
    }
    state.raw = { ...state.raw, monthlyTarget };
    state.data = buildWorkbench(state.raw, { validDealers: state.validDealers });
    rebuildIronStores();
    renderFunnel();
    renderDiagnosisList();
  }

  function refreshDynamicDiagnoses(token, defer = true) {
    if (!state.data) return;
    state.diagnosisStatus = "generating";
    state.diagnosisByStore = new Map();
    renderDiagnosisList();
    const run = () => {
      if (token !== state.loadToken) return;
      try {
        state.diagnosisStores = mergeDiagnosisStores(diagnosisUniverseStores(), state.data?.stores || []);
        const rows = buildDynamicStoreDiagnoses(state.diagnosisStores, { processReady: !state.processLoading && state.processStage !== "idle" });
        state.diagnosisByStore = new Map(rows.map((row) => [row.code, row]));
        state.diagnosisStatus = "ready";
        renderDiagnosisList();
      } catch (error) {
        console.warn("动态诊断生成失败", error);
        state.diagnosisStatus = "failed";
        renderDiagnosisList();
      }
    };
    if (defer) setTimeout(run, 0);
    else run();
  }

  async function loadDiagnosisUniverseInBackground(token, paramsSnapshot, validDealers, displayStores) {
    const stores = await loadDiagnosisUniverseStores(paramsSnapshot, validDealers, displayStores);
    if (token !== state.loadToken || !state.data) return;
    state.diagnosisStores = stores;
    refreshDynamicDiagnoses(token, false);
  }

  async function load(options = {}) {
    const token = state.loadToken + 1;
    state.loadToken = token;
    state.monthlyTargetGeneration += 1;
    state.pendingMonthlyTarget = null;
    const previousBrand = state.params?.brand;
    state.params = readRetailParams(ALL);
    normalizeVehicleSeriesUrl(state.params);
    if (previousBrand && previousBrand !== state.params.brand) {
      state.params = { ...state.params, vehicleSeries: [] };
      state.vehicleSeriesMenuOpen = false;
      state.vehicleSeriesOptions = [];
      writeVehicleSeriesToUrl([]);
    }
    state.organization = createViewState(resolveRole(readPersonnelProfile()), state.params);
    state.data = null;
    state.raw = null;
    state.processBaselineRaw = null;
    state.processBaselineData = null;
    state.ironRaw = null;
    state.ironMonthRaw = null;
    state.ironWeekRaw = null;
    state.ironStores = [];
    state.ironSourceStates = {};
    state.validDealers = [];
    state.smallOrderRaw = null;
    state.smallOrderReport = { status: "loading" };
    state.smallOrderViewState = createSmallOrderViewState();
    state.smallOrderLoadToken += 1;
    setTheme();
    state.loading = true;
    state.error = "";
    state.processLoading = false;
    state.processStage = "idle";
    state.processError = "";
    state.processErrors = emptyProcessErrors();
    state.ironLoading = false;
    state.ironError = "";
	    state.activeMetricGroup = "invite";
	    state.allDealerMode = false;
	    state.allDealerSnapshot = null;
	    state.diagnosisStatus = "idle";
    state.diagnosisByStore = new Map();
    state.diagnosisStores = [];
    state.selectedStoreCode = "";
    state.tablePages.sales = 0;
    state.tablePages.process = 0;
    state.tablePages.iron = 0;
    const breadcrumb = document.getElementById("organizationBreadcrumb");
    if (breadcrumb) {
      breadcrumb.hidden = true;
      breadcrumb.classList.add("pc-empty");
      breadcrumb.replaceChildren();
    }
    if (!state.organization.role.ok) {
      state.loading = false;
      renderRoleError();
      return state.dataUpdatedAt;
    }
    syncOrganizationChrome();
    renderLoading();
    const range = resolveDateRange(state.params);
    if (window.__retailPcFixture) {
      if (window.__retailPcFixture.loading) {
        return state.dataUpdatedAt;
      }
      if (window.__retailPcFixture.permissionDenied) {
        state.loading = false;
        renderPermissionDenied();
        return state.dataUpdatedAt;
      }
      if (window.__retailPcFixture.error) {
        state.loading = false;
        renderError(window.__retailPcFixture.error);
        return state.dataUpdatedAt;
      }
      if (!window.__retailPcFixture.data) {
        state.loading = false;
        renderError("测试数据缺失");
        return state.dataUpdatedAt;
      }
      state.validDealers = window.__retailPcFixture.validDealers || [];
      const fixtureOptions = window.RetailVehicleSeries.sortVehicleSeriesOptions(
        window.__retailPcFixture.vehicleSeriesOptionsByBrand?.[state.params.brand] || window.__retailPcFixture.vehicleSeriesOptions || []
      );
      state.vehicleSeriesOptions = fixtureOptions;
      reconcileVehicleSeriesOptions(fixtureOptions);
      state.raw = { ...(window.__retailPcFixture.raw || {}), range, previousRange: previousMonthRange(range), vehicleSeriesOptions: fixtureOptions, nationalComplete: window.__retailPcFixture.nationalComplete === true };
      state.processBaselineRaw = { ...(window.__retailPcFixture.raw || {}), range, previousRange: previousMonthRange(range), vehicleSeriesOptions: fixtureOptions, nationalComplete: true };
      const validCodes = new Set(state.validDealers.map((dealer) => dealer.code));
      const selected = selectedVehicleSeries(fixtureOptions);
      const fixtureData = window.__retailPcFixture.vehicleSeriesData?.[vehicleSeriesSelectionKey(selected)]
        || (selected.length === 1 ? window.__retailPcFixture.vehicleSeriesData?.[selected[0]] : null)
        || window.__retailPcFixture.data;
	      state.data = { ...fixtureData, stores: (fixtureData.stores || []).filter((store) => validCodes.has(store.code) || store.targetOnly === true) };
      state.processBaselineData = window.__retailPcFixture.data
        ? { ...window.__retailPcFixture.data, stores: (window.__retailPcFixture.data.stores || []).filter((store) => validCodes.has(store.code)) }
        : state.data;
      state.ironRaw = window.__retailPcFixture.ironRaw || null;
      state.ironMonthRaw = window.__retailPcFixture.ironMonthRaw || null;
      state.ironWeekRaw = window.__retailPcFixture.ironWeekRaw || null;
      rebuildIronStores();
      state.ironSourceStates = window.__retailPcFixture.ironRaw?.sourceStates || window.__retailPcFixture.ironSourceStates || {};
	      state.diagnosisStores = (Array.isArray(window.__retailPcFixture.diagnosisStores) ? window.__retailPcFixture.diagnosisStores : state.data.stores || []).filter((store) => store.targetOnly !== true);
      state.processStage = "week";
      state.processLoading = false;
      state.processErrors = window.__retailPcFixture.processErrors || emptyProcessErrors();
      state.processError = processErrorMessage();
      state.ironLoading = window.__retailPcFixture.asyncIronMetrics === true;
      state.diagnosisStatus = "ready";
      state.diagnosisByStore = new Map(buildDynamicStoreDiagnoses(state.diagnosisStores, { processReady: true }).map((row) => [row.code, row]));
      state.loading = false;
      renderFunnel();
      if (window.__retailPcFixture.smallOrderRaw) {
        state.smallOrderRaw = {
          ...window.__retailPcFixture.smallOrderRaw,
          validDealers: state.validDealers,
          roleResult: state.organization?.role,
          entryLevel: state.organization?.entryLevel,
          params: { ...state.params },
          enforceTargetContract: window.__retailPcFixture.smallOrderRaw.enforceTargetContract === true,
          period: window.SmallOrderModel.periodInfo(window.__retailPcFixture.smallOrderToday || "2026-07-27")
        };
        renderSmallOrderReport();
      } else {
        renderSmallOrderReport({ status: "target_unavailable", error: "小订目标暂不可用" });
      }
      renderOrganizationTables();
      updateDataUpdatedAt();
      if (window.__retailPcFixture.asyncIronMetrics === true) {
        state.ironError = "";
        state.ironSourceStates = loadingIronSourceStates();
        renderIronMetrics();
        loadIronMetrics(token, state.params, state.validDealers);
      }
      return state.dataUpdatedAt;
    }
    try {
      const options = await loadVehicleSeriesOptions(state.params);
      if (token !== state.loadToken) return state.dataUpdatedAt;
      state.vehicleSeriesOptions = window.RetailVehicleSeries.sortVehicleSeriesOptions(options);
      reconcileVehicleSeriesOptions(state.vehicleSeriesOptions);
      const processParams = { ...state.params, vehicleSeries: [] };
      const needsProcessBaseline = selectedVehicleSeries(state.vehicleSeriesOptions).length > 0;
      const monthlyTargetPromise = beginMonthlyTargetLoad(token, { ...state.params, vehicleSeries: [...selectedVehicleSeries()] }, range);
      monthlyTargetPromise.catch(() => undefined);
      const [dealerScope, salesRaw, processBaselineRaw] = await Promise.all([
        window.RegionFilterApi.loadValidDealerScope(state.params),
        loadSalesRaw(state.params, { includeMonthlyTarget: false }),
        needsProcessBaseline ? loadSalesRaw(processParams, { includeMonthlyTarget: false }) : Promise.resolve(null)
      ]);
      if (token !== state.loadToken) return state.dataUpdatedAt;
      const validDealers = dealerScope.dealers;
      state.validDealers = validDealers;
      const nationalScopeRaw = processBaselineRaw || salesRaw;
      const nationalComplete = evaluateNationalScopeEvidence({
        roleResult: state.organization.role,
        params: processParams,
        nationalScopeConfig: window.RetailNationalScope?.CONFIG,
        dealerEvidence: dealerScope.evidence,
        salesEvidence: nationalScopeRaw.scopeEvidence,
        validDealers,
        salesRows: nationalScopeRaw.sales || []
      });
      state.raw = { ...salesRaw, vehicleSeriesOptions: state.vehicleSeriesOptions, range, previousRange: previousMonthRange(range), nationalComplete };
      state.processBaselineRaw = processBaselineRaw
        ? { ...processBaselineRaw, vehicleSeriesOptions: state.vehicleSeriesOptions, range, previousRange: previousMonthRange(range), nationalComplete: true }
        : state.raw;
      state.data = buildWorkbench(state.raw, { validDealers });
      state.processBaselineData = processBaselineRaw ? buildWorkbench(state.processBaselineRaw, { validDealers }) : state.data;
      if (state.pendingMonthlyTarget?.token === token && state.pendingMonthlyTarget.generation === state.monthlyTargetGeneration) {
        const pendingMonthlyTarget = state.pendingMonthlyTarget.monthlyTarget;
        state.pendingMonthlyTarget = null;
        state.raw = { ...state.raw, monthlyTarget: pendingMonthlyTarget };
        state.data = buildWorkbench(state.raw, { validDealers });
      }
      rebuildIronStores();
	      state.diagnosisStores = (state.data.stores || []).filter((store) => store.targetOnly !== true);
      state.loading = false;
      state.processLoading = true;
      state.processStage = "idle";
      state.processError = "";
      state.processErrors = emptyProcessErrors();
      state.ironLoading = true;
      state.ironError = "";
      state.ironSourceStates = loadingIronSourceStates();
      state.diagnosisStatus = "generating";
      state.diagnosisByStore = new Map();
      updateDataUpdatedAt();
      renderFunnel();
      loadSmallOrder(token, { ...state.params }, validDealers).catch((error) => {
        if (token !== state.loadToken) return;
        renderSmallOrderReport({ status: "target_unavailable", error: error instanceof Error ? error.message : String(error) });
      });
      renderDiagnosisList();
      renderProcessComparisonList();
      renderIronMetrics();
      refreshDynamicDiagnoses(token);
	      if (token === state.loadToken) window.trackRetailView?.(state.params, state.data.stores.filter((store) => store.targetOnly !== true), ALL);
      reportDataStatus();
      loadDiagnosisUniverseInBackground(token, { ...state.params, vehicleSeries: [...selectedVehicleSeries()] }, validDealers, state.data.stores);
      loadNegativeProcess(token, salesRaw, validDealers, { ...state.params, vehicleSeries: [...selectedVehicleSeries()] });
      loadIronMetrics(token, state.params, validDealers);
      return state.dataUpdatedAt;
    } catch (error) {
      if (token !== state.loadToken) return state.dataUpdatedAt;
      state.loading = false;
      state.error = error instanceof Error ? error.message : String(error);
      if (/401|403|权限/.test(state.error)) renderPermissionDenied();
      else renderError(state.error);
      if (options.throwOnError) throw error;
      return state.dataUpdatedAt;
    }
  }

  function refreshForShell() {
    if (state.refreshPromise) return state.refreshPromise;
    state.refreshPromise = load({ throwOnError: true }).finally(() => {
      state.refreshPromise = null;
    });
    return state.refreshPromise;
  }

  function bindShellDataStatusProtocol() {
    window.addEventListener("message", (event) => {
      if (event.origin !== SHELL_ORIGIN) return;
      const message = event.data;
      if (message?.source !== "retail-cockpit-shell") return;
      if (message?.appKey !== DATA_STATUS_APP_KEY) return;

      if (message.type === "REQUEST_DATA_STATUS") {
        reportDataStatus();
        return;
      }

      if (message.type === "REFRESH_DATA") {
        refreshForShell()
          .then((dataUpdatedAt) => reportRefreshResult(message.requestId, true, dataUpdatedAt || state.dataUpdatedAt))
          .catch((error) => reportRefreshResult(
            message.requestId,
            false,
            state.dataUpdatedAt,
            error instanceof Error ? error.message : "数据刷新失败，请稍后重试"
          ));
      }
    });
  }

  async function loadNegativeProcess(token, salesRaw, validDealers, paramsSnapshot = { ...state.params, vehicleSeries: [...selectedVehicleSeries()] }) {
    const currentTasks = [
      { kind: "ip", stage: "current" },
      { kind: "drive", stage: "current" }
    ];
    const comparisonTasks = [
      { kind: "ip", stage: "previous" },
      { kind: "drive", stage: "previous" },
      { kind: "ip", stage: "week" },
      { kind: "drive", stage: "week" }
    ];
    const currentResults = await loadProcessWave(currentTasks, paramsSnapshot, salesRaw, validDealers);
    if (token !== state.loadToken) return;
    mergeProcessWaveResults(currentResults);
    rebuildProcessWorkbench(validDealers);
    state.processStage = "current";
    renderProcessComparisonForWave();

    if (token !== state.loadToken) return;
    const comparisonResults = await loadProcessWave(comparisonTasks, paramsSnapshot, salesRaw, validDealers);
    if (token !== state.loadToken) return;
    mergeProcessWaveResults(comparisonResults);
    rebuildProcessWorkbench(validDealers);
    state.processLoading = false;
    state.processStage = "week";
    state.processError = processErrorMessage();
    renderProcessComparisonForWave();
    refreshDynamicDiagnosesForWave(token);
  }

  function loadProcessWave(tasks, paramsSnapshot, salesRaw, validDealers) {
    return Promise.allSettled(tasks.map(async ({ kind, stage }) => {
      try {
        return { kind, stage, raw: await loadProcessKindStage(kind, stage, paramsSnapshot, salesRaw, validDealers) };
      } catch (error) {
        throw { kind, stage, message: error instanceof Error ? error.message : String(error), error, evidence: error?.evidence };
      }
    }));
  }

  function mergeProcessWaveResults(results) {
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        state.raw = { ...(state.raw || state.processBaselineRaw || {}), ...result.value.raw };
        return;
      }
      const reason = result.reason;
      const kind = reason.kind;
      if (!state.processErrors[kind]) state.processErrors[kind] = {};
      state.processErrors[kind][reason.stage] = reason.message;
    });
  }

  function rebuildProcessWorkbench(validDealers) {
    const currentStoreCodes = new Set((state.data?.stores || []).map((store) => store.code).filter(Boolean));
    if (state.raw) {
      const nextData = buildWorkbench(state.raw, { validDealers });
      state.data = currentStoreCodes.size
        ? { ...nextData, stores: nextData.stores.filter((store) => currentStoreCodes.has(store.code)) }
        : nextData;
    }
    if (appTestHooks?.rebuildIronStores) {
      appTestHooks.rebuildIronStores(state);
      return;
    }
    rebuildIronStores();
  }

  function renderProcessComparisonForWave() {
    if (appTestHooks?.renderProcessComparisonList) {
      appTestHooks.renderProcessComparisonList(state);
      return;
    }
    renderProcessComparisonList();
  }

  function refreshDynamicDiagnosesForWave(token) {
    if (appTestHooks?.refreshDynamicDiagnoses) {
      appTestHooks.refreshDynamicDiagnoses(state, token);
      return;
    }
    refreshDynamicDiagnoses(token);
  }

  async function loadIronMetrics(token, paramsSnapshot, validDealers) {
    const currentRange = resolveDateRange(paramsSnapshot);
    const monthRange = previousMonthRange(currentRange);
    const weekRange = previousIronWeekRange(currentRange);
    const rangeParams = (range) => ({ ...paramsSnapshot, startDate: range.startDate, endDate: range.endDate });
    const failedRaw = (range, error) => ({
      range,
      sourceStates: Object.fromEntries(Object.keys(window.IronMetricsContract.SOURCE_NAMES).map((key) => [key, { status: "incomplete", complete: false, error: error instanceof Error ? error.message : String(error) }]))
    });
    const loadComparison = async (period, range) => {
      try {
        const raw = await loadIronMetricsRaw(rangeParams(range), validDealers, {
          sourceTimeoutMs: window.__retailPcFixture?.ironSourceTimeoutMs,
          onSourceSettled: (sourceName, partialRaw) => {
            if (token !== state.loadToken) return;
            if (period === "month") state.ironMonthRaw = partialRaw;
            else state.ironWeekRaw = partialRaw;
            renderIronMetrics();
          }
        });
        if (token !== state.loadToken) return;
        if (period === "month") state.ironMonthRaw = raw;
        else state.ironWeekRaw = raw;
        renderIronMetrics();
      } catch (error) {
        if (token !== state.loadToken) return;
        if (period === "month") state.ironMonthRaw = failedRaw(range, error);
        else state.ironWeekRaw = failedRaw(range, error);
        renderIronMetrics();
      }
    };
    try {
      state.ironRaw = { range: currentRange, sourceStates: loadingIronSourceStates() };
      state.ironMonthRaw = { range: monthRange, sourceStates: loadingIronSourceStates() };
      state.ironWeekRaw = { range: weekRange, sourceStates: loadingIronSourceStates() };
      rebuildIronStores();
      renderIronMetrics();
      const raw = await loadIronMetricsRaw(rangeParams(currentRange), validDealers, {
        sourceTimeoutMs: window.__retailPcFixture?.ironSourceTimeoutMs,
        onSourceSettled: (sourceName, partialRaw) => {
          if (token !== state.loadToken) return;
          state.ironRaw = partialRaw;
          rebuildIronStores();
          state.ironSourceStates = partialRaw.sourceStates || {};
          state.ironError = "";
          renderIronMetrics();
        }
      });
      if (token !== state.loadToken) return;
      state.ironRaw = raw;
      rebuildIronStores();
      state.ironSourceStates = raw.sourceStates || {};
      state.ironError = "";
      state.ironLoading = false;
      renderIronMetrics();
      await Promise.allSettled([
        loadComparison("month", monthRange),
        loadComparison("week", weekRange)
      ]);
    } catch (error) {
      if (token !== state.loadToken) return;
      state.ironError = error instanceof Error ? error.message : String(error);
      state.ironSourceStates = Object.fromEntries(Object.keys(window.IronMetricsContract.SOURCE_NAMES).map((key) => [key, { status: "incomplete", complete: false, error: state.ironError }]));
    } finally {
      if (token !== state.loadToken) return;
      state.ironLoading = false;
      renderIronMetrics();
    }
  }

  async function loadProcessKindStage(kind, stage, params, salesRaw, validDealers) {
    try {
      if (typeof loadNegativeProcessKindStageRaw === "function") {
        return await loadNegativeProcessKindStageRaw(kind, stage, params, salesRaw, validDealers);
      }
      const raw = await loadNegativeProcessStageRaw(stage, params, salesRaw, validDealers);
      return filterLegacyProcessStageRaw(kind, stage, raw);
    } catch (error) {
      const wrapped = new Error(error instanceof Error ? error.message : String(error));
      wrapped.cause = error;
      wrapped.kind = kind;
      if (error && typeof error === "object" && error.evidence) wrapped.evidence = error.evidence;
      throw wrapped;
    }
  }

  function filterLegacyProcessStageRaw(kind, stage, raw) {
    const suffix = stage === "previous" ? "Prev" : stage === "week" ? "Week" : "";
    return kind === "ip"
      ? { [`ipAgg${suffix}`]: raw[`ipAgg${suffix}`], [`ipAggStores${suffix}`]: raw[`ipAggStores${suffix}`], [`ipTags${suffix}`]: raw[`ipTags${suffix}`] }
      : { [`driveTagAgg${suffix}`]: raw[`driveTagAgg${suffix}`], [`driveTagAggStores${suffix}`]: raw[`driveTagAggStores${suffix}`], [`driveTags${suffix}`]: raw[`driveTags${suffix}`] };
  }

  function bindTableScrollShadows() {
    const edgeShadowWidth = 1;
    document.querySelectorAll("#salesTabPanel .table-wrap, #processTabPanel .table-wrap, #ironTabPanel .table-wrap").forEach((wrap) => {
      if (wrap.dataset.scrollShadowsBound === "true") return;
      wrap.dataset.scrollShadowsBound = "true";

      const panel = wrap.closest(".store-tab-panel");
      if (!panel) return;
      panel.style.position = "relative";
      panel.querySelectorAll(":scope > .table-scroll-shadow").forEach((shadow) => shadow.remove());

      const leftShadow = document.createElement("span");
      const rightShadow = document.createElement("span");
      leftShadow.className = "table-scroll-shadow table-scroll-shadow-left";
      rightShadow.className = "table-scroll-shadow table-scroll-shadow-right";
      leftShadow.setAttribute("aria-hidden", "true");
      rightShadow.setAttribute("aria-hidden", "true");
      panel.append(leftShadow, rightShadow);

      const update = () => {
        const maxX = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
        const maxY = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
        const movedX = wrap.scrollLeft > 1;
        const movedY = wrap.scrollTop > 1;
        const wrapRect = wrap.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const firstColumn = wrap.querySelector(".sticky-col");
        const lastColumn = wrap.querySelector(".sticky-action");
        const table = wrap.querySelector("table");
        const tableRect = table?.getBoundingClientRect();

        wrap.classList.toggle("is-scrolled-from-left", movedX);
        wrap.classList.toggle("is-scrolled-from-right", movedX && wrap.scrollLeft < maxX - 1);
        wrap.classList.toggle("is-scrolled-y", movedY);
        wrap.classList.toggle("has-more-below", movedY && wrap.scrollTop < maxY - 1);

        /*
         * Anchor both shadows to the fixed scroll viewport instead of reading the
         * sticky cells' live rectangles. Chromium can report fractional/transient
         * sticky positions while compositing a horizontal scroll, which made the
         * separators drift with the table.
         */
        const leftColumnWidth = firstColumn?.offsetWidth || 0;
        const rightColumnWidth = lastColumn?.offsetWidth || 0;
        const wrapLeft = Math.max(0, wrapRect.left - panelRect.left);
        const wrapRight = Math.max(0, wrapRect.right - panelRect.left);
        const leftEdge = wrapLeft + leftColumnWidth;
        const rightEdge = wrapRight - rightColumnWidth;
        const shadowTop = Math.max(0, wrapRect.top - panelRect.top);
        const shadowHeight = Math.min(tableRect?.height || wrap.clientHeight, wrap.clientHeight);

        leftShadow.classList.toggle("is-visible", movedX);
        rightShadow.classList.toggle("is-visible", movedX && wrap.scrollLeft < maxX - 1);
        leftShadow.style.height = `${shadowHeight}px`;
        rightShadow.style.height = `${shadowHeight}px`;
        leftShadow.style.transform = `translate3d(${Math.max(0, leftEdge - edgeShadowWidth)}px, ${shadowTop}px, 0)`;
        rightShadow.style.transform = `translate3d(${rightEdge}px, ${shadowTop}px, 0)`;
      };

      wrap.addEventListener("scroll", update, { passive: true });
      if (typeof ResizeObserver === "function") new ResizeObserver(update).observe(wrap);
      requestAnimationFrame(update);
    });
  }

  function initializeApp() {
    window.bindRetailCaptureProtocol?.();
    bindShellDataStatusProtocol();
    bindStoreTabs();
    bindProcessControls();
    bindOrganizationBreadcrumb();
    bindDiagnosisActions();
    bindProcessListActions();
    bindIronActions();
    bindSmallOrderActions();
    bindVehicleSeriesFilter();
    bindHistoryNavigation();
    bindTableScrollShadows();
    window.__retailPcApp = {
      reload: () => load(),
      getStateSnapshot: () => ({
        role: state.organization?.role?.role,
        entryLevel: state.organization?.entryLevel,
	        viewLevel: state.organization?.viewLevel,
	        drillPath: (state.organization?.drillPath || []).map((item) => ({ ...item })),
	        activeStoreTab: state.activeStoreTab,
	        allDealerMode: state.allDealerMode,
	        allDealerSnapshot: state.allDealerSnapshot ? {
	          viewLevel: state.allDealerSnapshot.viewLevel,
	          drillPath: cloneDrillPath(state.allDealerSnapshot.drillPath),
	          tablePages: { ...state.allDealerSnapshot.tablePages },
	          activeMetricGroup: state.allDealerSnapshot.activeMetricGroup,
	          selectedStoreCode: state.allDealerSnapshot.selectedStoreCode
	        } : null,
	        tablePages: { ...state.tablePages },
	        selectedStoreCode: state.selectedStoreCode,
	        effectiveSalesLevel: effectiveViewLevel("sales"),
	        effectiveProcessLevel: effectiveViewLevel("process"),
	        effectiveIronLevel: effectiveViewLevel("iron"),
	        activeMetricGroup: state.activeMetricGroup,
	        funnelText: document.getElementById("funnelGrid")?.textContent || "",
	        smallOrderText: document.getElementById("smallOrderRoot")?.textContent || "",
	        smallOrderViewState: {
	          viewLevel: state.smallOrderViewState.viewLevel,
	          drillPath: cloneDrillPath(state.smallOrderViewState.drillPath),
	          expanded: state.smallOrderViewState.expanded
	        },
	        smallOrderReportStatus: state.smallOrderReport?.status || "",
	        smallOrderSummary: state.smallOrderReport?.summary || null,
	        monthlyTargetStatus: state.data?.monthlyTarget?.status || state.raw?.monthlyTarget?.status || "",
	        monthlyTargetOrderTarget: state.data?.monthlyTarget?.order?.target || 0,
	        monthlyTargetRetailTarget: state.data?.monthlyTarget?.retail?.target || 0,
	        vehicleSeries: [...selectedVehicleSeries()],
	        nationalComplete: state.raw?.nationalComplete === true,
	        visibleStoreCodes: buildDiagnosisRows().filter((row) => row.level === "store").map((row) => row.code),
	        visibleProcessStoreCodes: buildProcessRows().filter((row) => row.level === "store").map((row) => row.code),
	        visibleIronCodes: buildIronRows().map((row) => row.code)
      })
    };
    load();
  }

  if (window.__RETAIL_PC_APP_TEST__) {
    window.__retailPcAppTest = {
      salesRowConversionRates,
      salesFunnelCell,
      loadNegativeProcess,
      state,
      emptyProcessErrors
    };
    return;
  }

  Promise.resolve(window.RetailRuntimeConfig?.ready)
    .catch(() => undefined)
    .then(initializeApp);
})();
