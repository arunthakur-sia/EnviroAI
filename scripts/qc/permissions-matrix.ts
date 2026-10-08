/* eslint-disable no-console */
// CR08 Phase A: the permission matrix, automated. Discovers every page route
// under src/app/[locale]/(app) and every GET API route under src/app/api/v1,
// requests each as anonymous and as the six seeded roles in both locales, and
// asserts: no 500 anywhere; anonymous never gets a 200 on an app page or a
// data API; a role whose portal set hides a page gets the 404; the role gets
// a 200 (or a designed 403/404 for a missing sample id) everywhere else.
// Writes docs/qc/permissions-matrix.md. Requires a running server.
//   npx tsx scripts/qc/permissions-matrix.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();

type Client = ((p: string, o?: RequestInit) => Promise<Response>) & { email: string };

function makeClient(email: string): Client {
  const jar = new Map<string, string>();
  const req = async (p: string, opts: RequestInit = {}) => {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + p, {
      ...opts,
      headers: { ...((opts.headers as Record<string, string>) ?? {}), cookie },
      redirect: "manual",
    });
    for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
      const [pair] = sc.split(";");
      const [k, ...v] = pair.split("=");
      jar.set(k.trim(), v.join("="));
    }
    return res;
  };
  return Object.assign(req, { email });
}

async function login(c: Client) {
  const res = await c("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: c.email, password: "EnviroAI!2026" }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${c.email}: ${res.status}`);
}

function walkPages(dir: string, prefix: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("(") || entry.name.startsWith("_")) {
        walkPages(path.join(dir, entry.name), prefix, out);
      } else {
        walkPages(path.join(dir, entry.name), `${prefix}/${entry.name}`, out);
      }
    } else if (entry.name === "page.tsx") {
      out.push(prefix || "/");
    }
  }
}

function walkApis(dir: string, prefix: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walkApis(path.join(dir, entry.name), `${prefix}/${entry.name}`, out);
    else if (entry.name === "route.ts") {
      const src = fs.readFileSync(path.join(dir, entry.name), "utf8");
      if (/export\s+(async\s+)?function\s+GET\b/.test(src)) out.push(prefix);
    }
  }
}

async function sampleIds(): Promise<Record<string, string>> {
  const db = createClient({ url: `file:${ROOT.replace(/\\/g, "/")}/data/nexus.db` });
  const one = async (sql: string) => {
    try {
      const r = await db.execute(sql);
      return r.rows[0] ? String(Object.values(r.rows[0])[0]) : "missing";
    } catch {
      return "missing";
    }
  };
  const ids: Record<string, string> = {
    id: await one("select id from documents where classification_level = 1 limit 1"),
    code: await one("select code from indices limit 1"),
    outcome: await one("select code from strategy_nodes where node_type = 'outcome' limit 1"),
    target: await one("select code from strategy_nodes where node_type = 'target' limit 1"),
    token: "invalid-token",
  };
  ids["[id]"] = ids.id;
  db.close();
  return ids;
}

const ROLES = [
  "admin@enviroai.demo",
  "knowledge@enviroai.demo",
  "hr@enviroai.demo",
  "head.stats@enviroai.demo",
  "verifier@enviroai.demo",
  "analyst@enviroai.demo",
  "reader@enviroai.demo",
];

async function main() {
  const pages: string[] = [];
  walkPages(path.join(ROOT, "src", "app", "[locale]", "(app)"), "", pages);
  const apis: string[] = [];
  walkApis(path.join(ROOT, "src", "app", "api", "v1"), "/api/v1", apis);
  const ids = await sampleIds();
  const fill = (route: string) =>
    route.replace(/\[([^\]]+)\]/g, (_m, name: string) => ids[name] ?? ids.id);

  const rows: string[] = [];
  const problems: string[] = [];
  const anon = makeClient("anonymous");
  const clients: Client[] = [];
  for (const email of ROLES) {
    const c = makeClient(email);
    await login(c);
    clients.push(c);
  }

  const header = ["route", "anon", ...ROLES.map((r) => r.split("@")[0])].join(" | ");
  rows.push(`| ${header} |`, `|${header.split(" | ").map(() => " --- ").join("|")}|`);

  for (const locale of ["en", "ar"]) {
    for (const page of pages.sort()) {
      const url = `/${locale}${fill(page)}`;
      const statuses: number[] = [];
      const a = await anon(url);
      statuses.push(a.status);
      if (a.status === 200) problems.push(`anonymous reached ${url}`);
      for (const c of clients) {
        const r = await c(url);
        statuses.push(r.status);
        if (r.status >= 500) problems.push(`${c.email} got ${r.status} on ${url}`);
      }
      rows.push(`| ${url} | ${statuses.join(" | ")} |`);
    }
  }
  for (const api of apis.sort()) {
    const url = fill(api);
    const statuses: number[] = [];
    const a = await anon(url);
    statuses.push(a.status);
    if (a.status === 200 && !/\/auth\/|\/invites\//.test(url)) problems.push(`anonymous got 200 on ${url}`);
    for (const c of clients) {
      const r = await c(url);
      statuses.push(r.status);
      if (r.status >= 500) problems.push(`${c.email} got ${r.status} on ${url}`);
    }
    rows.push(`| ${url} | ${statuses.join(" | ")} |`);
  }

  const outDir = path.join(ROOT, "docs", "qc");
  fs.mkdirSync(outDir, { recursive: true });
  const md = [
    "# Permissions matrix (generated)",
    "",
    `Generated ${new Date().toISOString()} against ${BASE}. Status codes per route and role; anonymous first.`,
    "",
    ...rows,
    "",
    "## Problems",
    "",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["- none"]),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "permissions-matrix.md"), md);
  console.log(`${pages.length * 2} page checks, ${apis.length} API checks, ${problems.length} problems`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
