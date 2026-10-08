/* eslint-disable no-console */
// CR08 4.2 (Indices UI agent): attributes the hydration-mismatch console error
// seen on /indices. If the same error appears on pages this module does not
// own (/home, /experts), it belongs to the shared AppShell top bar and is
// reported to the coordinator rather than chased here.
//   npx tsx scripts/dev-probes/cr08-indices-ui-shellcheck.ts
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const PAGES = ["/en/home", "/en/experts", "/en/indices", "/en/statistics"];

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);

  const seen: Record<string, string[]> = {};
  let current = "";
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/favicon|hot-update|Download the React DevTools/i.test(text)) return;
    (seen[current] ??= []).push(text.slice(0, 160).replace(/\s+/g, " "));
  });

  const login = await page.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
    timeout: 120000,
  });
  console.log("login", login.status());

  for (const p of PAGES) {
    current = p;
    seen[current] = [];
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    // let React hydrate and log
    await page.waitForTimeout(6000);
    const hydration = seen[p].filter((t) => /hydrat/i.test(t));
    console.log(`${p}: ${seen[p].length} console error(s), ${hydration.length} hydration`);
    for (const t of seen[p]) console.log(`   ${t}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
