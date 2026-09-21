/* eslint-disable no-console */
/**
 * Which files under the source folders is git ignoring, and by which rule?
 *
 * An unanchored pattern like `data/` matches a folder of that name at ANY
 * depth, so `scripts/data/` disappeared from the repository and the
 * deployment build failed on a module it could not find. This walks the source
 * folders on disk, asks git about every file it does not already track, and
 * prints the offending rule.
 *
 *   node scripts/dev-probes/ignored-sources.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "scripts", "messages", "public", "tests", "docs"];
/* sources/ is ignored on purpose: about 250 MB of fetched public documents,
   which is a decision recorded in .railwayignore, not an accident. It is
   reported separately rather than silently swept in. */
const DELIBERATE = ["sources"];
/* Files that are ignored deliberately and are produced by a build step, so
   finding them ignored is correct rather than a fault. */
const GENERATED = new Set(["public/pdf.worker.min.mjs"]);

const tracked = new Set(
  execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
      walk(full, out);
    } else {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

function checkIgnore(files) {
  if (!files.length) return new Map();
  const out = new Map();
  // git check-ignore takes many paths and prints "source:line:pattern\tfile"
  const chunk = 400;
  for (let i = 0; i < files.length; i += chunk) {
    const batch = files.slice(i, i + chunk);
    let text = "";
    try {
      text = execFileSync("git", ["check-ignore", "-v", "--", ...batch], { encoding: "utf8" });
    } catch (e) {
      text = e.stdout ? String(e.stdout) : ""; // exit 1 simply means "none ignored"
    }
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      const [rule, file] = line.split("\t");
      if (file) out.set(file.replace(/\\/g, "/"), rule);
    }
  }
  return out;
}

let problems = 0;
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  const onDisk = walk(root);
  const untracked = onDisk.filter((f) => !tracked.has(f));
  const ignored = checkIgnore(untracked);
  const byRule = new Map();
  const generated = [];
  for (const [file, rule] of ignored) {
    if (GENERATED.has(file)) {
      generated.push(`${file}  (${rule.split(":").pop()})`);
      continue;
    }
    if (!byRule.has(rule)) byRule.set(rule, []);
    byRule.get(rule).push(file);
  }
  console.log(`\n${root}/  ${onDisk.length} files on disk, ${onDisk.length - untracked.length} tracked`);
  for (const g of generated) console.log(`  generated, ignored on purpose: ${g}`);
  if (!byRule.size) {
    if (!generated.length) console.log("  nothing ignored");
    continue;
  }
  for (const [rule, files] of byRule) {
    problems += files.length;
    console.log(`  IGNORED by ${rule}  (${files.length})`);
    for (const f of files.slice(0, 10)) console.log(`      ${f}`);
    if (files.length > 10) console.log(`      ... and ${files.length - 10} more`);
  }
}

for (const root of DELIBERATE) {
  if (!fs.existsSync(root)) continue;
  const n = walk(root).length;
  console.log(`\n${root}/  ${n} files, ignored on purpose (not counted as a problem)`);
}

console.log(
  problems
    ? `\n${problems} source file(s) are ignored and should not be`
    : "\nno source file is wrongly ignored"
);
process.exit(problems ? 1 : 0);
