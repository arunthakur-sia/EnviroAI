/* eslint-disable no-console */
// CR08 5 (Reports UI agent): prints the FULL React hydration diff for the
// three Reports pages, so an attribute mismatch can be named rather than
// guessed at.
//   npx tsx scripts/dev-probes/cr08-reports-ui-hydration.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function login(page: Page, email: string) {
  for (let i = 0; i < 12; i++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: "Nexus!2026" }, timeout: 120000 });
      if (res.ok()) return;
      console.log(`  login: ${res.status()}, retrying`);
    } catch (e) {
      // the shared dev server restarts under another agent's edit
      console.log(`  login: ${String((e as Error)?.message ?? e).split("\n")[0]}, retrying`);
    }
    await page.waitForTimeout(12000);
  }
  throw new Error("login failed");
}

const LOCALE = process.env.PROBE_LOCALE ?? "en";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: LOCALE === "ar" ? "ar-QA" : "en-QA" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) messages.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (/hydrat/i.test(String(e))) messages.push(String(e));
  });
  await login(page, process.env.PROBE_EMAIL ?? "admin@npc.qa");

  const j = await (await page.request.get(`${BASE}/api/v1/report-builder`, { timeout: 180000 })).json();
  const list = (j?.data?.reports ?? []) as { id: string; status: string; previewCount: number }[];
  const seeded = list.find((r) => r.status === "published" && r.previewCount > 0)?.id;

  for (const [label, url, waitFor] of [
    ["hub", `${BASE}/${LOCALE}/reports`, '[data-testid="reports-hub"]'],
    ["builder", `${BASE}/${LOCALE}/reports/new`, '[data-testid="report-builder"]'],
    ["report", `${BASE}/${LOCALE}/reports/${seeded}`, '[data-testid="report-page"]'],
    // controls: pages this agent does not own, to tell a shell-wide
    // mismatch from one of mine
    ["control: council-strategy", `${BASE}/${LOCALE}/council-strategy`, "main"],
    ["control: lessons", `${BASE}/${LOCALE}/lessons`, "main"],
  ] as const) {
    if (url.includes("undefined")) continue;
    messages.length = 0;
    // the shared dev server restarts under other agents' edits
    for (let i = 0; i < 4; i++) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
        break;
      } catch (e) {
        console.log(`  goto ${label}: ${String((e as Error)?.message ?? e).split("\n")[0]}, retrying`);
        await page.waitForTimeout(10000);
      }
    }
    await page.waitForSelector(waitFor, { timeout: 180000 });
    await page.waitForTimeout(4000);
    console.log(`\n===== ${label}: ${messages.length} hydration message(s)`);
    for (const m of messages) console.log(m.slice(0, 4000));
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
