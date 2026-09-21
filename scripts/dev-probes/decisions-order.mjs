/* eslint-disable no-console */
// DECISIONS.md is a numbered list; a few entries were inserted above their
// predecessor and read out of order. This sorts the trailing run of entries
// from a given number onward, without touching anything above it.
//   node scripts/dev-probes/decisions-order.mjs 129 [--write]
import fs from "node:fs";
import path from "node:path";

const from = Number(process.argv[2] ?? 129);
const write = process.argv.includes("--write");
const file = path.join(process.cwd(), "DECISIONS.md");
const text = fs.readFileSync(file, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const blocks = text.split(new RegExp(`${eol}${eol}`));

const numberOf = (b) => {
  const m = /^(\d+)\.\s/.exec(b);
  return m ? Number(m[1]) : null;
};

let start = -1;
for (let i = 0; i < blocks.length; i++) {
  const n = numberOf(blocks[i]);
  if (n !== null && n >= from) {
    start = i;
    break;
  }
}
if (start === -1) {
  console.log("nothing to reorder");
  process.exit(0);
}
const tail = blocks.slice(start);
if (!tail.every((b) => numberOf(b) !== null)) {
  console.error("the tail is not a clean run of numbered entries; not touching it");
  process.exit(1);
}
const before = tail.map(numberOf);
const sorted = [...tail].sort((a, b) => numberOf(a) - numberOf(b));
const after = sorted.map(numberOf);
console.log(`before: ${before.join(", ")}`);
console.log(`after:  ${after.join(", ")}`);
if (before.join() === after.join()) {
  console.log("already in order");
  process.exit(0);
}
if (!write) {
  console.log("\nrun again with --write to apply");
  process.exit(0);
}
fs.writeFileSync(file, [...blocks.slice(0, start), ...sorted].join(`${eol}${eol}`), "utf8");
console.log("\nwritten");
