import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";
import { ironRaw } from "./iron-metrics-fixtures.js";

const ZERO = { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 };
function process(total = 0, negative = 0) {
  return { total, negative, rate: total ? negative / total * 100 : null, problems: [] };
}
function testStore(fields) {
  return {
    current: { ...ZERO },
    previous: { ...ZERO },
    week: { ...ZERO },
    ip: process(),
    ipPrev: process(),
    ipWeek: process(),
    driveTag: process(),
    drivePrev: process(),
    driveWeek: process(),
    ...fields
  };
}

function makeDealerStores(count = 20) {
  return Array.from({ length: count }, (_, index) => testStore({
    code: `X${String(index + 1).padStart(2, "0")}`,
    name: `导出经销商${String(index + 1).padStart(2, "0")}`,
    areaCode: index < count / 2 ? "A1" : "A2",
    area: index < count / 2 ? "大区1" : "大区2",
    districtCode: index < count / 2 ? "D1" : "D2",
    district: index < count / 2 ? "小区1" : "小区2"
  }));
}

function sourceStates() {
  return {
    inviteMention: { status: "success", complete: true },
    intentLevel: { status: "success", complete: true },
    dcc: { status: "success", complete: true },
    qualityTrial: { status: "success", complete: true },
    trialRecord: { status: "success", complete: true },
    trialTalk: { status: "success", complete: true }
  };
}

function stagedIronRaw(stores, { invite = 30, weekInvite = 25, trial = 40 } = {}) {
  return {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    sourceStates: sourceStates(),
    inviteMentionRows: stores.map((store, index) => ({
      dealer_code: store.code,
      invite_trial_mention_numerator: invite + index,
      invite_trial_mention_denominator: 100,
      wechat_apply_mention_numerator: 50 + index,
      wechat_apply_mention_denominator: 100
    })),
    intentLevelRows: stores.map((store, index) => ({
      dealer_code: store.code,
      high_intent_low_level_numerator: 3 + (index % 4),
      high_intent_low_level_denominator: 100
    })),
    dccRows: stores.map((store, index) => ({
      dealer_code: store.code,
      first_follow_call_60s_numerator: 60 + (index % 5),
      first_follow_call_60s_denominator: 100,
      follow_30min_numerator: 70 + (index % 5),
      follow_30min_denominator: 100,
      follow_24h_numerator: 80 + (index % 5),
      follow_24h_denominator: 100,
      two_day_three_call_numerator: weekInvite + index,
      two_day_three_call_denominator: 100
    })),
    qualityTrialRows: stores.map((store, index) => ({
      "经销商代码": store.code,
      "优质试驾数": trial + index,
      "常规试驾数": 100
    })),
    trialRecordRows: stores.map((store, index) => ({
      dealer_code: store.code,
      trial_record_numerator: 55 + index,
      trial_record_denominator: 100
    })),
    trialTalkRows: stores.flatMap((store, index) => [
      {
        dealer_code: store.code,
        point: "手机互联",
        trial_talk_numerator: 45 + index,
        trial_talk_denominator: 100
      },
      {
        dealer_code: store.code,
        point: "全场景自动泊车-离车泊入",
        trial_talk_numerator: 35 + index,
        trial_talk_denominator: 100
      }
    ])
  };
}

function stateMatrixIronRaw(store, { comparison = false } = {}) {
  return {
    range: { startDate: "2026-07-01", endDate: "2026-07-20" },
    sourceStates: {
      ...sourceStates(),
      intentLevel: { status: "loading", complete: false },
      dcc: { status: "incomplete", complete: false, error: "DCC阶段不可用" }
    },
    inviteMentionRows: [{
      dealer_code: store.code,
      invite_trial_mention_numerator: comparison ? 0 : 0,
      invite_trial_mention_denominator: comparison ? 0 : 100,
      wechat_apply_mention_numerator: 0,
      wechat_apply_mention_denominator: 0
    }],
    intentLevelRows: [],
    dccRows: [{
      dealer_code: store.code,
      first_follow_call_60s_numerator: 0,
      first_follow_call_60s_denominator: 100,
      follow_30min_numerator: 1,
      follow_30min_denominator: 2,
      follow_24h_numerator: 2,
      follow_24h_denominator: 3,
      two_day_three_call_numerator: 3,
      two_day_three_call_denominator: 4
    }],
    qualityTrialRows: [],
    trialRecordRows: [],
    trialTalkRows: []
  };
}

function csvRowByName(rows, name) {
  return rows.find((row) => row[0] === name);
}

