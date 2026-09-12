// Inspect strategy node structure for the CR02 2.1 migration plan.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });

const editions = (await db.execute("select id, code from strategy_editions")).rows;
for (const e of editions) {
  console.log("== edition", e.code);
  const types = (
    await db.execute({
      sql: "select node_type, count(*) c from strategy_nodes where edition_id=? group by node_type",
      args: [e.id],
    })
  ).rows;
  console.log(types.map((t) => `${t.node_type}:${t.c}`).join("  "));
  // parent type -> child type pairs
  const pairs = (
    await db.execute({
      sql: `select p.node_type pt, c.node_type ct, count(*) n
            from strategy_nodes c join strategy_nodes p on p.id = c.parent_id
            where c.edition_id = ? group by pt, ct order by n desc`,
      args: [e.id],
    })
  ).rows;
  for (const p of pairs) console.log(`  ${p.pt} -> ${p.ct}: ${p.n}`);
  const roots = (
    await db.execute({
      sql: "select node_type, count(*) c from strategy_nodes where edition_id=? and parent_id is null group by node_type",
      args: [e.id],
    })
  ).rows;
  console.log("  roots:", roots.map((t) => `${t.node_type}:${t.c}`).join("  "));
}
// sample codes per type for nds3
const nds3 = editions.find((e) => e.code === "nds3");
if (nds3) {
  for (const t of ["outcome", "target", "sector_strategy", "initiative", "project", "enabler", "cluster"]) {
    const rows = (
      await db.execute({
        sql: "select code, title_en from strategy_nodes where edition_id=? and node_type=? order by sort limit 4",
        args: [nds3.id, t],
      })
    ).rows;
    if (rows.length) console.log(t, "codes:", rows.map((r) => r.code).join(", "));
  }
}
db.close();
