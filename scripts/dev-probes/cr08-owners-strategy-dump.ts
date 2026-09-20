/* eslint-disable no-console */
// CR08 9.1 dev probe: which testids a page actually renders, to see what the
// server chose to render for a given URL.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-dump.ts <path>
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
  });
  const raw = res.headers.get("set-cookie") ?? "";
  return raw
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const cookie = await login("admin@npc.qa");
  const path = process.argv[2];
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  const text = await res.text();
  const ids = new Map<string, number>();
  for (const m of text.matchAll(/data-testid=\\?"([^"\\]+)/g)) {
    ids.set(m[1], (ids.get(m[1]) ?? 0) + 1);
  }
  console.log(`${res.status} ${path} bytes=${text.length}`);
  console.log([...ids.entries()].map(([k, v]) => `${k}:${v}`).join("  "));
  const title = text.match(/<h1[^>]*>([\s\S]{0,160}?)<\/h1>/);
  console.log(`h1: ${title ? title[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "-"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
