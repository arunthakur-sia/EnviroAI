import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const roles = await db.execute("select id, name_en, portals_json from roles order by name_en");
for (const r of roles.rows) {
  let list = null;
  try {
    list = JSON.parse(r.portals_json ?? "null");
  } catch {
    list = null;
  }
  console.log(`${String(r.name_en).padEnd(20)} ${Array.isArray(list) ? list.join(",") : "(default)"}`);
}
