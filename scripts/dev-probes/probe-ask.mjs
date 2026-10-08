// Focused Ask probes: EN question, AR cross-lingual question, low-confidence path.
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
  if (!m) {
    console.log(`ASK "${query}": no final event; status ${res.status}`);
    return;
  }
  const data = JSON.parse(m[1]);
  console.log(`\nASK (${locale}) "${query}"`);
  console.log(`  confidence=${data.confidence} citations=${data.citations?.length} experts=${data.suggestedExperts?.length}`);
  console.log(`  ${data.markdown?.slice(0, 260).replace(/\n/g, " ")}`);
}

async function main() {
  await req("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "analyst@enviroai.demo", password: "EnviroAI!2026" }),
  });
  await ask("What is the GDP growth target in NES3?", "en");
  await ask("ما هي مستهدفات النمو الاقتصادي في استراتيجية التنمية الوطنية الثالثة؟", "ar");
  await ask("What is the annual budget of the Ministry of Magic?", "en");
}

main().catch((e) => console.error("FAIL", e));
