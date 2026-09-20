/* eslint-disable no-console */
// CR08 9 verification helper: signs in over the API and pulls every page the
// Playwright probe visits so the shared dev server compiles them before the
// browser run, which otherwise spends its whole budget waiting on a first
// compile.
//   npx tsx scripts/dev-probes/cr08-messaging-warm.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

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
  const who = process.env.WARM_EMAIL ?? "analyst@npc.qa";
  const cookie = await loginCookie(who);
  const paths = [
    "/en/home",
    "/ar/home",
    "/en/inbox",
    "/ar/inbox",
    "/en/inbox/demo",
    "/ar/inbox/demo",
    "/en/profile",
    "/ar/profile",
    "/api/v1/messages",
    "/api/v1/people?q=al",
  ];
  for (const p of paths) {
    const t0 = Date.now();
    const res = await fetch(BASE + p, { headers: { cookie } });
    await res.text();
    console.log(`${String(res.status).padEnd(4)} ${String(Date.now() - t0).padStart(7)}ms  ${p}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
