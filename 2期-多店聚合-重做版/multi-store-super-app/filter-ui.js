(function () {
  const ALL = "全部";
  let mounted = false;
  let draft = null;
  let latestOptions = { brandOptions: ["MG"], areaOptions: [], districtOptions: [], dealers: [], defaultArea: ALL, defaultDistrict: ALL };
  let requestId = 0;
  let applySearch = null;
  let openDate = false;
  let baseMonth = null;
  let pendingStart = "";
  let hoverDate = "";
  let focusedDate = "";

  function option(value, label = value, selectedValue = "") {
    return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
  }

  function currentValue(key) {
    if (key === "brand" && (!draft.brand || draft.brand === ALL)) return "MG";
    if (key === "store") return draft.store || ALL;
    return draft[key] || ALL;
  }

  function selectField(label, key, values, selected, disabled = false) {
    return `
      <label class="filter-pill">
        <span>${label}</span>
        <select data-filter-key="${key}" ${disabled ? "disabled" : ""}>
          ${values.map((value) => option(value, value, selected)).join("")}
        </select>
        <b>⌄</b>
      </label>
    `;
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function formatDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function displayDate(value) { return String(value || "").replace(/-/g, "/"); }
  function parseDate(value) {
    const [year, month, day] = String(value || "").split("-").map(Number);
    return year && month && day ? new Date(year, month - 1, day) : new Date();
  }
  function addMonths(date, offset) { return new Date(date.getFullYear(), date.getMonth() + offset, 1); }
  function sameDay(left, right) { return parseDate(left).getTime() === parseDate(right).getTime(); }
  function calendarIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3V2Zm13 8H4v10h16V10ZM4 8h16V6H4v2Zm3 4h3v3H7v-3Zm5 0h3v3h-3v-3Zm5 0h2v3h-2v-3Zm-10 5h3v2H7v-2Zm5 0h3v2h-3v-2Z"/></svg>`;
  }

  function dateField() {
    const opened = openDate ? " is-open" : "";
    return `
      <div class="filter-pill date-filter-pill rp-header-date-field${opened}" data-date-field>
        <button class="rp-header-filter-trigger rp-header-date-trigger" type="button" aria-haspopup="dialog" aria-expanded="${openDate}">
          <span>日期</span>
          <strong>${displayDate(draft.startDate)}</strong>
          <span class="rp-header-calendar-icon" aria-hidden="true">${calendarIcon()}</span>
          <em>至</em>
          <strong>${displayDate(draft.endDate)}</strong>
          <span class="rp-header-calendar-icon" aria-hidden="true">${calendarIcon()}</span>
        </button>
        <div class="rp-header-calendar-popover" role="dialog" aria-label="日期范围选择">${calendarPopover()}</div>
      </div>
    `;
  }

  function renderBusyFilters() {
    const root = document.getElementById("filterBar");
    root.setAttribute("aria-busy", "true");
    root.innerHTML = [
      selectField("品牌", "brand", [currentValue("brand")], currentValue("brand"), true),
      selectField("大区", "area", [currentValue("area")], currentValue("area"), true),
      selectField("小区", "district", ["读取中"], "读取中", true),
      selectField("经销商", "store", [ALL], ALL, true),
      dateField()
    ].join("");
    bindCalendar(root);
  }

  function calendarPopover() {
    if (!baseMonth) {
      const start = parseDate(draft.startDate);
      baseMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    }
    return `<div class="rp-header-calendar-panel">${calendarMonth(baseMonth, "start")}${calendarMonth(addMonths(baseMonth, 1), "end")}</div>`;
  }

  function calendarMonth(monthDate, position) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstDay.getDay());
    const navLeft = position === "start" ? `<span class="rp-header-calendar-nav-group is-left">
      <button class="rp-header-calendar-nav" type="button" data-month-shift="-12">«</button>
      <button class="rp-header-calendar-nav" type="button" data-month-shift="-1">‹</button>
    </span>` : "";
    const navRight = position === "end" ? `<span class="rp-header-calendar-nav-group is-right">
      <button class="rp-header-calendar-nav" type="button" data-month-shift="1">›</button>
      <button class="rp-header-calendar-nav" type="button" data-month-shift="12">»</button>
    </span>` : "";
    return `<div class="rp-header-calendar-month">
      <div class="rp-header-calendar-title is-${position}">${navLeft}<strong>${year} 年 ${month + 1} 月</strong>${navRight}</div>
      <div class="rp-header-calendar-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="rp-header-calendar-days">${Array.from({ length: 42 }, (_, index) => calendarDay(gridStart, index, month)).join("")}</div>
    </div>`;
  }

  function calendarDay(gridStart, index, month) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const value = formatDate(date);
    const time = date.getTime();
    const startTime = parseDate(draft.startDate).getTime();
    const endTime = parseDate(draft.endDate).getTime();
    const pendingTime = pendingStart ? parseDate(pendingStart).getTime() : null;
    const hoverTime = pendingStart ? parseDate(hoverDate || pendingStart).getTime() : null;
    const displayStart = pendingTime !== null && hoverTime !== null ? Math.min(pendingTime, hoverTime) : startTime;
    const displayEnd = pendingTime !== null && hoverTime !== null ? Math.max(pendingTime, hoverTime) : endTime;
    const classes = [
      "rp-header-calendar-day",
      date.getMonth() !== month ? "is-muted" : "",
      sameDay(value, formatDate(new Date())) ? "is-today" : "",
      value === focusedDate ? "is-focused-date" : "",
      pendingStart && value === pendingStart ? "is-pending-start" : "",
      time === displayStart ? "is-range-start" : "",
      time === displayEnd ? "is-range-end" : "",
      time > displayStart && time < displayEnd ? "is-in-range" : ""
    ].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-date-value="${value}" aria-pressed="${time >= displayStart && time <= displayEnd}"><span>${date.getDate()}</span></button>`;
  }

  function paintHoverRange(root, value) {
    if (!pendingStart) return;
    hoverDate = value;
    const pendingTime = parseDate(pendingStart).getTime();
    const hoverTime = parseDate(value || pendingStart).getTime();
    const displayStart = Math.min(pendingTime, hoverTime);
    const displayEnd = Math.max(pendingTime, hoverTime);
    root.querySelectorAll("[data-date-value]").forEach((button) => {
      const time = parseDate(button.dataset.dateValue).getTime();
      button.classList.toggle("is-range-start", time === displayStart);
      button.classList.toggle("is-range-end", time === displayEnd);
      button.classList.toggle("is-in-range", time > displayStart && time < displayEnd);
      button.setAttribute("aria-pressed", time >= displayStart && time <= displayEnd);
    });
  }

  function render() {
    const root = document.getElementById("filterBar");
    const brandValues = latestOptions.brandOptions.includes(currentValue("brand"))
      ? latestOptions.brandOptions
      : [currentValue("brand"), ...latestOptions.brandOptions];
    root.innerHTML = [
      selectField("品牌", "brand", brandValues, currentValue("brand")),
      selectField("大区", "area", [ALL, ...latestOptions.areaOptions], currentValue("area")),
      selectField("小区", "district", [ALL, ...latestOptions.districtOptions], currentValue("district")),
      selectField("经销商", "store", [ALL, ...latestOptions.dealers.map((item) => item.name)], currentValue("store")),
      dateField()
    ].join("");
    root.querySelectorAll("select").forEach((field) => {
      field.onchange = () => update(field.dataset.filterKey, field.value);
    });
    bindCalendar(root);
  }

  function bindCalendar(root) {
    const dateFieldEl = root.querySelector("[data-date-field]");
    if (!dateFieldEl) return;
    dateFieldEl.onclick = (event) => event.stopPropagation();
    dateFieldEl.querySelector(".rp-header-date-trigger").onclick = () => {
      openDate = !openDate;
      if (openDate) {
        const start = parseDate(draft.startDate);
        baseMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        pendingStart = "";
        hoverDate = "";
        focusedDate = draft.startDate;
      }
      render();
    };
    root.querySelectorAll("[data-month-shift]").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        baseMonth = addMonths(baseMonth || parseDate(draft.startDate), Number(button.dataset.monthShift));
        render();
      };
    });
    root.querySelectorAll("[data-date-value]").forEach((button) => {
      button.onmouseenter = () => paintHoverRange(root, button.dataset.dateValue);
      button.onclick = (event) => {
        event.stopPropagation();
        selectDate(button.dataset.dateValue);
      };
    });
  }

  function selectDate(value) {
    focusedDate = value;
    if (!pendingStart) {
      draft.startDate = value;
      draft.endDate = value;
      pendingStart = value;
      hoverDate = value;
      render();
      return;
    }
    const selected = parseDate(value).getTime();
    const pending = parseDate(pendingStart).getTime();
    draft.startDate = selected < pending ? value : pendingStart;
    draft.endDate = selected < pending ? pendingStart : value;
    pendingStart = "";
    hoverDate = "";
    openDate = false;
    render();
  }

  function normalizeAfterOptions() {
    if (!latestOptions.brandOptions.includes(currentValue("brand"))) draft.brand = latestOptions.brandOptions[0] || "MG";
    if (draft.area !== ALL && !latestOptions.areaOptions.includes(draft.area)) draft.area = latestOptions.defaultArea;
    if (!draft.area || draft.area === ALL) draft.area = latestOptions.defaultArea;
    if (draft.district !== ALL && !latestOptions.districtOptions.includes(draft.district)) draft.district = latestOptions.defaultDistrict;
    if (!draft.district || draft.district === ALL) draft.district = latestOptions.defaultDistrict;
    draft.store = ALL;
  }

  async function refreshOptions() {
    const id = ++requestId;
    document.getElementById("filterBar").setAttribute("aria-busy", "true");
    try {
      const next = await window.RegionFilterApi.loadFilterOptions(draft);
      if (id !== requestId) return;
      latestOptions = next;
      normalizeAfterOptions();
    } catch (error) {
      console.warn("筛选数据集读取失败", error);
    } finally {
      if (id === requestId) {
        document.getElementById("filterBar").removeAttribute("aria-busy");
        render();
      }
    }
    return { ...draft };
  }

  function update(key, value) {
    draft[key] = value;
    if (key === "brand") {
      draft.area = ALL;
      draft.district = ALL;
      draft.store = ALL;
    }
    if (key === "area") {
      draft.district = ALL;
      draft.store = ALL;
    }
    if (key === "district") draft.store = ALL;
    render();
    if (["brand", "area", "district"].includes(key)) refreshOptions();
  }

  async function mountFilterBar(params, onSearch) {
    const root = document.getElementById("filterBar");
    if (!root) return { ...params };
    draft = { ...params, brand: params.brand === ALL ? "MG" : params.brand, store: ALL };
    applySearch = onSearch;
    const needsOptionDefaults = !draft.area || draft.area === ALL || !draft.district || draft.district === ALL;
    if (needsOptionDefaults) {
      renderBusyFilters();
    } else {
      render();
    }
    if (!mounted) {
      const queryButton = document.querySelector(".query-button");
      const refreshButton = document.querySelector(".refresh-button");
      if (queryButton) queryButton.onclick = () => applySearch?.({ ...draft });
      if (refreshButton) refreshButton.onclick = () => applySearch?.({ ...draft });
      document.addEventListener("click", () => {
        if (!openDate) return;
        openDate = false;
        pendingStart = "";
        hoverDate = "";
        render();
      });
      mounted = true;
    }
    const normalized = await refreshOptions();
    return normalized || { ...draft };
  }

  window.RegionFilterUi = { mountFilterBar };
})();
