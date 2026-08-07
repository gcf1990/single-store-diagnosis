import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const appUrl = "https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/";
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const hrefs = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);

assert.ok(hrefs.length > 0, "dist/index.html 未找到 CSS stylesheet href");
hrefs.forEach((href) => {
  assert.ok(href.startsWith("./assets/"), `CSS href 必须以 ./assets/ 开头，实际为 ${href}`);
  assert.ok(!href.startsWith("/assets/"), `CSS href 禁止使用 /assets/，实际为 ${href}`);
  const resolved = new URL(href, appUrl);
  assert.equal(resolved.origin, new URL(appUrl).origin, `CSS URL origin 不一致：${resolved.href}`);
  assert.ok(resolved.pathname.startsWith("/open-apps/q0844640cf6734877a3193d6/assets/"), `CSS URL 必须留在 q084 App 子路径，实际为 ${resolved.href}`);
});

await Promise.all(hrefs.map(async (href) => {
  const assetPath = href.replace(/^\.\//, "");
  const asset = await stat(new URL(`../dist/${assetPath}`, import.meta.url));
  assert.ok(asset.isFile(), `CSS 资源必须是文件：${href}`);
  assert.ok(asset.size > 0, `CSS 资源不能为空：${href}`);
}));
