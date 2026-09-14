import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const owners = await db.execute("select count(distinct nl.node_id) c from node_leads nl join strategy_nodes n on n.id = nl.node_id join strategy_editions e on e.id = n.edition_id where e.code='nds3' and n.node_type='outcome' and nl.lead_kind='department' and nl.role='lead'");
const experts = await db.execute("select count(*) c from node_stakeholders ns join strategy_nodes n on n.id = ns.node_id where n.node_type='outcome' and ns.role='expert'");
const heads = await db.execute("select count(*) c from departments where head_user_id is not null");
console.log("outcome department owners:", owners.rows[0].c);
console.log("direct outcome experts:", experts.rows[0].c);
console.log("departments with heads:", heads.rows[0].c, "/ 10");
