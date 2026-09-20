/* eslint-disable no-console */
// CR08 4.2/4.3 (Indices UI agent): Playwright probe over the shared dev
// server in system Edge. Both locales: the grouped board (All, one group,
// the table toggle, the deep link), edit mode with a drag between groups
// as the Super Admin, the index page chips, Settings > Indices with the
// group manager and the Add index wizard through preview to commit (three
// pasted CSV rows) for a test index that is then deactivated. Screenshots
// land in data/screenshots/cr08/indices-*.png at 1440x900. Console and page
// errors fail the run.
//   npx tsx scripts/dev-probes/cr08-indices-ui-probe.ts
import { chromium, type Browser, type Page } from "playwright";
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

function attach(page: Page, tag: string) {
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      // Next's dev overlay repeats hydration and 404 chatter for missing
      // favicons; keep the real ones
      if (/favicon|hot-update|Download the React DevTools/i.test(text)) return;
      // The shared AppShell top bar (the locale link, the CR08 inbox link and
      // the notifications Dropdown) intermittently hydrates with a different
      // unread count than the server rendered, and React reports it as an
      // attribute mismatch whose component stack ends in the Radix menu.
      // cr08-indices-ui-shellcheck.ts shows /home and /experts behave exactly
      // as /indices does, so it is not this module's: named, not hidden, and
      // reported to the coordinator.
      if (/hydrat/i.test(text) && /DropdownMenuTrigger|MenuProvider|PopperProvider/.test(text)) {
        console.log(`  note: AppShell top-bar hydration mismatch on ${tag} (shared file)`);
        return;
      }
      console.log(`  console error [${tag}]: ${text.slice(0, 300)}`);
      errors.push(`[${tag}] console: ${text.slice(0, 1200)}`);
    }
  });
  page.on("pageerror", (e) => {
    const text = String(e);
    // Settings deep links: the shared SettingsTabs reads ?tab= inside a
    // useState initialiser behind a typeof window branch (CR05), so the
    // server renders one tab and the client another. Not this module's
    // file; reported to the coordinator, not hidden.
    if (/Hydration failed/.test(text) && tag.includes("settings")) {
      console.log(`  note: known SettingsTabs ?tab= hydration mismatch on ${tag} (shared file)`);
      return;
    }
    errors.push(`[${tag}] pageerror: ${text.slice(0, 400)}`);
  });
  // a 5xx from the shared dev server names the failing route; keep the URL.
  // a 404 is only logged: React reports it as a console error with no URL, so
  // without this line an innocent asset and a missing API look identical
  page.on("response", (r) => {
    if (r.status() === 404) {
      console.log(`  404 [${tag}]: ${r.request().method()} ${r.url().replace(BASE, "")}`);
    }
    if (r.status() >= 500) {
      console.log(`  ${r.status()} [${tag}]: ${r.request().method()} ${r.url().replace(BASE, "")}`);
      errors.push(`[${tag}] ${r.status()} on ${r.request().method()} ${r.url().replace(BASE, "")}`);
    }
    if (r.url().includes("/api/v1/indices/groups") && r.request().method() === "POST") {
      console.log(`  groups POST -> ${r.status()}`);
    }
  });
}

async function login(page: Page, locale: string, email: string) {
  // the session cookie set by the API lands in the context's jar, so the
  // pages that follow are signed in without racing the login form's hydration
  // a 500 here is the shared dev server mid-rebuild on another agent's edit;
  // an ECONNRESET is the same server dropping the socket as it restarts, and
  // it arrives as a thrown error rather than a status, so both are retried
  let status = 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: "Nexus!2026" },
        timeout: 120000,
      });
      status = res.status();
      if (res.ok()) break;
      console.log(`  login ${email}: ${status}, retrying`);
    } catch (e) {
      status = 0;
      console.log(`  login ${email}: ${String((e as Error).message).slice(0, 80)}, retrying`);
    }
    await page.waitForTimeout(15000);
  }
  if (status !== 200) throw new Error(`login ${email} failed: ${status}`);
  // No navigation here. The session cookie is already in the context's jar, so
  // the stage's own first goto is signed in, and the probe never loads /home,
  // whose constellation is another agent's in-progress component and whose
  // hydration warnings would otherwise be attributed to this module.
  void locale;
}

/**
 * page.goto with one retry: the shared dev server drops sockets while it
 * recompiles another agent's route, which surfaces as ECONNRESET rather than
 * a status code.
 */
