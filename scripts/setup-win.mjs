#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * What this Windows laptop needs and no other machine does.
 *
 * Application Control here refuses unsigned native .node binaries, which
 * includes the ones Next, Tailwind and the ESLint resolver ship. Each of those
 * has a WebAssembly build that works instead, but the two listed below declare
 * `"cpu": "wasm32"` in their own package.json, so npm refuses to install them
 * on an x64 machine. Leaving them in devDependencies is what made the Railway
 * build fail with EBADPLATFORM before anything else could run.
 *
 * So they are installed here with --no-save: present in node_modules, absent
 * from package.json and package-lock.json, invisible to any other machine.
 * --force is what gets them past the cpu check on this one.
 *
 * Run this after `npm install` on Windows. It is idempotent, and it does
 * nothing at all on Linux or macOS, where the native binaries work.
 *
 *   npm run setup:win
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Pinned to the versions the tree resolves, so the shim matches its parent. */
const SHIMS = [
  { name: "@tailwindcss/oxide-wasm32-wasi", version: "4.3.3", why: "Tailwind's oxide scanner" },
  { name: "@unrs/resolver-binding-wasm32-wasi", version: "1.12.2", why: "the ESLint import resolver" },
];

if (process.platform !== "win32") {
  console.log(`setup:win does nothing on ${process.platform}: the native binaries work there.`);
  process.exit(0);
}

const root = process.cwd();
let installed = 0;
let already = 0;

for (const shim of SHIMS) {
  const dir = path.join(root, "node_modules", ...shim.name.split("/"));
  const manifest = path.join(dir, "package.json");
  if (fs.existsSync(manifest)) {
    try {
      const found = JSON.parse(fs.readFileSync(manifest, "utf8")).version;
      if (found === shim.version) {
        console.log(`ok       ${shim.name}@${found}  (${shim.why})`);
        already++;
        continue;
      }
      console.log(`replace  ${shim.name}@${found} -> ${shim.version}`);
    } catch {
      /* unreadable: reinstall it */
    }
  }
  console.log(`install  ${shim.name}@${shim.version}  (${shim.why})`);
  const res = spawnSync(
    "npm",
    ["install", `${shim.name}@${shim.version}`, "--no-save", "--force", "--no-audit", "--no-fund"],
    { stdio: "inherit", shell: true, cwd: root }
  );
  if (res.status !== 0) {
    console.error(`\n${shim.name} did not install (exit ${res.status}).`);
    console.error("Without it, Tailwind or ESLint will fail here because the native binary is blocked.");
    process.exit(res.status ?? 1);
  }
  installed++;
}

/* The resolver's loader never tries its wasi binding on win32, so its final
   throw is patched to try it first. Idempotent, and a no-op elsewhere. */
const patch = spawnSync(process.execPath, [path.join(root, "scripts", "patch-native.mjs")], {
  stdio: "inherit",
  cwd: root,
});
if (patch.status !== 0) console.error("patch-native did not run cleanly; check the output above.");

console.log(
  `\n${installed} installed, ${already} already present. ` +
    "Neither is in package.json or package-lock.json, so no other machine sees them."
);
