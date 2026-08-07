import { expect, test } from "@playwright/test";
import { makeFixture, profiles } from "./pc-role-drilldown-fixtures.js";
import { ironRaw } from "./iron-metrics-fixtures.js";

async function openIron(page, query = "") {
  await page.addInitScript(({ profileValue, fixtureValue }) => {
    sessionStorage.setItem("retail-cockpit:personnel-profile", JSON.stringify(profileValue));
    window.__retailPcFixture = fixtureValue;
  }, { profileValue: profiles.headquarters, fixtureValue: makeFixture({ ironRaw }) });
  await page.goto(`/${query ? `?${query}` : ""}`);
  await page.waitForFunction(() => typeof window.__retailPcApp?.getStateSnapshot === "function");
  await page.locator("#ironTab").click();
  await expect(page.locator("#ironMetricsTable")).toBeVisible({ timeout: 10_000 });
}

function contrastRatio(foreground, background) {
  const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (value) => rgb(value).map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("深色主题打铁百分比与空值正文对比度至少4.5:1", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openIron(page, "previewMode=dark");
  const samples = await page.locator(".iron-metric-cell .metric-value").evaluateAll((nodes) => nodes.map((node) => {
    let ancestor = node;
    let background = "rgb(255, 255, 255)";
    while (ancestor) {
      const candidate = getComputedStyle(ancestor).backgroundColor;
      if (candidate && !candidate.endsWith(", 0)") && candidate !== "transparent") {
        background = candidate;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    return { text: node.textContent.trim(), color: getComputedStyle(node).color, background };
  }));
  const percent = samples.find((sample) => sample.text.endsWith("%"));
  const empty = samples.find((sample) => sample.text === "--");
  expect(percent).toBeTruthy();
  expect(empty).toBeTruthy();
  expect(contrastRatio(percent.color, percent.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(empty.color, empty.background)).toBeGreaterThanOrEqual(4.5);
});

for (const theme of ["light", "dark"]) {
  for (const width of [1280, 1440]) {
    test(`打铁 ${theme} ${width}px 无页面级横向溢出并截图`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openIron(page, theme === "dark" ? "previewMode=dark" : "");
      const overflow = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        bodyWidth: document.body.scrollWidth
      }));
      expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport);
      expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport);
      const inviteLayout = await page.evaluate(() => {
        const groups = document.querySelector(".iron-metric-groups").getBoundingClientRect();
        const links = [...document.querySelectorAll(".iron-dashboard-link")];
        const [ironLink, qualityDriveLink] = links.map((node) => node.getBoundingClientRect());
        const table = document.querySelector("#ironMetricsTable").getBoundingClientRect();
        return {
          linkCount: links.length,
          linkTexts: links.map((node) => node.textContent.trim()),
          linksRightOfGroups: ironLink.left >= groups.right && qualityDriveLink.left >= ironLink.right,
          linksSameLine: links.every((node) => Math.abs(node.getBoundingClientRect().top - groups.top) <= 2),
          tableBelowToolbar: table.top > groups.bottom,
          linksFitText: links.every((node) => node.scrollWidth <= node.clientWidth + 1),
          groupsFitTabs: document.querySelector(".iron-metric-groups").scrollWidth <= document.querySelector(".iron-metric-groups").clientWidth + 1
        };
      });
      expect(inviteLayout).toEqual({
        linkCount: 2,
        linkTexts: ["打铁运营看板", "优质试驾看板"],
        linksRightOfGroups: true,
        linksSameLine: true,
        tableBelowToolbar: true,
        linksFitText: true,
        groupsFitTabs: true
      });
      await page.screenshot({ path: `validation/iron-metrics-${theme}-${width}x900.png`, fullPage: true });
      await page.locator('[data-iron-group="trial"]').click();
      const trialLayout = await page.evaluate(() => {
        const groups = document.querySelector(".iron-metric-groups").getBoundingClientRect();
        const links = [...document.querySelectorAll(".iron-dashboard-link")];
        const [ironLink, qualityDriveLink] = links.map((node) => node.getBoundingClientRect());
        const table = document.querySelector("#ironMetricsTable").getBoundingClientRect();
        return {
          href: document.querySelector("[data-iron-dashboard-link]").href,
          qualityDriveHref: document.querySelector("[data-quality-drive-dashboard-link]").href,
          linkTexts: links.map((node) => node.textContent.trim()),
          linksRightOfGroups: ironLink.left >= groups.right && qualityDriveLink.left >= ironLink.right,
          linksSameLine: links.every((node) => Math.abs(node.getBoundingClientRect().top - groups.top) <= 2),
          linksFitText: links.every((node) => node.scrollWidth <= node.clientWidth + 1),
          tableBelowToolbar: table.top > groups.bottom
        };
      });
      expect(trialLayout).toEqual({
        href: "https://rdata-pv.rauto.com/home/web-app/a3bc8c0765f8b419bb6a2845",
        qualityDriveHref: "https://rdata-pv.rauto.com/home/web-app/g8cb96bf254ae4cde97b7d0f?pgId=s9dade39bd42b474c9476216&id=LBiJMLcuHa",
        linkTexts: ["打铁运营看板", "优质试驾看板"],
        linksRightOfGroups: true,
        linksSameLine: true,
        linksFitText: true,
        tableBelowToolbar: true
      });
      await page.screenshot({ path: `validation/iron-metrics-trial-${theme}-${width}x900.png`, fullPage: true });
    });
  }
}
