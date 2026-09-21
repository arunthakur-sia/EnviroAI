#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Puts the generated public assets in place before a build.
 *
 * `public/pdf.worker.min.mjs` is 1.4 MB copied verbatim out of `pdfjs-dist`,
 * which is a dependency, so committing it would be storing a build artefact in
 * git and pinning a copy that can drift from the installed version. It is
 * copied here instead, on every build, which also means a deployment gets it:
 * `npm run setup` does this too, but a deployment only runs `npm run build`.
 *
 * The fonts are a different case and ARE committed: they come from Google over
 * the network, and a build that depends on a third party being reachable is a
 * build that fails on a bad afternoon.
 *
 * Runs as npm's `prebuild`, so `npm run build` picks it up with no extra step.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const COPIES = [
  {
    from: path.join(ROOT, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
    to: path.join(ROOT, "public", "pdf.worker.min.mjs"),
    what: "the pdf.js worker the Institutional Memory reader loads",
  },
];

let copied = 0;
let same = 0;
for (const c of COPIES) {
  if (!fs.existsSync(c.from)) {
    console.error(`prebuild: ${path.relative(ROOT, c.from)} is missing; run npm install first`);
    process.exit(1);
  }
  const source = fs.statSync(c.from);
  const target = fs.existsSync(c.to) ? fs.statSync(c.to) : null;
  if (target && target.size === source.size && target.mtimeMs >= source.mtimeMs) {
    console.log(`prebuild: ${path.relative(ROOT, c.to)} is current`);
    same++;
    continue;
  }
  fs.mkdirSync(path.dirname(c.to), { recursive: true });
  fs.copyFileSync(c.from, c.to);
  console.log(`prebuild: copied ${path.relative(ROOT, c.to)} (${Math.round(source.size / 1024)} kB), ${c.what}`);
  copied++;
}

/* The fonts are committed, but say so loudly if they are not there: the pages
   preload two of them by name and the product is a design piece. */
const fontDir = path.join(ROOT, "public", "fonts");
const fonts = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter((f) => f.endsWith(".woff2")) : [];
if (fonts.length < 6) {
  console.warn(
    `prebuild: only ${fonts.length} of 6 fonts are in public/fonts. ` +
      "The build will succeed and the pages will fall back to system faces. " +
      "Run `npm run fetch-fonts` to restore them."
  );
} else {
  console.log(`prebuild: ${fonts.length} self-hosted fonts present`);
}

if (copied || same) console.log(`prebuild: ${copied} copied, ${same} already current`);
