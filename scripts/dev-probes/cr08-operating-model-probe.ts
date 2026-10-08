/* eslint-disable no-console */
// CR08 10.2: Playwright pass over the Operating Model page in both locales at
// 1440 and 390 against the shared dev server. As the Super Admin: the hero
// and principles, the governance map with a body opened, the RACI with a
// cell edited (and the refused second A shown as a toast), the ring calendar
// with a popover, the chord with a hovered unit, the KPI tiles. As the
// Department Head: the propose-change dialog. Console errors, page errors,
// raw i18n keys and horizontal overflow are collected as problems.
// Screenshots land in data/screenshots/cr08/operating-model-*.png.
//   npx tsx scripts/dev-probes/cr08-operating-model-probe.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

const problems: string[] = [];
const notes: string[] = [];

async function login(page: Page, email: string) {
  let status = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: "EnviroAI!2026" },
        timeout: 120000,
      });
      status = res.status();
      if (status === 200) return;
    } catch (e) {
      console.log(`  login attempt ${attempt + 1} failed: ${String(e).slice(0, 80)}`);
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`login ${email} -> ${status}`);
}

async function settled(page: Page) {
  await page
    .waitForFunction(
      "[...document.querySelectorAll('main [style*=opacity]')].every((el) => parseFloat(getComputedStyle(el).opacity) >= 0.99)",
      undefined,
      { timeout: 60000 }
    )
    .catch(() => {});
  await page.waitForTimeout(450);
}

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-testid=operating-model-page]", { timeout: 120000 });
  await settled(page);
}

