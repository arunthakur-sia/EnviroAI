// Quick functional probe: login as analyst, walk the main pages, run a search
// and an Ask stream. Prints status codes and key markers.
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

async function main() {
  // login
  let res = await req("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "analyst@npc.qa", password: "Nexus!2026" }),
  });
  console.log("login:", res.status);
  if (res.status !== 200) {
    console.log(await res.text());
    return;
  }

  const pages = [
    "/en/home",
    "/ar/home",
    "/en/vault",
    "/en/vault/collections",
    "/en/strategy",
    "/en/strategy?edition=nds2",
    "/en/statistics",
    "/en/statistics/releases",
    "/en/experts",
    "/en/ask",
    "/en/ask/communities",
    "/en/ask/open",
    "/en/lessons",
    "/en/foresight",
    "/en/profile",
    "/ar/vault",
    "/ar/strategy",
  ];
  for (const p of pages) {
    const r = await req(p);
    const text = await r.text();
    const err = /Application error|Internal Server Error|__next_error__/.test(text);
    console.log(`${p}: ${r.status}${err ? " !! ERROR MARKER" : ""} (${text.length}b)`);
  }

  // suggest + search
  res = await req("/api/v1/search/suggest?q=population&locale=en");
  const sugg = await res.json();
  console.log(
    "suggest population:",
    res.status,
    Object.entries(sugg.data ?? {}).map(([k, v]) => `${k}:${v.length}`).join(", ")
  );
  res = await req("/en/search?q=population%20growth");
  console.log("search page:", res.status, (await res.text()).length + "b");

  // ask stream (scoped small)
  res = await req("/api/v1/ai/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "What is the GDP growth target in NDS3?", locale: "en" }),
  });
  console.log("ask:", res.status, res.headers.get("content-type"));
  if (res.ok) {
    const text = await res.text();
    const finalEvent = text.includes("event: final");
    const sources = text.includes("event: sources");
    const deltas = (text.match(/event: delta/g) || []).length;
    console.log(`ask stream: sources=${sources} deltas=${deltas} final=${finalEvent}`);
    const m = /event: final\ndata: (.*)\n/.exec(text);
    if (m) {
      const data = JSON.parse(m[1]);
      console.log(
        "answer confidence:",
        data.confidence,
        "| citations:",
        data.citations?.length,
        "| first 140:",
        data.markdown?.slice(0, 140).replace(/\n/g, " ")
      );
    }
  } else {
    console.log(await res.text());
  }

  // daily card + notifications
  res = await req("/api/v1/notifications");
  console.log("notifications:", res.status, (await res.json()).data?.length);
}

main().catch((e) => console.error("PROBE FAIL", e));
