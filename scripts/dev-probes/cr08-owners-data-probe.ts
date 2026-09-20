/* eslint-disable no-console */
// CR08 9.1 (data, organisation and answer surfaces): drives the person chip
// everywhere this pass placed it, in system Edge against the shared dev
// server, in both locales at 1440x900. Screenshots land in
// data/screenshots/cr08/owners-data-*.png.
//
// The Statistics Hub indicators carry no department in the seed, so the
// department-head fallback would have nothing to show: the probe sets ONE
// indicator's department for the length of the run and puts it back in a
// finally, so both the statistics page and the index that mirrors that series
// can be seen and photographed.
//
//   npx tsx scripts/dev-probes/cr08-owners-data-probe.ts [en|ar|all]
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";

loadEnv();

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const ONLY = process.argv[2] ?? "all";
const PASSWORD = "Nexus!2026";
const NAV = { waitUntil: "networkidle" as const, timeout: 120000 };
const WAIT = { timeout: 120000 };

/** Real GDP Growth Rate: a Statistics Hub series the national index mirrors. */
const INDICATOR_ID = "01M2KQWR6QBB5ZY03BM7A2PCYB";
const INDEX_CODE = "nat_gdp_real_growth";
const UNIT_CODE = "SOA";

const problems: string[] = [];
const notes: string[] = [];
function expect(name: string, ok: boolean, detail?: string) {
  (ok ? notes : problems).push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function login(ctx: BrowserContext, email: string) {
  const page = await ctx.newPage();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: PASSWORD }, timeout: 120000 });
      console.log(`login ${email}: ${res.status()}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
      if (res.status() === 200) break;
    } catch (e) {
      console.log(`login ${email}: ${String(e).slice(0, 90)} (attempt ${attempt})`);
    }
    await page.waitForTimeout(3000);
  }
  await page.close();
}

const KNOWN_SHELL = [/radix-_R_/, /A tree hydrated but some attributes/, /<SettingsTabs/];

function watch(page: Page, errors: string[]) {
  const push = (text: string) => {
    if (KNOWN_SHELL.some((re) => re.test(text))) {
      notes.push(`note (shell) ${text.replace(/\s+/g, " ").slice(0, 120)}`);
      return;
    }
    errors.push(text);
  };
  page.on("console", (m) => {
    if (m.type() === "error") push(`console: ${m.text().replace(/\s+/g, " ").slice(0, 600)}`);
  });
  page.on("pageerror", (e) => push(`pageerror: ${String(e).slice(0, 400)}`));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}.png`);
}

/** Navigates with one retry, the way the other CR08 probes do. */
async function goto(page: Page, url: string, waitFor?: string) {
  /* the shared dev server rebuilds while other agents save: wait and retry */
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, NAV);
      if (waitFor) await page.waitForSelector(waitFor, WAIT);
      return true;
    } catch (e) {
      console.log(`  goto ${url}: ${String(e).slice(0, 90)} (attempt ${attempt})`);
      if (attempt === 3) return false;
      await page.waitForTimeout(6000);
    }
  }
  return false;
}

/** Opens the person card behind a trigger and checks it paints above the page. */
async function openCard(page: Page, triggerSelector: string, name: string) {
  const trigger = page.locator(triggerSelector).first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const pop = page.locator('[data-testid="person-card-popover"]').first();
  await pop.waitFor({ state: "visible", timeout: 120000 });
  await page.locator('[data-testid="person-card"]').first().waitFor({ state: "visible", timeout: 120000 });
  const box = await pop.boundingBox();
  let onTop = false;
  if (box) {
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + Math.min(24, box.height / 2));
    onTop = await page.evaluate(
      `(() => { const el = document.elementFromPoint(${x}, ${y}); return Boolean(el && el.closest('[data-testid="person-card-popover"]')); })()`
    );
  }
  expect(`${name}: the person card paints above the page`, onTop, box ? `at ${Math.round(box.x)},${Math.round(box.y)}` : "no box");
  await shot(page, name);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

const NO_H_SCROLL = "document.documentElement.scrollWidth <= window.innerWidth + 1";

