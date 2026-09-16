/* eslint-disable no-console */
// CR01 acceptance 8: Lighthouse accessibility on Home, Ask, and Trends.
// Uses system Edge (Chromium) because the machine policy blocks bundled Chromium.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.error("Edge not found");
  process.exit(1);
}

// authenticated session cookie via the API
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});
const setCookie = login.headers.getSetCookie?.() ?? [];
const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
if (!cookie) {
  console.error("no session cookie");
  process.exit(1);
}

const outDir = path.resolve("data", "lighthouse");
fs.mkdirSync(outDir, { recursive: true });
// Windows shell mangles inline JSON args; lighthouse accepts a headers file path
const headersPath = path.join(outDir, "headers.json");
fs.writeFileSync(headersPath, JSON.stringify({ Cookie: cookie }));

// CR04 acceptance 6 + CR05 acceptance 7: performance and accessibility above
// 90 on Home, Indices, HR overview, Strategy (and the CR04 set) at 1440;
// Podcast and Ask stay on accessibility from CR02.
const targets = [
  ["/en/home", "home", true],
  ["/en/vault", "vault", true],
  ["/en/strategy", "strategy", true],
  ["/en/lessons", "lessons", true],
  ["/en/trends", "trends", true],
  ["/en/indices", "indices", true],
  ["/en/hr", "hr", true],
  // CR07 acceptance 5: performance and accessibility above 90 on the Council
  // Strategy, the Organisation and Lessons at 1440
  ["/en/council-strategy", "council-strategy", true],
  ["/en/organisation", "organisation", true],
  ["/en/podcast", "podcast", false],
  ["/en/ask", "ask", false],
];

let failed = 0;
for (const [url, name, withPerf] of targets) {
  const outPath = path.join(outDir, `${name}.json`);
  const categories = withPerf ? "performance,accessibility" : "accessibility";
  const args = [
    "--yes",
    "lighthouse@12",
    `${BASE}${url}`,
    `--only-categories=${categories}`,
    "--preset=desktop",
    "--output=json",
    `--output-path=${outPath}`,
    `--chrome-path=${edge}`,
    '"--chrome-flags=--headless=new --disable-gpu --window-size=1440,900"',
    `--extra-headers=${headersPath}`,
    "--quiet",
    "--max-wait-for-load=45000",
  ];
  const res = spawnSync("npx.cmd", args, { encoding: "utf8", timeout: 300000, shell: true });
  if (!fs.existsSync(outPath)) {
    console.log(`FAIL ${name}: lighthouse produced no report`);
    console.log((res.stderr || res.stdout || "").slice(-600));
    failed++;
    continue;
  }
  const report = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const a11y = Math.round((report.categories?.accessibility?.score ?? 0) * 100);
  const perf = withPerf ? Math.round((report.categories?.performance?.score ?? 0) * 100) : null;
  const ok = a11y >= 90 && (perf === null || perf >= 90);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}: accessibility ${a11y}${perf !== null ? ` · performance ${perf}` : ""}`
  );
  if (!ok) {
    const audits = Object.values(report.audits ?? {})
      .filter((a) => a.score !== null && a.score < 0.9)
      .slice(0, 10)
      .map((a) => `  - ${a.id}: ${a.title} (${a.score})`);
    console.log(audits.join("\n"));
  }
}
process.exit(failed ? 1 : 0);
