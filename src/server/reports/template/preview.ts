// CR08 5.5 visual QA: page images of a rendered docx. LibreOffice is absent
// and no Node docx-to-PDF converter runs on this machine, so the docx is laid
// out by docx-preview (pure JavaScript) inside a system Edge page driven by
// Playwright, and each rendered page element is screenshotted at 1.5x into
// data/reports/previews/<report id>/page-N.png. Known limits of the method
// are listed in the module report and DECISIONS: docx-preview breaks pages only
// at explicit page breaks and section boundaries (no flow pagination), ignores
// bidiVisual (the page sets dir=rtl for Arabic documents instead) and reads
// start/end alignment as absolute (swapped here for RTL paragraphs).
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { fontCss, getBrowser, pngSize, svgToPng } from "./png";

function resolveModule(rel: string): string | null {
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require") as NodeJS.Require;
    return req.resolve(rel);
  } catch {
    const p = path.join(process.cwd(), "node_modules", rel);
    return fs.existsSync(p) ? p : null;
  }
}

/** Where the previews of a docx go: data/reports/previews/<report id>/. The
    id is the docx path relative to data/reports without its extension, or
    the file's basename when it lives elsewhere. */
export function previewDir(docxPath: string): string {
  const abs = path.resolve(docxPath);
  const base = path.join(process.cwd(), "data", "reports");
  const rel = path.relative(base, abs);
  const id = (rel.startsWith("..") || path.isAbsolute(rel) ? path.basename(abs) : rel).replace(/\.docx$/i, "");
  return path.join(base, "previews", id);
}

export async function renderDocxPreviews(
  docxPath: string,
  opts: { outDir?: string; scale?: number; timeoutMs?: number } = {}
): Promise<string[]> {
  const abs = path.resolve(docxPath);
  if (!fs.existsSync(abs)) return [];
  const browser = await getBrowser();
  const jszipPath = resolveModule("jszip/dist/jszip.min.js");
  const previewPath = resolveModule("docx-preview/dist/docx-preview.min.js");
  if (!browser || !jszipPath || !previewPath) return [];

  const buf = fs.readFileSync(abs);
  let rtl = false;
  try {
    const zip = await JSZip.loadAsync(buf);
    const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
    // a bidi element without a value, or with a true value (never w:val="false")
    rtl = /<w:bidi(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(doc);
  } catch {
    rtl = false;
  }

  const outDir = opts.outDir ?? previewDir(abs);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^page-\d+\.png$/.test(f)) fs.rmSync(path.join(outDir, f), { force: true });

  const context = await browser.newContext({ deviceScaleFactor: opts.scale ?? 1.5, viewport: { width: 1000, height: 1400 } });
  const page = await context.newPage();
  const files: string[] = [];
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}
html,body{margin:0;background:#ffffff}
.docx-wrapper{background:#ffffff !important;padding:0 !important;display:block !important}
.docx-wrapper>section.docx{box-shadow:none !important;margin:0 0 8px 0 !important;overflow:hidden}
</style></head><body><div id="c"></div></body></html>`,
      { waitUntil: "load" }
    );
    await page.addScriptTag({ path: jszipPath });
    await page.addScriptTag({ path: previewPath });
    const b64 = buf.toString("base64");
    const count = (await page.evaluate(
      `(async () => {
        const bin = atob(${JSON.stringify(b64)});
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        await window.docx.renderAsync(blob, document.getElementById("c"), null, {
          breakPages: true, inWrapper: true, ignoreWidth: false, ignoreHeight: false,
          renderHeaders: true, renderFooters: true, useBase64URL: true, ignoreLastRenderedPageBreak: true,
          ignoreFonts: false, renderChanges: false, renderComments: false, experimental: true,
        });
        if (${rtl ? "true" : "false"}) {
          document.querySelectorAll("section.docx").forEach((s) => s.setAttribute("dir", "rtl"));
          document.querySelectorAll("section.docx p").forEach((p) => {
            const rtlPara = p.style.direction === "rtl";
            if (!rtlPara) return;
            const ta = p.style.textAlign;
            if (ta === "left") p.style.textAlign = "right";
            else if (ta === "right") p.style.textAlign = "left";
            const ml = p.style.marginLeft, mr = p.style.marginRight;
            p.style.marginLeft = mr; p.style.marginRight = ml;
            const ti = p.style.textIndent;
            if (ti) p.style.textIndent = ti;
          });
        }
        await document.fonts.ready;
        await new Promise((r) => setTimeout(r, 250));
        return document.querySelectorAll("section.docx").length;
      })()`
    )) as number;
    const sections = page.locator("section.docx");
    for (let i = 0; i < count; i++) {
      const file = path.join(outDir, `page-${i + 1}.png`);
      await sections.nth(i).screenshot({ path: file, type: "png", timeout: opts.timeoutMs ?? 60000, animations: "disabled" });
      files.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
    }
  } catch {
    // return what was captured
  } finally {
    await context.close().catch(() => undefined);
  }
  if (files[0]) await renderThumb(path.join(process.cwd(), files[0])).catch(() => null);
  return files;
}

/** The width a cover thumbnail is drawn at: the gallery card is about 200 CSS
    pixels wide, so this is the two times rendition and nothing more. */
export const THUMB_WIDTH = 420;

/** The sibling a thumbnail is written to, whether or not it exists yet. JPEG,
    because a page rendition is a photograph of text and PNG costs four times
    the bytes for a picture nobody zooms into. */
export function thumbPathOf(pagePath: string): string {
  return pagePath.replace(/\.png$/i, "-thumb.jpg");
}

/**
 * A small rendition of one rendered page, for the cover gallery. A full page
 * render is around 370 kB and the gallery draws it at 197 by 263, which put
 * four of them in front of the first paint; this is the same picture at the
 * size it is actually shown. Returns the path written, or null when no
 * rasteriser is available (the caller then keeps serving the full page).
 */
export async function renderThumb(pagePath: string, width = THUMB_WIDTH): Promise<string | null> {
  if (!fs.existsSync(pagePath)) return null;
  const source = fs.readFileSync(pagePath);
  const size = pngSize(source);
  if (size.width <= width) return null;
  const height = Math.max(1, Math.round((width * size.height) / size.width));
  const href = `data:image/png;base64,${source.toString("base64")}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image href="${href}" xlink:href="${href}" x="0" y="0" width="${width}" height="${height}" ` +
    `preserveAspectRatio="xMidYMid meet"/></svg>`;
  const out = await svgToPng(svg, width, height, 1, { type: "jpeg", quality: 82 });
  if (!out) return null;
  const target = thumbPathOf(pagePath);
  fs.writeFileSync(target, out);
  return target;
}
