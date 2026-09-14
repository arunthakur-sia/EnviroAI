import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const r = await db.execute("select code, head_user_id from departments order by code");
for (const row of r.rows) console.log(row.code, row.head_user_id ? "has head" : "NO HEAD");
