// CR08 5.5: every Block kind of spec.ts rendered to docx elements, plus the
// two-column narrative flow (a borderless three-cell table per page: column,
// gutter, column) with run-in headings. Arabic runs carry Sakkal Majalla in
// every font slot with rtl on, digits stay in left-to-right runs so they
// render as Western numerals, and paragraphs are bidirectional. Alignment
// uses LEFT for start and RIGHT for end because Word reads both logically in
// a bidi paragraph (the preview page swaps them for RTL, see preview.ts).
import {
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type ITableBordersOptions,
  type ITableCellOptions,
  type TableOfContents,
} from "docx";
import type { Block, ChartSpec, KpiTile, Lang, Rag, SourceItem, Trend } from "../spec";
import { CHART, chartSvg, fmtNum } from "./charts";
import { svgToPng } from "./png";
import { KPI_ROW, GLYPH, keyFigureSvg, kpiRowSvg, trendGlyphSvg, type Assets } from "./svg";
import { C, COL_GAP, COL_W, FONT, LINE, PX, SIZE, TEXT_W, isAr, pick, pxToTwips, t, toneColour, toneTint } from "./theme";

export type FileChild = Paragraph | Table | TableOfContents;

export type Ctx = {
  lang: Lang;
  /** a rasteriser (Playwright + Edge) is available */
  raster: boolean;
  assets: Assets;
  /** next numbering instance for a restarted numbered list */
  listInstance: () => number;
  /** small trend glyph PNGs, cached per document */
  glyph: (trend: Trend, colour: string) => Promise<Buffer | null>;
};

/* ------------------------------------------------------------------ */
/* Runs and paragraphs                                                 */
/* ------------------------------------------------------------------ */

export type RunOpts = {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  /** half-points */
  size?: number;
  font?: "body" | "head" | "serif" | string;
  caps?: boolean;
  spacing?: number;
  shading?: string;
};

function fontName(lang: Lang, font: RunOpts["font"]): string {
  if (isAr(lang)) return FONT.arBody;
  if (font === "serif") return FONT.enSerif;
  if (font === "head") return FONT.enHead;
  if (font && font !== "body") return font;
  return FONT.enBody;
}

/** Splits Arabic text so digit groups sit in left-to-right runs. */
function segments(text: string): { text: string; ltr: boolean }[] {
  const out: { text: string; ltr: boolean }[] = [];
  const re = /[0-9][0-9.,%:/-]*[0-9%]|[0-9]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), ltr: false });
    out.push({ text: m[0], ltr: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), ltr: false });
  return out.length ? out : [{ text, ltr: false }];
}

export function runs(ctx: Ctx, text: string, o: RunOpts = {}): TextRun[] {
  const lang = ctx.lang;
  const size = o.size ?? SIZE.body[lang];
  const name = fontName(lang, o.font);
  const common = {
    bold: o.bold,
    italics: o.italics,
    color: o.color ?? C.ink,
    size,
    allCaps: o.caps,
    characterSpacing: o.spacing,
    shading: o.shading ? { type: ShadingType.CLEAR, fill: o.shading, color: "auto" } : undefined,
  };
  if (!isAr(lang)) {
    return [new TextRun({ ...common, text, font: name, language: { value: "en-GB" } })];
  }
  return segments(text).map(
    (seg) =>
      new TextRun({
        ...common,
        text: seg.text,
        font: { ascii: name, hAnsi: name, cs: name, eastAsia: name },
        rightToLeft: seg.ltr ? undefined : true,
        sizeComplexScript: true,
        boldComplexScript: o.bold,
        italicsComplexScript: o.italics,
        language: { value: "ar-SA", bidirectional: "ar-SA" },
      })
  );
}

export type Align = "start" | "end" | "center" | "both";

export type ParaOpts = {
  align?: Align;
  before?: number;
  after?: number;
  /** 240ths of a line */
  line?: number;
  indentStart?: number;
  indentEnd?: number;
  hanging?: number;
  keepNext?: boolean;
  keepLines?: boolean;
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  border?: { start?: IBorderOptions; top?: IBorderOptions; bottom?: IBorderOptions };
  shading?: string;
  numbering?: { reference: string; level: number; instance?: number };
  pageBreakBefore?: boolean;
  tabStops?: { type: "left" | "right" | "center"; position: number; leader?: "dot" | "none" }[];
};

