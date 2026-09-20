// Finds the module chain through which a "use client" component reaches a
// Node-only module (node:fs, the db client, load-env), which breaks the
// whole dev server with "Reading from node:fs is not handled by plugins".
//   node scripts/dev-probes/cr08-kow-leak.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
})(ROOT);

const IMPORT_RE = /^\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm;
const EXPORT_FROM_RE = /^\s*export\s+(type\s+)?\{[^}]*\}\s+from\s+["']([^"']+)["']/gm;

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const graph = new Map();
const nodeOnly = new Set();
const clientEntries = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (/^\s*["']use client["']/m.test(src)) clientEntries.push(f);
  if (/from ["']node:(fs|path|crypto)/.test(src) || /@\/server\/db\/client["']/.test(src) || /load-env["']/.test(src)) nodeOnly.add(f);
  const deps = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) continue; // import type
    const names = m[2].trim();
    if (names.startsWith("type ")) continue;
    const target = resolve(f, m[3]);
    if (target) deps.push(target);
  }
  for (const m of src.matchAll(EXPORT_FROM_RE)) {
    if (m[1]) continue;
    const target = resolve(f, m[2]);
    if (target) deps.push(target);
  }
  graph.set(f, deps);
}

const rel = (p) => path.relative(process.cwd(), p).replace(/\\/g, "/");
const reported = new Set();
for (const entry of clientEntries) {
  const stack = [[entry]];
  const seen = new Set([entry]);
  while (stack.length) {
    const chain = stack.pop();
    const cur = chain[chain.length - 1];
    if (nodeOnly.has(cur) && cur !== entry) {
      const key = chain.map(rel).join(" -> ");
      if (!reported.has(key)) {
        reported.add(key);
        console.log("LEAK:", key);
      }
      continue;
    }
    for (const d of graph.get(cur) ?? []) {
      if (seen.has(d)) continue;
      seen.add(d);
      stack.push([...chain, d]);
    }
  }
}
console.log(reported.size ? `${reported.size} leaking chain(s)` : "no client -> node module chain found");
