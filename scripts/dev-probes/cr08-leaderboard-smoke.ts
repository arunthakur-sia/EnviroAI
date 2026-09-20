/* eslint-disable no-console */
// CR08 7: runs scripts/smoke-cr08-leaderboard.ts standalone against the
// shared dev server, with the same ctx shape scripts/smoke.ts will pass.
//   npx tsx scripts/dev-probes/cr08-leaderboard-smoke.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function loginCookie(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  const pairs: string[] = [];
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    pairs.push(sc.split(";")[0]);
  }
  return pairs.join("; ");
}

async function main() {
  const { createClient } = await import("@libsql/client");
  const path = await import("node:path");
  const db = createClient({
    url: `file:${path.resolve(process.cwd(), "data", "nexus.db").replace(/\\/g, "/")}`,
  });
  const cookie = await loginCookie("analyst@npc.qa");
  const adminCookie = await loginCookie("admin@npc.qa");
  let passed = 0;
  let failed = 0;
  const check = (name: string, ok: boolean, detail = "") => {
    if (ok) passed++;
    else failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` (${detail})` : ""}`);
  };
  const { run } = await import("../smoke-cr08-leaderboard");
  await run(check, { base: BASE, cookie, adminCookie, db });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
