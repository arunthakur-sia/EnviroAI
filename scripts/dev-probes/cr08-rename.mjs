// CR08 2.1: "Knowledge Vault" becomes "Institutional Memory" (Arabic: مكتبة
// المعرفة) in the two message files. Ordered replacements, longest first.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MESSAGES = path.join(process.cwd(), "messages");
const EN = [
  ["Knowledge Vault", "Institutional Memory"],
  ["Upload to Vault", "Upload to Institutional Memory"],
  ["Save to Vault", "Save to Institutional Memory"],
  ["Saved to the Vault", "Saved to Institutional Memory"],
  ["Open the Vault", "Open Institutional Memory"],
  ["Open in the Vault", "Open in Institutional Memory"],
  ["Open the source in the Vault", "Open the source in Institutional Memory"],
  ["upload to the Vault", "upload to Institutional Memory"],
  ["save to the Vault", "save to Institutional Memory"],
  ["already in the Vault", "already in Institutional Memory"],
  ["To a Vault document", "To an Institutional Memory document"],
  ["Vault document", "Institutional Memory document"],
  ["normal Vault pipeline", "normal Institutional Memory pipeline"],
  ["the Vault, or expert", "Institutional Memory, or expert"],
  ["\"Vault\"", "\"Institutional Memory\""],
];
const AR = [
  ["خزانة المعرفة", "مكتبة المعرفة"],
  ["إلى الخزانة", "إلى مكتبة المعرفة"],
  ["في الخزانة", "في مكتبة المعرفة"],
  ["افتح الخزانة", "افتح مكتبة المعرفة"],
  ["\"الخزانة\"", "\"مكتبة المعرفة\""],
];

for (const [file, pairs] of [
  ["en.json", EN],
  ["ar.json", AR],
]) {
  const p = path.join(MESSAGES, file);
  let text = (await readFile(p, "utf8")).replace(/^﻿/, "");
  let total = 0;
  for (const [from, to] of pairs) {
    const count = text.split(from).length - 1;
    if (!count) continue;
    text = text.split(from).join(to);
    total += count;
    console.log(`${file}: ${count} x "${from}"`);
  }
  await writeFile(p, text, "utf8");
  console.log(`${file}: ${total} replacements`);
  const left = (text.match(/Vault|الخزانة|خزانة/g) || []).length;
  console.log(`${file}: ${left} occurrences of the old name remain`);
}
