/* eslint-disable no-console */
// CR08 7: why is the board invisible in the screenshot? Logs the computed
// style and box of the page container and its ancestors, plus console output.
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 400)));
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 600)));
  // the shared dev server rebuilds constantly while other agents edit, so the
  // login form resets under Playwright's fingers; the API sets the same cookie
  const login = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "reader@enviroai.demo", password: "EnviroAI!2026" },
  });
  if (login.status() !== 200) throw new Error(`login -> ${login.status()}`);
  await page.goto(`${BASE}/en/leaderboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-testid=leaderboard-page]", { timeout: 120000 });
  const t0 = Date.now();
  // poll until the entrance animation has run (hydration done)
  for (let i = 0; i < 120; i++) {
    const op = await page.evaluate(
      "(() => { const el = document.querySelector('[data-testid=leaderboard-page]'); return el && el.parentElement ? getComputedStyle(el.parentElement).opacity : 'none'; })()"
    );
    if (op === "1") break;
    await page.waitForTimeout(500);
  }
  console.log(`hydrated+animated after ${Date.now() - t0}ms, readyState=${await page.evaluate("document.readyState")}`);
  const info = await page.evaluate(`(() => {
    const el = document.querySelector('[data-testid=leaderboard-page]');
    if (!el) return 'no page element';
    const out = [];
    let cur = el;
    for (let i = 0; i < 8 && cur; i++) {
      const cs = getComputedStyle(cur);
      const r = cur.getBoundingClientRect();
      out.push([cur.tagName, cur.className.toString().slice(0, 80), 'opacity=' + cs.opacity, 'display=' + cs.display, 'visibility=' + cs.visibility, 'transform=' + cs.transform, 'box=' + Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width) + 'x' + Math.round(r.height), 'overflow=' + cs.overflow].join(' | '));
      cur = cur.parentElement;
    }
    out.push('scrollY=' + window.scrollY + ' main=' + (document.querySelector('main') ? document.querySelector('main').scrollTop : 'none'));
    out.push('rows=' + document.querySelectorAll('[data-testid=board-row]').length);
    out.push('title=' + (document.querySelector('h1') ? document.querySelector('h1').textContent : 'none'));
    return out.join('\\n');
  })()`);
  console.log(info);
  await page.screenshot({ path: "data/screenshots/cr08/leaderboard-inspect-en.png" });
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
