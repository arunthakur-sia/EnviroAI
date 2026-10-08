/* eslint-disable no-console */
// CR08 6: runs scripts/smoke-cr08-handover.ts standalone, the way
// scripts/smoke.ts section 19 will, so the module is verified before the
// coordinator wires it in.
import { createClient } from "@libsql/client";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function main() {
  const db = createClient({ url: `file:${path.join(process.cwd(), "data", "nexus.db").replace(/\\/g, "/")}` });
  const [cookie, adminCookie] = [await cookieFor("analyst@enviroai.demo"), await cookieFor("admin@enviroai.demo")];
  const mod = await import("../smoke-cr08-handover");
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];
  await mod.run(
    (name, ok, detail) => {
      if (ok) {
        pass++;
        console.log(`  ok   ${name}`);
      } else {
        fail++;
        failures.push(`${name}${detail ? ` (${detail})` : ""}`);
        console.log(`  FAIL ${name}${detail ? ` (${detail})` : ""}`);
      }
    },
    { base: BASE, cookie, adminCookie, db }
  );
  console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} checks`);
  if (failures.length) console.log("failures:\n - " + failures.join("\n - "));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
