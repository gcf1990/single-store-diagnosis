import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const appPath = "/open-apps/q0844640cf6734877a3193d6/";

function contentType(pathname) {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "text/html; charset=utf-8";
}

async function serveDistFile(pathname) {
  if (pathname === appPath || pathname === `${appPath}index.html`) {
    return { body: await readFile(new URL("../dist/index.html", import.meta.url)), type: "text/html; charset=utf-8" };
  }
  if (pathname.startsWith(`${appPath}assets/`)) {
    const name = pathname.slice(`${appPath}assets/`.length);
    return { body: await readFile(new URL(`../dist/assets/${name}`, import.meta.url)), type: contentType(pathname) };
  }
  const fileName = pathname.startsWith(appPath) ? pathname.slice(appPath.length) : "";
  if (fileName && !fileName.includes("..")) {
    return { body: await readFile(new URL(`../dist/${fileName}`, import.meta.url)), type: contentType(pathname) };
  }
  return null;
}

test("q084 open-app 子路径下 dist index 与 CSS 资源 200 且样式生效", async ({ page, request }) => {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
      const file = await serveDistFile(pathname);
      if (!file) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": file.type });
      res.end(file.body);
    } catch (error) {
      res.writeHead(404);
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const indexResponse = await request.get(`${base}${appPath}`);
    expect(indexResponse.status()).toBe(200);
    const html = await indexResponse.text();
    const href = html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
    expect(href).toMatch(/^\.\/assets\/.+\.css$/);

    const cssResponse = await request.get(new URL(href, `${base}${appPath}`).href);
    expect(cssResponse.status()).toBe(200);
    expect((await cssResponse.text()).length).toBeGreaterThan(1000);

    await page.goto(`${base}${appPath}`);
    const styles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const shell = getComputedStyle(document.querySelector(".app-shell"));
      const button = getComputedStyle(document.querySelector(".store-tab"));
      return {
        bodyBackground: body.backgroundColor,
        shellMinHeight: shell.minHeight,
        buttonBorderRadius: button.borderRadius,
        buttonPaddingLeft: button.paddingLeft
      };
    });
    expect(styles.bodyBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(Number.parseFloat(styles.shellMinHeight)).toBeGreaterThanOrEqual(800);
    expect(Number.parseFloat(styles.buttonBorderRadius)).toBeGreaterThan(0);
    expect(Number.parseFloat(styles.buttonPaddingLeft)).toBeGreaterThan(0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
