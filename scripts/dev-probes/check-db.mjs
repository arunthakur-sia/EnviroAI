// Quick DB introspection: node scripts/dev-probes/check-db.mjs "<sql>" [...more]
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
for (const sql of process.argv.slice(2)) {
  try {
    const r = await db.execute(sql);
    console.log(">", sql.slice(0, 90));
    console.log(JSON.stringify(r.rows.slice(0, 30)));
  } catch (e) {
    console.log(">", sql.slice(0, 90), "ERROR:", e.message);
  }
}
db.close();
