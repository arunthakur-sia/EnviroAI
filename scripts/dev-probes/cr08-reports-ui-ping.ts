/* eslint-disable no-console */
// CR08 5 (Reports UI agent): is the shared dev server answering? Prints the
// status and the first bytes of the login API, an unauthenticated API and
// the login page.
//   npx tsx scripts/dev-probes/cr08-reports-ui-ping.ts
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function probe(label: string, url: string, init?: RequestInit) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    console.log(`${label}: ${res.status} in ${Date.now() - t0}ms, ${res.headers.get("content-type") ?? ""}\n  ${text.replace(/\s+/g, " ").slice(0, 400)}`);
  } catch (e) {
    console.log(`${label}: failed ${String((e as Error)?.message ?? e)}`);
  }
}

async function main() {
  await probe("GET /api/v1/report-builder (no cookie)", `${BASE}/api/v1/report-builder`);
  await probe("POST /api/v1/auth/login", `${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@enviroai.demo", password: "EnviroAI!2026" }),
  });
  await probe("GET /en/login", `${BASE}/en/login`);
}

main().then(() => process.exit(0));

// a module, so BASE stays local to this probe
export {};
