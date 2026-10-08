/* eslint-disable no-console */
// CR08 6: dumps the visible text of the handover surfaces in both locales, so
// a raw i18n key, an untranslated English string in Arabic, or a strip that
// renders its heading with nothing beside it is visible without a screenshot.
//   npx tsx scripts/dev-probes/cr08-handover-text.ts
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const NAV = 120000;

async function login(page: Page, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: "EnviroAI!2026" }, timeout: NAV });
      if (res.ok()) return;
    } catch {
      /* the shared dev server resets connections under load */
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`login failed for ${email}`);
}

async function logout(page: Page) {
  await page.request.post(`${BASE}/api/v1/auth/logout`).catch(() => {});
  await page.context().clearCookies();
}

async function dump(page: Page, url: string, wait: string, selectors: string[]) {
  await page.goto(url, { timeout: NAV, waitUntil: "domcontentloaded" });
  await page.waitForSelector(wait, { timeout: NAV, state: "attached" });
  await page.waitForTimeout(6000);
  console.log(`=== ${url}`);
  for (const sel of selectors) {
    const text = await page.evaluate(
      `(() => {
         const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
         if (!els.length) return "ABSENT";
         return els.slice(0, 3).map((e) => (e.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 300)).join(" || ");
       })()`
    );
    console.log(`  ${sel}: ${text}`);
  }
  const raw = await page.evaluate(
    `(() => {
       const body = document.body.innerText || "";
       const hits = body.match(/\\b(handover|common|shell)\\.[a-zA-Z0-9_.]+/g) || [];
       return [...new Set(hits)].slice(0, 12).join(", ") || "none";
     })()`
  );
  console.log(`  raw keys on screen: ${raw}`);
}

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { like } = await import("drizzle-orm");
  const [seedA] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:a%")).limit(1);
  const [seedB] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:b%")).limit(1);
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();

  for (const locale of ["en", "ar"] as const) {
    await login(page, "hr@enviroai.demo");
    await dump(page, `${BASE}/${locale}/hr/handovers`, '[data-testid="handover-row"]', ['[data-testid="hr-handovers"] h2', '[data-testid="handover-row"]']);
    await dump(page, `${BASE}/${locale}/hr/handovers/${seedA.id}`, '[data-testid="handover-admin"]', ['[data-testid="admin-required"]', '[data-testid="tab-inventory"]', '[data-testid="tab-close"]']);
    await dump(page, `${BASE}/${locale}/hr/handovers/${seedB.id}`, '[data-testid="handover-admin"]', ['[data-testid="admin-required"]']);
    await logout(page);

    await login(page, "abdulrahman.albalawi@enviroai.demo");
    await dump(page, `${BASE}/${locale}/handover/mine`, '[data-testid="my-handover"]', ['[data-testid="still-required"]', '[data-testid="add-to-handover"]', '[data-testid="interview-panel"] h2']);
    await logout(page);

    await login(page, "mohammed.alqarni@enviroai.demo");
    await dump(page, `${BASE}/${locale}/handover/${seedA.id}`, '[data-testid="recipient-handover"]', ['[data-testid="recipient-handover"] h1', '[data-testid="sign-off"]', '[data-testid="path-module"]']);
    await logout(page);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
