// Why does the People board differ from the smoke suite's ledger sum?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const [u] = await q("select id, name_en from users where email = 'analyst@enviroai.demo'");
console.log(`user: ${u.name_en}`);
const rows = await q(
  `select e.event_type, count(*) n, sum(e.points) pts, coalesce(r.excluded_from_boards, 0) excluded
   from game_events e left join game_rules r on r.event_type = e.event_type
   where e.user_id = ? group by e.event_type, excluded order by pts desc`,
  [u.id]
);
let all = 0;
let counted = 0;
for (const r of rows) {
  all += Number(r.pts);
  if (!Number(r.excluded)) counted += Number(r.pts);
  console.log(`  ${String(r.event_type).padEnd(28)} n=${String(r.n).padStart(3)}  ${String(r.pts).padStart(4)} pts  excludedFromBoards=${r.excluded}`);
}
console.log(`\nledger as the smoke check computes it: ${counted}`);
console.log(`ledger including excluded rules:      ${all}`);
const board = await q(
  "select points from leaderboard_rows where subject_id = ? and board = 'people' and category = 'overall' and period_kind = 'all' limit 1",
  [u.id]
).catch(() => []);
console.log(`board row: ${JSON.stringify(board)}`);
db.close();
