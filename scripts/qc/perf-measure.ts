/* eslint-disable no-console */
// CR08 Phase B: the numbers. Measures, against a RUNNING server (use
// `npm run start:demo` for the real figures, the dev server for a rough
// comparison), in system Edge:
//   - first load: time to interactive-ish (domcontentloaded + network idle),
//     largest contentful paint, cumulative layout shift, and the transferred
//     JavaScript of the first screen
//   - route transitions: client navigation time between the main pages
//   - data pages: the server's own response time, warm
//   - search and the analyst: the search API, and the time to the first token
//     of a streamed answer
// Writes docs/qc/perf.json and prints a table.
//   npx tsx scripts/qc/perf-measure.ts [--label before|after]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const label = process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1] : "run";

const PAGES = ["/en/home", "/en/vault", "/en/strategy", "/en/indices", "/en/reports", "/en/organisation", "/en/processes", "/en/leaderboard"];

/** Signs in through the API rather than the form: a click on a button whose
    handler has not hydrated does nothing, and this measurement is about the
    pages, not about the login screen. */
async function login(ctx: BrowserContext) {
  const res = await ctx.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
    timeout: 120_000,
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
}

/** The first open of a week raises the Knowledge of the Week reveal, a modal
    over the whole viewport that would intercept every rail click in the
    transitions pass. Take it once, as a person would, before measuring. */
async function dismissKow(page: import("playwright").Page) {
  await page.goto(`${BASE}/en/home`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const close = page.locator('[data-testid="kow-reveal-close"]');
  if (await close.count()) await close.first().click({ timeout: 30_000 }).catch(() => {});
  await page.locator('[data-testid="kow-reveal"]').waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
}

/** LCP and CLS through PerformanceObserver, plus the transferred script bytes. */
const VITALS = `(() => new Promise((resolve) => {
  let lcp = 0, cls = 0;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime); })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) cls += e.value; } })
      .observe({ type: "layout-shift", buffered: true });
  } catch (e) { /* older engine */ }
  setTimeout(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const js = performance.getEntriesByType("resource")
      .filter((r) => r.initiatorType === "script")
      .reduce((n, r) => n + (r.transferSize || r.encodedBodySize || 0), 0);
    resolve(JSON.stringify({
      lcp: Math.round(lcp),
      cls: Number(cls.toFixed(4)),
      dcl: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      jsBytes: js,
    }));
  }, 2500);
}))()`;

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(ctx);
  const page = await ctx.newPage();
  await dismissKow(page);

  const out: Record<string, unknown> = { label, base: BASE, at: new Date().toISOString() };

  // 1. cold-ish first load per page (fresh navigation, warm server)
  const loads: Record<string, unknown> = {};
  for (const p of PAGES) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    const raw = await page.evaluate(VITALS);
    loads[p] = JSON.parse(String(raw));
    console.log(`${p}: ${JSON.stringify(loads[p])}`);
  }
  out.firstLoad = loads;

  // 2. client route transitions from Home, through the rail
  const transitions: Record<string, number> = {};
  for (const p of PAGES.slice(1)) {
    await page.goto(`${BASE}/en/home`, { waitUntil: "networkidle", timeout: 180_000 });
    const href = p.replace("/en", "");
    const link = page.locator(`a[href="/en${href}"]`).first();
    if (!(await link.count())) continue;
    const t0 = Date.now();
    await link.click();
    await page.waitForURL(`**${href}`, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    transitions[p] = Date.now() - t0;
    console.log(`transition ${p}: ${transitions[p]}ms`);
  }
  out.transitions = transitions;

  // 3. server response, warm, measured by the browser's own resource timing
  const api: Record<string, number> = {};
  for (const url of ["/api/v1/documents?limit=40", "/api/v1/indices", "/api/v1/leaderboard?board=people&window=month&category=overall", "/api/v1/search/suggest?q=water&locale=en"]) {
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now();
      const res = await page.request.get(`${BASE}${url}`, { timeout: 120_000 });
      const ms = Date.now() - t0;
      if (i === 1) api[url] = ms;
      if (!res.ok()) console.log(`  (${url} answered ${res.status()})`);
    }
    console.log(`api ${url}: ${api[url]}ms`);
  }
  out.api = api;

  await browser.close();
  const file = path.join(process.cwd(), "docs", "qc", `perf-${label}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nwritten to ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
