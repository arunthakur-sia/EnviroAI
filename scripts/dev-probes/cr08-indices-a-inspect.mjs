/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): inspect downloaded publisher files.
// Workbooks: print sheet names, row counts and the first rows of each sheet.
// PDFs: extract the text with unpdf into <file>.txt next to the PDF.
// Usage: node scripts/dev-probes/cr08-indices-a-inspect.mjs <file> [<file> ...]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const HEAD = Number(process.env.HEAD_ROWS ?? 4);
const COLS = Number(process.env.HEAD_COLS ?? 14);

async function inspectPdf(file) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buf = new Uint8Array(fs.readFileSync(file));
  const pdf = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const out = file + ".txt";
  const pages = Array.isArray(text) ? text : [text];
  fs.writeFileSync(
    out,
    pages.map((t, i) => `\n===== PAGE ${i + 1} =====\n${t}`).join("\n"),
    "utf8"
  );
  console.log(`${path.basename(file)}: ${totalPages} pages, text written to ${out}`);
}

function inspectWorkbook(file) {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  console.log(`${path.basename(file)}: sheets = ${wb.SheetNames.join(" | ")}`);
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true });
    console.log(`  [${name}] rows=${grid.length}`);
    for (const row of grid.slice(0, HEAD)) {
      console.log("    " + JSON.stringify((row ?? []).slice(0, COLS)));
    }
  }
}

for (const f of process.argv.slice(2)) {
  if (!fs.existsSync(f)) {
    console.log(`missing: ${f}`);
    continue;
  }
  if (/\.pdf$/i.test(f)) await inspectPdf(f);
  else inspectWorkbook(f);
}
