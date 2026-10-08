/* eslint-disable no-console */
// CR02 screenshots into data/screenshots/cr02 (EN + AR). Requires a running
// server. Grows section by section; pass section names as args to limit,
// e.g. `npx tsx scripts/screenshots-cr02.ts home strategy`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Browser, type Page } from "playwright";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr02");
const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", email);
  await page.fill("#password", "EnviroAI!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });
}

async function shoot(page: Page, url: string, name: string, wait = 1400) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
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
    "select id from strategy_nodes where node_type='project' order by sort limit 1"
  );
  const projectId = projectRow.rows[0]?.id ? String(projectRow.rows[0].id) : null;
  const episodeRow = await db.execute(
    "select id from podcast_episodes where status='published' order by created_at limit 1"
  );
  const episodeId = episodeRow.rows[0]?.id ? String(episodeRow.rows[0].id) : null;
  db.close();

  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());

  if (want("home")) {
    // Acceptance 1: EN and AR at 1440, 1280, 1024, 390
    for (const [w, h] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
    ] as const) {
      await withViewport(browser, w, h, "admin@enviroai.demo", async (page) => {
        console.log(`home ${w}px:`);
        await shoot(page, "/en/home", `home-en-${w}`);
        await shoot(page, "/ar/home", `home-ar-${w}`);
      });
    }
    await withViewport(browser, 390, 844, "admin@enviroai.demo", async (page) => {
      console.log("home 390px:");
      await shoot(page, "/en/home", "home-en-390");
      await shoot(page, "/ar/home", "home-ar-390");
    });
  }

  if (want("strategy")) {
    await withViewport(browser, 1440, 900, "admin@enviroai.demo", async (page) => {
      console.log("strategy:");
      await shoot(page, "/en/strategy", "strategy-en", 1800);
      await shoot(page, "/ar/strategy", "strategy-ar", 1800);
      await shoot(page, "/en/strategy/nes3/o3", "strategy-outcome-en", 1800);
      await shoot(page, "/en/strategy/nes3/o3/o3-t1", "strategy-target-en", 1800);
      await shoot(page, "/ar/strategy/nes3/o3/o3-t1", "strategy-target-ar", 1800);
      await shoot(page, "/en/strategy?view=map", "strategy-map-en", 2400);
      if (projectId) {
        await shoot(page, `/en/strategy/${projectId}`, "project-detail-en", 1800);
        await shoot(page, `/ar/strategy/${projectId}`, "project-detail-ar", 1800);
      }
    });
    await withViewport(browser, 900, 800, "admin@enviroai.demo", async (page) => {
      console.log("strategy stacked:");
      await shoot(page, "/en/strategy/nes3/o3", "strategy-stacked-en", 1800);
    });
  }

  if (want("lessons")) {
    await withViewport(browser, 1440, 900, "admin@enviroai.demo", async (page) => {
      console.log("lessons:");
      await shoot(page, "/en/lessons", "lessons-en", 1800);
      await shoot(page, "/ar/lessons", "lessons-ar", 1800);
      await shoot(page, "/en/lessons?view=projects", "lessons-byproject-en", 1800);
    });
  }

  if (want("podcast")) {
    await withViewport(browser, 1440, 900, "admin@enviroai.demo", async (page) => {
      console.log("podcast:");
      await shoot(page, "/en/podcast", "podcast-en", 1800);
      await shoot(page, "/ar/podcast", "podcast-ar", 1800);
      await shoot(page, "/en/podcast/new", "podcast-new-en", 1800);
      if (episodeId) {
        await shoot(page, `/en/podcast/${episodeId}`, "podcast-episode-en", 1800);
        await shoot(page, `/ar/podcast/${episodeId}`, "podcast-episode-ar", 1800);
      }
    });
  }

  if (want("add")) {
    await withViewport(browser, 1440, 900, "admin@enviroai.demo", async (page) => {
      console.log("add knowledge:");
      await shoot(page, "/en/add", "add-en", 1600);
      await shoot(page, "/ar/add", "add-ar", 1600);
      await shoot(page, "/en/add?mode=speak", "add-speak-en", 1600);
      await shoot(page, "/ar/add?mode=speak", "add-speak-ar", 1600);
    });
  }

  if (want("trends")) {
    await withViewport(browser, 1440, 900, "admin@enviroai.demo", async (page) => {
      console.log("trends:");
      await shoot(page, "/en/trends", "trends-en", 1800);
      await shoot(page, "/ar/trends", "trends-ar", 1800);
    });
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
