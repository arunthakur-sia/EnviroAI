// CR08 (Indices UI agent): puts an index back into a group through the
// members API after an interrupted drag probe.
//   node scripts/dev-probes/cr08-indices-ui-restore.mjs <indexCode> <intoGroup> <outOfGroup>
// e.g. node scripts/dev-probes/cr08-indices-ui-restore.mjs wgi_stability governance human
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const [indexCode, into, outOf] = process.argv.slice(2);
if (!indexCode || !into) {
  console.log("usage: <indexCode> <intoGroup> [outOfGroup]");
  process.exit(1);
}
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  redirect: "manual",
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const groups = (await (await fetch(`${BASE}/api/v1/indices/groups`, { headers: { cookie } })).json()).data;
const indices = (await (await fetch(`${BASE}/api/v1/indices`, { headers: { cookie } })).json()).data.indices;
const index = indices.find((i) => i.code === indexCode);
if (!index) {
  console.log("no such index", indexCode);
  process.exit(1);
}
const writes = [];
const g1 = groups.find((g) => g.code === into);
if (g1 && !g1.memberIds.includes(index.id)) writes.push({ groupId: g1.id, indexIds: [index.id, ...g1.memberIds] });
const g2 = outOf ? groups.find((g) => g.code === outOf) : null;
if (g2 && g2.memberIds.includes(index.id)) writes.push({ groupId: g2.id, indexIds: g2.memberIds.filter((id) => id !== index.id) });
if (!writes.length) {
  console.log("nothing to restore");
  process.exit(0);
}
const res = await fetch(`${BASE}/api/v1/indices/groups/members`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ groups: writes }),
});
console.log("restore", res.status, await res.text());
