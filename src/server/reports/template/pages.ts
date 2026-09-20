// CR08 5.5: the page types. Each function takes the section and the render
// context and returns the docx children for that page design; docSection()
// wraps them in a docx section with the running header (report title, section
// name) and footer (classification, page number, SiaNexus). Cover and closing
// are full-bleed sections without chrome. Consecutive sections alternate the
// page height by one twip: docx-preview only starts a new page element when
// the page size changes, and one twip is invisible in Word.
import {
  BorderStyle,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  SectionType,
  Tab,
  TableOfContents,
  TableRow,
  TextRun,
  type ISectionOptions,
} from "docx";
import type { Block, Lang, ReportDocumentModel, SectionContent } from "../spec";
import { CLASSIFICATION_LABEL } from "../spec";
import {
  type Ctx,
  type FileChild,
  NO_BORDERS,
  ROW_LINES,
  calloutBlock,
  cell,
  chartBlock,
  column,
  draftBanner,
  estimateLines,
  flow,
  image,
  isWide,
  keyFigureBlock,
  kpisBlock,
  pageBreak,
  para,
  renderBlock,
  runs,
  sourcesBlock,
  spacer,
  table,
  text,
} from "./blocks";
import { svgToPng } from "./png";
import { CLOSING, COVER_BAND, NUMERAL_IMG, aspect, closingSvg, coverBandSvg, keyFigureSvg, numeralSvg } from "./svg";
import { C, FONT, PAGE, PX, SIZE, TEXT_W, fmtDate, isAr, pick, pxToTwips, t } from "./theme";

const classificationLabel = (n: number, lang: Lang) => pick(CLASSIFICATION_LABEL[Math.min(4, Math.max(1, n))], lang);

/* ------------------------------------------------------------------ */
/* Running header and footer                                           */
/* ------------------------------------------------------------------ */

function chrome(ctx: Ctx, model: ReportDocumentModel, sectionTitle: string): { header: Header; footer: Footer } {
  const size = SIZE.chrome[ctx.lang];
  const half = Math.floor(TEXT_W / 2);
  const third = Math.floor(TEXT_W / 3);
  const hairline = { style: BorderStyle.SINGLE, size: 4, color: C.sandLine };
  const header = new Header({
    children: [
      table(
        ctx,
        [
          new TableRow({
            children: [
              cell([text(ctx, pick(model.title, ctx.lang), { size, color: C.ink400 }, { after: 0, line: 240 })], { width: half, margins: { top: 0, bottom: 80, left: 0, right: 0 } }),
              cell([text(ctx, sectionTitle, { size, color: C.maroon, bold: true }, { align: "end", after: 0, line: 240 })], { width: half, margins: { top: 0, bottom: 80, left: 0, right: 0 } }),
            ],
          }),
        ],
        [half, half],
        { ...NO_BORDERS, bottom: hairline }
      ),
    ],
  });
  const pageRun = new TextRun({ children: [PageNumber.CURRENT], font: FONT.enBody, size, color: C.ink600 });
  const footer = new Footer({
    children: [
      table(
        ctx,
        [
          new TableRow({
            children: [
              cell([text(ctx, classificationLabel(model.classification, ctx.lang), { size, color: C.ink600, bold: true }, { after: 0, line: 240 })], { width: third, margins: { top: 80, bottom: 0, left: 0, right: 0 } }),
              cell([para(ctx, [pageRun], { align: "center", after: 0, line: 240 })], { width: third, margins: { top: 80, bottom: 0, left: 0, right: 0 } }),
              cell([text(ctx, "SiaNexus", { size, color: C.ink400, font: FONT.enBody }, { align: "end", after: 0, line: 240 })], { width: TEXT_W - third * 2, margins: { top: 80, bottom: 0, left: 0, right: 0 } }),
            ],
          }),
        ],
        [third, third, TEXT_W - third * 2],
        { ...NO_BORDERS, top: hairline }
      ),
    ],
  });
  return { header, footer };
}

/** Wraps page children in a docx section. */
export function docSection(
  ctx: Ctx,
  model: ReportDocumentModel,
  children: FileChild[],
  o: { index: number; title?: string; fullBleed?: boolean }
): ISectionOptions {
  const empty = { header: new Header({ children: [new Paragraph({ children: [] })] }), footer: new Footer({ children: [new Paragraph({ children: [] })] }) };
  const { header, footer } = o.fullBleed ? empty : chrome(ctx, model, o.title ?? "");
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: PAGE.w, height: PAGE.h + (o.index % 2) },
        margin: o.fullBleed
          ? { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 }
          : { top: PAGE.marginTop, bottom: PAGE.marginBottom, left: PAGE.marginSide, right: PAGE.marginSide, header: PAGE.header, footer: PAGE.footer, gutter: 0 },
      },
    },
    headers: { default: header },
    footers: { default: footer },
    children: children as ISectionOptions["children"],
  };
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

