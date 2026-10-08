// CR08 5.5: SVG to PNG through Playwright driving the system Edge. The machine
// policy blocks @resvg/resvg-js, sharp and canvas (native binaries) and has no
// LibreOffice, so a real browser is the only rasteriser available. One browser
// per process, one page per device scale factor with the app's fonts loaded
// once, and a mutex so concurrent callers never share the host element.
// Playwright is a devDependency: when it cannot be loaded the functions return
// null and the template falls back to native docx shading (as CR02 did).
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

type Browser = import("playwright").Browser;
type Page = import("playwright").Page;
type PlaywrightModule = typeof import("playwright");

let playwrightPromise: Promise<PlaywrightModule | null> | null = null;
let browserPromise: Promise<Browser | null> | null = null;
const pages = new Map<number, Promise<Page | null>>();
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Buffer | null>();

/** Loads playwright without letting a bundler resolve it at build time. */
function loadPlaywright(): Promise<PlaywrightModule | null> {
  if (!playwrightPromise) {
    playwrightPromise = (async () => {
      try {
        // eslint-disable-next-line no-eval
        const req = eval("require") as NodeJS.Require;
        return req("playwright") as PlaywrightModule;
      } catch {
        return null;
      }
    })();
  }
  return playwrightPromise;
}

export async function getBrowser(): Promise<Browser | null> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // REPORT_NO_RASTER=1 exercises the native docx fallbacks on a machine that has Edge
      if (process.env.REPORT_NO_RASTER === "1") return null;
      const pw = await loadPlaywright();
      if (!pw) return null;
      try {
        const browser = await pw.chromium.launch({ channel: "msedge", headless: true });
        const close = () => {
          browser.close().catch(() => undefined);
        };
        process.once("beforeExit", close);
        process.once("SIGINT", close);
        return browser;
      } catch {
        return null;
      }
    })();
  }
  return browserPromise;
}

/** True when a rasteriser is available (Playwright loadable and Edge launches). */
export async function pngAvailable(): Promise<boolean> {
  return (await getBrowser()) !== null;
}

/** Closes the cached browser; safe to call when nothing was launched. */
export async function closePngRenderer(): Promise<void> {
  const b = browserPromise ? await browserPromise : null;
  pages.clear();
  browserPromise = null;
  if (b) await b.close().catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Fonts: the app's self-hosted faces, embedded as data URIs once      */
/* ------------------------------------------------------------------ */

let fontCssCache: string | null = null;

/** @font-face rules for Sora, Noto Kufi Arabic and IBM Plex Sans
    Arabic from public/fonts, so the images carry the app's typography. */
export function fontCss(): string {
  if (fontCssCache !== null) return fontCssCache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const face = (family: string, file: string, weight: string) => {
    try {
      const data = fs.readFileSync(path.join(dir, file)).toString("base64");
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
    } catch {
      return "";
    }
  };
  fontCssCache = [
    face("Sora", "sora-var-latin.woff2", "100 800"),
    face("Noto Kufi Arabic", "noto-kufi-arabic-var.woff2", "100 900"),
    face("IBM Plex Sans Arabic", "plex-sans-arabic-400.woff2", "400"),
    face("IBM Plex Sans Arabic", "plex-sans-arabic-500.woff2", "500"),
    face("IBM Plex Sans Arabic", "plex-sans-arabic-600.woff2", "600"),
  ].join("\n");
  return fontCssCache;
}

async function getPage(scale: number): Promise<Page | null> {
  let p = pages.get(scale);
  if (!p) {
    p = (async () => {
      const browser = await getBrowser();
      if (!browser) return null;
      const context = await browser.newContext({
        deviceScaleFactor: scale,
        viewport: { width: 1200, height: 1400 },
      });
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}
html,body{margin:0;padding:0;background:transparent}
#host{display:inline-block;line-height:0}
#host>*{display:block}
</style></head><body><div id="host"></div></body></html>`,
        { waitUntil: "load" }
      );
      // warm the faces so the first screenshot does not race font loading
      await page.evaluate(
        `(() => Promise.all([
          document.fonts.load('600 40px "Sora"'),
          document.fonts.load('400 14px "Sora"'),
          document.fonts.load('600 40px "Noto Kufi Arabic"'),
          document.fonts.load('400 14px "IBM Plex Sans Arabic"'),
        ]).then(() => document.fonts.ready).then(() => true))()`
      );
      return page;
    })();
    pages.set(scale, p);
  }
  return p;
}

/**
 * Rasterises an SVG string. `width` and `height` are CSS px; the PNG has
 * `scale` times as many pixels. Returns null when no browser is available.
 */
export async function svgToPng(
  svg: string,
  width: number,
  height: number,
  scale = 2,
  /** jpeg for photographic output such as a page rendition, where PNG is four
      times the bytes for the same picture; omitBackground goes with png only */
  format: { type: "png" } | { type: "jpeg"; quality: number } = { type: "png" }
): Promise<Buffer | null> {
  const key = createHash("sha1")
    .update(`${width}x${height}@${scale}:${format.type}:${"quality" in format ? format.quality : ""}:${svg}`)
    .digest("hex");
  if (cache.has(key)) return cache.get(key) ?? null;
  const run = async (): Promise<Buffer | null> => {
    const page = await getPage(scale);
    if (!page) return null;
    try {
      await page.evaluate(
        `(() => {
          const host = document.getElementById("host");
          host.innerHTML = ${JSON.stringify(svg)};
          const el = host.firstElementChild;
          if (el) { el.setAttribute("width", "${width}"); el.setAttribute("height", "${height}"); }
          return document.fonts.ready.then(() => true);
        })()`
      );
      const el = page.locator("#host > *").first();
      const buf =
        format.type === "jpeg"
          ? await el.screenshot({ type: "jpeg", quality: format.quality, scale: "device", animations: "disabled" })
          : await el.screenshot({ type: "png", omitBackground: true, scale: "device", animations: "disabled" });
      return Buffer.from(buf);
    } catch {
      return null;
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  const buf = await result;
  if (cache.size > 400) cache.clear();
  cache.set(key, buf);
  return buf;
}

/** PNG pixel size from the IHDR chunk (for the brand assets' aspect ratios). */
export function pngSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return { width: 1, height: 1 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
