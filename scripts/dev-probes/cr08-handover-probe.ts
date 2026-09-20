/* eslint-disable no-console */
// CR08 6: Playwright probe over the shared dev server. Both locales: the HR
// handover list and the start form, the admin detail (recipients, filing
// report, close panel, cut-off), My Handover with the interview, the
// recipient's learning path with a module understood and the sign-off, the
// token workspace. Screenshots into data/screenshots/cr08/handover-*.png.
//   npx tsx scripts/dev-probes/cr08-handover-probe.ts
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const NAV = 120000;

const errors: string[] = [];
function watch(page: Page) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|hydration|404|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
  });
}

/** The API login shares the context's cookie jar, so the heavy Home page
    never has to compile just to get a session. The form path is the
    fallback, and is exercised once by loginByForm below. */
async function login(page: Page, email: string, locale = "en") {
  void locale;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await page.request.post(`${BASE}/api/v1/auth/login`, {
      data: { email, password: "Nexus!2026" },
      timeout: NAV,
    });
    if (res.ok()) return;
    if (attempt === 1) throw new Error(`login failed for ${email}: ${res.status()} ${(await res.text()).slice(0, 200)}`);
    await page.waitForTimeout(2000);
  }
}

async function logout(page: Page) {
  await page.request.post(`${BASE}/api/v1/auth/logout`).catch(() => {});
  await page.context().clearCookies();
}

async function settle(page: Page, ms = 1800) {
  await page.waitForTimeout(ms);
}

/** Every page enters through <Reveal>, which server-renders at opacity 0 and
    animates to 1 on mount, so a screenshot taken before hydration is blank.
    Wait until the element and all its ancestors are fully opaque. In a .ts
    script run by tsx the page function must be a STRING (esbuild's __name). */
async function waitPainted(page: Page, selector: string, timeout = NAV) {
  await page.waitForSelector(selector, { timeout, state: "visible" });
  await page.waitForFunction(
    `(() => {
       const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return false;
       let n = el;
       while (n && n !== document.body) {
         if (parseFloat(getComputedStyle(n).opacity || "1") < 0.99) return false;
         n = n.parentElement;
       }
       return true;
     })()`,
    undefined,
    { timeout }
  );
}

/** The shared dev server hydrates slowly under load, so a click can land on
    server-rendered HTML before React attaches. Retry until the target shows. */
