import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../demo-fixture.js", import.meta.url), "utf8");

function loadDemoContext(location) {
  const writes = new Map();
  const context = {
    globalThis: {
      location,
      sessionStorage: {
        setItem: (key, value) => writes.set(key, value),
        getItem: (key) => writes.get(key)
      }
    },
    URLSearchParams
  };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(source, context);
  return { api: context.globalThis.RetailLocalDemoFixture, root: context.globalThis, writes };
}

test("本地显式 all-dealers Demo 注入总部画像和 7 大区样例数据", () => {
  const { api, root, writes } = loadDemoContext({ hostname: "127.0.0.1", search: "?demo=all-dealers" });
  assert.equal(api.isExplicitLocalAllDealersDemo({ hostname: "127.0.0.1", search: "?demo=all-dealers" }), true);
  assert.equal(root.__retailPcFixture.localDemo, "all-dealers");
  assert.equal(root.__retailPcFixture.validDealers.length, 62);
  assert.equal(new Set(root.__retailPcFixture.validDealers.map((dealer) => dealer.areaCode)).size, 7);
  assert.equal(new Set(root.__retailPcFixture.validDealers.map((dealer) => dealer.districtCode)).size, 21);
  assert.equal(root.__retailPcFixture.data.stores.length, 62);
  assert.ok(root.__retailPcFixture.data.salesCurrent.orders > 0);
  assert.ok(root.__retailPcFixture.data.ip.total > 0);
  assert.equal(root.__retailPcFixture.ironRaw.inviteMentionRows.length, 62);
  assert.equal(root.__retailPcFixture.ironRaw.dccRows.length, 62);
  assert.equal(root.__retailPcFixture.ironRaw.trialTalkRows.length, 124);
  assert.equal(root.__retailPcFixture.ironRaw.sourceStates.dcc.status, "success");
  assert.equal(root.__retailPcFixture.ironMonthRaw.sourceStates.trialTalk.complete, true);
  assert.equal(root.__retailPcFixture.ironWeekRaw.qualityTrialRows.length, 62);
  assert.equal(root.__retailPcFixture.smallOrderToday, "2026-08-05");
  assert.equal(root.__retailPcFixture.smallOrderRaw.status, "ready");
  assert.equal(root.__retailPcFixture.smallOrderRaw.targetRows.length, 62);
  assert.equal(root.__retailPcFixture.smallOrderRaw.organizationRows.length, 62);
  assert.equal(root.__retailPcFixture.smallOrderRaw.actualRows.length, 62);
  assert.equal(root.__retailPcFixture.smallOrderRaw.todayRows.length, 62);
  assert.ok(root.__retailPcFixture.smallOrderRaw.actualRows.some((row) => row.retained_small_order < 32));
  assert.ok(root.__retailPcFixture.smallOrderRaw.actualRows.some((row) => row.retained_small_order > 32));
  assert.match(writes.get(api.PROFILE_KEY), /"marketing_orgType":"HQ"/);
});

test("无 demo 参数、非本地主机或不允许 host 不激活", () => {
  [
    { hostname: "127.0.0.1", search: "" },
    { hostname: "localhost", search: "?demo=other" },
    { hostname: "192.168.1.10", search: "?demo=all-dealers" },
    { hostname: "example.com", search: "?demo=all-dealers" },
    { hostname: "", search: "?demo=all-dealers" }
  ].forEach((location) => {
    const { api, root, writes } = loadDemoContext(location);
    assert.equal(api.isExplicitLocalAllDealersDemo(location), false);
    assert.equal(root.__retailPcFixture, undefined);
    assert.equal(writes.size, 0);
  });
});

test("外链优化 01/02 通过 file 协议直接打开时自动注入完整演示数据", () => {
  ["外链优化-01.html", "外链优化-02.html"].forEach((file) => {
    const location = { protocol: "file:", hostname: "", pathname: `/本地演示/${file}`, search: "" };
    const { api, root, writes } = loadDemoContext(location);
    assert.equal(api.isExplicitLocalAllDealersDemo(location), true);
    assert.equal(root.__retailPcFixture.validDealers.length, 62);
    assert.equal(new Set(root.__retailPcFixture.validDealers.map((dealer) => dealer.areaCode)).size, 7);
    assert.match(writes.get(api.PROFILE_KEY), /"marketing_orgType":"HQ"/);
  });
});

test("外链优化 01/02 通过本地服务打开且不带 demo 参数时仍注入演示数据", () => {
  ["外链优化-01.html", "外链优化-02.html"].forEach((file) => {
    const location = { protocol: "http:", hostname: "127.0.0.1", pathname: `/${file}`, search: "" };
    const { api, root } = loadDemoContext(location);
    assert.equal(api.isExplicitLocalAllDealersDemo(location), true);
    assert.equal(root.__retailPcFixture.validDealers.length, 62);
  });
});
