import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(base + "/en/login");
await page.fill("#email", "admin@enviroai.demo");
await page.fill("#password", "EnviroAI!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home", { timeout: 60000 });
await page.goto(base + "/en/strategy?o=o1&t=o1-t1", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('[data-testid="outcome-stakeholders"]').scrollIntoViewIfNeeded();
const rows = page.locator('[data-testid="outcome-expert-row"]');
const n = Math.min(await rows.count(), 6);
for (let i = 0; i < n; i++) {
  const box = await rows.nth(i).boundingBox();
  if (!box) { console.log(i, "no box"); continue; }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  const lit = await page.evaluate(() => document.querySelectorAll(".lane-hl").length);
  const name = await rows.nth(i).locator("p").first().innerText();
  console.log(i, name.split("\n")[0], "-> lit:", lit);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(200);
}
const leftover = await page.evaluate(() => document.querySelectorAll(".lane-hl").length);
console.log("leftover after unhover:", leftover);
await browser.close();
