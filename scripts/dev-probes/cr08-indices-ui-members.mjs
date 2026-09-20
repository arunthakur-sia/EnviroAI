// CR08 4.2 (Indices UI agent): assigns the twelve CR05 indices to sensible
// groups so the grouped board can be built and tested before the data
// agent's seed lands. INSERT OR IGNORE on the (group, index) unique key, so
// the real seed produces the same rows and this probe never duplicates.
//   node scripts/dev-probes/cr08-indices-ui-members.mjs
import { createClient } from "@libsql/client";
import { ulid } from "ulid";

const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const MEMBERSHIPS = {
  hdi: ["human"],
  gii: ["competitiveness"],
  cpi: ["governance"],
  egdi: ["governance", "digital"],
  gpi: ["peace"],
  imd: ["competitiveness"],
  lpi: ["competitiveness"],
  nri: ["competitiveness", "digital"],
  ttdi: ["competitiveness"],
  epi: ["environment"],
  gtci: ["competitiveness", "human"],
  wjp: ["governance"],
};

const groups = new Map((await q("select id, code from index_groups")).map((r) => [r.code, r.id]));
const indices = new Map((await q("select id, code from indices")).map((r) => [r.code, r.id]));
// --reset: drop every membership of the twelve first, so an interrupted UI
// probe that moved a card leaves no trace
if (process.argv.includes("--reset")) {
  for (const indexCode of Object.keys(MEMBERSHIPS)) {
    const indexId = indices.get(indexCode);
    if (indexId) await db.execute({ sql: "delete from index_group_members where index_id = ?", args: [indexId] });
  }
  console.log("reset: memberships of the twelve CR05 indices cleared");
}
let inserted = 0;
let skipped = 0;
for (const [indexCode, groupCodes] of Object.entries(MEMBERSHIPS)) {
  const indexId = indices.get(indexCode);
  if (!indexId) {
    console.log(`skip ${indexCode}: no index row`);
    continue;
  }
  for (const groupCode of groupCodes) {
    const groupId = groups.get(groupCode);
    if (!groupId) {
      console.log(`skip ${indexCode} -> ${groupCode}: no group row`);
      continue;
    }
    const existing = await q(
      "select count(*) c from index_group_members where group_id = ? and index_id = ?",
      [groupId, indexId]
    );
    const sort = Number(
      (await q("select coalesce(max(sort), 0) m from index_group_members where group_id = ?", [groupId]))[0].m
    ) + 1;
    const res = await db.execute({
      sql: "insert or ignore into index_group_members (id, group_id, index_id, sort) values (?, ?, ?, ?)",
      args: [ulid(), groupId, indexId, sort],
    });
    if (Number(existing[0].c) === 0 && res.rowsAffected === 1) inserted++;
    else skipped++;
  }
}
console.log(`memberships: ${inserted} inserted, ${skipped} already present`);
for (const r of await q(
  "select g.code, (select count(*) from index_group_members m where m.group_id = g.id) n from index_groups g order by g.sort"
)) console.log(`  ${r.code}: ${r.n}`);
db.close();
