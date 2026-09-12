/* eslint-disable no-console */
// One-command setup: npm run setup
// Installs dependencies, applies machine-policy workarounds, creates ./data,
// downloads fonts and public NPC sources, runs migrations, seeds everything.
// Idempotent: safe to run again.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const isWin = process.platform === "win32";

function run(name, cmd, args, opts = {}) {
  console.log(`\n== ${name} ==`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: isWin,
    cwd: ROOT,
    ...opts,
  });
  if (res.status !== 0 && !opts.optional) {
    console.error(`${name} failed (exit ${res.status}). Stopping.`);
    process.exit(res.status ?? 1);
  }
  return res.status === 0;
}

// 1. dependencies
if (!fs.existsSync(path.join(ROOT, "node_modules", "next"))) {
  run("npm install", "npm", ["install", "--no-audit", "--no-fund"]);
} else {
  console.log("== npm install == (node_modules present, skipping)");
}

// 2. machine-policy workaround for the native resolver (see DECISIONS.md item 11)
run("patch native bindings", "node", ["scripts/patch-native.mjs"], { optional: true });

// 3. runtime folders
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "data", "screenshots"), { recursive: true });

// 4. pdf.js worker for the reader
const workerSrc = path.join(ROOT, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const workerDest = path.join(ROOT, "public", "pdf.worker.min.mjs");
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log("== pdf worker copied ==");
}

// 5. fonts (skips files already present)
run("download fonts", "node", ["scripts/fetch-fonts.mjs"], { optional: true });

// 6. public NPC sources (retries + fallbacks inside; never fails the setup)
run("fetch public NPC sources", "node", ["scripts/fetch-sources.mjs"], { optional: true });

// 7. migrations + full seed (drops and recreates data/nexus.db)
run("seed database", "npx", ["tsx", "scripts/seed.ts"]);

// 8. make sure every vector sits in the primary embedding space
run("verify embeddings", "npx", ["tsx", "scripts/reembed.ts"], { optional: true });

console.log(`
== SiaNexus is ready ==

  npm run dev

then open http://localhost:3000 and sign in:

  admin@npc.qa / Nexus!2026   (Super Admin)
  analyst@npc.qa / Nexus!2026 (Contributor, sees the onboarding quest)

All accounts are listed in README.md.
`);
