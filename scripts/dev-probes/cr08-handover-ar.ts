/* eslint-disable no-console */
// CR08 6: why the Arabic handover screens stall before they paint. Opens each
// Arabic route, records console and page errors, and prints the opacity of the
// chain above the marker element.
//   npx tsx scripts/dev-probes/cr08-handover-ar.ts
import { chromium, type Page } from "playwright";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const NAV = 120000;

async function login(page: Page, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: "EnviroAI!2026" }, timeout: NAV });
      if (res.ok()) return;
    } catch {
      /* the shared dev server resets connections under load */
    }
    await page.waitForTimeout(3000);
  }
  throw new Error(`login failed for ${email}`);
}

async function logout(page: Page) {
  await page.request.post(`${BASE}/api/v1/auth/logout`).catch(() => {});
  await page.context().clearCookies();
}

async function inspect(page: Page, url: string, selector: string) {
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(`pageerror: ${e.message.slice(0, 400)}`);
  const onCon = (m: { type: () => string; text: () => string }) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 400)}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onCon);
  await page.goto(url, { timeout: NAV, waitUntil: "domcontentloaded" });
  const found = await page
    .waitForSelector(selector, { timeout: 60000, state: "attached" })
    .then(() => true)
    .catch(() => false);
  const opacityOf = `(() => {
       const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return "missing";
       let n = el, worst = 1;
       while (n && n !== document.body) { worst = Math.min(worst, parseFloat(getComputedStyle(n).opacity || "1")); n = n.parentElement; }
       return String(worst);
     })()`;
  for (const ms of [6000, 14000, 20000]) {
    await page.waitForTimeout(ms);
    console.log(`  after ${ms}ms cumulative: worst opacity ${found ? await page.evaluate(opacityOf) : "n/a"}`);
  }
  const chain = found
    ? await page.evaluate(
        `(() => {
           const el = document.querySelector(${JSON.stringify(selector)});
           if (!el) return "missing";
           const out = [];
           let n = el;
           while (n && n !== document.body) {
             const cs = getComputedStyle(n);
             out.push(n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.split(" ").slice(0, 2).join(".") : "") + " opacity=" + cs.opacity + " transform=" + cs.transform.slice(0, 30));
             n = n.parentElement;
           }
           return out.join("\\n  ");
         })()`
      )
    : "not attached";
  console.log(`=== ${url}  selector ${found ? "attached" : "MISSING"}`);
  console.log("  " + chain);
  console.log(errors.length ? "  errors:\n  " + errors.join("\n  ") : "  errors: none");
  page.off("pageerror", onErr);
  page.off("console", onCon);
}

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { like } = await import("drizzle-orm");
  const [seedA] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:a%")).limit(1);
  const browser = await chromium.launch({ channel: "msedge" });
  const reduce = process.env.NO_REDUCE ? undefined : ("reduce" as const);
  console.log("reducedMotion:", reduce ?? "no-preference");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduce });
  const page = await ctx.newPage();

  await login(page, "hr@enviroai.demo");
  // control pages nobody on this task owns, to tell a shell-wide warning from one of mine
  await inspect(page, `${BASE}/en/lessons`, "main");
  await inspect(page, `${BASE}/ar/lessons`, "main");
  await inspect(page, `${BASE}/en/hr/handovers`, '[data-testid="handover-row"]');
  await inspect(page, `${BASE}/ar/hr/handovers`, '[data-testid="handover-row"]');
  await page.screenshot({ path: "data/screenshots/cr08/handover-ar-diag.png" });
  await inspect(page, `${BASE}/ar/hr/handovers/${seedA.id}`, '[data-testid="handover-admin"]');
  await logout(page);

  await login(page, "abdulrahman.albalawi@enviroai.demo");
  await inspect(page, `${BASE}/ar/handover/mine`, '[data-testid="my-handover"]');
  await logout(page);

  await login(page, "mohammed.alqarni@enviroai.demo");
  await inspect(page, `${BASE}/ar/handover/${seedA.id}`, '[data-testid="recipient-handover"]');
  await logout(page);

  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