export async function coverPage(ctx: Ctx, model: ReportDocumentModel): Promise<FileChild[]> {
  const lang = ctx.lang;
  const out: FileChild[] = [];
  const title = pick(model.title, lang);
  const subtitle = model.subtitle ? pick(model.subtitle, lang) : undefined;
  const period = pick(model.periodLabel, lang);
  let band: Buffer | null = null;
  if (ctx.raster) {
    band = await svgToPng(coverBandSvg({ lang, title, subtitle, period, yearMark: model.yearMark, assets: ctx.assets }), COVER_BAND.w, COVER_BAND.h, 2);
  }
  if (band) {
    out.push(new Paragraph({ children: [image(band, COVER_BAND.w - 1, COVER_BAND.h, title)], spacing: { before: 0, after: 0, line: 240 } }));
  } else {
    // native fallback: a shaded band with the title in Calibri
    const children: Paragraph[] = [];
    if (ctx.assets.npcWhite) {
      children.push(new Paragraph({ children: [image(ctx.assets.npcWhite, 190, Math.round(190 / aspect(ctx.assets.npcWhite)), "National Planning Council")], spacing: { before: 0, after: 900 } }));
    }
    children.push(text(ctx, title, { bold: true, size: 64, color: C.white, font: "head" }, { after: 200, line: 240 }));
    if (subtitle) children.push(text(ctx, subtitle, { size: 28, color: C.maroon100 }, { after: 120 }));
    children.push(text(ctx, period, { size: 22, color: C.maroon100, caps: true, spacing: 30 }, { after: 1400 }));
    children.push(text(ctx, model.yearMark, { bold: true, size: 200, color: C.gold, font: "head" }, { align: "end", after: 0, line: 240 }));
    const row = new TableRow({
      children: [cell(children, { fill: C.maroon, width: PAGE.w, margins: { top: 800, bottom: 300, left: 900, right: 900 } })],
    });
    out.push(table(ctx, [row], [PAGE.w]));
  }

  // lower 45 percent: classification chip, type, optional key figure, wordmark, generated line
  const side = PAGE.marginSide;
  const chip = runs(ctx, `  ${classificationLabel(model.classification, lang)}  `, { bold: true, size: SIZE.small[lang], color: C.white, shading: C.maroon });
  const typeName = pick(model.typeName, lang);
  const chipLine = para(ctx, [...chip, new TextRun({ text: "    " }), ...runs(ctx, typeName, { size: SIZE.small[lang], color: C.ink600, bold: true })], {
    before: 560,
    after: 0,
    indentStart: side,
    indentEnd: side,
  });
  out.push(chipLine);
  const scope = pick(model.request.scope.label, lang);
  if (scope) {
    out.push(text(ctx, `${t(lang, "scope")}: ${scope}`, { size: SIZE.small[lang], color: C.ink600 }, { before: 120, after: 0, indentStart: side, indentEnd: side }));
  }
  let figureHeight = 0;
  if (model.coverFigure) {
    const value = model.coverFigure.value;
    const label = pick(model.coverFigure.label, lang);
    let fig: Buffer | null = null;
    if (ctx.raster) fig = await svgToPng(keyFigureSvg(value, label, lang, PX.colW), PX.colW, 96, 2);
    if (fig) {
      out.push(para(ctx, [image(fig, PX.colW, 96, `${value} ${label}`)], { before: 400, after: 0, indentStart: side, indentEnd: side, line: 240 }));
    } else {
      out.push(text(ctx, value, { bold: true, color: C.maroon, size: 56, font: "head" }, { before: 400, after: 20, line: 240, indentStart: side, indentEnd: side }));
      out.push(text(ctx, label, { size: SIZE.small[lang], color: C.ink600 }, { after: 0, indentStart: side, indentEnd: side }));
    }
    figureHeight = 1900;
  }
  const bottomBefore = Math.max(600, 4600 - figureHeight);
  const wm = ctx.assets.wordmark;
  if (wm) {
    const w = 120;
    out.push(para(ctx, [image(wm, w, Math.round(w / aspect(wm, 6.63)), "SiaNexus")], { before: bottomBefore, after: 100, indentStart: side, indentEnd: side, line: 240 }));
  } else {
    out.push(text(ctx, "SiaNexus", { bold: true, size: 26, color: C.ink }, { before: bottomBefore, after: 100, indentStart: side, indentEnd: side }));
  }
  out.push(text(ctx, `${t(lang, "generatedBy")}, ${fmtDate(model.generatedAt, lang)}`, { size: SIZE.small[lang], color: C.ink400 }, { after: 40, indentStart: side, indentEnd: side }));
  if (model.preparedBy) {
    out.push(text(ctx, `${t(lang, "preparedBy")}: ${pick(model.preparedBy, lang)}`, { size: SIZE.small[lang], color: C.ink600 }, { after: 0, indentStart: side, indentEnd: side }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Contents                                                            */
/* ------------------------------------------------------------------ */

export type PageEstimate = { code: string; start: number; pages: number };

/** Rough page count per section for the static contents list. */
export function estimatePages(s: SectionContent, lang: Lang): number {
  const lines = (blocks: Block[]) => blocks.reduce((a, b) => a + estimateLines(b, lang) * (isWide(b) ? 2 : 1), 0);
  switch (s.layout) {
    case "cover":
    case "contents":
    case "closing":
      return 1;
    case "opener":
      return 1 + (s.blocks.length ? Math.max(1, Math.ceil(lines(s.blocks) / 84)) : 0);
    case "glance":
      return Math.max(1, Math.ceil((lines(s.blocks) + 4) / 84));
    case "chart": {
      const charts = s.blocks.filter((b) => b.kind === "chart").length;
      const intro = s.blocks.filter((b) => b.kind !== "chart");
      return Math.max(1, charts + (intro.length ? 1 : 0));
    }
    case "scorecard":
      return Math.max(1, Math.ceil(lines(s.blocks) / 88));
    case "sources":
      return Math.max(1, Math.ceil(lines(s.blocks) / 44));
    default:
      return Math.max(1, Math.ceil((lines(s.blocks) + 6) / 84));
  }
}

export function estimateAll(model: ReportDocumentModel, lang: Lang): PageEstimate[] {
  let page = 1;
  return model.sections.map((s) => {
    const pages = estimatePages(s, lang);
    const e = { code: s.code, start: page, pages };
    page += pages;
    return e;
  });
}

export function contentsPage(ctx: Ctx, model: ReportDocumentModel, estimates: PageEstimate[]): FileChild[] {
  const lang = ctx.lang;
  const out: FileChild[] = [];
  out.push(
    text(ctx, t(lang, "contents"), { bold: true, size: SIZE.h1[lang], color: C.maroon, font: "head" }, {
      after: 360,
      line: 240,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.gold, space: 8 } },
    })
  );
  for (const s of model.sections) {
    if (s.layout === "cover" || s.layout === "contents") continue;
    const est = estimates.find((e) => e.code === s.code);
    const numeral = s.numeral ?? "";
    const isClosing = s.layout === "closing";
    out.push(
      para(
        ctx,
        [
          ...runs(ctx, numeral, { bold: true, color: C.maroon, size: SIZE.body[lang] + 2, font: "head" }),
          new TextRun({ children: [new Tab()] }),
          ...runs(ctx, pick(s.title, lang), { size: SIZE.body[lang] + 2, color: isClosing ? C.ink600 : C.ink, bold: !isClosing }),
          new TextRun({ children: [new Tab()] }),
          ...runs(ctx, String(est?.start ?? ""), { size: SIZE.body[lang], color: C.ink600 }),
        ],
        {
          after: 160,
          line: 260,
          tabStops: [
            { type: "left", position: 900 },
            { type: "right", position: TEXT_W, leader: "dot" },
          ],
        }
      )
    );
    // level-2 headings of the section as sub-entries, indented
    const subs = s.blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading" && b.level === 2).slice(0, 6);
    for (const h of subs) {
      out.push(
        para(
          ctx,
          [
            new TextRun({ children: [new Tab()] }),
            ...runs(ctx, pick(h.text, lang), { size: SIZE.small[lang], color: C.ink600 }),
          ],
          { after: 60, line: 240, tabStops: [{ type: "left", position: 900 }] }
        )
      );
    }
  }
  out.push(spacer(300));
  out.push(text(ctx, t(lang, "tocNote"), { size: SIZE.tiny[lang], color: C.ink400, italics: !isAr(lang) }, { after: 80 }));
  out.push(new TableOfContents(t(lang, "contents"), { hyperlink: true, headingStyleRange: "1-2" }));
  return out;
}

/* ------------------------------------------------------------------ */
/* Section head (compact) and opener (full page)                       */
/* ------------------------------------------------------------------ */

function sectionHead(ctx: Ctx, s: SectionContent): FileChild[] {
  const lang = ctx.lang;
  const out: FileChild[] = [];
  const children = [
    ...(s.numeral ? runs(ctx, `${s.numeral}  `, { bold: true, color: C.maroon300, size: SIZE.h1[lang], font: "head" }) : []),
    ...runs(ctx, pick(s.title, lang), { bold: true, color: C.maroon, size: SIZE.h1[lang], font: "head" }),
  ];
  out.push(
    para(ctx, children, {
      heading: HeadingLevel.HEADING_1,
      after: 200,
      line: 240,
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.gold, space: 10 } },
    })
  );
  if (s.needsEditing) {
    out.push(draftBanner(ctx));
    out.push(spacer(160));
  }
  if (s.lead) {
    out.push(
      text(ctx, pick(s.lead, lang), { font: "serif", size: SIZE.lead[lang], color: C.ink600 }, { after: 240, line: isAr(lang) ? 340 : 320 })
    );
  }
  return out;
}

