// Probe 2: token-overlap scoring to find each outcome's pages in the NDS3 doc.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const STOP = new Set(["the","of","and","a","an","to","in","for","with","into","through","qatar","qatari","national","development","strategy"]);
const tokens = (s) => [...new Set((s ?? "").toLowerCase().replace(/[^a-z\u0600-\u06ff\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)))];

const docs = await q("select id, language_original from documents where title_en like 'Third National Development Strategy%' and deleted_at is null");
const outcomes = await q("select code, title_en, title_ar, description_en, description_ar from strategy_nodes where node_type='outcome' and edition_id=(select id from strategy_editions where code='nds3') order by sort");

for (const d of docs) {
  console.log(`\n-- ${d.language_original} --`);
  const chunks = await q("select page_from, text from document_chunks where document_id=? order by chunk_index", [d.id]);
  const pageText = new Map();
  for (const c of chunks) {
    const p = c.page_from ?? 0;
    pageText.set(p, (pageText.get(p) ?? "") + " " + c.text.toLowerCase());
  }
  for (const o of outcomes) {
    const ar = d.language_original === "ar";
    const toks = tokens((ar ? o.title_ar : o.title_en) + " " + (ar ? o.description_ar : o.description_en ?? "").slice(0, 200));
    const scores = [...pageText.entries()].map(([p, text]) => [p, toks.filter((t) => text.includes(t)).length]).sort((a, b) => b[1] - a[1]);
    console.log(o.code, "top pages:", scores.slice(0, 4).map(([p, s]) => `p${p}:${s}`).join(" "), "| toks:", toks.slice(0, 6).join(","));
  }
}
db.close();