function alignment(lang: Lang, a: Align | undefined) {
  if (!a || a === "start") return isAr(lang) ? undefined : AlignmentType.LEFT;
  if (a === "end") return AlignmentType.RIGHT;
  if (a === "center") return AlignmentType.CENTER;
  return AlignmentType.BOTH;
}

export function para(ctx: Ctx, children: (TextRun | ImageRun | ExternalHyperlink)[], o: ParaOpts = {}): Paragraph {
  const ar = isAr(ctx.lang);
  const border = o.border
    ? {
        ...(o.border.start ? (ar ? { right: o.border.start } : { left: o.border.start }) : {}),
        ...(o.border.top ? { top: o.border.top } : {}),
        ...(o.border.bottom ? { bottom: o.border.bottom } : {}),
      }
    : undefined;
  return new Paragraph({
    children,
    bidirectional: ar ? true : undefined,
    alignment: alignment(ctx.lang, o.align),
    heading: o.heading,
    keepNext: o.keepNext,
    keepLines: o.keepLines,
    pageBreakBefore: o.pageBreakBefore,
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? LINE[ctx.lang], lineRule: LineRuleType.AUTO },
    indent:
      o.indentStart || o.indentEnd || o.hanging
        ? { left: o.indentStart ?? 0, right: o.indentEnd ?? 0, hanging: o.hanging }
        : undefined,
    border,
    shading: o.shading ? { type: ShadingType.CLEAR, fill: o.shading, color: "auto" } : undefined,
    numbering: o.numbering,
    tabStops: o.tabStops?.map((s) => ({ type: s.type, position: s.position, leader: s.leader })),
  });
}

export const text = (ctx: Ctx, s: string, r: RunOpts = {}, p: ParaOpts = {}) => para(ctx, runs(ctx, s, r), p);

export function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });
}

export const spacer = (twips = 120) => new Paragraph({ children: [], spacing: { before: 0, after: twips } });

export function image(data: Buffer, width: number, height: number, alt = "figure"): ImageRun {
  return new ImageRun({
    type: "png",
    data,
    transformation: { width, height },
    altText: { title: alt, description: alt, name: alt },
  });
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: C.white };
export const NO_BORDERS: ITableBordersOptions = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
};
const HAIR: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: C.mistLine };
export const ROW_LINES: ITableBordersOptions = {
  top: NONE,
  bottom: HAIR,
  left: NONE,
  right: NONE,
  insideHorizontal: HAIR,
  insideVertical: NONE,
};

export type CellOpts = {
  fill?: string;
  width?: number;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  vAlign?: "top" | "center" | "bottom";
  borders?: ITableCellOptions["borders"];
  span?: number;
};

export function cell(children: (Paragraph | Table)[], o: CellOpts = {}): TableCell {
  return new TableCell({
    children: children.length ? children : [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })],
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120, ...(o.margins ?? {}) },
    verticalAlign:
      o.vAlign === "bottom" ? VerticalAlignTable.BOTTOM : o.vAlign === "center" ? VerticalAlignTable.CENTER : VerticalAlignTable.TOP,
    borders: o.borders,
    columnSpan: o.span,
  });
}

export function table(ctx: Ctx, rows: TableRow[], widths: number[], borders: ITableBordersOptions = NO_BORDERS): Table {
  return new Table({
    rows,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    visuallyRightToLeft: isAr(ctx.lang) ? true : undefined,
  });
}

/** Column widths for a data table: the first column wider when 3+ columns. */
function columnWidths(n: number, total = TEXT_W): number[] {
  if (n <= 0) return [total];
  if (n <= 2) return Array(n).fill(Math.floor(total / n));
  const first = Math.floor(total * (n >= 5 ? 0.3 : 0.36));
  const rest = Math.floor((total - first) / (n - 1));
  return [first, ...Array(n - 1).fill(rest)];
}

/* ------------------------------------------------------------------ */
/* Block renderers                                                     */
/* ------------------------------------------------------------------ */

export function headingBlock(ctx: Ctx, level: 2 | 3, s: string): Paragraph {
  if (level === 2) {
    return para(ctx, runs(ctx, s, { bold: true, color: C.navy, size: SIZE.h2[ctx.lang], font: "head" }), {
      heading: HeadingLevel.HEADING_2,
      before: 260,
      after: 80,
      keepNext: true,
      line: 240,
    });
  }
  return para(ctx, runs(ctx, s, { bold: true, color: C.ink, size: SIZE.h3[ctx.lang], font: "head" }), {
    heading: HeadingLevel.HEADING_3,
    before: 160,
    after: 40,
    keepNext: true,
    line: 240,
  });
}

