/* eslint-disable no-console */
// CR08 9 probe: the Inbox (list, thread, deep link, reply, done, convert),
// the OwnerControl demo (person card, compose, Teams dialog), the profile
// delegate block, the delegate's own Inbox, and the 390px single pane, in
// both locales with console errors captured and screenshots at 1440x900.
//   npx tsx scripts/dev-probes/cr08-messaging-probe.ts
import { chromium, type Browser, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
/** the shared dev server compiles on demand under several agents at once: a
    route handler's first browser hit can take a minute, so every wait for an
    element that depends on a fetch gets the same generous budget */
const WAIT = 120000;
const problems: string[] = [];
/** threads the compose test creates; removed at the end so reruns stay clean */
const createdThreads: string[] = [];
/** so a retry can close the browser a failed pass left open */
let browserRef: Browser | null = null;

async function shot(page: Page, name: string, full = false) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("  saved", `${name}.png`);
}

async function open(page: Page, urlPath: string) {
  // a slow first compile on the shared dev server must not abort the run
  const res = await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded", timeout: 150000 }).catch((e) => {
    problems.push(`${urlPath} -> ${String(e).slice(0, 80)}`);
    return null;
  });
  const status = res?.status();
  if (status && status >= 400) problems.push(`${urlPath} -> ${status}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return status;
}

async function rawKeys(page: Page): Promise<string[]> {
  return (await page.evaluate(
    "(() => { const t = document.body.innerText; const m = t.match(/\\b(people|inbox|profile|common)\\.[a-zA-Z]+(\\.[a-zA-Z]+)*\\b/g) || []; return Array.from(new Set(m)).slice(0, 8); })()"
  )) as string[];
}

/** The session cookies the login API hands out. Driving the login FORM races
    hydration on the shared dev server: an unhydrated submit posts natively and
    lands back on /login, so the probe signs in over the API and injects the
    cookies into the browser context instead. */
async function sessionCookies(email: string) {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const out: { name: string; value: string; domain: string; path: string }[] = [];
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const i = pair.indexOf("=");
    if (i > 0) out.push({ name: pair.slice(0, i).trim(), value: pair.slice(i + 1), domain: "localhost", path: "/" });
  }
  if (!out.length) throw new Error(`login failed for ${email}: ${res.status}`);
  return out;
}

async function login(browser: Browser, email: string, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies(await sessionCookies(email));
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console(${email}): ${m.text().slice(0, 900)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror(${email}): ${String(e).slice(0, 900)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()} (${email}): ${r.url().slice(0, 160)}`);
  });
  return { ctx, page };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { db, schema } = await import("../../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const [head] = await db.select().from(schema.users).where(eq(schema.users.email, "head.stats@npc.qa")).limit(1);
  const [delegate] = head?.delegateUserId
    ? await db.select().from(schema.users).where(eq(schema.users.id, head.delegateUserId)).limit(1)
    : [];
  console.log(`delegate of head.stats: ${delegate?.email ?? "none"}`);
  // the seeded unread state for the Contributor (threads 2 and 6) so the dots show
  const [analyst] = await db.select().from(schema.users).where(eq(schema.users.email, "analyst@npc.qa")).limit(1);
  if (analyst) {
    const { and, inArray, like, notLike } = await import("drizzle-orm");
    // sweep threads an earlier aborted run composed from the demo card
    const stale = await db
      .select({ id: schema.messageThreads.id })
      .from(schema.messageThreads)
      .where(
        and(
          eq(schema.messageThreads.createdBy, analyst.id),
          like(schema.messageThreads.subject, "About: Third National Development Strategy%"),
          notLike(schema.messageThreads.id, "cr08msg_%")
        )
      );
    if (stale.length) {
      const ids = stale.map((s) => s.id);
      await db.delete(schema.messages).where(inArray(schema.messages.threadId, ids));
      await db.delete(schema.threadParticipants).where(inArray(schema.threadParticipants.threadId, ids));
      await db.delete(schema.messageThreads).where(inArray(schema.messageThreads.id, ids));
      for (const id of ids) await db.delete(schema.notifications).where(like(schema.notifications.link, `%thread=${id}`));
      console.log(`swept ${ids.length} stale probe thread(s)`);
    }
    await db
      .update(schema.threadParticipants)
      .set({ lastReadAt: null })
      .where(and(eq(schema.threadParticipants.userId, analyst.id), inArray(schema.threadParticipants.threadId, ["cr08msg_thread_2", "cr08msg_thread_6"])));
  }

  const browser = await chromium.launch({ channel: "msedge" });
  browserRef = browser;
  // PROBE_ONLY=inbox|demo|profile|delegate|mobile (comma separated) narrows a rerun
  const only = (process.env.PROBE_ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const want = (section: string) => !only.length || only.includes(section);

  /* ---- the Contributor's Inbox ---- */
  const { page } = await login(browser, "analyst@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    console.log(`\n== ${locale} ==`);
    if (!want("inbox")) break;
    await open(page, `/${locale}/inbox`);
    // the list paints when the server component's data lands; count only then
    await page
      .waitForSelector('[data-testid="inbox-thread-row"]', { timeout: WAIT })
      .catch(() => problems.push(`${locale}: no conversation rows`));
    const rows = await page.locator('[data-testid="inbox-thread-row"]').count();
    const groups = await page.locator('[data-testid="inbox-group"]').count();
    const unread = await page.locator('[data-testid="inbox-unread-dot"]').count();
    console.log(`  inbox: ${rows} rows in ${groups} groups, ${unread} unread`);
    if (!rows) problems.push(`${locale}: inbox empty`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `inbox-list-${locale}`);

    // open the second thread with the keyboard: focus the first row, ArrowDown, Enter
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.locator('[data-testid="inbox-thread-row"]').first().focus();
    await page.keyboard.press("ArrowDown");
    const focusedRow = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')");
    console.log(`  focus after ArrowDown: ${focusedRow}`);
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: thread did not open by keyboard`));
    console.log(`  thread opened: ${await page.locator('[data-testid="inbox-message"]').count()} messages, url has thread=${page.url().includes("thread=")}`);
    await shot(page, `inbox-thread-${locale}`);

    // deep link to the document thread (attachment)
    await open(page, `/${locale}/inbox?thread=cr08msg_thread_2`);
    await page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: deep link did not open`));
    console.log(`  deep link: attachments ${await page.locator('[data-testid="inbox-attachment"]').count()}, item link ${await page.locator('[data-testid="inbox-item-link"]').count()}`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `inbox-thread-attachment-${locale}`);

    // filters (each click refetches the list; wait for that response)
    const filterTo = async (f: string) => {
      const waiter = page.waitForResponse((r) => r.url().includes(`/api/v1/messages?filter=${f}`), { timeout: WAIT }).catch(() => null);
      await page.locator(`[data-testid="inbox-filter-${f}"]`).click();
      await waiter;
      await page.waitForTimeout(300);
      return page.locator('[data-testid="inbox-thread-row"]').count();
    };
    const unreadRows = await filterTo("unread");
    console.log(`  unread filter: ${unreadRows} rows`);
    const doneRows = await filterTo("done");
    console.log(`  done filter: ${doneRows} rows`);
    if (doneRows >= rows && rows > 1) problems.push(`${locale}: done filter did not narrow the list`);
    await shot(page, `inbox-filter-done-${locale}`);
    await filterTo("all");

    // by item type and by person (CR08 9.2), applied over the list in hand
    const kinds = await page.locator('[data-testid="inbox-filter-item"] option').count();
    const people = await page.locator('[data-testid="inbox-filter-person"] option').count();
    console.log(`  item type options: ${kinds}, person options: ${people}`);
    if (kinds < 2 || people < 2) problems.push(`${locale}: the item type or person filter has no options`);
    const firstKind = await page.locator('[data-testid="inbox-filter-item"] option').nth(1).getAttribute("value");
    await page.selectOption('[data-testid="inbox-filter-item"]', firstKind ?? "");
    await page.waitForTimeout(250);
    const byKind = await page.locator('[data-testid="inbox-thread-row"]').count();
    console.log(`  by item type "${firstKind}": ${byKind} rows`);
    if (byKind === 0 || byKind >= rows) problems.push(`${locale}: the item type filter did not narrow the list`);
    await shot(page, `inbox-filter-item-${locale}`);
    await page.locator('[data-testid="inbox-filter-clear"]').click();
    await page.waitForTimeout(250);
    const firstPerson = await page.locator('[data-testid="inbox-filter-person"] option').nth(1).getAttribute("value");
    await page.selectOption('[data-testid="inbox-filter-person"]', firstPerson ?? "");
    await page.waitForTimeout(250);
    const byPerson = await page.locator('[data-testid="inbox-thread-row"]').count();
    console.log(`  by person: ${byPerson} rows`);
    if (byPerson === 0 || byPerson >= rows) problems.push(`${locale}: the person filter did not narrow the list`);
    await shot(page, `inbox-filter-person-${locale}`);
    await page.locator('[data-testid="inbox-filter-clear"]').click();
    await page.waitForTimeout(250);

    if (locale === "en") {
      // reply on the welcome thread
      await open(page, `/en/inbox?thread=cr08msg_thread_6`);
      await page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT });
      const before = await page.locator('[data-testid="inbox-message"]').count();
      await page.fill('[data-testid="inbox-reply-text"]', "Probe reply: thanks, that answers it.");
      await page.locator('[data-testid="inbox-reply-send"]').click();
      await page.waitForFunction(`document.querySelectorAll('[data-testid="inbox-message"]').length > ${before}`, null, { timeout: WAIT }).catch(() => problems.push("reply did not append"));
      console.log(`  reply: ${before} -> ${await page.locator('[data-testid="inbox-message"]').count()} messages`);
      await shot(page, "inbox-reply-en");

      // mark done, reopen (the action disables its button while it runs, and
      // the round trip can take half a minute on the shared dev server)
      const doneButton = '[data-testid="inbox-done"]';
      const settled = async (was: string) =>
        page
          .waitForFunction(
            `(() => { const b = document.querySelector('${doneButton}'); return b && !b.disabled && b.innerText.trim() !== ${JSON.stringify(was)}; })()`,
            null,
            { timeout: WAIT }
          )
          .catch(() => problems.push("mark done did not settle"));
      const openLabel = (await page.locator(doneButton).innerText()).trim();
      await page.locator(doneButton).click();
      await settled(openLabel);
      const doneLabel = (await page.locator(doneButton).innerText()).trim();
      console.log(`  after mark done, button reads: ${doneLabel}`);
      if (doneLabel === openLabel) problems.push("mark done did not change the action label");
      await shot(page, "inbox-done-en");
      await page.locator(doneButton).click();
      await settled(doneLabel);

      // convert the project thread to a question (once)
      await open(page, `/en/inbox?thread=cr08msg_thread_1`);
      await page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT });
      if (await page.locator('[data-testid="inbox-convert"]').count()) {
        await page.locator('[data-testid="inbox-convert"]').click();
        await page.waitForSelector('[data-testid="inbox-view-question"]', { timeout: WAIT }).catch(() => problems.push("convert did not link a question"));
      }
      console.log(`  convert: question link ${await page.locator('[data-testid="inbox-view-question"]').count()}`);
      await shot(page, "inbox-converted-en");

      // new message dialog from the Inbox
      await page.locator('[data-testid="inbox-new"]').click();
      await page.waitForSelector('[data-testid="compose-dialog"]', { timeout: WAIT });
      await page.fill('[data-testid="compose-to-input"]', "Al");
      await page.waitForSelector('[data-testid="compose-to-option"]', { timeout: WAIT }).catch(() => problems.push("people search returned nothing"));
      await shot(page, "inbox-compose-search-en");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    }

  }

  /* ---- the OwnerControl demo ---- */
  for (const locale of ["en", "ar"] as const) {
    if (!want("demo")) break;
    await open(page, `/${locale}/inbox/demo`);
    const controls = await page.locator('[data-testid="owner-control"]').count();
    console.log(`  demo: ${controls} owner controls, compact ${await page.locator('[data-testid="owner-control-compact"]').count()}`);
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `people-demo-${locale}`, true);
    // hover intent opens the popover (skeleton first), then the card loads
    const first = page.locator('[data-testid="owner-control-trigger"]').first();
    const t0 = Date.now();
    await first.hover();
    await page.waitForSelector('[data-testid="person-card-popover"]', { timeout: 15000 }).catch(() => problems.push(`${locale}: hover did not open the person card`));
    console.log(`  popover opened ${Date.now() - t0}ms after hover`);
    await page.waitForSelector('[data-testid="person-card-message"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: person card never loaded`));
    console.log(`  card loaded ${Date.now() - t0}ms after hover`);
    console.log(`  person card: unit ${await page.locator('[data-testid="person-card-unit"]').count()}, delegate ${await page.locator('[data-testid="person-card-delegate"]').count()}, backup ${await page.locator('[data-testid="person-card-backup"]').count()}`);
    await shot(page, `people-card-${locale}`);
    // CR08 9.1: the backup owner carries the same actions, reached by
    // stepping the card into them and back
    if (await page.locator('[data-testid="person-card-backup-open"]').count()) {
      const owner = await page.locator('[data-testid="person-card"] .font-display').first().innerText();
      await page.locator('[data-testid="person-card-backup-open"]').click();
      await page.waitForSelector('[data-testid="person-card-back"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: stepping into the backup owner did not offer a way back`));
      await page
        .waitForFunction(
          `(() => { const n = document.querySelector('[data-testid="person-card"] .font-display'); return n && n.innerText.trim() && n.innerText.trim() !== ${JSON.stringify(owner.trim())}; })()`,
          null,
          { timeout: WAIT }
        )
        .catch(() => {});
      const stepped = await page.locator('[data-testid="person-card"] .font-display').first().innerText();
      console.log(`  stepped into the backup owner: "${owner}" -> "${stepped}"`);
      if (stepped === owner) problems.push(`${locale}: the card did not change person`);
      await shot(page, `people-card-backup-${locale}`);
      await page.locator('[data-testid="person-card-back"]').click();
      await page
        .waitForFunction(
          `(() => { const n = document.querySelector('[data-testid="person-card"] .font-display'); return n && n.innerText.trim() === ${JSON.stringify(owner.trim())}; })()`,
          null,
          { timeout: WAIT }
        )
        .catch(() => {});
      const returned = await page.locator('[data-testid="person-card"] .font-display').first().innerText();
      console.log(`  back returns to the owner: ${returned === owner}`);
      if (returned !== owner) problems.push(`${locale}: back did not return to the owner`);
    } else {
      problems.push(`${locale}: the demo card has no backup owner to step into`);
    }
    // Message from the card
    await page.locator('[data-testid="person-card-message"]').click();
    await page.waitForSelector('[data-testid="compose-dialog"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: compose did not open from the card`));
    console.log(`  compose subject: ${await page.locator('[data-testid="compose-subject"]').inputValue()}`);
    await shot(page, `people-compose-${locale}`);
    if (locale === "en") {
      await page.locator('[data-testid="compose-attach-open"]').click();
      await page.fill('[data-testid="compose-attach-input"]', "strategy");
      await page.waitForSelector('[data-testid="compose-attach-option"]', { timeout: WAIT }).catch(() => problems.push("attachment search returned nothing"));
      await page.locator('[data-testid="compose-attach-option"]').first().click();
      await shot(page, "people-compose-attachment-en");
      await page.locator('[data-testid="compose-send"]').click();
      await page.waitForSelector('[data-testid="compose-sent"]', { timeout: WAIT }).catch(() => problems.push("compose from the card did not send"));
      const href = (await page.locator('[data-testid="compose-open-inbox"]').getAttribute("href").catch(() => null)) ?? "";
      const createdId = /thread=([^&]+)/.exec(href)?.[1];
      if (createdId) createdThreads.push(createdId);
      await shot(page, "people-compose-sent-en");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    // tap opens too; Teams dialog
    await page.locator('[data-testid="owner-control-trigger"]').nth(1).click();
    await page.waitForSelector('[data-testid="person-card-teams"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: click did not open the person card`));
    await page.locator('[data-testid="person-card-teams"]').click();
    await page.waitForSelector('[data-testid="teams-dialog"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: Teams dialog did not open`));
    await shot(page, `people-teams-${locale}`);
    await page.locator('[data-testid="teams-close"]').click();
    await page.waitForTimeout(300);
    // Escape closes an opened card
    await page.locator('[data-testid="owner-control-trigger"]').nth(2).click();
    await page.waitForSelector('[data-testid="person-card"]', { timeout: WAIT }).catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log(`  escape closed the card: ${(await page.locator('[data-testid="person-card"]').count()) === 0}`);
    // joint leads expand
    await page.locator('[data-testid="owner-control-more"]').first().click();
    console.log(`  joint leads expanded: ${await page.locator('[data-testid="owner-control-others"]').count()}`);
    await shot(page, `people-joint-leads-${locale}`);
  }

  /* ---- the profile delegate block ---- */
  for (const locale of ["en", "ar"] as const) {
    if (!want("profile")) break;
    await open(page, `/${locale}/profile`);
    await page.waitForSelector('[data-testid="delegate-block"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: delegate block missing`));
    await page.locator('[data-testid="delegate-block"]').scrollIntoViewIfNeeded();
    console.log("  raw keys:", (await rawKeys(page)).join(", ") || "none");
    await shot(page, `people-delegate-${locale}`);
  }

  /* ---- the delegate sees the thread "as delegate" ---- */
  if (delegate && want("delegate")) {
    const d = await login(browser, delegate.email);
    for (const locale of ["en", "ar"] as const) {
      await open(d.page, `/${locale}/inbox?filter=delegate&thread=cr08msg_thread_3`);
      await d.page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT }).catch(() => problems.push(`${locale}: delegate could not open the delegated thread`));
      const chips = await d.page.locator('[data-testid="delegate-chip"]').count();
      console.log(`  delegate (${locale}): ${await d.page.locator('[data-testid="inbox-thread-row"]').count()} rows, ${chips} delegate chips`);
      if (!chips) problems.push(`${locale}: no "as delegate" chip`);
      await shot(d.page, `inbox-delegate-${locale}`);
    }
    await d.ctx.close();
  } else if (!delegate) {
    problems.push("no delegate seeded for head.stats");
  }

  /* ---- 390px: one pane with back ---- */
  if (want("mobile")) {
    // the shell keeps the rail expanded at 390px; collapse it through the
    // stored preference so the page itself is what the screenshot shows
    const originalPrefs = analyst?.prefsJson ?? null;
    if (analyst) {
      let prefs: Record<string, unknown> = {};
      try {
        prefs = originalPrefs ? JSON.parse(originalPrefs) : {};
      } catch {
        prefs = {};
      }
      await db
        .update(schema.users)
        .set({ prefsJson: JSON.stringify({ ...prefs, rail: { ...((prefs.rail as object) ?? {}), expanded: false } }) })
        .where(eq(schema.users.id, analyst.id));
    }
    const m = await login(browser, "analyst@npc.qa", { width: 390, height: 844 });
    await open(m.page, "/en/inbox");
    await shot(m.page, "inbox-390-en");
    await m.page.locator('[data-testid="inbox-thread-row"]').first().click();
    await m.page.waitForSelector('[data-testid="inbox-message"]', { timeout: WAIT }).catch(() => problems.push("390: thread did not open"));
    await shot(m.page, "inbox-390-thread-en");
    await m.page.locator('[data-testid="inbox-back"]').click();
    await m.page.waitForTimeout(400);
    console.log(`  390 back shows the list: ${await m.page.locator('[data-testid="inbox-thread-row"]').first().isVisible()}`);
    await open(m.page, "/ar/inbox?thread=cr08msg_thread_2");
    await shot(m.page, "inbox-390-thread-ar");
    await m.ctx.close();
    if (analyst) {
      await db.update(schema.users).set({ prefsJson: originalPrefs }).where(eq(schema.users.id, analyst.id));
    }
  }

  await browser.close();

  const { inArray, like } = await import("drizzle-orm");
  if (createdThreads.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.threadId, createdThreads));
    await db.delete(schema.threadParticipants).where(inArray(schema.threadParticipants.threadId, createdThreads));
    await db.delete(schema.messageThreads).where(inArray(schema.messageThreads.id, createdThreads));
    for (const id of createdThreads) {
      await db.delete(schema.notifications).where(like(schema.notifications.link, `%thread=${id}`));
    }
    console.log(`cleaned up ${createdThreads.length} probe thread(s)`);
  }
  // the reply test writes into a seeded conversation: take the line back out
  // so a rerun does not stack copies of it on the seeded thread
  const replies = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(like(schema.messages.body, "Probe reply:%"));
  if (replies.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.id, replies.map((r) => r.id)));
    console.log(`cleaned up ${replies.length} probe reply line(s)`);
  }
}

/** one retry: a first compile on the shared dev server can still outrun a
    single wait, and a rerun starts from a warm route */
async function withRetry() {
  try {
    await main();
  } catch (e) {
    console.error("first pass failed, retrying once:", String(e).slice(0, 300));
    await browserRef?.close().catch(() => {});
    problems.length = 0;
    await main();
  }
}

withRetry()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log("\nproblems:", problems.length ? "" : "none");
    for (const p of problems) console.log(" -", p);
    process.exit(process.exitCode ?? 0);
  });
