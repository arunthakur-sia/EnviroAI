/* eslint-disable no-console */
// CR08 7: Playwright pass over the Leaderboard in both locales against the
// shared dev server. Screenshots land in data/screenshots/cr08/.
//   npx tsx scripts/dev-probes/cr08-leaderboard-probe.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

const problems: string[] = [];

async function login(page: Page, email: string) {
  // the shared dev server rebuilds constantly while other agents edit, so the
  // login form resets under Playwright's fingers; the API sets the same
  // session cookie into the browser context
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

/** goto that tolerates the shared dev server's long-lived connections */
async function open(page: Page, url: string, selector: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(selector, { timeout: 120000 });
  await settled(page);
}

/** Hydration on the shared dev server can take seconds while other agents'
    edits trigger rebuilds: wait until every framer-motion entrance has run. */
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

async function rawKeys(page: Page, label: string) {
  // a raw i18n key on screen looks like "leaderboard.title"
  const text = await page.evaluate("document.body.innerText");
  const hits = String(text).match(/\b(leaderboard|settings|profile|home)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? [];
  const bad = hits.filter((h) => !/^settings\.(json|ts)/.test(h));
  if (bad.length) problems.push(`${label}: raw keys ${[...new Set(bad)].join(", ")}`);
}

async function setQuiet(email: string, on: boolean) {
  const { rawClient } = await import("../../src/server/db/client");
  await rawClient.execute({
    sql: "update users set quiet_mode = ? where email = ?",
    args: [on ? 1 : 0, email],
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      if (/favicon|404 \(Not Found\)/.test(text)) return;
      problems.push(`console: ${text.slice(0, 300)}`);
    }
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));

  /* ---- the reader: default board, pinned own row beyond the top ten ---- */
  console.log("reader@npc.qa");
  await login(page, "reader@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/leaderboard`, "[data-testid=board-table]");
    await rawKeys(page, `board ${locale}`);
    const rows = await page.locator("[data-testid=board-row]").count();
    const own = await page.locator("[data-testid=own-row]").count();
    const podium = await page.locator("[data-testid^=podium-]").count();
    console.log(`  ${locale}: rows=${rows} ownRow=${own} podium=${podium}`);
    if (rows > 10) problems.push(`${locale}: reader sees ${rows} rows (top 10 expected)`);
    if (own !== 1) problems.push(`${locale}: pinned own row missing`);
    if (podium !== 3) problems.push(`${locale}: podium has ${podium} cards`);
    await shoot(page, `leaderboard-people-${locale}`);

    // the pinned row stays visible when the list scrolls
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    await shoot(page, `leaderboard-people-scrolled-${locale}`);
    await page.mouse.wheel(0, -900);

    // window switch: all time
    await page.click("[data-testid=window-all]");
    await page.waitForSelector("[data-testid=board-table][data-board=people]", { timeout: 30000 });
    await page.waitForTimeout(700);
    const url = page.url();
    if (!url.includes("window=all")) problems.push(`${locale}: deep link did not update (${url})`);
    await shoot(page, `leaderboard-people-all-${locale}`);

    // category: learners
    await page.click("[data-testid=category-learners]");
    await page.waitForTimeout(900);
    await shoot(page, `leaderboard-learners-${locale}`);

    // departments board
    await page.click("[data-testid=board-departments]");
    await page.waitForSelector("[data-testid=board-table][data-board=departments]", { timeout: 30000 });
    await page.waitForTimeout(700);
    const units = await page.locator("[data-testid=board-table][data-board=departments] [data-testid=board-row]").count();
    console.log(`  ${locale}: units=${units}`);
    if (units < 3) problems.push(`${locale}: departments board has ${units} rows`);
    await rawKeys(page, `departments ${locale}`);
    await shoot(page, `leaderboard-departments-${locale}`);

    // a trend tip on hover
    await page.click("[data-testid=board-people]");
    await page.waitForSelector("[data-testid=board-table][data-board=people]", { timeout: 30000 });
    await page.locator("[data-testid=board-row] [data-trend]").first().hover();
    await page.waitForTimeout(500);
    await shoot(page, `leaderboard-trend-tip-${locale}`);
  }

  /* ---- deep link ---- */
  await open(
    page,
    `${BASE}/en/leaderboard?board=departments&window=quarter&category=contributors`,
    "[data-testid=board-table][data-board=departments]"
  );
  const pressed = await page.getAttribute("[data-testid=window-quarter]", "aria-pressed");
  const boardPressed = await page.getAttribute("[data-testid=board-departments]", "aria-pressed");
  if (pressed !== "true" || boardPressed !== "true") problems.push("deep link state not applied");
  await shoot(page, "leaderboard-deeplink-en");

  /* ---- quiet mode: the calm empty state ---- */
  console.log("quiet mode");
  await setQuiet("reader@npc.qa", true);
  try {
    for (const locale of ["en", "ar"] as const) {
      await open(page, `${BASE}/${locale}/leaderboard`, "[data-testid=leaderboard-page]");
      const quietTitle = await page.locator("text=" + (locale === "en" ? "The board is quiet for you" : "اللوحة هادئة")).count();
      if (!quietTitle) problems.push(`${locale}: quiet state not shown`);
      const rows = await page.locator("[data-testid=board-row]").count();
      if (rows) problems.push(`${locale}: quiet mode still shows ${rows} rows`);
      await shoot(page, `leaderboard-quiet-${locale}`);
    }
  } finally {
    await setQuiet("reader@npc.qa", false);
  }

  /* ---- profile: the level chip with its descriptor ---- */
  console.log("profile");
  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/profile`, "[data-testid=profile-level-chip]");
    await rawKeys(page, `profile ${locale}`);
    const chipText = (await page.textContent("[data-testid=profile-level-chip]")) ?? "";
    if (!/Level \d+|المستوى \d+/.test(chipText)) problems.push(`${locale}: level chip reads "${chipText}"`);
    const descriptor = await page.locator("[data-testid=profile-level-descriptor]").count();
    if (!descriptor) problems.push(`${locale}: profile descriptor missing`);
    await page.hover("[data-testid=profile-level-chip]");
    await page.waitForTimeout(600);
    await shoot(page, `leaderboard-profile-level-${locale}`);
  }

  /* ---- home: the progress ring caption keeps "Level N" with a tip ---- */
  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/home`, "[data-testid=progress-panel]");
    const ring = page.locator("[data-testid=progress-level]");
    if (await ring.count()) {
      await ring.scrollIntoViewIfNeeded();
      await ring.hover();
      await page.waitForTimeout(600);
      const caption = (await ring.textContent()) ?? "";
      if (!/Level \d+|المستوى \d+/.test(caption)) problems.push(`${locale}: home caption reads "${caption}"`);
      await shoot(page, `leaderboard-home-progress-${locale}`);
    } else {
      problems.push(`${locale}: home progress level caption not found`);
    }
  }

  /* ---- the administrator: full list, refresh now, settings tab ---- */
  console.log("admin@npc.qa");
  await context.clearCookies();
  await login(page, "admin@npc.qa");
  await open(page, `${BASE}/en/leaderboard?window=all`, "[data-testid=board-table]");
  const adminRows = await page.locator("[data-testid=board-row]").count();
  console.log(`  admin rows (all time)=${adminRows}`);
  if (adminRows <= 10) problems.push(`admin sees only ${adminRows} rows`);
  const refresh = page.locator("[data-testid=refresh-now]").first();
  if (!(await refresh.count())) problems.push("admin has no Refresh now button");
  await shoot(page, "leaderboard-admin-full-en");
  await refresh.click();
  await page.waitForTimeout(2500);
  await shoot(page, "leaderboard-admin-refreshed-en");

  for (const locale of ["en", "ar"] as const) {
    await open(page, `${BASE}/${locale}/leaderboard/settings`, "[data-testid=gamification-settings]");
    await rawKeys(page, `settings ${locale}`);
    const rules = await page.locator("[data-testid=gamification-rule]").count();
    const roles = await page.locator("[data-testid=gamification-role-exclusions] input").count();
    console.log(`  ${locale}: settings rules=${rules} roles=${roles}`);
    if (rules < 30) problems.push(`${locale}: settings shows ${rules} rules`);
    if (roles < 5) problems.push(`${locale}: settings shows ${roles} roles`);
    await shoot(page, `leaderboard-settings-${locale}`);
  }

  /* ---- the reader must not reach the settings shortcut ---- */
  const readerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const readerPage = await readerContext.newPage();
  await login(readerPage, "reader@npc.qa");
  const res = await readerPage.goto(`${BASE}/en/leaderboard/settings`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  const status = res?.status() ?? 0;
  console.log(`  reader /leaderboard/settings -> ${status}`);
  if (status !== 404) problems.push(`reader reached /leaderboard/settings with ${status}`);

  await browser.close();
}

main()
  .catch((e) => {
    problems.push(`crash: ${String(e).slice(0, 300)}`);
  })
  .finally(() => {
    console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nno problems found");
    process.exit(problems.length ? 1 : 0);
  });
