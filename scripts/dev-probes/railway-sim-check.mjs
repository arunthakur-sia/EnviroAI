/* eslint-disable no-console */
// Signs in against a running instance and opens the pages the readiness note
// names, asserting each renders its own content rather than a shell or an error.
//   node scripts/dev-probes/railway-sim-check.mjs http://localhost:4000
const BASE = process.argv[2] ?? "http://localhost:4000";

const jar = new Map();
const req = async (path, opts = {}) => {
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
};

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const health = await req("/api/health");
const healthJson = await health.json().catch(() => null);
check("health answers 200 with ok:true", health.status === 200 && healthJson?.ok === true, JSON.stringify(healthJson));
check("health names the data directory", Boolean(healthJson?.dataDir), String(healthJson?.dataDir ?? ""));

const login = await req("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});
check("admin@npc.qa signs in", login.status === 200, `status ${login.status}`);
check("the session cookie came back", jar.has("nexus_session"));

const pages = [
  ["/en/home", ["data-testid=\"home", "SiaNexus"]],
  ["/en/vault", ["Institutional Memory", "shelf"]],
  ["/en/ask", ["Ask"]],
  ["/ar/home", ["dir=\"rtl\""]],
];
for (const [url, needles] of pages) {
  const res = await req(url);
  const html = res.status === 200 ? await res.text() : "";
  const found = needles.filter((n) => html.includes(n));
  check(`${url} renders`, res.status === 200 && html.length > 5000, `status ${res.status}, ${html.length} bytes`);
  check(`${url} carries its own content`, found.length > 0, found.join(", ") || "none of the expected markers");
}

// a file served from the restored volume, proving uploads came across
const docs = await req("/api/v1/documents?limit=1");
const docsJson = await docs.json().catch(() => null);
const first = docsJson?.data?.documents?.[0] ?? docsJson?.data?.[0] ?? null;
check("the documents API answers", docs.status === 200 && Boolean(first), `status ${docs.status}`);
if (first?.id) {
  const dl = await req(`/api/v1/documents/${first.id}/download`);
  check("a stored file downloads from the restored volume", dl.status === 200, `status ${dl.status}`);
}

console.log(`\n== ${pass} passed, ${fail} failed ==`);
process.exit(fail ? 1 : 0);
