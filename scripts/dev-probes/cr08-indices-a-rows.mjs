/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): dump the rows of one workbook sheet
// whose cell in a given column matches a value (case-insensitive), as
// header=value pairs. Usage:
//   node scripts/dev-probes/cr08-indices-a-rows.mjs <file> <sheet> <col> <value> [<value> ...]
// <col> is a zero-based column index or a header name.
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const [file, sheet, colArg, ...values] = process.argv.slice(2);
const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
const ws = wb.Sheets[sheet] ?? wb.Sheets[wb.SheetNames[0]];
const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
const header = (grid[0] ?? []).map((h) => String(h ?? ""));
const col = /^\d+$/.test(colArg) ? Number(colArg) : header.indexOf(colArg);
const wanted = new Set(values.map((v) => v.toLowerCase()));
const MAXC = Number(process.env.MAX_COLS ?? 80);
let n = 0;
for (const row of grid.slice(1)) {
  const cell = String(row?.[col] ?? "").toLowerCase();
  if (!wanted.has(cell)) continue;
  n++;
  const pairs = [];
  for (let i = 0; i < Math.min(row.length, MAXC); i++) {
    if (row[i] == null || row[i] === "") continue;
    pairs.push(`${header[i] || "c" + i}=${row[i]}`);
  }
  console.log(pairs.join(" | "));
}
console.log(`${n} rows matched in sheet "${sheet}" (${grid.length - 1} data rows)`);
