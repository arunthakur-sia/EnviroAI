/* eslint-disable no-console */
// CR08 9 verification helper: prints every console error a page raises, in
// full, for the Inbox and for a page Section 9 did not touch, so a warning
// coming from the shared shell can be told apart from one of ours.
//   npx tsx scripts/dev-probes/cr08-messaging-console.ts
import { chromium } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

/** sign in over the API; the login form races hydration on a loaded dev server */
async function sessionCookies(email: string) {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
    redirect: "manual",
  });
  const out: { name: string; value: string; domain: string; path: string }[] = [];
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const i = pair.indexOf("=");
    if (i > 0) out.push({ name: pair.slice(0, i).trim(), value: pair.slice(i + 1), domain: "localhost", path: "/" });
  }
  if (!out.length) throw new Error(`login failed for ${email}: ${res.status}`);
  return out;
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await sessionCookies("analyst@enviroai.demo"));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));

  for (const p of ["/en/home", "/en/vault", "/en/inbox", "/ar/inbox", "/en/profile"]) {
    errors.length = 0;
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log(`\n===== ${p}: ${errors.length} console error(s) =====`);
    for (const e of errors) console.log("---\n" + e.slice(0, 2500));
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
