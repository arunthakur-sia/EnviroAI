// CR05 tail: em-dash sweep over changed/untracked text files.
import { execSync } from "node:child_process";
import fs from "node:fs";

const out = execSync("git status --porcelain", { encoding: "utf8" });
const files = out
  .split("\n")
  .map((l) => l.slice(3).trim())
  .filter(Boolean)
  .filter((f) => /\.(ts|tsx|md|json|mjs|css|sql)$/.test(f))
  .filter((f) => !f.startsWith("data/screenshots"))
  .filter((f) => !f.endsWith("emdash-sweep.mjs")); // the probe carries the glyph it hunts
let hits = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.includes("—")) {
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
      hits++;
    }
  });
}
console.log(hits === 0 ? "clean: no em dashes in changed files" : `${hits} em-dash lines`);
process.exit(hits ? 1 : 0);
