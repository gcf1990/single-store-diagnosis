import { readFile } from "node:fs/promises";
import vm from "node:vm";

export async function loadSmallOrderContext(context = null) {
  const runtime = context || { window: { __SMALL_ORDER_TEST__: true, location: { hostname: "localhost", pathname: "/" } }, globalThis: { __SMALL_ORDER_TEST__: true }, location: { hostname: "localhost", pathname: "/" } };
  for (const file of ["../small-order-config.js", "../small-order-contract.js", "../small-order-model.js", "../small-order-api.js"]) {
    vm.runInNewContext(await readFile(new URL(file, import.meta.url), "utf8"), runtime);
  }
  return runtime.window;
}

export const windowContext = await loadSmallOrderContext();
export const model = windowContext.SmallOrderModel;
export const config = windowContext.SmallOrderConfig.resolveSmallOrderConfig({ mg07SmallOrderTargetDsId: windowContext.SmallOrderConfig.TARGET_DS_ID });

export function targetRow(code, target, index, areaIndex = index % 7) {
  areaIndex %= 7;
  return { 区域: `RFS(MG品牌${areaIndex + 1}测试区-负责人)`, 省份: "江苏", 城市: "南京", MAC: `小区${areaIndex + 1}`, 一级经销商: code, 经销商简称: `门店${code}`, MG07小订目标: String(target) };
}

export function orgRow(code, areaIndex = 0, name = `门店${code}`) {
  return { brand_name: "MG", parent_dealer_code: code, parent_dealer_shortnm: name, dealer_code: code, dealer_shortnm: name, rfs_code: `A${areaIndex + 1}`, rfs_name: `RFS(MG品牌${areaIndex + 1}测试区-负责人)`, rfs_shortnm: `${areaIndex + 1}测试区`, mac_code: `D${areaIndex + 1}`, mac_name: `MAC(MG品牌${areaIndex + 1}测试区-小区${areaIndex + 1})`, mac_shortnm: `小区${areaIndex + 1}`, open_mec_stat_name: "开业", is_scd_net_dealer: "否" };
}

export function contractFixture() {
  const special = ["MQ207J", "MQ257T", "MQ576H", "MQ576K", "MQ877K", "MQ9331", "SQ2547", "SQ2881", "MQ856G"];
  const validPrimaryMisses = new Set(["MQ207J", "MQ257T", "MQ576H", "MQ576K", "MQ877K", "MQ9331", "SQ2547", "SQ2881"]);
  const areaCodes = ["SMG310", "SMG800", "SQR307", "SQR503", "SQR600", "SQR700", "SQR800"];
  const rows = special.map((code, index) => targetRow(code, { MQ257T: 45, MQ207J: 104, MQ576H: 0, MQ576K: 78, MQ877K: 44, MQ9331: 0, SQ2547: 0, SQ2881: 16, MQ856G: 0 }[code], index));
  for (let index = 0; rows.length < 403; index += 1) {
    const code = `T${String(index).padStart(3, "0")}`;
    const zeroCount = rows.filter((row) => row.MG07小订目标 === "0").length;
    rows.push(targetRow(code, zeroCount < 17 ? 0 : rows.length === 402 ? 74 : 78, rows.length));
  }
  rows.push({ 区域: "总计", 一级经销商: "", 经销商简称: "总计", MG07小订目标: "30001" });
  const orgRows = rows.filter((row) => row.一级经销商).map((row, index) => ({
    ...orgRow(row.一级经销商, index % 7, row.经销商简称),
    rfs_code: areaCodes[index % areaCodes.length],
    open_mec_stat_name: validPrimaryMisses.has(row.一级经销商) ? "预留" : "开业",
    web_display_name: row.经销商简称
  }));
  const mq257 = orgRows.findIndex((row) => row.parent_dealer_code === "MQ257T");
  orgRows.splice(mq257, 1, { ...orgRows[mq257], parent_dealer_code: "MQ256T", dealer_code: "MQ256T", parent_dealer_shortnm: "门店MQ257T", dealer_shortnm: "门店MQ257T" });
  return { rows, orgRows };
}
