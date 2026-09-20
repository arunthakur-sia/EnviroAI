/* eslint-disable no-console */
// CR08 2.3 probe: drives the Ask NPC panel on the dev-only test page in both
// locales. Nudge, bar button, suggestions, a real send (live analyst or mock),
// a client route change with the panel open, Escape, Ctrl+K, Expand, the
// mini-player offset, the small-screen round launcher. Screenshots land in
// data/screenshots/cr08/. Run: npx tsx scripts/dev-probes/cr08-ask-probe.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const SHOTS = "data/screenshots/cr08";
const ANSWER_TIMEOUT = 180_000;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function panelState(page: Page): Promise<string> {
  return (await page.getAttribute('[data-testid="ask-panel"]', "data-state")) ?? "missing";
}

async function runLocale(page: Page, locale: "en" | "ar", errors: string[]) {
  console.log(`\n== ${locale} ==`);
  const isAr = locale === "ar";

  /* 1. the page mounts a project item: the nudge shows for three seconds */
  await page.goto(`${BASE}/${locale}/ask/panel-test?ctx=project`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  const nudged = await page
    .waitForSelector('[data-testid="ask-launcher"][data-nudge="true"]', { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  check("launcher nudge appears for the project item", nudged);
  // the old label crossfades out for 160ms: wait for the nudge text itself
  await page
    .waitForFunction(
      `(() => { const el = document.querySelector('[data-testid="ask-launcher-button"]'); return el && /${isAr ? "اسأل عن هذا المشروع" : "Ask about this project"}/.test(el.textContent || ""); })()`,
      undefined,
      { timeout: 3_000 }
    )
    .catch(() => {});
  const nudgeText = await page.textContent('[data-testid="ask-launcher-button"]');
  check(
    "nudge wording per kind",
    isAr ? /اسأل عن هذا المشروع/.test(nudgeText ?? "") : /Ask about this project/.test(nudgeText ?? ""),
    nudgeText ?? ""
  );
  if (locale === "en") await page.screenshot({ path: `${SHOTS}/ask-nudge-en.png` });
  await page.waitForSelector('[data-testid="ask-launcher"][data-nudge="false"]', { timeout: 10_000 });
  // the label crossfades for 160ms after the nudge ends: wait for the pill text itself
  await page
    .waitForFunction(
      `(() => { const el = document.querySelector('[data-testid="ask-launcher-button"]'); return el && /${isAr ? "اسأل المجلس" : "Ask NPC"}/.test(el.textContent || ""); })()`,
      undefined,
      { timeout: 5_000 }
    )
    .catch(() => {});
  const pillText = await page.textContent('[data-testid="ask-launcher-button"]');
  check("launcher returns to the compact pill", isAr ? /اسأل المجلس/.test(pillText ?? "") : /Ask NPC/.test(pillText ?? ""));
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${SHOTS}/ask-launcher-${locale}.png` });

  /* 2. the launcher sits above the mini-player when one is docked */
  const bottomBefore = await page.evaluate(
    'getComputedStyle(document.querySelector(\'[data-testid="ask-launcher"]\')).bottom'
  );
  await page.evaluate(
    'window.dispatchEvent(new CustomEvent("sia:podcast:state", { detail: { playing: true, id: "probe" } }))'
  );
  await page.waitForTimeout(350);
  const bottomAfter = await page.evaluate(
    'getComputedStyle(document.querySelector(\'[data-testid="ask-launcher"]\')).bottom'
  );
  check("launcher lifts above the mini-player", parseFloat(String(bottomAfter)) > parseFloat(String(bottomBefore)), `${bottomBefore} -> ${bottomAfter}`);
  await page.evaluate(
    'window.dispatchEvent(new CustomEvent("sia:podcast:state", { detail: { playing: false, id: null } }))'
  );
  await page.waitForTimeout(300);

  /* 3. open from the bar button: chip, suggestions, focus */
  await page.click('[data-testid="ask-bar-button"]');
  await page.waitForSelector('[data-testid="ask-panel"][data-state="open"]', { timeout: 10_000 });
  await page.waitForTimeout(400);
  check("panel open from the bar button", (await panelState(page)) === "open");
  check("launcher hidden while the panel is open", (await page.$('[data-testid="ask-launcher"]')) === null);
  check("context chip shows the project", (await page.$('[data-testid="ask-context-chip"]')) !== null);
  const suggestionCount = await page.$$eval('[data-testid="ask-suggestions"] button', (els) => els.length).catch(() => 0);
  check("three suggestions about the item", suggestionCount === 3, String(suggestionCount));
  const focused = await page.evaluate('document.activeElement && document.activeElement.getAttribute("data-testid")');
  check("composer focused on open", focused === "ask-composer", String(focused));
  const width = await page.evaluate('document.querySelector(\'[data-testid="ask-panel"]\').getBoundingClientRect().width');
  check("panel is 480px wide", Math.round(Number(width)) === 480, String(width));
  const edge = await page.evaluate(
    'JSON.stringify(document.querySelector(\'[data-testid="ask-panel"]\').getBoundingClientRect())'
  );
  const rect = JSON.parse(String(edge)) as { left: number; right: number };
  check(
    isAr ? "panel docked at the left (end side in RTL)" : "panel docked at the right",
    isAr ? Math.round(rect.left) === 0 : Math.round(rect.right) === 1440,
    `left ${rect.left} right ${rect.right}`
  );
  await page.waitForSelector('[data-testid="ask-recent"], [data-testid="ask-panel"] [role="alert"], [data-testid="ask-panel"] .border-dashed', { timeout: 15_000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/ask-panel-empty-${locale}.png` });

  /* 4. send a suggestion, wait for the answer */
  await page.click('[data-testid="ask-suggestions"] button >> nth=0');
  await page.waitForSelector('[data-testid="ask-turn-user"]', { timeout: 10_000 });
  check("user turn appears", true);
  const answered = await page
    .waitForSelector('[data-testid="ask-turn-assistant"]', { timeout: ANSWER_TIMEOUT })
    .then(() => true)
    .catch(() => false);
  check("assistant answer lands in the panel", answered);
  const errorShown = await page.$('[data-testid="ask-error"]');
  check("no error strip after the answer", errorShown === null);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/ask-panel-${locale}.png` });
  const titleShown = await page.textContent('[data-testid="ask-panel-title"]').catch(() => null);
  check("conversation title shown in the header", Boolean(titleShown && titleShown.trim().length));

  /* 5. navigate with the panel open: the thread persists. The scrim covers the
     page content by design (only the rail stays clickable), so the Link is
     clicked through the DOM, which still runs the client-side transition. */
  const userText = (await page.textContent('[data-testid="ask-turn-user"]')) ?? "";
  const scrimStart = await page.evaluate(
    'getComputedStyle(document.querySelector(\'[data-testid="ask-scrim"]\')).insetInlineStart'
  );
  const railWidth = await page.evaluate('document.querySelector(\'[data-testid="rail"]\').getBoundingClientRect().width');
  check("scrim starts where the rail ends", Math.round(parseFloat(String(scrimStart))) === Math.round(Number(railWidth)), `${scrimStart} vs ${railWidth}`);
  // the shared dev server compiles the [step] route on demand and recompiles
  // while other agents edit, so the route is warmed first (a plain request
  // through the page's cookie jar), then the Link is clicked with retries. A
  // window mark tells a client transition from a forced full reload.
  await page.request.get(`${BASE}/${locale}/ask/panel-test/two`, { timeout: 180_000 }).catch(() => null);
  await page.evaluate('window.__askProbeMark = "kept"');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate('document.querySelector(\'[data-testid="panel-test-next"]\').click()');
    const moved = await page
      .waitForURL(/\/ask\/panel-test\/two/, { timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    if (moved) break;
    console.log(`  info  route change attempt ${attempt + 1} did not complete in 60s, retrying`);
  }
  await page.waitForSelector('[data-testid="panel-test"][data-step="two"]', { timeout: 120_000 });
  await page.waitForTimeout(500);
  const mark = await page.evaluate('window.__askProbeMark || "reloaded"');
  console.log(`  info  route change was a ${mark === "kept" ? "client transition" : "FULL RELOAD (dev server)"}`);
  await page.waitForSelector('[data-testid="ask-panel"][data-state="open"]', { timeout: 10_000 }).catch(() => {});
  check("panel still open after client navigation", (await panelState(page)) === "open");
  const userAfter = (await page.textContent('[data-testid="ask-turn-user"]').catch(() => "")) ?? "";
  check("thread persists across the route change", userAfter === userText && userText.length > 0);
  check("answer persists across the route change", (await page.$('[data-testid="ask-turn-assistant"]')) !== null);

  /* 6. Escape closes, Ctrl+K reopens with the thread intact */
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="ask-panel"][data-state="closed"]', { timeout: 5_000 });
  check("Escape closes the panel", (await panelState(page)) === "closed");
  await page.waitForTimeout(400);
  check("launcher back after close", (await page.$('[data-testid="ask-launcher"]')) !== null);
  await page.keyboard.press("Control+k");
  await page.waitForSelector('[data-testid="ask-panel"][data-state="open"]', { timeout: 5_000 });
  await page.waitForTimeout(300);
  check("Ctrl+K reopens the panel", (await panelState(page)) === "open");
  check("thread intact after Ctrl+K", (await page.$('[data-testid="ask-turn-assistant"]')) !== null);
  const focusedAgain = await page.evaluate('document.activeElement && document.activeElement.getAttribute("data-testid")');
  check("Ctrl+K focuses the composer", focusedAgain === "ask-composer", String(focusedAgain));
  const searchFocused = await page.evaluate('document.activeElement && document.activeElement.tagName');
  check("Ctrl+K did not land in the search field", searchFocused !== "INPUT", String(searchFocused));

  /* 7. Expand lands on the full conversation page. The /ask/c/[id] route is
     compiled on demand by the dev server, so it is warmed through the cookie
     jar first; the transition is judged on URL commit, not on full load. */
  const convId = (await page.getAttribute('[data-testid="ask-panel"]', "data-conversation-id")) ?? "";
  check("panel carries the conversation id", convId.length > 0, convId);
  if (convId) {
    await page.request.get(`${BASE}/${locale}/ask/c/${convId}`, { timeout: 180_000 }).catch(() => null);
  }
  let expanded = false;
  for (let attempt = 0; attempt < 2 && !expanded; attempt++) {
    await page.click('[data-testid="ask-expand"]');
    expanded = await page
      .waitForURL(/\/ask\/c\/[A-Z0-9]+/i, { timeout: 90_000, waitUntil: "commit" })
      .then(() => true)
      .catch(() => false);
    if (!expanded) {
      console.log(`  info  Expand attempt ${attempt + 1} did not commit in 90s, reopening and retrying`);
      await page.keyboard.press("Control+k");
      await page.waitForSelector('[data-testid="ask-panel"][data-state="open"]', { timeout: 10_000 }).catch(() => {});
    }
  }
  await page.waitForSelector('[data-testid="workspace-turn"]', { timeout: 120_000 });
  check("Expand opens /ask/c/[id] with the turns", /\/ask\/c\//.test(page.url()), page.url());

  /* 8. small screens: a round launcher and a full-width panel */
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(`${BASE}/${locale}/ask/panel-test`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('[data-testid="ask-launcher-button"]', { timeout: 30_000 });
  await page.waitForTimeout(500);
  const small = JSON.parse(
    String(
      await page.evaluate(
        'JSON.stringify(document.querySelector(\'[data-testid="ask-launcher-button"]\').getBoundingClientRect())'
      )
    )
  ) as { width: number; height: number };
  check("round launcher under 640px", Math.round(small.width) === Math.round(small.height), `${small.width}x${small.height}`);
  await page.click('[data-testid="ask-launcher-button"]');
  await page.waitForSelector('[data-testid="ask-panel"][data-state="open"]', { timeout: 10_000 });
  await page.waitForTimeout(400);
  const smallWidth = await page.evaluate('document.querySelector(\'[data-testid="ask-panel"]\').getBoundingClientRect().width');
  check("panel is full width under 640px", Math.round(Number(smallWidth)) === 400, String(smallWidth));
  if (locale === "en") await page.screenshot({ path: `${SHOTS}/ask-panel-small-en.png` });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  // the store mirrors itself per tab; the next locale starts as a fresh tab would
  await page.evaluate('sessionStorage.removeItem("sia:ask-panel")');

  console.log(`console errors so far: ${errors.length}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));

  const login = await page.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "analyst@npc.qa", password: "Nexus!2026" },
  });
  console.log("login:", login.status());

  for (const locale of ["en", "ar"] as const) {
    await runLocale(page, locale, errors);
  }

  console.log("\nconsole/page errors:");
  const relevant = errors.filter((e) => !/favicon|hydration|404/i.test(e));
  for (const e of relevant.slice(0, 20)) console.log("  ", e);
  if (!relevant.length) console.log("   none");
  await browser.close();
  console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
