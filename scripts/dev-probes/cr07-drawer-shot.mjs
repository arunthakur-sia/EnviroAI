import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
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
await page.goto(BASE + "/en/council-strategy?g=g1", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.locator('[data-testid="io-card"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('[data-testid="output-card"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('[data-testid="project-card"]').first().click().catch(() => {});
console.log("waiting for the drawer content");
await page
  .locator('[data-testid="council-project-drawer"] h2, [data-testid="council-project-drawer"] h3')
  .first()
  .waitFor({ timeout: 25000 })
  .then(() => console.log("drawer content present"))
  .catch(() => console.log("drawer content NEVER arrived"));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, "council-drawer-en.png") });
console.log("saved");
await browser.close();
