// CR08 5.5: the SVG designs the template rasterises through png.ts so exact
// typography (Sora, Noto Kufi Arabic, IBM Plex Sans Arabic) survives
// Word: the cover band with its Ascent Line pattern, section numerals, KPI
// tile rows, key figures, trend glyphs and the closing page. Text that wraps
// sits in <foreignObject> so the browser measures and wraps it; numbers and
// axes are plain SVG text. Every builder returns an SVG string sized in CSS px.
import fs from "node:fs";
import path from "node:path";
import type { KpiTile, Lang, Trend } from "../spec";
import { C, PX, esc, hex, isAr, toneColour } from "./theme";
import { pngSize as readPngSize } from "./png";

/* ------------------------------------------------------------------ */
/* Brand assets                                                        */
/* ------------------------------------------------------------------ */

export type Assets = {
  siaWhite: Buffer | null; // Sia logo, white lettering on a navy ground
  siaColour: Buffer | null; // Sia logo, colour on transparent
  wordmark: Buffer | null; // EnviroAI wordmark, ink on transparent
  wordmarkWhite: Buffer | null; // EnviroAI wordmark, white on transparent
};

function readBrand(file: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "brand", file));
  } catch {
    return null;
  }
}

let assetsCache: Assets | null = null;
export function loadAssets(): Assets {
  if (!assetsCache) {
    assetsCache = {
      siaWhite: readBrand("Sia_logo_white.png"),
      siaColour: readBrand("Sia_logo_transparent.png"),
      wordmark: readBrand("EnviroAI_logo_transparent.png"),
      wordmarkWhite: readBrand("EnviroAI_logo_white.png"),
    };
  }
  return assetsCache;
}

export const aspect = (buf: Buffer | null, fallback = 2.94): number => {
  if (!buf) return fallback;
  const s = readPngSize(buf);
  return s.height ? s.width / s.height : fallback;
};

const dataUri = (buf: Buffer | null): string => (buf ? `data:image/png;base64,${buf.toString("base64")}` : "");

/* ------------------------------------------------------------------ */
/* Fonts and shared fragments                                          */
/* ------------------------------------------------------------------ */

// Font stacks use single quotes: they are interpolated into double-quoted
// style and font-family attributes.
const SANS = (lang: Lang) => (isAr(lang) ? "'IBM Plex Sans Arabic', 'Sora', sans-serif" : "'Sora', 'Segoe UI', sans-serif");
const DISPLAY = (lang: Lang) =>
  isAr(lang) ? "'Noto Kufi Arabic', 'IBM Plex Sans Arabic', sans-serif" : "'Sora', 'Segoe UI', sans-serif";
/** Numerals always set in Sora: the digits are the brand element. */
const NUMERAL = "'Sora', 'Segoe UI', sans-serif";

const XHTML = 'xmlns="http://www.w3.org/1999/xhtml"';

/** The Sia Ascent Line: thin slashes at 64 degrees on a 36px tile. Used at 8
    percent opacity over navy. */
export function ascentPattern(id = "ascent", colour = "#FFFFFF"): string {
  return `<pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
  <path d="M0 0 V36" fill="none" stroke="${colour}" stroke-width="1.2"/>
</pattern>`;
}

function titleSize(text: string, lang: Lang): number {
  const n = text.length;
  if (isAr(lang)) return n <= 30 ? 44 : n <= 55 ? 38 : n <= 85 ? 32 : 28;
  return n <= 36 ? 52 : n <= 64 ? 44 : n <= 96 ? 36 : 30;
}

/* ------------------------------------------------------------------ */
/* Cover band: upper 55 percent of the page                            */
/* ------------------------------------------------------------------ */

export const COVER_BAND = { w: PX.pageW, h: Math.round(PX.pageH * 0.55) } as const;

