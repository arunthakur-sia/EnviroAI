/* eslint-disable no-console */
// CR08 14.3: the end-to-end scenarios, driven through a real browser against
// the RUNNING server (npm run start:demo, or `next start`). Nine journeys, in
// the order a person would meet them: Ask EnviroAI everywhere, Knowledge of the
// Week, messaging between two people, the Reports lifecycle, an Organisation
// structure edit that is undone again, the Leaderboard, a handover from both
// sides, the seven roles and what each of them may see, and the Arabic mirror.
//
//   npx tsx scripts/qc/e2e-scenarios.ts [--only 1,4,9] [--keep-open]
//
// House rules this file obeys, because nothing else works on this machine:
//   - the bundled Playwright browsers are blocked by Application Control, so
//     the system Edge is launched with { channel: "msedge" }
//   - page.evaluate() is handed a STRING, never a function literal
//   - signing in goes through POST /api/v1/auth/login on the context's request
//     jar, never the login form, whose button may not have hydrated yet
//   - the Knowledge of the Week reveal is dismissed before anything is clicked
//
// Every scenario ends with a screenshot in data/screenshots/cr08-e2e/ so a
// person can see what the browser saw.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const SHOT_DIR = path.join(ROOT, "data", "screenshots", "cr08-e2e");
const PASSWORD = "EnviroAI!2026";
const VIEWPORT = { width: 1440, height: 900 };
const ONLY = process.argv.includes("--only")
  ? new Set(String(process.argv[process.argv.indexOf("--only") + 1] ?? "").split(",").map((s) => s.trim()))
  : null;

/* ------------------------------------------------------------------ */
/* the ledger                                                           */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function group(title: string): void {
  console.log(`\n${title}`);
}

function check(name: string, ok: boolean, detail = ""): boolean {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` (${detail})` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
  }
  return ok;
}

function skip(name: string, reason: string): void {
  skipped++;
  console.log(`  skip ${name} (${reason})`);
}

/* ------------------------------------------------------------------ */
/* browser helpers                                                      */
/* ------------------------------------------------------------------ */

let shotIndex = 0;
async function shot(page: Page, name: string): Promise<void> {
  shotIndex++;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
}

async function signIn(browser: Browser, email: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  ctx.setDefaultTimeout(45_000);
  ctx.setDefaultNavigationTimeout(180_000);
  const res = await ctx.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
    timeout: 120_000,
  });
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()}`);
  return ctx;
}

async function open(page: Page, url: string): Promise<number> {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  return res?.status() ?? 0;
}

/** The first page a person opens in a week raises the reveal, a modal at z-80
    that intercepts every click underneath. Take it, as a person would. */
async function dismissKow(page: Page): Promise<void> {
  await page.goto(`${BASE}/en/home`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const close = page.locator('[data-testid="kow-reveal-close"]');
  if (await close.count()) await close.first().click({ timeout: 30_000 }).catch(() => {});
  await page.locator('[data-testid="kow-reveal"]').waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
}

/** The shell mounts the Ask launcher only after hydration, so it is the gate
    the keyboard shortcut waits on; the press is repeated a few times because a
    freshly loaded page can swallow the first one. */
async function openAskPanel(page: Page): Promise<boolean> {
  await page
    .locator('[data-testid="ask-launcher-button"]')
    .waitFor({ state: "attached", timeout: 90_000 })
    .catch(() => {});
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.keyboard.press("Control+k");
    try {
      await page.locator('[data-testid="ask-panel"][data-state="open"]').waitFor({ state: "visible", timeout: 3_000 });
      return true;
    } catch {
      /* not hydrated yet */
    }
  }
  return false;
}

async function count(page: Page, selector: string): Promise<number> {
  return page.locator(selector).count();
}

async function text(page: Page, selector: string): Promise<string> {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) return "";
  return (await loc.innerText()).replace(/\s+/g, " ").trim();
}

/** page.evaluate is handed a string expression that returns JSON. */
async function evalJson<T>(page: Page, expression: string): Promise<T> {
  const raw = await page.evaluate(expression);
  return JSON.parse(String(raw)) as T;
}

/** Null when the analyst's model answers, otherwise why it cannot. The Ask
    scenario asks for citations, and the analyst can only cite what its tools
    gathered; when the model is unreachable it answers from its offline
    writer, and the citation assertion has nothing real to stand on. */
async function modelUnreachable(): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "ANTHROPIC_API_KEY is not set";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "ok" }],
      }),
    });
    if (res.ok) return null;
    const body = await res.text();
    const message = /"message":"([^"]+)"/.exec(body);
    return `${res.status} ${message ? message[1] : body.slice(0, 120)}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/* ------------------------------------------------------------------ */
/* fixtures read straight from the demo database                        */
/* ------------------------------------------------------------------ */

type Fixtures = {
  db: Client;
  adminId: string;
  askProject: { id: string; code: string; title: string };
  ownedProject: { id: string; code: string; title: string; ownerEmail: string; ownerName: string };
  kow: { id: string; href: string; title: string } | null;
  publishedReportId: string;
  adminHandoverId: string | null;
  recipient: { email: string; handoverId: string } | null;
};

function one(row: Record<string, unknown> | undefined, key: string): string {
  return row && row[key] != null ? String(row[key]) : "";
}