export function paragraphBlock(ctx: Ctx, s: string, style: "body" | "lead" | "note" = "body"): Paragraph {
  if (style === "lead") {
    return text(ctx, s, { font: "serif", size: SIZE.lead[ctx.lang], color: C.ink600 }, { after: 200, line: isAr(ctx.lang) ? 340 : 320 });
  }
  if (style === "note") {
    return text(ctx, s, { size: SIZE.small[ctx.lang], color: C.ink600, italics: !isAr(ctx.lang) }, { after: 100 });
  }
  return text(ctx, s, {}, { after: 120 });
}

/** Run-in heading: a bold navy lead-in followed by the paragraph text. */
export function runInParagraph(ctx: Ctx, head: string, body: string): Paragraph {
  const sep = isAr(ctx.lang) ? "  " : "  ";
  return para(ctx, [...runs(ctx, head.replace(/[.:]\s*$/, "") + ".", { bold: true, color: C.navy }), ...runs(ctx, sep + body)], {
    after: 120,
  });
}

export function listBlock(ctx: Ctx, items: string[], kind: "bullets" | "numbered"): Paragraph[] {
  const instance = kind === "numbered" ? ctx.listInstance() : undefined;
  return items.map((s) =>
    para(ctx, runs(ctx, s), {
      numbering: { reference: kind === "numbered" ? "report-numbers" : "report-bullets", level: 0, instance },
      after: 60,
    })
  );
}

export function quoteBlock(ctx: Ctx, s: string, attribution?: string, width = TEXT_W): Table {
  const ar = isAr(ctx.lang);
  const gold: IBorderOptions = { style: BorderStyle.SINGLE, size: 24, color: C.aqua };
  const narrow = width < TEXT_W * 0.7;
  const children = [
    text(ctx, s, { font: "serif", size: (ar ? 30 : 26) - (narrow ? 2 : 0), color: C.navyDark }, { after: attribution ? 80 : 0, line: ar ? 340 : 320 }),
  ];
  if (attribution) children.push(text(ctx, attribution, { size: SIZE.small[ctx.lang], color: C.ink600, bold: true }, { after: 0 }));
  const pad = narrow ? 180 : 260;
  const row = new TableRow({
    cantSplit: true,
    children: [
      cell(children, {
        fill: C.mist,
        width,
        margins: { top: narrow ? 160 : 200, bottom: narrow ? 160 : 200, left: ar ? pad - 40 : pad, right: ar ? pad : pad - 40 },
        borders: { top: NONE, bottom: NONE, left: ar ? NONE : gold, right: ar ? gold : NONE },
      }),
    ],
  });
  return table(ctx, [row], [width]);
}

export function calloutBlock(ctx: Ctx, textS: string, title?: string, tone?: KpiTile["tone"], width = TEXT_W): Table {
  const children: Paragraph[] = [];
  if (title) children.push(text(ctx, title, { bold: true, color: toneColour(tone), size: SIZE.body[ctx.lang] + 2 }, { after: 60, keepNext: true }));
  children.push(text(ctx, textS, {}, { after: 0 }));
  const row = new TableRow({
    cantSplit: true,
    children: [cell(children, { fill: toneTint(tone), width, margins: { top: 180, bottom: 180, left: 220, right: 220 } })],
  });
  return table(ctx, [row], [width]);
}

export async function keyFigureBlock(ctx: Ctx, value: string, label: string, widthPx = PX.colW): Promise<Paragraph[]> {
  if (ctx.raster) {
    const png = await svgToPng(keyFigureSvg(value, label, ctx.lang, widthPx), widthPx, 96, 2);
    if (png) return [para(ctx, [image(png, widthPx, 96, `${value} ${label}`)], { before: 80, after: 160 })];
  }
  return [
    text(ctx, value, { bold: true, color: C.navy, size: 56, font: "head" }, { after: 20, line: 240, keepNext: true }),
    text(ctx, label, { size: SIZE.small[ctx.lang], color: C.ink600 }, { after: 160 }),
  ];
}

