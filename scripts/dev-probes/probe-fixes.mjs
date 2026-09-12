const BASE = "http://localhost:3000";
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
  body: JSON.stringify({ email: "analyst@npc.qa", password: "Nexus!2026" }),
});

// search debug
for (const q of ["population growth", "population", "CPI inflation"]) {
  const r = await req(`/en/search?q=${encodeURIComponent(q)}`);
  const html = await r.text();
  const zero = html.includes("No NPC source yet");
  const countMatch = /(\d+) results/.exec(html);
  console.log(`search "${q}": status=${r.status} zero=${zero} count=${countMatch?.[1] ?? "?"}`);
}

// quiet mode debug
let p = await req("/api/v1/profile", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ quietMode: true }),
});
console.log("patch quiet:", p.status, JSON.stringify(await p.json()));
const home = await req("/en/home");
const html = await home.text();
console.log("home has footprint:", html.includes("Your knowledge footprint"), "| has points ring context:", html.includes("levelName"));
await req("/api/v1/profile", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ quietMode: false }),
});
