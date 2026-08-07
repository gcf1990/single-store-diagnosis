import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../organization-scope.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const { resolveActualScope } = context.globalThis.OrganizationScope;

const stores = [
  { code: "S1", areaCode: "A1", area: "大区1", districtCode: "D1", district: "小区1" },
  { code: "S2", areaCode: "A1", area: "大区1", districtCode: "D2", district: "小区2" },
  { code: "S3", areaCode: "A2", area: "大区2", districtCode: "D3", district: "小区3" }
];

test("实际范围跨多大区时隐藏，唯一大区按小区数决定文案", () => {
  assert.equal(resolveActualScope({ stores }).text, "");
  assert.equal(resolveActualScope({ stores: stores.slice(0, 2) }).text, "大区1");
  assert.equal(resolveActualScope({ stores: [stores[0]] }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({ stores: [{ ...stores[0], district: "同名小区" }, { ...stores[1], district: "同名小区" }] }).text, "大区1");
});

test("只有代码时从有效数据唯一反查名称", () => {
  assert.equal(resolveActualScope({ params: { areaCode: "A1" }, stores: stores.slice(0, 2) }).text, "大区1");
  assert.equal(resolveActualScope({ params: { districtCode: "D1" }, stores: [stores[0]] }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({ params: { dealerCode: "S1" }, stores: [stores[0]] }).text, "大区1 - 小区1");
});

test("上游名称优先，手动下钻名称覆盖对应层级", () => {
  assert.equal(resolveActualScope({ params: { area: "上游大区", district: "上游小区" }, stores: [stores[0]] }).text, "上游大区 - 上游小区");
  assert.equal(resolveActualScope({
    params: { area: "上游大区", district: "上游小区" },
    drillPath: [{ level: "area", code: "A1", name: "下钻大区" }, { level: "district", code: "D1", name: "下钻小区" }],
    stores
  }).text, "下钻大区 - 下钻小区");
});

test("当前数据空时可从有效经销商集合反查", () => {
  assert.equal(resolveActualScope({ params: { districtCode: "D1" }, fallbackStores: [stores[0]] }).text, "大区1 - 小区1");
});

test("通用占位名称不泄露，有代码时继续从全量数据反查", () => {
  assert.equal(resolveActualScope({ params: { area: "大区", areaCode: "A1" }, stores }).text, "大区1");
  assert.equal(resolveActualScope({ params: { area: "总部-门店", areaCode: "A1" }, stores }).text, "大区1");
  assert.equal(resolveActualScope({ params: { area: "未知大区" }, stores }).text, "");
  assert.equal(resolveActualScope({ params: { area: "大区" }, stores }).text, "");
});

test("纯未知占位不泄露，能唯一反查时输出真实范围", () => {
  assert.equal(resolveActualScope({ params: { area: "未知" }, stores: [stores[0]] }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({ params: { district: "未知" }, stores: [stores[0]] }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({ params: { area: "未知组织" }, stores }).text, "");
  assert.equal(resolveActualScope({ params: { area: "未知", district: "未知" }, stores }).text, "");
});

test("手动路径占位名称不采信，路径代码优先反查", () => {
  assert.equal(resolveActualScope({
    params: { areaCode: "A2" },
    drillPath: [{ level: "area", code: "A1", name: "大区" }],
    stores
  }).text, "大区1");
  assert.equal(resolveActualScope({
    drillPath: [{ level: "area", code: "A1", name: "未知大区" }, { level: "district", code: "D1", name: "小区" }],
    stores
  }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({
    drillPath: [{ level: "area", code: "A1", name: "未知" }, { level: "district", code: "D1", name: "未知" }],
    stores
  }).text, "大区1 - 小区1");
});

test("经销商代码在全量 fallback 中精确缩小，不存在时隐藏", () => {
  assert.equal(resolveActualScope({ params: { dealerCode: "S1" }, fallbackStores: stores }).text, "大区1 - 小区1");
  assert.equal(resolveActualScope({ params: { dealerCode: "NOT_FOUND" }, fallbackStores: stores }).text, "");
});
