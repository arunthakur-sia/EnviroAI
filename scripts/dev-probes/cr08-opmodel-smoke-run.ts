/* eslint-disable no-console */
// CR08 10 dev probe: runs scripts/smoke-cr08-opmodel.ts standalone against the
// shared dev server, the way scripts/smoke.ts will once the coordinator wires
// it in: a Contributor session, a Super Admin session, and the raw libsql
// client for counts.
//   npx tsx scripts/dev-probes/cr08-opmodel-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
  });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  const raw = res.headers.get("set-cookie") ?? "";
  return raw
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const { run } = await import("../smoke-cr08-opmodel");
  const [cookie, adminCookie] = await Promise.all([login("analyst@enviroai.demo"), login("admin@enviroai.demo")]);
  let passed = 0;
  let failed = 0;
  await run(
    (name, ok, detail) => {
      if (ok) passed++;
      else failed++;
      console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    },
    { base: BASE, cookie, adminCookie, db: rawClient }
  );
  console.log(`\ncr08 opmodel smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
