// Extracts text from key source PDFs into sources/extracted/*.txt with page markers.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { extractText } from "unpdf";

const OUT = path.resolve(process.cwd(), "sources", "extracted");
await mkdir(OUT, { recursive: true });

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["QNDS3_EN.pdf", "QNDS3_AR.pdf", "NDS2_EN.pdf", "QNV2030_EN.pdf"];

for (const name of targets) {
  try {
    const file = path.resolve(process.cwd(), "sources", name);
    const buf = await readFile(file);
    const { totalPages, text } = await extractText(new Uint8Array(buf), { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text)];
    const outText = pages.map((t, i) => `\n===== PAGE ${i + 1} =====\n${(t || "").trim()}`).join("\n");
    const dest = path.join(OUT, name.replace(/\.pdf$/i, ".txt"));
    await writeFile(dest, outText, "utf8");
    console.log(`${name}: ${totalPages} pages, ${outText.length} chars -> ${dest}`);
  } catch (e) {
    console.error(`${name}: FAILED ${e?.message || e}`);
  }
}
