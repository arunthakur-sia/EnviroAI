// Does the recipient list reach the request context at all?
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
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
  body: JSON.stringify({ email: "mohammed.alsulaiti@npc.qa", password: "Nexus!2026" }),
});
const res = await req("/api/v1/handover?mine=1");
const json = await res.json();
console.log("status", res.status);
console.log("mine:", json.data?.mine ? json.data.mine.id : null);
console.log("recipient rows:", (json.data?.recipient ?? []).length);
for (const r of json.data?.recipient ?? []) {
  console.log(`  ${r.id} status=${r.status} signedOffAt=${r.signedOffAt ?? "null"} person=${r.person?.nameEn}`);
}
if (json.error) console.log("error:", json.error);
