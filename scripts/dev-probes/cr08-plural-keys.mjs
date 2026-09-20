// Prints the Arabic plural messages that lack a form, with their en text.
import { readFile } from "node:fs/promises";
const read = async (f) => JSON.parse((await readFile(`messages/${f}`, "utf8")).replace(/^﻿/, ""));
const en = await read("en.json");
const ar = await read("ar.json");
const get = (o, k) => k.split(".").reduce((a, p) => (a ? a[p] : undefined), o);
for (const key of process.argv.slice(2)) {
  console.log(`\n${key}\n  en: ${get(en, key)}\n  ar: ${get(ar, key)}`);
}