async function runLocale(browser: Browser, locale: "en" | "ar", askConversationId: string | null) {
  console.log(`\n=== ${locale} ===`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(ctx, "admin@npc.qa");
  const page = await ctx.newPage();
  const errors: string[] = [];
  watch(page, errors);

  /* 1. the organisation unit panel: the head's chip and card */
  if (await goto(page, `${BASE}/${locale}/organisation?unit=${UNIT_CODE}`, '[data-testid="org-unit-panel"]')) {
    const headChip = await page.locator('[data-testid="unit-head-owner"] [data-testid="owner-control"]').count();
    expect(`${locale} organisation: the unit head is a person chip in the header`, headChip === 1, `${headChip}`);
    await shot(page, `owners-data-org-${locale}`);
    await openCard(page, '[data-testid="unit-head-owner"] [data-testid="owner-control-trigger"]', `owners-data-org-card-${locale}`);

    /* the People tab keeps the head row, the Policies tab the custodians */
    await page.locator('[data-testid="org-panel-tab"][data-tab="people"]').click();
    await page.waitForTimeout(400);
    const peopleHead = await page.locator('[data-testid="unit-head-row"] [data-testid="owner-control"]').count();
    expect(`${locale} organisation: the People tab head row carries the chip`, peopleHead === 1, `${peopleHead}`);
    await shot(page, `owners-data-org-people-${locale}`);

    await page.locator('[data-testid="org-panel-tab"][data-tab="policies"]').click();
    await page.waitForSelector('[data-testid="policy-tabs"]', WAIT);
    await page.waitForTimeout(400);
    /* the four tabs open on Policies, which this unit may not publish: walk
       them until one holds documents */
    let custodians = 0;
    let policyItems = 0;
    const tabs = page.locator('[data-testid="policy-tab"]');
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(350);
      policyItems = await page.locator('[data-testid="policy-item"]').count();
      custodians = await page.locator('[data-testid="policy-item"] [data-testid="policy-owner"]').count();
      if (policyItems > 0) break;
    }
    expect(`${locale} organisation: the policy rows name their custodian`, custodians > 0, `${custodians} of ${policyItems} rows`);
    await shot(page, `owners-data-org-policies-${locale}`);
    const noScroll = await page.evaluate(NO_H_SCROLL);
    expect(`${locale} organisation: no horizontal growth`, Boolean(noScroll));
  } else {
    expect(`${locale} organisation: the unit panel opened`, false);
  }

  /* 2. the processes page: the Level 1 panel and the policy rows */
  if (await goto(page, `${BASE}/${locale}/processes?l0=P1`, '[data-testid="level1-panel"]')) {
    const l0Owner = await page.locator('[data-testid="level1-panel-owner"] [data-testid="owner-control"]').count();
    const l1Owners = await page.locator('[data-testid="process-l1-owner"] [data-testid="owner-control"]').count();
    const l1Cards = await page.locator('[data-testid="process-l1-card"]').count();
    /* the Level 0 processes are owned by the Strategy Office, which holds no
       head account in the seed: nothing is shown, and nothing is invented */
    notes.push(`${locale} processes: Level 0 head chips = ${l0Owner} (the owner unit has no head account in the seed)`);
    expect(`${locale} processes: every Level 1 card with a head carries the chip`, l1Owners > 0, `${l1Owners} of ${l1Cards} cards`);
    await shot(page, `owners-data-processes-${locale}`);
    await openCard(page, '[data-testid="process-l1-owner"] [data-testid="owner-control-trigger"]', `owners-data-processes-card-${locale}`);
    const noScroll = await page.evaluate(NO_H_SCROLL);
    expect(`${locale} processes: no horizontal growth`, Boolean(noScroll));
  } else {
    expect(`${locale} processes: the Level 1 panel opened`, false);
  }

  if (await goto(page, `${BASE}/${locale}/processes?view=policy`, '[data-testid="policy-doc-row"]')) {
    const rows = await page.locator('[data-testid="policy-doc-row"]').count();
    const owners = await page.locator('[data-testid="policy-doc-row"] [data-testid="policy-owner"]').count();
    expect(`${locale} processes: the by-policy rows name their custodian`, owners > 0, `${owners} of ${rows} rows`);
    await shot(page, `owners-data-policy-view-${locale}`);
  } else {
    expect(`${locale} processes: the by-policy view opened`, false);
  }

  /* 3. a statistics indicator: the head of its own department */
  if (await goto(page, `${BASE}/${locale}/statistics/${INDICATOR_ID}`, '[data-testid="owner-control"][data-role="department_owner"]')) {
    expect(`${locale} statistics: the indicator names its department owner`, true);
    await shot(page, `owners-data-statistics-${locale}`);
  } else {
    expect(`${locale} statistics: the indicator names its department owner`, false);
  }

  /* 4. the international index that mirrors that series */
  if (await goto(page, `${BASE}/${locale}/indices/${INDEX_CODE}`, '[data-testid="index-page"]')) {
    const chip = await page.locator('[data-testid="index-statistics-owner"] [data-testid="owner-control"]').count();
    const entity = await page.locator('[data-testid="index-statistics-chip"]').count();
    expect(`${locale} indices: the linked national series brings its department owner`, chip === 1, `${chip}`);
    expect(`${locale} indices: the Statistics Hub chip is still there`, entity === 1, `${entity}`);
    await shot(page, `owners-data-index-${locale}`);
  } else {
    expect(`${locale} indices: the index page opened`, false);
  }

  /* 5. search results: documents and lessons with their people */
  for (const q of ["data", "data quality", "linkage"]) {
    if (!(await goto(page, `${BASE}/${locale}/search?q=${encodeURIComponent(q)}`, '[data-testid="result-count"]'))) continue;
    const docs = await page.locator('[data-testid="result-document"]').count();
    const lessons = await page.locator('[data-testid="result-lesson"]').count();
    const owners = await page.locator('[data-testid="result-owner"]').count();
    console.log(`  search "${q}": ${docs} documents, ${lessons} lessons, ${owners} owner chips`);
    if (docs && lessons) {
      expect(`${locale} search: documents and lessons both answer "${q}"`, true, `${docs} + ${lessons}`);
      expect(`${locale} search: the rows carry the person chip`, owners > 0, `${owners} chips`);
      await shot(page, `owners-data-search-${locale}`);
      const noScroll = await page.evaluate(NO_H_SCROLL);
      expect(`${locale} search: no horizontal growth`, Boolean(noScroll));
      /* the row is still one click into the item */
      const href = await page.locator('[data-testid="result-document"] [data-testid="result-link"]').first().getAttribute("href");
      expect(`${locale} search: the result title still links to the item`, Boolean(href && href.includes("/vault/")), String(href));
      /* and the person chip beside it opens the card instead of navigating */
      const beforeUrl = page.url();
      await page.locator('[data-testid="result-owner"] [data-testid="owner-control-trigger"]').first().click();
      await page.locator('[data-testid="person-card-popover"]').first().waitFor({ state: "visible", timeout: 120000 });
      await page.locator('[data-testid="person-card"]').first().waitFor({ state: "visible", timeout: 120000 });
      expect(`${locale} search: the person chip opens the card and does not follow the row link`, page.url() === beforeUrl, page.url());
      await shot(page, `owners-data-search-card-${locale}`);
      await page.keyboard.press("Escape");
      break;
    }
  }

  /* 6. an Ask conversation and its citation cards */
  if (askConversationId) {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(ctx2, "analyst@npc.qa");
    const askPage = await ctx2.newPage();
    watch(askPage, errors);
    if (await goto(askPage, `${BASE}/${locale}/ask/c/${askConversationId}`, '[data-testid="citation-row"]')) {
      const rows = await askPage.locator('[data-testid="citation-row"]').count();
      const owners = await askPage.locator('[data-testid="citation-owner"]').count();
      expect(`${locale} ask: the citation cards carry the person chip`, owners > 0, `${owners} of ${rows} citations`);
      /* the sources sit under the floating composer: bring them up to be seen */
      await askPage.locator('[data-testid="citation-row"]').last().scrollIntoViewIfNeeded();
      await askPage.waitForTimeout(400);
      await shot(askPage, `owners-data-ask-${locale}`);
      const noScroll = await askPage.evaluate(NO_H_SCROLL);
      expect(`${locale} ask: no horizontal growth`, Boolean(noScroll));
      /* the chip opens the card; the row itself still opens the document */
      const askUrl = askPage.url();
      await askPage.locator('[data-testid="citation-owner"] [data-testid="owner-control-compact"]').first().click();
      await askPage.locator('[data-testid="person-card-popover"]').first().waitFor({ state: "visible", timeout: 120000 });
      await askPage.locator('[data-testid="person-card"]').first().waitFor({ state: "visible", timeout: 120000 });
      expect(`${locale} ask: the citation chip opens the card, not the source`, askPage.url() === askUrl, askPage.url());
      await shot(askPage, `owners-data-ask-card-${locale}`);
      await askPage.keyboard.press("Escape");
      await askPage.waitForTimeout(300);
      await askPage.locator('[data-testid="citation-row"] a').first().click();
      await askPage.waitForURL(/\/(vault|statistics|strategy|lessons)\//, { timeout: 120000 }).catch(() => undefined);
      expect(`${locale} ask: the citation row still opens its source`, /\/(vault|statistics|strategy|lessons)\//.test(askPage.url()), askPage.url());
    } else {
      expect(`${locale} ask: the conversation opened with its citations`, false);
    }
    await ctx2.close();
  }

  for (const e of errors.slice(0, 8)) problems.push(`${locale} ${e}`);
  await ctx.close();
}

/** Asks one question through /api/v1/ai/ask so the answer is persisted with
    citations that carry their owner; returns the conversation id. */
async function askOnce(browser: Browser): Promise<string | null> {
  const ctx = await browser.newContext();
  await login(ctx, "analyst@npc.qa");
  const page = await ctx.newPage();
  try {
    const res = await page.request.post(`${BASE}/api/v1/ai/ask`, {
      data: { query: "What does the Third National Development Strategy say about data governance?", locale: "en" },
      timeout: 300000,
    });
    const text = await res.text();
    const meta = /event: meta\ndata: (.*)/.exec(text);
    const sources = /event: sources\ndata: (.*)/.exec(text);
    const conversationId = meta ? (JSON.parse(meta[1]).conversationId as string) : null;
    let withOwner = 0;
    let total = 0;
    if (sources) {
      const citations = JSON.parse(sources[1]).citations as { resource_type: string; owner?: { nameEn: string; role: string } | null }[];
      total = citations.length;
      withOwner = citations.filter((c) => c.owner).length;
      console.log(`  ask sources: ${withOwner} of ${total} citations carry an owner`);
    }
    expect("ask: the streamed citations carry their owner", withOwner > 0, `${withOwner} of ${total}`);
    return conversationId;
  } catch (e) {
    expect("ask: /api/v1/ai/ask answered", false, String(e).slice(0, 120));
    return null;
  } finally {
    await ctx.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { rawClient } = await import("../../src/server/db/client");
  const unit = await rawClient.execute("select id, name_en from org_units where code = 'EDP' limit 1");
  const unitId = unit.rows[0]?.id as string | undefined;
  const before = await rawClient.execute({ sql: "select department_id from indicators where id = ?", args: [INDICATOR_ID] });
  const previous = (before.rows[0]?.department_id ?? null) as string | null;
  if (unitId) {
    await rawClient.execute({ sql: "update indicators set department_id = ? where id = ?", args: [unitId, INDICATOR_ID] });
    console.log(`temporary: indicator ${INDICATOR_ID} department = EDP (${unitId})`);
  }

  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const conversationId = await askOnce(browser);
    for (const locale of ["en", "ar"] as const) {
      if (ONLY !== "all" && ONLY !== locale) continue;
      await runLocale(browser, locale, conversationId);
    }
  } finally {
    await browser.close();
    await rawClient.execute({ sql: "update indicators set department_id = ? where id = ?", args: [previous, INDICATOR_ID] });
    console.log(`restored: indicator ${INDICATOR_ID} department = ${previous ?? "null"}`);
  }

  console.log("\n== notes");
  for (const n of notes) console.log(`  ${n}`);
  console.log("\n== problems");
  if (!problems.length) console.log("  none");
  for (const p of problems) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
