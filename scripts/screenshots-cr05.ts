/* eslint-disable no-console */
// CR05 screenshots into data/screenshots/cr05 (EN + AR).
// Requires a running server. Pass section names as args to limit, e.g.
// `npx tsx scripts/screenshots-cr05.ts before` or `... colour entities`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr05");
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

async function go(page: Page, url: string, wait = 1800) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

/** Real hover through mouse.move so intent timing engages. */
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
  fn: (page: Page) => Promise<void>,
  email = "admin@npc.qa"
) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await login(page, email);
  await fn(page);
  await ctx.close();
}

// The seven contrast-audit pages of CR05 1.5, one pass per prefix.
async function auditPages(page: Page, prefix: string) {
  const pages: Array<[string, string]> = [
    ["/home", "home"],
    ["/vault", "vault"],
    ["/strategy", "strategy"],
    ["/ask", "ask"],
    ["/trends", "trends"],
    ["/lessons", "lessons"],
    ["/settings", "settings"],
  ];
  for (const [url, name] of pages) {
    await go(page, `/en${url}`, url === "/strategy" ? 2600 : 1800);
    await shot(page, `${prefix}-${name}-en`);
    await go(page, `/ar${url}`, url === "/strategy" ? 2600 : 1800);
    await shot(page, `${prefix}-${name}-ar`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());

  if (want("before")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("before (old scheme) 1440:");
      await auditPages(page, "before");
    });
  }

  if (want("colour")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("after (Maroon Authority) 1440:");
      await auditPages(page, "after");
      // the bar search focus state
      await go(page, "/en/home");
      await page.focus('input[role="combobox"]').catch(() => {});
      await page.waitForTimeout(400);
      await shot(page, "after-bar-search-focus-en");
      // login page
      await page.goto(`${BASE}/api/v1/auth/logout`).catch(() => {});
      const ctx = page.context();
      await ctx.clearCookies();
      await go(page, "/en/login", 1200);
      await shot(page, "after-login-en");
      await go(page, "/ar/login", 1200);
      await shot(page, "after-login-ar");
    });
    await withViewport(browser, 390, 844, async (page) => {
      console.log("after 390:");
      await go(page, "/en/home");
      await shot(page, "after-home-en-390");
    });
  }

  if (want("entities")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("entities 1440:");
      await go(page, "/en/strategy?o=o1&t=o1-t1", 2600);
      await shot(page, "entities-lanes-en");
      await page.click('[data-testid="lane-card"]').catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, "entities-drawer-en");
      await go(page, "/en/strategy?view=lead", 2600);
      await shot(page, "entities-bylead-en", true);
      await go(page, "/ar/strategy?view=lead", 2600);
      await shot(page, "entities-bylead-ar");
      await go(page, "/en/settings?tab=entities", 2000);
      await shot(page, "entities-settings-en");
    });
  }

  if (want("stakeholders")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("stakeholders 1440:");
      // a project drawer via deep link (projects carry the full seeded section)
      await go(page, "/en/strategy?o=o1&t=o1-t1&p=prj-01a", 3000);
      await page
        .locator('[data-testid="node-drawer"] [data-testid="stakeholders-section"]')
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, "stakeholders-drawer-en");
      await go(page, "/ar/strategy?o=o1&t=o1-t1&p=prj-01a", 3000);
      await page
        .locator('[data-testid="node-drawer"] [data-testid="stakeholders-section"]')
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, "stakeholders-drawer-ar");
      // the full project page section with the inline add
      const prj = await page
        .locator('[data-testid="node-drawer"] [data-testid="open-full-page"]')
        .getAttribute("href")
        .catch(() => null);
      if (prj) {
        await go(page, prj.replace(/^\/(en|ar)/, "/en"), 2200);
        await page
          .locator('[data-testid="stakeholders-section"]')
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, "stakeholders-page-en");
      }
    });
  }

  if (want("indices")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("indices 1440:");
      await go(page, "/en/indices", 2400);
      await shot(page, "indices-board-en");
      await shot(page, "indices-board-en-full", true);
      await hoverCenter(page, '[data-testid="index-card"]');
      await shot(page, "indices-board-en-hover");
      await go(page, "/ar/indices", 2400);
      await shot(page, "indices-board-ar");
      await go(page, "/en/indices?view=table", 2200);
      await shot(page, "indices-table-en");
      await go(page, "/en/indices/hdi", 2600);
      await shot(page, "index-page-en");
      await shot(page, "index-page-en-full", true);
      await go(page, "/ar/indices/hdi", 2600);
      await shot(page, "index-page-ar-full", true);
      await go(page, "/en/settings?tab=indices", 2000);
      await shot(page, "indices-settings-en");
    });
    await withViewport(browser, 390, 844, async (page) => {
      console.log("indices 390:");
      await go(page, "/en/indices", 2400);
      await shot(page, "indices-board-en-390");
    });
  }

  if (want("hr")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("hr 1440:");
      await go(page, "/en/hr", 2400);
      await shot(page, "hr-overview-en");
      await shot(page, "hr-overview-en-full", true);
      await go(page, "/ar/hr", 2400);
      await shot(page, "hr-overview-ar");
      await go(page, "/en/hr/departments", 2200);
      await shot(page, "hr-departments-en");
      await go(page, "/en/hr/people", 2200);
      await shot(page, "hr-people-en");
      await go(page, "/en/hr/handovers", 2200);
      await shot(page, "hr-handovers-en");
      await go(page, "/en/hr/risks", 2200);
      await shot(page, "hr-risks-en");
      await go(page, "/ar/hr/risks", 2200);
      await shot(page, "hr-risks-ar");
    });
  }

  if (want("access")) {
    await withViewport(browser, 1440, 900, async (page) => {
      console.log("access 1440:");
      await go(page, "/en/settings?tab=users", 2000);
      await page.click('[data-testid="user-row"] a, [data-testid="user-open"]').catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, "access-user-en");
      await go(page, "/en/settings?tab=roles", 2000);
      await shot(page, "access-roles-en");
      await go(page, "/ar/settings?tab=roles", 2000);
      await shot(page, "access-roles-ar");
      await go(page, "/en/settings?tab=access", 2000);
      await shot(page, "access-domains-en");
    });
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
