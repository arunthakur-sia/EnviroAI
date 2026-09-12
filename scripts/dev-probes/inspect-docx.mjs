// Verify the generated report docx: valid zip, TOC field, maroon shading,
// headers/footers, page numbers.
import fs from "node:fs";
import JSZip from "jszip";

const file = process.argv[2];
const buf = fs.readFileSync(file);
const zip = await JSZip.loadAsync(buf);
const names = Object.keys(zip.files);
console.log("entries:", names.filter((n) => n.endsWith(".xml")).slice(0, 12).join(", "));
const doc = await zip.file("word/document.xml").async("string");
const checks = {
  toc_field: doc.includes("TOC") && (doc.includes("instrText") || doc.includes("sdt")),
  cover_maroon_band: doc.includes("5A0E24"),
  heading_maroon: doc.includes("8A1538"),
  sand_banding: doc.includes("F4F0E8"),
  gold_rule: doc.includes("C9A24D"),
  arabic_text: /[؀-ۿ]/.test(doc),
  rtl_paragraphs: doc.includes("<w:bidi"),
  image: names.some((n) => n.startsWith("word/media/")),
  numbering: names.includes("word/numbering.xml"),
};
const footers = names.filter((n) => /word\/footer\d*\.xml/.test(n));
let pageNumbers = false;
for (const f of footers) {
  const xml = await zip.file(f).async("string");
  if (xml.includes("PAGE")) pageNumbers = true;
}
checks.footer_page_numbers = pageNumbers;
checks.headers = names.some((n) => /word\/header\d*\.xml/.test(n));
console.log(JSON.stringify(checks, null, 1));
// pull the visible title text
const m = doc.match(/<w:t[^>]*>([^<]{10,80})<\/w:t>/);
console.log("first text run:", m?.[1]);
