import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const nationalScopeSource = await readFile(new URL("../national-scope.js", import.meta.url), "utf8");
const source = await readFile(new URL("../organization-view.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(nationalScopeSource, context);
vm.runInNewContext(source, context);
const api = context.globalThis.OrganizationView;
const nationalScopeConfig = context.globalThis.RetailNationalScope.CONFIG;

function storage(value) {
  return { getItem: () => value };
}

function store(code, areaCode, districtCode, current, process = {}) {
  const areaNumber = areaCode.slice(-1);
  const districtNumber = districtCode.slice(-1);
  const empty = { leads: 0, arrivals: 0, drives: 0, orders: 0, retail: 0 };
  const aggregate = (value) => ({ total: value.total || 0, negative: value.negative || 0, rate: null, problems: value.problems || [] });
  return {
    code, name: `门店${code}`, areaCode, area: `大区${areaNumber}`, districtCode, district: `小区${districtNumber}`,
    current: { ...empty, ...current }, previous: { ...empty }, week: { ...empty },
    ip: aggregate(process.ip || {}), ipPrev: aggregate({}), ipWeek: aggregate({}),
    driveTag: aggregate(process.drive || {}), drivePrev: aggregate({}), driveWeek: aggregate({})
  };
}

test("人员画像解析覆盖五类角色并安全降级", () => {
  const cases = [
    [{ marketing_userType: 4, marketing_orgType: "MAC" }, "district"],
    [{ marketing_userType: "4", marketing_orgType: "rfs" }, "region"],
    [{ marketing_userType: 4, marketing_orgType: "HQ" }, "headquarters"],
    [{ marketing_userType: 2 }, "sales_director"],
    [{ marketing_userType: 6 }, "investor"]
  ];
  cases.forEach(([profile, role]) => {
    const parsed = api.readPersonnelProfile(storage(JSON.stringify(profile)));
    assert.equal(api.resolveRole(parsed).role, role);
  });
  assert.equal(api.resolveRole(api.readPersonnelProfile(storage("{"))).ok, false);
  assert.equal(api.resolveRole(api.readPersonnelProfile(storage(JSON.stringify({ marketing_userType: 4 })))).ok, false);
  [null, undefined, "", "  "].forEach((value) => {
    const result = api.resolveRole(api.readPersonnelProfile(storage(JSON.stringify({ marketing_userType: value }))));
    assert.deepEqual({ ok: result.ok, role: result.role }, { ok: true, role: "headquarters" });
  });
  [9, true, [], {}, false].forEach((value) => {
    assert.equal(api.resolveRole(api.readPersonnelProfile(storage(JSON.stringify({ marketing_userType: value, marketing_orgType: "HQ" })))).ok, false);
  });
  [null, [], {}, true, 123].forEach((value) => {
    assert.equal(api.resolveRole(api.readPersonnelProfile(storage(JSON.stringify({ marketing_userType: 4, marketing_orgType: value })))).ok, false);
  });
});

test("角色默认入口与上游具体筛选自动跳层", () => {
  assert.equal(api.resolveEntryLevel("headquarters", { area: "全部", district: "全部", store: "全部" }), "area");
  assert.equal(api.resolveEntryLevel("headquarters", { area: "华东大区", district: "全部", store: "全部" }), "district");
  assert.equal(api.resolveEntryLevel("headquarters", { area: "华东大区", district: "杭州小区", store: "全部" }), "store");
  assert.equal(api.resolveEntryLevel("region", { district: "全部", store: "全部" }), "district");
  assert.equal(api.resolveEntryLevel("region", { district: "杭州小区", store: "全部" }), "store");
  ["district", "sales_director", "investor"].forEach((role) => assert.equal(api.resolveEntryLevel(role, {}), "store"));
});

test("下钻和返回共用同一条路径且不越过入口", () => {
  const initial = api.createViewState({ ok: true, role: "headquarters" }, {});
  const district = api.drillDown(initial, { code: "A1", name: "大区1" });
  const stores = api.drillDown(district, { code: "D1", name: "小区1" });
  assert.equal(stores.viewLevel, "store");
  assert.equal(stores.drillPath.length, 2);
  assert.deepEqual(Array.from(api.drillBack(stores).drillPath, (item) => item.code), ["A1"]);
  assert.equal(api.drillBack(api.drillBack(stores)).viewLevel, "area");
  assert.equal(api.drillBack(initial), initial);
});

test("组织聚合先合计分子分母，不平均门店比例", () => {
  const stores = [
    store("S1", "A1", "D1", { leads: 40, arrivals: 8, drives: 4, orders: 2, retail: 1 }, { ip: { total: 10, negative: 2, problems: [{ name: "零钩子", count: 2, denominator: 10 }] } }),
    store("S2", "A1", "D1", { leads: 10, arrivals: 2, drives: 1, orders: 1, retail: 1 }, { ip: { total: 30, negative: 3, problems: [{ name: "零钩子", count: 3, denominator: 30 }] } })
  ];
  const [district] = api.aggregateStores(stores, "district");
  assert.deepEqual({ ...district.current }, { leads: 50, arrivals: 10, drives: 5, orders: 3, retail: 2 });
  assert.equal(api.rate(district.current.arrivals, district.current.leads), 20);
  assert.equal(district.ip.total, 40);
  assert.equal(district.ip.problems[0].denominator, 40);
  assert.equal(district.ip.problems[0].rate, 12.5);
});

test("未命中具体邀约问题的门店仍贡献IP总样本分母", () => {
  const hit = store("S1", "A1", "D1", { orders: 1 });
  const noProblemRow = store("S2", "A1", "D1", { orders: 1 });
  ["ip", "ipPrev", "ipWeek"].forEach((field) => {
    hit[field] = { total: 10, negative: 2, problems: [{ name: "零钩子", count: 2, denominator: 10 }] };
    noProblemRow[field] = { total: 30, negative: 0, problems: [] };
  });

  const [district] = api.aggregateStores([hit, noProblemRow], "district");
  ["ip", "ipPrev", "ipWeek"].forEach((field) => {
    assert.equal(district[field].problems[0].count, 2, `${field} 分子`);
    assert.equal(district[field].problems[0].denominator, 40, `${field} 分母`);
    assert.equal(district[field].problems[0].rate, 5, `${field} 比例`);
  });
});

test("试驾具体问题只累加显式提及分母", () => {
  const hit = store("S1", "A1", "D1", { orders: 1 });
  const noProblemRow = store("S2", "A1", "D1", { orders: 1 });
  ["driveTag", "drivePrev", "driveWeek"].forEach((field) => {
    hit[field] = { total: 10, negative: 2, problems: [{ name: "绕车介绍不足", count: 2, denominator: 10 }] };
    noProblemRow[field] = { total: 30, negative: 0, problems: [] };
  });

  const [missingProblemDistrict] = api.aggregateStores([hit, noProblemRow], "district");
  ["driveTag", "drivePrev", "driveWeek"].forEach((field) => {
    assert.equal(missingProblemDistrict[field].problems[0].denominator, 10, `${field} 缺失问题行分母`);
    assert.equal(missingProblemDistrict[field].problems[0].rate, 20, `${field} 缺失问题行比例`);
  });

  ["driveTag", "drivePrev", "driveWeek"].forEach((field) => {
    noProblemRow[field] = { total: 30, negative: 3, problems: [{ name: "绕车介绍不足", count: 3, denominator: 30 }] };
  });
  const [explicitDistrict] = api.aggregateStores([hit, noProblemRow], "district");
  ["driveTag", "drivePrev", "driveWeek"].forEach((field) => {
    assert.equal(explicitDistrict[field].problems[0].denominator, 40, `${field} 显式问题分母求和`);
    assert.equal(explicitDistrict[field].problems[0].rate, 12.5, `${field} 显式问题比例`);
  });
});

test("稳定唯一排名为 1,2,3，占比使用对应层级总量", () => {
  const stores = [
    store("S1", "A1", "D1", { orders: 7, retail: 3 }),
    store("S2", "A1", "D1", { orders: 7, retail: 2 }),
    store("S3", "A1", "D1", { orders: 4, retail: 1 })
  ];
  const ranks = api.rankRows(stores.map((item) => ({ ...item, level: "store" })), "orders", "store", true);
  assert.equal(ranks.get("S1").text, "1/3");
  assert.equal(ranks.get("S2").text, "2/3");
  assert.equal(ranks.get("S3").text, "3/3");
  assert.equal(ranks.get("S1").share, 7 / 18 * 100);
});

test("订单和零售在大区、小区、经销商三级同值时按组织代码稳定唯一拆分", () => {
  const stores = [
    store("S3", "A2", "D3", { orders: 10, retail: 4 }),
    store("S2", "A1", "D2", { orders: 5, retail: 4 }),
    store("S1", "A1", "D1", { orders: 5, retail: 4 }),
    store("S4", "A2", "D4", { orders: 0, retail: 4 })
  ];

  const areaRows = api.buildViewRows({ displayStores: stores, level: "area", nationalComplete: true });
  assert.deepEqual(Array.from(areaRows, (row) => [row.code, row.orderRank, row.retailRank]), [
    ["A1", "1/2", "1/2"], ["A2", "2/2", "2/2"]
  ]);

  const districtRows = api.buildViewRows({ displayStores: stores, level: "district" });
  assert.deepEqual(["D1", "D2", "D3", "D4"].map((code) => {
    const row = districtRows.find((item) => item.code === code);
    return [row.code, row.orderRank, row.retailRank];
  }), [["D1", "1/2", "1/2"], ["D2", "2/2", "2/2"], ["D3", "1/2", "1/2"], ["D4", "2/2", "2/2"]]);

  const storeRows = api.buildViewRows({ displayStores: stores.slice().reverse(), level: "store", rankScope: "portfolio" });
  assert.deepEqual(Array.from(storeRows, (row) => [row.code, row.orderRank, row.retailRank]), [
    ["S3", "1/4", "3/4"], ["S1", "2/4", "1/4"], ["S2", "3/4", "2/4"], ["S4", "4/4", "4/4"]
  ]);
});

test("全 0 和 53 对象末尾同值仍输出连续唯一排名到 n/n", () => {
  const zeroRows = ["S3", "S1", "S2"].map((code) => store(code, "A1", "D1", { orders: 0, retail: 0 }));
  const zeroRanks = api.rankRows(zeroRows.map((item) => ({ ...item, level: "store" })), "orders", "store", true);
  assert.deepEqual(["S1", "S2", "S3"].map((code) => zeroRanks.get(code).text), ["1/3", "2/3", "3/3"]);
  assert.equal(zeroRanks.get("S1").share, null);

  const rows53 = Array.from({ length: 53 }, (_, index) => {
    const rankIndex = index + 1;
    const orders = rankIndex <= 45 ? 100 - rankIndex : 0;
    return store(`S${String(rankIndex).padStart(2, "0")}`, "A1", "D1", { orders, retail: orders });
  }).reverse();
  const ranks53 = api.rankRows(rows53.map((item) => ({ ...item, level: "store" })), "orders", "store", true);
  assert.deepEqual(["S46", "S47", "S48", "S49", "S50", "S51", "S52", "S53"].map((code) => ranks53.get(code).text), [
    "46/53", "47/53", "48/53", "49/53", "50/53", "51/53", "52/53", "53/53"
  ]);
});

test("投资人门店层订单和零售排名按全部有效门店统一计算", () => {
  const stores = [
    store("S1", "A1", "D1", { orders: 7, retail: 3 }),
    store("S2", "A1", "D1", { orders: 5, retail: 2 }),
    store("S3", "A1", "D2", { orders: 4, retail: 2 }),
    store("S4", "A2", "D3", { orders: 6, retail: 1 }),
    store("S5", "A2", "D3", { orders: 3, retail: 2 })
  ];

  const investorRows = api.buildViewRows({ displayStores: stores, level: "store", rankScope: "portfolio" });
  assert.deepEqual(Array.from(investorRows, (row) => [row.code, row.orderRank]), [
    ["S1", "1/5"], ["S4", "2/5"], ["S2", "3/5"], ["S3", "4/5"], ["S5", "5/5"]
  ]);
  assert.deepEqual(Array.from(investorRows, (row) => [row.code, row.retailRank]), [
    ["S1", "1/5"], ["S4", "5/5"], ["S2", "2/5"], ["S3", "3/5"], ["S5", "4/5"]
  ]);
  assert.equal(investorRows.find((row) => row.code === "S1").orderShare, 7 / 25 * 100);
  assert.equal(investorRows.find((row) => row.code === "S2").retailShare, 2 / 10 * 100);

  const defaultRows = api.buildViewRows({ displayStores: stores, level: "store" });
  assert.deepEqual(Array.from(defaultRows, (row) => [row.code, row.orderRank]), [
    ["S1", "1/2"], ["S4", "1/2"], ["S2", "2/2"], ["S3", "1/1"], ["S5", "2/2"]
  ]);
  assert.equal(defaultRows.find((row) => row.code === "S1").orderShare, 7 / 12 * 100);
  assert.equal(defaultRows.find((row) => row.code === "S4").retailShare, 1 / 3 * 100);
});

test("投资人门店层过滤后仅剩单店时排名和占比不被外部集合扩大", () => {
  const [singleStore] = [
    store("S1", "A1", "D1", { orders: 7, retail: 3 })
  ];

  const rows = api.buildViewRows({ displayStores: [singleStore], peerStores: [singleStore], level: "store", rankScope: "portfolio" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orderRank, "1/1");
  assert.equal(rows[0].orderShare, 100);
  assert.equal(rows[0].retailRank, "1/1");
  assert.equal(rows[0].retailShare, 100);
});

test("全部经销商扁平模式保留下钻路径并在路径内跨小区统一排名", () => {
  const stores = [
    store("S1", "A1", "D1", { orders: 10, retail: 5 }),
    store("S2", "A1", "D1", { orders: 7, retail: 3 }),
    store("S3", "A1", "D2", { orders: 10, retail: 2 }),
    store("S4", "A2", "D3", { orders: 99, retail: 80 })
  ];

  const areaFlatRows = api.buildViewRows({
    displayStores: stores,
    peerStores: stores,
    level: "store",
    drillPath: [{ level: "area", code: "A1", name: "大区1" }],
    rankScope: "portfolio"
  });

  assert.deepEqual(Array.from(areaFlatRows, (row) => row.code), ["S1", "S3", "S2"]);
  assert.deepEqual(Array.from(areaFlatRows, (row) => [row.code, row.orderRank]), [
    ["S1", "1/3"], ["S3", "2/3"], ["S2", "3/3"]
  ]);
  assert.deepEqual(Array.from(areaFlatRows, (row) => [row.code, row.retailRank]), [
    ["S1", "1/3"], ["S3", "3/3"], ["S2", "2/3"]
  ]);
  assert.equal(areaFlatRows.find((row) => row.code === "S4"), undefined);
  assert.equal(areaFlatRows.find((row) => row.code === "S1").orderShare, 10 / 27 * 100);

  const districtFlatRows = api.buildViewRows({
    displayStores: stores,
    peerStores: stores,
    level: "store",
    drillPath: [{ level: "area", code: "A1", name: "大区1" }, { level: "district", code: "D1", name: "小区1" }],
    rankScope: "portfolio"
  });
  assert.deepEqual(Array.from(districtFlatRows, (row) => row.code), ["S1", "S2"]);
  assert.equal(districtFlatRows.find((row) => row.code === "S1").orderRank, "1/2");
  assert.equal(districtFlatRows.find((row) => row.code === "S2").orderShare, 7 / 17 * 100);
});

test("大区清单按名称数字前缀升序，无数字前缀按代码升序置后", () => {
  const areas = [
    ["A06", "6东南区"], ["A02", "2华中区"], ["A07", "7中南区"], ["A04", "4苏皖区"],
    ["A01", "1南部区"], ["A03", "3西部区"], ["Z02", "北部区"], ["Z01", "东部区"]
  ];
  const stores = areas.map(([areaCode, area], index) => ({
    ...store(`S${index}`, areaCode, `D${index}`, { orders: index + 1 }),
    areaCode,
    area
  }));

  const rows = api.buildViewRows({ displayStores: stores, level: "area", nationalComplete: true });
  assert.deepEqual(Array.from(rows, (row) => row.name), ["1南部区", "2华中区", "3西部区", "4苏皖区", "6东南区", "7中南区", "东部区", "北部区"]);
});

test("小区和经销商清单按订单降序，同订单按组织代码升序", () => {
  const stores = [
    store("S100", "A1", "D100", { orders: 100 }),
    store("S60B", "A1", "D60B", { orders: 60 }),
    store("S20", "A1", "D20", { orders: 20 }),
    store("S60A", "A1", "D60A", { orders: 60 })
  ];

  const districtRows = api.buildViewRows({ displayStores: stores, level: "district" });
  const storeRows = api.buildViewRows({ displayStores: stores, level: "store" });
  assert.deepEqual(Array.from(districtRows, (row) => row.code), ["D100", "D60A", "D60B", "D20"]);
  assert.deepEqual(Array.from(storeRows, (row) => row.code), ["S100", "S60A", "S60B", "S20"]);
});

test("buildViewRows 排序不改变订单排名和占比口径", () => {
  const stores = [
    store("S2", "A1", "D1", { orders: 7 }),
    store("S1", "A1", "D1", { orders: 7 }),
    store("S3", "A1", "D1", { orders: 4 })
  ];

  const rows = api.buildViewRows({ displayStores: stores, level: "store" });
  assert.deepEqual(Array.from(rows, (row) => [row.code, row.orderRank]), [["S1", "1/3"], ["S2", "2/3"], ["S3", "3/3"]]);
  assert.equal(rows.find((row) => row.code === "S1").orderShare, 7 / 18 * 100);
  assert.equal(rows.find((row) => row.code === "S3").orderShare, 4 / 18 * 100);
});

test("输入乱序不影响同值唯一排名结果", () => {
  const rows = [
    store("S9", "A1", "D1", { orders: 5, retail: 1 }),
    store("S1", "A1", "D1", { orders: 5, retail: 1 }),
    store("S5", "A1", "D1", { orders: 5, retail: 1 }),
    store("S3", "A1", "D1", { orders: 4, retail: 1 })
  ];
  const first = api.rankRows(rows.map((item) => ({ ...item, level: "store" })), "orders", "store", true);
  const second = api.rankRows(rows.slice().reverse().map((item) => ({ ...item, level: "store" })), "orders", "store", true);
  const expected = [["S1", "1/4"], ["S5", "2/4"], ["S9", "3/4"], ["S3", "4/4"]];
  assert.deepEqual(expected.map(([code]) => [code, first.get(code).text]), expected);
  assert.deepEqual(expected.map(([code]) => [code, second.get(code).text]), expected);
});

test("全国完整性不可证时大区排名和占比不可用", () => {
  const stores = [store("S1", "A1", "D1", { orders: 5 }), store("S2", "A2", "D2", { orders: 3 })];
  const rows = api.buildViewRows({ displayStores: stores, level: "area", nationalComplete: false });
  assert.equal(rows[0].orderRank, "--");
  assert.equal(rows[0].orderShare, null);
  assert.equal(rows[0].issue, "排名不可用");
  assert.doesNotMatch(rows[0].breakpoint, /全国第\d/);
});

test("仅有显式全国完整性证据才生成大区全国排名", () => {
  const stores = [store("S1", "A1", "D1", { orders: 5 }), store("S2", "A2", "D2", { orders: 3 })];
  const degraded = api.buildViewRows({ displayStores: stores, level: "area" });
  const complete = api.buildViewRows({ displayStores: stores, level: "area", nationalComplete: true });
  assert.equal(degraded[0].orderRank, "--");
  assert.match(complete[0].orderRank, /^[12]\/2$/);
});

test("组织诊断文案使用当前层级比较范围", () => {
  const stores = [
    store("S1", "A1", "D1", { leads: 100, arrivals: 20, orders: 10 }),
    store("S2", "A1", "D2", { leads: 10, arrivals: 1, orders: 0 })
  ];
  const rows = api.buildViewRows({ displayStores: stores, level: "district" });
  const weak = rows.find((row) => row.code === "D2");
  assert.match(weak.breakpoint, /大区第2\/2/);
  assert.doesNotMatch(weak.breakpoint, /小区第/);
});

test("组织诊断依次命中结果低分位、环比下滑和过程负向 fallback", () => {
  const lowRows = [
    store("S1", "A1", "D1", { leads: 100, arrivals: 20, drives: 10, orders: 10 }),
    store("S2", "A1", "D2", { leads: 10, arrivals: 2, drives: 1, orders: 1 })
  ];
  assert.match(api.diagnoseRows(api.aggregateStores(lowRows, "district"), "district").get("D2").resultBreakpoint, /大区第2\/2/);

  const declineRows = [
    store("S1", "A1", "D1", { leads: 100, arrivals: 20, drives: 10, orders: 10 }),
    store("S2", "A1", "D2", { leads: 100, arrivals: 20, drives: 10, orders: 10 })
  ];
  declineRows[0].previous = { leads: 200, arrivals: 40, drives: 20, orders: 20, retail: 0 };
  declineRows[1].previous = { leads: 100, arrivals: 20, drives: 10, orders: 10, retail: 0 };
  assert.match(api.diagnoseRows(api.aggregateStores(declineRows, "district"), "district").get("D1").resultBreakpoint, /环比-50\.0%/);

  const processRows = [
    store("S1", "A1", "D1", { leads: 100, arrivals: 20, drives: 10, orders: 10 }, { ip: { total: 10, negative: 8 } }),
    store("S2", "A1", "D2", { leads: 100, arrivals: 20, drives: 10, orders: 10 }, { ip: { total: 10, negative: 1 } })
  ];
  const processDiagnosis = api.diagnoseRows(api.aggregateStores(processRows, "district"), "district").get("D1");
  assert.equal(processDiagnosis.issueName, "邀约过程不足");
  assert.match(processDiagnosis.resultBreakpoint, /大区高位第1\/2/);
});

test("无分母率不参与排名，无任何样本显示断点 --", () => {
  const rows = [
    store("S1", "A1", "D1", { leads: 100, arrivals: 20, drives: 10, orders: 10 }, { ip: { total: 0, negative: 9 } }),
    store("S2", "A1", "D2", { leads: 100, arrivals: 20, drives: 10, orders: 10 }, { ip: { total: 10, negative: 1 } })
  ];
  assert.doesNotMatch(api.diagnoseRows(api.aggregateStores(rows, "district"), "district").get("D1").resultBreakpoint, /负向邀约占比/);
  const empty = api.diagnoseRows(api.aggregateStores([store("S3", "A1", "D3", {})], "district"), "district").get("D3");
  assert.equal(empty.issueName, "样本不足");
  assert.match(empty.resultBreakpoint, /断点：--/);
});

test("全国完整性要求 MG 权威 7 区与当期事实全部覆盖", () => {
  const roleResult = { ok: true, role: "headquarters" };
  const dealerEvidence = { source: "dealer-dimension-preview", sourceDsId: nationalScopeConfig.sourceDsId, hitLimit: false, complete: true };
  const salesEvidence = { source: "aggregate-sql", hitLimit: false, complete: true };
  const validDealers = nationalScopeConfig.brands.MG.areaCodes.map((areaCode, index) => ({
    code: `MG${index + 1}`, areaCode, area: `MG大区${index + 1}`, districtCode: `D${index + 1}`, district: `小区${index + 1}`
  }));
  const salesRows = validDealers.map((dealer) => ({ "经销商代码": dealer.code }));
  const evidence = {
    roleResult,
    params: { brand: "MG", area: "全部", district: "全部", store: "全部" },
    dealerEvidence,
    salesEvidence,
    validDealers,
    salesRows,
    nationalScopeConfig,
    currentDate: "2026-07-15T00:00:00+08:00"
  };
  assert.equal(api.evaluateNationalScopeEvidence(evidence), true);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, nationalScopeConfig: undefined }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, dealerEvidence: { ...dealerEvidence, sourceDsId: "wrong-ds" } }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, params: { areaCode: "A1" } }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, dealerEvidence: { ...dealerEvidence, hitLimit: true, complete: false } }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, salesEvidence: { ...salesEvidence, source: "fallback", complete: false } }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, salesRows: salesRows.slice(0, 6) }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, validDealers: validDealers.slice(0, 6), salesRows: salesRows.slice(0, 6) }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, validDealers: [{ ...validDealers[0], districtCode: "" }] }), false);
  assert.equal(api.evaluateNationalScopeEvidence({
    ...evidence,
    validDealers: [...validDealers, { code: "OTHER", areaCode: "OTHER", area: "其它", districtCode: "DO", district: "其它" }]
  }), false);
});

