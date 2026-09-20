/* eslint-disable no-console */
// CR08 5 (Reports UI agent): how many published module reports each seeded
// account may see, which is what the gallery renders (listModuleReports
// filters on classification <= the viewer's clearance).
//   npx tsx scripts/dev-probes/cr08-reports-ui-clearance.ts
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const levels = (await db.execute(
    "select classification_level c, count(*) n from reports where type_id is not null and status = 'published' group by classification_level order by c"
  )).rows;
  console.log("published module reports by classification:", levels.map((r) => `L${r.c}=${r.n}`).join(", "));
  const users = (await db.execute(
    "select u.email, u.clearance_level, r.name_en role from users u join roles r on r.id = u.role_id where u.email in ('admin@npc.qa','analyst@npc.qa','reader@npc.qa','knowledge@npc.qa','head.stats@npc.qa')"
  )).rows;
  for (const u of users) {
    const visible = (await db.execute({
      sql: "select count(*) n from reports where type_id is not null and status = 'published' and classification_level <= ?",
      args: [Number(u.clearance_level)],
    })).rows[0]?.n;
    console.log(`${String(u.email).padEnd(20)} ${String(u.role).padEnd(16)} clearance ${u.clearance_level} sees ${visible} published covers`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
