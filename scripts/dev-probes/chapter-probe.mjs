// Probe: can the NDS3 outcome chapters be located in document chunks?
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const docs = await q(
  "select id, title_en, language_original, page_count from documents where title_en like 'Third National Development Strategy%' and deleted_at is null"
);
for (const d of docs) console.log(d.id, "|", d.title_en, "|", d.language_original, "| pages", d.page_count);

const outcomes = await q(
  "select code, title_en, title_ar from strategy_nodes where node_type='outcome' and edition_id=(select id from strategy_editions where code='nds3') order by sort"
);

for (const d of docs) {
  console.log(`\n-- scanning ${d.language_original} doc --`);
  const chunks = await q(
    "select chunk_index, page_from, heading, substr(text,1,90) t from document_chunks where document_id=? order by chunk_index",
    [d.id]
  );
  console.log("chunks:", chunks.length, "| pages spanned:", chunks.at(-1)?.page_from);
  for (const o of outcomes) {
    const title = d.language_original === "ar" ? o.title_ar : o.title_en;
    const hit = chunks.find(
      (c) =>
        (c.heading ?? "").toLowerCase().includes(title.toLowerCase().slice(0, 24)) ||
        (c.t ?? "").toLowerCase().includes(title.toLowerCase().slice(0, 24))
    );
    console.log(o.code, "|", title.slice(0, 40), "->", hit ? `page ${hit.page_from} (chunk ${hit.chunk_index})` : "NOT FOUND");
  }
  // sample headings
  const headings = chunks.filter((c) => c.heading).slice(0, 8);
  for (const h of headings) console.log("  heading sample:", h.page_from, "|", h.heading?.slice(0, 70));
}
db.close();
