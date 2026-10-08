/* eslint-disable no-console */
// CR08 7: inspects what the seed left behind: levels, rules, the users per
// unit, and a sample of the materialised board for the month window.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (sql: string) => (await rawClient.execute(sql)).rows;

  console.log("levels:");
  for (const r of await q("select order_no, name_en, name_ar, min_points, descriptor_en from levels order by order_no")) {
    console.log(" ", r.order_no, r.name_en, "/", r.name_ar, r.min_points, "|", r.descriptor_en);
  }
  console.log("rules excluded from boards:");
  for (const r of await q("select event_type, points from game_rules where excluded_from_boards = 1 order by event_type")) {
    console.log(" ", r.event_type, r.points);
  }
  console.log("new rules:");
  for (const r of await q("select event_type, points from game_rules where event_type in ('learning_path_completed','kow_contributor','kow_unit','kow_read') order by event_type")) {
    console.log(" ", r.event_type, r.points);
  }
  console.log("users per unit (non-deleted):");
  for (const r of await q(
    "select o.code, o.name_en, count(u.id) as n from org_units o join users u on u.department_id = o.id and u.deleted_at is null group by o.id order by n desc"
  )) {
    console.log(" ", r.code, r.name_en, r.n);
  }
  console.log("users without a unit:", (await q("select count(*) as n from users where department_id is null and deleted_at is null"))[0].n);
  console.log("leaderboard rows by board/kind:");
  for (const r of await q(
    "select board, period_kind, period_key, count(*) as n from leaderboard_periods where category = 'overall' group by board, period_kind order by board, period_kind"
  )) {
    console.log(" ", r.board, r.period_kind, r.period_key, r.n);
  }
  console.log("people, overall, month, top 12:");
  for (const r of await q(
    "select l.rank, u.email, l.points, l.previous_rank, l.previous_points from leaderboard_periods l join users u on u.id = l.subject_id where l.board='people' and l.category='overall' and l.period_kind='month' order by l.rank limit 12"
  )) {
    console.log(" ", r.rank, r.email, r.points, "prev", r.previous_rank, r.previous_points);
  }
  console.log("departments, overall, month:");
  for (const r of await q(
    "select l.rank, o.code, l.points, l.members, l.active_members, l.previous_rank from leaderboard_periods l join org_units o on o.id = l.subject_id where l.board='departments' and l.category='overall' and l.period_kind='month' order by l.rank"
  )) {
    console.log(" ", r.rank, r.code, r.points, "members", r.members, "active", r.active_members, "prev", r.previous_rank);
  }
  console.log("guardians month rows:", (await q("select count(*) as n from leaderboard_periods where category='guardians' and period_kind='month' and board='people'"))[0].n);
  console.log("learners month rows:", (await q("select count(*) as n from leaderboard_periods where category='learners' and period_kind='month' and board='people'"))[0].n);
  console.log("reader month row:", await q(
    "select l.rank, l.points from leaderboard_periods l join users u on u.id = l.subject_id where u.email='reader@enviroai.demo' and l.board='people' and l.category='overall' and l.period_kind='month'"
  ));
  console.log("reader all row:", await q(
    "select l.rank, l.points from leaderboard_periods l join users u on u.id = l.subject_id where u.email='reader@enviroai.demo' and l.board='people' and l.category='overall' and l.period_kind='all'"
  ));
  console.log("jobs queued leaderboard_refresh:", await q("select id, status, run_after from jobs where type='leaderboard_refresh' order by created_at desc limit 3"));
  console.log("settings:", await q("select key, value_json from settings where key like 'leaderboard%'"));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
