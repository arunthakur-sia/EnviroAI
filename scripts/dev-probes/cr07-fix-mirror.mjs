// Lessons created before CR07 wired the publish paths carry a node_id with no
// link row. Give each one its primary link so the mirror check holds.
import { createClient } from "@libsql/client";
import { ulid } from "ulid";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const rows = (
  await db.execute(`
    select l.id, l.node_id, l.author_id, l.created_at from lessons l
    where l.node_id is not null and l.node_id <> ''
      and not exists (
        select 1 from lesson_node_links x
        where x.lesson_id = l.id and x.node_id = l.node_id and x.is_primary = 1
      )`)
).rows;
console.log("lessons missing their primary link:", rows.length);
for (const r of rows) {
  const existing = (
    await db.execute({
      sql: "select id from lesson_node_links where lesson_id = ? and node_id = ?",
      args: [r.id, r.node_id],
    })
  ).rows;
  await db.execute({
    sql: "update lesson_node_links set is_primary = 0 where lesson_id = ?",
    args: [r.id],
  });
  if (existing.length) {
    await db.execute({
      sql: "update lesson_node_links set is_primary = 1 where id = ?",
      args: [existing[0].id],
    });
  } else {
    await db.execute({
      sql: "insert into lesson_node_links (id, lesson_id, node_id, node_kind, is_primary, linked_by, linked_at) values (?, ?, ?, 'nds', 1, ?, ?)",
      args: [ulid(), r.id, r.node_id, r.author_id, r.created_at ?? new Date().toISOString()],
    });
  }
}
const left = (
  await db.execute(`
    select count(*) c from lessons l
    where l.node_id is not null and l.node_id <> ''
      and not exists (
        select 1 from lesson_node_links x
        where x.lesson_id = l.id and x.node_id = l.node_id and x.is_primary = 1
      )`)
).rows[0];
console.log("still missing:", left.c);
