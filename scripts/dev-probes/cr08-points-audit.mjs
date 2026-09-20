// Why did the two points checks fail? Look at the rule caps and today's ledger.
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const rules = await q(
  `select event_type, points, is_active from game_rules
   where event_type in ('signal_accepted','podcast_listened_full')`
);
console.log("rules:");
for (const r of rules) console.log(" ", JSON.stringify(r));

const today = new Date().toISOString().slice(0, 10);
const events = await q(
  `select event_type, count(*) c, sum(points) pts
   from game_events where created_at >= ?
     and event_type in ('signal_accepted','podcast_listened_full')
   group by event_type`,
  [today]
);
console.log(`\nevents since ${today}:`);
for (const e of events) console.log(` ${String(e.event_type).padEnd(28)} ${String(e.c).padStart(4)}  ${e.pts} pts`);
db.close();