export function coverBandSvg(o: {
  lang: Lang;
  title: string;
  subtitle?: string;
  period: string;
  yearMark: string;
  assets: Assets;
}): string {
  const { w, h } = COVER_BAND;
  const ar = isAr(o.lang);
  const pad = 60;
  const logoW = 190;
  const logoH = Math.round(logoW / aspect(o.assets.siaWhite));
  const logoX = ar ? w - pad - logoW : pad;
  const mark = o.yearMark.trim();
  const markSize = mark.length <= 4 ? 176 : mark.length <= 7 ? 118 : 92;
  const markX = ar ? pad : w - pad;
  const tSize = titleSize(o.title, o.lang);
  const textTop = 168;
  const textH = h - textTop - Math.round(markSize * 0.78) - 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>${ascentPattern("ascent")}</defs>
<rect width="${w}" height="${h}" fill="${hex(C.navy)}"/>
<rect width="${w}" height="${h}" fill="url(#ascent)" opacity="0.08"/>
${o.assets.siaWhite ? `<image href="${dataUri(o.assets.siaWhite)}" x="${logoX}" y="52" width="${logoW}" height="${logoH}"/>` : ""}
<foreignObject x="${pad}" y="${textTop}" width="${w - pad * 2}" height="${textH}">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="font-family:${SANS(o.lang)};color:#FFFFFF;height:${textH}px;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden">
    <div style="font-family:${DISPLAY(o.lang)};font-weight:600;font-size:${tSize}px;line-height:${ar ? 1.45 : 1.1};letter-spacing:${ar ? 0 : "-0.01em"};max-width:${ar ? 620 : 600}px">${esc(o.title)}</div>
    ${o.subtitle ? `<div style="font-size:${ar ? 18 : 17}px;line-height:1.4;margin-top:16px;opacity:0.88;max-width:520px">${esc(o.subtitle)}</div>` : ""}
    <div style="font-size:${ar ? 15 : 12.5}px;line-height:1.3;margin-top:${o.subtitle ? 14 : 22}px;letter-spacing:${ar ? 0 : "0.16em"};text-transform:uppercase;font-weight:500;opacity:0.78">${esc(o.period)}</div>
  </div>
</foreignObject>
<text x="${markX}" y="${h - 16}" text-anchor="${ar ? "start" : "end"}" font-family="${NUMERAL}" font-weight="700" font-size="${markSize}" fill="${hex(C.aqua)}" letter-spacing="-0.02em">${esc(mark)}</text>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Section numeral (navy-100, beside the title)                      */
/* ------------------------------------------------------------------ */

export const NUMERAL_IMG = { w: 236, h: 176 } as const;

export function numeralSvg(numeral: string): string {
  const { w, h } = NUMERAL_IMG;
  const size = numeral.length <= 2 ? 196 : 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<text x="-4" y="${h - 14}" font-family="${NUMERAL}" font-weight="700" font-size="${size}" fill="${hex(C.navy100)}" letter-spacing="-0.04em">${esc(numeral)}</text>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* KPI tiles: a row of up to four                                      */
/* ------------------------------------------------------------------ */

export const KPI_ROW = { w: PX.textW, h: 112, gap: 13, perRow: 4 } as const;

function arrow(kind: "up" | "down" | "flat", colour: string): string {
  const d =
    kind === "up"
      ? "M2.5 8.5 L7.5 3.5 M4 3.5 H7.5 V7"
      : kind === "down"
        ? "M2.5 3.5 L7.5 8.5 M7.5 5 V8.5 H4"
        : "M2 6 H9";
  return `<svg width="11" height="12" viewBox="0 0 11 12" style="flex:none"><path d="${d}" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function deltaKind(delta: string | undefined): "up" | "down" | "flat" | null {
  if (!delta) return null;
  const s = delta.trim();
  if (/^[+▲↑]/.test(s)) return "up";
  if (/^[-−▼↓]/.test(s)) return "down";
  return "flat";
}

export function kpiRowSvg(tiles: KpiTile[], lang: Lang): string {
  const { w, h, gap, perRow } = KPI_ROW;
  const ar = isAr(lang);
  const tileW = Math.floor((w - gap * (perRow - 1)) / perRow);
  const parts = tiles.slice(0, perRow).map((tile, i) => {
    const x = ar ? w - (i + 1) * tileW - i * gap : i * (tileW + gap);
    const tone = hex(toneColour(tile.tone));
    const label = ar ? tile.label.ar || tile.label.en : tile.label.en || tile.label.ar;
    const vLen = tile.value.length;
    const vSize = vLen <= 5 ? 30 : vLen <= 8 ? 25 : vLen <= 11 ? 20 : 16;
    const kind = deltaKind(tile.delta);
    return `<g transform="translate(${x},0)">
<rect x="0.5" y="0.5" width="${tileW - 1}" height="${h - 1}" rx="8" fill="#FFFFFF" stroke="${hex(C.mistLine)}"/>
<foreignObject x="0" y="0" width="${tileW}" height="${h}">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="box-sizing:border-box;width:${tileW}px;height:${h}px;padding:11px 12px 10px;font-family:${SANS(lang)};display:flex;flex-direction:column;justify-content:space-between">
    <div style="font-size:${ar ? 11 : 10.5}px;line-height:1.25;font-weight:500;color:${hex(C.ink600)};max-height:27px;overflow:hidden">${esc(label)}</div>
    <div>
      <div style="width:24px;height:3px;border-radius:2px;background:${tone};margin-bottom:7px"></div>
      <div style="display:flex;align-items:baseline;gap:4px;white-space:nowrap"><span style="font-family:${NUMERAL};font-weight:600;font-size:${vSize}px;line-height:1;color:${hex(C.ink)};letter-spacing:-0.01em;unicode-bidi:plaintext">${esc(tile.value)}</span>${tile.unit ? `<span style="font-size:10px;color:${hex(C.ink600)};unicode-bidi:plaintext">${esc(tile.unit)}</span>` : ""}</div>
      <div style="height:14px;margin-top:6px;font-size:${ar ? 10 : 9.5}px;line-height:1;color:${hex(C.ink600)};display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden">${kind ? arrow(kind, tone) : ""}<span style="unicode-bidi:plaintext">${esc(tile.delta ?? "")}</span></div>
    </div>
  </div>
</foreignObject>
</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Key figure                                                          */
/* ------------------------------------------------------------------ */

export function keyFigureSvg(value: string, label: string, lang: Lang, width: number, opts: { onMaroon?: boolean } = {}): string {
  const ar = isAr(lang);
  const h = 96;
  const vSize = value.length <= 4 ? 54 : value.length <= 7 ? 46 : value.length <= 10 ? 38 : 30;
  const colour = opts.onMaroon ? "#FFFFFF" : hex(C.navy);
  const labelColour = opts.onMaroon ? "rgba(255,255,255,0.82)" : hex(C.ink600);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
<foreignObject x="0" y="0" width="${width}" height="${h}">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="box-sizing:border-box;width:${width}px;height:${h}px;font-family:${SANS(lang)};display:flex;flex-direction:column;justify-content:flex-end">
    <div style="font-family:${NUMERAL};font-weight:600;font-size:${vSize}px;line-height:1;color:${colour};letter-spacing:-0.02em;white-space:nowrap">${esc(value)}</div>
    <div style="font-size:${ar ? 13 : 12}px;line-height:1.3;margin-top:8px;color:${labelColour};max-height:32px;overflow:hidden">${esc(label)}</div>
  </div>
</foreignObject>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Trend glyphs for scorecards                                         */
/* ------------------------------------------------------------------ */

export const GLYPH = 12;

export function trendGlyphSvg(trend: Trend, colour: string): string {
  const d =
    trend === "up"
      ? "M2.5 9.5 L9.5 2.5 M4.5 2.5 H9.5 V7.5"
      : trend === "down"
        ? "M2.5 2.5 L9.5 9.5 M9.5 4.5 V9.5 H4.5"
        : "M2 6 H10";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GLYPH}" height="${GLYPH}" viewBox="0 0 12 12"><path d="${d}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ------------------------------------------------------------------ */
/* Closing page: full navy page                                      */
/* ------------------------------------------------------------------ */

export const CLOSING = { w: PX.pageW, h: PX.pageH - 3 } as const;

export function closingSvg(o: {
  lang: Lang;
  line: string;
  contact: string;
  classification: string;
  assets: Assets;
}): string {
  const { w, h } = CLOSING;
  const ar = isAr(o.lang);
  const pad = 60;
  const logoW = 190;
  const logoH = Math.round(logoW / aspect(o.assets.siaWhite));
  const logoX = ar ? w - pad - logoW : pad;
  const wmW = 220;
  // the wordmark on navy is the transparent mark turned white through a
  // colour matrix (the "white" PNG asset is the ink mark on a white ground)
  const wm = o.assets.wordmark ?? o.assets.wordmarkWhite;
  const wmH = Math.round(wmW / aspect(wm, 6.63));
  const chipW = Math.max(96, o.classification.length * (ar ? 9 : 8) + 36);
  const chipX = ar ? w - pad - chipW : pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>${ascentPattern("ascent2")}<filter id="toWhite" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter></defs>
<rect width="${w}" height="${h}" fill="${hex(C.navy)}"/>
<rect width="${w}" height="${h}" fill="url(#ascent2)" opacity="0.08"/>
<rect x="0" y="${h - 220}" width="${w}" height="220" fill="${hex(C.navyDark)}" opacity="0.55"/>
${o.assets.siaWhite ? `<image href="${dataUri(o.assets.siaWhite)}" x="${logoX}" y="56" width="${logoW}" height="${logoH}"/>` : ""}
${wm ? `<image href="${dataUri(wm)}" x="${(w - wmW) / 2}" y="${Math.round(h * 0.44)}" width="${wmW}" height="${wmH}" filter="url(#toWhite)"/>` : ""}
<foreignObject x="${(w - 480) / 2}" y="${Math.round(h * 0.44) + wmH + 26}" width="480" height="90">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="font-family:${SANS(o.lang)};font-size:${ar ? 16 : 15}px;line-height:1.5;color:rgba(255,255,255,0.86);text-align:center">${esc(o.line)}</div>
</foreignObject>
<foreignObject x="${pad}" y="${h - 150}" width="${w - pad * 2}" height="40">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="font-family:${SANS(o.lang)};font-size:${ar ? 14 : 12.5}px;line-height:1.4;color:rgba(255,255,255,0.72)">${esc(o.contact)}</div>
</foreignObject>
<rect x="${chipX}" y="${h - 100}" width="${chipW}" height="30" rx="15" fill="none" stroke="rgba(255,255,255,0.55)"/>
<foreignObject x="${chipX}" y="${h - 100}" width="${chipW}" height="30">
  <div ${XHTML} dir="${ar ? "rtl" : "ltr"}" style="font-family:${SANS(o.lang)};font-size:${ar ? 12 : 10.5}px;line-height:30px;letter-spacing:${ar ? 0 : "0.14em"};text-transform:uppercase;font-weight:600;color:#FFFFFF;text-align:center">${esc(o.classification)}</div>
</foreignObject>
</svg>`;
}
