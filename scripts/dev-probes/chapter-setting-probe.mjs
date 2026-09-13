import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute("select value_json from settings where key='outcome_chapters'");
const v = JSON.parse(r.rows[0].value_json);
for (const [k, c] of Object.entries(v)) {
  console.log(k, "pages", `${c.pageFrom}-${c.pageTo}`, "| sumEn", (c.summaryEn ?? "").length, "| sumAr", (c.summaryAr ?? "").length);
}
console.log("\nO3 EN:", (v.O3?.summaryEn ?? "").slice(0, 350));
console.log("\nO1 EN:", (v.O1?.summaryEn ?? "").slice(0, 200));
db.close();
