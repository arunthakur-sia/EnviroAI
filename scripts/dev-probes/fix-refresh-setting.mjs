import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute("select value_json from settings where key='indices_last_refresh'");
const cur = r.rows[0]?.value_json;
if (cur && !String(cur).includes("{")) {
  const at = JSON.parse(String(cur));
  await db.execute({
    sql: "update settings set value_json = ? where key='indices_last_refresh'",
    args: [JSON.stringify({ at })],
  });
  console.log("migrated to object form");
} else {
  console.log("already fine:", cur);
}
db.close();
