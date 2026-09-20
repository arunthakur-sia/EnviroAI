/* eslint-disable no-console */
// CR08 10.2 diagnostics: the full hydration warning text, the elements that
// push the page wider than the viewport, the calendar year switch timing,
// and the RACI cells the probe wrote (audit log, last hours).
//   npx tsx scripts/dev-probes/cr08-operating-model-diag.ts
import { chromium } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

/** PROBE_PATHS=/en/home,/en/organisation loads those pages instead and only
 *  reports their console errors: it tells apart an app-wide hydration warning
 *  from one this page causes. */
async function hydrationOnly(paths: string[]) {
  const width = Number(process.env.PROBE_WIDTH ?? 1440);
  const full = process.env.PROBE_FULL === "1";
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
  const page = await context.newPage();
  const seen: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(full ? m.text() : m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => seen.push(`pageerror: ${String(e).slice(0, full ? 4000 : 160)}`));
  await context.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
  for (const p of paths) {
    seen.length = 0;
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(6000);
    console.log(`${p}: ${seen.length ? seen.map((s) => `\n    ${s}`).join("") : "no console errors"}`);
  }
  await browser.close();
}

/** PROBE_CLEAN=raci removes the RACI cells a crashed probe run left behind:
 *  every process_raci row whose process and unit pair is not in the seed
 *  content, so the matrix returns to the seeded 182 cells. */
async function cleanRaci() {
  const { rawClient } = await import("../../src/server/db/client");
  const { RACI } = await import("../data/cr08-opmodel-content");
  const want = new Set<string>();
  for (const r of RACI) {
    for (const code of [r.A, ...r.R, ...r.C, ...r.I]) want.add(`${r.processCode}|${code}`);
  }
  const rows = await rawClient.execute(
    "select r.id, p.code as process_code, u.code as unit_code, r.role from process_raci r join processes p on p.id = r.process_id join org_units u on u.id = r.unit_id"
  );
  const stray = rows.rows.filter((row) => !want.has(`${String(row.process_code)}|${String(row.unit_code)}`));
  for (const row of stray) {
    console.log(`  removing stray cell ${row.process_code} / ${row.unit_code} = ${row.role}`);
    await rawClient.execute({ sql: "delete from process_raci where id = ?", args: [String(row.id)] });
  }
  const left = await rawClient.execute("select count(*) as n from process_raci");
  console.log(`process_raci: ${rows.rows.length} before, ${stray.length} stray removed, ${left.rows[0]?.n} now`);
}

async function main() {
  if (process.env.PROBE_CLEAN === "raci") {
    await cleanRaci();
    return;
  }
  const only = (process.env.PROBE_PATHS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (only.length) {
    await hydrationOnly(only);
    return;
  }
  const { rawClient } = await import("../../src/server/db/client");
  const recent = await rawClient.execute(
    "select a.created_at, a.meta_json, p.code from audit_log a left join processes p on p.id = a.resource_id where a.action = 'raci_set' and a.created_at > datetime('now', '-6 hours') order by a.created_at"
  );
  console.log("recent raci_set audit entries:");
  for (const r of recent.rows) console.log(`  ${r.created_at} ${r.code} ${r.meta_json}`);

  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`console ${m.type()}: ${m.text().slice(0, 3000)}`);
  });
  page.on("pageerror", (e) => console.log(`pageerror: ${String(e).slice(0, 1000)}`));
  const login = await context.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
  console.log("login", login.status());
  await page.goto(`${BASE}/en/operating-model`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-testid=operating-model-page]", { timeout: 120000 });
  await page.waitForTimeout(3000);
  /* Elements inside a scroller (overflow-x auto/hidden/scroll) are clipped and
     cannot widen the document: only the ones with no clipping ancestor are
     reported, plus the same walk in the other direction (negative left). */
  const wide = await page.evaluate(
    "(() => { const w = window.innerWidth; const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'hidden' || ox === 'scroll') return true; } return false; }; const out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue; if (r.right <= w + 1 && r.left >= -1) continue; if (clipped(el)) continue; out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(' ').slice(0, 4).join('.')} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)} testid=${el.getAttribute('data-testid') || ''}`); } return { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, innerWidth: w, out: out.slice(0, 25) }; })()"
  );
  console.log("overflow:", JSON.stringify(wide, null, 1));

  const t0 = Date.now();
  const res = await context.request.get(`${BASE}/api/v1/operating-model/calendar?year=2027`, { timeout: 180000 });
  console.log(`calendar 2027 api: ${res.status()} in ${Date.now() - t0}ms`);

  page.on("response", (r) => {
    if (r.url().includes("/api/v1/operating-model/calendar")) console.log(`  response ${r.status()} ${r.url()}`);
  });
  await page.evaluate("document.getElementById('om-calendar').scrollIntoView()");
  await page.waitForTimeout(500);
  await page.locator("[data-testid=calendar-year-switch] button").last().click();
  const t1 = Date.now();
  await page
    .waitForFunction("/2027/.test(document.querySelector('[data-testid=calendar-year]').textContent)", undefined, { timeout: 120000 })
    .then(() => console.log(`year moved to 2027 in ${Date.now() - t1}ms, url ${page.url()}`))
    .catch(() => console.log(`year did not move; text = ${JSON.stringify(page.locator("[data-testid=calendar-year]").textContent())}`));
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
