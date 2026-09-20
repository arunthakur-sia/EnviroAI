/* eslint-disable no-console */
// CR08 1: runs scripts/smoke-cr08-org.ts on its own against the shared dev
// server, with the same ctx shape scripts/smoke.ts will pass it.
//   npx tsx scripts/dev-probes/cr08-org-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import { createClient } from "@libsql/client";
import { run } from "../smoke-cr08-org";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const raw = res.headers.get("set-cookie") ?? "";
  return raw
    .split(/,(?=[^;]+=)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  await db.execute("PRAGMA busy_timeout = 8000");
  const [cookie, adminCookie] = await Promise.all([cookieFor("analyst@npc.qa"), cookieFor("admin@npc.qa")]);
  let pass = 0;
  let fail = 0;
  await run(
    (name, ok, detail) => {
      if (ok) pass++;
      else fail++;
      console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
    },
    { base: BASE, cookie, adminCookie, db }
  );
  console.log(`\n${pass} passed, ${fail} failed`);
  db.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
