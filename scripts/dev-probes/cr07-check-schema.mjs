import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const t = await db.execute(
  "select name, type from sqlite_master where name in ('org_units','departments','lesson_node_links','council_nodes','council_indicators','document_unit_links','org_unit_members') order by name"
);
for (const r of t.rows) console.log(r.type.padEnd(6), r.name);
const cnt = await db.execute("select count(*) c from org_units");
console.log("org_units rows:", cnt.rows[0].c);
const viewCnt = await db.execute("select count(*) c from departments");
console.log("departments view rows:", viewCnt.rows[0].c);
const links = await db.execute("select count(*) c, sum(is_primary) p from lesson_node_links");
console.log("lesson_node_links:", links.rows[0].c, "primary:", links.rows[0].p);
const les = await db.execute("select count(*) c from lessons where node_id is not null and node_id <> ''");
console.log("lessons with node_id:", les.rows[0].c);
const docCols = await db.execute("pragma table_info(documents)");
console.log(
  "documents new cols:",
  docCols.rows.filter((r) => /visibility|effective_from|version_label|review_cycle|supersedes/.test(r.name)).map((r) => r.name).join(", ")
);
const nk = await db.execute("pragma table_info(node_leads)");
console.log("node_leads node_kind:", nk.rows.some((r) => r.name === "node_kind"));
