// CR08 4.1 (agent B): the entities register names (for responsibleEntityName
// matching in the index definitions) and a few sanity counts. Read-only.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
for (const r of await q(`select name_en, kind from entities order by name_en`)) console.log(r.name_en, "|", r.kind);
console.log("-- countries --", (await q(`select count(*) c from countries`))[0].c);
console.log("-- index_observations status counts --");
for (const r of await q(`select status, count(*) c from index_observations group by status`)) console.log(r.status, r.c);
db.close();
