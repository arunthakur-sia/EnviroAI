/* eslint-disable no-console */
// CR03 screenshots into data/screenshots/cr03 (EN + AR, rest + hover states).
// Requires a running server. Pass section names as args to limit, e.g.
// `npx tsx scripts/screenshots-cr03.ts vault home`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Browser, type Page } from "playwright";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr03");
const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", email);
  await page.fill("#password", "Nexus!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });
}

async function shoot(
  page: Page,
  url: string,
  name: string,
  opts: { wait?: number; hover?: string; click?: string; full?: boolean } = {}
) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(opts.wait ?? 1600);
  if (opts.click) {
    try {
      await page.click(opts.click, { timeout: 4000 });
      await page.waitForTimeout(700);
    } catch {
      console.log(`  (click target missing: ${opts.click})`);
    }
  }
  if (opts.hover) {
    try {
      await page.hover(opts.hover, { timeout: 4000, force: true });
      await page.waitForTimeout(500);
    } catch {
      console.log(`  (hover target missing: ${opts.hover})`);
    }
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.full ?? false });
  console.log(`  ${name}.png`);
}

async function withViewport(
  browser: Browser,
  width: number,
  height: number,
  email: string,
  fn: (page: Page) => Promise<void>
) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await login(page, email);
  await fn(page);
  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const projectRow = await db.execute(
    "select node_id from deliverable_meta group by node_id order by count(*) desc limit 1"
  );
  const projectId = projectRow.rows[0]?.node_id ? String(projectRow.rows[0].node_id) : null;
  db.close();

  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());

  if (want("vault")) {
    await withViewport(browser, 1440, 900, "admin@npc.qa", async (page) => {
      console.log("vault 1440:");
      await shoot(page, "/en/vault", "vault-en-1440");
      await shoot(page, "/en/vault", "vault-en-1440-hover", {
        hover: '[data-testid="book"]:nth-of-type(3) a',
      });
      await shoot(page, "/ar/vault", "vault-ar-1440");
      await shoot(page, "/en/vault?view=grid", "vault-grid-en");
      await shoot(page, "/en/vault", "vault-en-full", { full: true });
    });
    await withViewport(browser, 390, 844, "admin@npc.qa", async (page) => {
      console.log("vault 390:");
      await shoot(page, "/en/vault", "vault-en-390");
      await shoot(page, "/ar/vault", "vault-ar-390");
    });
  }

  if (want("strategy")) {
    await withViewport(browser, 1440, 900, "admin@npc.qa", async (page) => {
      console.log("strategy 1440:");
      await shoot(page, "/en/strategy", "strategy-en-1440", { wait: 2400 });
      await shoot(page, "/en/strategy", "strategy-en-1440-hover", {
        wait: 2400,
        hover: ':nth-match([data-testid="outcome-medallion"], 3)',
      });
      await shoot(page, "/ar/strategy", "strategy-ar-1440", { wait: 2400 });
      await shoot(page, "/en/strategy/nds3/o3", "strategy-outcome-en", { wait: 2000 });
      await shoot(page, "/en/strategy/nds3/o3", "strategy-outcome-en-open", {
        wait: 2000,
        click: ':nth-match([data-testid="target-card"] button, 2)',
      });
      await shoot(page, "/ar/strategy/nds3/o3", "strategy-outcome-ar", { wait: 2000 });
      await shoot(page, "/en/strategy/nds3/o3/o3-t1", "strategy-target-en", { wait: 2000 });
      await shoot(page, "/en/strategy?view=map", "strategy-map-en", { wait: 2600 });
      if (projectId) {
        await shoot(page, `/en/strategy/${projectId}`, "project-detail-en", { wait: 2000 });
        await shoot(page, `/ar/strategy/${projectId}`, "project-detail-ar", { wait: 2000 });
      }
    });
    await withViewport(browser, 390, 844, "admin@npc.qa", async (page) => {
      console.log("strategy 390:");
      await shoot(page, "/en/strategy", "strategy-en-390", { wait: 2400 });
      await shoot(page, "/ar/strategy", "strategy-ar-390", { wait: 2400 });
    });
  }

  if (want("trends")) {
    await withViewport(browser, 1440, 900, "admin@npc.qa", async (page) => {
      console.log("trends 1440:");
      await shoot(page, "/en/trends", "trends-en-1440", { wait: 2600 });
      await shoot(page, "/en/trends", "trends-en-1440-hover", {
        wait: 2600,
        hover: '[data-testid="signal-radar"] circle[role="button"]',
      });
      await shoot(page, "/ar/trends", "trends-ar-1440", { wait: 2600 });
      await shoot(page, "/en/trends", "trends-en-full", { wait: 2600, full: true });
    });
    await withViewport(browser, 390, 844, "admin@npc.qa", async (page) => {
      console.log("trends 390:");
      await shoot(page, "/en/trends", "trends-en-390", { wait: 2600 });
      await shoot(page, "/ar/trends", "trends-ar-390", { wait: 2600 });
    });
  }

  if (want("home")) {
    await withViewport(browser, 1440, 900, "admin@npc.qa", async (page) => {
      console.log("home 1440:");
      await shoot(page, "/en/home", "home-en-1440", { wait: 2600 });
      await shoot(page, "/en/home", "home-en-1440-hover", {
        wait: 2600,
        hover: '[data-testid="qatar-numbers"]',
      });
      await shoot(page, "/ar/home", "home-ar-1440", { wait: 2600 });
      await shoot(page, "/en/home", "home-en-full", { wait: 2600, full: true });
      await shoot(page, "/ar/home", "home-ar-full", { wait: 2600, full: true });
    });
    await withViewport(browser, 390, 844, "admin@npc.qa", async (page) => {
      console.log("home 390:");
      await shoot(page, "/en/home", "home-en-390", { wait: 2600 });
      await shoot(page, "/ar/home", "home-ar-390", { wait: 2600 });
    });
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
