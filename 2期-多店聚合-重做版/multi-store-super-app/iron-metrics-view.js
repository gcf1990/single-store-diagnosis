(function (root) {
  const { GROUPS, metricsFor } = root.IronMetricsContract;
  const { displayValue } = root.IronMetricsModel;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function groupLabel(code) {
    return GROUPS.find((group) => group.code === code)?.label || "邀约指标 7";
  }
  function actionHtml(row, params, buildSingleStoreLink, levelMeta) {
    if (row.level === "store") {
      return `<a class="detail-action store-detail-link" href="${esc(buildSingleStoreLink(params, row.store || row))}" target="_blank" rel="noopener noreferrer" data-store-detail>门店详情</a>`;
    }
    return `<button class="detail-action organization-drill-button" type="button" data-organization-drill>${esc(levelMeta[row.level].action)}</button>`;
  }
  function buildRecordsByRow(records) {
    const map = new Map();
    (records || []).forEach((record) => {
      const row = map.get(record.organization_code) || new Map();
      row.set(record.metric_code, record);
      map.set(record.organization_code, row);
    });
    return map;
  }
  function headerHtml(section) {
    return metricsFor(section).map((metric, index) => `
      <th class="metric-head${index === 0 && section === "trial" ? " group-divider-start" : ""}" title="${esc(metric.name)}">
        <span class="iron-head-name">${esc(metric.name)}</span>
        ${metric.target == null ? "" : `<span class="iron-target-label">${esc(root.IronMetricsContract.targetLabel(metric.target))}</span>`}
      </th>
    `).join("");
  }
  function colgroupHtml(section) {
    return `<col class="dealer-col">${metricsFor(section).map(() => '<col class="metric-col">').join("")}<col class="action-col">`;
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
  function trendHtml(kind, record) {
    const label = kind === "month" ? "月环比" : "周环比";
    const error = kind === "month" ? record?.monthError : record?.weekError;
    const loading = kind === "month" ? record?.monthLoading : record?.weekLoading;
    const change = trendChange(kind === "month" ? record?.monthDelta : record?.weekDelta);
    const text = error ? "加载失败" : loading ? "加载中" : change.text;
    const tone = error || loading ? "neutral" : change.tone;
    return `<div class="metric-trend" data-kind="${esc(kind)}"><span class="trend-prefix">${label}</span><span class="trend-change ${esc(tone)}">${esc(text)}</span></div>`;
  }
  function cellHtml(record, className = "") {
    const text = displayValue(record);
    if (text === "loading") return `<td class="${esc(className)}"><div class="iron-loading" aria-label="加载中"></div></td>`;
    const incomplete = text === "数据不完整";
    const title = incomplete ? ` title="${esc(record?.source_error || record?.error || "当前指标数据不完整")}"` : "";
    return `<td class="${esc(className)}"><div class="metric-cell iron-metric-cell${incomplete ? " metric-error" : ""}"${title}><div class="metric-value">${esc(text)}</div>${trendHtml("month", record)}${trendHtml("week", record)}</div></td>`;
  }
  function rowHtml(row, recordsByRow, section, options) {
    const records = recordsByRow.get(row.code) || new Map();
    return `
      <tr data-organization-row="${esc(row.code)}" data-row-level="${esc(row.level)}" class="${options.selectedStoreCode === row.code ? "linked-store-row" : ""}">
        <td class="sticky-col"><div class="dealer"><strong title="${esc(row.name)}">${esc(row.name)}</strong></div></td>
        ${metricsFor(section).map((metric, index) => cellHtml(records.get(metric.code), index === 0 && section === "trial" ? "group-divider-start" : "")).join("")}
        <td class="sticky-action"><div class="store-row-actions">${actionHtml(row, options.params, options.buildSingleStoreLink, options.levelMeta)}</div></td>
      </tr>
    `;
  }
  function tableHtml({ rows, records, section, emptyText, options }) {
    const cols = metricsFor(section).length + 2;
    if (!rows.length) {
      return `<div class="table-wrap iron-table-wrap"><table id="ironMetricsTable" class="process-table iron-table iron-table-${esc(section)}"><colgroup>${colgroupHtml(section)}</colgroup><tbody><tr><td colspan="${cols}">${esc(emptyText)}</td></tr></tbody></table></div>`;
    }
    const recordsByRow = buildRecordsByRow(records);
    return `
      <div class="table-wrap iron-table-wrap">
        <table id="ironMetricsTable" class="process-table iron-table iron-table-${esc(section)}" aria-label="${esc(groupLabel(section))}">
          <colgroup>${colgroupHtml(section)}</colgroup>
          <thead><tr><th id="ironFirstColumn" class="sticky-col" title="${esc(options.firstColumn)}">${esc(options.firstColumn)}</th>${headerHtml(section)}<th class="sticky-action" title="操作">操作</th></tr></thead>
          <tbody id="ironMetricsTableBody">${rows.map((row) => rowHtml(row, recordsByRow, section, options)).join("")}</tbody>
        </table>
      </div>
    `;
  }
  function render(container, payload) {
    if (!container) return;
    container.innerHTML = `
      <div id="ironGroupPanel" class="iron-group-panel" role="tabpanel" aria-labelledby="ironGroupTab-${payload.activeGroup}">
        ${tableHtml(payload)}
      </div>
    `;
    const table = container.querySelector("#ironMetricsTable");
    if (table && payload.options?.comparisonClass) table.classList.add(payload.options.comparisonClass);
  }
  function exportRows(records, rows, section) {
    const order = new Map(rows.map((row, index) => [row.code, index]));
    return (records || [])
      .filter((record) => record.section_code === section)
      .sort((a, b) => (order.get(a.organization_code) ?? 999999) - (order.get(b.organization_code) ?? 999999) || a.page_order - b.page_order);
  }
  function csvMetricValue(record) {
    const text = displayValue(record);
    return text === "loading" ? "加载中" : text;
  }
  function csvTrendValue(kind, record) {
    const error = kind === "month" ? record?.monthError : record?.weekError;
    if (error) return "加载失败";
    const loading = kind === "month" ? record?.monthLoading : record?.weekLoading;
    if (loading) return "加载中";
    return trendChange(kind === "month" ? record?.monthDelta : record?.weekDelta).text;
  }
  function exportCsvRows(records, rows, section, options = {}) {
    const metrics = metricsFor(section);
    const recordsByRow = buildRecordsByRow(exportRows(records, rows, section));
    const result = [[
      options.firstColumn || "组织名称",
      ...metrics.flatMap((metric) => [metric.name, `${metric.name}月环比`, `${metric.name}周环比`])
    ]];
    (rows || []).forEach((row) => {
      const rowRecords = recordsByRow.get(row.code) || new Map();
      result.push([
        row.name || "",
        ...metrics.flatMap((metric) => {
          const record = rowRecords.get(metric.code);
          return [csvMetricValue(record), csvTrendValue("month", record), csvTrendValue("week", record)];
        })
      ]);
    });
    return result;
  }
  const api = { render, exportRows, exportCsvRows, groupLabel };
  if (root.__IRON_METRICS_TEST__ === true) {
    api[["__", "test"].join("")] = { headerHtml, cellHtml, trendChange, actionHtml };
  }
  root.IronMetricsView = api;
})(window);
