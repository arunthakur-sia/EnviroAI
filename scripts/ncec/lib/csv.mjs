// Minimal RFC 4180 reader and writer. UTF-8 with BOM on write, BOM stripped on read.
import fs from "node:fs";

export function toCsv(columns, rows) {
  const q = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => q(r[c])).join(","));
  return "﻿" + lines.join("\n") + "\n";
}

export function writeCsv(file, columns, rows) {
  fs.writeFileSync(file, toCsv(columns, rows), "utf8");
}

export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/** Reads a CSV into an array of objects; empty cells become null. */
export function readCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const head = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1 || r[0] !== "")
    .map((r) => {
      const o = {};
      head.forEach((h, i) => {
        o[h] = r[i] === undefined || r[i] === "" ? null : r[i];
      });
      return o;
    });
}
