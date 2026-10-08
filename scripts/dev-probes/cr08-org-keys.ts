/* eslint-disable no-console */
// CR08 1: traces focus while walking the chart with the arrow keys.
//   npx tsx scripts/dev-probes/cr08-org-keys.ts
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" } });
  await page.goto(`${BASE}/en/organisation`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("[data-testid=org-chart] [data-unit-code=SG]", { timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.evaluate(
    "window.__log = []; document.addEventListener('focusin', (e) => window.__log.push('focusin ' + (e.target.getAttribute('data-unit-code') || e.target.tagName)), true); document.addEventListener('keydown', (e) => window.__log.push('keydown ' + e.key + ' on ' + (e.target.getAttribute('data-unit-code') || e.target.tagName)), true);"
  );
  const order = await page.evaluate(
    "[...document.querySelectorAll('[data-testid=org-chart] [data-unit-code]')].map(b => b.getAttribute('data-unit-code') + ':' + b.closest('foreignObject').getAttribute('x') + ',' + b.closest('foreignObject').getAttribute('y')).join(' ')"
  );
  console.log("nodes:", order);
  await page.locator("[data-testid=org-chart] [data-unit-code=SG]").focus();
  for (const key of ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowUp", "ArrowDown", "ArrowDown"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
    const active = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-unit-code')");
    console.log(key, "->", active);
  }
  console.log((await page.evaluate("window.__log.join('\\n')")) as string);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
