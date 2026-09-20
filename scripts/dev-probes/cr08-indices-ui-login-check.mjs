// CR08 (Indices UI agent): prints the status and body of the seeded login
// with a well-formed JSON body (PowerShell's quoting mangles curl's), so a
// 500 on the shared dev server can be attributed before re-running probes.
//   node scripts/dev-probes/cr08-indices-ui-login-check.mjs
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const res = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  redirect: "manual",
});
const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 1200));
