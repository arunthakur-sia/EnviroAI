import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const r = await db.execute("select id, code, name_en, name_ar, head_user_id from org_units order by code");
for (const row of r.rows) console.log(`${row.code.padEnd(20)} ${row.name_en}\n${" ".repeat(21)}${row.name_ar}`);
console.log("\n-- reference counts --");
for (const [label, sql] of [
  ["users.department_id", "select count(*) c from users where department_id is not null"],
  ["documents.department_id", "select count(*) c from documents where department_id is not null"],
  ["node_leads.department_id", "select count(*) c from node_leads where department_id is not null"],
  ["indicators.owner_department_id", "select count(*) c from indicators where owner_department_id is not null"],
  ["hr risks", "select count(*) c from hr_risks where department_id is not null"],
]) {
  try {
    const x = await db.execute(sql);
    console.log(label.padEnd(30), x.rows[0].c);
  } catch (e) {
    console.log(label.padEnd(30), "n/a:", e.message.slice(0, 60));
  }
}