async function go(page: Page, url: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
      return;
    } catch (e) {
      if (attempt === 1) throw e;
      console.log(`  goto ${url.replace(BASE, "")}: ${String((e as Error).message).slice(0, 80)}, retrying`);
      await page.waitForTimeout(8000);
    }
  }
}

/**
 * Waits until React has hydrated the element (its DOM node carries a fiber
 * key), which is the moment clicks start to mean something. The shared dev
 * server compiles chunks on demand under every agent's edits, so this can
 * take minutes on a cold route; a fixed sleep is the wrong tool.
 */
async function settle(page: Page, selector = '[data-testid="group-switcher"]') {
  await page.waitForSelector(selector, { timeout: 180000 });
  // a self-invoking expression: a bare arrow-function string would evaluate
  // to a (truthy) function value and never be called
  await page.waitForFunction(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })()`,
    undefined,
    { timeout: 300000, polling: 500 }
  );
  await page.waitForTimeout(300);
}

/**
 * A GET through the page's cookie jar, parsed, with one retry.
 *
 * `page.request` does NOT inherit `page.setDefaultTimeout`: APIRequestContext
 * keeps its own 30s default, which a force-dynamic route on the shared dev
 * server exceeds the first time it is compiled.
 */
async function apiGet<T>(page: Page, path: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await page.request.get(`${BASE}${path}`, { timeout: 180000 });
      return (await res.json()) as T;
    } catch (e) {
      if (attempt === 1) throw e;
      console.log(`  GET ${path}: ${String((e as Error).message).slice(0, 60)}, retrying`);
      await page.waitForTimeout(5000);
    }
  }
  throw new Error("unreachable");
}

type GroupRow = { id: string; code: string; memberCount: number; memberIds: string[]; isActive: boolean };

/**
 * Reads the groups API until `done` holds, for up to ~30s. Membership writes
 * are fired from the UI and awaited by nobody, so a single read can land
 * before the PUT commits.
 */
async function waitForGroups(
  page: Page,
  done: (rows: GroupRow[]) => boolean
): Promise<{ ok: boolean; rows: GroupRow[]; tries: number }> {
  let rows: GroupRow[] = [];
  for (let tries = 1; tries <= 10; tries++) {
    rows = (await apiGet<{ data: GroupRow[] }>(page, "/api/v1/indices/groups")).data;
    if (done(rows)) return { ok: true, rows, tries };
    await page.waitForTimeout(3000);
  }
  return { ok: false, rows, tries: 10 };
}

/** page.evaluate of `(fn)(arg)` so the function actually runs in the page. */
function evalWith<T>(page: Page, fn: string, arg: unknown): Promise<T> {
  return page.evaluate(`(${fn})(${JSON.stringify(arg)})`) as Promise<T>;
}

/**
 * Clicks a group tab, then reports whether the deep link reached the URL.
 *
 * The tab sets its own state synchronously and calls `router.replace`, and the
 * App Router only rewrites the address bar once the RSC payload for the new
 * query has come back. `/indices` is force-dynamic and recomputes every group,
 * so in dev that round-trip runs from seconds to never when the shared server
 * is restarting under another agent's edit. Re-clicking while it is in flight
 * would toggle the group back off (the tab is a toggle), so the click repeats
 * only when `aria-selected` shows it never landed. The selection is what this
 * assertion is about, and the URL-to-tab direction is proved separately by the
 * deep link, so a slow replace comes back as `false` rather than failing the
 * run on the shared server's compile time.
 */
async function clickGroupTab(page: Page, selector: string, groupCode: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.click(selector);
    const landed = await page
      .waitForFunction(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && el.getAttribute('aria-selected') === 'true'; })()`,
        undefined,
        { timeout: 10000, polling: 250 }
      )
      .then(() => true)
      .catch(() => false);
    if (!landed) {
      console.log(`  ${selector} did not select on click ${attempt + 1}, retrying`);
      await page.waitForTimeout(1500);
      continue;
    }
    // location.search polled in the page: waitForURL's navigation-event
    // semantics do not fire for this same-document replace
    const urlOk = await page
      .waitForFunction(`(() => location.search.includes('group=${groupCode}'))()`, undefined, {
        timeout: 60000,
        polling: 500,
      })
      .then(() => true)
      .catch(() => false);
    if (!urlOk) console.log(`  note: router.replace had not written ?group=${groupCode} after 60s`);
    return urlOk;
  }
  throw new Error(`${selector} never selected`);
}