function headerCell(ctx: Ctx, s: string, width: number, align: Align): TableCell {
  return cell([text(ctx, s, { bold: true, color: C.white, size: SIZE.small[ctx.lang] }, { align, after: 0, line: 240 })], {
    fill: C.navy,
    width,
    margins: { top: 100, bottom: 100 },
  });
}

function bodyCell(ctx: Ctx, s: string, width: number, align: Align, fill: string, extra: { color?: string; bold?: boolean; glyph?: ImageRun | null } = {}): TableCell {
  const children: (TextRun | ImageRun)[] = runs(ctx, s, { size: SIZE.small[ctx.lang], color: extra.color, bold: extra.bold });
  if (extra.glyph) children.push(new TextRun({ text: " " }), extra.glyph);
  return cell([para(ctx, children, { align, after: 0, line: 250 })], { fill, width, vAlign: "center" });
}

export function tableBlock(ctx: Ctx, b: Extract<Block, { kind: "table" }>): FileChild[] {
  const out: FileChild[] = [];
  const widths = columnWidths(b.columns.length);
  if (b.caption) out.push(text(ctx, pick(b.caption, ctx.lang), { bold: true, size: SIZE.small[ctx.lang], color: C.ink }, { before: 120, after: 80, keepNext: true }));
  const aligns = b.columns.map((_, i) => b.align?.[i] ?? "start");
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: b.columns.map((c, i) => headerCell(ctx, pick(c, ctx.lang), widths[i], aligns[i])),
  });
  const rows = b.rows.map(
    (r, ri) =>
      new TableRow({
        cantSplit: true,
        children: b.columns.map((_, i) => bodyCell(ctx, pick(r[i], ctx.lang), widths[i], aligns[i], ri % 2 === 1 ? C.mist : C.white)),
      })
  );
  out.push(table(ctx, [header, ...rows], widths, ROW_LINES));
  if (b.source) out.push(sourceLine(ctx, pick(b.source, ctx.lang)));
  else out.push(spacer(120));
  return out;
}

export function sourceLine(ctx: Ctx, s: string): Paragraph {
  return text(ctx, `${t(ctx.lang, "source")}: ${s}`, { size: SIZE.tiny[ctx.lang], color: C.ink400 }, { before: 60, after: 160 });
}

function ragColours(rag: Rag | undefined): { fill: string; color: string } {
  switch (rag) {
    case "green":
      return { fill: C.okLight, color: C.ok };
    case "amber":
      return { fill: C.warnLight, color: C.warn };
    case "red":
      return { fill: C.dangerLight, color: C.danger };
    default:
      return { fill: C.white, color: C.ink };
  }
}

export async function scorecardBlock(ctx: Ctx, b: Extract<Block, { kind: "scorecard" }>): Promise<FileChild[]> {
  const out: FileChild[] = [];
  const cols = [{ en: "", ar: "" }, ...b.columns];
  const widths = columnWidths(cols.length);
  if (b.caption) out.push(text(ctx, pick(b.caption, ctx.lang), { bold: true, size: SIZE.small[ctx.lang], color: C.ink }, { before: 120, after: 80, keepNext: true }));
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: cols.map((c, i) => headerCell(ctx, pick(c, ctx.lang), widths[i], i === 0 ? "start" : "center")),
  });
  const rows: TableRow[] = [];
  for (const [ri, r] of b.rows.entries()) {
    const band = ri % 2 === 1 ? C.mist : C.white;
    const cells: TableCell[] = [bodyCell(ctx, pick(r.label, ctx.lang), widths[0], "start", band, { bold: true })];
    for (const [i, c] of r.cells.entries()) {
      const rag = ragColours(c.rag);
      const fill = c.rag && c.rag !== "none" ? rag.fill : band;
      let glyph: ImageRun | null = null;
      if (c.trend) {
        const png = await ctx.glyph(c.trend, c.rag && c.rag !== "none" ? rag.color : C.ink600);
        if (png) glyph = image(png, GLYPH, GLYPH, c.trend);
        else glyph = null;
      }
      const label = c.text + (c.trend && !glyph ? (c.trend === "up" ? " ↗" : c.trend === "down" ? " ↘" : " →") : "");
      cells.push(bodyCell(ctx, label, widths[i + 1], "center", fill, { color: rag.color, bold: Boolean(c.rag && c.rag !== "none"), glyph }));
    }
    rows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  out.push(table(ctx, [header, ...rows], widths, ROW_LINES));
  // legend: three tinted chips
  const legend: (TextRun | ImageRun)[] = [];
  const chip = (fill: string, color: string, label: string) => [
    ...runs(ctx, `  ${label}  `, { size: SIZE.tiny[ctx.lang], color, bold: true, shading: fill }),
    new TextRun({ text: "   " }),
  ];
  legend.push(...chip(C.okLight, C.ok, t(ctx.lang, "ragOn")), ...chip(C.warnLight, C.warn, t(ctx.lang, "ragRisk")), ...chip(C.dangerLight, C.danger, t(ctx.lang, "ragBehind")));
  out.push(para(ctx, legend, { before: 100, after: b.source ? 0 : 160 }));
  if (b.source) out.push(sourceLine(ctx, pick(b.source, ctx.lang)));
  return out;
}

