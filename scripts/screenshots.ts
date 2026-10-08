/* eslint-disable no-console */
// Captures EN + AR screenshots of the main screens into data/screenshots.
// Requires a running server (dev or start) and `npx playwright install chromium`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots");

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/en/login`);
  await page.fill("#email", email);
  await page.fill("#password", "EnviroAI!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 30000 });
}

async function shoot(page: Page, url: string, name: string, wait = 1200) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ${name}.png`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // The machine policy blocks Playwright's downloaded Chromium; system Edge is signed and allowed.
  const browser = await chromium
    .launch({ channel: "msedge" })
    .catch(() => chromium.launch());

  const targets: [string, string][] = [
    ["/en/home", "home-en"],
    ["/ar/home", "home-ar"],
    ["/en/vault", "vault-en"],
    ["/ar/vault", "vault-ar"],
    ["/en/vault/collections", "collections-en"],
    ["/en/strategy", "strategy-en"],
    ["/ar/strategy", "strategy-ar"],
    ["/en/strategy?edition=nes2", "strategy-earlier-cycle-en"],
    ["/en/statistics", "statistics-en"],
    ["/ar/statistics", "statistics-ar"],
    ["/en/experts", "experts-en"],
    ["/en/ask", "ask-en"],
    ["/ar/ask", "ask-ar"],
    ["/en/lessons", "lessons-en"],
    ["/en/trends", "trends-en"],
    ["/en/search?q=population%20growth", "search-en"],
    ["/en/profile", "profile-en"],
    ["/en/settings", "settings-en"],
  ];

  // desktop 1440
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "admin@enviroai.demo");
  console.log("1440px:");
  for (const [url, name] of targets) await shoot(page, url, name);
  await shoot(page, "/en/login", "login-en");
  await ctx.close();

  // analyst home at 1280
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page2 = await ctx2.newPage();
  await login(page2, "analyst@enviroai.demo");
  console.log("1280px analyst:");
  await shoot(page2, "/en/home", "home-analyst");
  await ctx2.close();

  // mobile 390
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page3 = await ctx3.newPage();
  await login(page3, "admin@enviroai.demo");
  console.log("390px:");
  await shoot(page3, "/en/home", "home-mobile");
  await shoot(page3, "/en/vault", "vault-mobile");
  await ctx3.close();

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
