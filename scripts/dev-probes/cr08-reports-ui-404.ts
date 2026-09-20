/* eslint-disable no-console */
// CR08 5 (Reports UI agent): what an unknown report id and a hidden portal
// actually answer. A page that streams (a loading.tsx Suspense boundary
// flushes the shell first) cannot change its status after the flush, so
// notFound() inside the page renders the friendly 404 UI inside a 200, while
// notFound() in the LAYOUT gate (requirePortal) still answers a real 404.
//   npx tsx scripts/dev-probes/cr08-reports-ui-404.ts
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const set = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return set.map((sc) => sc.split(";")[0]).join("; ");
}

async function show(label: string, url: string, cookie: string) {
  const res = await fetch(url, { headers: { cookie }, redirect: "manual" });
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`\n${label}\n  status ${res.status}, ${html.length} bytes`);
  console.log(`  renders a report page: ${html.includes('data-testid="report-page"')}`);
  console.log(`  text: ${text.slice(0, 300)}`);
}

async function main() {
  const cookie = await cookieFor("analyst@npc.qa");
  await show("unknown report id", `${BASE}/en/reports/01NOTAREPORT00000000000000`, cookie);
  await show("unknown route under reports", `${BASE}/en/reports/nope/deeper`, cookie);
  await show("a real published report", `${BASE}/en/reports/01M2WTABGTPRD4Q0VE5TW78RWF`, cookie);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