/** Native fallback for a chart: the CR02 shaded-bar table of the first series. */
function chartFallback(ctx: Ctx, spec: ChartSpec): FileChild[] {
  const s = spec.series[0];
  if (!s) return [];
  const pts = s.points.filter((p) => p.y != null).slice(-10) as { x: string; y: number }[];
  const max = Math.max(1, ...pts.map((p) => Math.abs(p.y)));
  const widths = [Math.floor(TEXT_W * 0.2), Math.floor(TEXT_W * 0.6), Math.floor(TEXT_W * 0.2)];
  const rows = pts.map((p) => {
    const pct = Math.max(2, Math.round((Math.abs(p.y) / max) * 100));
    // a negative value keeps its magnitude but reads in ink, not navy
    const fill = p.y < 0 ? C.ink200 : C.navy;
    const bar = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: pct, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, children: [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })] }),
            new TableCell({ width: { size: 100 - pct, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: C.mist, color: "auto" }, children: [new Paragraph({ children: [], spacing: { before: 0, after: 0 } })] }),
          ],
        }),
      ],
    });
    return new TableRow({
      children: [
        bodyCell(ctx, p.x, widths[0], "start", C.white),
        cell([bar], { width: widths[1], margins: { top: 60, bottom: 60 } }),
        bodyCell(ctx, `${fmtNum(p.y)}${spec.unit ? ` ${spec.unit}` : ""}`, widths[2], "end", C.white),
      ],
    });
  });
  return [table(ctx, rows, widths)];
}

export async function chartBlock(ctx: Ctx, spec: ChartSpec, opts: { title?: boolean } = {}): Promise<FileChild[]> {
  const out: FileChild[] = [];
  if (opts.title !== false) {
    out.push(text(ctx, pick(spec.title, ctx.lang), { bold: true, color: C.navy, size: SIZE.h2[ctx.lang] - 2, font: "head" }, { before: 200, after: 120, keepNext: true, line: 240 }));
  }
  let png: Buffer | null = null;
  if (ctx.raster) png = await svgToPng(chartSvg(spec, ctx.lang, CHART.w, CHART.h), CHART.w, CHART.h, 2);
  if (png) out.push(para(ctx, [image(png, CHART.w, CHART.h, pick(spec.title, ctx.lang))], { after: 100, keepNext: true }));
  else out.push(...chartFallback(ctx, spec));
  if (spec.note) out.push(text(ctx, `${t(ctx.lang, "note")}: ${pick(spec.note, ctx.lang)}`, { size: SIZE.small[ctx.lang], color: C.ink600 }, { after: 40 }));
  if (spec.source) out.push(sourceLine(ctx, pick(spec.source, ctx.lang)));
  else out.push(spacer(120));
  return out;
}

export async function figureBlock(ctx: Ctx, b: Extract<Block, { kind: "figure" }>, maxWidth = PX.textW): Promise<FileChild[]> {
  const out: FileChild[] = [];
  let png: Buffer | null = null;
  let w = Math.min(maxWidth, b.widthPx ?? maxWidth);
  let h = b.heightPx ?? Math.round(w * 0.56);
  if (b.pngBase64) {
    try {
      png = Buffer.from(b.pngBase64, "base64");
      const size = pngDims(png);
      if (size) {
        const ratio = size.h / size.w;
        w = Math.min(maxWidth, b.widthPx ?? Math.round(size.w / 2));
        h = Math.round(w * ratio);
      }
    } catch {
      png = null;
    }
  } else if (b.svg && ctx.raster) {
    const sw = b.widthPx ?? maxWidth;
    const sh = b.heightPx ?? Math.round(sw * 0.56);
    png = await svgToPng(b.svg, sw, sh, 2);
    w = Math.min(maxWidth, sw);
    h = Math.round((w / sw) * sh);
  }
  if (png) out.push(para(ctx, [image(png, w, h, pick(b.caption, ctx.lang))], { after: 80, keepNext: true }));
  else out.push(text(ctx, t(ctx.lang, "figureMissing"), { size: SIZE.small[ctx.lang], color: C.ink400, italics: true }, { after: 80 }));
  out.push(text(ctx, `${t(ctx.lang, "figure")}. ${pick(b.caption, ctx.lang)}`, { size: SIZE.small[ctx.lang], color: C.ink600, bold: true }, { after: 40 }));
  if (b.source) out.push(sourceLine(ctx, pick(b.source, ctx.lang)));
  else out.push(spacer(120));
  return out;
}

