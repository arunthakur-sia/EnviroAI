// CR05 planning probe: current owner_entity_name values, departments, node counts.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const owners = await q(
  "select owner_entity_name, count(*) c from strategy_nodes where owner_entity_name is not null and owner_entity_name != '' group by owner_entity_name order by c desc"
);
console.log("owner_entity_name values:");
for (const r of owners) console.log(` ${r.c}  ${r.owner_entity_name}`);

const deps = await q("select id, code, name_en, head_user_id from departments order by code");
console.log("\ndepartments:");
for (const r of deps) console.log(` ${r.code}  ${r.name_en}  head=${r.head_user_id ? "y" : "-"}`);

const nodes = await q(
  "select node_type, count(*) c from strategy_nodes where edition_id=(select id from strategy_editions where code='nds3') group by node_type"
);
console.log("\nnds3 node types:", nodes.map((r) => `${r.node_type}=${r.c}`).join(" "));

const users = await q(
  "select u.id, u.email, u.name_en, u.department_id, r.name_en role from users u join roles r on r.id=u.role_id where u.deleted_at is null order by u.email"
);
console.log("\nusers:");
for (const r of users) console.log(` ${r.email}  ${r.name_en}  role=${r.role}  dept=${r.department_id ? "y" : "-"}`);

const roles = await q("select id, name_en, is_system from roles order by name_en");
console.log("\nroles:");
for (const r of roles) console.log(` ${r.name_en}  system=${r.is_system}`);

const experts = await q("select count(*) c, sum(case when user_id is not null then 1 else 0 end) internal from experts");
console.log("\nexperts:", JSON.stringify(experts[0]));

const docsOwned = await q(
  "select owner_user_id, count(*) c from documents where deleted_at is null and owner_user_id is not null group by owner_user_id order by c desc limit 8"
);
console.log("\ntop document owners:", docsOwned.map((r) => `${r.owner_user_id.slice(0, 6)}=${r.c}`).join(" "));
db.close();
