import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";

test("浏览器运行态中 DCC 182 只走 SQL 聚合，不触发 preview", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, asyncIronMetrics: false, ironRaw: null };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture() });

  await page.goto("/");
  await expect(page.locator("#salesTab")).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
  const result = await page.evaluate(async () => {
    const transport = window.RegionDataApi.__transport;
    const executeSqlRows = transport.executeSqlRows;
    const allRows = transport.allRows;
    const calls = [];
    transport.executeSqlRows = async (dsId, query) => {
      calls.push({ type: "sql", dsId, query });
      if (dsId === window.IronMetricsContract.DS.dcc) {
        return [{
          area_code: "A1",
          area_name: "大区1",
          district_code: "D1",
          district_name: "小区1",
          dealer_code: "S1",
          dealer_name: "门店1",
          first_follow_call_60s_denominator: 2,
          first_follow_call_60s_numerator: 1,
          follow_30min_denominator: 2,
          follow_30min_numerator: 1,
          follow_24h_denominator: 2,
          follow_24h_numerator: 1,
          two_day_three_call_denominator: 2,
          two_day_three_call_numerator: 1
        }];
      }
      return [];
    };
    transport.allRows = async () => {
      calls.push({ type: "preview" });
      throw new Error("打铁不允许调用 preview");
    };
    try {
      const raw = await window.IronMetricsApi.loadIronMetricsRaw(
        { brand: "MG", startDate: "2026-07-01", endDate: "2026-07-20" },
        [{ code: "S1", name: "门店1", areaCode: "A1", districtCode: "D1" }]
      );
      return { raw, calls };
    } finally {
      transport.executeSqlRows = executeSqlRows;
      transport.allRows = allRows;
    }
  });

  expect(result.calls.filter((item) => item.type === "sql")).toHaveLength(6);
  expect(result.calls.filter((item) => item.type === "preview")).toHaveLength(0);
  const dccCall = result.calls.find((item) => item.dsId === "fa1bfbd7736f34d1d8633883");
  expect(dccCall.query).toContain("双品牌DCC话务指标182");
  expect(dccCall.query).not.toContain("`经销商代码` IN");
  expect(result.calls.some((item) => item.dsId !== "fa1bfbd7736f34d1d8633883" && item.query.includes("`经销商代码` IN ('S1')"))).toBe(true);
  expect(result.raw.sourceStates.dcc.status).toBe("success");
  expect(result.raw.dccRows[0].first_follow_call_60s_denominator).toBe(2);
});

test("页面三阶段打铁编排保持同一车系集合，其他车系按来源固定精确或补集路径", async ({ page }) => {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = { ...fixtureValue, asyncIronMetrics: false, ironRaw: null };
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture() });

  await page.goto("/?brand=MG&startDate=2026-07-01&endDate=2026-07-20");
  await page.waitForFunction(() => typeof window.__retailPcApp?.getStateSnapshot === "function");
  const batches = await page.evaluate(async () => {
    const transport = window.RegionDataApi.__transport;
    const originalExecute = transport.executeSqlRows;
    const sourceByDs = Object.fromEntries(Object.entries(window.IronMetricsContract.DS).map(([source, dsId]) => [dsId, source]));
    const calls = [];
    window.__retailPcFixture.asyncIronMetrics = true;
    transport.executeSqlRows = async (dsId, query) => {
      calls.push({ source: sourceByDs[dsId], query });
      return [];
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const loadFor = async (vehicleSeries) => {
      const start = calls.length;
      const url = new URL(window.location.href);
      url.searchParams.delete("vehicleSeries");
      vehicleSeries.forEach((value) => url.searchParams.append("vehicleSeries", value));
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      document.querySelector("#ironTab")?.click();
      const expected = start + 18;
      const deadline = Date.now() + 5_000;
      while (calls.length < expected && Date.now() < deadline) await wait(10);
      if (calls.length !== expected) throw new Error(`打铁三阶段 SQL 未完成：期望 ${expected}，实际 ${calls.length}`);
      return calls.slice(start);
    };
    try {
      const mg4x = await loadFor(["MG 4X"]);
      const unknown = await loadFor(["未知车系"]);
      document.querySelector("#ironTab").click();
      await wait(0);
      const unknownTableText = document.querySelector("#ironMetricsTable")?.textContent || "";
      const other = await loadFor(["其他车系"]);
      const multi = await loadFor(["MG 4X", "其他车系"]);
      return { mg4x, unknown, other, multi, unknownTableText };
    } finally {
      transport.executeSqlRows = originalExecute;
    }
  });

  const assertThreeStages = (calls) => {
    expect(calls).toHaveLength(18);
    expect(new Set(calls.map((call) => (call.query.match(/2026-\d{2}-\d{2}/g) || []).slice(0, 2).join("/"))).size).toBe(3);
    ["inviteMention", "intentLevel", "qualityTrial", "trialRecord", "trialTalk", "dcc"].forEach((source) => {
      expect(calls.filter((call) => call.source === source)).toHaveLength(3);
    });
  };

  assertThreeStages(batches.mg4x);
  expect(batches.mg4x.every((call) => call.query.includes("'MG 4X'"))).toBe(true);
  const inviteCalls = batches.mg4x.filter((call) => call.source === "inviteMention");
  expect(inviteCalls.every((call) => call.query.includes("`周期首次意向闭环车系名称` IN ('MG 4X')") && !call.query.includes("周期最近意向闭环车系"))).toBe(true);
  const intentCalls = batches.mg4x.filter((call) => call.source === "intentLevel");
  expect(intentCalls.every((call) => call.query.includes("`周期最近意向闭环车系` IN ('MG 4X')") && !call.query.includes("周期首次意向闭环车系名称"))).toBe(true);
  expect(batches.mg4x.filter((call) => call.source === "dcc").every((call) => call.query.includes("`CRM闭环车系名称` IN ('MG 4X')"))).toBe(true);
  expect(batches.mg4x.filter((call) => call.source === "dcc").every((call) => !call.query.includes("周期首次意向闭环车系名称") && !call.query.includes("周期最近意向闭环车系"))).toBe(true);

  assertThreeStages(batches.unknown);
  expect(batches.unknown.every((call) => call.query.includes("IN ('未知')"))).toBe(true);
  expect(batches.unknown.every((call) => !call.query.includes("AND 1 = 0"))).toBe(true);
  expect(batches.unknownTableText).not.toContain("数据不完整");

  assertThreeStages(batches.other);
  ["inviteMention", "intentLevel", "qualityTrial", "dcc"].forEach((source) => {
    const calls = batches.other.filter((call) => call.source === source);
    expect(calls.every((call) => call.query.includes("IN ('其他车系')") && !call.query.includes("`车系名称` NOT IN"))).toBe(true);
  });
  ["trialRecord", "trialTalk"].forEach((source) => {
    const calls = batches.other.filter((call) => call.source === source);
    expect(calls.every((call) => call.query.includes("`品牌名称` = 'MG'") && call.query.includes("`车系名称` NOT IN") && !call.query.includes("`车系名称` IN ('其他车系')"))).toBe(true);
  });

  assertThreeStages(batches.multi);
  expect(batches.multi.every((call) => call.query.includes("'MG 4X'"))).toBe(true);
});
