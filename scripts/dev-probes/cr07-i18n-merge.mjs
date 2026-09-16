// CR07: merges the per-module message files the build produced into the two
// real message files. Deep merge, existing keys win only when the incoming
// value is undefined, and the result is written back pretty printed.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const MESSAGES = path.join(process.cwd(), "messages");

/** PowerShell's Set-Content writes a byte order mark that JSON.parse rejects. */
const readJson = async (file) => JSON.parse((await readFile(file, "utf8")).replace(/^﻿/, ""));

function deepMerge(base, add) {
  for (const [key, value] of Object.entries(add)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!base[key] || typeof base[key] !== "object" || Array.isArray(base[key])) base[key] = {};
      deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keyPaths(v, p));
    else out.push(p);
  }
  return out;
}

const files = (await readdir(MESSAGES)).filter((f) => /^cr07-.*\.(en|ar)\.json$/.test(f));
if (!files.length) {
  console.log("no cr07-*.json fragments to merge");
  process.exit(0);
}
console.log("fragments:", files.join(", "));

for (const locale of ["en", "ar"]) {
  const targetPath = path.join(MESSAGES, `${locale}.json`);
  const target = await readJson(targetPath);
  let merged = 0;
  for (const file of files.filter((f) => f.endsWith(`.${locale}.json`)).sort()) {
    const fragment = await readJson(path.join(MESSAGES, file));
    deepMerge(target, fragment);
    merged += keyPaths(fragment).length;
    console.log(`  ${locale}: merged ${keyPaths(fragment).length} keys from ${file}`);
  }
  await writeFile(targetPath, JSON.stringify(target, null, 2) + "\n", "utf8");
  console.log(`${locale}.json: ${merged} keys merged`);
}

// parity check
const en = await readJson(path.join(MESSAGES, "en.json"));
const ar = await readJson(path.join(MESSAGES, "ar.json"));
const enKeys = new Set(keyPaths(en));
const arKeys = new Set(keyPaths(ar));
const missingAr = [...enKeys].filter((k) => !arKeys.has(k));
const missingEn = [...arKeys].filter((k) => !enKeys.has(k));
console.log(`\nparity: ${enKeys.size} en keys, ${arKeys.size} ar keys`);
if (missingAr.length) console.log("missing in ar:", missingAr.slice(0, 30).join(", "), missingAr.length > 30 ? `(+${missingAr.length - 30})` : "");
if (missingEn.length) console.log("missing in en:", missingEn.slice(0, 30).join(", "), missingEn.length > 30 ? `(+${missingEn.length - 30})` : "");
if (!missingAr.length && !missingEn.length) console.log("parity clean");
