/* eslint-disable no-console */
// CR08 8: Playwright pass over the Knowledge of the Week pieces in both
// locales against the shared dev server: the reveal and the strip (through
// the dev preview route until Home is wired), the Hall of Knowledge, the
// ribbon on a shelf, on a lesson card and in search results, the profile
// award, and the set dialog with its preview and the replace confirmation.
// Screenshots land in data/screenshots/cr08/kow-*.png.
//   npx tsx scripts/dev-probes/cr08-kow-probe.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "kow-console.log");
fs.writeFileSync(LOG, `Knowledge of the Week probe, ${new Date().toISOString()}\n`);

const problems: string[] = [];

/* Noise from the shared dev server that belongs to other CR08 modules or to
   the shell, kept in the log file but not counted as a Knowledge of the Week
   problem:
   - `node:` module build failures: a client component in the handover module
     pulls `undici` through services/signals into the browser bundle;
   - the Radix `id="radix-_R_..."` attribute mismatch on the top bar's
     Notifications and Account menus, present on every page of the app. React
     sends the prose and the tree diff as separate console arguments, so the
     prose is matched here and the diff is in `kow-console.log`;
   - connection resets while another agent's edit restarts the dev server. */
const FOREIGN =
  /UnhandledSchemeError|Reading from "node:|radix-_R_|A tree hydrated but some attributes|ERR_CONNECTION|Failed to fetch RSC payload|net::ERR_ABORTED/;
const foreign = new Set<string>();

async function login(page: Page, email: string) {
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: "Nexus!2026" },
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

/** Opens a page and waits for a selector, retrying while the shared dev
    server restarts under another agent's edit (connection resets, 500s). */
async function open(page: Page, url: string, selector: string, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForSelector(selector, { timeout: 120000 });
      await settled(page);
      return;
    } catch (e) {
      if (attempt === tries) throw e;
      console.log(`  ${url} attempt ${attempt}: ${String(e).replace(/\s+/g, " ").slice(0, 90)}`);
      await page.waitForTimeout(8000);
    }
  }
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

