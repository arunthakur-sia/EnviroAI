import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute(
  "select name_en, name_ar, definition_ar from indicators where code='cpi_inflation'"
);
console.log(JSON.stringify(r.rows[0], null, 1));
for (const term of ['"التضخم"', '"تضخم"', '"للتضخم"']) {
  const f = await db.execute({
    sql: "select count(*) c from records_fts where records_fts match ?",
    args: [term],
  });
  console.log(`fts ${term}: ${f.rows[0].c}`);
}
const idx = await db.execute(
  "select text from search_index where resource_type='indicator' and text like '%مستهلك%' limit 2"
);
console.log("index text sample:", idx.rows.map((x) => String(x.text).slice(0, 200)));
db.close();
