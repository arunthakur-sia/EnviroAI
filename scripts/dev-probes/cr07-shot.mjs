// Quick screenshot helper: node scripts/dev-probes/cr07-shot.mjs <urlPath> <name> [fullPage]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const [, , urlPath = "/en/organisation", name = "shot", full = "0"] = process.argv;
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr07");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("PAGE ERROR:", m.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", String(e).slice(0, 400)));

await page.goto(BASE + "/en/login");
await page.fill("#email", "admin@npc.qa");
await page.fill("#password", "Nexus!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home", { timeout: 60000 });

const res = await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 90000 });
console.log("status:", res?.status());
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => console.log("(network still busy)"));
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full === "1" });
console.log("saved", name + ".png");
await browser.close();
