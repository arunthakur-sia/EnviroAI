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

async function ask(query, locale) {
  const res = await req("/api/v1/ai/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, locale }),
  });
  const text = await res.text();
  const m = /event: final\ndata: (.*)\n/.exec(text);
  if (!m) return console.log(`ASK "${query}": no final (status ${res.status})`);
  const data = JSON.parse(m[1]);
  const kinds = (data.citations ?? []).map((c) => `${c.resource_type}:${c.title?.slice(0, 30)}`);
  console.log(`\nASK (${locale}) "${query}"`);
  console.log(`  confidence=${data.confidence} | citations: ${kinds.join(" | ")}`);
  console.log(`  ${data.markdown?.slice(0, 300).replace(/\n/g, " ")}`);
}

await req("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "analyst@npc.qa", password: "Nexus!2026" }),
});

await ask("What is the current population of Qatar?", "en");
await ask("What is the unemployment rate in Qatar right now?", "en");
await ask("كم بلغ معدل التضخم في قطر مؤخراً؟", "ar");
await ask("What are the seven national outcomes of NDS3?", "en");
