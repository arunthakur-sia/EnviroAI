/* eslint-disable no-console */
// CR08 8: just the two shelf screenshots showing the aqua ribbon on the spine
// of this week's pick in Institutional Memory. The clip is computed from the
// book's viewport box plus the page scroll, because Playwright's screenshot
// clip is document-relative while boundingBox() is viewport-relative.
//   npx tsx scripts/dev-probes/cr08-kow-shelf.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });
const problems: string[] = [];

async function login(page: Page, email: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await page.context().request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: "EnviroAI!2026" },
        timeout: 120000,
      });
      if (res.status() === 200) return;
    } catch {
      /* rebuilding */
    }
    await page.waitForTimeout(4000);
  }
  throw new Error(`login ${email} failed`);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "reader@enviroai.demo");

  for (const locale of ["en", "ar"] as const) {
    let ready = false;
    for (let attempt = 0; attempt < 8 && !ready; attempt++) {
      try {
        await page.goto(`${BASE}/${locale}/vault`, { waitUntil: "domcontentloaded", timeout: 60000 });
        ready = await page
          .waitForSelector("[data-testid=book-kow-ribbon]", { timeout: 30000 })
          .then(() => true)
          .catch(() => false);
      } catch (e) {
        console.log(`  ${locale} attempt ${attempt + 1}: ${String(e).slice(0, 60)}`);
      }
      if (!ready) await page.waitForTimeout(6000);
    }
    if (!ready) {
      problems.push(`${locale}: the ribboned book never appeared`);
      continue;
    }
    // the page enters through framer-motion: everything has a box but paints
    // nothing until the entrance has run
    await page
      .waitForFunction(
        "[...document.querySelectorAll('main [style*=opacity]')].every((el) => parseFloat(getComputedStyle(el).opacity) >= 0.99)",
        undefined,
        { timeout: 60000 }
      )
      .catch(() => problems.push(`${locale}: the entrance animation never settled`));
    const book = page.locator("[data-testid=book]:has([data-testid=book-kow-ribbon])").first();
    await book.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const box = await book.boundingBox();
    if (!box) {
      problems.push(`${locale}: no bounding box`);
      continue;
    }
    // lift the shelf off the bottom edge so the ribbon and the plank both show
    if (box.y > 420) {
      await page.evaluate(`window.scrollBy(0, ${Math.round(box.y - 320)})`);
      await page.waitForTimeout(600);
    }
    const after = await book.boundingBox();
    await page.screenshot({ path: path.join(OUT, `kow-shelf-ribbon-${locale}.png`) });
    console.log(`  shot kow-shelf-ribbon-${locale} (book at ${Math.round(after?.x ?? -1)},${Math.round(after?.y ?? -1)})`);
  }

  await browser.close();
}

main()
  .catch((e) => problems.push(`crash: ${String(e).slice(0, 200)}`))
  .finally(() => {
    console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nno problems found");
    process.exit(problems.length ? 1 : 0);
  });
