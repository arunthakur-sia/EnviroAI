// CR08 4.2/4.3 (Indices UI agent): prints the indices/groups state of the
// shared database so a probe run can be verified clean before and after.
// With --clean it removes probe and smoke leftovers (groups whose code starts
// with probe_/smoke_, indices whose code starts with pt/sm followed by the
// six-character run stamp) together with their observations and memberships.
//   node scripts/dev-probes/cr08-indices-ui-dbstate.mjs [--clean]
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const clean = process.argv.includes("--clean");

const LEFTOVER_GROUP = /^(probe|smoke)_/;
const LEFTOVER_INDEX = /^(pt|sm)[0-9a-z]{6}$/;

if (process.argv.includes("--tables")) {
  for (const r of await q(
    "select name from sqlite_master where type = 'table' and (name like 'index%' or name like 'indices%') order by name"
  )) {
    const cols = (await q(`pragma table_info(${r.name})`)).map((c) => c.name).join(", ");
    console.log(`  table ${r.name}: ${cols}`);
  }
}

console.log("groups:");
for (const r of await q(
  "select g.id, g.code, g.is_active, g.sort, (select count(*) from index_group_members m where m.group_id = g.id) n from index_groups g order by g.sort"
)) {
  console.log(`  ${String(r.code).padEnd(20)} active=${r.is_active} sort=${r.sort} members=${r.n}`);
}

const strayGroups = (await q("select id, code from index_groups")).filter((r) => LEFTOVER_GROUP.test(String(r.code)));
const strayIndices = (await q("select id, code, is_active from indices")).filter((r) => LEFTOVER_INDEX.test(String(r.code)));
console.log(`\nleftover groups: ${strayGroups.map((r) => r.code).join(", ") || "none"}`);
console.log(`leftover indices: ${strayIndices.map((r) => `${r.code}(active=${r.is_active})`).join(", ") || "none"}`);

const totals = (await q("select count(*) c from indices where is_active = 1"))[0];
const defs = (await q("select count(*) c from indices"))[0];
console.log(`\nindices: ${totals.c} active of ${defs.c}`);

// a drag left mid-run shows as a member count that does not match the seed
const EXPECTED = { sdg: 18, national: 11, environment: 8, climate: 7, water: 5, agriculture: 5, governance: 7, human: 2 };
let drift = 0;
for (const [code, want] of Object.entries(EXPECTED)) {
  const row = (await q(
    "select (select count(*) from index_group_members m where m.group_id = g.id) n from index_groups g where g.code = ?",
    [code]
  ))[0];
  const got = row ? Number(row.n) : -1;
  if (got !== want) {
    console.log(`  DRIFT ${code}: ${got} members, seed has ${want}`);
    drift++;
  }
}
console.log(drift ? `\n${drift} group(s) drifted from the seed` : "\nevery seeded group matches its seeded member count");

if (clean) {
  for (const g of strayGroups) {
    await db.execute({ sql: "delete from index_group_members where group_id = ?", args: [g.id] });
    await db.execute({ sql: "delete from index_groups where id = ?", args: [g.id] });
    console.log(`removed group ${g.code}`);
  }
  // every child of `indices` that the wizard or the smoke run can write,
  // deepest first so no orphan row is left behind
  // index_rankings is the CR05 static table and carries no index_id
  const CHILDREN = [
    "delete from index_pillar_values where index_id = ?",
    "delete from index_pillars where index_id = ?",
    "delete from index_forecast_assumptions where index_id = ?",
    "delete from index_forecasts where index_id = ?",
    "delete from index_observations where index_id = ?",
    "delete from index_group_members where index_id = ?",
  ];
  for (const i of strayIndices) {
    for (const sql of CHILDREN) {
      try {
        await db.execute({ sql, args: [i.id] });
      } catch (e) {
        console.log(`  (skipped: ${String(e.message).slice(0, 80)})`);
      }
    }
    await db.execute({ sql: "delete from indices where id = ?", args: [i.id] });
    console.log(`removed index ${i.code}`);
  }
  if (!strayGroups.length && !strayIndices.length) console.log("nothing to clean");
}

db.close();
