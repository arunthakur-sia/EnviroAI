// What does the frozen demo baseline hold? Reads data/demo-snapshot/nexus.db,
// never the live database, so it is safe to run while the server is serving.
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/demo-snapshot/nexus.db` });
const q = async (sql) => (await db.execute(sql)).rows;

const snaps = await q("select note, taken_at from org_snapshots order by taken_at");
console.log(`org_snapshots: ${snaps.length}`);
for (const s of snaps) console.log(`  ${String(s.taken_at).slice(0, 19)}  ${String(s.note ?? "").slice(0, 70)}`);

for (const [label, sql] of [
  ["units", "select count(*) c from org_units where deleted_at is null"],
  ["users", "select count(*) c from users where deleted_at is null"],
  ["documents", "select count(*) c from documents where deleted_at is null"],
  ["indices", "select count(*) c from indices"],
  ["index groups", "select count(*) c from index_groups"],
  ["reports published", "select count(*) c from reports where status = 'published'"],
  ["processes", "select count(*) c from processes"],
  ["handovers", "select count(*) c from handovers"],
  ["messages", "select count(*) c from messages"],
  ["game events", "select count(*) c from game_events"],
  ["leaderboard rows", "select count(*) c from leaderboard_rows"],
]) {
  try {
    const r = await q(sql);
    console.log(`${label.padEnd(20)} ${r[0].c}`);
  } catch (e) {
    console.log(`${label.padEnd(20)} (${String(e.message).slice(0, 50)})`);
  }
}
db.close();