export async function openerPage(ctx: Ctx, s: SectionContent): Promise<FileChild[]> {
  const lang = ctx.lang;
  const out: FileChild[] = [];
  if (s.needsEditing) {
    out.push(draftBanner(ctx));
    out.push(spacer(240));
  } else {
    out.push(spacer(600));
  }
  const numeral = s.numeral ?? "";
  let numeralPng: Buffer | null = null;
  if (numeral && ctx.raster) numeralPng = await svgToPng(numeralSvg(numeral), NUMERAL_IMG.w, NUMERAL_IMG.h, 2);
  const numW = pxToTwips(NUMERAL_IMG.w) + 200;
  const numeralCell = numeralPng
    ? [para(ctx, [image(numeralPng, NUMERAL_IMG.w, NUMERAL_IMG.h, numeral)], { after: 0, line: 240 })]
    : numeral
      ? [text(ctx, numeral, { bold: true, size: 220, color: C.maroon100, font: "head" }, { after: 0, line: 240 })]
      : [];
  const titlePara = para(ctx, runs(ctx, pick(s.title, lang), { bold: true, color: C.maroon, size: SIZE.h1[lang] + 8, font: "head" }), {
    heading: HeadingLevel.HEADING_1,
    after: 0,
    line: 240,
  });
  out.push(
    table(
      ctx,
      [
        new TableRow({
          cantSplit: true,
          children: [
            cell(numeralCell, { width: numW, margins: { top: 0, bottom: 0, left: 0, right: 0 }, vAlign: "bottom" }),
            cell([titlePara], { width: TEXT_W - numW, margins: { top: 0, bottom: 60, left: 0, right: 0 }, vAlign: "bottom" }),
          ],
        }),
      ],
      [numW, TEXT_W - numW]
    )
  );
  out.push(
    new Paragraph({
      children: [],
      spacing: { before: 0, after: 360 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.gold, space: 1 } },
    })
  );
  if (s.lead) {
    out.push(
      text(ctx, pick(s.lead, lang), { font: "serif", size: SIZE.lead[lang] + 2, color: C.ink600 }, {
        after: 300,
        line: isAr(lang) ? 360 : 340,
        indentStart: 0,
        border: { start: { style: BorderStyle.SINGLE, size: 24, color: C.maroon, space: 14 } },
      })
    );
  }
  if (s.keyFigure) {
    out.push(spacer(300));
    out.push(...(await keyFigureBlock(ctx, s.keyFigure.value, pick(s.keyFigure.label, lang), PX.colW)));
  }
  if (s.blocks.length) {
    out.push(pageBreak());
    out.push(...(await flow(ctx, s.blocks)));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* At a glance, body, chart, scorecard, sources                        */
/* ------------------------------------------------------------------ */

export async function glancePage(ctx: Ctx, s: SectionContent): Promise<FileChild[]> {
  const out: FileChild[] = [...sectionHead(ctx, s)];
  const tiles = s.blocks.filter((b): b is Extract<Block, { kind: "kpis" }> => b.kind === "kpis");
  const rest = s.blocks.filter((b) => b.kind !== "kpis");
  for (const k of tiles) out.push(...(await kpisBlock(ctx, k.items)));
  if (tiles.length) out.push(spacer(160));
  out.push(...(await flow(ctx, rest)));
  return out;
}

export async function bodyPages(ctx: Ctx, s: SectionContent): Promise<FileChild[]> {
  return [...sectionHead(ctx, s), ...(await flow(ctx, s.blocks))];
}

export async function chartPages(ctx: Ctx, s: SectionContent): Promise<FileChild[]> {
  const out: FileChild[] = [...sectionHead(ctx, s)];
  const intro = s.blocks.filter((b) => b.kind !== "chart");
  const charts = s.blocks.filter((b): b is Extract<Block, { kind: "chart" }> => b.kind === "chart");
  if (intro.length) out.push(...(await flow(ctx, intro)));
  // a short intro shares the first chart's page; a long one gets its own
  const longIntro = intro.reduce((a, b) => a + estimateLines(b, ctx.lang) * (isWide(b) ? 2 : 1), 0) > 20;
  for (const [i, c] of charts.entries()) {
    if (i > 0 || longIntro) {
      out.push(pageBreak());
      // repeat a light section context on the new page
      out.push(text(ctx, pick(s.title, ctx.lang), { size: SIZE.tiny[ctx.lang], color: C.ink400, caps: !isAr(ctx.lang), spacing: 20 }, { after: 200 }));
    }
    out.push(...(await chartBlock(ctx, c.chart)));
  }
  return out;
}

export async function scorecardPage(ctx: Ctx, s: SectionContent): Promise<FileChild[]> {
  return [...sectionHead(ctx, s), ...(await column(ctx, s.blocks))];
}

export async function sourcesPage(ctx: Ctx, model: ReportDocumentModel, s: SectionContent): Promise<FileChild[]> {
  const out: FileChild[] = [...sectionHead(ctx, s)];
  const hasSourcesBlock = s.blocks.some((b) => b.kind === "sources");
  const blocks: Block[] = [...s.blocks];
  if (!hasSourcesBlock) {
    // aggregate every section's sources, de-duplicated by number
    const seen = new Set<number>();
    const items = model.sections.flatMap((x) => x.sources ?? []).filter((i) => (seen.has(i.n) ? false : (seen.add(i.n), true)));
    if (items.length) blocks.push({ kind: "sources", items });
  }
  for (const b of blocks) {
    if (b.kind === "sources") out.push(...sourcesBlock(ctx, b.items));
    else out.push(...(await renderBlock(ctx, b)));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Closing                                                             */
/* ------------------------------------------------------------------ */

export async function closingPage(ctx: Ctx, model: ReportDocumentModel): Promise<FileChild[]> {
  const lang = ctx.lang;
  let png: Buffer | null = null;
  if (ctx.raster) {
    png = await svgToPng(
      closingSvg({
        lang,
        line: t(lang, "closingLine"),
        contact: t(lang, "contact"),
        classification: classificationLabel(model.classification, lang),
        assets: ctx.assets,
      }),
      CLOSING.w,
      CLOSING.h,
      2
    );
  }
  if (png) {
    return [new Paragraph({ children: [image(png, CLOSING.w - 1, CLOSING.h, "SiaNexus")], spacing: { before: 0, after: 0, line: 240 } })];
  }
  const children: Paragraph[] = [];
  if (ctx.assets.npcWhite) {
    children.push(new Paragraph({ children: [image(ctx.assets.npcWhite, 190, Math.round(190 / aspect(ctx.assets.npcWhite)), "National Planning Council")], spacing: { before: 0, after: 3000 } }));
  }
  children.push(text(ctx, "SiaNexus", { bold: true, size: 48, color: C.white, font: "head" }, { align: "center", after: 200 }));
  children.push(text(ctx, t(lang, "closingLine"), { size: SIZE.body[lang], color: C.maroon100 }, { align: "center", after: 3000 }));
  children.push(text(ctx, t(lang, "contact"), { size: SIZE.small[lang], color: C.maroon100 }, { after: 120 }));
  children.push(text(ctx, classificationLabel(model.classification, lang), { size: SIZE.small[lang], color: C.white, bold: true, caps: true }, { after: 0 }));
  const row = new TableRow({ children: [cell(children, { fill: C.maroon, width: PAGE.w, margins: { top: 800, bottom: 800, left: 900, right: 900 } })] });
  return [table(ctx, [row], [PAGE.w])];
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export async function sectionChildren(ctx: Ctx, model: ReportDocumentModel, s: SectionContent, estimates: PageEstimate[]): Promise<FileChild[]> {
  switch (s.layout) {
    case "cover":
      return coverPage(ctx, model);
    case "contents":
      return contentsPage(ctx, model, estimates);
    case "opener":
      return openerPage(ctx, s);
    case "glance":
      return glancePage(ctx, s);
    case "chart":
      return chartPages(ctx, s);
    case "scorecard":
      return scorecardPage(ctx, s);
    case "sources":
      return sourcesPage(ctx, model, s);
    case "closing":
      return closingPage(ctx, model);
    default:
      return bodyPages(ctx, s);
  }
}

// re-exported for the entry point's fallbacks and tests
export { calloutBlock, ROW_LINES };
