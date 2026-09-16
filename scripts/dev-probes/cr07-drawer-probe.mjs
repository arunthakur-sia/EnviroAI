const BASE = "http://localhost:3000";
const login = await fetch(BASE + "/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const [p] = (await db.execute("select id, code from council_nodes where level='project' limit 1")).rows;
console.log("project:", p.code, p.id);

const t0 = Date.now();
const res = await fetch(`${BASE}/api/v1/council?view=project&id=${p.id}`, { headers: { cookie } });
console.log("status", res.status, "in", Date.now() - t0, "ms");
const json = await res.json();
if (json.error) console.log("error:", json.error);
if (json.data) {
  console.log("keys:", Object.keys(json.data).join(", "));
  console.log("indicators:", json.data.indicators?.length, "activities:", json.data.activities?.length,
    "milestones:", json.data.milestones?.length, "stakeholders:", json.data.stakeholders?.length,
    "siblings:", json.data.siblings?.length, "risks:", json.data.risks?.length);
}
