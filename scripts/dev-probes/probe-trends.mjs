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
  body: JSON.stringify({ email: "analyst@enviroai.demo", password: "EnviroAI!2026" }),
});
const res = await req("/en/trends");
const html = await res.text();
console.log("status:", res.status, "len:", html.length);
console.log("has Radar by outcome:", html.includes("Radar by outcome"));
console.log("has Risk heat map:", html.includes("Risk heat map"));
console.log("has index tracker:", html.includes("International index tracker"));
console.log("has /en/trends/ link:", html.includes("/en/trends/"));
const err = /Application error|Internal Server Error|digest/.exec(html);
console.log("error marker:", err?.[0] ?? "none");
console.log(html.slice(0, 600).replace(/\s+/g, " "));
