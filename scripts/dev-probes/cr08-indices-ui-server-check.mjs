// CR08 (Indices UI agent): a timed, signed-in GET of the board and the index
// page on the shared dev server, to tell a hung server from a slow probe.
//   node scripts/dev-probes/cr08-indices-ui-server-check.mjs
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  redirect: "manual",
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
console.log("login", login.status);
for (const path of ["/en/indices", "/en/indices?group=governance", "/en/indices/egdi", "/en/settings?tab=indices"]) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(240000) });
    const html = await res.text();
    console.log(path, res.status, `${Date.now() - t0}ms`, `${Math.round(html.length / 1024)}KB`, html.includes('data-testid="group-switcher"') || html.includes('data-testid="index-page"') || html.includes("settings") ? "ok" : "unexpected body");
  } catch (e) {
    console.log(path, "failed", `${Date.now() - t0}ms`, String(e?.message ?? e).slice(0, 120));
  }
}
