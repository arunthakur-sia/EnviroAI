/* eslint-disable no-console */
// CR08 Phase A: pin every dependency declared as "latest" to the version that
// is actually installed, so `npm run setup` on a clean clone reproduces this
// tree rather than whatever shipped that morning.
//   node scripts/qc/pin-deps.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const ROOT = process.cwd();
const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

function installedVersion(name) {
  try {
    const p = path.join(ROOT, "node_modules", ...name.split("/"), "package.json");
    return JSON.parse(readFileSync(p, "utf8")).version;
  } catch {
    return null;
  }
}

let changed = 0;
for (const section of ["dependencies", "devDependencies"]) {
  const deps = pkg[section] ?? {};
  for (const [name, range] of Object.entries(deps)) {
    if (range !== "latest" && range !== "*") continue;
    const v = installedVersion(name);
    if (!v) {
      console.log(`  ${name}: not installed, left as "${range}"`);
      continue;
    }
    deps[name] = v;
    console.log(`  ${name}: ${range} -> ${v}`);
    changed++;
  }
}
if (!dry && changed) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`${changed} pinned${dry ? " (dry run)" : ""}`);
