/* eslint-disable no-console */
// CR08 5 (Reports UI agent): Playwright probe over the shared dev server in
// system Edge. Stages (PROBE_STAGE=hub | flow | ar | contrib | mobile | all):
//   hub      the Reports page as the Super Admin: gallery, filters, requests
//   flow     the builder through every step to Generate (Statistical
//            Highlights, Q3 2026, cover + contents + closing so no model is
//            called), the progress list until the draft lands, a comment, a
//            manual edit, submit, approve, publish, downloads, the lightbox;
//            the probe's report is removed afterwards
//   ar       the three pages in Arabic
//   contrib  a Contributor: the gallery, no custom type, own-unit scope
//   mobile   the three pages at 390px
// Screenshots land in data/screenshots/cr08/reports-*.png. Console and page
// errors fail the run.
//   npx tsx scripts/dev-probes/cr08-reports-ui-probe.ts
import { chromium, type Browser, type Page } from "playwright";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

const errors: string[] = [];
const fails: string[] = [];
function expect(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` (${detail})` : ""}`);
  if (!ok) fails.push(`${name}${detail ? ` (${detail})` : ""}`);
}

/** Console and page errors, tagged with the URL they happened on. Attached
    AFTER login, because the login helper lands on /home first and that page
    is not this agent's (it carries its own hydration mismatch). */
function attach(page: Page, tag: string) {
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      if (/favicon|hot-update|Download the React DevTools/i.test(text)) return;
      errors.push(`[${tag} ${page.url().replace(BASE, "")}] console: ${text.slice(0, 400)}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`[${tag} ${page.url().replace(BASE, "")}] pageerror: ${String(e).slice(0, 400)}`));
}

async function login(page: Page, locale: string, email: string) {
  let status = 0;
  for (let attempt = 0; attempt < 14; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: "Nexus!2026" }, timeout: 120000 });
      status = res.status();
      if (res.ok()) break;
      console.log(`  login ${email}: ${status}, retrying`);
    } catch (e) {
      // the shared dev server restarts (ECONNREFUSED) under another agent's edit
      status = 0;
      console.log(`  login ${email}: ${String((e as Error)?.message ?? e).split("\n")[0]}, retrying`);
    }
    await page.waitForTimeout(12000);
  }
  if (status !== 200) throw new Error(`login ${email} failed: ${status}`);
  await page.goto(`${BASE}/${locale}/home`, { waitUntil: "domcontentloaded", timeout: 120000 });
}

/** Waits for hydration of the element (its DOM node carries a fiber key). */
async function settle(page: Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 180000 });
  await page.waitForFunction(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })()`,
    undefined,
    { timeout: 300000, polling: 500 }
  );
  await page.waitForTimeout(300);
}

async function open(page: Page, url: string, waitFor: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await settle(page, waitFor);
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}`);
}

async function rawKeys(page: Page): Promise<string[]> {
  const text = (await page.locator("body").innerText()) ?? "";
  return text.match(/\b(reports|common)\.[a-zA-Z]+(\.[a-zA-Z0-9_]+)+\b/g) ?? [];
}

