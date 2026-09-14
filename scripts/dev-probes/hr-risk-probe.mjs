import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql) => (await db.execute(sql)).rows;
console.log(await q("select kind, severity, count(*) c from hr_risks where resolved_at is null group by kind, severity order by kind"));
db.close();
