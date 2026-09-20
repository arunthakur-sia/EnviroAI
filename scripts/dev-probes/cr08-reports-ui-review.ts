/* eslint-disable no-console */
// CR08 5 (Reports UI agent): the review half of the flow on a report that
// already exists, so approval, publishing, the downloads, the Institutional
// Memory link and the page lightbox can be re-checked without rebuilding a
// report (the shared dev server needs minutes for a build). Takes the report
// from REPORT, else the newest unpublished module report.
//   REPORT=<id> npx tsx scripts/dev-probes/cr08-reports-ui-review.ts
// Screenshots: data/screenshots/cr08/reports-approved-en.png,
// reports-published-en.png, reports-lightbox-en.png.
import { chromium, type Page } from "playwright";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
fs.mkdirSync(OUT, { recursive: true });

const fails: string[] = [];
const errors: string[] = [];
function expect(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` (${detail})` : ""}`);
  if (!ok) fails.push(name);
}

async function login(page: Page) {
  for (let i = 0; i < 12; i++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
      if (res.ok()) return;
      console.log(`  login: ${res.status()}, retrying`);
    } catch (e) {
      console.log(`  login: ${String((e as Error)?.message ?? e).split("\n")[0]}, retrying`);
    }
    await page.waitForTimeout(12000);
  }
  throw new Error("login failed");
}

/** Clicks a lifecycle button and waits for the status, with one retry. */
async function clickToStatus(page: Page, testId: string, wanted: string, waitMs = 240000): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if ((await page.locator(`[data-testid="${testId}"]`).count()) === 0) break;
    await page.click(`[data-testid="${testId}"]`, { timeout: 240000 });
    const t0 = Date.now();
    while (Date.now() - t0 < waitMs) {
      const status = await page.getAttribute('[data-testid="report-page"]', "data-status");
      if (status === wanted) return status;
      await page.waitForTimeout(2000);
    }
    console.log(`  ${testId}: not ${wanted} after ${Math.round(waitMs / 1000)}s${attempt === 0 ? ", clicking once more" : ""}`);
  }
  return await page.getAttribute('[data-testid="report-page"]', "data-status");
}

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const id =
    process.env.REPORT ??
    String((await db.execute("select id from reports where type_id is not null and status != 'published' order by created_at desc limit 1")).rows[0]?.id ?? "");
  if (!id) {
    console.log("no unpublished module report to review");
    return;
  }
  console.log(`review flow on ${id}`);

  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-QA" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  await login(page);
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|hot-update|Download the React DevTools/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  // which request answered 4xx or 5xx, so a console "failed to load" can be named
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url().replace(BASE, "")}`);
  });

  await page.goto(`${BASE}/en/reports/${id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector('[data-testid="report-page"]', { timeout: 240000 });
  await page.waitForTimeout(1500);
  console.log(`  opened at status ${await page.getAttribute('[data-testid="report-page"]', "data-status")}`);

  const submitted = await clickToStatus(page, "submit-review", "in_review");
  expect("submit leaves the report in review", submitted === "in_review" || submitted === "approved" || submitted === "published", `status=${submitted}`);

  const approved = await clickToStatus(page, "approve", "approved");
  expect("approve moves to approved", approved === "approved" || approved === "published", `status=${approved}`);
  expect("publish is offered once approved", (await page.locator('[data-testid="publish"]').count()) === 1);
  await page.screenshot({ path: path.join(OUT, "reports-approved-en.png") });
  console.log("  shot reports-approved-en");

  const published = await clickToStatus(page, "publish", "published", 300000);
  expect("publish moves to published", published === "published", `status=${published}`);
  expect("the Institutional Memory link appears", (await page.locator('[data-testid="memory-link"]').count()) === 1);
  const en = await page.request.get(`${BASE}/api/v1/report-builder/${id}/download?lang=en`, { timeout: 240000 });
  const ar = await page.request.get(`${BASE}/api/v1/report-builder/${id}/download?lang=ar`, { timeout: 240000 });
  expect(
    "both downloads answer a docx",
    en.status() === 200 && ar.status() === 200 && (ar.headers()["content-type"] ?? "").includes("wordprocessingml"),
    `en=${en.status()} ar=${ar.status()}`
  );

  // the filmstrip and its lightbox
  const pages = await page.locator('[data-testid="filmstrip-page"]').count();
  expect("the filmstrip lists the rendered pages", pages >= 3, `pages=${pages}`);
  await page.locator('[data-testid="filmstrip-page"]').first().click();
  await page.waitForSelector('[data-testid="lightbox"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  expect("the lightbox opens on page one", (await page.locator('[data-testid="lightbox"] img').count()) === 1);
  await page.click('[data-testid="lightbox-next"]');
  await page.waitForTimeout(500);
  expect("next moves to page two", (await page.locator('[data-testid="lightbox"]').innerText()).includes("2"));
  await page.screenshot({ path: path.join(OUT, "reports-lightbox-en.png") });
  console.log("  shot reports-lightbox-en");
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="lightbox"]', { state: "detached", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "reports-published-en.png") });
  console.log("  shot reports-published-en");

  await browser.close();
  console.log("");
  if (errors.length) for (const e of errors) console.log("  " + e);
  else console.log("no console or page errors");
  console.log(fails.length ? `${fails.length} assertion(s) failed:\n  ${fails.join("\n  ")}` : "all assertions passed");
  process.exit(errors.length || fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
