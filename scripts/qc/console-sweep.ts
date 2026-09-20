/* eslint-disable no-console */
// CR08 Phase A runtime hygiene: opens every page route in both locales as the
// Super Admin in system Edge, captures console errors and warnings, page
// errors, failed requests and 404 assets, and writes docs/qc/console-sweep.md.
// Exit code 1 when anything was captured. Requires a running server.
//   npx tsx scripts/qc/console-sweep.ts [--role reader@npc.qa] [--only /vault]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@libsql/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const args = process.argv.slice(2);
const role = args.includes("--role") ? args[args.indexOf("--role") + 1] : "admin@npc.qa";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

/** Console noise that is not ours: browser extension chatter, Next dev HMR. */
const IGNORE = [
  /Download the React DevTools/,
  /\[Fast Refresh\]/,
  /webpack-hmr/,
  /_next\/static\/chunks\/.*hot-update/,
];

function walkPages(dir: string, prefix: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("(") || entry.name.startsWith("_")) walkPages(path.join(dir, entry.name), prefix, out);
      else walkPages(path.join(dir, entry.name), `${prefix}/${entry.name}`, out);
    } else if (entry.name === "page.tsx") out.push(prefix || "/");
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
  db.close();
  return ids;
}

async function main() {
  const pages: string[] = [];
  walkPages(path.join(ROOT, "src", "app", "[locale]", "(app)"), "", pages);
  const ids = await sampleIds();
  const fill = (route: string) => route.replace(/\[([^\]]+)\]/g, (_m, n: string) => ids[n] ?? ids.id);

  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const findings: { url: string; kind: string; text: string }[] = [];
  let current = "";
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const text = m.text();
    if (IGNORE.some((re) => re.test(text))) return;
    findings.push({ url: current, kind: `console.${m.type()}`, text: text.slice(0, 300) });
  });
  page.on("pageerror", (e) => findings.push({ url: current, kind: "pageerror", text: e.message.slice(0, 300) }));
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText === "net::ERR_ABORTED") return;
    findings.push({ url: current, kind: "requestfailed", text: `${r.url()} ${r.failure()?.errorText ?? ""}`.slice(0, 300) });
  });
  page.on("response", (r) => {
    if (r.status() === 404 && /\/_next\/|\/fonts\/|\/brand\/|\.(png|svg|woff2|css|js)(\?|$)/.test(r.url())) {
      findings.push({ url: current, kind: "asset404", text: r.url().slice(0, 300) });
    }
  });

  // sign in through the API: clicking a submit button whose handler has not
  // hydrated does nothing, and the login screen is not what is being swept
  const auth = await ctx.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: role, password: "Nexus!2026" },
    timeout: 120000,
  });
  if (!auth.ok()) throw new Error(`login failed: ${auth.status()}`);
  // take the Knowledge of the Week reveal once, as a person would, so it does
  // not sit over every page that follows
  await page.goto(`${BASE}/en/home`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const kowClose = page.locator('[data-testid="kow-reveal-close"]');
  if (await kowClose.count()) await kowClose.first().click({ timeout: 30000 }).catch(() => {});
  await page.locator('[data-testid="kow-reveal"]').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  findings.length = 0;

  const list = pages.sort().filter((p) => !only || p.startsWith(only));
  for (const locale of ["en", "ar"]) {
    for (const route of list) {
      current = `/${locale}${fill(route)}`;
      await page.goto(`${BASE}${current}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch((e) => {
        findings.push({ url: current, kind: "navigation", text: String(e.message).slice(0, 200) });
      });
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
      // a raw translation key on screen is a defect
      const raw = await page.evaluate(
        "(() => { const t = document.body.innerText; const m = t.match(/\\b[a-z][a-zA-Z]+\\.[a-zA-Z]+(\\.[a-zA-Z]+)+\\b/g) || []; return m.filter(x => !/^(npc|www|data|api|e\\.g)\\./.test(x) && !x.endsWith('.qa') && !x.includes('.com') && !x.includes('.org')).slice(0, 5); })()"
      );
      for (const key of raw as string[]) findings.push({ url: current, kind: "rawKey", text: key });
      console.log(`${current}: ${findings.filter((f) => f.url === current).length} findings`);
    }
  }
  await browser.close();

  const outDir = path.join(ROOT, "docs", "qc");
  fs.mkdirSync(outDir, { recursive: true });
  const md = [
    "# Console sweep (generated)",
    "",
    `Generated ${new Date().toISOString()} as ${role} against ${BASE}: ${list.length} routes in two locales.`,
    "",
    findings.length ? "| page | kind | text |" : "No console errors, warnings, page errors, failed requests, 404 assets or raw keys.",
    ...(findings.length ? ["| --- | --- | --- |", ...findings.map((f) => `| ${f.url} | ${f.kind} | ${f.text.replace(/\|/g, "\\|")} |`)] : []),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "console-sweep.md"), md);
  console.log(`\n${findings.length} findings written to docs/qc/console-sweep.md`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
