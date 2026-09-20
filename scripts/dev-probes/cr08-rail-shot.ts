/* eslint-disable no-console */
// CR08 2.2: screenshots of the grouped rail (expanded, compact + flyout) in
// both locales. Requires the dev server.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", "admin@npc.qa");
  await page.fill("#password", "Nexus!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "rail-expanded-en.png") });
  // collapse a group, then compact the rail and open a flyout
  await page.click('[data-testid="rail-group-data"] button').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "rail-group-collapsed-en.png") });
  await page.click('[data-testid="rail-toggle"]');
  await page.waitForTimeout(600);
  await page.hover('button[data-testid="rail-group-knowledge"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "rail-compact-flyout-en.png") });
  // the state persisted: reload and check compact
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const expanded = await page.getAttribute('[data-testid="rail"]', "data-expanded");
  console.log("after reload data-expanded =", expanded);
  await page.click('[data-testid="rail-toggle"]');
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/ar/vault`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "rail-expanded-ar.png") });
  await page.click('[data-testid="rail-toggle"]');
  await page.waitForTimeout(600);
  await page.hover('button[data-testid="rail-group-people"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "rail-compact-flyout-ar.png") });
  await page.click('[data-testid="rail-toggle"]');
  await page.waitForTimeout(400);
  console.log("errors:", errors.length ? errors.join("\n") : "none");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
