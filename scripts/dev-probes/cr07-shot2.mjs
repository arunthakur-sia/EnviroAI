// Screenshot with a click sequence: node cr07-shot2.mjs <path> <name> <selector1,selector2,...>
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const [, , urlPath, name, clicks = "", full = "1"] = process.argv;
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr07");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", String(e).slice(0, 300)));
await page.goto(BASE + "/en/login");
await page.fill("#email", "admin@npc.qa");
await page.fill("#password", "Nexus!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home", { timeout: 60000 });
const res = await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 90000 });
console.log("status:", res?.status());
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
for (const sel of clicks.split(",").filter(Boolean)) {
  const ok = await page
    .locator(sel)
    .first()
    .click({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  console.log("click", sel, ok ? "ok" : "MISSED");
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full === "1" });
console.log("saved", name + ".png");
await browser.close();
