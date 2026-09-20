// CR08 (Indices UI agent): when the shared dev server answers a route with
// an error, print the status and the error text Next embeds in the body, so
// the failing module can be attributed without the server console.
//   node scripts/dev-probes/cr08-indices-ui-body-check.mjs [/en/indices]
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const path = process.argv[2] ?? "/en/indices";
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  redirect: "manual",
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const t0 = Date.now();
const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(300000) });
const html = await res.text();
console.log(path, res.status, `${Date.now() - t0}ms`, `${Math.round(html.length / 1024)}KB`);
if (res.status !== 200) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const at = text.search(/Error|error|Module not found|Failed to compile|Unexpected token/);
  console.log(text.slice(Math.max(0, at - 200), at + 1800));
} else {
  const marker = ['data-testid="group-switcher"', 'data-testid="index-page"'].find((m) => html.includes(m));
  console.log("marker:", marker ?? "none");
}