function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

export function sourcesBlock(ctx: Ctx, items: SourceItem[]): Paragraph[] {
  return items.map((s) => {
    const children: (TextRun | ExternalHyperlink)[] = [
      ...runs(ctx, `[${s.n}]`, { bold: true, color: C.navy, size: SIZE.small[ctx.lang] }),
      new TextRun({ text: "\t" }),
      ...runs(ctx, s.title, { size: SIZE.small[ctx.lang] }),
    ];
    if (s.detail) children.push(...runs(ctx, `. ${s.detail}`, { size: SIZE.small[ctx.lang], color: C.ink600 }));
    if (s.url) {
      children.push(new TextRun({ text: " " }));
      children.push(
        new ExternalHyperlink({
          link: s.url,
          children: [new TextRun({ text: s.url, font: FONT.enBody, size: SIZE.tiny[ctx.lang], color: C.teal, underline: {} })],
        })
      );
    }
    return para(ctx, children, { indentStart: 560, hanging: 560, after: 80, tabStops: [{ type: "left", position: 560 }] });
  });
}

export async function kpisBlock(ctx: Ctx, tiles: KpiTile[]): Promise<FileChild[]> {
  const out: FileChild[] = [];
  const rows: KpiTile[][] = [];
  for (let i = 0; i < tiles.length; i += KPI_ROW.perRow) rows.push(tiles.slice(i, i + KPI_ROW.perRow));
  for (const row of rows) {
    let png: Buffer | null = null;
    if (ctx.raster) png = await svgToPng(kpiRowSvg(row, ctx.lang), KPI_ROW.w, KPI_ROW.h, 2);
    if (png) {
      out.push(para(ctx, [image(png, KPI_ROW.w, KPI_ROW.h, "KPI tiles")], { after: pxToTwips(KPI_ROW.gap), line: 240 }));
      continue;
    }
    // native fallback: shaded cells
    const widths = Array(KPI_ROW.perRow).fill(Math.floor(TEXT_W / KPI_ROW.perRow));
    const cells = row.map((k, i) =>
      cell(
        [
          text(ctx, pick(k.label, ctx.lang), { size: SIZE.tiny[ctx.lang], color: C.ink600 }, { after: 40, line: 240 }),
          text(ctx, `${k.value}${k.unit ? ` ${k.unit}` : ""}`, { bold: true, size: 40, color: C.ink, font: "head" }, { after: 40, line: 240 }),
          text(ctx, k.delta ?? "", { size: SIZE.tiny[ctx.lang], color: C.ink600 }, { after: 0, line: 240 }),
        ],
        { fill: C.mist, width: widths[i], margins: { top: 140, bottom: 140, left: 160, right: 160 } }
      )
    );
    while (cells.length < KPI_ROW.perRow) cells.push(cell([], { width: widths[cells.length] }));
    out.push(table(ctx, [new TableRow({ children: cells })], widths));
    out.push(spacer(120));
  }
  return out;
}

export function draftBanner(ctx: Ctx): Table {
  const s = t(ctx.lang, "draftNotice");
  const [lead, ...rest] = s.split(". ");
  const row = new TableRow({
    cantSplit: true,
    children: [
      cell(
        [
          para(ctx, [...runs(ctx, `${lead}. `, { bold: true, color: C.warn, size: SIZE.small[ctx.lang] }), ...runs(ctx, rest.join(". "), { color: C.warn, size: SIZE.small[ctx.lang] })], {
            after: 0,
          }),
        ],
        { fill: C.aqua100, width: TEXT_W, margins: { top: 120, bottom: 120, left: 200, right: 200 } }
      ),
    ],
  });
  return table(ctx, [row], [TEXT_W]);
}

