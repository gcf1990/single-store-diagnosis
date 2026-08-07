(function () {
  async function waitForPageReady() {
    if (document.fonts?.ready) await document.fonts.ready;
    const pendingImages = Array.from(document.images).filter((img) => !img.complete);
    await Promise.all(pendingImages.map((img) => new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    })));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function readStyles() {
    const paths = ["./styles.css", "./components.css", "./visual-sync.css"];
    const css = await Promise.all(paths.map((path) => fetch(path).then((res) => res.text()).catch(() => "")));
    return css.join("\n");
  }

  async function captureCurrentPageAsPng() {
    await waitForPageReady();
    const root = document.getElementById("captureRoot");
    const width = Math.ceil(root.scrollWidth);
    const height = Math.ceil(root.scrollHeight);
    try {
      return await captureDomAsPng(root, width, height);
    } catch (error) {
      return captureSummaryAsPng(root, width, height);
    }
  }

  async function captureDomAsPng(root, width, height) {
    const clone = root.cloneNode(true);
    clone.style.width = `${width}px`;
    const css = await readStyles();
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
      `<foreignObject width="100%" height="100%">`,
      `<div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${clone.outerHTML}</div>`,
      `</foreignObject></svg>`
    ].join("");
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("截图渲染失败"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return { dataUrl: canvas.toDataURL("image/png"), width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function captureSummaryAsPng(root, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const styles = getComputedStyle(root);
    const bg = styles.getPropertyValue("--bg").trim() || "#f8f9ff";
    const card = styles.getPropertyValue("--card").trim() || "#ffffff";
    const line = styles.getPropertyValue("--line").trim() || "#d9e2f2";
    const text = styles.getPropertyValue("--text").trim() || "#0b1c30";
    const muted = styles.getPropertyValue("--muted").trim() || "#5f6f85";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    drawText(ctx, "零售过程 · 多店销售诊断工作台", 32, 46, 28, text, "bold");
    const filterText = Array.from(document.querySelectorAll(".filter-pill")).map((item) => item.textContent.replace(/\s+/g, " "));
    const seriesText = document.getElementById("vehicleSeriesTrigger")?.textContent?.replace(/\s+/g, " ").trim();
    if (seriesText) filterText.push(seriesText);
    drawText(ctx, filterText.join("   "), 32, 82, 14, muted, "bold");
    let y = 118;
    y = drawPanel(ctx, 24, y, width - 48, 210, card, line, () => {
      drawText(ctx, document.getElementById("scopeTitle")?.textContent || "当前区域总览", 44, y + 36, 22, text, "bold");
      const metrics = Array.from(document.querySelectorAll(".metric-card")).slice(0, 8);
      metrics.forEach((node, index) => {
        const x = 44 + index * ((width - 96) / 8);
        drawText(ctx, node.querySelector(".metric-label")?.textContent || "", x, y + 78, 13, muted, "bold");
        drawText(ctx, node.querySelector(".metric-value")?.innerText.replace(/\n/g, "") || "", x, y + 122, 25, text, "bold");
        drawText(ctx, node.querySelector(".delta")?.textContent || "", x, y + 153, 12, muted, "bold");
      });
    });
    y = drawPanel(ctx, 24, y + 16, width - 48, Math.max(360, height - y - 60), card, line, () => {
      drawText(ctx, "问题门店列表", 44, y + 38, 22, text, "bold");
      const rows = Array.from(document.querySelectorAll("[data-store-code]")).slice(0, 12);
      rows.forEach((row, index) => {
        const top = y + 74 + index * 34;
        drawText(ctx, row.querySelector(".store-name strong")?.textContent || "", 44, top, 14, text, "bold");
        drawText(ctx, row.innerText.split("\n").filter(Boolean).slice(4, 9).join("  "), 390, top, 12, muted, "bold");
      });
    });
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  }

  function drawPanel(ctx, x, y, width, height, card, line, drawContent) {
    ctx.fillStyle = card;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    drawContent();
    return y + height;
  }

  function drawText(ctx, value, x, y, size, color, weight) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.fillText(String(value).slice(0, 96), x, y);
  }

  window.bindRetailCaptureProtocol = function bindRetailCaptureProtocol() {
    const allowedOrigins = new Set([
      window.location.origin,
      "http://localhost:8000",
      "http://localhost:4173",
      "http://localhost:5173",
      "https://rdata-pv.rauto.com"
    ]);
    window.addEventListener("message", async (event) => {
      if (!allowedOrigins.has(event.origin)) return;
      if (event.data?.type !== "RETAIL_CAPTURE_REQUEST") return;
      const requestId = event.data.requestId || "";
      try {
        if (!requestId) throw new Error("缺少 requestId");
        const image = await withTimeout(captureCurrentPageAsPng(), 10000);
        event.source?.postMessage({
          type: "RETAIL_CAPTURE_RESPONSE",
          requestId,
          image: { mimeType: "image/png", dataUrl: image.dataUrl },
          width: image.width,
          height: image.height
        }, event.origin);
      } catch (error) {
        event.source?.postMessage({
          type: "RETAIL_CAPTURE_RESPONSE",
          requestId,
          error: error instanceof Error ? error.message : String(error)
        }, event.origin);
      }
    });
  };

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("截图超时：零售过程页面仍在渲染中")), ms))
    ]);
  }
})();
