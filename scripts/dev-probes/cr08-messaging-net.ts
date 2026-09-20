/* eslint-disable no-console */
// CR08 9 verification helper: lists every request a page makes with its status
// so a failing resource can be named.
//   npx tsx scripts/dev-probes/cr08-messaging-net.ts /en/profile
import { chromium } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

/** sign in over the API; the login form races hydration on a loaded dev server */
async function sessionCookies(email: string) {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
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
  const target = process.argv[2] ?? "/en/profile";
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await sessionCookies(process.env.WARM_EMAIL ?? "analyst@npc.qa"));
  const page = await ctx.newPage();
  const seen: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) seen.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });

  seen.length = 0;
  await page.goto(BASE + target, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`${target}: ${seen.length} failing request(s)`);
  for (const s of seen) console.log("  " + s);
  for (const s of seen) {
    const url = s.split(" ").pop() ?? "";
    if (!url.includes("/api/")) continue;
    const body = await page.evaluate(`fetch(${JSON.stringify(url)}).then(r => r.text())`);
    console.log(`\nbody of ${url}:\n${String(body).slice(0, 1200)}`);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
