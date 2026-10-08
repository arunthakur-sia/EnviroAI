/* eslint-disable no-console */
// CR08 9.1 (library surfaces): a Playwright pass in system Edge over every
// place this task put the owner chip, in both locales, against the shared dev
// server: the Institutional Memory shelves (the owner rides on the hover
// preview of a book) and the list view, a document page, a collection, the
// Studies hero, the Learning Room with a lesson open in the reader, a lesson
// page, the Reports hub and a report, and an Ask conversation with a human
// answer. Two person cards are opened and photographed.
// Screenshots land in data/screenshots/cr08/owners-library-*.png.
//   npx tsx scripts/dev-probes/cr08-owners-library-probe.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "owners-library-console.log");
fs.writeFileSync(LOG, `Owners (library surfaces) probe, ${new Date().toISOString()}\n`);

const problems: string[] = [];

/* Noise from the shared dev server that belongs to other modules or to the
   shell: node: scheme build failures from another module's client bundle, the
   Radix id mismatch on the top bar menus, and connection resets while another
   agent's edit restarts the server. */
const FOREIGN =
  /UnhandledSchemeError|Reading from "node:|radix-_R_|A tree hydrated but some attributes|ERR_CONNECTION|Failed to fetch RSC payload|net::ERR_ABORTED|Failed to load resource/;
const foreign = new Set<string>();

async function login(page: Page, email: string) {
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
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
  await page.waitForTimeout(500);
}

/** Opens a page and waits for a selector; one retry, because the shared dev
    server compiles on demand and other agents restart it. */
async function open(page: Page, url: string, selector: string, tries = 2) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForSelector(selector, { timeout: 120000 });
      await dismissReveal(page);
      await settled(page);
      return true;
    } catch (e) {
      if (attempt === tries) {
        problems.push(`${url}: ${String(e).replace(/\s+/g, " ").slice(0, 140)}`);
        return false;
      }
      console.log(`  ${url} attempt ${attempt}: ${String(e).replace(/\s+/g, " ").slice(0, 90)}`);
      await page.waitForTimeout(6000);
    }
  }
  return false;
}

/** The Knowledge of the Week reveal (CR08 8) opens over the page for anyone
    who has not seen it this week and must go before anything beneath it. */
async function dismissReveal(page: Page) {
  const there = await page
    .waitForSelector("[data-testid=kow-reveal]", { timeout: 1200 })
    .then(() => true)
    .catch(() => false);
  if (!there) return false;
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-testid=kow-reveal]", { state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

/** Next's development error overlay belongs to whichever module failed to
    compile on the shared server; it blurs whatever is under it. */
async function dismissDevOverlay(page: Page) {
  const removed = await page.evaluate(
    "(() => { const p = [...document.querySelectorAll('nextjs-portal')]; p.forEach((el) => el.remove()); return p.length; })()"
  );
  if (removed) await page.waitForTimeout(300);
  return Number(removed) > 0;
}

