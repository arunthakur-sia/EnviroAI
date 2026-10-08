/* eslint-disable no-console */
// CR08 9.1 dev probe: what the server actually returns for the pages the
// smoke module reads, with the status and the markers found.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-http.ts [path...]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
  });
  const raw = res.headers.get("set-cookie") ?? "";
  return raw
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const cookie = await login("admin@enviroai.demo");
  const paths = process.argv.slice(2);
  for (const path of paths) {
    const started = Date.now();
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    const text = await res.text();
    const marks = [
      'data-testid="owner-control"',
      'data-testid="owner-control-compact"',
      'data-role="project_owner"',
      'data-role="department_owner"',
      'data-role="custodian"',
      'data-testid="stakeholders-section"',
      'data-testid="node-hero"',
    ]
      .map((m) => `${m.replace(/data-(testid|role)="|"/g, "")}=${(text.match(new RegExp(m, "g")) ?? []).length}`)
      .join(" ");
    console.log(`${res.status} ${Date.now() - started}ms ${path}`);
    console.log(`   ${marks} bytes=${text.length}`);
    if (res.status !== 200) console.log(`   body: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
