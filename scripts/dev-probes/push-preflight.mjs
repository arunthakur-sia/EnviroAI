/* eslint-disable no-console */
// What would a push actually send? Checks the tracked set for anything that
// must never leave this machine, and for files GitHub will reject.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

console.log(`tracked files: ${tracked.length}`);

const FORBIDDEN = [
  [/^data\//, "runtime data"],
  // .env.example is a template with no values and is meant to be committed
  [/(^|\/)\.env($|\.(?!example$))/, "an environment file"],
  [/\.tar\.gz$/, "a data bundle"],
  [/^railway-variables\.txt$/, "the variables file"],
  [/^node_modules\//, "dependencies"],
  [/^\.next\//, "a build"],
  [/^sources\//, "fetched sources"],
];
let problems = 0;
for (const [pattern, what] of FORBIDDEN) {
  const hits = tracked.filter((f) => pattern.test(f));
  if (hits.length) {
    problems += hits.length;
    console.log(`\n! ${hits.length} tracked file(s) are ${what}:`);
    for (const h of hits.slice(0, 5)) console.log(`    ${h}`);
  }
}
if (!problems) console.log("nothing tracked that must stay local");

// GitHub refuses a file over 100 MB and warns over 50
const LIMIT = 95 * 1024 * 1024;
const WARN = 45 * 1024 * 1024;
const sized = tracked
  .map((f) => ({ f, size: fs.existsSync(f) ? fs.statSync(f).size : 0 }))
  .sort((a, b) => b.size - a.size);
const tooBig = sized.filter((s) => s.size > LIMIT);
const large = sized.filter((s) => s.size > WARN && s.size <= LIMIT);
console.log("\nlargest tracked files:");
for (const s of sized.slice(0, 5)) {
  console.log(`  ${(s.size / 1024 / 1024).toFixed(1).padStart(7)} MB  ${s.f}`);
}
if (large.length) {
  console.log(`\n${large.length} file(s) over 45 MB: GitHub accepts these but warns.`);
}
if (tooBig.length) {
  problems += tooBig.length;
  console.log(`\n! ${tooBig.length} file(s) over 95 MB, which GitHub will reject:`);
  for (const s of tooBig) console.log(`    ${(s.size / 1024 / 1024).toFixed(1)} MB  ${s.f}`);
}

const total = sized.reduce((n, s) => n + s.size, 0);
console.log(`\ntotal tracked size: ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log(problems ? `\n${problems} problem(s)` : "\nready to push");
process.exit(problems ? 1 : 0);
