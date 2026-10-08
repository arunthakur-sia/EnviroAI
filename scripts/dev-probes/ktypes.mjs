import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const r = await db.execute(
  "select t.code, t.name_en from taxonomy_terms t join taxonomy_dimensions d on d.id=t.dimension_id where d.code='knowledge_type' order by t.sort"
);
console.log(r.rows.map((x) => x.code).join(", "));
db.close();
