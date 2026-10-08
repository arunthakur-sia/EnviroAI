/* eslint-disable no-console */
// CR08 5 (Reports UI agent): runs scripts/smoke-cr08-reports-ui.ts standalone
// the way scripts/smoke.ts will (a Contributor cookie, the Super Admin
// cookie, a libsql client), so the module is proven before the coordinator
// wires it.
//   npx tsx scripts/dev-probes/cr08-reports-ui-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import { createClient } from "@libsql/client";
import { run } from "../smoke-cr08-reports-ui";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
    redirect: "manual",
  });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  const set = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return set.map((sc) => sc.split(";")[0]).join("; ");
}

async function main() {
  const cookie = await cookieFor("analyst@enviroai.demo");
  const adminCookie = await cookieFor("admin@enviroai.demo");
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  let passed = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    if (ok) passed++;
    else failures.push(`${name}${detail ? ` (${detail})` : ""}`);
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
  };
  await run(check, { base: BASE, cookie, adminCookie, db });
  db.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