/* ------------------------------------------------------------------ */
/* Wide blocks and the two-column flow                                 */
/* ------------------------------------------------------------------ */

export const isWide = (b: Block) => b.kind === "table" || b.kind === "scorecard" || b.kind === "chart" || b.kind === "figure" || b.kind === "kpis";

/** Renders one block at full width (or at `widthPx` for the column case). */
export async function renderBlock(ctx: Ctx, b: Block, widthPx = PX.textW): Promise<(Paragraph | Table)[]> {
  const widthTw = pxToTwips(widthPx);
  switch (b.kind) {
    case "heading":
      return [headingBlock(ctx, b.level, pick(b.text, ctx.lang))];
    case "paragraph":
      return [paragraphBlock(ctx, pick(b.text, ctx.lang), b.style)];
    case "bullets":
      return listBlock(ctx, b.items.map((i) => pick(i, ctx.lang)), "bullets");
    case "numbered":
      return listBlock(ctx, b.items.map((i) => pick(i, ctx.lang)), "numbered");
    case "kpis":
      return (await kpisBlock(ctx, b.items)) as (Paragraph | Table)[];
    case "table":
      return tableBlock(ctx, b) as (Paragraph | Table)[];
    case "scorecard":
      return (await scorecardBlock(ctx, b)) as (Paragraph | Table)[];
    case "chart":
      return (await chartBlock(ctx, b.chart)) as (Paragraph | Table)[];
    case "quote": {
      const q = quoteBlock(ctx, pick(b.text, ctx.lang), b.attribution ? pick(b.attribution, ctx.lang) : undefined, widthTw);
      return [q, spacer(120)];
    }
    case "callout":
      return [calloutBlock(ctx, pick(b.text, ctx.lang), b.title ? pick(b.title, ctx.lang) : undefined, b.tone, widthTw), spacer(120)];
    case "keyFigure":
      return keyFigureBlock(ctx, b.value, pick(b.label, ctx.lang), widthPx);
    case "figure":
      return (await figureBlock(ctx, b, widthPx)) as (Paragraph | Table)[];
    case "sources":
      return sourcesBlock(ctx, b.items);
    case "pageBreak":
      return [pageBreak()];
    default:
      return [];
  }
}

type FlowItem = { render: () => Promise<(Paragraph | Table)[]>; lines: number; heading: boolean };

const CHARS_PER_LINE = { en: 44, ar: 40 } as const;

/** Rough column lines a block takes, for balancing the two columns. */
export function estimateLines(b: Block, lang: Lang, cpl = CHARS_PER_LINE[lang]): number {
  const len = (s: string) => Math.ceil(Math.max(1, s.length) / cpl);
  switch (b.kind) {
    case "heading":
      return b.level === 2 ? 2.6 : 1.6;
    case "paragraph":
      return len(pick(b.text, lang)) * (b.style === "lead" ? 1.3 : 1) + 0.6;
    case "bullets":
    case "numbered":
      return b.items.reduce((a, i) => a + Math.ceil(Math.max(1, pick(i, lang).length) / (cpl - 6)) + 0.3, 0) + 0.4;
    case "quote":
      return len(pick(b.text, lang)) * 1.3 + 3.5;
    case "callout":
      return len(pick(b.text, lang)) + (b.title ? 1.5 : 0) + 3;
    case "keyFigure":
      return 6;
    case "sources":
      return b.items.length * 1.6;
    case "kpis":
      return Math.ceil(b.items.length / 4) * 7;
    case "table":
      return b.rows.length * 1.3 + 4;
    case "scorecard":
      return b.rows.length * 1.3 + 6;
    case "chart":
      return 24;
    case "figure":
      return Math.round((b.heightPx ?? 360) / 15) + 3;
    default:
      return 0;
  }
}

/** Two-column narrative flow: text blocks in balanced columns, wide blocks
    (tables, scorecards, charts, figures, KPI rows) at full width between. */
