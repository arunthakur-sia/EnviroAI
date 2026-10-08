// Does the CR05 handover PATCH still move the completion percentage?
import { createClient } from "@libsql/client";
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });

const jar = new Map();
const req = async (path, opts = {}) => {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers ?? {}), cookie }, redirect: "manual" });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  return res;
};
await req("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "hr@enviroai.demo", password: "EnviroAI!2026" }),
});

const h = (
  await db.execute(
    `select h.id, h.completion_pct from handovers h
     where h.status != 'complete'
       and (select count(*) from handover_items i where i.handover_id = h.id and i.status = 'pending' and coalesce(i.in_scope,1)=1) > 0
     limit 1`
  )
).rows[0];
const item = (
  await db.execute({
    sql: "select id, status, item_kind, in_scope from handover_items where handover_id = ? and status = 'pending' and coalesce(in_scope,1)=1 limit 1",
    args: [h.id],
  })
).rows[0];
console.log("handover", String(h.id).slice(0, 10), "pct", h.completion_pct);
console.log("item", String(item.id).slice(0, 10), item.item_kind, "status", item.status, "inScope", item.in_scope);

const res = await req("/api/v1/hr/handovers", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ handoverId: String(h.id), action: "item", itemId: String(item.id), status: "reassigned" }),
});
const json = await res.json();
console.log("PATCH", res.status, JSON.stringify(json).slice(0, 200));

const after = (
  await db.execute({ sql: "select status from handover_items where id = ?", args: [item.id] })
).rows[0];
const hAfter = (
  await db.execute({ sql: "select completion_pct from handovers where id = ?", args: [h.id] })
).rows[0];
console.log("item status now:", after.status, "| handover pct now:", hAfter.completion_pct);
db.close();
