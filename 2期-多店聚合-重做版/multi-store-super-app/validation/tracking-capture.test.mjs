import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const vehicleSeriesSource = await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8");
const trackingSource = await readFile(new URL("../tracking.js", import.meta.url), "utf8");
const captureSource = await readFile(new URL("../capture.js", import.meta.url), "utf8");

test("埋点 payload 和 GIO 使用稳定车系字符串与数量", () => {
  const gioCalls = [];
  const context = {
    window: {
      OrganizationView: { readPersonnelProfile: () => ({ profile: { luopan_id: "U1", luopan_name: "用户1" } }) },
      gio: (...args) => gioCalls.push(args)
    },
    Date: { now: () => 123456 }
  };
  vm.runInNewContext(vehicleSeriesSource, context);
  vm.runInNewContext(trackingSource, context);
  context.window.trackRetailView({ vehicleSeries: ["MG 4X", "全新MG4"], area: "大区1", district: "全部" }, [{ code: "S1" }], "全部");
  assert.equal(context.window.__retailGioEvent.vehicleSeries, "全新MG4、MG 4X");
  assert.equal(context.window.__retailGioEvent.vehicleSeriesCount, 2);
  assert.equal(gioCalls[0][2].vehicleSeries, "全新MG4、MG 4X");
  assert.equal(gioCalls[0][2].vehicleSeriesCount, "2");

  context.window.trackRetailView({ vehicleSeries: [], area: "全部", district: "全部" }, [{ code: "S1" }], "全部");
  assert.equal(context.window.__retailGioEvent.vehicleSeries, "全部车系");
  assert.equal(context.window.__retailGioEvent.vehicleSeriesCount, 0);
});

test("截图 fallback 摘要读取车系触发器文本", () => {
  assert.match(captureSource, /getElementById\("vehicleSeriesTrigger"\)/);
  assert.match(captureSource, /filterText\.push\(seriesText\)/);
});
