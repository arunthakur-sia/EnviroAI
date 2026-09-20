/* eslint-disable no-console */
// CR08 Phase C: the cover gallery draws a report's first page at about 200 CSS
// pixels, but the rendered page is a full size PNG of around 370 kB, which put
// several megabytes in front of the gallery's first paint. Reports rendered
// from now on get a thumbnail with their previews; this backfills the ones that
// were rendered before. Idempotent: an existing thumbnail is left alone unless
// --force is given. Run with the server stopped or running, it only reads and
// writes files under data/reports/previews.
//   npx tsx scripts/qc/report-thumbs.ts [--force] [--all-pages]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";

async function main() {
  const force = process.argv.includes("--force");
  const allPages = process.argv.includes("--all-pages");
  const { renderThumb, thumbPathOf, THUMB_WIDTH } = await import("../../src/server/reports/template/preview");
  const { pngAvailable, closePngRenderer } = await import("../../src/server/reports/template/png");

  if (!(await pngAvailable())) {
    console.error("no rasteriser available (Playwright or Edge missing); nothing written");
    process.exit(1);
  }

  const root = path.join(process.cwd(), "data", "reports", "previews");
  if (!fs.existsSync(root)) {
    console.log("no previews directory; nothing to do");
    return;
  }

  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/^page-\d+\.png$/i.test(entry.name)) {
        if (allPages || /^page-1\.png$/i.test(entry.name)) pages.push(full);
      }
    }
  };
  walk(root);
  pages.sort();

  console.log(`${pages.length} page images to consider, target width ${THUMB_WIDTH}px`);
  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const page of pages) {
    const target = thumbPathOf(page);
    if (!force && fs.existsSync(target)) {
      skipped++;
      continue;
    }
    const out = await renderThumb(page);
    if (!out) {
      failed++;
      console.log(`  no thumbnail for ${path.relative(process.cwd(), page)}`);
      continue;
    }
    const before = fs.statSync(page).size;
    const after = fs.statSync(out).size;
    written++;
    console.log(
      `  ${path.relative(process.cwd(), out).replace(/\\/g, "/")}  ${Math.round(before / 1024)} kB -> ${Math.round(after / 1024)} kB`
    );
  }
  await closePngRenderer();
  console.log(`\nwritten ${written}, already present ${skipped}, not rendered ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
