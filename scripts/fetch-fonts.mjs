// Downloads the self-hosted fonts into public/fonts.
// Zero dependencies: plain Node 18+ with global fetch.
// Idempotent: skips files that already exist and are larger than 10KB.
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "public", "fonts");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// family css2 url -> list of {subset, weight?, file}
const TARGETS = [
  {
    css: "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap",
    picks: [{ subset: "latin", file: "sora-var-latin.woff2" }],
  },
  {
    css: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap",
    picks: [
      { subset: "arabic", weight: "400", file: "plex-sans-arabic-400.woff2" },
      { subset: "arabic", weight: "500", file: "plex-sans-arabic-500.woff2" },
      { subset: "arabic", weight: "600", file: "plex-sans-arabic-600.woff2" },
    ],
  },
  {
    css: "https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400..700&display=swap",
    picks: [{ subset: "arabic", file: "noto-kufi-arabic-var.woff2" }],
  },
];

async function exists(file) {
  try {
    const s = await stat(file);
    return s.size > 10_000;
  } catch {
    return false;
  }
}

function parseCss(css) {
  // Splits the css2 response into blocks, each preceded by a `/* subset */` comment.
  const blocks = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[2];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(body)?.[1];
    const weight = /font-weight:\s*([0-9 ]+);/.exec(body)?.[1]?.trim();
    if (url) blocks.push({ subset: m[1], url, weight });
  }
  return blocks;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const manifest = [];
  for (const t of TARGETS) {
    let css = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(t.css, { headers: { "user-agent": UA } });
        if (res.ok) {
          css = await res.text();
          break;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    if (!css) {
      console.error(`FAILED css: ${t.css}`);
      manifest.push({ css: t.css, status: "css_fetch_failed" });
      continue;
    }
    const blocks = parseCss(css);
    for (const pick of t.picks) {
      const dest = path.join(OUT, pick.file);
      if (await exists(dest)) {
        manifest.push({ file: pick.file, status: "exists" });
        continue;
      }
      const block = blocks.find(
        (b) =>
          b.subset === pick.subset && (!pick.weight || b.weight === pick.weight)
      );
      if (!block) {
        console.error(`No block for ${pick.file}`);
        manifest.push({ file: pick.file, status: "not_found_in_css" });
        continue;
      }
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const res = await fetch(block.url, { headers: { "user-agent": UA } });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            await writeFile(dest, buf);
            console.log(`saved ${pick.file} (${buf.length} bytes)`);
            manifest.push({ file: pick.file, status: "ok", bytes: buf.length });
            ok = true;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!ok) manifest.push({ file: pick.file, status: "download_failed" });
    }
  }
  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log("fonts done");
}

run().catch((e) => {
  console.error("fetch-fonts failed", e);
  process.exitCode = 0; // never block the build on fonts
});
