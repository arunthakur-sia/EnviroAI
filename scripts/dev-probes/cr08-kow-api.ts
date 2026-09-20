/* eslint-disable no-console */
// CR08 8: exercises the Knowledge of the Week API as the Super Admin and as
// a Contributor against the shared dev server and prints the envelopes.
//   npx tsx scripts/dev-probes/cr08-kow-api.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
  });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  console.log(`login ${email} -> ${res.status} cookie ${cookie ? "set" : "missing"}`);
  return cookie;
}

async function call(cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...((init.headers as Record<string, string>) ?? {}), cookie } });
  const text = await res.text();
  console.log(`${init.method ?? "GET"} ${path} -> ${res.status}\n  ${text.slice(0, 600)}`);
  return { status: res.status, text };
}

async function main() {
  const admin = await login("admin@npc.qa");
  const active = await call(admin, "/api/v1/knowledge-of-week?view=active");
  const card = JSON.parse(active.text).data as { resourceType: string; resourceId: string; weekStart: string } | null;
  if (card) {
    await call(admin, `/api/v1/knowledge-of-week?view=preview&type=${card.resourceType}&id=${card.resourceId}&week=${card.weekStart}`);
  }
  await call(admin, "/api/v1/knowledge-of-week?view=ids");
  await call(admin, "/api/v1/knowledge-of-week?view=schedule");
  const contributor = await login("analyst@npc.qa");
  await call(contributor, "/api/v1/knowledge-of-week?view=schedule");
  await call(contributor, "/api/v1/knowledge-of-week", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resourceType: "document", resourceId: "x", weekStart: "2030-01-07" }),
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
