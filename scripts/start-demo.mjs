/* eslint-disable no-console */
// CR08 Phase B: the client path. Builds once (when no build exists or when
// --build is passed) and serves the production build with `next start`; the
// job worker starts with the server through src/instrumentation.ts.
//   npm run start:demo            serve (build first if .next has no BUILD_ID)
//   npm run start:demo -- --build rebuild, then serve
//   PORT=3000 is the default; DEMO_PORT overrides it
import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const isWin = process.platform === "win32";
const port = process.env.DEMO_PORT || process.env.PORT || "3000";
const forceBuild = process.argv.includes("--build");
const buildId = path.join(ROOT, ".next", "BUILD_ID");

const { DB_PATH } = await import("./lib/paths.mjs");
if (!fs.existsSync(DB_PATH)) {
  console.error(`${path.relative(ROOT, DB_PATH) || DB_PATH} is missing. Run \`npm run setup\` first.`);
  process.exit(1);
}

if (forceBuild || !fs.existsSync(buildId)) {
  console.log(`\n== next build (${forceBuild ? "requested" : "no build found"}) ==`);
  const t0 = Date.now();
  const res = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: isWin, cwd: ROOT });
  if (res.status !== 0) {
    console.error(`build failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
  console.log(`== built in ${((Date.now() - t0) / 1000).toFixed(0)}s ==`);
} else {
  console.log("== using the existing production build (.next) ==");
}

console.log(`\n== next start on http://localhost:${port} ==`);
console.log("   the job worker starts with the server; press Ctrl+C to stop\n");
const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  shell: isWin,
  cwd: ROOT,
  /* A production build served over plain http on this machine: the session
     cookie must not be Secure or the browser never sends it back and nobody
     can sign in. Railway sets no such override and gets the Secure cookie. */
  env: { ...process.env, NODE_ENV: "production", SESSION_COOKIE_SECURE: "0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
