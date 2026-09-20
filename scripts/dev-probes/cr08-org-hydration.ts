/* eslint-disable no-console */
// CR08 1: prints the full text of hydration errors on the organisation and
// settings pages, with the component stack and React's attribute diff (the
// console arguments), to see where they come from.
//   npx tsx scripts/dev-probes/cr08-org-hydration.ts [path ...]
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PATHS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/ar/organisation", "/en/settings?tab=organisation", "/en/settings", "/en/organisation"];

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  for (const url of PATHS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      void Promise.all(m.args().map((a) => a.jsonValue().catch(() => "?")))
        .then((args) => {
          const rest = args.slice(1).map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join("\n");
          errors.push(`console: ${m.text()}\n--- args ---\n${rest}`);
        })
        .catch(() => errors.push(`console: ${m.text()}`));
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ""}`));
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(3000);
    console.log(`\n==== ${url}: ${errors.length} errors`);
    for (const e of errors) {
      const lines = e.split("\n");
      const keep = lines.filter(
        (l, i) => i < 4 || /^[+-]/.test(l) || /^\s+at [A-Z]/.test(l) || /Organisation|OrgChart|UnitPanel|Settings|Chart|Rail|Ask|Shell|---/.test(l)
      );
      console.log(keep.slice(0, 80).join("\n"));
    }
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
