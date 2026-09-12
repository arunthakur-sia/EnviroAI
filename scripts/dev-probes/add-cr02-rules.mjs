// Insert the CR02 game rules if missing (seed gains them in Section 8).
import { createClient } from "@libsql/client";
import { ulid } from "ulid";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const rules = [
  ["knowledge_by_voice", 10],
  ["podcast_created", 30],
  ["podcast_listened_full", 5],
  ["report_extracted", 15],
];
for (const [type, points] of rules) {
  const existing = await db.execute({
    sql: "select id from game_rules where event_type=?",
    args: [type],
  });
  if (existing.rows.length) {
    console.log(type, "exists");
    continue;
  }
  await db.execute({
    sql: "insert into game_rules (id, event_type, points, multiplier_rules_json, is_active) values (?,?,?,null,1)",
    args: [ulid(), type, points],
  });
  console.log(type, "added", points);
}
db.close();
