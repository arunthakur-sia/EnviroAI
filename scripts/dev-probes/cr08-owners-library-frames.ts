/* eslint-disable no-console */
// CR08 9.1 (library surfaces): close-up frames the viewport pass could not
// reach, for judging crowding: the all-reports table with its requester
// chips, a Learning Room lane card, and the Institutional Memory grid view
// (whose covers deliberately keep their painted monogram).
//   npx tsx scripts/dev-probes/cr08-owners-library-frames.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

async function login(page: Page, email: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
      data: { email, password: "Nexus!2026" },
      timeout: 120000,
    });
    if (res.status() === 200) return;
    await page.waitForTimeout(3000);
  }
  throw new Error(`login ${email}`);
}

/** Photographs a window around the element: an element screenshot of a tall
    section captures mostly the empty stretch below the fold, and a plain
    viewport shot after a scroll can miss it entirely. */
async function frame(page: Page, selector: string, name: string, height = 420) {
  const el = page.locator(selector).first();
  if (!(await el.count())) {
    console.log(`  missing ${selector}`);
    return;
  }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const box = await el.boundingBox();
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  if (!box) {
    console.log(`  no box for ${selector}`);
    return;
  }
  const clip = {
    x: Math.max(0, Math.min(box.x - 12, size.width - 900)),
    y: Math.max(0, Math.min(box.y - 12, size.height - height)),
    width: Math.min(900, size.width - 12),
    height,
  };
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log("  shot", name);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`${BASE}/${locale}/reports`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=all-reports-table]", { timeout: 120000 });
    await frame(page, "[data-testid=all-reports-table]", `owners-library-reports-table-${locale}`, 360);

    await page.goto(`${BASE}/${locale}/lessons`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=room-lesson]", { timeout: 120000 });
    await frame(page, "[data-testid=room-lesson]", `owners-library-room-card-${locale}`, 260);

    await page.goto(`${BASE}/${locale}/vault?view=grid`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=book-cover]", { timeout: 120000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `owners-library-grid-${locale}.png`) });
    console.log("  shot", `owners-library-grid-${locale}`);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
