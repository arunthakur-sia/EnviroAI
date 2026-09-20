/* eslint-disable no-console */
// CR08 3 and 2.2: per-page console and page-error attribution for the pages
// the Experts and Studies work owns, plus a recapture of the search
// screenshots. Runs alone (no concurrent writers) so a transient lock
// cannot be mistaken for a defect.
//   npx tsx scripts/dev-probes/cr08-experts-console.ts
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");

const PAGES = [
  "/en/experts?view=internal",
  "/en/experts?view=internal&layout=flat",
  "/en/experts?view=external",
  "/en/experts?view=external&type=academic",
  "/en/experts/new",
  "/en/studies",
  "/en/studies?type=research",
  "/en/vault/upload?type=study",
  "/en/search?q=Noora%20Al-Kuwari",
  "/ar/search?q=Noora%20Al-Kuwari",
  "/ar/experts?view=internal",
  "/ar/experts?view=external",
  "/ar/studies",
];

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let current = "";
  const byPage = new Map<string, string[]>();
  const note = (text: string) => (byPage.get(current) ?? byPage.set(current, []).get(current)!).push(text);
  page.on("console", (m) => {
    if (m.type() === "error") note(`console: ${m.text().slice(0, 260)}`);
  });
  page.on("pageerror", (e) => note(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) note(`${r.status()} ${r.url().replace(BASE, "").slice(0, 120)}`);
  });

  // log in through the API on the context's request client (it shares the
  // cookie jar), so a slow-to-hydrate login form cannot post natively
  const login = await ctx.request.post(BASE + "/api/v1/auth/login", {
    data: { email: "admin@npc.qa", password: "Nexus!2026" },
    timeout: 180000,
  });
  if (login.status() !== 200) throw new Error(`login -> ${login.status()}`);

  for (const p of PAGES) {
    current = p;
    const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const status = res?.status();
    let extra = "";
    if (p.includes("/search")) {
      extra = ` groups=${await page.locator('[data-testid="expert-groups"]').count()} internal=${await page.locator('[data-testid="expert-group-internal"]').count()} external=${await page.locator('[data-testid="expert-group-external"]').count()}`;
      await page.screenshot({ path: path.join(OUT, `search-experts-${p.startsWith("/ar") ? "ar" : "en"}.png`) });
    }
    if (p === "/en/experts?view=internal") {
      // the collapse control, after hydration
      const header = page.locator('[data-testid="unit-group"] button[aria-expanded]').first();
      await header.click();
      await page.waitForTimeout(500);
      extra += ` collapsedAfterClick=${await page.locator('[data-testid="unit-group"] button[aria-expanded="false"]').count()}`;
      await page.locator('[data-testid="expand-all"]').click();
      await page.waitForTimeout(800);
      extra += ` afterExpandAll=${await page.locator('[data-testid="unit-group"] button[aria-expanded="false"]').count()}`;
    }
    const issues = byPage.get(p) ?? [];
    console.log(`${status} ${p}${extra}${issues.length ? `\n    ${issues.join("\n    ")}` : "  (clean)"}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
