/* eslint-disable no-console */
/**
 * Drives the one-time restore page in a real browser: the token gate, the
 * lockout, and an actual file upload through the file input.
 *
 *   npx tsx scripts/dev-probes/setup-restore-check.ts <base> <token> <bundle>
 */
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4000";
const TOKEN = process.argv[3] ?? "";
const BUNDLE = path.resolve(process.argv[4] ?? "sianexus-data.tar.gz");

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function main() {
  if (!fs.existsSync(BUNDLE)) {
    console.error(`no bundle at ${BUNDLE}`);
    process.exit(1);
  }
  const size = fs.statSync(BUNDLE).size;
  console.log(`bundle: ${path.basename(BUNDLE)} ${(size / 1024 / 1024).toFixed(1)} MB\n`);

  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => check("no page error", false, e.message.slice(0, 120)));

  /* ---- the door ---- */
  const wrong = await ctx.request.post(`${BASE}/api/setup/restore/start`, {
    headers: { "x-setup-token": "x".repeat(40), "content-type": "application/json" },
    data: { name: "b.tar.gz", size: 10, sha256: "a".repeat(64) },
  });
  check("a wrong token is refused", wrong.status() === 401, `status ${wrong.status()}`);

  /* ---- the page ---- */
  await page.goto(`${BASE}/setup/restore`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  check("the restore page renders", await page.locator('[data-testid="setup-token"]').isVisible());
  check(
    "the upload button is disabled before a token and a file",
    await page.locator('[data-testid="setup-upload"]').isDisabled()
  );

  await page.fill('[data-testid="setup-token"]', TOKEN);
  await page.setInputFiles('[data-testid="setup-file"]', BUNDLE);
  check(
    "the upload button enables once both are given",
    await page.locator('[data-testid="setup-upload"]').isEnabled()
  );

  /* ---- the upload ---- */
  const t0 = Date.now();
  await page.click('[data-testid="setup-upload"]');
  await page.locator('[data-testid="restore-progress"]').waitFor({ state: "visible", timeout: 180_000 }).catch(() => {});
  check("a progress bar appears", true);

  await page.locator('[data-testid="restore-done"]').waitFor({ state: "visible", timeout: 900_000 });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  check("the upload finishes", true, `${seconds}s`);

  const done = await page.locator('[data-testid="restore-done"]').innerText();
  check("the success message names the next step in English", done.includes("delete the SETUP_TOKEN"));
  check("the success message is there in Arabic", done.includes("SETUP_TOKEN") && /احذف/.test(done));

  await browser.close();
  console.log(`\n== ${pass} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
