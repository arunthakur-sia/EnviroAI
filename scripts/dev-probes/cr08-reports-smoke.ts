/* eslint-disable no-console */
// CR08 5: runs scripts/smoke-cr08-reports.ts on its own against the shared
// dev server, with a Contributor and a Super Admin session, the way
// scripts/smoke.ts will once the coordinator wires the module in.
//   npx tsx scripts/dev-probes/cr08-reports-smoke.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import { createClient } from "@libsql/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  const cookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const cookie = await login("analyst@npc.qa");
  const adminCookie = await login("admin@npc.qa");
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const { run } = await import("../smoke-cr08-reports");
  let passed = 0;
  let failed = 0;
  await run(
    (name, ok, detail) => {
      if (ok) passed += 1;
      else failed += 1;
      console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
    },
    { base: BASE, cookie, adminCookie, db }
  );
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
