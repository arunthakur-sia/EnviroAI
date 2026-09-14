import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const r = await db.execute("select u.email, u.name_en, u.department_id, d.code from users u left join departments d on d.id = u.department_id where u.deleted_at is null order by d.code, u.email");
for (const row of r.rows) console.log((row.code ?? "-").padEnd(18), row.email, "|", row.name_en);
