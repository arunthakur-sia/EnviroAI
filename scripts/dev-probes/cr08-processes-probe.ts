/* eslint-disable no-console */
// CR08 10.1: drives /processes in system Edge against the shared dev server,
// in both locales at 1440x900 and 390x844, and writes screenshots to
// data/screenshots/cr08/processes-*.png: the map, a Level 0 expanded, the
// process panel with its steps and mini shelf, the RACI editor as admin, the
// add and edit dialogs, the by-unit and by-policy views, and the keyboard
// model. Every page.evaluate is passed a STRING (tsx's __name helper is not
// defined in the browser).
//   npx tsx scripts/dev-probes/cr08-processes-probe.ts [en|ar|all]
import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const ONLY = process.argv[2] ?? "all";
const PASSWORD = "EnviroAI!2026";
const NAV = { waitUntil: "networkidle" as const, timeout: 120000 };
/** the process API answers in 8 to 25 seconds while the shared server is under load */
const PANEL_WAIT = 120000;

const problems: string[] = [];
const notes: string[] = [];
function expect(name: string, ok: boolean, detail?: string) {
  (ok ? notes : problems).push(`${ok ? "ok " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

/** The shared dev server is busy with other agents' probes: retry the login. */
async function login(ctx: BrowserContext, email: string) {
  const page = await ctx.newPage();
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: PASSWORD }, timeout: 120000 });
      console.log(`login ${email}: ${res.status()}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
      if (res.status() === 200) break;
    } catch (e) {
      console.log(`login ${email}: ${String(e).slice(0, 80)} (attempt ${attempt})`);
    }
    await page.waitForTimeout(4000);
  }
  await page.close();
}

/** Hydration notes that belong to the shell, not to this module. */
const KNOWN_SHELL = [/<SettingsTabs/, /radix-_R_/, /A tree hydrated but some attributes/];

