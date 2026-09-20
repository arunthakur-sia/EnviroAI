/* eslint-disable no-console */
// CR08 7: which page emits a hydration warning, and what attribute differs.
// Also captures the Home-block preview in both locales.
//   npx tsx scripts/dev-probes/cr08-leaderboard-hydration.ts reader@npc.qa
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

const PAGES: { url: string; shot?: string; wait?: string }[] = [
  { url: "/en/leaderboard", wait: "[data-testid=board-table]" },
  { url: "/ar/leaderboard", wait: "[data-testid=board-table]", shot: "leaderboard-people-ar" },
  { url: "/en/leaderboard?board=departments", wait: "[data-testid=board-table]" },
  { url: "/en/leaderboard/preview", wait: "[data-testid=home-leaderboard]", shot: "leaderboard-home-block-en" },
  { url: "/ar/leaderboard/preview", wait: "[data-testid=home-leaderboard]", shot: "leaderboard-home-block-ar" },
  { url: "/en/profile", wait: "[data-testid=profile-level-chip]" },
  { url: "/en/home", wait: "[data-testid=progress-panel]" },
  { url: "/ar/home", wait: "[data-testid=progress-panel]" },
];

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = process.argv[2] ?? "admin@npc.qa";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await context.request.post(`${BASE}/api/v1/auth/login`, {
      data: { email, password: "Nexus!2026" },
      timeout: 120000,
    });
    if (res.status() === 200) break;
    await page.waitForTimeout(3000);
  }
  let current = "";
  let warnings = 0;
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      const text = m.text();
      if (/favicon|Fast Refresh|DevTools/.test(text)) return;
      warnings++;
      console.log(`\n[${current}] ${m.type()}:\n${text.slice(0, 2500)}`);
    }
  });
  page.on("pageerror", (e) => {
    warnings++;
    console.log(`\n[${current}] PAGEERROR: ${String(e).slice(0, 800)}`);
  });
  for (const p of PAGES) {
    current = p.url;
    await page.goto(`${BASE}${p.url}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    if (p.wait) await page.waitForSelector(p.wait, { timeout: 120000 }).catch(() => console.log(`  (no ${p.wait})`));
    await page
      .waitForFunction(
        "[...document.querySelectorAll('main [style*=opacity]')].every((el) => parseFloat(getComputedStyle(el).opacity) >= 0.99)",
        undefined,
        { timeout: 90000 }
      )
      .catch(() => {});
    await page.waitForTimeout(4000);
    if (p.shot) {
      await page.screenshot({ path: path.join(OUT, `${p.shot}.png`) });
      console.log(`  shot ${p.shot}`);
    }
    console.log(`visited ${p.url}`);
  }
  await browser.close();
  console.log(warnings ? `\n${warnings} console warnings or errors` : "\nno console warnings or errors");
  process.exit(warnings ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
