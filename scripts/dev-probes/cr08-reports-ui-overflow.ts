/* eslint-disable no-console */
// CR08 5 (Reports UI agent): names the elements that make a Reports page
// wider than a narrow viewport, so a 390px overflow can be fixed at its
// source instead of guessed at. Prints every element whose right edge passes
// the viewport, innermost first, with its tag, testid and classes.
//   npx tsx scripts/dev-probes/cr08-reports-ui-overflow.ts
//   PROBE_WIDTH=390 PROBE_LOCALE=ar npx tsx scripts/dev-probes/cr08-reports-ui-overflow.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const WIDTH = Number(process.env.PROBE_WIDTH ?? 390);
const LOCALE = process.env.PROBE_LOCALE ?? "en";

async function login(page: Page, email: string) {
  for (let i = 0; i < 12; i++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: "EnviroAI!2026" }, timeout: 120000 });
      if (res.ok()) return;
      console.log(`  login: ${res.status()}, retrying`);
    } catch (e) {
      console.log(`  login: ${String((e as Error)?.message ?? e).split("\n")[0]}, retrying`);
    }
    await page.waitForTimeout(12000);
  }
  throw new Error("login failed");
}

const REPORT = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const over = Math.max(r.right - vw, -r.left);
    if (over > 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || "",
        cls: (el.getAttribute("class") || "").slice(0, 160),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        scrollWidth: el.scrollWidth,
        children: el.children.length,
      });
    }
  }
  return JSON.stringify({ vw, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, items: out.slice(0, 40) });
})()`;

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, locale: LOCALE === "ar" ? "ar-QA" : "en-QA" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await login(page, "admin@enviroai.demo");

  const j = await (await page.request.get(`${BASE}/api/v1/report-builder`, { timeout: 180000 })).json();
  const list = (j?.data?.reports ?? []) as { id: string; status: string; previewCount: number; typeCode: string }[];
  const usable = list.filter((r) => r.status === "published" && r.previewCount > 0);
  const ids = [usable.find((r) => r.typeCode === "org_annual_report")?.id, usable[0]?.id].filter(Boolean) as string[];

  for (const url of [`${BASE}/${LOCALE}/reports`, `${BASE}/${LOCALE}/reports/new`, ...ids.map((id) => `${BASE}/${LOCALE}/reports/${id}`)]) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("main", { timeout: 180000 });
    await page.waitForTimeout(2500);
    const raw = String(await page.evaluate(REPORT));
    const data = JSON.parse(raw) as { vw: number; scrollWidth: number; items: Record<string, unknown>[] };
    console.log(`\n===== ${url}`);
    console.log(`viewport ${data.vw}, document scrollWidth ${data.scrollWidth}, offenders ${data.items.length}`);
    for (const it of data.items) console.log("  " + JSON.stringify(it));
  }

  await browser.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