function watch(page: Page, errors: string[]) {
  const push = (text: string) => {
    if (KNOWN_SHELL.some((re) => re.test(text))) {
      const line = `note (shell) ${text.replace(/\s+/g, " ").slice(0, 120)}`;
      notes.push(line);
      console.log(`  ${line}`);
      return;
    }
    errors.push(text);
  };
  page.on("console", (m) => {
    if (m.type() === "error") push(`console: ${m.text().replace(/\s+/g, " ").slice(0, 1500)}`);
  });
  page.on("pageerror", (e) => push(`pageerror: ${String(e).slice(0, 600)}`));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}.png`);
}

/** Navigates, then waits for the page to say it has hydrated (data-ready). */
async function gotoRetry(page: Page, url: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url, NAV);
      await page.waitForSelector("[data-testid=processes-page][data-ready]", { timeout: PANEL_WAIT });
      return;
    } catch (e) {
      console.log(`  goto ${url}: ${String(e).slice(0, 80)} (attempt ${attempt})`);
      if (attempt === 2) throw e;
    }
  }
}

const NO_GROWTH = "document.documentElement.scrollWidth <= window.innerWidth";
const ACTIVE_CODE = "(document.activeElement && document.activeElement.getAttribute('data-code')) || null";

async function desktop(browser: import("playwright").Browser, locale: "en" | "ar") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(ctx, "admin@enviroai.demo");
  const page = await ctx.newPage();
  const errors: string[] = [];
  watch(page, errors);
  const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
  console.log(`== desktop ${locale}`);

  /* the map */
  await gotoRetry(page, `${BASE}/${locale}/processes`);
  await page.waitForSelector("[data-testid=process-l0-card]", { timeout: 60000 });
  await page.waitForTimeout(900);
  const cards = await page.locator("[data-testid=process-l0-card]").count();
  expect(`${locale}: eight Level 0 cards`, cards === 8, `${cards}`);
  expect(`${locale}: no horizontal page growth on the map`, (await page.evaluate(NO_GROWTH)) as boolean);
  const scrollable = (await page.evaluate("(() => { const el = document.querySelector('[data-testid=process-map-scroll]'); return el ? el.scrollWidth - el.clientWidth : -1; })()")) as number;
  expect(`${locale}: the chain fits at 1440 without scrolling`, scrollable <= 4, `${scrollable}px overflow`);
  await shot(page, `processes-map-${locale}`);

  /* keyboard: arrows move, Enter expands, Escape collapses */
  await page.locator("[data-testid=process-l0-card]").first().focus();
  await page.keyboard.press(forward);
  expect(`${locale}: the forward arrow moves focus to P2`, (await page.evaluate(ACTIVE_CODE)) === "P2", String(await page.evaluate(ACTIVE_CODE)));
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid=level1-panel][data-code=P2]", { timeout: 20000 });
  expect(`${locale}: Enter expands P2 in place and the URL carries l0=P2`, page.url().includes("l0=P2"), page.url());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  expect(`${locale}: Escape collapses the chain`, (await page.locator("[data-testid=level1-panel]").count()) === 0);

  /* expand P4 by click */
  await page.locator("[data-testid=process-l0-card][data-code=P4]").click();
  await page.waitForSelector("[data-testid=level1-panel][data-code=P4]", { timeout: 20000 });
  await page.waitForTimeout(700);
  const l1 = await page.locator("[data-testid=process-l1-row]").count();
  expect(`${locale}: P4 expands to its Level 1 processes with nested procedures`, l1 === 3 && (await page.locator("[data-testid=process-l2-row]").count()) >= 2, `${l1} rows`);
  await page.evaluate("document.querySelector('[data-testid=process-map-anchor]').scrollIntoView({ block: 'start' })");
  await page.waitForTimeout(400);
  await shot(page, `processes-l0-expanded-${locale}`);

  /* the panel of P4.3: steps, mini shelf, RACI */
  await page.locator("[data-testid=process-l1-row][data-code='P4.3']").click();
  await page.waitForSelector("[data-testid=process-panel] [data-testid=process-step]", { timeout: PANEL_WAIT });
  await page.waitForTimeout(900);
  const steps = await page.locator("[data-testid=process-step]").count();
  expect(`${locale}: the panel shows P4.3 with its steps`, steps >= 4 && page.url().includes("p=P4.3"), `${steps} steps`);
  expect(`${locale}: the owner block and the Ask button are in the panel`, (await page.locator("[data-testid=process-owner]").count()) === 1 && (await page.locator("[data-testid=process-ask]").count()) === 1);
  /* the purpose in the other language is an island: it runs in its own
     direction and its label starts where the quote starts */
  const quote = (await page.evaluate(
    "(() => { const p = document.querySelector('[data-testid=purpose-other]'); if (!p) return null; const s = getComputedStyle(p); const l = getComputedStyle(p.firstElementChild); const pr = p.getBoundingClientRect(); const lr = p.firstElementChild.getBoundingClientRect(); return { dir: s.direction, align: s.textAlign, labelAlign: l.textAlign, labelAtStart: s.direction === 'ltr' ? Math.round(lr.left - pr.left) < 20 : Math.round(pr.right - lr.right) < 20 }; })()"
  )) as { dir: string; align: string; labelAlign: string; labelAtStart: boolean } | null;
  expect(`${locale}: the other language block runs in its own direction`, Boolean(quote) && quote!.dir === (locale === "ar" ? "ltr" : "rtl") && quote!.labelAtStart, JSON.stringify(quote));
  expect(`${locale}: the panel is 520px wide`, Math.round((await page.evaluate("document.querySelector('[data-testid=process-panel] aside').getBoundingClientRect().width")) as number) === 520);
  await shot(page, `processes-panel-${locale}`);
  const books = await page.locator("[data-testid=process-mini-shelf] [data-testid=book]").count();
  expect(`${locale}: the mini shelf carries P4.3's SOP`, books >= 1, `${books} books`);
  await page.evaluate("document.querySelector('[data-testid=process-mini-shelf]').scrollIntoView({ block: 'start' })");
  await page.waitForTimeout(400);
  await shot(page, `processes-panel-shelf-${locale}`);

  /* the RACI editor as admin */
  await page.evaluate("document.querySelector('[data-testid=process-raci]').scrollIntoView({ block: 'center' })");
  await page.locator("[data-testid=raci-edit]").click();
  await page.waitForSelector("[data-testid=raci-role-select]", { timeout: 10000 });
  expect(`${locale}: the RACI editor opens with a role select per unit`, (await page.locator("[data-testid=raci-role-select]").count()) >= 2);
  await shot(page, `processes-raci-editor-${locale}`);
  await page.locator("[data-testid=raci-done]").click();

  /* the edit dialog, then Escape closes it and leaves the panel */
  await page.locator("[data-testid=process-edit]").click();
  await page.waitForSelector("[data-testid=process-editor]", { timeout: 10000 });
  await page.waitForTimeout(500);
  const stepsInEditor = await page.locator("[data-testid=editor-step]").count();
  expect(`${locale}: the edit dialog carries the steps editor`, stepsInEditor >= 4, `${stepsInEditor}`);
  if (locale === "en") await shot(page, `processes-edit-dialog-${locale}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  expect(`${locale}: Escape closes the dialog and keeps the panel`, (await page.locator("[data-testid=process-editor]").count()) === 0 && (await page.locator("[data-testid=process-panel]").count()) === 1);

  /* breadcrumbs navigate the panel; Escape closes it */
  await page.locator("[data-testid=process-breadcrumb] button").first().click();
  await page.waitForSelector("[data-testid=process-panel][data-code=P4] [data-testid=process-title]", { timeout: PANEL_WAIT });
  expect(`${locale}: the breadcrumb moves the panel to P4`, page.url().includes("p=P4"), page.url());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  expect(`${locale}: Escape closes the panel`, (await page.locator("[data-testid=process-panel]").count()) === 0);

  /* the add dialog */
  await page.locator("[data-testid=processes-add]").click();
  await page.waitForSelector("[data-testid=process-editor]", { timeout: 10000 });
  await page.waitForTimeout(500);
  const suggested = await page.locator("[data-testid=editor-code]").inputValue();
  expect(`${locale}: the add dialog suggests the next Level 0 code`, /^P\d+$/.test(suggested), suggested);
  await shot(page, `processes-add-dialog-${locale}`);

  /* create a process through the UI, then delete it through the panel (English only) */
  if (locale === "en") {
    await page.locator("[data-testid=editor-level]").selectOption("1");
    const parentOptions = await page.locator("[data-testid=editor-parent] option").count();
    expect("en: the parent picker lists the Level 0 processes", parentOptions >= 9, `${parentOptions} options`);
    await page.locator("[data-testid=editor-parent]").selectOption({ label: "P8 · Institutional development" });
    await page.locator("[data-testid=editor-code]").fill("P8.PROBE");
    await page.locator("[data-testid=editor-name-en]").fill("Probe process");
    await page.locator("[data-testid=editor-name-ar]").fill("عملية تجريبية");
    await page.locator("[data-testid=editor-add-step]").click();
    await page.locator("[data-testid=editor-step] input").first().fill("A first step");
    await page.locator("[data-testid=editor-save]").click();
    try {
      await page.waitForSelector("[data-testid=process-panel][data-code='P8.PROBE'] [data-testid=process-title]", { timeout: PANEL_WAIT });
      expect("en: saving the dialog opens the new process in the panel", true);
      await page.waitForTimeout(600);
      await page.locator("[data-testid=process-delete]").click();
      await page.waitForSelector("[data-testid=process-delete-dialog]", { timeout: 10000 });
      await page.locator("[data-testid=process-delete-confirm]").click();
      /* the shared server answers a write in 5 to 30 seconds under load */
      await page.waitForSelector("[data-testid=process-panel]", { state: "detached", timeout: PANEL_WAIT });
      expect("en: deleting closes the panel", (await page.locator("[data-testid=process-panel]").count()) === 0);
    } catch (e) {
      expect("en: saving the dialog opens the new process in the panel", false, String(e).slice(0, 120));
    } finally {
      /* leave the seed as it was found (the shared server can be slow) */
      try {
        const read = await page.request.get(`${BASE}/api/v1/processes/P8.PROBE`, { timeout: PANEL_WAIT });
        if (read.status() === 200) {
          const id = ((await read.json()) as { data: { id: string } }).data.id;
          await page.request.delete(`${BASE}/api/v1/processes?id=${encodeURIComponent(id)}`, { timeout: PANEL_WAIT });
          console.log("  cleaned up P8.PROBE through the API");
        }
      } catch (e) {
        console.log(`  cleanup skipped: ${String(e).slice(0, 80)}`);
      }
    }
  } else {
    await page.keyboard.press("Escape");
  }

  /* by unit and by policy type */
  await gotoRetry(page, `${BASE}/${locale}/processes?view=unit&unit=SOA`);
  await page.waitForSelector("[data-testid=by-unit-section][data-unit=SOA][data-expanded=true]", { timeout: 60000 });
  await page.waitForTimeout(900);
  expect(`${locale}: the by-unit view opens SOA with its processes and policy tabs`, (await page.locator("[data-testid=process-list-row]").count()) >= 5 && (await page.locator("[data-testid=policy-type-tab]").count()) === 4);
  expect(`${locale}: no horizontal page growth in the by-unit view`, (await page.evaluate(NO_GROWTH)) as boolean);
  await page.evaluate("document.querySelector('[data-testid=by-unit-section][data-unit=SOA]').scrollIntoView({ block: 'start' })");
  await page.waitForTimeout(300);
  await shot(page, `processes-by-unit-${locale}`);
  await page.locator("[data-testid=by-unit-section][data-unit=SOA] [data-testid=policy-type-tab][data-tab=procedure]").click();
  await page.waitForTimeout(400);
  expect(`${locale}: the policy tab switch is deep-linked`, page.url().includes("tab=procedure"), page.url());

  await gotoRetry(page, `${BASE}/${locale}/processes?view=policy&tab=procedure`);
  await page.waitForSelector("[data-testid=by-policy-view]", { timeout: 60000 });
  await page.waitForTimeout(900);
  expect(`${locale}: the by-policy view lists procedures grouped by unit`, (await page.locator("[data-testid=by-policy-group]").count()) >= 1 && (await page.locator("[data-testid=policy-doc-row]").count()) >= 1);
  await shot(page, `processes-by-policy-${locale}`);

  expect(`${locale}: no console or page errors on the desktop pass`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

async function phone(browser: import("playwright").Browser, locale: "en" | "ar") {
  /* hasTouch without isMobile: chromium's mobile emulation sizes a
     position:fixed element against the window rather than the 390px layout
     viewport (window.innerWidth reads 1439), which moves every drawer in the
     app off screen and makes an overflow check meaningless */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await login(ctx, "admin@enviroai.demo");
  const page = await ctx.newPage();
  const errors: string[] = [];
  watch(page, errors);
  console.log(`== phone ${locale}`);
  await gotoRetry(page, `${BASE}/${locale}/processes?l0=P4`);
  await page.waitForSelector("[data-testid=level1-panel]", { timeout: 60000 });
  await page.waitForTimeout(900);
  expect(`${locale} 390: the chain scrolls under a fade mask`, ((await page.evaluate("(() => { const el = document.querySelector('[data-testid=process-map-scroll]'); return el ? el.scrollWidth - el.clientWidth : -1; })()")) as number) > 100);
  expect(`${locale} 390: no horizontal page growth`, (await page.evaluate(NO_GROWTH)) as boolean);
  await shot(page, `processes-map-390-${locale}`);
  await gotoRetry(page, `${BASE}/${locale}/processes?p=P4.1`);
  await page.waitForSelector("[data-testid=process-panel] [data-testid=process-step]", { timeout: PANEL_WAIT });
  await page.waitForTimeout(700);
  expect(`${locale} 390: the panel fills the width`, Math.round((await page.evaluate("document.querySelector('[data-testid=process-panel] aside').getBoundingClientRect().width")) as number) === 390);
  await shot(page, `processes-panel-390-${locale}`);
  expect(`${locale} 390: no console or page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const locales = (ONLY === "all" ? ["en", "ar"] : [ONLY]) as ("en" | "ar")[];
    for (const locale of locales) {
      await desktop(browser, locale);
      await phone(browser, locale);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${notes.length} ok, ${problems.length} problems`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
