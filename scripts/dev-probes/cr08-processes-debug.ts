/* eslint-disable no-console */
// CR08 10.1 dev probe: hides one subtree at a time and measures the document's
// scroll width, to name the element that grows /processes past 390.
//   npx tsx scripts/dev-probes/cr08-processes-debug.ts
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const STYLE = `(() => {
  const el = document.querySelector('[data-testid=process-map-scroll]');
  const s = getComputedStyle(el);
  let rules = 0, sheets = 0, hit = [];
  for (const sheet of document.styleSheets) {
    sheets++;
    try {
      for (const rule of sheet.cssRules) {
        rules++;
        if (rule.selectorText && /overflow-x-auto|\\.overflow-x/.test(rule.selectorText)) hit.push(rule.cssText.slice(0, 120));
      }
    } catch (e) { hit.push('sheet blocked'); }
  }
  return { className: el.className, overflowX: s.overflowX, overflowY: s.overflowY, display: s.display, width: el.clientWidth, scrollWidth: el.scrollWidth, sheets, rules, hit: hit.slice(0, 6) };
})()`;

const HUNT = `(() => {
  const width = () => document.documentElement.scrollWidth;
  const name = (el) => el.tagName.toLowerCase()
    + (el.getAttribute('data-testid') ? '[' + el.getAttribute('data-testid') + ']' : '')
    + '.' + String(el.className || '').split(' ').filter(Boolean).slice(0, 5).join('.');
  const base = width();
  const trail = [];
  let node = document.body;
  for (let depth = 0; depth < 12; depth++) {
    let guilty = null;
    for (const child of Array.from(node.children)) {
      const before = child.style.display;
      child.style.display = 'none';
      const after = width();
      child.style.display = before;
      if (after < base) { guilty = child; trail.push({ depth, el: name(child).slice(0, 100), without: after }); break; }
    }
    if (!guilty) { trail.push({ depth, el: 'no single child of ' + name(node).slice(0, 80) + ' accounts for it', without: base }); break; }
    node = guilty;
  }
  return { base, viewport: document.documentElement.clientWidth, trail };
})()`;

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const auth = await ctx.newPage();
  await auth.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
  await auth.close();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/processes`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-testid=process-l0-card]", { timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log("style:", JSON.stringify(await page.evaluate(STYLE), null, 1));
  console.log("hunt:", JSON.stringify(await page.evaluate(HUNT), null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
