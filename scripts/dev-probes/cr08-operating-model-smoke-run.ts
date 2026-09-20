/* eslint-disable no-console */
// CR08 10.2 dev probe: runs scripts/smoke-cr08-operating-model.ts standalone
// against the shared dev server, the way scripts/smoke.ts will once the
// coordinator wires it in: a Contributor session, a Super Admin session, and
// the raw libsql client for counts.
//   npx tsx scripts/dev-probes/cr08-operating-model-smoke-run.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "Nexus!2026" }),
      });
      if (res.status === 200) {
        const raw = res.headers.get("set-cookie") ?? "";
        return raw
          .split(/,(?=\s*\w+=)/)
          .map((c) => c.split(";")[0].trim())
          .filter(Boolean)
          .join("; ");
      }
      console.log(`login ${email}: ${res.status} (attempt ${attempt})`);
    } catch (e) {
      console.log(`login ${email}: ${String(e).slice(0, 80)} (attempt ${attempt})`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`login ${email} failed`);
}

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const { run } = await import("../smoke-cr08-operating-model");
  const cookie = await login("analyst@npc.qa");
  const adminCookie = await login("admin@npc.qa");
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
  console.log(`\ncr08 operating model smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
