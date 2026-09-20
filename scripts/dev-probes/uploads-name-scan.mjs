/* eslint-disable no-console */
// Does any stored file the product can serve contain the name? Scans the text
// of data/uploads and names the document row that points at each hit.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const terms = process.argv.slice(2);
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const docs = (await db.execute("select id, title_en, storage_path from documents")).rows;
const byPath = new Map(docs.map((d) => [String(d.storage_path ?? "").replace(/\\/g, "/"), d]));

const root = path.join(process.cwd(), "data", "uploads");
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(txt|html|aspx|json|csv|md)$/i.test(e.name)) continue;
    let text;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const t = terms.find((x) => text.includes(x));
    if (!t) continue;
    const rel = path.relative(path.join(process.cwd(), "data"), full).replace(/\\/g, "/");
    const doc = byPath.get(rel) ?? byPath.get(`data/${rel}`) ?? byPath.get(rel.replace(/^uploads\//, ""));
    const i = text.indexOf(t);
    hits.push({
      file: rel,
      doc: doc ? `${String(doc.id).slice(0, 10)} "${doc.title_en}"` : "not referenced by any document row",
      context: text.slice(Math.max(0, i - 70), i + 110).replace(/\s+/g, " "),
    });
  }
};
walk(root);

console.log(`files under data/uploads naming ${terms.join(" or ")}: ${hits.length}`);
for (const h of hits) {
  console.log(`\n  ${h.file}`);
  console.log(`    document: ${h.doc}`);
  console.log(`    ...${h.context}...`);
}
db.close();