/** A signed-in page with error capture armed on this agent's pages only. */
async function newPage(browser: Browser, locale: string, tag: string, email = "admin@npc.qa", viewport = { width: 1440, height: 900 }): Promise<Page> {
  const ctx = await browser.newContext({ viewport, locale: locale === "ar" ? "ar-QA" : "en-QA" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await login(page, locale, email);
  attach(page, tag);
  return page;
}

/** A published example with page previews; `preferType` picks a specific
    type (the annual report is the one that carries charts and KPI tiles). */
async function publishedId(page: Page, preferType?: string): Promise<string | null> {
  const j = await (await page.request.get(`${BASE}/api/v1/report-builder`, { timeout: 180000 })).json();
  const list = (j?.data?.reports ?? []) as { id: string; status: string; previewCount: number; typeCode: string }[];
  const usable = list.filter((r) => r.status === "published" && r.previewCount > 0);
  return (preferType ? usable.find((r) => r.typeCode === preferType) : null)?.id ?? usable[0]?.id ?? null;
}

/** Polls the page's data-status until it leaves "generating". */
async function waitForStatus(page: Page, wanted: string, timeoutMs = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const status = await page.getAttribute('[data-testid="report-page"]', "data-status");
    if (status === wanted) return status;
    if (status === "failed") return status;
    await page.waitForTimeout(2000);
  }
  return await page.getAttribute('[data-testid="report-page"]', "data-status");
}

/** A lifecycle button (submit, approve, publish): click it, then wait for the
    report's status to land. The shared dev server answers a PATCH in 25s and
    much longer while the docx re-render job holds the CPU, so this allows a
    long wait and one retry click before it gives up. */
async function clickToStatus(page: Page, testId: string, wanted: string, waitMs = 240000): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.click(`[data-testid="${testId}"]`);
    const t0 = Date.now();
    while (Date.now() - t0 < waitMs) {
      const status = await page.getAttribute('[data-testid="report-page"]', "data-status");
      if (status === wanted) return status;
      await page.waitForTimeout(2000);
    }
    const status = await page.getAttribute('[data-testid="report-page"]', "data-status");
    console.log(`  ${testId}: still ${status} after ${Math.round(waitMs / 1000)}s${attempt === 0 ? ", clicking once more" : ""}`);
    if (attempt === 0 && (await page.locator(`[data-testid="${testId}"]`).count()) === 0) return status;
  }
  return await page.getAttribute('[data-testid="report-page"]', "data-status");
}