async function shoot(page: Page, name: string) {
  await settled(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("  shot", name);
}

/** The reveal opens over everything for anyone who has not seen it this week,
    so it must be dismissed before the page beneath can be used. It mounts
    after hydration, so give it a moment to appear before deciding it is not
    there. */
async function dismissReveal(page: Page, wait = 6000) {
  const there = await page
    .waitForSelector("[data-testid=kow-reveal]", { timeout: wait })
    .then(() => true)
    .catch(() => false);
  if (!there) return false;
  await page.keyboard.press("Escape");
  const gone = await page
    .waitForSelector("[data-testid=kow-reveal]", { state: "detached", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!gone) await page.click("[data-testid=kow-reveal-later]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

/** Next's development error overlay belongs to whichever module failed to
    compile on the shared server; it blurs the page under it and must go
    before a screenshot of this module means anything. */
async function dismissDevOverlay(page: Page) {
  const removed = await page.evaluate(
    "(() => { const p = [...document.querySelectorAll('nextjs-portal')]; p.forEach((el) => el.remove()); return p.length; })()"
  );
  if (removed) await page.waitForTimeout(300);
  return Number(removed) > 0;
}

async function rawKeys(page: Page, label: string) {
  const text = await page.evaluate("document.body.innerText");
  const hits = String(text).match(/\b(kow|home|profile|vault|lessons)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? [];
  if (hits.length) problems.push(`${label}: raw keys ${[...new Set(hits)].join(", ")}`);
}

async function noOverflow(page: Page, label: string) {
  const wide = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
  if (wide) problems.push(`${label}: page scrolls horizontally`);
}

/** The gold bookmark on the spine of this week's pick, framed. A viewport
    screenshot after a scroll can land on an empty stretch of the shelves, so
    the shot is clipped to a window around the ribbon itself. */
async function shelfRibbon(page: Page, locale: string) {
  const ribbon = page.locator("[data-testid=book-kow-ribbon]").first();
  if (!(await ribbon.count())) {
    problems.push(`${locale}: no ribbon on the shelf`);
    return;
  }
  await ribbon.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  if (await dismissDevOverlay(page)) console.log(`  ${locale}: another module's error overlay removed before the shot`);
  const box = await ribbon.boundingBox();
  if (!box) {
    problems.push(`${locale}: the shelf ribbon has no box`);
    return;
  }
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  const clip = {
    x: Math.max(0, Math.min(box.x - 300, size.width - 640)),
    y: Math.max(0, Math.min(box.y - 60, size.height - 420)),
    width: 640,
    height: 420,
  };
  await settled(page);
  await page.screenshot({ path: path.join(OUT, `kow-shelf-ribbon-${locale}.png`), clip });
  console.log("  shot", `kow-shelf-ribbon-${locale}`);
}

/** The administrator pass: the set dialog with its live preview in both
    locales and the replace confirmation for a week that is already taken. */
async function adminPass(page: Page, context: BrowserContext) {
  console.log("admin@npc.qa");
  await page.goto("about:blank");
  await context.clearCookies();
  await login(page, "admin@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/hall-of-knowledge/preview`, "[data-testid=kow-set-button]");
    // the administrator has not seen this week's reveal either, and it covers
    // the page it opens over: dismiss it before using anything beneath
    await dismissReveal(page);
    // hydration on the shared server can land after the button is painted
    let opened = false;
    for (let attempt = 0; attempt < 5 && !opened; attempt++) {
      // the reveal mounts after hydration, so it can arrive between the two
      await dismissReveal(page, 1500);
      await page.click("[data-testid=kow-set-button]", { timeout: 30000 }).catch(() => {});
      opened = await page
        .waitForSelector("[data-testid=kow-card-preview]", { timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) await page.waitForTimeout(3000);
    }
    if (!opened) {
      await shoot(page, `kow-set-dialog-failed-${locale}`);
      problems.push(`${locale}: the set dialog did not open`);
      continue;
    }
    await page.fill("[data-testid=kow-note-en]", "Read the summary first, then the recommendations.");
    await page.fill("[data-testid=kow-note-ar]", "اقرأ الملخص أولًا ثم التوصيات.");
    await page.waitForTimeout(600);
    await rawKeys(page, `set dialog ${locale}`);
    await noOverflow(page, `set dialog ${locale}`);
    await shoot(page, `kow-set-dialog-${locale}`);
    // this week is taken by the seeded pick: the replace confirmation shows
    await page.click("[data-testid=kow-set-submit]", { timeout: 120000 });
    const clash = await page
      .waitForSelector("[data-testid=kow-conflict]", { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (!clash) {
      const shown = await page.evaluate(
        "(document.querySelector('[role=dialog]') || document.body).innerText.replace(/\\s+/g, ' ').slice(0, 300)"
      );
      problems.push(`${locale}: no replace confirmation for a taken week; dialog says: ${shown}`);
      await shoot(page, `kow-set-conflict-failed-${locale}`);
    } else await shoot(page, `kow-set-conflict-${locale}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const active = await rawClient.execute(
    "select k.id, k.resource_type, k.resource_id, u.email as contributor from knowledge_of_week k left join users u on u.id = k.contributor_user_id where k.status = 'active' limit 1"
  );
  const pick = active.rows[0];
  if (!pick) throw new Error("no active Knowledge of the Week: run scripts/cr08-kow-seed.ts first");
  const contributorEmail = String(pick.contributor ?? "");
  const titleRow = await rawClient.execute({ sql: "select title_en from documents where id = ?", args: [String(pick.resource_id)] });
  const pickTitle = String(titleRow.rows[0]?.title_en ?? "");
  console.log(`active pick: ${pick.resource_type} ${pick.resource_id} "${pickTitle}" by ${contributorEmail}`);

  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      // a 409 is the designed answer when a week already has a pick: the probe
      // asks for one on purpose
      if (/favicon|404 \(Not Found\)|409 \(Conflict\)/.test(text)) return;
      // the whole message goes to a log file so a hydration diff can be read
      fs.appendFileSync(LOG, `\n[${page.url()}]\n${text}\n`);
      if (FOREIGN.test(text)) {
        foreign.add(text.replace(/\s+/g, " ").slice(0, 100));
        return;
      }
      problems.push(`console on ${page.url()}: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  });
  page.on("pageerror", (e) => {
    const text = String(e);
    if (FOREIGN.test(text)) {
      foreign.add(text.replace(/\s+/g, " ").slice(0, 100));
      return;
    }
    problems.push(`pageerror: ${text.slice(0, 300)}`);
  });

  /* ---- the reader: reveal, strip, hall, ribbons ---- */
  // KOW_ONLY=admin reruns the administrator pass alone, for when the shared
  // dev server was too busy to reach it the first time
  const only = process.env.KOW_ONLY ?? "";
  if (only === "admin") {
    await adminPass(page, context);
    await browser.close();
    return;
  }
  if (only === "shelf") {
    await login(page, "reader@npc.qa");
    for (const locale of ["en", "ar"] as const) {
      await open(page, `${BASE}/${locale}/vault`, "[data-testid=book]");
      await shelfRibbon(page, locale);
    }
    await browser.close();
    return;
  }
  console.log("reader@npc.qa");
  await login(page, "reader@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/hall-of-knowledge/preview?force=1`, "[data-testid=kow-reveal]");
    await page.waitForTimeout(600);
    await rawKeys(page, `reveal ${locale}`);
    const dialog = page.locator("[role=dialog][aria-modal=true]");
    if (!(await dialog.count())) problems.push(`${locale}: reveal is not an aria-modal dialog`);
    const focused = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')");
    if (focused !== "kow-reveal-read") problems.push(`${locale}: focus is on ${focused}, expected the Read now button`);
    await shoot(page, `kow-reveal-${locale}`);
    // Tab from the last control wraps to the first
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const wrapped = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')");
    if (wrapped !== "kow-reveal-read" && wrapped !== "kow-reveal-close") problems.push(`${locale}: focus escaped the reveal (${wrapped})`);
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-testid=kow-reveal]", { state: "detached", timeout: 10000 }).catch(() => problems.push(`${locale}: Escape did not close the reveal`));
    await page.waitForSelector("[data-testid=kow-strip]", { timeout: 30000 });
    await noOverflow(page, `strip ${locale}`);
    await shoot(page, `kow-strip-${locale}`);

    await open(page, `${BASE}/${locale}/hall-of-knowledge`, "[data-testid=hall-page]");
    await rawKeys(page, `hall ${locale}`);
    await noOverflow(page, `hall ${locale}`);
    const cards = await page.locator("[data-testid=hall-card]").count();
    const current = await page.locator("[data-testid=hall-current]").count();
    console.log(`  ${locale}: hall cards=${cards} current=${current}`);
    if (cards < 4) problems.push(`${locale}: hall shows ${cards} archived cards`);
    if (current !== 1) problems.push(`${locale}: hall has no featured current pick`);
    await shoot(page, `kow-hall-${locale}`);

    // the ribbon on the shelf, framed around the book it hangs on so the
    // screenshot cannot land on an empty stretch of the page
    await open(page, `${BASE}/${locale}/vault`, "[data-testid=book]");
    await shelfRibbon(page, locale);

    // the ribbon on a lesson card (preview route) and in search
    await open(page, `${BASE}/${locale}/hall-of-knowledge/preview`, "[data-testid=kow-preview-lesson]");
    const lessonRibbon = page.locator("[data-testid=kow-preview-lesson] [data-testid=kow-ribbon]");
    if (!(await lessonRibbon.count())) problems.push(`${locale}: lesson card ribbon missing`);
    await page.locator("[data-testid=kow-preview-lesson]").screenshot({ path: path.join(OUT, `kow-lesson-ribbon-${locale}.png`) });
    console.log("  shot", `kow-lesson-ribbon-${locale}`);
  }

  await open(page, `${BASE}/en/search?q=${encodeURIComponent(pickTitle.split(",")[0].slice(0, 40))}`, "[data-testid^=result-]");
  await page.waitForSelector("[data-testid=kow-ribbon]", { timeout: 30000 }).catch(() => problems.push("search: ribbon missing on the pick"));
  await shoot(page, "kow-search-ribbon-en");

  // Read now on the strip records the read and opens the item
  await open(page, `${BASE}/en/hall-of-knowledge/preview`, "[data-testid=kow-strip]");
  await dismissReveal(page);
  const before = (await page.textContent("[data-testid=kow-strip-reads]")) ?? "";
  // the item page is compiled on demand on the shared dev server, and a
  // compile that lands after the click leaves the strip where it was: one
  // retry covers it
  let opened = false;
  for (let attempt = 0; attempt < 2 && !opened; attempt++) {
    await page.click("[data-testid=kow-strip-read]", { timeout: 120000 }).catch(() => {});
    opened = await page
      .waitForURL(/\/vault\//, { timeout: 120000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!opened) problems.push("Read now did not open the item");
  const readRow = await rawClient.execute({
    sql: "select count(*) as n from knowledge_of_week_reads r join users u on u.id = r.user_id where r.kow_id = ? and u.email = 'reader@npc.qa'",
    args: [String(pick.id)],
  });
  if (Number(readRow.rows[0].n) !== 1) problems.push("Read now did not record the read");
  console.log(`  read count before: "${before.trim()}", reader's read row: ${readRow.rows[0].n}`);

  /* ---- the contributor: the award on the profile ---- */
  if (contributorEmail) {
    console.log(contributorEmail);
    // leave the page first: a request still in flight when the cookies go
    // answers 401 and would be read as a defect of the page it landed on
    await page.goto("about:blank");
    await context.clearCookies();
    await login(page, contributorEmail);
    for (const locale of ["en", "ar"] as const) {
      await open(page, `${BASE}/${locale}/profile`, "[data-testid=kow-award]");
      await dismissReveal(page);
      await rawKeys(page, `profile ${locale}`);
      await page.locator("[data-testid=kow-award]").hover();
      await page.waitForTimeout(500);
      await shoot(page, `kow-profile-award-${locale}`);
    }
  } else {
    problems.push("active pick has no contributor");
  }

  /* ---- the administrator: the set dialog, preview and the replace confirmation ---- */
  await adminPass(page, context);

  // hidden vault portal: the Hall 404s (reader keeps the vault, so use a quick API check instead)
  const forbidden = await page.context().request.post(`${BASE}/api/v1/knowledge-of-week`, {
    data: { resourceType: "document", resourceId: "x", weekStart: "2030-01-07" },
  });
  console.log(`  admin POST bad item -> ${forbidden.status()}`);

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
