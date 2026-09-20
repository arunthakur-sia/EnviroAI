/* eslint-disable no-console */
// CR08 5 (Reports UI agent): which block kinds, layouts and statuses the
// seeded sections actually carry, and one sample of each kind, so the React
// block renderer is written against real content.
//   npx tsx scripts/dev-probes/cr08-reports-ui-blocks.ts
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const rows = (await db.execute(
    "select s.section_code, s.status, s.content_json, s.comments_json from report_sections s join reports r on r.id = s.report_id where r.status = 'published'"
  )).rows;
  const kinds = new Map<string, number>();
  const layouts = new Map<string, number>();
  const statuses = new Map<string, number>();
  const samples: Record<string, unknown> = {};
  let needsEditing = 0;
  let withMeta = 0;
  for (const r of rows) {
    statuses.set(String(r.status), (statuses.get(String(r.status)) ?? 0) + 1);
    let c: any = null;
    try {
      c = JSON.parse(String(r.content_json ?? "null"));
    } catch {
      c = null;
    }
    if (!c) continue;
    layouts.set(String(c.layout), (layouts.get(String(c.layout)) ?? 0) + 1);
    if (c.needsEditing) needsEditing += 1;
    if (c.meta) withMeta += 1;
    for (const b of c.blocks ?? []) {
      kinds.set(b.kind, (kinds.get(b.kind) ?? 0) + 1);
      if (!samples[b.kind]) {
        const copy = { ...b };
        if (copy.pngBase64) copy.pngBase64 = `<${String(copy.pngBase64).length} chars>`;
        if (copy.svg) copy.svg = String(copy.svg).slice(0, 300) + "...";
        samples[b.kind] = copy;
      }
    }
    if (c.keyFigure && !samples.__keyFigure) samples.__keyFigure = { keyFigure: c.keyFigure, lead: c.lead, numeral: c.numeral, title: c.title };
    if (c.sources?.length && !samples.__sources) samples.__sources = c.sources.slice(0, 2);
    if (c.meta && !samples.__meta) samples.__meta = { code: c.code, meta: c.meta };
  }
  console.log("sections:", rows.length);
  console.log("statuses:", [...statuses].map(([k, v]) => `${k}=${v}`).join(", "));
  console.log("layouts:", [...layouts].map(([k, v]) => `${k}=${v}`).join(", "));
  console.log("kinds:", [...kinds].map(([k, v]) => `${k}=${v}`).join(", "));
  console.log("needsEditing:", needsEditing, "withMeta:", withMeta);
  const out = path.join(process.cwd(), "data", "reports", "ui-block-samples.json");
  fs.writeFileSync(out, JSON.stringify(samples, null, 2));
  console.log("samples written to", out);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