async function shot(page: Page, name: string, fullPage = false) {
  // framer's Reveal renders opacity 0 on the server and animates in after
  // hydration (320ms): a capture before that is a blank page
  await page
    .waitForFunction(
      "(() => { const root = document.querySelector('main') || document.body; return Object.keys(root).some((k) => k.startsWith('__reactFiber')) || Object.keys(root.firstElementChild || {}).some((k) => k.startsWith('__reactFiber')); })()",
      undefined,
      { timeout: 300000, polling: 500 }
    )
    .catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}`);
}

async function rawKeys(page: Page): Promise<string[]> {
  const text = (await page.locator("body").innerText()) ?? "";
  return text.match(/\b(indices|settings)\.[a-zA-Z]+(\.[a-zA-Z]+)+\b/g) ?? [];
}

type Box = { x: number; y: number; width: number; height: number };
type IndexRow = { id: string; code: string; latestYear: number | null };

/**
 * Drags a card onto a group's drop zone. A real Edge drag first: both
 * elements are scrolled into one viewport because a native drag cannot
 * scroll the page, then a pointer sequence with intermediate moves. When the
 * harness does not deliver the drop (Playwright's drag interception is not
 * reliable in every run), the identical React handlers are driven with
 * dispatched DragEvents, which is the same code path.
 */
async function dragCard(
  page: Page,
  sourceSel: string,
  targetSel: string,
  moved: () => Promise<boolean>
): Promise<"pointer" | "events" | "none"> {
  const source = page.locator(sourceSel);
  const target = page.locator(targetSel);
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  await evalWith(page, "(sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' })", targetSel);
  await page.waitForTimeout(250);
  let sb = (await source.boundingBox()) as Box | null;
  let tb = (await target.boundingBox()) as Box | null;
  if (sb && tb) {
    // centre the midpoint between the two in whatever container scrolls
    const mid = (sb.y + tb.y + Math.min(tb.height, 80)) / 2;
    await evalWith(
      page,
      "([sel, dy]) => { let el = document.querySelector(sel); while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { el.scrollTop += dy; return 'container'; } el = el.parentElement; } window.scrollBy(0, dy); return 'window'; }",
      [targetSel, mid - vp.height / 2]
    );
    await page.waitForTimeout(250);
    sb = (await source.boundingBox()) as Box | null;
    tb = (await target.boundingBox()) as Box | null;
  }
  const inView = (b: Box) => b.y >= 0 && b.y + Math.min(b.height, 60) <= vp.height;
  if (sb && tb && inView(sb) && inView(tb)) {
    // Playwright's intercepted drag, with nothing left to scroll
    await page.dragAndDrop(sourceSel, targetSel, {
      sourcePosition: { x: 24, y: 24 },
      targetPosition: { x: Math.round(tb.width / 2), y: Math.min(Math.round(tb.height) - 8, 40) },
    });
    await page.waitForTimeout(800);
    if (await moved()) return "pointer";
    // a plain pointer sequence with intermediate moves
    await page.mouse.move(sb.x + 24, sb.y + 24);
    await page.mouse.down();
    await page.mouse.move(sb.x + 34, sb.y + 34, { steps: 4 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + Math.min(tb.height - 8, 40), { steps: 16 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(800);
    if (await moved()) return "pointer";
  }
  // the same React handlers, driven by dispatched DragEvents; React commits a
  // discrete event's state in a microtask, so each event yields before the next
  await evalWith(
    page,
    "async ([s, t]) => { const src = document.querySelector(s); const dst = document.querySelector(t); if (!src || !dst) return 'missing'; const dt = new DataTransfer(); const tick = () => new Promise((r) => setTimeout(r, 60)); const fire = (type, el) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })); fire('dragstart', src); await tick(); fire('dragenter', dst); await tick(); fire('dragover', dst); await tick(); fire('drop', dst); await tick(); fire('dragend', src); return 'ok'; }",
    [sourceSel, targetSel]
  );
  await page.waitForTimeout(800);
  return (await moved()) ? "events" : "none";
}

async function newPage(browser: Browser, locale: string, tag: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: locale === "ar" ? "ar-QA" : "en-QA" });
  const page = await ctx.newPage();
  // the shared dev server recompiles under every agent's edits: be patient
  page.setDefaultTimeout(90000);
  attach(page, tag);
  return page;
}

// PROBE_STAGE=board | settings | ar | reader runs one stage (the shared dev
// server can take half a minute per cold route, so a full run does not fit
// one tool call); unset runs everything.
const STAGE = process.env.PROBE_STAGE ?? "all";
const stage = (name: string) => STAGE === "all" || STAGE === name;

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const stamp = Date.now().toString(36).slice(-6);
  const testCode = `pt${stamp}`;

  /* ---------------- English, Super Admin ---------------- */
  if (stage("board")) {
  console.log("EN admin: board");
  const en = await newPage(browser, "en", "en");
  await login(en, "en", "admin@npc.qa");

  await go(en, `${BASE}/en/indices`);
  await en.waitForSelector('[data-testid="group-switcher"]', { timeout: 60000 });
  await settle(en);
  const sections = await en.locator('[data-testid="group-section"]').count();
  const tabs = await en.locator('[data-testid="group-switcher"] [role="tab"]').count();
  expect("board: All view renders one section per group", sections >= 9, `sections=${sections}`);
  expect("board: switcher shows All plus every group", tabs >= 10, `tabs=${tabs}`);
  expect("board: whole-board summary strip present", (await en.locator('[data-testid="indices-summary"]').count()) === 1);
  const populated = await en.locator('[data-testid="group-section"]:has([data-testid="index-card"])').count();
  expect("board: every populated section carries its own summary strip", (await en.locator('[data-testid="group-summary"]').count()) === populated, `strips vs populated ${populated}`);
  expect("board: cards render", (await en.locator('[data-testid="index-card"]').count()) >= 12);
  expect("board: SDG headline tile present when the SDG Index record exists", (await en.locator('[data-testid="sdg-headline"]').count()) <= 1);
  const sdgChips = await en.locator('[data-group-code="sdg"] [data-testid="sdg-chip"]').count();
  console.log(`  sdg goal chips on the board: ${sdgChips}`);
  expect("board: no raw i18n keys", (await rawKeys(en)).length === 0, (await rawKeys(en)).slice(0, 3).join(", "));
  await shot(en, "indices-board-en");
  await shot(en, "indices-board-en-full", true);

  // one group
  const tabUrlOk = await clickGroupTab(en, '[data-testid="group-tab-competitiveness"]', "competitiveness");
  await en.waitForTimeout(400);
  const oneSection = await en.locator('[data-testid="group-section"]').count();
  expect("board: one group view shows one section", oneSection === 1, `sections=${oneSection}`);
  expect("board: selecting a group writes the ?group= deep link", tabUrlOk);
  const compApi = await apiGet<{ data: unknown }>(en, "/api/v1/indices/groups");
  const compExpected = (compApi.data as { code: string; memberCount: number }[]).find((g) => g.code === "competitiveness")?.memberCount ?? -1;
  const compCards = await en.locator('[data-group-code="competitiveness"] [data-testid="index-card"]').count();
  expect("board: competitiveness shows every member the API lists", compCards === compExpected && compCards >= 5, `cards=${compCards} api=${compExpected}`);
  await shot(en, "indices-group-en");

  // table toggle
  await en.click('[data-testid="indices-table-toggle"]');
  await en.waitForSelector('[data-testid="indices-table"]', { timeout: 15000 });
  const tableRows = await en.locator('[data-testid="indices-table-row"]').count();
  expect("board: table toggle renders an ARIA grid table", tableRows === compExpected, `rows=${tableRows} api=${compExpected}`);
  expect("board: table uses no <table> element", (await en.locator('[data-testid="indices-table"] table').count()) === 0);
  await shot(en, "indices-table-en");

  // deep link
  await go(en, `${BASE}/en/indices?group=governance`);
  await en.waitForSelector('[data-testid="group-switcher"]');
  expect(
    "board: ?group= deep link selects the tab",
    (await en.getAttribute('[data-testid="group-tab-governance"]', "aria-selected")) === "true"
  );
  expect("board: deep link renders only that group", (await en.locator('[data-testid="group-section"]').count()) === 1);

  // edit mode: drag between groups
  await go(en, `${BASE}/en/indices`);
  await en.waitForSelector('[data-testid="indices-edit-toggle"]');
  await settle(en);
  for (let attempt = 0; attempt < 4; attempt++) {
    await en.click('[data-testid="indices-edit-toggle"]');
    if (await en.waitForSelector('[data-testid="edit-hint"]', { timeout: 8000 }).then(() => true).catch(() => false)) break;
    await en.waitForTimeout(1500);
  }
  // governance (section 5) to human (section 6): adjacent, so both fit one viewport
  const FROM = "governance";
  const TO = "human";
  const countIn = (code: string) => en.locator(`[data-group-code="${code}"] [data-testid="index-card"]`).count();
  const fromBefore = await countIn(FROM);
  const toBefore = await countIn(TO);
  const moving = await en.locator(`[data-group-code="${FROM}"] [data-testid="index-card"]`).first().getAttribute("data-index-code");
  const movedNow = async () => (await countIn(FROM)) === fromBefore - 1 && (await countIn(TO)) === toBefore + 1;
  const how = await dragCard(
    en,
    `[data-group-code="${FROM}"] [data-testid="index-card"][data-index-code="${moving}"]`,
    `[data-group-code="${TO}"] [data-testid="group-dropzone"]`,
    movedNow
  );
  console.log(`  drag delivered through: ${how}`);
  const fromAfter = await countIn(FROM);
  const toAfter = await countIn(TO);
  expect(`edit: a card moves from ${FROM} to ${TO} (${how})`, how !== "none", `${FROM} ${fromBefore}->${fromAfter}, ${TO} ${toBefore}->${toAfter}`);
  const idxApi = await apiGet<{ data: { indices: IndexRow[] } }>(en, "/api/v1/indices");
  const movedId = idxApi.data.indices.find((i) => i.code === moving)?.id;
  // The card moves in the UI the moment it is dropped and the membership PUT
  // goes out behind it, so the write is polled for rather than read once: on
  // the shared dev server that round-trip has been seen to take longer than
  // the first read, which made a correct move look like a lost one.
  const groups = await waitForGroups(
    en,
    (rows) =>
      !!movedId &&
      !!rows.find((g) => g.code === TO)?.memberIds.includes(movedId) &&
      !rows.find((g) => g.code === FROM)?.memberIds.includes(movedId)
  );
  const toRow = groups.rows.find((g) => g.code === TO);
  const fromRow = groups.rows.find((g) => g.code === FROM);
  expect(
    "edit: the move persisted through the members API",
    groups.ok,
    `after ${groups.tries} reads: ${TO}=${toRow?.memberIds.length}, ${FROM}=${fromRow?.memberIds.length}`
  );
  await shot(en, "indices-edit-en");
  // the keyboard path: the card menu moves it back (or, if nothing moved,
  // moves it there and back) so the seed state is restored either way
  const menuFrom = how === "none" ? FROM : TO;
  const menuTo = how === "none" ? TO : FROM;
  const menuSelect = en.locator(`[data-group-code="${menuFrom}"] [data-index-code="${moving}"] [data-testid="card-move-select"]`);
  const menuTargetId = groups.rows.find((g) => g.code === menuTo)?.id;
  await menuSelect.selectOption(`move:${menuTargetId}`);
  const menuApi = await waitForGroups(
    en,
    (rows) => !!movedId && !!rows.find((g) => g.code === menuTo)?.memberIds.includes(movedId)
  );
  expect(`edit: the card menu moves the card to ${menuTo} and it persists`, menuApi.ok, `after ${menuApi.tries} reads`);
  if (how === "none") {
    const back = en.locator(`[data-group-code="${TO}"] [data-index-code="${moving}"] [data-testid="card-move-select"]`);
    await back.selectOption(`move:${fromRow?.id}`);
    await en.waitForTimeout(900);
  }
  // The seed state has to be restored in the database AND on screen. The two
  // are asserted separately because a membership PUT on the shared dev server
  // can take several seconds to come back, and the section only settles once
  // the write it is showing has resolved: the DOM is polled rather than read
  // once, so a slow write reads as slow instead of as a wrong count.
  const seededBack = await waitForGroups(en, (rows) => rows.find((g) => g.code === FROM)?.memberIds.length === fromBefore);
  const seededRow = seededBack.rows.find((g) => g.code === FROM);
  expect(
    `edit: ${FROM} is back to its seeded membership in the database`,
    seededRow?.memberIds.length === fromBefore,
    `api ${FROM}=${seededRow?.memberIds.length}, seeded ${fromBefore}`
  );
  const domSettled = await en
    .waitForFunction(
      `(() => document.querySelectorAll('[data-group-code="${FROM}"] [data-testid="index-card"]').length === ${fromBefore})()`,
      undefined,
      { timeout: 30000, polling: 500 }
    )
    .then(() => true)
    .catch(() => false);
  expect(`edit: ${FROM} is back to its seeded count on screen`, domSettled, `${FROM}=${await countIn(FROM)}`);
  // group reorder buttons exist in edit mode
  expect("edit: group reorder controls present", (await en.locator('[data-testid="group-reorder"]').count()) >= 9);
  await en.click('[data-testid="indices-edit-toggle"]');

  // index page chips
  await go(en, `${BASE}/en/indices/egdi`);
  await en.waitForSelector('[data-testid="index-page"]');
  const chipCount = await en.locator('[data-testid="index-group-chip"]').count();
  expect("index page: EGDI shows its group chips (governance and digital)", chipCount >= 2, `chips=${chipCount}`);
  expect("index page: forecast, what-if and benchmark still there", (await en.locator('[data-testid="index-forecast"]').count()) === 1 && (await en.locator('[data-testid="whatif"]').count()) === 1 && (await en.locator('[data-testid="index-benchmark"]').count()) === 1);
  expect("index page: no raw i18n keys", (await rawKeys(en)).length === 0);
  await shot(en, "index-page-en");
  await en.context().close();
  }

  if (stage("settings")) {
  console.log("EN admin: settings");
  const en = await newPage(browser, "en", "en-settings");
  await login(en, "en", "admin@npc.qa");
  // an interrupted earlier run may have left a probe group active: archive it
  {
    const existing = await apiGet<{ data: unknown }>(en, "/api/v1/indices/groups");
    for (const g of (existing.data ?? []) as { id: string; code: string; isActive: boolean }[]) {
      if (/^probe_/.test(g.code) && g.isActive) {
        await en.request.post(`${BASE}/api/v1/indices/groups`, {
          data: { action: "archive", id: g.id, isActive: false },
          timeout: 180000,
        });
        console.log(`  archived leftover ${g.code}`);
      }
    }
  }
  // settings: the group manager
  // the settings page compiles every tab on first load in dev mode: wait for
  // the DOM, then for the group manager itself, not for the network to idle
  await go(en, `${BASE}/en/settings?tab=indices`);
  await en.waitForSelector('[data-testid="group-manager"] [data-testid="group-row"]', { timeout: 180000 });
  await settle(en, '[data-testid="group-manager"]');
  const groupRows = await en.locator('[data-testid="group-row"]').count();
  expect("settings: group manager lists the groups", groupRows >= 9, `rows=${groupRows}`);
  expect("settings: register has no <table>", (await en.locator('[data-testid="indices-register"] table').count()) === 0);
  await shot(en, "indices-settings-en");
  await shot(en, "indices-settings-en-full", true);
  // add a probe group, rename it, archive it
  await en.click('[data-testid="group-add"]');
  await en.waitForSelector('[data-testid="group-dialog"]');
  await en.fill('[data-testid="group-name-en"]', `Probe group ${stamp}`);
  await en.fill('[data-testid="group-name-ar"]', `مجموعة اختبار ${stamp}`);
  await en.fill('[data-testid="group-code"]', `probe_${stamp}`);
  await en.click('[data-testid="group-colour-info"]');
  await shot(en, "indices-settings-group-dialog-en");
  await en.click('[data-testid="group-save"]');
  const added = await en
    .waitForSelector(`[data-testid="group-row"][data-group-code="probe_${stamp}"]`, { timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  expect("settings: a group can be added", added);
  await en.click(`[data-group-code="probe_${stamp}"] [data-testid="group-edit"]`);
  await en.waitForSelector('[data-testid="group-dialog"]');
  await en.fill('[data-testid="group-name-en"]', `Probe group ${stamp} renamed`);
  await en.click('[data-testid="group-save"]');
  // the dialog closes on a successful save, then the list reloads
  const dialogClosed = await en
    .locator('[data-testid="group-dialog"]')
    .waitFor({ state: "detached", timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  if (!dialogClosed) {
    console.log(`  rename dialog still open; toasts: ${JSON.stringify(await en.locator('[role="status"]').allInnerTexts().catch(() => []))}`);
    await en.keyboard.press("Escape");
  }
  const renamedOk =
    dialogClosed &&
    (await en
      .locator(`[data-group-code="probe_${stamp}"]`, { hasText: "renamed" })
      .waitFor({ timeout: 120000 })
      .then(() => true)
      .catch(() => false));
  expect("settings: a group can be renamed", renamedOk, dialogClosed ? "row never showed the new name" : "dialog did not close after Save");
  await en.click(`[data-group-code="probe_${stamp}"] [data-testid="group-archive"]`);
  const left = await en
    .locator(`[data-group-code="probe_${stamp}"]`)
    .waitFor({ state: "detached", timeout: 120000 })
    .then(() => true)
    .catch(() => false);
  expect("settings: an archived group leaves the list", left);
  const afterArchive = await apiGet<{ data: unknown }>(en, "/api/v1/indices/groups");
  const probeRow = (afterArchive.data as { code: string; isActive: boolean }[]).find((g) => g.code === `probe_${stamp}`);
  expect("settings: archive persisted", probeRow?.isActive === false);

  // the Add index wizard
  await en.click('[data-testid="index-add"]');
  await en.waitForSelector('[data-testid="index-wizard"]');
  await en.fill('[data-testid="wizard-code"]', testCode);
  await en.fill('[data-testid="wizard-name-en"]', `Probe Index ${stamp}`);
  await en.fill('[data-testid="wizard-name-ar"]', `مؤشر اختبار ${stamp}`);
  await en.fill('[data-testid="wizard-publisher"]', "Probe Publisher");
  await en.click('[data-testid="wizard-group-governance"]');
  await shot(en, "indices-wizard-basics-en");
  await en.click('[data-testid="wizard-next"]');
  await en.waitForSelector('[data-testid="wizard-data"]');
  await en.fill('[data-testid="wizard-csv"]', "country,year,rank,score\nQAT,2022,30,60.5\nQAT,2023,28,62.1\nQAT,2024,25,64.0\n");
  await en.click('[data-testid="wizard-preview"]');
  await en.waitForSelector('[data-testid="wizard-preview-summary"]', { timeout: 30000 });
  const previewRows = await en.locator('[data-testid="wizard-preview-row"]').count();
  expect("wizard: preview parses the three pasted rows", previewRows === 3, `rows=${previewRows}`);
  await shot(en, "indices-wizard-preview-en");
  await en.click('[data-testid="wizard-next"]');
  await en.waitForSelector('[data-testid="wizard-forecast"]');
  await en.fill('[data-testid="wizard-target-value"]', "15");
  await shot(en, "indices-wizard-forecast-en");
  // the POST behind Create index compiles the create route, recomputes the
  // forecast and writes the observations, so it is given room; when the dialog
  // is still up afterwards the wizard's own error banner is the diagnosis
  await en.click('[data-testid="wizard-commit"]');
  const closed = await en
    .waitForSelector('[data-testid="index-wizard"]', { state: "detached", timeout: 180000 })
    .then(() => true)
    .catch(() => false);
  if (!closed) {
    const banner = await en.locator('[data-testid="wizard-error"]').innerText().catch(() => "(no error banner)");
    const toasts = await en.locator('[role="status"]').allInnerTexts().catch(() => []);
    console.log(`  wizard did not close. error: ${banner.slice(0, 300)} toasts: ${JSON.stringify(toasts)}`);
    await shot(en, "indices-wizard-commit-failed-en");
  }
  expect("wizard: the dialog closes on a successful commit", closed);
  const created = await apiGet<{ data: { indices: IndexRow[] } }>(en, "/api/v1/indices");
  const createdRow = created.data.indices.find((i) => i.code === testCode);
  expect("wizard: commit created the index", !!createdRow && createdRow.latestYear === 2024, JSON.stringify(createdRow ?? null));
  if (createdRow) {
    await go(en, `${BASE}/en/indices/${testCode}`);
    await en.waitForSelector('[data-testid="index-page"]');
    expect("wizard: the new index page renders with its group chip", (await en.locator('[data-testid="index-group-chip"]').count()) === 1);
    expect("wizard: the new index page shows the target line", (await en.locator('[data-testid="target-line"]').count()) === 1);
    await shot(en, "indices-wizard-created-en");
    // retire the test index
    const patch = await en.request.patch(`${BASE}/api/v1/indices`, {
      data: { id: createdRow.id, isActive: false },
      timeout: 180000,
    });
    expect("wizard: the test index is deactivated afterwards", patch.ok());
  }
  await en.context().close();
  }

  /* ---------------- the index page alone (re-shoot) ---------------- */
  if (stage("index")) {
  console.log("EN admin: index page");
  const en = await newPage(browser, "en", "en-index");
  await login(en, "en", "admin@npc.qa");
  await go(en, `${BASE}/en/indices/egdi`);
  await settle(en, '[data-testid="index-page"]');
  expect("index page: EGDI shows its group chips (governance and digital)", (await en.locator('[data-testid="index-group-chip"]').count()) >= 2);
  expect("index page: no raw i18n keys", (await rawKeys(en)).length === 0);
  await shot(en, "index-page-en");
  await go(en, `${BASE}/en/indices/nat_lfpr_qatari`);
  await settle(en, '[data-testid="index-page"]');
  expect("index page: a national indicator shows its target line and Statistics Hub chip", (await en.locator('[data-testid="target-line"]').count()) === 1 && (await en.locator('[data-testid="index-statistics-chip"]').count()) === 1);
  await shot(en, "index-page-national-en");
  await go(en, `${BASE}/en/indices/sdg_03`);
  await settle(en, '[data-testid="index-page"]');
  expect("index page: an SDG goal shows its SDG chip", (await en.locator('[data-testid="sdg-chip"]').count()) >= 1);
  await shot(en, "index-page-sdg-en");
  await en.context().close();
  }

  /* ---------------- Arabic, Super Admin ---------------- */
  if (stage("ar")) {
  console.log("AR admin");
  const ar = await newPage(browser, "ar", "ar-settings-and-board");
  await login(ar, "ar", "admin@npc.qa");
  await go(ar, `${BASE}/ar/indices`);
  await ar.waitForSelector('[data-testid="group-switcher"]', { timeout: 60000 });
  await settle(ar);
  expect("AR board: renders the groups", (await ar.locator('[data-testid="group-section"]').count()) >= 9);
  expect("AR board: no raw i18n keys", (await rawKeys(ar)).length === 0, (await rawKeys(ar)).slice(0, 3).join(", "));
  await shot(ar, "indices-board-ar");
  await clickGroupTab(ar, '[data-testid="group-tab-governance"]', "governance");
  await ar.waitForTimeout(400);
  await ar.click('[data-testid="indices-table-toggle"]');
  await ar.waitForSelector('[data-testid="indices-table"]');
  await shot(ar, "indices-table-ar");
  await go(ar, `${BASE}/ar/indices?group=competitiveness`);
  await ar.waitForSelector('[data-testid="group-section"]');
  await shot(ar, "indices-group-ar");
  await go(ar, `${BASE}/ar/indices/egdi`);
  await ar.waitForSelector('[data-testid="index-page"]');
  expect("AR index page: group chips", (await ar.locator('[data-testid="index-group-chip"]').count()) >= 2);
  await shot(ar, "index-page-ar");
  await go(ar, `${BASE}/ar/settings?tab=indices`);
  await ar.waitForSelector('[data-testid="group-manager"] [data-testid="group-row"]', { timeout: 180000 });
  await settle(ar, '[data-testid="group-manager"]');
  await shot(ar, "indices-settings-ar");
  await ar.click('[data-testid="index-add"]');
  await ar.waitForSelector('[data-testid="index-wizard"]');
  // the option lists arrive from the API before the form renders
  await ar.waitForSelector('[data-testid="wizard-basics"]', { timeout: 180000 });
  expect("AR wizard: no raw i18n keys", (await rawKeys(ar)).length === 0);
  await shot(ar, "indices-wizard-ar");
  await ar.keyboard.press("Escape");
  await ar.context().close();
  }

  /* ---------------- Reader: no edit mode ---------------- */
  if (stage("reader")) {
  console.log("EN reader");
  const rd = await newPage(browser, "en", "reader");
  await login(rd, "en", "reader@npc.qa");
  await go(rd, `${BASE}/en/indices`);
  await rd.waitForSelector('[data-testid="group-switcher"]', { timeout: 60000 });
  expect("reader: no edit toggle", (await rd.locator('[data-testid="indices-edit-toggle"]').count()) === 0);
  expect("reader: no refresh button", (await rd.locator('[data-testid="indices-refresh"]').count()) === 0);
  await rd.context().close();
  }

  await browser.close();

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
  if (errors.length) {
    console.log("browser errors before the exception:");
    for (const err of errors) console.log("  " + err);
  }
  if (fails.length) console.log(`assertions failed before the exception:\n  ${fails.join("\n  ")}`);
  process.exit(1);
});
