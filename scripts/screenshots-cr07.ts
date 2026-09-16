/* eslint-disable no-console */
// CR07 screenshots into data/screenshots/cr07 (EN + AR).
// Requires a running server: npx tsx scripts/screenshots-cr07.ts [sections]
// Sections: lessons, council, organisation, settings
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr07");
const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

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

async function go(page: Page, url: string, wait = 2600) {
  await page
    .goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 90000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

async function click(page: Page, selector: string, settle = 1200): Promise<boolean> {
  const ok = await page
    .locator(selector)
    .first()
    .click({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) console.log(`  (no ${selector})`);
  await page.waitForTimeout(settle);
  return ok;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "admin@npc.qa");

  if (want("council")) {
    console.log("Council Strategy:");
    await go(page, "/en/council-strategy", 3200);
    await shot(page, "council-en");
    await go(page, "/ar/council-strategy", 3200);
    await shot(page, "council-ar");

    await go(page, "/en/council-strategy?g=g1", 3200);
    await shot(page, "council-goal-en", true);
    await go(page, "/ar/council-strategy?g=g2", 3200);
    await shot(page, "council-goal-ar", true);

    // the chain opening in place, then a project drawer
    await go(page, "/en/council-strategy?g=g1", 3000);
    await click(page, '[data-testid="io-card"]');
    await click(page, '[data-testid="output-card"]');
    await shot(page, "council-chain-en", true);
    if (await click(page, '[data-testid="project-card"]', 2500)) {
      await shot(page, "council-drawer-en");
    }

    await go(page, "/en/council-strategy?view=results", 3000);
    await shot(page, "council-results-en", true);
    await go(page, "/ar/council-strategy?view=results", 3000);
    await shot(page, "council-results-ar", true);

    // the reference sections, opened
    await go(page, "/en/council-strategy", 2600);
    await click(page, '[data-testid="ref-situation"] button');
    await shot(page, "council-situation-en", true);
    await go(page, "/en/council-strategy", 2600);
    await click(page, '[data-testid="ref-risks"] button');
    await click(page, '[data-testid="ref-priority"] button');
    await shot(page, "council-risks-priority-en", true);
    await go(page, "/ar/council-strategy", 2600);
    await click(page, '[data-testid="ref-implementation"] button');
    await click(page, '[data-testid="ref-me"] button');
    await shot(page, "council-plan-me-ar", true);

    // the indicator card
    await go(page, "/en/council-strategy?g=g2", 3000);
    if (await click(page, '[data-testid="indicator-tile"]', 1800)) {
      await shot(page, "council-indicator-card-en");
      await page.keyboard.press("Escape");
    }
  }

  if (want("organisation")) {
    console.log("Organisation:");
    await go(page, "/en/organisation", 3400);
    await shot(page, "org-en");
    await go(page, "/ar/organisation", 3400);
    await shot(page, "org-ar");

    await go(page, "/en/organisation?unit=IDP", 3400);
    await shot(page, "org-unit-en", true);
    await go(page, "/ar/organisation?unit=SOA", 3400);
    await shot(page, "org-unit-ar", true);

    // the policy tabs and the visibility control
    await go(page, "/en/organisation?unit=IFS", 3400);
    await click(page, '[data-testid="policy-tab"]');
    await shot(page, "org-policies-en", true);

    // the list view and search
    await go(page, "/en/organisation", 3000);
    await click(page, '[data-testid="org-list-view"], button:has-text("List")');
    await shot(page, "org-list-en", true);
    await go(page, "/en/organisation", 3000);
    await page.fill('[data-testid="org-search"]', "statistics").catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "org-search-en");
  }

  if (want("lessons")) {
    console.log("Lessons:");
    await go(page, "/en/lessons", 3200);
    await shot(page, "lessons-room-en", true);
    // the By project picker
    await click(page, 'button:has-text("By project")');
    await shot(page, "lessons-picker-en", true);
    await click(page, '[data-testid="picker-store-council"]');
    await shot(page, "lessons-picker-council-en", true);
    await go(page, "/ar/lessons", 3200);
    await click(page, '[data-testid="picker-store-council"]');
    await shot(page, "lessons-picker-ar", true);
  }

  if (want("settings")) {
    console.log("Settings:");
    await go(page, "/en/settings?tab=organisation", 3200);
    await shot(page, "settings-organisation-en", true);
    await click(page, '[data-testid="org-sync-check"]', 2500);
    await shot(page, "settings-resync-en", true);
    await go(page, "/ar/settings?tab=organisation", 3200);
    await shot(page, "settings-organisation-ar", true);
  }

  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
