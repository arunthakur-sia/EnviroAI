/* eslint-disable no-console */
// CR01 screenshots into data/screenshots/cr01 (EN + AR). Requires a running server.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { chromium, type Page } from "playwright";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr01");

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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const conv = await db.execute(
    "select c.id from ai_conversations c join users u on u.id = c.user_id where u.email='analyst@enviroai.demo' order by c.created_at limit 1"
  );
  const convId = conv.rows[0]?.id ? String(conv.rows[0].id) : null;
  const signal = await db.execute("select id from signals where triage_status='accepted' limit 1");
  const signalId = signal.rows[0]?.id ? String(signal.rows[0].id) : null;
  db.close();

  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await shoot(page, "/en/login", "login-en");
  await shoot(page, "/ar/login", "login-ar");
  await login(page, "admin@enviroai.demo");
  console.log("admin 1440px:");
  await shoot(page, "/en/home", "home-en");
  await shoot(page, "/ar/home", "home-ar");
  await shoot(page, "/en/trends", "trends-en", 1800);
  await shoot(page, "/ar/trends", "trends-ar", 1800);
  if (signalId) await shoot(page, `/en/trends/${signalId}`, "signal-en");
  await shoot(page, "/en/ask", "ask-en");
  await shoot(page, "/ar/ask", "ask-ar");
  await shoot(page, "/en/add", "add-en");
  await shoot(page, "/ar/add", "add-ar");
  await ctx.close();

  // the analyst's seeded conversation workspace
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page2 = await ctx2.newPage();
  await login(page2, "analyst@enviroai.demo");
  console.log("analyst:");
  if (convId) await shoot(page2, `/en/ask/c/${convId}`, "conversation-en", 2000);
  await ctx2.close();

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
