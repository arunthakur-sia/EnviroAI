// CR08 6.3: the Home banner for a handover recipient who has not signed off.
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const { createClient } = await import("@libsql/client");
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const rows = (
  await db.execute(
    "select distinct u.email from handover_learning_paths p join users u on u.id = p.recipient_user_id where p.signed_off_at is null limit 3"
  )
).rows;
db.close();
if (!rows.length) {
  console.log("no unsigned recipient in the database");
  process.exit(0);
}
for (const row of rows) {
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
  const login = await req("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: String(row.email), password: "EnviroAI!2026" }),
  });
  if (login.status !== 200) {
    console.log(`${row.email}: login ${login.status}`);
    continue;
  }
  const res = await req("/en/home");
  const html = await res.text();
  console.log(
    `${row.email}: /en/home ${res.status} | banner ${html.includes("handover-banner") ? "yes" : "NO"}`
  );
}
