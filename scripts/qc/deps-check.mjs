/* eslint-disable no-console */
// CR08 Phase A: which declared dependencies are actually imported, and are
// any versions unpinned (a bare "latest" or a range that can move a major)?
//   node scripts/qc/deps-check.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const deps = Object.entries(pkg.dependencies ?? {});
const devDeps = Object.entries(pkg.devDependencies ?? {});

const SCAN_DIRS = ["src", "scripts", "tests"];
const EXT = new Set([".ts", ".tsx", ".mjs", ".js"]);
const files = [];
function walk(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (EXT.has(path.extname(name))) files.push(full);
  }
}
for (const d of SCAN_DIRS) walk(path.join(ROOT, d));
for (const f of ["next.config.mjs", "postcss.config.mjs", "vitest.config.ts", "drizzle.config.ts", "instrumentation.ts"]) {
  try {
    statSync(path.join(ROOT, f));
    files.push(path.join(ROOT, f));
  } catch {
    /* absent */
  }
}
const blob = files.map((f) => readFileSync(f, "utf8")).join("\n");

/** Packages used without an import statement (config, CLI, transitive peer). */
const IMPLICIT = new Set([
  "next",
  "react",
  "react-dom",
  "typescript",
  "eslint",
  "eslint-config-next",
  "tailwindcss",
  "@tailwindcss/postcss",
  "@tailwindcss/oxide-wasm32-wasi",
  "@next/swc-wasm-nodejs",
  "@unrs/resolver-binding-wasm32-wasi",
  "tsx",
  "vitest",
  "drizzle-kit",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@types/d3-force",
  "@types/d3-hierarchy",
  "@types/d3-selection",
  "@types/d3-shape",
  "@types/d3-zoom",
  "@types/d3-chord",
  "ts-prune",
  "@next/bundle-analyzer",
]);

function used(name) {
  if (IMPLICIT.has(name)) return true;
  const esc = name.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
  // a static import, a side-effect import, a require, a dynamic import, or a
  // path built from the package name (the docx preview loads its own file)
  const re = new RegExp(`["'\`]${esc}(["'\`/]|$)`, "m");
  return re.test(blob);
}

const unusedProd = deps.filter(([n]) => !used(n)).map(([n]) => n);
const unusedDev = devDeps.filter(([n]) => !used(n)).map(([n]) => n);
const unpinned = [...deps, ...devDeps].filter(([, v]) => v === "latest" || v === "*").map(([n, v]) => `${n}@${v}`);

console.log(`${files.length} source files scanned`);
console.log(`\nunused dependencies: ${unusedProd.length ? unusedProd.join(", ") : "none"}`);
console.log(`unused devDependencies: ${unusedDev.length ? unusedDev.join(", ") : "none"}`);
console.log(`unpinned (latest or *): ${unpinned.length ? unpinned.join(", ") : "none"}`);
