// CR08: does Home still render with the new blocks, in both locales?
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const jar = new Map();
async function req(path, opts = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers ?? {}), cookie }, redirect: "manual" });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  return res;
}
await req("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@enviroai.demo", password: "EnviroAI!2026" }),
});
for (const locale of ["en", "ar"]) {
  const res = await req(`/${locale}/home`);
  const html = await res.text();
  const has = (s) => (html.includes(s) ? "yes" : "NO");
  console.log(
    `/${locale}/home ${res.status} | kow strip ${has("kow-strip")} | leaderboard ${has("home-leaderboard")} | handover banner ${has("handover-banner")} | rail groups ${has("rail-group-knowledge")} | ask button ${has("ask-bar-button")}`
  );
  if (res.status !== 200) console.log(html.slice(0, 600));
}
