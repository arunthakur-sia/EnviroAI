/* eslint-disable no-console */
// CR08 6: prints the Next dev error behind a 500.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function show(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  console.log("=== ", path, res.status, text.length);
  const m = text.match(/"message":"((?:[^"\\]|\\.)*)"/g) ?? [];
  for (const x of m.slice(0, 6)) console.log("  ", x.slice(0, 400).replace(/\\n/g, "\n   "));
  const stack = text.match(/Error: ([^<"]{5,300})/g) ?? [];
  for (const x of stack.slice(0, 6)) console.log("  stack:", x.slice(0, 300));
  if (!m.length && !stack.length) console.log("  body:", text.slice(0, 600));
}

async function main() {
  await show("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "hr@npc.qa", password: "Nexus!2026" }),
  });
  await show("/api/v1/notifications");
  await show("/en/login");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
