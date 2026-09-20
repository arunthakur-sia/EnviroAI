// CR08: status of every route the change request adds or changes, in both
// locales, as the Super Admin. Cheap health check while agents work.
//   node scripts/dev-probes/cr08-routes.mjs
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

const jar = new Map();
async function req(path, opts = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), cookie },
    redirect: "manual",
  });
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
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});

const routes = [
  "/home",
  "/vault",
  "/strategy",
  "/council-strategy",
  "/statistics",
  "/indices",
  "/trends",
  "/processes",
  "/studies",
  "/lessons",
  "/podcast",
  "/reports",
  "/experts",
  "/organisation",
  "/operating-model",
  "/hr",
  "/hr/handovers",
  "/leaderboard",
  "/handover/mine",
  "/inbox",
  "/hall-of-knowledge",
  "/ask",
  "/settings",
  "/profile",
  "/search?q=qatar",
];

const rows = [];
for (const locale of ["en", "ar"]) {
  for (const r of routes) {
    const url = `/${locale}${r}`;
    const t0 = Date.now();
    let status = 0;
    try {
      const res = await req(url);
      status = res.status;
    } catch (e) {
      status = -1;
    }
    rows.push({ url, status, ms: Date.now() - t0 });
  }
}
const bad = rows.filter((r) => r.status !== 200);
for (const r of rows) {
  if (r.status !== 200) console.log(`${String(r.status).padStart(4)} ${r.url} (${r.ms}ms)`);
}
const slow = rows.filter((r) => r.ms > 4000).sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log(`\n${rows.length - bad.length}/${rows.length} routes answered 200`);
if (slow.length) {
  console.log("slowest:");
  for (const s of slow) console.log(`  ${s.ms}ms ${s.url}`);
}
