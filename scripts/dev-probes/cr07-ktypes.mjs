import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const dims = await db.execute("select id, code, name_en from taxonomy_dimensions order by code");
console.log("dimensions:", dims.rows.map((d) => d.code).join(", "));
const kt = dims.rows.find((d) => d.code === "knowledge_type");
if (kt) {
  const terms = await db.execute({
    sql: "select code, name_en, name_ar, sort from taxonomy_terms where dimension_id = ? order by sort",
    args: [kt.id],
  });
  console.log("\nknowledge_type terms:");
  for (const t of terms.rows) console.log(`  ${String(t.code).padEnd(18)} ${t.name_en} / ${t.name_ar}`);
}
