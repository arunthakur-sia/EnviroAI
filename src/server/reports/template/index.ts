// CR08 5.5: the docx design system. Renders a ReportDocumentModel to a
// designed Word document in one language (Arabic fully mirrored: bidi
// paragraphs, Sakkal Majalla runs with rtl, bidiVisual tables, header and
// footer alignment swapped, Western digits). Page designs live in pages.ts,
// block renderers in blocks.ts, the SVG designs in svg.ts and charts.ts, the
// Edge rasteriser in png.ts, the docx-preview page images in preview.ts.
import fs from "node:fs";
import path from "node:path";
import { AlignmentType, Document, LevelFormat, Packer, type ISectionOptions } from "docx";
import type { ReportDocumentModel, RenderOptions } from "../spec";
import { glyphFactory, type Ctx } from "./blocks";
import { docSection, estimateAll, sectionChildren } from "./pages";
import { pngAvailable } from "./png";
import { loadAssets } from "./svg";
import { C, FONT, LINE, SIZE, isAr, pick } from "./theme";

export { renderDocxPreviews, previewDir } from "./preview";
export { closePngRenderer, pngAvailable, svgToPng } from "./png";
export { chartSvg } from "./charts";
export { coverBandSvg, kpiRowSvg, keyFigureSvg, numeralSvg, closingSvg, saduPattern } from "./svg";

export async function renderReportDocx(model: ReportDocumentModel, opts: RenderOptions): Promise<Buffer> {
  const lang = opts.lang;
  const raster = await pngAvailable();
  let instance = 0;
  const ctx: Ctx = {
    lang,
    raster,
    assets: loadAssets(),
    listInstance: () => ++instance,
    glyph: glyphFactory(),
  };
  const estimates = estimateAll(model, lang);
  const sections: ISectionOptions[] = [];
  for (const [index, s] of model.sections.entries()) {
    const children = await sectionChildren(ctx, model, s, estimates);
    const fullBleed = s.layout === "cover" || s.layout === "closing";
    sections.push(docSection(ctx, model, children, { index, title: fullBleed ? undefined : pick(s.title, lang), fullBleed }));
  }
  const bodyFont = isAr(lang) ? FONT.arBody : FONT.enBody;
  const headFont = isAr(lang) ? FONT.arBody : FONT.enHead;
  const doc = new Document({
    creator: "SiaNexus",
    title: pick(model.title, lang),
    description: pick(model.typeName, lang),
    features: { updateFields: true },
    numbering: {
      config: [
        {
          reference: "report-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 420, hanging: 260 } }, run: { color: C.maroon, font: FONT.enBody } },
            },
          ],
        },
        {
          reference: "report-numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 460, hanging: 300 } }, run: { color: C.maroon, bold: true, font: FONT.enBody } },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: SIZE.body[lang], color: C.ink },
          paragraph: { spacing: { line: LINE[lang], after: 120 } },
        },
        heading1: {
          run: { font: headFont, size: SIZE.h1[lang], bold: true, color: C.maroon },
          paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, outlineLevel: 0 },
        },
        heading2: {
          run: { font: headFont, size: SIZE.h2[lang], bold: true, color: C.maroon },
          paragraph: { spacing: { before: 260, after: 80 }, keepNext: true, outlineLevel: 1 },
        },
        heading3: {
          run: { font: headFont, size: SIZE.h3[lang], bold: true, color: C.ink },
          paragraph: { spacing: { before: 160, after: 40 }, keepNext: true, outlineLevel: 2 },
        },
      },
    },
    sections,
  });
  const buf = Buffer.from(await Packer.toBuffer(doc));
  if (opts.outPath) {
    fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
    fs.writeFileSync(opts.outPath, buf);
  }
  return buf;
}
