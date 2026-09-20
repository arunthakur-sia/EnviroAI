// CR08 4.2 (Indices UI agent): lists the members of one group (or all) so a
// drift against the seed can be read code by code.
//   node scripts/dev-probes/cr08-indices-ui-groupdump.mjs [groupCode]
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const only = process.argv[2];

const groups = await q("select id, code from index_groups where is_active = 1 order by sort");
for (const g of groups) {
  if (only && g.code !== only) continue;
  const members = await q(
    "select i.code, i.name_en, m.sort from index_group_members m join indices i on i.id = m.index_id where m.group_id = ? order by m.sort",
    [g.id]
  );
  console.log(`${g.code} (${members.length})`);
  for (const m of members) console.log(`  ${String(m.sort).padStart(3)} ${String(m.code).padEnd(22)} ${m.name_en}`);
}
db.close();