function csvCell(rows, rowName, headerName) {
  const index = rows[0].indexOf(headerName);
  expect(index).toBeGreaterThanOrEqual(0);
  return csvRowByName(rows, rowName)?.[index];
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;
  const source = String(text || "").replace(/^\ufeff/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && quoted && source[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
    } else current += char;
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

async function openIron(page, profile = profiles.headquarters, fixture = makeFixture({ ironRaw })) {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profile, fixtureValue: fixture });
  await page.goto("/");
  await page.waitForFunction(() => typeof window.__retailPcApp?.getStateSnapshot === "function");
  await page.locator("#ironTab").click();
  await expect(page.locator("#ironTabPanel")).toBeVisible({ timeout: 10_000 });
}

async function captureIronCsv(page) {
  return page.evaluate(async () => {
    window.__ironCsvText = "";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      blob.text().then((text) => { window.__ironCsvText = text; });
      return "blob:iron-test";
    };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = () => undefined;
    document.getElementById("exportSales").click();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    for (let index = 0; index < 20 && !window.__ironCsvText; index += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    return window.__ironCsvText || "";
  });
}

test("打铁下钻与二级切换共享 viewLevel/drillPath/pageIndex", async ({ page }) => {
  await openIron(page);
  await expect(page.locator("#storeTableTitle")).toHaveText("大区打铁表现");
  await page.locator("#ironMetricsTableBody [data-organization-row='A1'] [data-organization-drill]").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("小区打铁表现");
  await expect(page.locator("#organizationBreadcrumb")).toContainText("返回上一级");
  await page.locator('[data-iron-group="trial"]').click();
  await expect(page.locator("#storeTableTitle")).toHaveText("小区打铁表现");
  expect((await page.evaluate(() => window.__retailPcApp.getStateSnapshot())).viewLevel).toBe("district");
  await page.locator("[data-organization-back]").first().click();
  await expect(page.locator("#storeTableTitle")).toHaveText("大区打铁表现");
});

test("打铁导出复用当前入口并导出当前组当前范围全部行", async ({ page }) => {
  await openIron(page);
  await expect(page.locator(".export-btn:visible")).toHaveCount(1);
  await expect(page.locator("#exportIron")).toHaveCount(0);
  await expect(page.locator("#exportSales")).toBeVisible();
  await page.locator('[data-iron-group="trial"]').click();
  const rows = parseCsvRows(await captureIronCsv(page));
  expect(rows[0]).toEqual([
    "大区",
    "优质试驾率", "优质试驾率月环比", "优质试驾率周环比",
    "试驾录音回收率", "试驾录音回收率月环比", "试驾录音回收率周环比",
    "手车互联开口率", "手车互联开口率月环比", "手车互联开口率周环比",
    "离车泊入开口率", "离车泊入开口率月环比", "离车泊入开口率周环比"
  ]);
  expect(rows[0]).toHaveLength(13);
  expect(rows.length).toBe(3);
  expect(rows.map((row) => row[0])).toEqual(["大区", "大区1", "大区2"]);
  expect(rows[0]).not.toContain("邀约进店试驾提及率");
  expect(rows[0]).not.toContain("指标编码");
  expect(rows[0]).not.toContain("月同期值");
  expect(rows[0]).not.toContain("周同期来源状态");
});

test("打铁 CSV 扁平全量导出使用三阶段 raw 计算月周同期和非零环比", async ({ page }) => {
  const stores = makeDealerStores(20);
  const fixture = makeFixture({
    stores,
    ironRaw: stagedIronRaw(stores, { invite: 30, weekInvite: 25, trial: 40 }),
    ironMonthRaw: stagedIronRaw(stores, { invite: 20, weekInvite: 18, trial: 25 }),
    ironWeekRaw: stagedIronRaw(stores, { invite: 25, weekInvite: 21, trial: 35 })
  });
  await openIron(page, profiles.headquarters, fixture);
  await page.locator("#toggleAllDealersSales").click();
  await expect(page.locator("#storeTableTitle")).toHaveText("全部经销商打铁表现");
  await expect(page.locator("#ironMetricsTableBody [data-organization-row='X01'] .metric-value").first()).toHaveText("30.0%");

  const inviteRows = parseCsvRows(await captureIronCsv(page));
  expect(inviteRows).toHaveLength(21);
  expect(inviteRows[0]).toHaveLength(22);
  expect(inviteRows[0].slice(0, 7)).toEqual([
    "经销商名称",
    "邀约进店试驾提及率",
    "邀约进店试驾提及率月环比",
    "邀约进店试驾提及率周环比",
    "加微申请提及率",
    "加微申请提及率月环比",
    "加微申请提及率周环比"
  ]);
  expect(csvCell(inviteRows, "导出经销商01", "邀约进店试驾提及率")).toBe("30.0%");
  expect(csvCell(inviteRows, "导出经销商01", "邀约进店试驾提及率月环比")).toBe("'+10%");
  expect(csvCell(inviteRows, "导出经销商01", "邀约进店试驾提及率周环比")).toBe("'+5%");
  expect(inviteRows[0]).not.toContain("组织编码");
  expect(inviteRows[0]).not.toContain("指标编码");
  expect(inviteRows[0]).not.toContain("完整性");

  await page.locator('[data-iron-group="trial"]').click();
  const trialRows = parseCsvRows(await captureIronCsv(page));
  expect(trialRows).toHaveLength(21);
  expect(trialRows[0]).toHaveLength(13);
  expect(csvCell(trialRows, "导出经销商01", "优质试驾率")).toBe("40.0%");
  expect(csvCell(trialRows, "导出经销商01", "优质试驾率月环比")).toBe("'+15%");
  expect(csvCell(trialRows, "导出经销商01", "优质试驾率周环比")).toBe("'+5%");
});