async function shoot(page: Page, name: string) {
  await dismissDevOverlay(page);
  await settled(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("  shot", name);
}

async function rawKeys(page: Page, label: string) {
  const text = await page.evaluate("document.body.innerText");
  const hits =
    String(text).match(/\b(people|vault|reader|collections|studies|lessons|reports|askPage|common)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? [];
  if (hits.length) problems.push(`${label}: raw keys ${[...new Set(hits)].join(", ")}`);
}

async function noOverflow(page: Page, label: string) {
  const wide = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
  if (wide) problems.push(`${label}: page scrolls horizontally`);
}

/** No owner chip may sit inside a link or a button: that is invalid markup
    and the browser drops the inner control's clicks. */
async function noNestedInteractive(page: Page, label: string) {
  const bad = await page.evaluate(
    "[...document.querySelectorAll('[data-testid=owner-control-compact],[data-testid=owner-control-trigger]')].filter((el) => el.parentElement && el.parentElement.closest('a,button')).length"
  );
  if (Number(bad) > 0) problems.push(`${label}: ${bad} owner chip(s) nested inside a link or a button`);
}

/** Hovers a chip, waits for the person card, checks it loaded, photographs it. */
async function openCard(page: Page, chip: string, name: string, label: string) {
  const el = page.locator(chip).first();
  if (!(await el.count())) {
    problems.push(`${label}: no owner chip to open a card from`);
    return;
  }
  await el.scrollIntoViewIfNeeded();
  await el.hover();
  const opened = await page
    .waitForSelector("[data-testid=person-card-popover]", { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    problems.push(`${label}: the person card did not open on hover`);
    await shoot(page, `${name}-failed`);
    return;
  }
  const loaded = await page
    .waitForSelector("[data-testid=person-card]", { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!loaded) problems.push(`${label}: the person card stayed on its loading or error state`);
  await page.waitForTimeout(400);
  await rawKeys(page, `${label} card`);
  await shoot(page, name);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

type Ids = {
  documentId: string;
  collectionId: string;
  lessonId: string;
  reportId: string;
  questionId: string;
};

async function loadIds(): Promise<Ids> {
  const { rawClient } = await import("../../src/server/db/client");
  const one = async (sql: string) => {
    const res = await rawClient.execute(sql);
    return String(res.rows[0]?.id ?? "");
  };
  return {
    documentId: await one(
      "select d.id from documents d join users u on u.id = d.owner_user_id where d.deleted_at is null and u.deleted_at is null and d.classification_level <= 2 order by d.updated_at desc limit 1"
    ),
    collectionId: await one("select c.id from collections c join users u on u.id = c.owner_user_id limit 1"),
    lessonId: await one(
      "select l.id from lessons l join users u on u.id = l.author_id where l.status in ('published','verified') and l.classification_level <= 2 limit 1"
    ),
    reportId: await one(
      "select r.id from reports r join users u on u.id = r.requested_by where r.type_id is not null order by r.created_at desc limit 1"
    ),
    questionId: await one(
      "select q.id from questions q join answers a on a.question_id = q.id and a.is_ai = 0 and a.author_id is not null where q.classification_level <= 2 group by q.id limit 1"
    ),
  };
}

async function main() {
  const ids = await loadIds();
  console.log("ids", JSON.stringify(ids));
  for (const [k, v] of Object.entries(ids)) if (!v) problems.push(`no seeded row for ${k}`);

  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/favicon|404 \(Not Found\)/.test(text)) return;
    fs.appendFileSync(LOG, `\n[${page.url()}]\n${text}\n`);
    if (FOREIGN.test(text)) {
      foreign.add(text.replace(/\s+/g, " ").slice(0, 100));
      return;
    }
    problems.push(`console on ${page.url()}: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
  });
  page.on("pageerror", (e) => {
    const text = String(e);
    fs.appendFileSync(LOG, `\n[pageerror ${page.url()}]\n${text}\n`);
    if (FOREIGN.test(text)) {
      foreign.add(text.replace(/\s+/g, " ").slice(0, 100));
      return;
    }
    problems.push(`pageerror: ${text.slice(0, 300)}`);
  });

  await login(page, "admin@enviroai.demo");

  for (const locale of ["en", "ar"] as const) {
    const L = (p: string) => `${BASE}/${locale}${p}`;

    /* ---- 1. the shelves: the owner on the hover preview of a book ---- */
    if (await open(page, L("/vault"), "[data-testid=book]")) {
      const book = page.locator("[data-testid=book]").first();
      await book.scrollIntoViewIfNeeded();
      await book.hover();
      const preview = await page
        .waitForSelector("[data-testid=book-preview]", { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (!preview) problems.push(`${locale} shelves: the book preview did not open`);
      else {
        const chip = await page.locator("[data-testid=book-preview] [data-testid=owner-control-compact]").count();
        if (!chip) problems.push(`${locale} shelves: no owner chip on the book preview`);
        await noNestedInteractive(page, `${locale} shelves`);
        await shoot(page, `owners-library-shelf-preview-${locale}`);
        // the person card, opened from inside the preview: the preview must
        // stay alive under it
        await openCard(
          page,
          "[data-testid=book-preview] [data-testid=owner-control-compact]",
          `owners-library-person-card-shelf-${locale}`,
          `${locale} shelf preview`
        );
        const stillThere = await page.locator("[data-testid=book-preview]").count();
        if (!stillThere) problems.push(`${locale} shelves: the preview closed while the person card was open`);
      }
      await noOverflow(page, `${locale} shelves`);
    }

    /* ---- 2. the list view ---- */
    if (await open(page, L("/vault?view=list"), "[data-testid=doc-list-row]")) {
      const rows = await page.locator("[data-testid=doc-list-row]").count();
      const chips = await page.locator("[data-testid=doc-list-row] [data-testid=owner-control-compact]").count();
      console.log(`  ${locale} list: ${chips} owner chips on ${rows} rows`);
      if (!chips) problems.push(`${locale} list: no owner chip on any row`);
      await noNestedInteractive(page, `${locale} list`);
      await rawKeys(page, `${locale} list`);
      await noOverflow(page, `${locale} list`);
      await shoot(page, `owners-library-list-${locale}`);
      // the row link still opens the document
      await page.locator("[data-testid=doc-list-row] a").first().click({ timeout: 60000 }).catch(() => {});
      const navigated = await page
        .waitForURL(/\/vault\/[A-Z0-9]/i, { timeout: 60000 })
        .then(() => true)
        .catch(() => false);
      if (!navigated) problems.push(`${locale} list: the row link no longer opens the document`);
    }

    /* ---- 3. a document page ---- */
    if (ids.documentId && (await open(page, L(`/vault/${ids.documentId}`), "[data-testid=owner-control]"))) {
      const role = await page.getAttribute("[data-testid=owner-control]", "data-role");
      if (role !== "owner") problems.push(`${locale} document: owner control carries role ${role}`);
      await noNestedInteractive(page, `${locale} document`);
      await rawKeys(page, `${locale} document`);
      await noOverflow(page, `${locale} document`);
      await shoot(page, `owners-library-document-${locale}`);
      await openCard(
        page,
        "[data-testid=owner-control-trigger]",
        `owners-library-person-card-document-${locale}`,
        `${locale} document`
      );
    }

    /* ---- 4. a collection ---- */
    if (ids.collectionId && (await open(page, L(`/vault/collections/${ids.collectionId}`), "[data-testid=owner-control]"))) {
      const role = await page.getAttribute("[data-testid=owner-control]", "data-role");
      if (role !== "custodian") problems.push(`${locale} collection: owner control carries role ${role}`);
      await rawKeys(page, `${locale} collection`);
      await noOverflow(page, `${locale} collection`);
      await shoot(page, `owners-library-collection-${locale}`);
    }

    /* ---- 5. Studies ---- */
    if (await open(page, L("/studies"), "[data-testid=studies-page]")) {
      const hero = await page.locator("[data-testid=featured-study] [data-testid=owner-control-compact]").count();
      if (!hero) problems.push(`${locale} studies: no author chip on the featured study`);
      await noNestedInteractive(page, `${locale} studies`);
      await rawKeys(page, `${locale} studies`);
      await noOverflow(page, `${locale} studies`);
      await shoot(page, `owners-library-studies-${locale}`);
    }

    /* ---- 6. the Learning Room, and a lesson in the reader ---- */
    if (await open(page, L("/lessons"), "[data-testid=room-lesson]")) {
      const cards = await page.locator("[data-testid=room-lesson]").count();
      const chips = await page.locator("[data-testid=room-lesson] [data-testid=owner-control-compact]").count();
      console.log(`  ${locale} room: ${chips} author chips on ${cards} cards`);
      if (!chips) problems.push(`${locale} learning room: no author chip on any lesson card`);
      const week = await page.locator("[data-testid=lesson-week] [data-testid=owner-control-compact]").count();
      if (!week) problems.push(`${locale} learning room: no author chip on the lesson of the week`);
      await noNestedInteractive(page, `${locale} learning room`);
      await rawKeys(page, `${locale} learning room`);
      await noOverflow(page, `${locale} learning room`);
      await shoot(page, `owners-library-learning-room-${locale}`);
      // the card still opens the reader
      await page.locator("[data-testid=room-lesson-open]").first().click({ timeout: 60000 }).catch(() => {});
      const reader = await page
        .waitForSelector("[data-testid=lesson-reader]", { timeout: 60000 })
        .then(() => true)
        .catch(() => false);
      if (!reader) problems.push(`${locale} learning room: the card no longer opens the reader`);
      else {
        const inReader = await page.locator("[data-testid=lesson-reader] [data-testid=owner-control-compact]").count();
        if (!inReader) problems.push(`${locale} learning room: no author chip in the reader`);
        await shoot(page, `owners-library-lesson-reader-${locale}`);
      }
    }

    /* ---- 7. a lesson page ---- */
    if (ids.lessonId && (await open(page, L(`/lessons/${ids.lessonId}`), "[data-testid=owner-control]"))) {
      const role = await page.getAttribute("[data-testid=owner-control]", "data-role");
      if (role !== "author") problems.push(`${locale} lesson: owner control carries role ${role}`);
      await rawKeys(page, `${locale} lesson`);
      await noOverflow(page, `${locale} lesson`);
      await shoot(page, `owners-library-lesson-${locale}`);
    }

    /* ---- 8. the Reports hub and a report ---- */
    if (await open(page, L("/reports"), "[data-testid=reports-hub]")) {
      const chips = await page.locator("[data-testid=all-reports] [data-testid=owner-control-compact]").count();
      if (!chips) problems.push(`${locale} reports hub: no requester chip in the all-reports table`);
      await noNestedInteractive(page, `${locale} reports hub`);
      await rawKeys(page, `${locale} reports hub`);
      await noOverflow(page, `${locale} reports hub`);
      await shoot(page, `owners-library-reports-hub-${locale}`);
      const row = page.locator("[data-testid=all-reports] [data-testid=report-row] a").first();
      if (await row.count()) {
        await row.click({ timeout: 60000 }).catch(() => {});
        const navigated = await page
          .waitForURL(/\/reports\/[A-Z0-9]/i, { timeout: 60000 })
          .then(() => true)
          .catch(() => false);
        if (!navigated) problems.push(`${locale} reports hub: the row link no longer opens the report`);
      }
    }
    if (ids.reportId && (await open(page, L(`/reports/${ids.reportId}`), "[data-testid=report-meta]"))) {
      const chip = await page.locator("[data-testid=report-meta] [data-testid=owner-control-compact]").count();
      if (!chip) problems.push(`${locale} report: no requester chip in the metadata list`);
      await rawKeys(page, `${locale} report`);
      await noOverflow(page, `${locale} report`);
      await shoot(page, `owners-library-report-${locale}`);
    }

    /* ---- 9. an Ask conversation with a human answer ---- */
    if (ids.questionId && (await open(page, L(`/ask/${ids.questionId}`), "[data-testid=owner-control]"))) {
      const chips = await page.locator("[data-testid=owner-control-compact]").count();
      if (!chips) problems.push(`${locale} ask: no author chip on the human answer`);
      await noNestedInteractive(page, `${locale} ask`);
      await rawKeys(page, `${locale} ask`);
      await noOverflow(page, `${locale} ask`);
      await shoot(page, `owners-library-ask-${locale}`);
    }
  }

  await browser.close();
}

main()
  .catch((e) => {
    problems.push(`crash: ${String(e).slice(0, 300)}`);
  })
  .finally(() => {
    if (foreign.size) console.log(`\nforeign console noise, not this module:\n- ${[...foreign].join("\n- ")}`);
    console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nno problems found");
    process.exit(problems.length ? 1 : 0);
  });
