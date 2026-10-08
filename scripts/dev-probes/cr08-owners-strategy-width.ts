/* eslint-disable no-console */
// CR08 9.1 dev probe: what makes a page wider than its viewport.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-width.ts <path>
import { chromium } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = "http://localhost:3000";

const FIND = `(() => {
  const vw = window.innerWidth;
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      out.push({
        tag: el.tagName,
        cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').slice(0, 70),
        testid: el.getAttribute('data-testid') || '',
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        overflowX: getComputedStyle(el).overflowX,
      });
    }
  });
  return { vw, scrollWidth: document.documentElement.scrollWidth, count: out.length, worst: out.slice(0, 14) };
})()`;

async function main() {
  const url = process.argv[2] ?? "/en/strategy/nes3?o=o1";
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const login = await ctx.newPage();
  await login.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
    timeout: 120000,
  });
  await login.close();
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(await page.evaluate(FIND), null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
