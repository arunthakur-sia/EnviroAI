import fs from "node:fs";
const f = "C:/enviroai/src/server/ai/mock.ts";
const lines = fs.readFileSync(f, "utf8").split("\n");
const idx = lines.findIndex((l) => l.includes("strip control chars"));
if (idx < 0) {
  console.log("marker line not found");
  process.exit(1);
}
lines[idx] = '      .map((l) => l.replace(CTRL_CHARS, " ").replace(/\\s+/g, " ").trim()) // strip control chars from legacy-font PDF extractions';
// insert the CTRL_CHARS constant before mockAnalystAnswer if missing
if (!lines.some((l) => l.includes("const CTRL_CHARS"))) {
  const fnIdx = lines.findIndex((l) => l.includes("export function mockAnalystAnswer"));
  lines.splice(
    fnIdx - 1,
    0,
    'const CTRL_CHARS = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]", "g");'
  );
}
fs.writeFileSync(f, lines.join("\n"));
console.log("fixed writer line", idx + 1);
