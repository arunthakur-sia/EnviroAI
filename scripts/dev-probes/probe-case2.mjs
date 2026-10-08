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
  body: JSON.stringify({ email: "admin@enviroai.demo", password: "EnviroAI!2026" }),
});
await req("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: true } }),
});
await new Promise((r) => setTimeout(r, 400));
const res = await req("/api/v1/ai/analyst", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "How many targets are in NES3?", locale: "en" }),
});
const text = await res.text();
const m = /event: final\ndata: (.*)\n/.exec(text);
const final = m ? JSON.parse(m[1]) : null;
console.log("markdown:\n", final?.markdown);
await req("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: false } }),
});