async function shoot(page: Page, name: string) {
  await settled(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("  shot", name);
}

async function scrollTo(page: Page, id: string, offset = 96) {
  await page.evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - ${offset}; window.scrollTo(0, y); } })()`);
  await page.waitForTimeout(500);
}

async function rawKeys(page: Page, label: string) {
  const text = await page.evaluate("document.body.innerText");
  const hits = String(text).match(/\b(operatingModel|people|common)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? [];
  if (hits.length) problems.push(`${label}: raw keys ${[...new Set(hits)].join(", ")}`);
}

async function noOverflow(page: Page, label: string) {
  const wide = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
  if (wide) problems.push(`${label}: page scrolls horizontally`);
}

async function count(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

async function adminPass(page: Page, locale: "en" | "ar", width: number) {
  const tag = width === 390 ? `${locale}-390` : locale;
  console.log(`admin ${locale} @${width}`);
  await open(page, `${BASE}/${locale}/operating-model`);
  await rawKeys(page, `page ${tag}`);
  await noOverflow(page, `page ${tag}`);

  /* the seven anchors and the hero */
  for (const id of ["om-principles", "om-governance", "om-processes", "om-raci", "om-calendar", "om-interfaces", "om-kpis"]) {
    if (!(await count(page, `#${id}`))) problems.push(`${tag}: missing section #${id}`);
  }
  if (!(await count(page, "[data-testid=internal-chip]"))) problems.push(`${tag}: no Internal chip`);
  if (!(await count(page, "[data-testid=illustrative-chip]"))) problems.push(`${tag}: no Illustrative chip`);
  const principles = await count(page, "[data-testid=om-principle]");
  if (principles < 5 || principles > 7) problems.push(`${tag}: ${principles} principles on screen`);
  await shoot(page, `operating-model-hero-${tag}`);

  /* governance: open the first body */
  await scrollTo(page, "om-governance");
  const bodies = await count(page, "[data-testid=governance-body]");
  if (bodies < 8) problems.push(`${tag}: ${bodies} governance bodies`);
  const connectors = await count(page, "[data-testid=governance-connectors] path[data-kind]");
  if (connectors < 8) problems.push(`${tag}: ${connectors} governance connectors drawn`);
  await page.locator("[data-testid=governance-body] button").nth(2).click();
  await page.waitForTimeout(450);
  await shoot(page, `operating-model-governance-${tag}`);
  await page.locator("[data-testid=governance-body] button").nth(2).click();

  /* the chain */
  await scrollTo(page, "om-processes");
  const chain = await count(page, "[data-testid=chain-card]");
  if (chain !== 8) problems.push(`${tag}: ${chain} chain cards`);
  const href = await page.locator("[data-testid=chain-card]").first().getAttribute("href");
  if (!href || !/\/processes\?p=P1$/.test(href)) problems.push(`${tag}: first chain card links to ${href}`);
  if (width === 1440) await shoot(page, `operating-model-processes-${tag}`);

  /* RACI: edit a cell as admin (blank -> R, then A refused), then clear with Delete */
  await scrollTo(page, "om-raci");
  const table = await count(page, "[data-testid=raci-grid][role=table]");
  if (!table) problems.push(`${tag}: no RACI grid with role=table`);
  const cells = await count(page, "[data-testid=raci-cell]");
  if (cells < 400) problems.push(`${tag}: ${cells} RACI cells`);
  const firstBlank = page.locator("[data-testid=raci-row]").first().locator("[data-testid=raci-cell][data-role='']").first();
  await firstBlank.scrollIntoViewIfNeeded();
  await page.evaluate("window.scrollBy(0, -140)");
  /* the cell is then addressed by its own coordinates: "the first blank cell"
     moves as soon as the write lands, and the matrix is full of other R cells */
  const cellRow = await firstBlank.getAttribute("data-r");
  const cellCol = await firstBlank.getAttribute("data-c");
  const target = page.locator(`[data-testid=raci-cell][data-r="${cellRow}"][data-c="${cellCol}"]`);
  const roleOf = async () => target.getAttribute("data-role");
  const cellSelector = `[data-testid=raci-cell][data-r="${cellRow}"][data-c="${cellCol}"]`;
  const waitForRole = (role: string, timeout = 60000) =>
    page.waitForFunction(
      `(() => { const el = document.querySelector('${cellSelector}'); return el && el.getAttribute('data-role') === '${role}'; })()`,
      undefined,
      { timeout }
    );
  /* the cell carries aria-busy while its write is in flight and the component
     ignores a second write until it lands: every step waits for that */
  const waitIdle = () =>
    page.waitForFunction(
      `(() => { const el = document.querySelector('${cellSelector}'); return el && !el.hasAttribute('aria-busy'); })()`,
      undefined,
      { timeout: 90000 }
    );
  await target.click();
  await waitForRole("R").catch(async () => problems.push(`${tag}: the RACI cell did not turn R (${await roleOf()})`));
  await waitIdle().catch(() => problems.push(`${tag}: the RACI write never settled`));
  await page.waitForTimeout(300);
  if ((await roleOf()) === "R") {
    await target.click(); // R -> A: refused with a toast, the cell rolls back to R
    // the optimistic A is only on screen until the 409 answers: a miss is not a defect
    await waitForRole("A", 8000).catch(() => notes.push(`${tag}: the optimistic A was already rolled back when polled`));
    await page.waitForSelector("[role=status]", { timeout: 60000 }).catch(() => problems.push(`${tag}: no toast after the refused A`));
    // the shared dev server can take seconds to answer: wait for the rollback
    await waitForRole("R").catch(async () => problems.push(`${tag}: after the refused A the cell reads "${await roleOf()}", expected R`));
    await waitIdle().catch(() => problems.push(`${tag}: the refused A never settled`));
  }
  await shoot(page, `operating-model-raci-${tag}`);
  await target.focus();
  const focused = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')");
  if (focused !== "raci-cell") problems.push(`${tag}: focus did not land on the cell before Delete (${focused})`);
  await page.keyboard.press("Delete");
  await waitForRole("").catch(async () => problems.push(`${tag}: Delete did not clear the cell (${await roleOf()})`));
  await waitIdle().catch(() => problems.push(`${tag}: the cleared cell never settled`));
  // keyboard: the arrow moves focus to the next cell along the reading direction
  await target.focus();
  await page.keyboard.press(locale === "ar" ? "ArrowLeft" : "ArrowRight");
  const focusedC = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-c')");
  if (focusedC !== String(Number(cellCol) + 1)) problems.push(`${tag}: arrow key moved focus from column ${cellCol} to ${focusedC}`);

  /* the calendar: a popover on an event of the selected month */
  await scrollTo(page, "om-calendar");
  const ring = await count(page, "svg[data-testid=calendar-ring]");
  if (!ring) problems.push(`${tag}: no calendar ring svg`);
  const events = await count(page, "[data-testid=calendar-event]");
  if (events < 60) problems.push(`${tag}: ${events} calendar events on the ring`);
  const listItems = await count(page, "[data-testid=calendar-list-item]");
  const monthTitle = ((await page.locator("[data-testid=calendar-month-title]").textContent()) ?? "").trim();
  notes.push(`${tag}: ${events} ring events, ${listItems} in ${monthTitle}`);
  // open the first event of the selected month through its dot
  const firstItemTitle = await page.locator("[data-testid=calendar-list-item] button").first().textContent().catch(() => null);
  const dots = page.locator("[data-testid=calendar-event]");
  const total = await dots.count();
  let opened = false;
  for (let i = 0; i < total && !opened; i++) {
    const label = (await dots.nth(i).getAttribute("aria-label")) ?? "";
    if (firstItemTitle && label.startsWith(firstItemTitle.trim().slice(0, 20))) {
      await dots.nth(i).click({ force: true });
      opened = true;
    }
  }
  if (!opened) await dots.first().click({ force: true });
  await page.waitForSelector("[data-testid=calendar-popover]", { timeout: 15000 }).catch(() => problems.push(`${tag}: the event popover did not open`));
  await page.waitForTimeout(300);
  const popoverFocus = await page.evaluate("document.activeElement && document.activeElement.closest('[data-testid=calendar-popover]') !== null");
  if (!popoverFocus) problems.push(`${tag}: focus did not move into the popover`);
  await shoot(page, `operating-model-calendar-${tag}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await count(page, "[data-testid=calendar-popover]")) problems.push(`${tag}: Escape did not close the popover`);

  /* the year switcher */
  if (width === 1440) {
    await page.locator("[data-testid=calendar-year-switch] button").last().click();
    await page.waitForFunction("document.querySelector('[data-testid=calendar-year]') && /2027|٢٠٢٧/.test(document.querySelector('[data-testid=calendar-year]').textContent)", undefined, { timeout: 60000 }).catch(() => problems.push(`${tag}: the year did not move to 2027`));
    await page.waitForTimeout(300);
    const url = page.url();
    if (!/year=2027/.test(url)) problems.push(`${tag}: ?year= not written after switching (${url})`);
    await page.locator("[data-testid=calendar-year-switch] button").first().click();
    await page.waitForTimeout(1500);
  }

  /* the interfaces: matrix, chord hover, list */
  await scrollTo(page, "om-interfaces");
  const entities = await count(page, "[data-testid=entity-card]");
  if (entities !== 10) problems.push(`${tag}: ${entities} entity cards`);
  const matrix = await count(page, "[data-testid=interface-matrix][role=table]");
  if (!matrix) problems.push(`${tag}: no interface matrix with role=table`);
  const chord = await count(page, "svg[data-testid=chord-diagram]");
  if (!chord) problems.push(`${tag}: no chord svg`);
  const ribbons = await count(page, "[data-testid=chord-ribbon]");
  if (ribbons < 15) problems.push(`${tag}: ${ribbons} chord ribbons`);
  await page.locator("svg[data-testid=chord-diagram]").scrollIntoViewIfNeeded();
  await page.evaluate("window.scrollBy(0, -120)");
  await page.waitForTimeout(300);
  const soa = page.locator("[data-testid=chord-unit][data-code=SOA]");
  if (await soa.count()) {
    await soa.hover({ force: true });
    await page.waitForTimeout(350);
    if (!(await count(page, "[data-testid=chord-focus]"))) problems.push(`${tag}: hovering SOA showed no focus caption`);
  } else {
    problems.push(`${tag}: no SOA arc on the chord`);
  }
  await shoot(page, `operating-model-chord-${tag}`);
  // click selects and filters the list
  if (await soa.count()) {
    await soa.click({ force: true });
    await page.waitForTimeout(400);
    const shown = await count(page, "[data-testid=interface-card]");
    const soaCards = await count(page, "[data-testid=interface-card][data-from=SOA], [data-testid=interface-card][data-to=SOA]");
    if (shown !== soaCards || shown < 5) problems.push(`${tag}: selecting SOA shows ${shown} cards (${soaCards} touch SOA)`);
    notes.push(`${tag}: SOA filter shows ${shown} interfaces`);
    await page.mouse.move(5, 5);
    await soa.click({ force: true });
    await page.waitForTimeout(300);
  }
  const focals = await count(page, "[data-testid=interface-card] [data-testid=owner-control-compact]");
  if (focals < 20) problems.push(`${tag}: ${focals} OwnerControl focal points in the list`);
  if (width === 1440) {
    await page.locator("[data-testid=interface-list]").scrollIntoViewIfNeeded();
    await page.evaluate("window.scrollBy(0, -100)");
    await shoot(page, `operating-model-interfaces-${tag}`);
  }

  /* the KPIs */
  await scrollTo(page, "om-kpis");
  const tiles = await count(page, "[data-testid=kpi-tile]");
  if (tiles !== 5) problems.push(`${tag}: ${tiles} KPI tiles`);
  const sparks = await count(page, "[data-testid=kpi-sparkline]");
  if (sparks < 5) problems.push(`${tag}: ${sparks} sparklines`);
  await shoot(page, `operating-model-kpis-${tag}`);
  if (width === 1440 && locale === "en") {
    await page.locator("[data-testid=kpi-enter]").first().click();
    await page.waitForSelector("[data-testid=kpi-dialog]", { timeout: 15000 }).catch(() => problems.push(`${tag}: the enter-value dialog did not open`));
    await shoot(page, `operating-model-kpi-dialog-${tag}`);
    await page.keyboard.press("Escape");
  }

  /* the section nav reflects the scroll position */
  const current = await page.locator("[data-testid=om-nav] a[aria-current=location]").getAttribute("data-testid").catch(() => null);
  if (current !== "om-nav-kpis") problems.push(`${tag}: nav highlights ${current} at the KPIs`);
}

async function headPass(page: Page, locale: "en" | "ar") {
  console.log(`head.stats ${locale}`);
  await open(page, `${BASE}/${locale}/operating-model`);
  await rawKeys(page, `head ${locale}`);
  if (await count(page, "[data-testid=principle-edit]")) problems.push(`${locale}: the unit head sees principle editing`);
  if (await count(page, "[data-testid=kpi-enter]")) problems.push(`${locale}: the unit head sees Enter value`);
  const note = ((await page.locator("[data-testid=om-edit-note]").textContent()) ?? "").trim();
  notes.push(`${locale}: head note "${note.slice(0, 60)}"`);
  await scrollTo(page, "om-interfaces");
  const propose = page.locator("[data-testid=interface-propose]");
  const n = await propose.count();
  if (!n) {
    problems.push(`${locale}: the unit head has no Propose a change button`);
    return;
  }
  notes.push(`${locale}: head can propose on ${n} interfaces`);
  await propose.first().scrollIntoViewIfNeeded();
  await propose.first().click();
  await page.waitForSelector("[data-testid=propose-dialog]", { timeout: 15000 });
  await page.fill("[data-testid=propose-text]", locale === "ar" ? "نقترح تقليص مستوى الخدمة إلى ثلاثة أيام عمل مع إشعار مسبق." : "Move the service level to three working days with an advance notice.");
  await page.waitForTimeout(300);
  await shoot(page, `operating-model-propose-${locale}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

/* The whole pass takes longer than one shell call allows on this machine, so
   it runs in stages: PROBE_ONLY=admin-en|admin-ar|m-en|m-ar|head (comma
   separated, default all). */
const STAGES = (process.env.PROBE_ONLY ?? "admin-en,admin-ar,m-en,m-ar,head").split(",").map((s) => s.trim()).filter(Boolean);
const wants = (stage: string) => STAGES.includes(stage);

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  /* The dev server is shared with the other CR08 agents and recompiles under
     them: a dropped connection or a chunk that arrives half written is noted,
     not counted as a defect of this page. Everything else is a problem. */
  const environmental = /ERR_CONNECTION_(RESET|REFUSED|CLOSED|ABORTED)|ERR_ABORTED|Failed to fetch RSC payload|ChunkLoadError|Loading chunk|Invalid or unexpected token/;
  /* the probe asks for a second accountable unit on purpose: the browser logs
     the refusal the page handles with a toast */
  const expected = /status of 409 \(Conflict\)/;
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      if (/favicon|404 \(Not Found\)/.test(text)) return;
      if (environmental.test(text)) {
        notes.push(`dev server blip: ${text.slice(0, 120)}`);
        return;
      }
      if (expected.test(text)) {
        notes.push(`expected refusal logged by the browser: ${text.slice(0, 120)}`);
        return;
      }
      problems.push(`console: ${text.slice(0, process.env.PROBE_FULL === "1" ? 6000 : 300)}`);
    }
  });
  page.on("pageerror", (e) => {
    const text = String(e);
    if (environmental.test(text)) {
      notes.push(`dev server blip: ${text.slice(0, 120)}`);
      return;
    }
    problems.push(`pageerror: ${text.slice(0, 300)}`);
  });

  if (wants("admin-en") || wants("admin-ar") || wants("m-en") || wants("m-ar")) {
    await login(page, "admin@enviroai.demo");
    if (wants("admin-en")) await adminPass(page, "en", 1440);
    if (wants("admin-ar")) await adminPass(page, "ar", 1440);
    if (wants("m-en") || wants("m-ar")) {
      await page.setViewportSize({ width: 390, height: 844 });
      if (wants("m-en")) await adminPass(page, "en", 390);
      if (wants("m-ar")) await adminPass(page, "ar", 390);
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }

  if (wants("head")) {
    await context.clearCookies();
    await login(page, "head.stats@enviroai.demo");
    for (const locale of ["en", "ar"] as const) await headPass(page, locale);

    // a reader whose portal is hidden gets the 404 (per-user deny override, removed afterwards)
    const { rawClient } = await import("../../src/server/db/client");
    const reader = await rawClient.execute("select id from users where email = 'reader@enviroai.demo'");
    const readerId = String(reader.rows[0]?.id ?? "");
    if (readerId) {
      await context.clearCookies();
      await login(page, "reader@enviroai.demo");
      const okRes = await page.context().request.get(`${BASE}/en/operating-model`, { timeout: 120000 });
      if (okRes.status() !== 200) problems.push(`reader with the portal gets ${okRes.status()}`);
      await rawClient.execute({
        sql: "insert into user_permission_overrides (id, user_id, permission_key, effect, reason, set_by, set_at) values (?, ?, 'portal:operating_model', 'deny', 'probe', null, ?)",
        args: ["probe-om-deny", readerId, new Date().toISOString()],
      });
      try {
        const hidden = await page.context().request.get(`${BASE}/en/operating-model`, { timeout: 120000 });
        if (hidden.status() !== 404) problems.push(`reader without the portal gets ${hidden.status()}, expected 404`);
        notes.push(`reader without the portal: ${hidden.status()}`);
      } finally {
        await rawClient.execute("delete from user_permission_overrides where id = 'probe-om-deny'");
      }
    }
  }

  await browser.close();
}

main()
  .catch((e) => {
    problems.push(`crash: ${String(e).slice(0, 400)}`);
  })
  .finally(() => {
    if (notes.length) console.log(`\nnotes:\n- ${notes.join("\n- ")}`);
    console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nno problems found");
    process.exit(problems.length ? 1 : 0);
  });
