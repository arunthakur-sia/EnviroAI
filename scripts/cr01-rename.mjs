// CR01 1.1: rename user-facing SiaNexus -> SiaNexus across the repo.
// Case-sensitive: lowercase internals (nexus.db, nexus_session, folder names,
// __nexusDb) are intentionally untouched. Arabic سيا نكسس -> سيا نكسس.
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/npckms";
const targets = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/node_modules|\.next|\.claude|data|public|sources|brand/.test(entry.name)) continue;
      walk(full);
    } else if (/\.(ts|tsx|json|md|mjs)$/.test(entry.name)) {
      if (/package(-lock)?\.json|tsconfig|NPC_KMS_BLUEPRINT|SIASiaNexus_CHANGE/.test(entry.name)) continue;
      targets.push(full);
    }
  }
}
walk(path.join(ROOT, "src"));
walk(path.join(ROOT, "messages"));
walk(path.join(ROOT, "scripts"));
walk(path.join(ROOT, "tests"));
targets.push(path.join(ROOT, "README.md"));

let changed = 0;
for (const file of targets) {
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const before = src;
  src = src.replace(/SiaNexus/g, "SiaNexus");
  src = src.replace(/\bNexus\b/g, "SiaNexus");
  src = src.replace(/سيا نكسس/g, "سيا نكسس");
  src = src.replace(/(?<!سيا )سيا نكسس/g, "سيا نكسس");
  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("renamed:", path.relative(ROOT, file));
  }
}
console.log(`done, ${changed} files changed`);
