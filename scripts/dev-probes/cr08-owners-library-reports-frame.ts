/* eslint-disable no-console */
// CR08 9.1: one close-up of the Reports hub "every report" table, taken from
// the rows themselves, plus what the page says it holds.
//   npx tsx scripts/dev-probes/cr08-owners-library-reports-frame.ts
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
    data: { email, password: "EnviroAI!2026" },
    timeout: 120000,
  });
  if (res.status() !== 200) throw new Error(`login ${email} -> ${res.status()}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin@enviroai.demo");
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`${BASE}/${locale}/reports`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=all-reports-table]", { timeout: 120000 });
    await page.waitForTimeout(1500);
    const rows = page.locator("[data-testid=all-reports-table] [data-testid=report-row]");
    const n = await rows.count();
    const box = await page.locator("[data-testid=all-reports-table]").boundingBox();
    console.log(`  ${locale}: ${n} rows, table box ${JSON.stringify(box)}`);
    if (!n) continue;
    // the first three rows, each its own strip, so nothing is cut by the fold
    for (let i = 0; i < Math.min(3, n); i++) {
      const row = rows.nth(i);
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await row.screenshot({ path: path.join(OUT, `owners-library-reports-row${i + 1}-${locale}.png`) });
    }
    console.log("  shot", `owners-library-reports-row*-${locale}`);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
