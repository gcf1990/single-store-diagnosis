import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const nationalScopeSource = await readFile(new URL("../national-scope.js", import.meta.url), "utf8");
const filterApiSource = await readFile(new URL("../filter-api.js", import.meta.url), "utf8");
const window = {};
const context = { window, location: { hostname: "localhost", pathname: "/" }, fetch: async () => { throw new Error("契约测试不应请求网络"); } };
vm.runInNewContext(nationalScopeSource, context);
vm.runInNewContext(filterApiSource, context);

const config = window.RetailNationalScope.CONFIG;
const filterValidDealers = window.RegionFilterApi.filterValidDealers;

function row(brand, code, areaCode, area) {
  return {
    "品牌名称": brand,
    "经销商代码": code,
    "经销商简称": `门店${code}`,
    "品牌代码": brand,
    "大区代码": areaCode,
    "大区简称": area,
    "小区代码": `D-${code}`,
    "小区简称": `小区${code}`,
    "是否二网经销商": "否",
    "官网显示名称": `官网${code}`
  };
}

test("权威范围配置包含可审计来源、有效期和两品牌完整大区集合", () => {
  assert.equal(config.sourceDsId, "a310ff90fddff4b6283841c6");
  assert.equal(config.sourceUpdatedAt, "2026-07-15 05:30:07+0800");
  assert.equal(config.validThrough, "2026-08-15");
  assert.deepEqual([...config.brands.MG.areaCodes], ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"]);
  assert.deepEqual([...config.brands["荣威"].areaCodes], ["SQR400", "SQRR30", "SQRW10", "SQRW20", "SQRW30", "SQRW40", "SQRW50", "SQRW60", "SQRW70"]);
  assert.equal(window.RetailNationalScope.isConfigFresh(config, "2026-08-15T23:59:59+08:00"), true);
  assert.equal(window.RetailNationalScope.isConfigFresh(config, "2026-08-16T00:00:00+08:00"), false);
});

test("MG 有效经销商白名单只保留权威 7 区并排除其它", () => {
  const rows = config.brands.MG.areaCodes.map((areaCode, index) => row("MG", `MG${index + 1}`, areaCode, `MG大区${index + 1}`));
  rows.push(row("MG", "OTHER", "OTHER", "其它"));
  rows.push(row("MG", "OTHER-NAME", config.brands.MG.areaCodes[0], "其它"));
  const dealers = filterValidDealers(rows, { brand: "MG" });
  assert.equal(dealers.length, 7);
  assert.deepEqual(new Set(dealers.map((dealer) => dealer.areaCode)), new Set(config.brands.MG.areaCodes));
  assert.equal(dealers.some((dealer) => dealer.area === "其它"), false);
});

test("荣威保留权威 9 区，未配置品牌保持原有白名单逻辑", () => {
  const roeweRows = config.brands["荣威"].areaCodes.map((areaCode, index) => row("荣威", `RW${index + 1}`, areaCode, `荣威大区${index + 1}`));
  assert.equal(filterValidDealers(roeweRows, { brand: "荣威" }).length, 9);
  const unknown = row("未配置品牌", "U1", "OTHER", "其它");
  assert.equal(filterValidDealers([unknown], { brand: "未配置品牌" }).length, 1);
});
