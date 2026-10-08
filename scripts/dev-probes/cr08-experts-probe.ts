/* eslint-disable no-console */
// CR08 3 and 2.2 probe: opens the Expert Network (internal grouped and flat,
// external with filters, deep links and the remembered view), an internal
// and an external profile, the Studies page (featured hero, facets, year
// shelves) and a search whose results carry the two expert groups, in both
// locales, capturing console errors and screenshots at 1440x900.
//   npx tsx scripts/dev-probes/cr08-experts-probe.ts
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const problems: string[] = [];

async function shot(page: Page, name: string, full = false) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("  saved", `${name}.png`);
}

async function open(page: Page, urlPath: string) {
  const res = await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 90000 });
  const status = res?.status();
  if (status && status >= 400) problems.push(`${urlPath} -> ${status}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return status;
}

async function rawKeys(page: Page): Promise<string[]> {
  const found = (await page.evaluate(
    "(() => { const t = document.body.innerText; const m = t.match(/\\b(experts|studies|search|ask|common)\\.[a-zA-Z]+(\\.[a-zA-Z]+)*\\b/g) || []; return Array.from(new Set(m)).slice(0, 8); })()"
  )) as string[];
  return found;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      // Next dev overlays and hydration noise from other modules are reported but not counted
      problems.push(`console: ${text.slice(0, 220)}`);
    }
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));

  await page.goto(BASE + "/en/login");
  await page.fill("#email", "admin@enviroai.demo");
  await page.fill("#password", "EnviroAI!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });

  // find one internal and one external expert id through the API
  const internalRows = (await (await ctx.request.get(BASE + "/api/v1/experts?view=internal")).json()).data as {
    id: string;
    nameEn: string;
    unitPath: unknown[];
    projectCount: number;
  }[];
  const externalRows = (await (await ctx.request.get(BASE + "/api/v1/experts?view=external")).json()).data as {
    id: string;
    nameEn: string;
    engagementCount: number;
    country: string | null;
  }[];
  console.log(`api: ${internalRows.length} internal, ${externalRows.length} external`);
  const internalId = internalRows.find((r) => r.projectCount > 0)?.id ?? internalRows[0]?.id;
  const external = externalRows.find((r) => r.engagementCount > 0) ?? externalRows[0];
  const searchName = "Noora Al-Kuwari";

  for (const locale of ["en", "ar"] as const) {
    console.log(`\n== ${locale} ==`);

    // internal, grouped (default)
    await open(page, `/${locale}/experts?view=internal`);
    const groups = await page.locator('[data-testid="unit-group"]').count();
    const cards = await page.locator('[data-testid="expert-card"][data-kind="internal"]').count();
    const crumbs = await page.locator('[data-testid="unit-crumb"]').count();
    const selected = await page.locator('[data-testid="segment-internal"]').getAttribute("aria-selected");
    console.log(`  internal grouped: ${groups} unit groups, ${cards} cards, ${crumbs} crumbs, segment selected=${selected}`);
    if (!groups || !cards) problems.push(`${locale}: internal grouped view empty`);
    if (selected !== "true") problems.push(`${locale}: internal segment not selected on deep link`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `experts-internal-grouped-${locale}`);
    await shot(page, `experts-internal-grouped-full-${locale}`, true);

    // collapse one group, then flat layout
    await page.locator('[data-testid="unit-group"] button[aria-expanded]').first().click();
    await page.waitForTimeout(400);
    const collapsed = await page.locator('[data-testid="unit-group"] button[aria-expanded="false"]').count();
    console.log(`  collapsed groups after one click: ${collapsed}`);
    await open(page, `/${locale}/experts?view=internal&layout=flat`);
    const flatCards = await page.locator('[data-testid="expert-card"]').count();
    const flatGroups = await page.locator('[data-testid="unit-group"]').count();
    console.log(`  internal flat: ${flatCards} cards, ${flatGroups} groups`);
    if (flatGroups) problems.push(`${locale}: flat layout still shows groups`);
    await shot(page, `experts-internal-flat-${locale}`);

    // internal filter: involved in projects
    await open(page, `/${locale}/experts?view=internal&layout=flat&projects=1`);
    const projCards = await page.locator('[data-testid="expert-card"]').count();
    console.log(`  internal with projects=1: ${projCards} cards`);

    // external
    await open(page, `/${locale}/experts?view=external`);
    const extCards = await page.locator('[data-testid="expert-card"][data-kind="external"]').count();
    const addBtn = await page.locator('[data-testid="add-external"]').count();
    const requestBtns = await page.locator('[data-testid="request-expert"]').count();
    console.log(`  external: ${extCards} cards, add button ${addBtn}, request buttons ${requestBtns}`);
    if (!extCards) problems.push(`${locale}: external view empty`);
    if (!addBtn) problems.push(`${locale}: add external button missing in external view`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `experts-external-${locale}`);

    // external filters: type + worked with NPC + country
    await open(page, `/${locale}/experts?view=external&type=academic&workedWith=1`);
    const filtered = await page.locator('[data-testid="expert-card"]').count();
    console.log(`  external academic + worked with NPC: ${filtered} cards`);
    await shot(page, `experts-external-filtered-${locale}`);
    await open(page, `/${locale}/experts?view=external&country=QA&availability=available`);
    console.log(`  external QA + available: ${await page.locator('[data-testid="expert-card"]').count()} cards`);

    // the internal view must not offer "Add external expert"
    await open(page, `/${locale}/experts?view=internal`);
    if (await page.locator('[data-testid="add-external"]').count()) {
      problems.push(`${locale}: add external button shown in internal view`);
    }

    // remembered view: pick External through the control, then open /experts with no view
    await page.locator('[data-testid="segment-external"]').click();
    await page.waitForURL("**/experts?view=external", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await open(page, `/${locale}/experts`);
    const remembered = await page.locator('[data-testid="segment-external"]').getAttribute("aria-selected");
    console.log(`  remembered view external=${remembered}`);
    if (remembered !== "true") problems.push(`${locale}: last view not remembered`);
    // restore the default for the next locale
    await page.locator('[data-testid="segment-internal"]').click();
    await page.waitForTimeout(800);

    // request dialog on an external card
    await open(page, `/${locale}/experts?view=external`);
    await page.locator('[data-testid="request-expert"]').first().click();
    await page.waitForTimeout(400);
    const dialogOpen = await page.locator('[data-testid="request-subject"]').count();
    console.log(`  request dialog opened: ${dialogOpen}`);
    if (!dialogOpen) problems.push(`${locale}: request dialog did not open from the card`);
    await shot(page, `experts-request-dialog-${locale}`);
    await page.keyboard.press("Escape");

    // profiles
    if (external) {
      await open(page, `/${locale}/experts/${external.id}`);
      console.log(`  external profile kind=${await page.locator('[data-testid="expert-header"]').getAttribute("data-kind")}, engagements section ${await page.locator('[data-testid="expert-engagements"]').count()}`);
      await shot(page, `experts-profile-external-${locale}`);
    }
    if (internalId) {
      await open(page, `/${locale}/experts/${internalId}`);
      console.log(`  internal profile kind=${await page.locator('[data-testid="expert-header"]').getAttribute("data-kind")}, unit crumb ${await page.locator('[data-testid="profile-unit"]').count()}`);
      await shot(page, `experts-profile-internal-${locale}`);
    }

    // new expert form (country field)
    await open(page, `/${locale}/experts/new`);
    console.log(`  new expert form country select: ${await page.locator('[data-testid="new-expert-country"]').count()}`);

    // studies
    const studiesStatus = await open(page, `/${locale}/studies`);
    const hero = await page.locator('[data-testid="featured-study"]').count();
    const shelves = await page.locator('[data-testid="year-shelf"]').count();
    const books = await page.locator('[data-testid="year-shelves"] .book-wrap').count();
    console.log(`  studies: status ${studiesStatus}, hero ${hero}, year shelves ${shelves}, books ${books}`);
    if (!hero || !shelves) problems.push(`${locale}: studies hero or shelves missing`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `studies-${locale}`);
    await shot(page, `studies-full-${locale}`, true);
    await open(page, `/${locale}/studies?type=research`);
    console.log(`  studies research only: ${await page.locator('[data-testid="year-shelf"]').count()} shelves, ${await page.locator('[data-testid="filtered-count"]').count()} count line`);
    await shot(page, `studies-filtered-${locale}`);
    await open(page, `/${locale}/studies?year=2026&outcome=gov_excellence`);
    console.log(`  studies 2026 + gov_excellence: ${await page.locator('[data-testid="year-shelf"]').count()} shelves`);

    // the upload flow with the type pre-set
    await open(page, `/${locale}/vault/upload?type=study`);
    console.log(`  upload page opened with ?type=study`);

    // search: the two expert groups
    await open(page, `/${locale}/search?q=${encodeURIComponent(searchName)}`);
    const groupBlock = await page.locator('[data-testid="expert-groups"]').count();
    const gInternal = await page.locator('[data-testid="expert-group-internal"]').count();
    const gExternal = await page.locator('[data-testid="expert-group-external"]').count();
    console.log(`  search "${searchName}": groups block ${groupBlock}, internal ${gInternal}, external ${gExternal}`);
    if (!groupBlock) problems.push(`${locale}: search shows no expert groups`);
    await shot(page, `search-experts-${locale}`);
    await open(page, `/${locale}/search?q=${encodeURIComponent("statistics")}`);
    console.log(`  search "statistics": internal ${await page.locator('[data-testid="expert-group-internal"]').count()}, external ${await page.locator('[data-testid="expert-group-external"]').count()}`);
    await shot(page, `search-experts-both-${locale}`);
  }

  await browser.close();
  console.log("\nproblems:", problems.length ? "" : "none");
  for (const p of problems) console.log(" -", p);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
