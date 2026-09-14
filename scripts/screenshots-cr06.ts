/* eslint-disable no-console */
// CR06 screenshots into data/screenshots/cr06 (EN + AR).
// Requires a running server: npx tsx scripts/screenshots-cr06.ts
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr06");

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", email);
  await page.fill("#password", "Nexus!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });
}

async function shot(page: Page, name: string, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  ${name}.png`);
}

async function go(page: Page, url: string, wait = 2400) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

async function toSection(page: Page) {
  await page
    .locator('[data-testid="outcome-stakeholders"]')
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(500);
}

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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "admin@npc.qa");

  console.log("the outcome panel section, EN + AR:");
  await go(page, "/en/strategy?o=o1", 3000);
  await toSection(page);
  await shot(page, "panel-stakeholders-o1-en");
  await go(page, "/ar/strategy?o=o1", 3000);
  await toSection(page);
  await shot(page, "panel-stakeholders-o1-ar");

  console.log("expert hover lights the lanes (expanded target):");
  await go(page, "/en/strategy?o=o1&t=o1-t1", 3000);
  await toSection(page);
  // the third row: an aggregated expert with several lane items to light
  const third = await page.locator('[data-testid="outcome-expert-row"]').nth(2).boundingBox();
  if (third) {
    await page.mouse.move(third.x - 60, third.y + third.height / 2);
    await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 6 });
    await page.waitForTimeout(700);
  }
  await shot(page, "expert-hover-highlight-en", true);

  console.log("the involvement hover list:");
  await hoverCenter(page, '[data-testid="expert-involvement"]');
  await shot(page, "expert-involvement-hover-en");

  console.log("a lead chip filters the lanes:");
  await go(page, "/en/strategy?o=o1&t=o1-t1", 3000);
  await toSection(page);
  await page.locator('[data-testid="outcome-lead-chip"]').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, "lead-chip-filtered-en", true);

  console.log("the leaders row expands to the three groups:");
  await go(page, "/en/strategy?o=o1", 3000);
  await toSection(page);
  await page.locator('[data-testid="outcome-leaders-toggle"]').click().catch(() => {});
  await page.waitForTimeout(700);
  await toSection(page);
  await shot(page, "leaders-expanded-en", true);
  await go(page, "/ar/strategy?o=o1", 3000);
  await toSection(page);
  await page.locator('[data-testid="outcome-leaders-toggle"]').click().catch(() => {});
  await page.waitForTimeout(700);
  await toSection(page);
  await shot(page, "leaders-expanded-ar", true);

  console.log("Show all experts in place:");
  await go(page, "/en/strategy?o=o1", 3000);
  await toSection(page);
  await page.locator('[data-testid="experts-show-all"]').click().catch(() => {});
  await page.waitForTimeout(600);
  await toSection(page);
  await shot(page, "experts-show-all-en", true);

  console.log("editing controls (Add stakeholder, Set owner):");
  await go(page, "/en/strategy?o=o2", 3000);
  await toSection(page);
  await page.locator('[data-testid="outcome-add-stakeholder"]').click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "add-stakeholder-form-en");
  await page.locator('[data-testid="outcome-add-stakeholder"]').click().catch(() => {});
  await page.locator('[data-testid="set-owner-toggle"]').click().catch(() => {});
  await page.waitForTimeout(900);
  await toSection(page);
  await shot(page, "set-owner-picker-en");

  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