async function clickUntil(page: Page, selector: string, appears: string, tries = 6) {
  for (let i = 0; i < tries; i++) {
    await page.click(selector).catch(() => {});
    try {
      await page.waitForSelector(appears, { timeout: 8000, state: "visible" });
      return;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  throw new Error(`${selector} never revealed ${appears}`);
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log("shot", name);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { db, schema } = await import("../../src/server/db/client");
  const { eq, like } = await import("drizzle-orm");
  const [seedA] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:a%")).limit(1);
  const [seedB] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:b%")).limit(1);
  const [seedC] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:c%")).limit(1);
  if (!seedA || !seedB) throw new Error("run scripts/cr08-handover-seed.ts first");
  void eq;

  const browser = await chromium.launch({ channel: "msedge" });
  // reducedMotion also makes the capture deterministic: useReducedMotion() is
  // true, so <Reveal> sets initial={false} and the server HTML is already
  // fully opaque instead of waiting for hydration to run the entrance.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  watch(page);

  // the shared dev server needs ~35s to hydrate a cold page, so the sweep
  // runs in scoped passes: `npx tsx ... <admin|person|token> <en|ar>`
  const scope = process.argv[2] ?? "all";
  const locales = (process.argv[3] ? [process.argv[3]] : ["en", "ar"]) as ("en" | "ar")[];
  const want = (s: string) => scope === "all" || scope === s;

  for (const locale of locales) {
    /* ---- the administrator ---- */
    if (!want("admin")) break;
    await login(page, "hr@npc.qa", locale);
    await page.goto(`${BASE}/${locale}/hr/handovers`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await waitPainted(page, '[data-testid="handover-row"]');
    await settle(page);
    await shot(page, `handover-list-${locale}`);
    await clickUntil(page, '[data-testid="start-handover"]', '[data-testid="start-dialog"]');
    await settle(page, 800);
    await page.click('[data-testid="person-mode-external"]').catch(() => {});
    await settle(page, 1200);
    await shot(page, `handover-start-${locale}`);
    await page.keyboard.press("Escape");
    await settle(page, 600);

    await page.goto(`${BASE}/${locale}/hr/handovers/${seedA.id}`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await waitPainted(page, '[data-testid="handover-admin"]');
    await settle(page);
    await shot(page, `handover-admin-inventory-${locale}`);
    await clickUntil(page, '[data-testid="tab-filing"]', '[data-testid="filing-report"], [data-testid="filing-row"]');
    await settle(page, 900);
    await shot(page, `handover-admin-filing-${locale}`);
    await clickUntil(page, '[data-testid="tab-paths"]', '[data-testid="admin-paths"], [data-testid="admin-path"]');
    await settle(page, 900);
    await shot(page, `handover-admin-paths-${locale}`);
    await clickUntil(page, '[data-testid="tab-interviews"]', '[data-testid="admin-interviews"]');
    await page.click('[data-testid="admin-transcript-toggle"]').catch(() => {});
    await settle(page, 900);
    await shot(page, `handover-admin-interviews-${locale}`);
    await clickUntil(page, '[data-testid="tab-close"]', '[data-testid="close-panel"]');
    await settle(page, 900);
    await shot(page, `handover-admin-close-${locale}`);

    // the external one: the access card and the filing report
    await page.goto(`${BASE}/${locale}/hr/handovers/${seedB.id}`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await waitPainted(page, '[data-testid="handover-admin"]');
    await clickUntil(page, '[data-testid="tab-access"]', '[data-testid="access-card"]');
    await settle(page, 900);
    await shot(page, `handover-admin-access-${locale}`);
    // the external handover is the one with a full filing report (8 system items)
    await clickUntil(page, '[data-testid="tab-filing"]', '[data-testid="filing-row"]');
    await settle(page, 900);
    await shot(page, `handover-admin-filing-full-${locale}`);

    if (seedC) {
      await page.goto(`${BASE}/${locale}/hr/handovers/${seedC.id}`, { timeout: NAV, waitUntil: "domcontentloaded" });
      await waitPainted(page, '[data-testid="handover-admin"]');
      await clickUntil(page, '[data-testid="tab-close"]', '[data-testid="close-panel"]');
      await settle(page, 900);
      await shot(page, `handover-admin-closed-${locale}`);
    }
    await logout(page);
  }

  for (const locale of locales) {
    /* ---- the leaving person ---- */
    if (!want("person")) break;
    await login(page, "ahmed.fathy@npc.qa", locale);
    await page.goto(`${BASE}/${locale}/handover/mine`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await waitPainted(page, '[data-testid="my-handover"]');
    await settle(page);
    await shot(page, `handover-mine-${locale}`);
    const topics = page.locator('[data-testid="interview-topic"]');
    if ((await topics.count()) > 1) {
      await topics.nth(1).click();
      await settle(page, 600);
    }
    await page.locator('[data-testid="interview-panel"]').scrollIntoViewIfNeeded();
    await settle(page, 400);
    await shot(page, `handover-mine-interview-${locale}`);
    await shot(page, `handover-mine-full-${locale}`, true);
    await logout(page);

    /* ---- the recipient ---- */
    await login(page, "mohammed.alsulaiti@npc.qa", locale);
    // 6.3: "A handover has started for you" on Home, and /handover sends the
    // recipient straight to their learning path
    await page.goto(`${BASE}/${locale}/home`, { timeout: NAV, waitUntil: "domcontentloaded" });
    const banner = await page
      .waitForSelector('[data-testid="handover-banner"]', { timeout: 60000, state: "visible" })
      .then(() => true)
      .catch(() => false);
    // the Knowledge of the Week reveal (Section 8) opens over Home once a
    // week; close it so the banner is what the screenshot shows
    await page.keyboard.press("Escape");
    await settle(page, 1200);
    await page.locator('[data-testid="handover-banner"]').scrollIntoViewIfNeeded().catch(() => {});
    await settle(page, 800);
    await shot(page, `handover-banner-${locale}`);
    console.log(`home banner ${locale}: ${banner ? "shown" : "MISSING"}`);
    await page.goto(`${BASE}/${locale}/handover`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await page.waitForURL(`**/handover/${seedA.id}`, { timeout: NAV }).catch(() => {});
    console.log(`/handover redirected to: ${page.url().replace(BASE, "")}`);
    await page.goto(`${BASE}/${locale}/handover/${seedA.id}`, { timeout: NAV, waitUntil: "domcontentloaded" });
    await waitPainted(page, '[data-testid="recipient-handover"]');
    await settle(page);
    await shot(page, `handover-recipient-${locale}`);
    if (locale === "en") {
      // mark one open module as understood, then try the sign-off (it stays disabled while modules are open)
      const open = page.locator('[data-testid="path-module"][data-understood="0"] [data-testid="module-understood"]');
      if (await open.count()) {
        await open.first().click();
        await settle(page, 1200);
      }
      await page.locator('[data-testid="sign-off"]').scrollIntoViewIfNeeded();
      await settle(page, 400);
      await shot(page, `handover-recipient-signoff-${locale}`);
    }
    await shot(page, `handover-recipient-full-${locale}`, true);
    await logout(page);
  }

  /* ---- the token workspace: a fresh link every run, so the probe never
     depends on a token an earlier run or the smoke suite has since expired.
     The plain token is written beside the screenshots, never into the row. ---- */
  const tokenFile = path.join(OUT, "handover-token.txt");
  let token = want("token") ? process.env.HANDOVER_TOKEN ?? "" : "skip";
  if (!token) {
    const { getUserById } = await import("../../src/server/auth/session");
    const [adminRow] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "admin@npc.qa")).limit(1);
    const superAdmin = adminRow ? await getUserById(adminRow.id) : null;
    if (superAdmin) {
      const { createAccessLink } = await import("../../src/server/services/handover");
      const link = await createAccessLink(superAdmin, seedB.id);
      token = link.token;
      fs.writeFileSync(tokenFile, token, "utf8");
      console.log("fresh access link, expires", link.expiresAt);
    }
  }
  if (token && token !== "skip") {
    for (const locale of locales) {
      await page.goto(`${BASE}/${locale}/handover/access/${token}`, { timeout: NAV, waitUntil: "domcontentloaded" });
      // either the workspace or the "link is not valid" card (no Reveal here)
      await page.waitForSelector('[data-testid="token-workspace"], .card', { timeout: NAV });
      await settle(page);
      await shot(page, `handover-token-${locale}`);
      await shot(page, `handover-token-full-${locale}`, true);
      const ok = await page.locator('[data-testid="token-workspace"]').count();
      console.log(`token workspace ${locale}: ${ok ? "open" : "invalid card"}`);
    }
  } else {
    console.log("no token file; token workspace screenshots skipped");
  }

  console.log("errors:", errors.length ? errors.join("\n") : "none");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

