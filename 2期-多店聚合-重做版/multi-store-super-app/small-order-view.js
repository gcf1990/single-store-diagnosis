(function (root) {
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function fmtInt(value) { return Math.round(Number(value) || 0).toLocaleString("zh-CN"); }
  function fmtMaybeInt(value) { return value == null ? "--" : fmtInt(value); }
  function fmtToday(value) { return value == null ? "--" : `+${fmtInt(value)}`; }
  function fmtTarget(row) { return row?.targetConfigured === false ? "未设目标" : fmtInt(row?.target); }
  function fmtGap(row) { return row?.targetConfigured === false ? "--" : fmtMaybeInt(row?.gapToExpected); }
  function fmtPct(value) { return value == null || !Number.isFinite(value) ? "--" : `${(value * 100).toFixed(1)}%`; }
  function pctNumber(value) { return value == null || !Number.isFinite(value) ? null : Math.max(0, value * 100); }
  function pctTextFromRatio(value) { const pct = pctNumber(value); return pct == null ? "--" : `${pct.toFixed(1)}%`; }
  function progressNumber(text) { const number = Number.parseFloat(String(text || "").replace("%", "")); return Number.isFinite(number) ? Math.max(0, number) : null; }
  function levelLabel(level) {
    return level === "area" ? "落后大区" : level === "district" ? "落后小区" : "落后门店";
  }
  function levelUnit(level) {
    return level === "area" ? "个大区" : level === "district" ? "个小区" : "个门店";
  }
  function viewScopeText(level) {
    return level === "area" ? "总部视角展示大区" : level === "district" ? "大区视角展示小区" : "小区视角展示门店";
  }

  function safeStateText(report) {
    const text = String(report?.error || "MG 07 小订目标数据暂不可用");
    if (report?.status === "target_unavailable") return "MG 07 小订数据暂不可用";
    if (report?.status === "data_incomplete" && !["当前范围存在重复目标配置", "当前范围存在无效目标配置", "MG 07 小订目标数据暂不可用"].includes(text)) return "MG 07 小订目标数据暂不可用";
    if (report?.status === "empty" && text !== "MG 07 当前范围暂无数据" && text !== "当前范围暂无 MG 07 小订战报数据") return "MG 07 当前范围暂无数据";
    if (/dsId|parentDirId|execute-sql|configuredRows|canonicalUniqueCodes|targetTotal|sourceUniqueCodes|validPrimary|unmappedRows|字段|合同/.test(text)) return "MG 07 小订目标数据暂不可用";
    return text;
  }

  function metric(label, value, options = {}) {
    const tone = options.tone ? ` ${options.tone}` : "";
    return `<article class="small-order-metric${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${options.unit ? `<em>${esc(options.unit)}</em>` : ""}${options.helper ? `<small>${esc(options.helper)}</small>` : ""}</article>`;
  }

  function stateMessage(report) {
    const text = safeStateText(report);
    const kind = /权限/.test(text) ? "no-permission" : /字段|完整|合同/.test(text) ? "incomplete" : "error";
    return `<div class="small-order-state ${kind}" role="status" aria-live="polite">${esc(text)}</div>`;
  }

  function renderRows(report) {
    if (!report.rows.length) return `<div class="small-order-state empty">当前层级暂无小订达成表现</div>`;
    return `
      <div class="small-order-table-wrap">
        <table class="small-order-table">
          <colgroup><col span="10"><col class="small-order-action-col"></colgroup>
          <thead><tr><th>对象名称</th><th>对象代码</th><th>小订目标</th><th>留存小订</th><th>今日新增</th><th>目标达成</th><th>时间进度</th><th>应达缺口</th><th>退订小订</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${report.rows.map((row) => `
              <tr>
                <td>${esc(row.name)}</td>
                <td>${esc(row.code)}</td>
                <td>${esc(fmtTarget(row))}</td>
                <td>${fmtMaybeInt(row.retained)}</td>
                <td class="small-order-today">${fmtToday(row.todayActual)}</td>
                <td>${fmtPct(row.achievementRate)}</td>
                <td>${esc(report.period.progressText)}</td>
                <td>${esc(fmtGap(row))}</td>
                <td>${fmtMaybeInt(row.cancelled)}</td>
                <td><span class="small-order-status ${row.status === "领先" ? "leading" : row.status === "落后" ? "behind" : row.status === "数据暂不可用" ? "unknown" : "ok"}">${esc(row.status)}</span></td>
                <td>${report.viewLevel === "store" ? "--" : `<button class="small-order-link" type="button" data-small-order-drill="${esc(row.code)}" data-small-order-name="${esc(row.name)}">查看${report.nextLevel === "district" ? "小区" : "门店"}</button>`}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function render(rootEl, report, viewState = {}) {
    if (!rootEl) return;
    const expanded = viewState.expanded === true;
    if (report?.status === "loading") {
      rootEl.innerHTML = `<section class="small-order-card loading" aria-label="MG 07小订战报"><div class="small-order-title-row"><div><h2>MG 07小订战报</h2><p>小订期 2026/07/29—2026/08/22 · 数据截至 数据暂不可用 · 独立于销售日期和车系筛选</p></div><span class="small-order-badge">加载中</span></div><div class="small-order-summary">${[1, 2, 3, 4, 5, 6].map(() => "<article></article>").join("")}</div></section>`;
      return;
    }
    const period = report?.period || {};
    const summary = report?.summary;
    const actualUnavailable = summary?.actualStatus === "actual_unavailable";
    const ownStore = summary?.scopeMode === "own_store";
    const hasTargetState = ["ready", "partial", "empty"].includes(report?.status);
    const summaryLevel = report?.summaryViewLevel || report?.viewLevel;
    const fifthLabel = ownStore ? "自身进度状态" : levelLabel(summaryLevel);
    const fifthValue = ownStore ? summary?.ownStatus || "数据暂不可用" : actualUnavailable ? "--" : fmtInt(summary?.laggingCount);
    const fifthHelper = ownStore || actualUnavailable ? "" : `共 ${fmtInt(summary?.objectTotal)} ${levelUnit(summaryLevel)}`;
    const achievementPct = pctNumber(summary?.achievementRate);
    const progressPct = progressNumber(summary?.progressText);
    const ppDiff = achievementPct == null || progressPct == null ? null : achievementPct - progressPct;
    const ppTone = ppDiff == null ? "" : ppDiff >= 0 ? "领先" : "落后";
    const ppText = ppDiff == null ? "--" : `${Math.abs(ppDiff).toFixed(1)}pp`;
    const actualWidth = achievementPct == null ? 0 : Math.min(100, achievementPct);
    const progressLeft = progressPct == null ? 0 : Math.min(100, progressPct);
    const buttonCount = fmtInt(summary?.objectTotal);
    const toggleText = expanded ? "收起小订达成表现" : `查看小订达成表现（${buttonCount}）`;
    const subtitleUpdatedAt = summary?.dataUpdatedAt ? summary.dataUpdatedAt : actualUnavailable ? "数据暂不可用" : period.status === "小订即将开始" ? "小订尚未开始" : "数据暂不可用";
    rootEl.innerHTML = `
      <section class="small-order-card" aria-label="MG 07小订战报">
        <div class="small-order-title-row">
          <div>
            <h2>MG 07小订战报</h2>
            <p>小订期 2026/07/29—2026/08/22 · 数据截至 ${esc(subtitleUpdatedAt)} · 独立于销售日期和车系筛选</p>
          </div>
          <span class="small-order-badge">${esc(period.status || "数据暂不可用")}</span>
        </div>
        ${hasTargetState ? `
          <div class="small-order-summary">
            ${metric("小订目标", fmtInt(summary?.target), { tone: "blue" })}
            ${metric("留存小订", fmtMaybeInt(summary?.retained), { helper: `累计 ${fmtMaybeInt(summary?.actual)}` })}
            ${metric("今日新增", fmtToday(summary?.todayActual), { tone: "green" })}
            ${metric("目标达成", fmtPct(summary?.achievementRate), { tone: ppDiff == null || ppDiff >= 0 ? "" : "red" })}
            ${metric("时间进度", summary?.progressText || "--")}
            ${metric(fifthLabel, fifthValue, { tone: !ownStore && !actualUnavailable && Number(summary?.laggingCount) > 0 ? "red" : "", helper: fifthHelper })}
          </div>
          ${report.status === "empty" && report.error ? `<div class="small-order-state empty" role="status">${esc(safeStateText(report))}</div>` : ""}
          ${(report.warnings || []).map((warning) => `<div class="small-order-state incomplete" role="status">${esc(warning)}</div>`).join("")}
          <div class="small-order-pace-row">
            <div class="small-order-pace">
              <span class="small-order-pace-label">目标达成 <b>${esc(pctTextFromRatio(summary?.achievementRate))}</b>，${esc(ppTone)}时间进度 <b>${esc(ppText)}</b></span>
              <div class="small-order-bar" role="img" aria-label="目标达成${esc(pctTextFromRatio(summary?.achievementRate))}，时间进度${esc(summary?.progressText || "--")}">
                <i style="width:${actualWidth.toFixed(1)}%"></i>
                <em style="left:${progressLeft.toFixed(1)}%"></em>
              </div>
            </div>
            <button class="small-order-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" aria-controls="smallOrderBody" data-small-order-toggle><span>${esc(toggleText)}</span><span class="small-order-toggle-icon" aria-hidden="true" data-material-symbol="expand_more"></span></button>
          </div>
          ${actualUnavailable ? `<div class="small-order-state incomplete" role="status">${esc(summary.actualError || "MG 07 小订实际数据暂不可用")}</div>` : ""}
          <div id="smallOrderBody" class="small-order-body" ${expanded ? "" : "hidden"}>
            <div class="small-order-body-head">
              <h3>小订达成表现</h3>
              <span>${esc(viewScopeText(report.viewLevel))} · 按应达缺口数量从大到小 · 支持逐级下钻</span>
              ${viewState.drillPath?.length ? `<button class="small-order-link" type="button" data-small-order-back>返回上一级</button>` : ""}
            </div>
            ${renderRows(report)}
          </div>` : stateMessage(report)}
      </section>`;
  }

  root.SmallOrderView = { render };
})(typeof window !== "undefined" ? window : globalThis);
