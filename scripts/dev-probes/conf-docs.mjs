import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const r = await db.execute(
  "select classification_level, count(*) c from documents where deleted_at is null group by classification_level"
);
console.log(r.rows);
const total = await db.execute("select count(*) c from documents where deleted_at is null");
console.log("total docs:", total.rows[0].c);
db.close();
