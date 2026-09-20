/* eslint-disable no-console */
// Which elements fail the accessibility and performance audits on a page?
//   node scripts/dev-probes/cr08-lh-detail.mjs leaderboard profile reports
import fs from "node:fs";
import path from "node:path";

const names = process.argv.slice(2);
for (const name of names) {
  const file = path.resolve("data", "lighthouse", `${name}.json`);
  if (!fs.existsSync(file)) {
    console.log(`${name}: no report`);
    continue;
  }
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n=== ${name} ===`);
  for (const [cat, c] of Object.entries(r.categories ?? {})) {
    console.log(`  ${cat}: ${Math.round((c.score ?? 0) * 100)}`);
  }
  for (const a of Object.values(r.audits ?? {})) {
    if (a.score === null || a.score >= 0.9) continue;
    if (a.scoreDisplayMode === "informative" || a.scoreDisplayMode === "notApplicable") continue;
    console.log(`\n  [${a.id}] ${a.title} (${a.score})`);
    const items = a.details?.items ?? [];
    for (const it of items.slice(0, 4)) {
      const node = it.node ?? it.subItems?.items?.[0]?.node;
      if (node) {
        console.log(`    - ${String(node.selector ?? "").slice(0, 110)}`);
        if (node.snippet) console.log(`      ${String(node.snippet).replace(/\s+/g, " ").slice(0, 170)}`);
        if (node.explanation) console.log(`      why: ${String(node.explanation).replace(/\s+/g, " ").slice(0, 170)}`);
      } else if (it.url) {
        console.log(`    - ${String(it.url).slice(0, 110)} ${it.totalBytes ?? it.wastedBytes ?? ""}`);
      }
    }
  }
}
