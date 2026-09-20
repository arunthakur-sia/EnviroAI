// CR08 (Indices UI agent): exercises the group manager's exact update
// payload (null descriptions included) against /api/v1/indices/groups on a
// leftover probe group, printing status, body and elapsed time, then
// archives the group.
//   node scripts/dev-probes/cr08-indices-ui-update-check.mjs
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  redirect: "manual",
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const groups = (await (await fetch(`${BASE}/api/v1/indices/groups`, { headers: { cookie } })).json()).data;
const probe = groups.find((g) => /^probe_/.test(g.code) && g.isActive) ?? groups.find((g) => /^probe_/.test(g.code));
if (!probe) {
  console.log("no probe group to test with");
  process.exit(0);
}
console.log("testing on", probe.code, "active", probe.isActive);
const t0 = Date.now();
const res = await fetch(`${BASE}/api/v1/indices/groups`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    action: "update",
    id: probe.id,
    nameEn: `${probe.nameEn} renamed`,
    nameAr: probe.nameAr,
    descriptionEn: null,
    descriptionAr: null,
    colourToken: "info",
  }),
});
console.log("update", res.status, `${Date.now() - t0}ms`, (await res.text()).slice(0, 300));
if (probe.isActive) {
  const arch = await fetch(`${BASE}/api/v1/indices/groups`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "archive", id: probe.id, isActive: false }),
  });
  console.log("archive", arch.status);
}
