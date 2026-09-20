// CR08 Phase A: repository-wide sweeps that the change requests mandate.
//   node scripts/qc/emdash-and-tables.mjs
// 1. No em dash or en dash in authored source, messages, docs or scripts
//    (quoted published text is allowed only inside sources/ and the CR07
//    mandate seeds listed below).
// 2. No HTML <table> in CR08-era components (the CR03 to CR07 files that
//    predate the rule are listed as legacy and counted separately).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN = ["src", "messages", "scripts", "docs", "README.md", "DECISIONS.md", "PROGRESS.md", "CLIENT_DEMO_GUIDE.md"];
const EXT = new Set([".ts", ".tsx", ".mjs", ".md", ".json", ".css"]);
const ALLOW_DASH = [
  /^sources[\\/]/,
  /^scripts[\\/]data[\\/]cr07-council-content/,
  /^src[\\/]server[\\/]db[\\/]migrations[\\/]meta/,
  /^docs[\\/]qc[\\/].*-matrix\.md$/,
  // the sweeps and the parity test carry the glyphs they hunt
  /emdash-sweep\.mjs$/,
  /emdash-and-tables\.mjs$/,
  /i18n-parity\.test\.ts$/,
  // a publisher's own table used an en dash for "not applicable"
  /^scripts[\\/]dev-probes[\\/]cr08-indices-a-build/,
];

/** New CR08 UI must not use an HTML table; these predate the rule. */
const LEGACY_TABLES = new Set([
  "src\\app\\[locale]\\(app)\\indices\\[code]\\IndexPage.tsx",
  "src\\app\\[locale]\\(app)\\settings\\AccessSettingsTab.tsx",
  "src\\app\\[locale]\\(app)\\settings\\EntitiesSettingsTab.tsx",
  "src\\app\\[locale]\\(app)\\settings\\SettingsTabs.tsx",
  "src\\app\\[locale]\\(app)\\settings\\TrendsSettingsTab.tsx",
  "src\\app\\[locale]\\(app)\\settings\\UserAccessDialog.tsx",
  "src\\app\\[locale]\\(app)\\statistics\\import\\ImportFlow.tsx",
  "src\\app\\[locale]\\(app)\\statistics\\[id]\\IndicatorDetailClient.tsx",
  "src\\app\\[locale]\\(app)\\vault\\[id]\\Reader.tsx",
]);

function walk(dir, out) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
}

const files = [];
for (const s of SCAN) {
  const full = path.join(ROOT, s);
  try {
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  } catch {
    /* absent */
  }
}

const dashHits = [];
const tableHits = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  if (!ALLOW_DASH.some((re) => re.test(rel))) {
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (/[–—]/.test(line)) dashHits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  if (/\.tsx$/.test(rel) && !LEGACY_TABLES.has(rel)) {
    // a comment that says "no <table>" is not a table: strip comments first
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/<table\b/.test(code)) tableHits.push(rel);
  }
}

console.log(`em/en dash hits: ${dashHits.length}`);
for (const h of dashHits.slice(0, 80)) console.log(`  ${h}`);
if (dashHits.length > 80) console.log(`  (+${dashHits.length - 80} more)`);
console.log(`\n<table> in new .tsx (${LEGACY_TABLES.size} legacy files exempt): ${tableHits.length}`);
for (const h of tableHits) console.log(`  ${h}`);
process.exit(dashHits.length || tableHits.length ? 1 : 0);
