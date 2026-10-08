/* eslint-disable no-console */
// Runs scripts/smoke-cr08-experts.ts on its own against the shared dev server
// with the same ctx shape scripts/smoke.ts provides.
//   npx tsx scripts/dev-probes/cr08-experts-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import { createClient } from "@libsql/client";
import { run } from "../smoke-cr08-experts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
    redirect: "manual",
  });
  const jar = new Map<string, string>();
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const cookie = await login("analyst@enviroai.demo");
  const adminCookie = await login("admin@enviroai.demo");
  const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
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
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