test("打铁 CSV 下载层状态文案与页面语义一致", async ({ page }) => {
  const store = testStore({
    code: "STATE1",
    name: "状态门店",
    areaCode: "A1",
    area: "大区1",
    districtCode: "D1",
    district: "小区1"
  });
  const fixture = makeFixture({
    stores: [store],
    ironRaw: stateMatrixIronRaw(store),
    ironMonthRaw: stateMatrixIronRaw(store, { comparison: true }),
    ironWeekRaw: stateMatrixIronRaw(store, { comparison: true })
  });
  await openIron(page, profiles.district, fixture);
  await expect(page.locator("#storeTableTitle")).toHaveText("门店打铁表现");

  const rows = parseCsvRows(await captureIronCsv(page));
  expect(rows[0][0]).toBe("经销商名称");
  expect(csvCell(rows, "状态门店", "邀约进店试驾提及率")).toBe("0.0%");
  expect(csvCell(rows, "状态门店", "邀约进店试驾提及率月环比")).toBe("'--");
  expect(csvCell(rows, "状态门店", "邀约进店试驾提及率周环比")).toBe("'--");
  expect(csvCell(rows, "状态门店", "加微申请提及率")).toBe("'--");
  expect(csvCell(rows, "状态门店", "高意向低水平")).toBe("加载中");
  expect(csvCell(rows, "状态门店", "高意向低水平月环比")).toBe("加载中");
  expect(csvCell(rows, "状态门店", "高意向低水平周环比")).toBe("加载中");
  expect(csvCell(rows, "状态门店", "30分钟跟进率")).toBe("数据不完整");
  expect(csvCell(rows, "状态门店", "30分钟跟进率月环比")).toBe("加载失败");
  expect(csvCell(rows, "状态门店", "30分钟跟进率周环比")).toBe("加载失败");
});

test("打铁 CSV 导出中和外部字符串公式注入且保留RFC4180转义", async ({ page }) => {
  const maliciousStore = testStore({
    code: "\t=HYPERLINK(\"http://evil\")",
    name: "危险门店",
    areaCode: "@AREA",
    area: "  ＝SUM(1,2), \"大区\"\n第二行",
    districtCode: "-DIST",
    district: "普通小区"
  });
  const safeStore = testStore({ code: "S1", name: "普通门店", areaCode: "A1", area: "普通大区,含逗号\"引号\"", districtCode: "D1", district: "小区1" });
  await openIron(page, profiles.headquarters, makeFixture({ stores: [maliciousStore, safeStore], ironRaw: { ...ironRaw, inviteMentionRows: [] } }));
  const csv = await captureIronCsv(page);
  expect(csv).toContain('"\'＝SUM(1,2), ""大区""\n第二行"');
  expect(csv).toContain('"普通大区,含逗号""引号"""');
  const rows = parseCsvRows(csv);
  const malicious = csvRowByName(rows, "'＝SUM(1,2), \"大区\"\n第二行");
  expect(malicious).toBeTruthy();
  expect(csvCell(rows, "'＝SUM(1,2), \"大区\"\n第二行", "邀约进店试驾提及率")).toBe("'--");
  expect(rows.some((row) => row[0] === '普通大区,含逗号"引号"')).toBe(true);
});

test("大区、小区、销售总监和投资人入口沿用现有自动跳层", async ({ page }) => {
  for (const [profile, expected] of [
    [profiles.region, "district"],
    [profiles.district, "store"],
    [profiles.salesDirector, "store"],
    [profiles.investor, "store"]
  ]) {
    await openIron(page, profile);
    const state = await page.evaluate(() => window.__retailPcApp.getStateSnapshot());
    expect(state.viewLevel).toBe(expected);
    expect(state.activeStoreTab).toBe("iron");
  }
});
