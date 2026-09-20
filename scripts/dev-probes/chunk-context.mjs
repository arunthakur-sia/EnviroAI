// Show the document a chunk belongs to, for any chunk matching a term.
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const term = process.argv[2] ?? "";
const rows = (
  await db.execute({
    sql: `select c.id, c.text, d.title_en, d.source_ref
          from document_chunks c join documents d on d.id = c.document_id
          where c.text like ? limit 5`,
    args: [`%${term}%`],
  })
).rows;
console.log(`chunks matching "${term}": ${rows.length}`);
for (const r of rows) {
  const i = String(r.text).indexOf(term);
  console.log(`\n  document: ${r.title_en}`);
  console.log(`  source:   ${String(r.source_ref ?? "").slice(0, 110)}`);
  console.log(`  ...${String(r.text).slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, " ")}...`);
}
db.close();
