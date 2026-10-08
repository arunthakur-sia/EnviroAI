import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const r = await db.execute("select value_json from settings where key='indices_last_refresh'");
console.log(JSON.stringify(r.rows));
db.close();
