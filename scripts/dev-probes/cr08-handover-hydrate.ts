/* eslint-disable no-console */
// CR08 6: diagnoses how long the HR handovers page takes to hydrate on the
// shared dev server, logging unbuffered to data/screenshots/cr08/hydrate.log.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const LOG = path.join(process.cwd(), "data", "screenshots", "cr08", "hydrate.log");
const log = (s: string) => {
  fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${s}\n`);
  console.log(s);
};

async function main() {
  fs.writeFileSync(LOG, "");
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log(`PAGEERROR ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") log(`CONSOLE ${m.text().slice(0, 300)}`);
  });
  page.on("requestfailed", (r) => log(`REQFAIL ${r.url().slice(0, 140)} ${r.failure()?.errorText ?? ""}`));

  const t0 = Date.now();
  const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "hr@npc.qa", password: "Nexus!2026" }, timeout: 180000 });
  log(`login ${res.status()} ${Date.now() - t0}ms`);

  const t1 = Date.now();
  await page.goto(`${BASE}/en/hr/handovers`, { timeout: 300000, waitUntil: "domcontentloaded" });
  log(`goto domcontentloaded ${Date.now() - t1}ms`);

  for (let i = 0; i < 40; i++) {
    const state = (await page
      .evaluate(
        `(() => {
           const el = document.querySelector('[data-testid="hr-handovers"]');
           const row = document.querySelector('[data-testid="handover-row"]');
           let op = "none";
           if (el) {
             let n = el, min = 1;
             while (n && n !== document.body) { const o = parseFloat(getComputedStyle(n).opacity || "1"); if (o < min) min = o; n = n.parentElement; }
             op = String(min);
           }
           return JSON.stringify({ el: !!el, rows: document.querySelectorAll('[data-testid="handover-row"]').length, minOpacity: op, ready: document.readyState, scripts: document.querySelectorAll("script[src]").length, rowVisible: row ? row.getBoundingClientRect().height : 0 });
         })()`
      )
      .catch((e) => `eval failed ${String(e).slice(0, 120)}`)) as string;
    log(`t+${Math.round((Date.now() - t1) / 1000)}s ${state}`);
    if (typeof state === "string" && state.includes('"minOpacity":"1"')) {
      log("PAINTED");
      break;
    }
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: path.join(process.cwd(), "data", "screenshots", "cr08", "hydrate-check.png") });
  log("done");
  await browser.close();
}

main().catch((e) => {
  log(`FAILED ${String(e).slice(0, 400)}`);
  process.exit(1);
});