const STAGE = process.env.PROBE_STAGE ?? "all";
const stage = (name: string) => STAGE === "all" || STAGE === name;

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });

  /* ---------------- hub, Super Admin, English ---------------- */
  if (stage("hub")) {
    console.log("EN admin: hub");
    const en = await newPage(browser, "en", "en-hub");
    await open(en, `${BASE}/en/reports`, '[data-testid="reports-hub"]');
    await en.waitForSelector('[data-testid="cover-card"]', { timeout: 120000 });
    const covers = await en.locator('[data-testid="cover-card"]').count();
    expect("hub: twelve covers in the gallery", covers === 12, `covers=${covers}`);
    expect("hub: request button", (await en.locator('[data-testid="request-report"]').count()) === 1);
    expect("hub: custom entry for the Super Admin", (await en.locator('[data-testid="build-custom"]').count()) >= 1);
    expect("hub: my requests section", (await en.locator('[data-testid="my-requests"]').count()) === 1);
    expect("hub: all reports section with status tabs", (await en.locator('[data-testid="status-filters"] [role=tab]').count()) === 7);
    expect("hub: all reports lists the twelve published rows", (await en.locator('[data-testid="all-reports-table"] [data-testid="report-row"]').count()) >= 12);
    // the first cover image loads through the API
    const coverOk = await en.evaluate(`(() => { const img = document.querySelector('[data-testid="cover-card"] img'); return !!img && img.complete && img.naturalWidth > 0; })()`);
    expect("hub: the first cover image decoded", Boolean(coverOk));
    expect("hub: no raw i18n keys", (await rawKeys(en)).length === 0, (await rawKeys(en)).slice(0, 3).join(", "));
    await shot(en, "reports-hub-en");
    await shot(en, "reports-hub-en-full", true);
    // filters
    await en.click('[data-testid="family-tab-internal"]');
    await en.waitForTimeout(300);
    const internal = await en.locator('[data-testid="cover-card"]').count();
    expect("hub: the Internal family filters to eight covers", internal === 8, `covers=${internal}`);
    await en.click('[data-testid="family-tab-public"]');
    await en.waitForTimeout(300);
    expect("hub: the Public family filters to four covers", (await en.locator('[data-testid="cover-card"]').count()) === 4);
    await en.selectOption('[data-testid="filter-type"]', "indices_annual");
    await en.waitForTimeout(300);
    expect("hub: the type filter narrows to one cover", (await en.locator('[data-testid="cover-card"]').count()) === 1);
    await shot(en, "reports-hub-filtered-en");
    await en.click('[data-testid="clear-filters"]');
    await en.waitForTimeout(300);
    await en.fill('[data-testid="filter-search"]', "closure");
    await en.waitForTimeout(300);
    expect("hub: search finds the closure report", (await en.locator('[data-testid="cover-card"]').count()) === 1);
    await en.fill('[data-testid="filter-search"]', "zzzz-nothing");
    await en.waitForTimeout(300);
    expect("hub: an empty search shows the designed empty state", (await en.locator('[data-testid="cover-gallery"] .border-dashed').count()) === 1);
    await shot(en, "reports-hub-empty-en");
    await en.click('[data-testid="clear-filters"]');
    await en.waitForTimeout(200);
    expect("hub: clear restores the twelve", (await en.locator('[data-testid="cover-card"]').count()) === 12);
    // status tabs
    await en.click('[data-testid="status-tab-published"]');
    await en.waitForTimeout(200);
    expect("hub: the published status tab keeps the twelve rows", (await en.locator('[data-testid="all-reports-table"] [data-testid="report-row"]').count()) === 12);
    await en.context().close();
  }

  /* ---------------- the flow: builder to publish ---------------- */
  let probeReportId: string | null = null;
  if (stage("flow")) {
    console.log("EN admin: builder and review flow");
    const en = await newPage(browser, "en", "en-flow");
    await open(en, `${BASE}/en/reports/new`, '[data-testid="report-builder"]');
    await en.waitForSelector('[data-testid="type-card"]');
    const typeCards = await en.locator('[data-testid="type-card"]').count();
    expect("builder: thirteen type cards for the Super Admin", typeCards === 13, `cards=${typeCards}`);
    expect("builder: the custom family group is present", (await en.locator('[data-testid="type-family-custom"]').count()) === 1);
    expect("builder: no raw i18n keys", (await rawKeys(en)).length === 0, (await rawKeys(en)).slice(0, 3).join(", "));
    await shot(en, "reports-builder-type-en");
    await en.click('[data-testid="type-card"][data-type-code="statistical_highlights"]');
    await en.waitForTimeout(200);
    expect("builder: the structure preview names the type", (await en.locator('[data-testid="summary-type"]').innerText()).includes("Statistical Highlights"));
    expect("builder: eight default sections in the structure", (await en.locator('[data-testid="structure-list"] li').count()) === 8);
    await en.click('[data-testid="builder-next"]');
    await en.waitForSelector('[data-testid="builder-step-periodScope"]');
    expect("builder: the quarterly cadence preselects a quarter", (await en.getAttribute('[data-testid="period-kind-quarter"]', "aria-checked")) === "true");
    await en.selectOption('[data-testid="period-year"]', "2026");
    await en.click('[data-testid="period-quarter-3"]');
    expect("builder: the Council scope card for a period-scoped type", (await en.locator('[data-testid="scope-council"]').count()) === 1);
    expect("builder: the summary shows Q3 2026", (await en.locator('[data-testid="summary-period"]').innerText()).includes("Q3 2026"));
    await shot(en, "reports-builder-period-en");
    await en.click('[data-testid="builder-next"]');
    await en.waitForSelector('[data-testid="builder-step-audience"]');
    expect("builder: the public audience is preselected", (await en.getAttribute('[data-testid="audience-public"]', "aria-checked")) === "true");
    await en.click('[data-testid="language-both"]');
    await shot(en, "reports-builder-audience-en");
    await en.click('[data-testid="builder-next"]');
    await en.waitForSelector('[data-testid="builder-step-sections"]');
    const toggles = await en.locator('[data-testid="section-toggle"]').count();
    expect("builder: ten sections offered (eight default, two optional)", toggles === 10, `toggles=${toggles}`);
    // keep cover, contents and closing only, so the build needs no model
    const keep = new Set(["cover", "contents", "closing"]);
    const checked = en.locator('[data-testid="section-toggle"][data-checked="true"]');
    const codes: string[] = [];
    for (let i = 0; i < (await checked.count()); i++) codes.push((await checked.nth(i).getAttribute("data-section-code")) ?? "");
    for (const code of codes) {
      if (code && !keep.has(code)) await en.click(`[data-testid="section-toggle"][data-section-code="${code}"] input`);
    }
    await en.waitForTimeout(200);
    expect("builder: the structure lists three sections", (await en.locator('[data-testid="structure-list"] li').count()) === 3);
    await shot(en, "reports-builder-sections-en");
    await en.click('[data-testid="generate"]');
    await en.waitForURL(/\/en\/reports\/[0-9A-Z]{26}$/, { timeout: 120000 });
    probeReportId = en.url().split("/").pop() ?? null;
    console.log(`  report ${probeReportId}`);
    await settle(en, '[data-testid="report-page"]');
    const firstStatus = await en.getAttribute('[data-testid="report-page"]', "data-status");
    if (firstStatus === "generating") {
      await en.waitForSelector('[data-testid="progress-list"]', { timeout: 30000 });
      expect("report: the progress list shows three sections", (await en.locator('[data-testid="progress-section"]').count()) === 3);
      await shot(en, "reports-generating-en");
    } else {
      console.log(`  build finished before the page settled (${firstStatus})`);
    }
    const landed = await waitForStatus(en, "draft");
    expect("report: the build lands as a draft", landed === "draft", `status=${landed}`);
    await en.waitForSelector('[data-testid="report-section"]');
    expect("report: three section cards", (await en.locator('[data-testid="report-section"]').count()) === 3);
    expect("report: every section ready", (await en.locator('[data-testid="report-section"][data-section-status="ready"]').count()) === 3);
    expect("report: filmstrip pages after the render", (await en.locator('[data-testid="filmstrip-page"]').count()) >= 3, `pages=${await en.locator('[data-testid="filmstrip-page"]').count()}`);
    expect("report: both downloads offered", (await en.locator('[data-testid="download-en"]').count()) === 1 && (await en.locator('[data-testid="download-ar"]').count()) === 1);
    expect("report: the ask-context marker", (await en.getAttribute('[data-testid="report-page"]', "data-ask-context")) === `report:${probeReportId}`);
    expect("report: no raw i18n keys", (await rawKeys(en)).length === 0, (await rawKeys(en)).slice(0, 3).join(", "));
    await shot(en, "reports-draft-en");
    await shot(en, "reports-draft-en-full", true);

    // a comment on the cover
    const cover = en.locator('[data-testid="report-section"][data-section-code="cover"]');
    await cover.locator('[data-testid="comment-input"]').fill("Please check the subtitle before approval.");
    await cover.locator('[data-testid="comment-post"]').click();
    // 120s, not 60: the shared dev server answers a PATCH in 25s or more
    // while another agent's edit is compiling
    await cover.locator('[data-testid="section-comment"]').first().waitFor({ timeout: 120000 });
    expect("report: the comment appears in the thread", (await cover.locator('[data-testid="section-comment"]').count()) === 1);

    // a manual edit of the closing text
    const closing = en.locator('[data-testid="report-section"][data-section-code="closing"]');
    await closing.locator('[data-testid="edit-section"]').click();
    await en.waitForSelector('[data-testid="section-editor"]');
    const area = en.locator('[data-testid="section-editor"] textarea[dir="ltr"]').first();
    expect("report: the editor offers an English textarea", (await area.count()) === 1);
    await area.fill("Edited from the review screen by the probe.");
    await shot(en, "reports-editor-en");
    await en.click('[data-testid="editor-save"]');
    await en.waitForTimeout(1500);
    const afterEdit = await waitForStatus(en, "draft");
    expect("report: the re-render after the edit returns to draft", afterEdit === "draft", `status=${afterEdit}`);
    await en.waitForSelector('[data-testid="report-section"][data-section-code="closing"][data-section-status="edited"]', { timeout: 120000 });
    expect("report: the closing section is marked edited", true);

    // lifecycle
    const submitted = await clickToStatus(en, "submit-review", "in_review");
    expect("report: submit moves to in review", submitted === "in_review", `status=${submitted}`);
    const approved = await clickToStatus(en, "approve", "approved");
    expect("report: approve moves to approved", approved === "approved", `status=${approved}`);
    expect("report: publish offered once approved", (await en.locator('[data-testid="publish"]').count()) === 1);
    await shot(en, "reports-approved-en");
    const publishedStatus = await clickToStatus(en, "publish", "published", 300000);
    expect("report: publish moves to published", publishedStatus === "published", `status=${publishedStatus}`);
    expect("report: the Institutional Memory link", (await en.locator('[data-testid="memory-link"]').count()) === 1);
    const dl = await en.request.get(`${BASE}/api/v1/report-builder/${probeReportId}/download?lang=ar`);
    expect("report: the Arabic download answers a docx", dl.status() === 200 && (dl.headers()["content-type"] ?? "").includes("wordprocessingml"), `status=${dl.status()}`);

    // the lightbox
    await en.locator('[data-testid="filmstrip-page"]').first().click();
    await en.waitForSelector('[data-testid="lightbox"]');
    await en.waitForTimeout(600);
    expect("report: the lightbox opens", (await en.locator('[data-testid="lightbox"] img').count()) === 1);
    await en.click('[data-testid="lightbox-next"]');
    await en.waitForTimeout(400);
    expect("report: next moves to page 2", (await en.locator('[data-testid="lightbox"]').innerText()).includes("2"));
    await shot(en, "reports-lightbox-en");
    await en.keyboard.press("Escape");
    await en.waitForSelector('[data-testid="lightbox"]', { state: "detached", timeout: 10000 });
    await shot(en, "reports-published-en");

    // the hub now lists thirteen covers, the probe's among them
    await open(en, `${BASE}/en/reports`, '[data-testid="reports-hub"]');
    await en.waitForSelector('[data-testid="cover-card"]');
    expect("hub: the new report joins the gallery", (await en.locator(`[data-testid="cover-card"][data-report-id="${probeReportId}"]`).count()) === 1);
    await en.context().close();
  }

  /* ---------------- Arabic ---------------- */
  if (stage("ar")) {
    console.log("AR admin");
    const ar = await newPage(browser, "ar", "ar");
    await open(ar, `${BASE}/ar/reports`, '[data-testid="reports-hub"]');
    await ar.waitForSelector('[data-testid="cover-card"]');
    expect("AR hub: covers render", (await ar.locator('[data-testid="cover-card"]').count()) >= 12);
    expect("AR hub: the page is RTL", (await ar.getAttribute("html", "dir")) === "rtl");
    expect("AR hub: no raw i18n keys", (await rawKeys(ar)).length === 0, (await rawKeys(ar)).slice(0, 3).join(", "));
    await shot(ar, "reports-hub-ar");
    await open(ar, `${BASE}/ar/reports/new`, '[data-testid="report-builder"]');
    await ar.click('[data-testid="type-card"][data-type-code="nds3_delivery_monthly"]');
    await ar.click('[data-testid="builder-next"]');
    await ar.waitForSelector('[data-testid="builder-step-periodScope"]');
    expect("AR builder: the outcome picker lists outcomes", (await ar.locator('[data-testid="scope-option"]').count()) >= 7);
    await ar.locator('[data-testid="scope-option"]').first().click();
    expect("AR builder: no raw i18n keys", (await rawKeys(ar)).length === 0, (await rawKeys(ar)).slice(0, 3).join(", "));
    await shot(ar, "reports-builder-ar");
    const seeded = await publishedId(ar, "npc_annual_report");
    if (seeded) {
      await open(ar, `${BASE}/ar/reports/${seeded}`, '[data-testid="report-page"]');
      await ar.waitForSelector('[data-testid="report-section"]');
      expect("AR report: sections render", (await ar.locator('[data-testid="report-section"]').count()) >= 5);
      await ar.waitForSelector('[data-testid="report-chart"]', { timeout: 30000 }).catch(() => null);
      expect("AR report: a chart drawn", (await ar.locator('[data-testid="report-chart"]').count()) >= 1);
      expect("AR report: KPI tiles drawn", (await ar.locator('[data-testid="kpi-grid"]').count()) >= 1);
      expect("AR report: a grid table with ARIA roles, no <table>", (await ar.locator('[data-testid="report-table"] [role="columnheader"]').count()) >= 1 && (await ar.locator("main table").count()) === 0);
      expect("AR report: no raw i18n keys", (await rawKeys(ar)).length === 0, (await rawKeys(ar)).slice(0, 3).join(", "));
      await shot(ar, "reports-report-ar");
      await shot(ar, "reports-report-ar-full", true);
    }
    await ar.context().close();
  }

  /* ---------------- Contributor ---------------- */
  if (stage("contrib")) {
    console.log("EN contributor");
    const c = await newPage(browser, "en", "contrib", "analyst@npc.qa");
    await open(c, `${BASE}/en/reports`, '[data-testid="reports-hub"]');
    await c.waitForSelector('[data-testid="cover-card"]');
    // eleven, not twelve: the Confidential Leadership Briefing Pack is above
    // a Contributor's clearance, so the service filters it out of the gallery
    const contribCovers = await c.locator('[data-testid="cover-card"]').count();
    expect("contributor: sees the eleven covers their clearance allows", contribCovers === 11, `covers=${contribCovers}`);
    expect("contributor: no All reports section", (await c.locator('[data-testid="all-reports"]').count()) === 0);
    expect("contributor: no custom entry", (await c.locator('[data-testid="build-custom"]').count()) === 0);
    expect("contributor: my requests with the empty state", (await c.locator('[data-testid="my-requests"] .border-dashed').count()) === 1);
    await shot(c, "reports-contrib-en");
    await open(c, `${BASE}/en/reports/new`, '[data-testid="report-builder"]');
    expect("contributor: twelve type cards, no custom", (await c.locator('[data-testid="type-card"]').count()) === 12 && (await c.locator('[data-testid="type-family-custom"]').count()) === 0);
    await c.click('[data-testid="type-card"][data-type-code="department_continuity"]');
    await c.click('[data-testid="builder-next"]');
    await c.waitForSelector('[data-testid="builder-step-periodScope"]');
    const units = await c.locator('[data-testid="scope-option"]').count();
    expect("contributor: the unit picker offers only the own unit", units === 1, `units=${units}`);
    await shot(c, "reports-contrib-builder-en");
    await c.click('[data-testid="builder-prev"]');
    await c.click('[data-testid="type-card"][data-type-code="project_closure"]');
    await c.click('[data-testid="builder-next"]');
    await c.waitForSelector('[data-testid="builder-step-periodScope"]');
    const projects = await c.locator('[data-testid="scope-option"]').count();
    expect("contributor: the project picker lists the allowed projects only", projects > 0 && projects < 196, `projects=${projects}`);
    await c.context().close();
  }

  /* ---------------- 390px ---------------- */
  if (stage("mobile")) {
    console.log("EN admin: 390px");
    const m = await newPage(browser, "en", "mobile", "admin@npc.qa", { width: 390, height: 844 });
    await open(m, `${BASE}/en/reports`, '[data-testid="reports-hub"]');
    await m.waitForSelector('[data-testid="cover-card"]');
    const overflowHub = await m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
    expect("mobile hub: no horizontal overflow", !overflowHub);
    await shot(m, "reports-mobile-hub");
    const seeded = await publishedId(m);
    if (seeded) {
      await open(m, `${BASE}/en/reports/${seeded}`, '[data-testid="report-page"]');
      await m.waitForSelector('[data-testid="report-section"]');
      const overflowReport = await m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
      expect("mobile report: no horizontal overflow", !overflowReport);
      await shot(m, "reports-mobile-report");
    }
    await open(m, `${BASE}/en/reports/new`, '[data-testid="report-builder"]');
    const overflowBuilder = await m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
    expect("mobile builder: no horizontal overflow", !overflowBuilder);
    await shot(m, "reports-mobile-builder");
    await m.context().close();
  }

  await browser.close();

  /* the probe's report leaves the gallery and Institutional Memory */
  if (probeReportId && !process.env.PROBE_KEEP) {
    const { cleanupReport } = await import("../smoke-cr08-reports");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    await cleanupReport({ base: BASE, cookie: "", adminCookie: "", db }, probeReportId);
    console.log(`  cleaned up ${probeReportId}`);
  }

  console.log("");
  if (errors.length) {
    console.log("browser errors:");
    for (const e of errors) console.log("  " + e);
  } else console.log("no console or page errors");
  console.log(fails.length ? `${fails.length} assertion(s) failed:\n  ${fails.join("\n  ")}` : "all assertions passed");
  process.exit(errors.length || fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
