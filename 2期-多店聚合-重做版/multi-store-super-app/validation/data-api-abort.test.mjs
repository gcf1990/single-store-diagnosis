import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadDataApi(fetchImpl) {
  const context = {
    fetch: fetchImpl,
    location: { hostname: "localhost", pathname: "/" },
    setTimeout,
    clearTimeout,
    AbortController,
    console: { warn() {}, error() {}, log() {} },
    window: { __IRON_METRICS_TEST__: true, AbortController }
  };
  vm.runInNewContext(await readFile(new URL("../vehicle-series.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(await readFile(new URL("../data-api.js", import.meta.url), "utf8"), context);
  return context.window.RegionDataApi;
}

function jsonResponse(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}

test("同筛选新 allRows 不复用首个 caller 的 pending abort，旧请求取消后新请求独立完成", async () => {
  let detailFetchCount = 0;
  let previewFetchCount = 0;
  const dataApi = await loadDataApi(async (url, init = {}) => {
    if (url === "/api/data-source/DS1") {
      detailFetchCount += 1;
      if (detailFetchCount === 1) {
        return new Promise((resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        });
      }
      return jsonResponse({
        response: {
          dsId: "DS1",
          fields: [
            { name: "品牌名称", fdType: "STRING" },
            { name: "经销商代码", fdType: "STRING" },
            { name: "日期", fdType: "DATE" }
          ]
        }
      });
    }
    if (url === "/api/data-source/DS1/preview-with-filter-async") {
      previewFetchCount += 1;
      return jsonResponse({ response: { taskId: "retry-task", status: "已提交", result: "处理中" } });
    }
    if (url === "/api/task/retry-task") {
      return jsonResponse({ response: { taskId: "retry-task", status: "FINISHED", result: { response: { value: "retry-file" } } } });
    }
    if (url === "/api/account/readPreviewFile") {
      return jsonResponse({
        response: {
          columns: [{ name: "经销商代码" }],
          preview: [["S1"]]
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const filters = [{ field: "品牌名称", type: "EQ", value: "MG" }];
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = dataApi.__transport.allRows("DS1", filters, 5000, { signal: firstController.signal });
  await Promise.resolve();
  const second = dataApi.__transport.allRows("DS1", filters, 5000, { signal: secondController.signal });
  firstController.abort(new Error("detail timeout"));
  const [firstResult, secondResult] = await Promise.allSettled([first, second]);

  assert.equal(firstResult.status, "rejected");
  assert.match(firstResult.reason.message, /detail timeout/);
  assert.equal(secondResult.status, "fulfilled");
  assert.equal(detailFetchCount, 2);
  assert.equal(previewFetchCount, 1);
  assert.equal(JSON.stringify(secondResult.value), JSON.stringify([{ "经销商代码": "S1" }]));
});
