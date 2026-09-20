/* eslint-disable no-console */
// CR08 8: the screenshots the main probe could not reach while another
// agent's build error was flooding the shared dev server: the set dialog
// with its live preview (EN and AR), the replace confirmation, the Arabic
// shelf ribbon and the Arabic lesson card ribbon. Each step retries, so a
// window of a healthy server is enough.
//   npx tsx scripts/dev-probes/cr08-kow-dialog.ts
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
        data: { email, password: "Nexus!2026" },
        timeout: 120000,
      });
      if (res.status() === 200) return;
    } catch {
      /* the server is rebuilding */
    }
    await page.waitForTimeout(4000);
  }
  throw new Error(`login ${email} failed`);
}

/** Opens a page and waits for a selector, retrying while the dev server is
    recompiling after another agent's edit (500s, connection resets). */
async function openRetry(page: Page, url: string, selector: string, tries = 8): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const ok = await page
        .waitForSelector(selector, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      if (ok) {
        await page.waitForTimeout(700);
        return true;
      }
    } catch (e) {
      console.log(`  ${url} attempt ${attempt + 1}: ${String(e).slice(0, 70)}`);
    }
    await page.waitForTimeout(6000);
  }
  problems.push(`could not open ${url} for ${selector}`);
  return false;
}

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("  shot", name);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    const text = String(e).replace(/\s+/g, " ").slice(0, 200);
    console.log("  PAGEERROR:", text);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text().replace(/\s+/g, " ");
    if (/favicon|404 \(Not Found\)|hydrated but some attributes/.test(text)) return;
    console.log("  console:", text.slice(0, 160));
  });

  /* ---- the reader: the Arabic ribbons ---- */
  await login(page, "reader@npc.qa");
  for (const locale of ["en", "ar"] as const) {
    if (!(await openRetry(page, `${BASE}/${locale}/vault`, "[data-testid=book-kow-ribbon]"))) continue;
    const book = page.locator("[data-testid=book]:has([data-testid=book-kow-ribbon])").first();
    await book.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // the shelf plank that holds the ribboned book: an element screenshot,
    // because boundingBox() is viewport-relative while screenshot clip is
    // document-relative and the two disagree once the page has scrolled
    const plank = page.locator(".group\\/shelf:has([data-testid=book-kow-ribbon])").first();
    const target = (await plank.count()) ? plank : book;
    await target.screenshot({ path: path.join(OUT, `kow-shelf-ribbon-${locale}.png`) }).catch(async () => {
      await page.screenshot({ path: path.join(OUT, `kow-shelf-ribbon-${locale}.png`) });
    });
    console.log("  shot", `kow-shelf-ribbon-${locale}`);
  }
  if (await openRetry(page, `${BASE}/ar/hall-of-knowledge/preview`, "[data-testid=kow-preview-lesson] [data-testid=kow-ribbon]")) {
    await page.locator("[data-testid=kow-preview-lesson]").screenshot({ path: path.join(OUT, "kow-lesson-ribbon-ar.png") });
    console.log("  shot kow-lesson-ribbon-ar");
  }

  /* ---- the administrator: the set dialog and the replace confirmation ---- */
  await context.clearCookies();
  await login(page, "admin@npc.qa");
  // the reveal is modal and would intercept the click on the button beneath.
  // Marking it seen through the API is deterministic, where waiting for the
  // overlay to mount and pressing Escape races hydration.
  try {
    const res = await page.context().request.get(`${BASE}/api/v1/knowledge-of-week?view=active`, { timeout: 60000 });
    const card = (await res.json()) as { data: { id: string } | null };
    if (card.data?.id) {
      await page.context().request.patch(`${BASE}/api/v1/knowledge-of-week`, {
        data: { action: "seen", kowId: card.data.id },
        timeout: 60000,
      });
      console.log("  reveal marked seen for the administrator");
    }
  } catch (e) {
    problems.push(`could not mark the reveal seen: ${String(e).slice(0, 80)}`);
  }
  for (const locale of ["en", "ar"] as const) {
    if (!(await openRetry(page, `${BASE}/${locale}/hall-of-knowledge/preview`, "[data-testid=kow-set-button]"))) continue;
    // the reveal opens over the page for anyone who has not seen it this week
    // (the administrator included) and is modal: dismiss it before reaching
    // the button beneath
    if (await page.locator("[data-testid=kow-reveal]").count()) {
      await page.keyboard.press("Escape");
      await page.waitForSelector("[data-testid=kow-reveal]", { state: "detached", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    let opened = false;
    for (let attempt = 0; attempt < 6 && !opened; attempt++) {
      await page.click("[data-testid=kow-set-button]").catch(() => {});
      opened = await page
        .waitForSelector("[data-testid=kow-card-preview]", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) await page.waitForTimeout(3000);
    }
    if (!opened) {
      // keep the evidence: an error overlay here means the shared dev server,
      // not the dialog
      await shoot(page, `kow-set-dialog-failed-${locale}`);
      const hydrated = await page.evaluate(
        "Boolean(document.querySelector('[data-testid=kow-set-button]')) && !document.querySelector('nextjs-portal')"
      );
      problems.push(`${locale}: the set dialog did not open (button present, no error overlay: ${hydrated})`);
      continue;
    }
    await page.fill("[data-testid=kow-note-en]", "Read the summary first, then the recommendations in chapter five.");
    await page.fill("[data-testid=kow-note-ar]", "اقرأ الملخص أولًا ثم التوصيات في الفصل الخامس.");
    await page.waitForTimeout(700);
    const text = String(await page.evaluate("document.body.innerText"));
    const raw = text.match(/\bkow\.[a-zA-Z.]+/g) ?? [];
    if (raw.length) problems.push(`${locale} dialog: raw keys ${[...new Set(raw)].join(", ")}`);
    await shoot(page, `kow-set-dialog-${locale}`);

    // this week already has the seeded pick: the replace confirmation appears
    await page.click("[data-testid=kow-set-submit]");
    const conflict = await page
      .waitForSelector("[data-testid=kow-conflict]", { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (!conflict) problems.push(`${locale}: no replace confirmation for a taken week`);
    else if (locale === "en") await shoot(page, "kow-set-conflict-en");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  await browser.close();
}

main()
  .catch((e) => problems.push(`crash: ${String(e).slice(0, 200)}`))
  .finally(() => {
    console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nno problems found");
    process.exit(problems.length ? 1 : 0);
  });
