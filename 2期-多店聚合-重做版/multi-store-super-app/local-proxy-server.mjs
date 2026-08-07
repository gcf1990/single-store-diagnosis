import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { homedir } from "node:os";

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const STATIC_ROOT = resolve(process.env.STATIC_ROOT || join(process.cwd(), "dist"));
const PROFILE = process.env.GUANCLI_PROFILE || "default";
const ONLINE_APP_URL = "https://rdata-pv.rauto.com/open-apps/q0844640cf6734877a3193d6/index.html";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

async function loadProfile() {
  const configPath = join(homedir(), "Library/Application Support/guancli/config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const profile = config.profiles?.[PROFILE];
  if (!profile?.base_url || !profile?.token) {
    throw new Error(`guancli profile '${PROFILE}' is missing base_url or token`);
  }
  return {
    baseUrl: profile.base_url.replace(/\/$/, ""),
    token: profile.token
  };
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(STATIC_ROOT, `.${normalized === "/" ? "/index.html" : normalized}`);
  return relative(STATIC_ROOT, candidate).startsWith("..") ? null : candidate;
}

function sendStatic(req, res) {
  const filePath = safeStaticPath(new URL(req.url, "http://localhost").pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const targetPath = existsSync(filePath) && statSync(filePath).isDirectory()
    ? join(filePath, "index.html")
    : filePath;

  if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": MIME[extname(targetPath)] || "application/octet-stream"
  });
  createReadStream(targetPath).pipe(res);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function proxyApi(req, res, profile) {
  const upstreamUrl = new URL(req.url, profile.baseUrl);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (["host", "connection", "content-length", "cookie", "origin", "referer"].includes(lower)) continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  headers.set("cookie", `uIdToken=${profile.token}`);
  headers.set("origin", profile.baseUrl);
  headers.set("referer", ONLINE_APP_URL);

  const method = req.method || "GET";
  const body = ["GET", "HEAD"].includes(method) ? undefined : await readBody(req);
  const upstream = await fetch(upstreamUrl, { method, headers, body, redirect: "manual" });

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["connection", "content-encoding", "content-length", "transfer-encoding"].includes(lower)) return;
    responseHeaders[key] = value;
  });

  res.writeHead(upstream.status, responseHeaders);
  if (method === "HEAD") {
    res.end();
    return;
  }
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

const profile = await loadProfile();

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      await proxyApi(req, res, profile);
      return;
    }
    sendStatic(req, res);
  } catch (error) {
    console.error(error.message);
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Proxy error");
  }
}).listen(PORT, HOST, () => {
  console.log(`Local app proxy listening on http://127.0.0.1:${PORT}/`);
  console.log(`Static root: ${STATIC_ROOT}`);
  console.log(`BI upstream: ${profile.baseUrl}`);
});
