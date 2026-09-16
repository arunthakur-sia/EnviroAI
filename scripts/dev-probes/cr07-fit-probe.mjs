import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + "/en/login");
await page.fill("#email", "admin@npc.qa");
await page.fill("#password", "Nexus!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home", { timeout: 60000 });
await page.goto(BASE + "/en/organisation", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(
  `(() => {
    var vp = document.querySelector('[data-testid="org-chart"]');
    if (!vp) return { error: "no viewport" };
    var stage = vp.firstElementChild;
    return {
      vpW: vp.clientWidth, vpH: vp.clientHeight,
      stageW: stage.offsetWidth, stageH: stage.offsetHeight,
      transform: stage.style.transform,
      cards: vp.querySelectorAll('[data-testid="org-unit-card"]').length
    };
  })()`
);
console.log(JSON.stringify(info, null, 1));
await browser.close();
