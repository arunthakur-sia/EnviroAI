import { readFile } from "node:fs/promises";
import path from "node:path";
for (const name of process.argv.slice(2)) {
  const file = path.join(process.cwd(), "data", "lighthouse", `${name}.json`);
  const report = JSON.parse(await readFile(file, "utf8"));
  console.log(`\n== ${name}: a11y ${Math.round(report.categories.accessibility.score * 100)}`);
  const refs = report.categories.accessibility.auditRefs;
  for (const ref of refs) {
    const audit = report.audits[ref.id];
    if (!audit || audit.score === null || audit.score === 1) continue;
    console.log(`  FAIL ${ref.id} (weight ${ref.weight}): ${audit.title}`);
    const items = audit.details?.items ?? [];
    for (const item of items.slice(0, 4)) {
      const snip = item.node?.snippet ?? item.node?.selector ?? JSON.stringify(item).slice(0, 120);
      console.log(`     ${String(snip).replace(/\s+/g, " ").slice(0, 170)}`);
    }
  }
}
