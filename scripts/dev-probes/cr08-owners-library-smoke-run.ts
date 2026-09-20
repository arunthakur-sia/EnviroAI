/* eslint-disable no-console */
// CR08 9.1 (library surfaces): runs scripts/smoke-cr08-owners-library.ts on
// its own against the shared dev server, the way scripts/smoke.ts will.
//   npx tsx scripts/dev-probes/cr08-owners-library-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
  });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function main() {
  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  await db.execute("PRAGMA busy_timeout = 8000");
  const ctx = { base: BASE, cookie: await login("analyst@npc.qa"), adminCookie: await login("admin@npc.qa"), db };
  const { run } = await import("../smoke-cr08-owners-library");
  let pass = 0;
  let fail = 0;
  await run((name, ok, detail) => {
    if (ok) pass++;
    else fail++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  }, ctx);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