async function loadFixtures(): Promise<Fixtures> {
  const db = createClient({ url: `file:${ROOT.replace(/\\/g, "/")}/data/nexus.db` });

  const admin = await db.execute("select id from users where email = 'admin@enviroai.demo' limit 1");
  const project = await db.execute(
    "select id, code, title_en from strategy_nodes where node_type = 'project' and code is not null order by code limit 1"
  );
  const owned = await db.execute(
    `select n.id, n.code, n.title_en, u.email, u.name_en
       from strategy_nodes n join users u on u.id = n.owner_user_id
      where n.node_type = 'project' and u.email <> 'analyst@enviroai.demo'
      order by n.code limit 1`
  );
  const kowRow = await db.execute(
    "select id, resource_type, resource_id from knowledge_of_week where status = 'active' order by week_start desc limit 1"
  );
  const report = await db.execute(
    "select id from reports where status = 'published' and docx_path is not null order by created_at limit 1"
  );
  const handover = await db.execute(
    "select id from handovers where status = 'in_progress' order by completion_pct desc limit 1"
  );
  const path0 = await db.execute(
    `select u.email as email, p.handover_id as handover_id
       from handover_learning_paths p join users u on u.id = p.recipient_user_id
      order by p.id limit 1`
  );

  let kow: Fixtures["kow"] = null;
  const k = kowRow.rows[0] as Record<string, unknown> | undefined;
  if (k) {
    const type = one(k, "resource_type");
    const id = one(k, "resource_id");
    const href = type === "lesson" ? `/lessons/${id}` : type === "report" ? `/reports/${id}` : `/vault/${id}`;
    let title = "";
    if (type === "lesson") {
      const r = await db.execute({ sql: "select title_en from lessons where id = ?", args: [id] });
      title = one(r.rows[0] as Record<string, unknown> | undefined, "title_en");
    } else if (type === "report") {
      const r = await db.execute({ sql: "select title_en from reports where id = ?", args: [id] });
      title = one(r.rows[0] as Record<string, unknown> | undefined, "title_en");
    } else {
      const r = await db.execute({ sql: "select title_en from documents where id = ?", args: [id] });
      title = one(r.rows[0] as Record<string, unknown> | undefined, "title_en");
    }
    kow = { id: one(k, "id"), href, title };
  }

  const p = project.rows[0] as Record<string, unknown> | undefined;
  const o = owned.rows[0] as Record<string, unknown> | undefined;
  const lp = path0.rows[0] as Record<string, unknown> | undefined;

  return {
    db,
    adminId: one(admin.rows[0] as Record<string, unknown> | undefined, "id"),
    askProject: { id: one(p, "id"), code: one(p, "code"), title: one(p, "title_en") },
    ownedProject: {
      id: one(o, "id"),
      code: one(o, "code"),
      title: one(o, "title_en"),
      ownerEmail: one(o, "email"),
      ownerName: one(o, "name_en"),
    },
    kow,
    publishedReportId: one(report.rows[0] as Record<string, unknown> | undefined, "id"),
    adminHandoverId: handover.rows[0] ? one(handover.rows[0] as Record<string, unknown>, "id") : null,
    recipient: lp ? { email: one(lp, "email"), handoverId: one(lp, "handover_id") } : null,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Ask EnviroAI everywhere                                                */
/* ------------------------------------------------------------------ */

async function scenarioAsk(browser: Browser, fx: Fixtures): Promise<void> {
  group("1. Ask EnviroAI everywhere");
  const ctx = await signIn(browser, "admin@enviroai.demo");
  const page = await ctx.newPage();
  try {
    await dismissKow(page);
    await open(page, `${BASE}/en/strategy/${fx.askProject.id}`);
    check("project page opens", (await count(page, '[data-testid="node-hero"]')) > 0, fx.askProject.code);

    check("Ctrl+K opens the Ask panel", await openAskPanel(page));
    const chip = await text(page, '[data-testid="ask-context-chip"]');
    check(
      "the panel names the item on a context chip",
      chip.includes(fx.askProject.code) || chip.includes(fx.askProject.title),
      chip.slice(0, 90)
    );

    await page.locator('[data-testid="ask-composer"]').fill(`What has ${fx.askProject.code} delivered so far?`);
    await page.locator('[data-testid="ask-send"]').click();
    let answered = true;
    await page
      .locator('[data-testid="ask-turn-assistant"]')
      .first()
      .waitFor({ state: "visible", timeout: 300_000 })
      .catch(() => {
        answered = false;
      });
    check("the streamed answer arrives in the panel", answered);
    const citations = await count(page, '[data-testid="ask-turn-assistant"] [data-testid="citation-row"]');
    if (citations >= 1) {
      check("the answer carries at least one citation", true, `${citations} citations`);
    } else {
      const why = await modelUnreachable();
      if (why) {
        skip(
          "the answer carries at least one citation",
          `the analyst answered from its offline writer: the model is unavailable here (${why})`
        );
      } else {
        check("the answer carries at least one citation", false, "0 citations");
      }
    }
    await shot(page, "ask-panel-answer");

    const conversationId = (await page.locator('[data-testid="ask-panel"]').getAttribute("data-conversation-id")) ?? "";
    check("the panel adopted the conversation", conversationId.length > 0);

    // a client navigation through the rail: the thread lives outside React
    await page.locator('[data-testid="rail-vault"]').click();
    await page.waitForURL("**/en/vault", { timeout: 120_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    const stillOpen = (await count(page, '[data-testid="ask-panel"][data-state="open"]')) === 1;
    const keptTurns = await count(page, '[data-testid="ask-turn-assistant"]');
    const keptId = (await page.locator('[data-testid="ask-panel"]').getAttribute("data-conversation-id")) ?? "";
    check("the panel survives the route change", stillOpen && page.url().includes("/vault"), page.url());
    check("the thread is still there after the route change", keptTurns >= 1 && keptId === conversationId, `${keptTurns} answers`);

    await page.locator('[data-testid="ask-expand"]').click();
    await page.waitForURL("**/ask/c/**", { timeout: 120_000 }).catch(() => {});
    // a client navigation into a server-rendered page: wait for the turn
    // itself, because there is no network to go idle at the moment of the push
    await page
      .locator('[data-testid="workspace-turn"]')
      .first()
      .waitFor({ state: "visible", timeout: 120_000 })
      .catch(() => {});
    const turns = await count(page, '[data-testid="workspace-turn"]');
    check(
      "Expand opens the same conversation on the full Ask page",
      page.url().includes(`/ask/c/${conversationId}`) && turns >= 1,
      `${page.url()} ${turns} turns`
    );
    await shot(page, "ask-full-page");

    // the suite's own conversation is removed again, so a rerun starts clean
    if (conversationId) {
      await ctx.request.delete(`${BASE}/api/v1/conversations/${conversationId}`).catch(() => {});
    }
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 2. Knowledge of the Week                                             */
/* ------------------------------------------------------------------ */

async function scenarioKow(browser: Browser, fx: Fixtures): Promise<void> {
  group("2. Knowledge of the Week");
  if (!fx.kow) {
    skip("Knowledge of the Week", "no active pick in the database");
    return;
  }
  // The reveal is once per person per week, and the other scenarios sign the
  // Super Admin in too, so this person's whole interaction with the week's
  // pick is rolled back first: the seen mark, the read mark and the one read
  // it added to the count. The scenario then asks the product a real question
  // every time it runs, and the pick's read count is where it started.
  const read = await fx.db.execute({
    sql: "select id from knowledge_of_week_reads where kow_id = ? and user_id = ?",
    args: [fx.kow.id, fx.adminId],
  });
  if (read.rows.length) {
    await fx.db.execute({
      sql: "delete from knowledge_of_week_reads where kow_id = ? and user_id = ?",
      args: [fx.kow.id, fx.adminId],
    });
    await fx.db.execute({
      sql: "update knowledge_of_week set read_count = max(0, read_count - 1) where id = ?",
      args: [fx.kow.id],
    });
  }
  await fx.db.execute({
    sql: "delete from knowledge_of_week_seen where kow_id = ? and user_id = ?",
    args: [fx.kow.id, fx.adminId],
  });

  const ctx = await signIn(browser, "admin@enviroai.demo");
  const page = await ctx.newPage();
  try {
    await open(page, `${BASE}/en/home`);
    let revealed = true;
    await page
      .locator('[data-testid="kow-reveal"]')
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {
        revealed = false;
      });
    check("a fresh sign-in raises the reveal on Home", revealed);
    await shot(page, "kow-reveal");

    await page.locator('[data-testid="kow-reveal-read"]').click();
    await page.waitForURL(`**${fx.kow.href}`, { timeout: 120_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    check("Read now opens the item", page.url().includes(fx.kow.href), page.url());
    await shot(page, "kow-item");

    await open(page, `${BASE}/en/home`);
    const again = await count(page, '[data-testid="kow-reveal"]');
    check("the reveal does not come back on the next open", again === 0, `${again} reveals`);

    const strip = (await count(page, '[data-testid="kow-strip"]')) === 1;
    const stripTitle = await text(page, '[data-testid="kow-strip-title"]');
    const reads = await text(page, '[data-testid="kow-strip-reads"]');
    check("the Home strip carries the pick all week", strip && stripTitle.length > 0, stripTitle.slice(0, 60));
    check("the strip names this week's pick", stripTitle === fx.kow.title, `${stripTitle} vs ${fx.kow.title}`);
    check("the strip shows the read count", /\d|[٠-٩]/.test(reads), reads.slice(0, 40));
    check("the strip marks the viewer as having read it", (await count(page, '[data-testid="kow-strip-read-mark"]')) === 1);
    await shot(page, "kow-strip");
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 3. Messaging                                                         */
/* ------------------------------------------------------------------ */

async function scenarioMessaging(browser: Browser, fx: Fixtures): Promise<void> {
  group("3. Messaging");
  if (!fx.ownedProject.id || !fx.ownedProject.ownerEmail) {
    skip("messaging", "no strategy item with a person owner in the database");
    return;
  }
  const marker = `qc-e2e-${Date.now().toString(36)}`;
  // a marker of its own, so waiting for the reply never matches the question
  const replyMarker = `${marker}-reply`;
  const reply = `Noted, the milestone is signed off by the unit head. ${replyMarker}`;

  const sender = await signIn(browser, "analyst@enviroai.demo");
  const recipient = await signIn(browser, fx.ownedProject.ownerEmail);
  const a = await sender.newPage();
  const b = await recipient.newPage();
  try {
    await dismissKow(a);
    await open(a, `${BASE}/en/strategy/${fx.ownedProject.id}`);
    const owners = await count(a, '[data-testid="owner-control-trigger"]');
    check("the item page carries an owner chip", owners >= 1, `${fx.ownedProject.code} ${fx.ownedProject.ownerName}`);

    await a.locator('[data-testid="owner-control-trigger"]').first().click();
    let carded = true;
    await a
      .locator('[data-testid="person-card"]')
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {
        carded = false;
      });
    check("the person card opens from the chip", carded);
    await shot(a, "messaging-person-card");

    await a.locator('[data-testid="person-card-message"]').click();
    await a.locator('[data-testid="compose-dialog"]').waitFor({ state: "visible", timeout: 30_000 });
    const subjectBox = a.locator('[data-testid="compose-subject"]');
    const subject = `${(await subjectBox.inputValue()).trim()} [${marker}]`;
    await subjectBox.fill(subject);
    await a.locator('[data-testid="compose-body"]').fill(
      `Could you confirm who signs off the next milestone on ${fx.ownedProject.code}? ${marker}`
    );
    await a.locator('[data-testid="compose-send"]').click();
    let sent = true;
    await a
      .locator('[data-testid="compose-sent"]')
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {
        sent = false;
      });
    check("the message is sent from the person card", sent, subject.slice(0, 60));

    /* the recipient */
    await dismissKow(b);
    const badge = await count(b, '[data-testid="bar-inbox"] span');
    check("the recipient's top bar shows the unread badge", badge >= 1, `${badge} badge`);

    await open(b, `${BASE}/en/inbox`);
    const row = b.locator('[data-testid="inbox-thread-row"]', { hasText: marker }).first();
    let arrived = true;
    await row.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {
      arrived = false;
    });
    check("the message is in the recipient's inbox", arrived);
    const unread = arrived ? await row.getAttribute("data-unread") : null;
    check("the inbox row is marked unread", unread === "1", String(unread));
    check(
      "the unread dot is on the row",
      arrived && (await b.locator('[data-testid="inbox-thread-row"] [data-testid="inbox-unread-dot"]').count()) >= 1
    );
    await shot(b, "messaging-inbox-unread");

    if (arrived) {
      await row.click();
      await b.locator('[data-testid="inbox-messages"]').waitFor({ state: "visible", timeout: 30_000 });
      const got = await count(b, '[data-testid="inbox-message"]');
      check("the thread opens with the message in it", got >= 1, `${got} messages`);
      await b.locator('[data-testid="inbox-reply-text"]').fill(reply);
      await b.locator('[data-testid="inbox-reply-send"]').click();
      let posted = true;
      await b
        .locator('[data-testid="inbox-message"]', { hasText: replyMarker })
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .catch(() => {
          posted = false;
        });
      const after = await count(b, '[data-testid="inbox-message"]');
      check("the reply is posted", posted && after > got, `${got} -> ${after}`);
      await shot(b, "messaging-reply");
    }

    /* back to the first person */
    await open(a, `${BASE}/en/inbox`);
    const mine = a.locator('[data-testid="inbox-thread-row"]', { hasText: marker }).first();
    let visible = true;
    await mine.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {
      visible = false;
    });
    if (visible) {
      await mine.click();
      await a.locator('[data-testid="inbox-messages"]').waitFor({ state: "visible", timeout: 30_000 });
      const theirs = a.locator('[data-testid="inbox-message"][data-mine="0"]', { hasText: reply });
      let seen = true;
      await theirs
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .catch(() => {
          seen = false;
        });
      check("the first person sees the reply", seen);
      await shot(a, "messaging-reply-seen");
    } else {
      check("the first person sees the reply", false, "the thread did not appear in the sender's inbox");
    }
  } finally {
    await sender.close();
    await recipient.close();
  }
}

/* ------------------------------------------------------------------ */
/* 4. Reports lifecycle                                                 */
/* ------------------------------------------------------------------ */

async function scenarioReports(browser: Browser, fx: Fixtures): Promise<void> {
  group("4. Reports lifecycle");
  const ctx = await signIn(browser, "admin@enviroai.demo");
  const page = await ctx.newPage();
  try {
    await dismissKow(page);
    await open(page, `${BASE}/en/reports`);
    check("the Reports hub renders", (await count(page, '[data-testid="reports-hub"]')) === 1);
    const covers = await count(page, '[data-testid="cover-grid"] a');
    check("the cover gallery lists reports", covers >= 1, `${covers} covers`);

    const cover = page.locator(`[data-testid="cover-grid"] a[href$="${fx.publishedReportId}"]`).first();
    const openable = fx.publishedReportId.length > 0 && (await cover.count()) > 0;
    check("a published report is on the shelf", openable, fx.publishedReportId);
    if (openable) {
      await cover.click();
      await page.locator('[data-testid="report-page"]').waitFor({ state: "visible", timeout: 120_000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      const status = (await page.locator('[data-testid="report-page"]').getAttribute("data-status")) ?? "";
      check("a published report opens", status === "published", status);
      const sections = await count(page, '[data-testid="report-section"]');
      check("the report shows its sections", sections >= 1, `${sections} sections`);
      const downloads =
        (await count(page, '[data-testid="download-en"]')) + (await count(page, '[data-testid="download-ar"]'));
      check("the report shows the download control", downloads >= 1, `${downloads} download links`);
      await shot(page, "report-published");
    }

    await open(page, `${BASE}/en/reports/new`);
    check("the report builder opens", (await count(page, '[data-testid="report-builder"]')) === 1);
    const typeCard = page.locator('[data-testid="type-card"][data-type-code="npc_annual_report"]');
    if (await typeCard.count()) {
      await typeCard.click();
    } else {
      await page.locator('[data-testid="type-card"]').first().click();
    }
    check("a report type is chosen", (await text(page, '[data-testid="summary-type"]')).length > 0);

    for (const step of ["periodScope", "audience", "sections"]) {
      const next = page.locator('[data-testid="builder-next"]');
      if (await next.count()) {
        if (await next.isDisabled()) {
          // a type scoped to the Programme Office needs no pick; anything else does
          const orgKind = page.locator('[data-testid="scope-kind-org"]');
          if (await orgKind.count()) await orgKind.click();
        }
        await next.click();
      }
      await page.locator(`[data-testid="builder-step-${step}"]`).waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    }
    check("the builder reaches the last step", (await count(page, '[data-testid="builder-step-sections"]')) === 1);
    const listed = await count(page, '[data-testid="structure-list"] li');
    check("the live structure preview lists sections", listed >= 1, `${listed} sections`);
    check("the preview totals the pages", (await text(page, '[data-testid="structure-total"]')).length > 0);
    check("nothing was generated", (await count(page, '[data-testid="generate"]')) === 1 && page.url().includes("/reports/new"));
    await shot(page, "report-builder-summary");
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 5. Organisation structure edit                                       */
/* ------------------------------------------------------------------ */

const TREE_SIGNATURE = `JSON.stringify([...document.querySelectorAll('[data-testid="org-editor-row"]')].map(function (r) {
  var n = r.querySelector('[data-testid="org-editor-rename"]');
  return (r.getAttribute("data-unit-code") || "") + "|" + (r.getAttribute("data-parent-code") || "") + "|" + ((n && n.textContent) || "").trim();
}).sort())`;

/** Every structure mutation reloads the editor through GET .../structure. */
async function afterOrgWrite(page: Page, action: () => Promise<void>): Promise<void> {
  const wait = page
    .waitForResponse((r) => r.url().includes("/api/v1/organisation/structure"), { timeout: 90_000 })
    .catch(() => null);
  await action();
  await wait;
  await page.waitForTimeout(400);
}

async function scenarioOrganisation(browser: Browser): Promise<void> {
  group("5. Organisation structure edit");
  const ctx = await signIn(browser, "admin@enviroai.demo");
  const page = await ctx.newPage();
  const CHILD = "QCE2E";
  const GRAND = "QCE2EC";
  try {
    await dismissKow(page);
    await open(page, `${BASE}/en/settings?tab=organisation`);
    await page.locator('[data-testid="org-tree-editor"]').waitFor({ state: "visible", timeout: 120_000 });
    await page.locator('[data-testid="org-editor-row"]').first().waitFor({ state: "visible", timeout: 60_000 });
    check("Settings > Organisation opens the structure editor", (await count(page, '[data-testid="organisation-settings"]')) === 1);

    const before = await evalJson<string[]>(page, TREE_SIGNATURE);
    check("the starting tree is readable", before.length > 1, `${before.length} units`);
    const parentRow = page.locator('[data-testid="org-editor-row"]').first();
    const parentCode = (await parentRow.getAttribute("data-unit-code")) ?? "";
    const parentId = (await parentRow.getAttribute("data-unit-id")) ?? "";

    /* add a child, then a grandchild so the delete has something to reassign */
    await afterOrgWrite(page, async () => {
      await parentRow.locator('[data-testid="org-editor-add"]').click();
      await page.locator('[data-testid="org-unit-dialog"]').waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('[data-testid="org-unit-code"]').fill(CHILD);
      await page.locator('[data-testid="org-unit-name-en"]').fill("QC End To End Unit");
      await page.locator('[data-testid="org-unit-name-ar"]').fill("وحدة الفحص الشامل");
      await page.locator('[data-testid="org-unit-save"]').click();
    });
    const childRow = page.locator(`[data-testid="org-editor-row"][data-unit-code="${CHILD}"]`);
    check("a child unit is added", (await childRow.count()) === 1, `under ${parentCode}`);
    const snapshotNote = await text(page, '[data-testid="org-snapshot-row"]');
    check("the add took a snapshot", snapshotNote.includes(CHILD), snapshotNote.slice(0, 80));

    await afterOrgWrite(page, async () => {
      await childRow.locator('[data-testid="org-editor-add"]').click();
      await page.locator('[data-testid="org-unit-dialog"]').waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('[data-testid="org-unit-code"]').fill(GRAND);
      await page.locator('[data-testid="org-unit-name-en"]').fill("QC End To End Section");
      await page.locator('[data-testid="org-unit-name-ar"]').fill("قسم الفحص الشامل");
      await page.locator('[data-testid="org-unit-save"]').click();
    });
    const grandRow = page.locator(`[data-testid="org-editor-row"][data-unit-code="${GRAND}"]`);
    check("a unit sits beneath it, so the delete must reassign", (await grandRow.count()) === 1);

    /* rename in place */
    await afterOrgWrite(page, async () => {
      await childRow.locator('[data-testid="org-editor-rename"]').click();
      await page.locator('[data-testid="org-rename-en"]').fill("QC Renamed Unit");
      await page.locator('[data-testid="org-rename-ar"]').fill("وحدة أعيدت تسميتها");
      await page.locator('[data-testid="org-rename-save"]').click();
    });
    check("the unit is renamed in place", (await childRow.locator('[data-testid="org-editor-rename"]').innerText()).includes("QC Renamed Unit"));
    await shot(page, "org-added-renamed");

    /* delete, with the child reassigned to the original parent */
    await childRow.locator('[data-testid="org-editor-menu"]').click();
    await page.locator('[data-testid="org-menu-delete"]').click();
    await page.locator('[data-testid="org-risk-dialog"]').waitFor({ state: "visible", timeout: 30_000 });
    await page.locator('[data-testid="org-impact-list"]').waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
    const needsReassign = (await count(page, '[data-testid="org-risk-target"]')) === 1;
    check("the delete asks where everything beneath it goes", needsReassign);
    await shot(page, "org-risk-dialog");
    if (needsReassign) {
      await page.locator('[data-testid="org-risk-target"]').selectOption(parentId);
    }
    await afterOrgWrite(page, async () => {
      await page.locator('[data-testid="org-risk-confirm"]').click();
    });
    check("the unit is deleted", (await childRow.count()) === 0);
    check(
      "what sat beneath it moved to the chosen unit",
      (await grandRow.count()) === 1 && (await grandRow.getAttribute("data-parent-code")) === parentCode,
      String(await grandRow.getAttribute("data-parent-code"))
    );

    /* undo, until the tree is exactly as it was found */
    let undos = 0;
    let now = await evalJson<string[]>(page, TREE_SIGNATURE);
    while (undos < 8 && JSON.stringify(now) !== JSON.stringify(before)) {
      if (!(await count(page, '[data-testid="org-undo"]'))) break;
      await afterOrgWrite(page, async () => {
        await page.locator('[data-testid="org-undo"]').click();
      });
      undos++;
      now = await evalJson<string[]>(page, TREE_SIGNATURE);
    }
    check("the first undo puts the deleted unit back", undos >= 1, `${undos} undos`);
    check("the tree is back to its starting shape", JSON.stringify(now) === JSON.stringify(before), `${now.length} vs ${before.length} units`);
    check("no trace of the scenario is left in the structure", (await childRow.count()) === 0 && (await grandRow.count()) === 0);
    const snapshots = await count(page, '[data-testid="org-snapshot-row"]');
    check("the snapshots record what happened", snapshots >= 1, `${snapshots} snapshots`);
    await shot(page, "org-restored");
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 6. Leaderboard                                                       */
/* ------------------------------------------------------------------ */

async function boardSwitch(page: Page, testId: string): Promise<boolean> {
  const wait = page
    .waitForResponse((r) => r.url().includes("/api/v1/leaderboard") && r.request().method() === "GET", { timeout: 90_000 })
    .catch(() => null);
  await page.locator(`[data-testid="${testId}"]`).click();
  const res = await wait;
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.locator('[data-testid="board-section"]').waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  return Boolean(res && res.status() === 200);
}

async function runLeaderboard(page: Page, locale: string, prefix: string): Promise<void> {
  await open(page, `${BASE}/${locale}/leaderboard`);
  check(`${prefix}the leaderboard opens`, (await count(page, '[data-testid="leaderboard-page"]')) === 1);
  check(`${prefix}the People board renders`, (await count(page, '[data-testid="board-table"][data-board="people"]')) === 1);
  check(`${prefix}the viewer's own row is pinned on the People board`, (await count(page, '[data-testid="own-row"]')) === 1);
  check(
    `${prefix}the pinned row is the viewer's own standing, not the empty line`,
    (await count(page, '[data-testid="own-row"]:not([data-empty])')) === 1
  );

  check(`${prefix}switching to the Departments board reloads it`, await boardSwitch(page, "board-departments"));
  check(
    `${prefix}the Departments board renders`,
    (await count(page, '[data-testid="board-table"][data-board="departments"]')) === 1
  );
  check(`${prefix}the viewer's own unit row is pinned`, (await count(page, '[data-testid="own-unit-row"]')) === 1);
  check(
    `${prefix}the pinned unit row is a real standing`,
    (await count(page, '[data-testid="own-unit-row"]:not([data-empty])')) === 1
  );

  check(`${prefix}switching back to People reloads it`, await boardSwitch(page, "board-people"));
  const periodBefore = await text(page, '[data-testid="period-label"]');
  check(`${prefix}switching the period reloads the board`, await boardSwitch(page, "window-year"));
  const periodAfter = await text(page, '[data-testid="period-label"]');
  check(`${prefix}the period label follows the switch`, periodAfter !== periodBefore, `${periodBefore} -> ${periodAfter}`);
  check(`${prefix}the table is there after the period switch`, (await count(page, '[data-testid="board-section"]')) === 1);

  check(`${prefix}switching the category reloads the board`, await boardSwitch(page, "category-guardians"));
  const active = await page.locator('[data-testid="category-guardians"]').getAttribute("data-state");
  check(`${prefix}the category tab is the active one`, active === "active", String(active));
  check(`${prefix}the board re-rendered under the new category`, (await count(page, '[data-testid="board-section"]')) === 1);
  check(`${prefix}the own row is still pinned after every switch`, (await count(page, '[data-testid="own-row"]')) === 1);
}

/* Settings > Gamification keeps the Super Admin and the Knowledge Admin off
   the boards, so the pinned strip would carry the "you are not ranked" line
   rather than a standing. The Department Head earns points like everybody
   else, so the boards are read as a ranked person sees them. */
const BOARD_VIEWER = "head.stats@enviroai.demo";

async function scenarioLeaderboard(browser: Browser): Promise<void> {
  group("6. Leaderboard");
  const ctx = await signIn(browser, BOARD_VIEWER);
  const page = await ctx.newPage();
  try {
    await dismissKow(page);
    await runLeaderboard(page, "en", "");
    await shot(page, "leaderboard");
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 7. Handover                                                          */
/* ------------------------------------------------------------------ */

async function scenarioHandover(browser: Browser, fx: Fixtures): Promise<void> {
  group("7. Handover");
  if (!fx.adminHandoverId) {
    skip("handover", "no in-progress handover in the database");
    return;
  }
  const ctx = await signIn(browser, "hr@enviroai.demo");
  const page = await ctx.newPage();
  try {
    await dismissKow(page);
    await open(page, `${BASE}/en/hr/handovers`);
    check("the HR handovers list opens", (await count(page, '[data-testid="hr-handovers"]')) === 1);
    const rows = await count(page, '[data-testid="handover-row"]');
    check("the list has handovers in it", rows >= 1, `${rows} rows`);

    const row = page.locator(`a[data-testid="handover-row"][href$="${fx.adminHandoverId}"]`);
    if (await row.count()) await row.first().click();
    else await open(page, `${BASE}/en/hr/handovers/${fx.adminHandoverId}`);
    await page.locator('[data-testid="handover-admin"]').waitFor({ state: "visible", timeout: 120_000 }).catch(() => {});
    check("the in-progress handover opens", (await count(page, '[data-testid="handover-admin"]')) === 1);

    const items = await text(page, '[data-testid="admin-progress-items"]');
    check("the completion of the item list is shown", /\d+\s*\/\s*\d+/.test(items), items.slice(0, 60));
    check(
      "the interview completion is shown",
      (await count(page, '[data-testid="admin-progress-interviews"]')) === 1
    );
    const ticks = await count(page, '[data-testid="scope-tick"]');
    const recipients = await count(page, '[data-testid="recipient-select"]');
    check("the item list renders", ticks >= 1, `${ticks} items`);
    check("the recipient controls render", recipients >= 1, `${recipients} recipient pickers`);
    await shot(page, "handover-admin");
  } finally {
    await ctx.close();
  }

  if (!fx.recipient) {
    skip("the recipient's learning path", "no handover learning path in the database");
    return;
  }
  const rctx = await signIn(browser, fx.recipient.email);
  const rpage = await rctx.newPage();
  try {
    await dismissKow(rpage);
    // /handover is the recipient's front door: it redirects to the learning
    // path. /handover/mine is the LEAVING person's workspace, so a recipient
    // who is not leaving finds the empty state there, by design.
    await open(rpage, `${BASE}/en/handover`);
    check(
      "the recipient lands on the learning path",
      rpage.url().includes(`/handover/${fx.recipient.handoverId}`),
      rpage.url()
    );
    check("the learning path renders", (await count(rpage, '[data-testid="recipient-handover"]')) === 1);
    const pct = await text(rpage, '[data-testid="path-pct"]');
    check("the path shows its progress", /\d|[٠-٩]/.test(pct), pct.slice(0, 20));
    const modules = await count(rpage, '[data-testid="path-module"]');
    check("the path lists its modules", modules >= 1, `${modules} modules`);
    await shot(rpage, "handover-recipient-path");

    const mine = await open(rpage, `${BASE}/en/handover/mine`);
    check("/handover/mine answers for the recipient too", mine === 200, String(mine));
  } finally {
    await rctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 8. Permissions by role                                               */
/* ------------------------------------------------------------------ */

const RAIL_BASE = [
  "home",
  "council",
  "strategy",
  "statistics",
  "indices",
  "trends",
  "vault",
  "processes",
  "studies",
  "lessons",
  "podcast",
  "reports",
  "experts",
  "organisation",
  "operating_model",
  "leaderboard",
];
const RAIL_GROUPS = ["strategy_hub", "data", "knowledge", "people"];

type RoleExpectation = {
  email: string;
  role: string;
  hr: boolean;
  settings: boolean;
  /** a portal this role does not have, and the page it would otherwise render */
  hidden: { url: string; marker: string } | null;
};

const ROLES: RoleExpectation[] = [
  { email: "admin@enviroai.demo", role: "Super Admin", hr: true, settings: true, hidden: null },
  {
    email: "knowledge@enviroai.demo",
    role: "Knowledge Admin",
    hr: false,
    settings: true,
    hidden: { url: "/en/hr", marker: "hr-portal" },
  },
  { email: "hr@enviroai.demo", role: "HR Admin", hr: true, settings: true, hidden: null },
  {
    email: "head.stats@enviroai.demo",
    role: "Department Head",
    hr: true,
    settings: false,
    hidden: { url: "/en/settings?tab=organisation", marker: "organisation-settings" },
  },
  {
    email: "verifier@enviroai.demo",
    role: "Expert Verifier",
    hr: false,
    settings: false,
    hidden: { url: "/en/hr", marker: "hr-portal" },
  },
  {
    email: "analyst@enviroai.demo",
    role: "Contributor",
    hr: false,
    settings: false,
    hidden: { url: "/en/settings", marker: "user-access-open" },
  },
  {
    email: "reader@enviroai.demo",
    role: "Reader",
    hr: false,
    settings: false,
    hidden: { url: "/en/hr", marker: "hr-portal" },
  },
];

const RAIL_STATE = `JSON.stringify((function () {
  var rail = document.querySelector('[data-testid="rail"]');
  var chrome = ["toggle", "close", "open"];
  var ids = [].slice.call(document.querySelectorAll('[data-testid^="rail-"]')).map(function (e) {
    return String(e.getAttribute("data-testid")).replace("rail-", "");
  });
  return {
    expanded: rail ? rail.getAttribute("data-expanded") : "",
    groups: ids.filter(function (k) { return k.indexOf("group-") === 0; }).map(function (k) { return k.replace("group-", ""); }),
    portals: ids.filter(function (k) {
      return k !== "" && k.indexOf("group-") !== 0 && k.indexOf("flyout-") !== 0 && chrome.indexOf(k) === -1;
    }),
    inbox: document.querySelectorAll('[data-testid="bar-inbox"]').length,
    ask: document.querySelectorAll('[data-testid="ask-bar-button"]').length
  };
})())`;

async function scenarioPermissions(browser: Browser): Promise<void> {
  group("8. Permissions by role");
  for (const role of ROLES) {
    const ctx = await signIn(browser, role.email);
    const page = await ctx.newPage();
    try {
      await dismissKow(page);
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      const state = await evalJson<{
        expanded: string;
        groups: string[];
        portals: string[];
        inbox: number;
        ask: number;
      }>(page, RAIL_STATE);

      const expectedPortals = [...RAIL_BASE, ...(role.hr ? ["hr"] : []), ...(role.settings ? ["settings"] : [])].sort();
      const got = [...new Set(state.portals)].sort();
      check(`${role.role}: the rail carries the four groups`, RAIL_GROUPS.every((g) => state.groups.includes(g)), state.groups.join(","));
      check(
        `${role.role}: the rail carries exactly the portals of the role`,
        JSON.stringify(got) === JSON.stringify(expectedPortals),
        got.filter((x) => !expectedPortals.includes(x)).concat(expectedPortals.filter((x) => !got.includes(x))).join(",") || "match"
      );
      check(`${role.role}: HR is ${role.hr ? "on" : "off"} the rail`, got.includes("hr") === role.hr);
      check(`${role.role}: Settings is ${role.settings ? "on" : "off"} the rail`, got.includes("settings") === role.settings);
      check(`${role.role}: the inbox and Ask EnviroAI are in the bar`, state.inbox === 1 && state.ask === 1);

      if (role.hidden) {
        const status = await open(page, `${BASE}${role.hidden.url}`);
        const rendered = await count(page, `[data-testid="${role.hidden.marker}"]`);
        check(`${role.role}: ${role.hidden.url} answers the friendly 404`, status === 404, String(status));
        check(`${role.role}: ${role.hidden.url} renders nothing of the portal`, rendered === 0, `${rendered} markers`);
      } else {
        skip(`${role.role}: hidden portal 404`, "this role holds every portal");
      }
      if (role.email === "reader@enviroai.demo") await shot(page, "permissions-reader-404");
    } finally {
      await ctx.close();
    }
  }
}

/* ------------------------------------------------------------------ */
/* 9. Arabic mirror                                                     */
/* ------------------------------------------------------------------ */

const MIRROR = `JSON.stringify((function () {
  var rail = document.querySelector('[data-testid="rail"]');
  var box = rail ? rail.getBoundingClientRect() : null;
  return {
    dir: document.documentElement.getAttribute("dir") || "",
    lang: document.documentElement.getAttribute("lang") || "",
    left: box ? Math.round(box.left) : -1,
    right: box ? Math.round(box.right) : -1,
    viewport: document.documentElement.clientWidth
  };
})())`;

type Mirror = { dir: string; lang: string; left: number; right: number; viewport: number };

async function assertMirrored(page: Page, where: string): Promise<void> {
  const m = await evalJson<Mirror>(page, MIRROR);
  check(`${where}: the document is right to left`, m.dir === "rtl" && m.lang === "ar", `${m.dir}/${m.lang}`);
  check(
    `${where}: the rail sits on the right of the viewport`,
    m.left > m.viewport / 2,
    `rail left ${m.left}, centre ${Math.round(m.viewport / 2)}`
  );
  check(`${where}: the rail reaches the right edge`, m.right >= m.viewport - 2, `${m.right} of ${m.viewport}`);
}

async function scenarioArabic(browser: Browser): Promise<void> {
  group("9. Arabic mirror");
  const ctx = await signIn(browser, BOARD_VIEWER);
  const page = await ctx.newPage();
  try {
    await dismissKow(page);
    await open(page, `${BASE}/ar/home`);
    await assertMirrored(page, "Home in Arabic");
    check("Home in Arabic renders its blocks", (await count(page, '[data-testid="home-ask"]')) === 1);
    await shot(page, "arabic-home");

    await runLeaderboard(page, "ar", "Arabic: ");
    await assertMirrored(page, "the leaderboard in Arabic");
    await shot(page, "arabic-leaderboard");
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* the run                                                              */
/* ------------------------------------------------------------------ */

const SCENARIOS: { id: string; run: (browser: Browser, fx: Fixtures) => Promise<void> }[] = [
  { id: "1", run: scenarioAsk },
  { id: "2", run: scenarioKow },
  { id: "3", run: scenarioMessaging },
  { id: "4", run: scenarioReports },
  { id: "5", run: (b) => scenarioOrganisation(b) },
  { id: "6", run: (b) => scenarioLeaderboard(b) },
  { id: "7", run: scenarioHandover },
  { id: "8", run: (b) => scenarioPermissions(b) },
  { id: "9", run: (b) => scenarioArabic(b) },
];

async function main(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  // the folder shows one run, not the sediment of every run before it
  for (const name of fs.readdirSync(SHOT_DIR)) {
    if (name.endsWith(".png")) fs.rmSync(path.join(SHOT_DIR, name), { force: true });
  }
  console.log(`== CR08 14.3 end-to-end scenarios against ${BASE} ==`);
  const fx = await loadFixtures();
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    for (const scenario of SCENARIOS) {
      if (ONLY && !ONLY.has(scenario.id)) continue;
      try {
        await scenario.run(browser, fx);
      } catch (e) {
        check(`scenario ${scenario.id} ran to the end`, false, e instanceof Error ? e.message.split("\n")[0] : String(e));
      }
    }
  } finally {
    await browser.close();
    fx.db.close();
  }

  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\nscreenshots: ${path.relative(ROOT, SHOT_DIR)}`);
  if (skipped) console.log(`${skipped} skipped`);
  console.log(`\n== e2e result: ${passed} passed, ${failed} failed ==`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
