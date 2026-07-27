(function (root) {
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function fmtInt(value) { return Math.round(Number(value) || 0).toLocaleString("zh-CN"); }
  function fmtMaybeInt(value) { return value == null ? "--" : fmtInt(value); }
  function fmtPct(value) { return value == null || !Number.isFinite(value) ? "--" : `${(value * 100).toFixed(1)}%`; }
  function levelLabel(level) {
    return level === "area" ? "落后大区" : level === "district" ? "落后小区" : "落后门店";
  }

  function metric(label, value, unit = "") {
    return `<article class="small-order-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${unit ? `<em>${esc(unit)}</em>` : ""}</article>`;
  }

  function stateMessage(report) {
    const text = report?.error || "小订目标暂不可用";
    const kind = /权限/.test(text) ? "no-permission" : /字段|完整|合同/.test(text) ? "incomplete" : "error";
    return `<div class="small-order-state ${kind}" role="status" aria-live="polite">${esc(text)}</div>`;
  }

  function renderRows(report) {
    if (!report.rows.length) return `<div class="small-order-state empty">当前层级暂无小订达成表现</div>`;
    return `
      <div class="small-order-table-wrap">
        <table class="small-order-table">
          <thead><tr><th>对象名称</th><th>对象代码</th><th>小订目标</th><th>累计小订</th><th>目标达成</th><th>时间进度</th><th>应达缺口</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${report.rows.map((row) => `
              <tr>
                <td>${esc(row.name)}</td>
                <td>${esc(row.code)}</td>
                <td>${fmtInt(row.target)}</td>
                <td>${fmtMaybeInt(row.actual)}</td>
                <td>${fmtPct(row.achievementRate)}</td>
                <td>${esc(report.period.progressText)}</td>
                <td>${fmtMaybeInt(row.gapToExpected)}</td>
                <td><span class="small-order-status ${row.status === "落后" ? "behind" : row.status === "数据暂不可用" ? "unknown" : "ok"}">${esc(row.status)}</span></td>
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
      rootEl.innerHTML = `<section class="small-order-card loading" aria-label="MG 07小订战报"><div class="small-order-title-row"><h2>MG 07小订战报</h2><span>加载中</span></div><div class="small-order-summary">${[1, 2, 3, 4, 5].map(() => "<article></article>").join("")}</div></section>`;
      return;
    }
    const period = report?.period || {};
    const summary = report?.summary;
    const actualUnavailable = summary?.actualStatus === "actual_unavailable";
    const ownStore = summary?.scopeMode === "own_store";
    const hasTargetState = ["ready", "partial", "empty"].includes(report?.status);
    const fifthLabel = ownStore ? "自身进度状态" : levelLabel(report?.viewLevel);
    const fifthValue = ownStore ? summary?.ownStatus || "数据暂不可用" : actualUnavailable ? "--" : fmtInt(summary?.laggingCount);
    rootEl.innerHTML = `
      <section class="small-order-card" aria-label="MG 07小订战报">
        <div class="small-order-title-row">
          <div>
            <h2>MG 07小订战报</h2>
            <p>${esc(period.status || "数据暂不可用")}${summary?.dataUpdatedAt ? ` · 数据更新于 ${esc(summary.dataUpdatedAt)}` : ""}</p>
          </div>
          ${hasTargetState ? `<button class="small-order-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" aria-controls="smallOrderBody" data-small-order-toggle>${expanded ? "收起" : "展开"}小订达成表现</button>` : ""}
        </div>
        ${hasTargetState ? `
          <div class="small-order-summary">
            ${metric("小订目标", fmtInt(summary?.target))}
            ${metric("累计小订", fmtMaybeInt(summary?.actual))}
            ${metric("目标达成", fmtPct(summary?.achievementRate))}
            ${metric("时间进度", summary?.progressText || "--")}
            ${metric(fifthLabel, fifthValue, ownStore || actualUnavailable ? "" : "个")}
          </div>
          ${actualUnavailable ? `<div class="small-order-state incomplete" role="status">实际数据暂不可用：${esc(summary.actualError || "实际源暂不可用")}</div>` : ""}
          <div id="smallOrderBody" class="small-order-body" ${expanded ? "" : "hidden"}>
            <div class="small-order-body-head">
              <h3>小订达成表现</h3>
              ${viewState.drillPath?.length ? `<button class="small-order-link" type="button" data-small-order-back>返回上一级</button>` : ""}
            </div>
            ${renderRows(report)}
          </div>` : stateMessage(report)}
      </section>`;
  }

  root.SmallOrderView = { render };
})(typeof window !== "undefined" ? window : globalThis);
