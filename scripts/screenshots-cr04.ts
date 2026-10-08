/* eslint-disable no-console */
// CR04 screenshots into data/screenshots/cr04 (EN + AR, rest + hover).
// Requires a running server. Pass section names as args to limit, e.g.
// `npx tsx scripts/screenshots-cr04.ts vault strategy`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr04");
const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", email);
  await page.fill("#password", "EnviroAI!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });
}

async function shot(page: Page, name: string, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  ${name}.png`);
}

async function go(page: Page, url: string, wait = 1800) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

/** Real hover through mouse.move so intent timing and the preview engage. */
async function hoverCenter(page: Page, selector: string, settle = 700) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    console.log(`  (no box for ${selector})`);
    return false;
  }
  await page.mouse.move(box.x - 60, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(settle);
  return true;
}

async function withViewport(
  browser: Browser,
  width: number,
  height: number,
  fn: (page: Page) => Promise<void>
) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await login(page, "admin@enviroai.demo");
  await fn(page);
  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());

  if (want("vault")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("vault 1440:");
      await go(page, "/en/vault");
      await shot(page, "vault-en-1440");
      await hoverCenter(page, ':nth-match([data-testid="book"], 4) a');
      await shot(page, "vault-en-1440-hover");
      await go(page, "/ar/vault");
      await shot(page, "vault-ar-1440");
      await hoverCenter(page, ':nth-match([data-testid="book"], 4) a');
      await shot(page, "vault-ar-1440-hover");
    });
    await withViewport(browser, 390, 844, async (page) => {
      console.log("vault 390:");
      await go(page, "/en/vault");
      await shot(page, "vault-en-390");
    });
  }

  if (want("strategy")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("strategy canvas 1440:");
      await go(page, "/en/strategy", 2600);
      await shot(page, "canvas-en-1440");
      // open the third outcome's panel
      await page.click(':nth-match([data-testid="outcome-medallion"], 3)').catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, "canvas-en-panel");
      await shot(page, "canvas-en-panel-full", true);
      // expand the first target and open a drawer
      await page.click('[data-testid="target-card"] button').catch(() => {});
      await page.waitForTimeout(800);
      await page.click('[data-testid="lane-card"]').catch(() => {});
      await page.waitForTimeout(1400);
      await shot(page, "canvas-en-drawer");
      await go(page, "/ar/strategy", 2600);
      await page.click(':nth-match([data-testid="outcome-medallion"], 3)').catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, "canvas-ar-panel");
      // deep link restores state
      await go(page, "/en/strategy?o=o3&t=o3-t2", 2600);
      await shot(page, "canvas-en-deeplink");
    });
    await withViewport(browser, 390, 844, async (page) => {
      console.log("strategy 390:");
      await go(page, "/en/strategy", 2600);
      await shot(page, "canvas-en-390");
    });
  }

  if (want("lessons")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("learning room 1440:");
      await go(page, "/en/lessons", 2200);
      await shot(page, "lessons-en-1440");
      await shot(page, "lessons-en-full", true);
      await hoverCenter(page, '[data-testid="lesson-week"]');
      await shot(page, "lessons-en-hover");
      await go(page, "/ar/lessons", 2200);
      await shot(page, "lessons-ar-1440");
      await shot(page, "lessons-ar-full", true);
      // learn mode
      await go(page, "/en/lessons", 2200);
      await page.click('[data-testid="learn-mode-toggle"]').catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, "learn-mode-en");
    });
    await withViewport(browser, 390, 844, async (page) => {
      console.log("lessons 390:");
      await go(page, "/en/lessons", 2200);
      await shot(page, "lessons-en-390");
    });
  }

  if (want("podcast")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("podcast rename:");
      await go(page, "/en/podcast");
      await shot(page, "podcast-en-1440");
      await go(page, "/ar/podcast");
      await shot(page, "podcast-ar-1440");
      await go(page, "/en/home");
      await shot(page, "home-podcast-card-en");
    });
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
