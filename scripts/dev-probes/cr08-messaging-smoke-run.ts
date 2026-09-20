/* eslint-disable no-console */
// Runs scripts/smoke-cr08-messaging.ts standalone against the dev server,
// with the same ctx shape scripts/smoke.ts builds (Contributor and Super
// Admin cookies, a raw libsql client).
//   npx tsx scripts/dev-probes/cr08-messaging-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function loginCookie(email: string): Promise<string> {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const jar = new Map<string, string>();
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  if (!jar.size) throw new Error(`login failed for ${email}: ${res.status}`);
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const ctx = {
    base: BASE,
    cookie: await loginCookie("analyst@npc.qa"),
    adminCookie: await loginCookie("admin@npc.qa"),
    db,
  };
  let passed = 0;
  let failed = 0;
  const { run } = await import("../smoke-cr08-messaging");
  await run((name, ok, detail) => {
    if (ok) passed++;
    else failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  }, ctx);
  console.log(`\n${passed} passed, ${failed} failed`);
  db.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
