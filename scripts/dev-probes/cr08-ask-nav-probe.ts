/* eslint-disable no-console */
// CR08 2.3: isolates the client navigation step of the panel probe in one
// locale (default ar) without any analyst call. Logs every console message,
// times the Link transition and a direct load of the [step] route.
//   npx tsx scripts/dev-probes/cr08-ask-nav-probe.ts [locale]
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const locale = process.argv[2] ?? "ar";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => console.log(`  [console.${m.type()}] ${m.text().slice(0, 240)}`));
  page.on("pageerror", (e) => console.log(`  [pageerror] ${String(e).slice(0, 240)}`));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) console.log(`  [navigated] ${f.url()}`);
  });
  const login = await page.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "analyst@enviroai.demo", password: "EnviroAI!2026" },
  });
  console.log("login:", login.status());

  let t = Date.now();
  await page.goto(`${BASE}/${locale}/ask/panel-test`, { waitUntil: "networkidle", timeout: 120_000 });
  console.log(`first load: ${Date.now() - t} ms`);

  await page.evaluate('window.__mark = "kept"');
  t = Date.now();
  await page.evaluate('document.querySelector(\'[data-testid="panel-test-next"]\').click()');
  let moved = await page
    .waitForURL(/\/ask\/panel-test\/two/, { timeout: 40_000 })
    .then(() => true)
    .catch(() => false);
  console.log(`link transition (DOM click): ${moved ? "ok" : "TIMEOUT"} in ${Date.now() - t} ms, url ${page.url()}`);
  if (!moved) {
    // control: a real pointer click on the same Link
    t = Date.now();
    await page.click('[data-testid="panel-test-next"]');
    moved = await page
      .waitForURL(/\/ask\/panel-test\/two/, { timeout: 40_000 })
      .then(() => true)
      .catch(() => false);
    console.log(`link transition (pointer click): ${moved ? "ok" : "TIMEOUT"} in ${Date.now() - t} ms, url ${page.url()}`);
  }
  if (moved) {
    await page.waitForSelector('[data-testid="panel-test"][data-step="two"]', { timeout: 60_000 }).catch(() => {});
    const mark = await page.evaluate('window.__mark || "reloaded"');
    console.log(`transition kind: ${mark === "kept" ? "client" : "FULL RELOAD"}`);
  }

  t = Date.now();
  const res = await page.goto(`${BASE}/${locale}/ask/panel-test/two`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  console.log(`direct [step] load: ${res?.status()} in ${Date.now() - t} ms`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
