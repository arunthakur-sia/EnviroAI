/* eslint-disable no-console */
// CR08 9.1: the Learning Room reader with the author chip, framed, in both
// locales.
//   npx tsx scripts/dev-probes/cr08-owners-library-reader-frame.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

async function login(page: Page, email: string) {
  const res = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
    data: { email, password: "Nexus!2026" },
    timeout: 120000,
  });
  if (res.status() !== 200) throw new Error(`login ${email} -> ${res.status()}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`${BASE}/${locale}/lessons`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=room-lesson-open]", { timeout: 120000 });
    // the card is a button: it does nothing until the page has hydrated
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt++) {
      await page.waitForTimeout(2500);
      await page.locator("[data-testid=room-lesson-open]").first().click({ timeout: 60000 }).catch(() => {});
      opened = await page
        .waitForSelector("[data-testid=lesson-reader]", { timeout: 20000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!opened) throw new Error(`${locale}: the reader did not open`);
    await page.waitForTimeout(1200);
    const chip = page.locator("[data-testid=lesson-reader] [data-testid=owner-control-compact]").first();
    await chip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.locator("[data-testid=lesson-reader]").first().screenshot({
      path: path.join(OUT, `owners-library-reader-${locale}.png`),
    });
    console.log("  shot", `owners-library-reader-${locale}`);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
