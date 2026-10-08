import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const jobs = (
  await db.execute(
    "select type, status, attempts, substr(coalesce(error,''),1,300) err, created_at from jobs order by created_at desc limit 8"
  )
).rows;
for (const j of jobs) console.log(j.type, j.status, "attempts:", j.attempts, j.err ? "\n  ERR: " + j.err : "");
const reports = (
  await db.execute("select id, status, substr(coalesce(error,''),1,200) err from reports order by created_at desc limit 4")
).rows;
for (const r of reports) console.log("report", r.id, r.status, r.err);
db.close();
