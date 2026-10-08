/* eslint-disable no-console */
// Runs scripts/smoke-cr08-ask.ts standalone against the dev server, with the
// same ctx shape scripts/smoke.ts will pass once the module is wired in.
//   npx tsx scripts/dev-probes/cr08-ask-smoke-run.ts
import { createClient } from "@libsql/client";
import { run } from "../smoke-cr08-ask";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
    redirect: "manual",
  });
  const jar: string[] = [];
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    jar.push(sc.split(";")[0]);
  }
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  return jar.join("; ");
}

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const cookie = await cookieFor("analyst@enviroai.demo");
  const adminCookie = await cookieFor("admin@enviroai.demo");
  let passed = 0;
  let failed = 0;
  await run(
    (name, ok, detail) => {
      if (ok) passed++;
      else failed++;
      console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
    },
    { base: BASE, cookie, adminCookie, db }
  );
  db.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
