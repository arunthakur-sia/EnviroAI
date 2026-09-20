/* eslint-disable no-console */
// CR08 5.5: page images for any docx through the template's docx-preview
// renderer (Edge). Useful for the fallback builds and for reports the builder
// produced. Output goes to data/reports/previews/<report id>/ unless --out is given.
//   npx tsx scripts/dev-probes/cr08-template-preview.ts <file.docx> [--out <dir>]
import { closePngRenderer, renderDocxPreviews } from "../../src/server/reports/template";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: cr08-template-preview.ts <file.docx> [--out <dir>]");
    process.exit(2);
  }
  const oi = process.argv.indexOf("--out");
  const outDir = oi >= 0 ? process.argv[oi + 1] : undefined;
  const pages = await renderDocxPreviews(file, { outDir });
  console.log(`${pages.length} page(s)`);
  for (const p of pages) console.log("  " + p);
  await closePngRenderer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
