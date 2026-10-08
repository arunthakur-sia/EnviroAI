// Cover the remaining report scope branches: signals (filters), ask
// (conversation), Arabic-only. Mock mode for determinism.
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
const adminJar = new Map(jar);
await req("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: true } }),
}).catch(() => {});
// analyst can't patch settings; login admin for the toggle
const jar2 = new Map();
async function reqAdmin(path, opts = {}) {
  const cookie = [...jar2.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), cookie },
    redirect: "manual",
  });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar2.set(k.trim(), v.join("="));
  }
  return res;
}
await reqAdmin("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@enviroai.demo", password: "EnviroAI!2026" }),
});
await reqAdmin("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: true } }),
});
await new Promise((r) => setTimeout(r, 400));

import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const conv = (
  await db.execute(
    "select c.id, c.title from ai_conversations c join users u on u.id=c.user_id where u.email='analyst@enviroai.demo' limit 1"
  )
).rows[0];
db.close();

async function run(name, client, scope, options) {
  const res = await client("/api/v1/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, options }),
  });
  const json = await res.json();
  if (!res.ok) return console.log(name, "CREATE FAILED", json.error);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await client(`/api/v1/reports/${json.data.id}`);
    const pj = await poll.json();
    if (pj.data?.status === "done") return console.log(name, "DONE:", pj.data.title, "items:", pj.data.itemCount);
    if (pj.data?.status === "failed") return console.log(name, "FAILED:", pj.data.error);
  }
  console.log(name, "TIMEOUT");
}

await run(
  "signals-ar",
  reqAdmin,
  { kind: "signals", ids: [], labelEn: "Workforce signals", labelAr: "إشارات القوى العاملة", filters: { outcome: "workforce" } },
  { audience: "working", language: "ar", summaryLength: "short", includeCharts: false, includeSources: true, includeLessons: false, includeSignals: true }
);
if (conv) {
  await run(
    "ask-answer",
    req,
    { kind: "ask", ids: [String(conv.id)], labelEn: String(conv.title ?? "Ask answer"), labelAr: "إجابة" },
    { audience: "working", language: "en", summaryLength: "short", includeCharts: false, includeSources: true, includeLessons: false, includeSignals: false }
  );
}
await reqAdmin("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: false } }),
});
console.log("done");
