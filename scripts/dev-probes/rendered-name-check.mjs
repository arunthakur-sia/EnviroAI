/* eslint-disable no-console */
// Does the running product render the name on the pages that show this person?
//   node scripts/dev-probes/rendered-name-check.mjs "New Name" "Old Name"
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const [wanted, unwanted] = process.argv.slice(2);

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
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});

const pages = [
  "/en/hr/people",
  "/en/experts",
  "/en/organisation",
  "/ar/hr/people",
  "/ar/experts",
  "/en/hr",
];
let bad = 0;
for (const p of pages) {
  const res = await req(p);
  const html = await res.text();
  const has = wanted ? html.includes(wanted) : false;
  const old = unwanted ? html.includes(unwanted) : false;
  if (old) bad++;
  console.log(`${String(res.status).padEnd(4)} ${p.padEnd(22)} new name: ${has ? "yes" : "no "}   old name: ${old ? "STILL THERE" : "gone"}`);
}
console.log(bad ? `\n${bad} page(s) still show the old name` : "\nno page shows the old name");
process.exit(bad ? 1 : 0);
