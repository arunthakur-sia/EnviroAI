/* eslint-disable no-console */
// CR08 Phase A: `catch (e: any)` is not a typed boundary, it is a hole. This
// rewrites every one to `catch (e: unknown)` and narrows the uses in the same
// block through a small helper the file already has or gains.
//   node scripts/qc/fix-catch-any.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const FILES = [
  "src/server/ai/analyst/tools.ts",
  "src/server/jobs/worker.ts",
  "src/server/scan/index.ts",
  "src/server/scan/web-search.ts",
  "src/server/scan/rss.ts",
  "src/components/nexus/SignalCard.tsx",
  "src/app/[locale]/(app)/add/AddKnowledgeClient.tsx",
  "src/app/[locale]/(app)/trends/TrendsToolbar.tsx",
];

/** `e.message` / `e?.message` / `e?.stack` on a value typed unknown. */
const REWRITES = [
  [/\be\.message\b/g, "errMessage(e)"],
  [/\be\?\.message\b/g, "errMessage(e)"],
  [/\be\?\.stack\b/g, "errStack(e)"],
];

let touched = 0;
for (const rel of FILES) {
  const file = path.join(process.cwd(), rel);
  let text = readFileSync(file, "utf8");
  if (!text.includes("catch (e: any)")) {
    console.log(`skip ${rel} (no catch (e: any))`);
    continue;
  }
  text = text.replaceAll("catch (e: any)", "catch (e: unknown)");
  for (const [re, to] of REWRITES) text = text.replace(re, to);
  // `String(e?.message ?? e)` became `String(errMessage(e) ?? e)`: simplify
  text = text.replace(/String\(errMessage\(e\) \?\? e\)/g, "errMessage(e)");
  text = text.replace(/String\(errStack\(e\) \|\| e\)/g, "errStack(e)");
  text = text.replace(/errMessage\(e\) \|\| e/g, "errMessage(e)");

  if (!text.includes("function errMessage")) {
    const helper = `${text.startsWith('"use client";') ? "" : ""}
/** CR08 Phase A: the only place an unknown error is narrowed. */
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function errStack(e: unknown): string {
  return e instanceof Error ? (e.stack ?? e.message) : String(e);
}
`;
    // after the last import line
    const lines = text.split("\n");
    let last = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\b/.test(lines[i]) || /^\} from ["']/.test(lines[i])) last = i;
    }
    lines.splice(last + 1, 0, helper);
    text = lines.join("\n");
  }
  if (!dry) writeFileSync(file, text, "utf8");
  touched++;
  console.log(`${dry ? "would fix" : "fixed"} ${rel}`);
}
console.log(`${touched} files`);
