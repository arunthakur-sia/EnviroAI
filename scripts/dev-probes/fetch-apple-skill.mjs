// Fetch the apple-design-skill files (CR02 1.1 fallback path) from raw.githubusercontent.com.
// Public read-only content; TLS relaxed for the corporate proxy per DECISIONS 8.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/dickwu/apple-design-skill/main/";
const DEST = "C:/enviroai/.claude/skills/apple-design-skill/";
const FILES = [
  "SKILL.md",
  "README.md",
  "references/hig-lookup.md",
  "references/hig/design-principles.md",
  "references/hig/layout.md",
  "references/hig/typography.md",
  "references/hig/color.md",
  "references/hig/motion.md",
  "references/hig/accessibility.md",
  "references/hig/right-to-left.md",
  "references/hig/searching.md",
  "references/hig/search-fields.md",
  "references/hig/loading.md",
  "references/hig/branding.md",
  "references/hig/generative-ai.md",
  "references/hig/playing-audio.md",
  "references/hig/charting-data.md",
  "references/hig/writing.md",
];

let ok = 0, fail = 0;
for (const f of FILES) {
  const url = BASE + f;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const dest = path.join(DEST, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text, "utf8");
    ok++;
    console.log("saved", f, text.length, "bytes");
  } catch (e) {
    fail++;
    console.error("FAILED", f, e.message);
  }
}
console.log(`done: ${ok} saved, ${fail} failed`);
