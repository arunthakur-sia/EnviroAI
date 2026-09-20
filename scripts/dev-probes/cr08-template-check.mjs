// CR08 5.5 unit-level checks on a generated report docx: it unzips, carries
// word/document.xml, header and footer parts, image parts, the TOC field, the
// palette, and (for Arabic) bidi paragraphs, rtl runs and bidiVisual tables.
//   node scripts/dev-probes/cr08-template-check.mjs [path.docx ...]
// With no arguments both template samples are checked. Exit 1 on any failure.
import fs from "node:fs";
import JSZip from "jszip";

const args = process.argv.slice(2);
const files = args.length
  ? args
  : ["data/reports/samples/template-sample-en.docx", "data/reports/samples/template-sample-ar.docx"];

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
}

for (const file of files) {
  console.log(`== ${file}`);
  if (!fs.existsSync(file)) {
    check("file exists", false);
    continue;
  }
  const buf = fs.readFileSync(file);
  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
    check("unzips", true, `${buf.length} bytes`);
  } catch (e) {
    check("unzips", false, String(e));
    continue;
  }
  const names = Object.keys(zip.files);
  const doc = names.includes("word/document.xml") ? await zip.file("word/document.xml").async("string") : "";
  check("word/document.xml present", doc.length > 0);
  const headers = names.filter((n) => /^word\/header\d*\.xml$/.test(n));
  const footers = names.filter((n) => /^word\/footer\d*\.xml$/.test(n));
  check("header parts", headers.length > 0, `${headers.length}`);
  check("footer parts", footers.length > 0, `${footers.length}`);
  const media = names.filter((n) => n.startsWith("word/media/"));
  check("image parts > 0", media.length > 0, `${media.length}`);
  const sectPr = (doc.match(/<w:sectPr/g) ?? []).length;
  check("one docx section per report section (>= 8)", sectPr >= 8, `${sectPr}`);
  check("TOC field", /TOC \\/.test(doc) || doc.includes("w:sdt"), "");
  check("maroon 8A1538 present", doc.includes("8A1538"));
  check("maroon-100 F6E7EC callouts", doc.includes("F6E7EC"));
  check("sand F4F0E8 banding", doc.includes("F4F0E8"));
  check("gold C9A24D rule", doc.includes("C9A24D"));
  check("RAG tints present", doc.includes("E3F1EA") && doc.includes("F9EFDD") && doc.includes("F9E5E4"));
  check("page breaks present", doc.includes('w:type="page"'));
  check("heading styles for the TOC", doc.includes('w:val="Heading1"') && doc.includes('w:val="Heading2"'));
  let footerHasPage = false;
  let footerHasSia = false;
  for (const f of footers) {
    const xml = await zip.file(f).async("string");
    if (/PAGE/.test(xml)) footerHasPage = true;
    if (xml.includes("SiaNexus")) footerHasSia = true;
  }
  check("footer carries a PAGE field", footerHasPage);
  check("footer carries SiaNexus", footerHasSia);
  let headerHasTitle = false;
  for (const h of headers) {
    const xml = await zip.file(h).async("string");
    if (/<w:t[^>]*>[^<]{3,}<\/w:t>/.test(xml)) headerHasTitle = true;
  }
  check("header carries text", headerHasTitle);
  const arabic = /[؀-ۿ]/.test(doc);
  // a bidi element without a value or with a true value; never w:val="false" and never bidiVisual
  const bidiOn = /<w:bidi(?:\s+w:val="(?:1|true|on)")?\s*\/>/;
  const rtlOn = /<w:rtl(?:\s+w:val="(?:1|true|on)")?\s*\/>/;
  const bidiVisualOn = /<w:bidiVisual(?:\s+w:val="(?:1|true|on)")?\s*\/>/;
  if (file.includes("-ar")) {
    check("Arabic text present", arabic);
    check("bidi paragraphs", bidiOn.test(doc));
    check("rtl runs", rtlOn.test(doc));
    check("bidiVisual tables", bidiVisualOn.test(doc));
    check("Sakkal Majalla runs", doc.includes("Sakkal Majalla"));
    check("cs font set", /w:cs="Sakkal Majalla"/.test(doc));
  } else {
    check("Calibri runs", doc.includes("Calibri"));
    check("no bidi paragraphs in English", !bidiOn.test(doc) && !rtlOn.test(doc));
    check("no bidiVisual tables in English", !bidiVisualOn.test(doc));
  }
  const alt = names.includes("word/numbering.xml");
  check("numbering part (bullets, numbered)", alt);
  const settings = names.includes("word/settings.xml") ? await zip.file("word/settings.xml").async("string") : "";
  check("updateFields on open", settings.includes("updateFields"));
}

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
