// Do the people and items the demo guide names actually exist in the seeded data?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const emails = [
  "admin@enviroai.demo",
  "knowledge@enviroai.demo",
  "hr@enviroai.demo",
  "head.stats@enviroai.demo",
  "analyst@enviroai.demo",
  "reader@enviroai.demo",
  "verifier@enviroai.demo",
  "mohammed.alqarni@enviroai.demo",
];
console.log("accounts named in the guide:");
for (const e of emails) {
  const r = await q("select name_en, locked_until from users where email = ? and deleted_at is null", [e]);
  console.log(`  ${e.padEnd(30)} ${r.length ? r[0].name_en : "MISSING"}${r.length && r[0].locked_until ? "  (LOCKED)" : ""}`);
}

const handovers = await q(
  `select h.id, h.status, h.completion_pct, u.name_en, u.email
   from handovers h left join users u on u.id = h.user_id order by h.status`
);
console.log("\nhandovers:");
for (const h of handovers) {
  console.log(`  ${String(h.id).slice(0, 8)} ${String(h.status).padEnd(12)} ${String(h.completion_pct).padStart(3)}%  ${h.name_en ?? "(external)"}`);
}

const kow = await q("select resource_type, week_start, status from knowledge_of_week order by week_start desc limit 3");
console.log("\nknowledge of the week:");
for (const k of kow) console.log(`  ${k.week_start}  ${k.status}  ${k.resource_type}`);

const reports = await q("select count(*) c from reports where status = 'published'");
console.log(`\npublished reports: ${reports[0].c}`);
db.close();
