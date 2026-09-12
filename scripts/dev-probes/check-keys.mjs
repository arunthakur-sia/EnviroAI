// Prints only boolean facts about key formats. Never prints key material.
import { readFileSync } from "node:fs";
const env = {};
for (const l of readFileSync("C:/npckms/.env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m) env[m[1]] = m[2];
}
const a = env.ANTHROPIC_API_KEY || "";
const v = env.VOYAGE_API_KEY || "";
console.log(
  "anthropic: sk-ant pattern:",
  /^sk-ant-[a-zA-Z0-9_-]+$/.test(a.trim()),
  "| quotes:",
  /["']/.test(a),
  "| inner ws:",
  /\s/.test(a.trim()),
  "| outer ws:",
  a !== a.trim()
);
console.log(
  "voyage: pa- pattern:",
  /^pa-[a-zA-Z0-9_-]+$/.test(v.trim()),
  "| quotes:",
  /["']/.test(v),
  "| inner ws:",
  /\s/.test(v.trim()),
  "| outer ws:",
  v !== v.trim()
);
