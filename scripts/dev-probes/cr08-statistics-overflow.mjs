// Which element widens /statistics at 390 and 1024? Prints the chain of
// ancestors of the widest unclipped box so the fix lands in the right file.
import { chromium } from "playwright";
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

const CHAIN = `(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox && ox !== "visible") return true;
    }
    return false;
  };
  let worst = null, over = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.ownerSVGElement) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || clipped(el)) continue;
    const o = Math.max(0, Math.round(r.right - vw), Math.round(-r.left));
    if (o > over) { over = o; worst = el; }
  }
  if (!worst) return JSON.stringify({ over: 0 });
  const chain = [];
  for (let el = worst; el && el !== document.body; el = el.parentElement) {
    const r = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName.toLowerCase(),
      testid: el.getAttribute("data-testid") || "",
      cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "").slice(0, 80),
      w: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
    });
  }
  return JSON.stringify({ over, vw, scrollWidth: document.documentElement.scrollWidth, chain: chain.slice(0, 8) });
})()`;

const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.request.post(`${BASE}/api/v1/auth/login`, {
  data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
  timeout: 120000,
});
const page = await ctx.newPage();
for (const [locale, width] of [["en", 390], ["en", 1024]]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/${locale}/statistics`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const raw = await page.evaluate(CHAIN);
  console.log(`\n${locale} @${width}:`);
  const d = JSON.parse(String(raw));
  console.log(`  over ${d.over}px, scrollWidth ${d.scrollWidth} vs ${d.vw}`);
  for (const c of d.chain ?? []) {
    console.log(`    ${c.tag}${c.testid ? `[${c.testid}]` : ""} w=${c.w} left=${c.left} right=${c.right} .${c.cls}`);
  }
}
await browser.close();