export async function flow(ctx: Ctx, blocks: Block[], opts: { budget?: number } = {}): Promise<FileChild[]> {
  // a short narrative (an intro of a few lines) reads better at full width
  const narrative = blocks.filter((b) => !isWide(b) && b.kind !== "pageBreak");
  if (narrative.length === blocks.length && narrative.reduce((a, b) => a + estimateLines(b, ctx.lang), 0) <= 9) {
    return column(ctx, blocks);
  }
  const out: FileChild[] = [];
  let pending: FlowItem[] = [];
  const flush = async () => {
    if (!pending.length) return;
    out.push(...(await twoColumns(ctx, pending, opts.budget ?? 42)));
    pending = [];
  };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (isWide(b)) {
      await flush();
      out.push(...(await renderBlock(ctx, b)));
      continue;
    }
    if (b.kind === "pageBreak") {
      await flush();
      out.push(pageBreak());
      continue;
    }
    const next = blocks[i + 1];
    if (b.kind === "heading" && b.level === 3 && next && next.kind === "paragraph" && (next.style ?? "body") === "body") {
      const head = pick(b.text, ctx.lang);
      const body = pick(next.text, ctx.lang);
      pending.push({ render: async () => [runInParagraph(ctx, head, body)], lines: Math.ceil((head.length + body.length) / CHARS_PER_LINE[ctx.lang]) + 0.6, heading: false });
      i++;
      continue;
    }
    pending.push({ render: () => renderBlock(ctx, b, PX.colW), lines: estimateLines(b, ctx.lang), heading: b.kind === "heading" });
  }
  await flush();
  return out;
}

async function twoColumns(ctx: Ctx, items: FlowItem[], budget: number): Promise<FileChild[]> {
  // paginate into [colA, colB] pairs by estimated lines, keeping headings with the next item
  const pages: FlowItem[][][] = [];
  let cols: FlowItem[][] = [];
  let col: FlowItem[] = [];
  let used = 0;
  const closeCol = () => {
    cols.push(col);
    col = [];
    used = 0;
    if (cols.length === 2) {
      pages.push(cols);
      cols = [];
    }
  };
  for (const it of items) {
    if (used > 0 && used + it.lines > budget) {
      const last = col[col.length - 1];
      if (last?.heading && col.length > 1) {
        col.pop();
        closeCol();
        col.push(last);
        used = last.lines;
      } else closeCol();
    }
    col.push(it);
    used += it.lines;
  }
  if (col.length) cols.push(col);
  if (cols.length) pages.push(cols);

  // balance a lone final column across both columns
  const last = pages[pages.length - 1];
  if (last && last.length === 1 && last[0].length > 1) {
    const total = last[0].reduce((a, i) => a + i.lines, 0);
    const a: FlowItem[] = [];
    const b: FlowItem[] = [];
    let acc = 0;
    for (const it of last[0]) {
      if (acc < total / 2 || a.length === 0) {
        a.push(it);
        acc += it.lines;
      } else b.push(it);
    }
    if (a.length && a[a.length - 1].heading && b.length) b.unshift(a.pop() as FlowItem);
    pages[pages.length - 1] = b.length ? [a, b] : [a];
  }

  const out: FileChild[] = [];
  for (const page of pages) {
    const colA: (Paragraph | Table)[] = [];
    for (const it of page[0]) colA.push(...(await it.render()));
    const colB: (Paragraph | Table)[] = [];
    for (const it of page[1] ?? []) colB.push(...(await it.render()));
    const row = new TableRow({
      children: [
        cell(colA, { width: COL_W, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        cell([], { width: COL_GAP, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        cell(colB, { width: COL_W, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
      ],
    });
    out.push(table(ctx, [row], [COL_W, COL_GAP, COL_W]));
    out.push(spacer(0));
  }
  return out;
}

/** Single-column rendering of blocks (scorecard pages, sources). */
export async function column(ctx: Ctx, blocks: Block[]): Promise<FileChild[]> {
  const out: FileChild[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.kind === "heading" && b.level === 3 && next && next.kind === "paragraph" && (next.style ?? "body") === "body") {
      out.push(runInParagraph(ctx, pick(b.text, ctx.lang), pick(next.text, ctx.lang)));
      i++;
      continue;
    }
    out.push(...(await renderBlock(ctx, b)));
  }
  return out;
}

export const glyphFactory = (): Ctx["glyph"] => {
  const cache = new Map<string, Promise<Buffer | null>>();
  return (trend: Trend, colour: string) => {
    const key = `${trend}:${colour}`;
    let p = cache.get(key);
    if (!p) {
      p = svgToPng(trendGlyphSvg(trend, `#${colour}`), GLYPH, GLYPH, 3);
      cache.set(key, p);
    }
    return p;
  };
};