test("荣威权威 9 区可证，未配置品牌与过期配置不可证", () => {
  const dealers = nationalScopeConfig.brands["荣威"].areaCodes.map((areaCode, index) => ({
    code: `RW${index + 1}`, areaCode, area: `荣威大区${index + 1}`, districtCode: `RWD${index + 1}`, district: `荣威小区${index + 1}`
  }));
  const evidence = {
    roleResult: { ok: true, role: "headquarters" },
    params: { brand: "荣威", area: "全部", district: "全部", store: "全部" },
    dealerEvidence: { source: "dealer-dimension-preview", sourceDsId: nationalScopeConfig.sourceDsId, hitLimit: false, complete: true },
    salesEvidence: { source: "aggregate-sql", hitLimit: false, complete: true },
    validDealers: dealers,
    salesRows: dealers.map((dealer) => ({ "经销商代码": dealer.code })),
    nationalScopeConfig,
    currentDate: "2026-07-15T00:00:00+08:00"
  };
  assert.equal(api.evaluateNationalScopeEvidence(evidence), true);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, params: { ...evidence.params, brand: "未配置品牌" } }), false);
  assert.equal(api.evaluateNationalScopeEvidence({ ...evidence, currentDate: "2026-08-16T00:00:00+08:00" }), false);
});
