// CR08 Phase C: no page may scroll sideways at any of the three widths, in
// either language. Prints the offenders and the widest box on each.
//   node scripts/qc/overflow-check.mjs [--only /strategy]
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const ROUTES = [
  "/home",
  "/vault",
  "/strategy",
  "/council-strategy",
  "/statistics",
  "/indices",
  "/trends",
  "/processes",
  "/studies",
  "/lessons",
  "/podcast",
  "/reports",
  "/experts",
  "/organisation",
  "/operating-model",
  "/hr",
  "/leaderboard",
  "/inbox",
  "/hall-of-knowledge",
  "/ask",
  "/settings",
  "/profile",
];

const WIDTHS = [1440, 1024, 390];

const WIDEST = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  /** an element clipped by an ancestor cannot scroll the document */
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox && ox !== "visible") return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    // geometry inside an <svg> is clipped by the element's own overflow and
    // never scrolls the document, so it is noise in this report
    if (el.ownerSVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (clipped(el)) continue;
    const over = Math.max(0, Math.round(r.right - vw), Math.round(-r.left));
    if (over > 2) {
      out.push({
        over,
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 70),
        testid: el.getAttribute("data-testid") || "",
      });
    }
  }
  out.sort((a, b) => b.over - a.over);
  return JSON.stringify({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    boxes: out.slice(0, 4),
  });
})()`;

const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// sign in through the API: the context shares its cookie jar, and this does
// not race the login form's hydration on a loaded dev server
const login = await ctx.request.post(`${BASE}/api/v1/auth/login`, {
  data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
  timeout: 120000,
});
if (!login.ok()) {
  console.error(`login failed: ${login.status()}`);
  process.exit(1);
}

let findings = 0;
for (const locale of ["en", "ar"]) {
  for (const route of ROUTES) {
    if (only && !route.startsWith(only)) continue;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/${locale}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
      const raw = await page.evaluate(WIDEST);
      const { scrollWidth, clientWidth, boxes } = JSON.parse(String(raw));
      if (scrollWidth > clientWidth + 2) {
        findings++;
        console.log(`${locale}${route} @${width}: scrollWidth ${scrollWidth} vs ${clientWidth}`);
        for (const b of boxes) console.log(`    +${b.over}px ${b.tag}${b.testid ? ` [${b.testid}]` : ""} .${b.cls}`);
      }
    }
  }
}
await browser.close();
console.log(findings ? `\n${findings} page/width combinations scroll sideways` : "\nno page scrolls sideways at 1440, 1024 or 390");
process.exit(findings ? 1 : 0);
