// CR08 5.5 smoke checks: the docx design system renders a model in both
// languages with the expected parts, mirrors Arabic, and (when Edge is
// available) produces page previews. Wired into scripts/smoke.ts by the
// coordinator; self-contained otherwise (no server, no database).
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { bi, type ReportDocumentModel } from "../src/server/reports/spec";
import { chartSvg, pngAvailable, renderDocxPreviews, renderReportDocx } from "../src/server/reports/template";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

function sampleModel(): ReportDocumentModel {
  const years = ["2022", "2023", "2024", "2025", "2026"];
  return {
    request: {
      reportId: "smoke-template",
      typeCode: "org_annual_report",
      family: "internal",
      period: { kind: "year", year: 2026, label: bi("Year 2026", "سنة 2026") },
      scope: { kind: "org", label: bi("Programme Office", "مكتب البرنامج") },
      audience: "leadership",
      languageMode: "both",
      sectionCodes: ["cover", "contents", "foreword", "statistics_highlights", "targets_scorecard", "sources_appendix", "closing"],
      classification: 2,
      requestedBy: "smoke",
    },
    typeName: bi("Smoke report", "تقرير الفحص"),
    title: bi("Template smoke 2026", "فحص القالب 2026"),
    periodLabel: bi("Reporting year 2026", "السنة المشمولة بالتقرير 2026"),
    yearMark: "2026",
    classification: 2,
    generatedAt: new Date().toISOString(),
    sections: [
      { code: "cover", title: bi("Cover", "الغلاف"), layout: "cover", blocks: [] },
      { code: "contents", title: bi("Contents", "المحتويات"), layout: "contents", blocks: [] },
      {
        code: "foreword",
        numeral: "01",
        title: bi("Foreword", "تمهيد"),
        layout: "opener",
        needsEditing: true,
        lead: bi("A short lead.", "مقدمة قصيرة."),
        keyFigure: { value: "20 / 30", label: bi("targets on track", "مستهدفاً على المسار") },
        blocks: [
          { kind: "heading", level: 2, text: bi("Where we stand", "أين نقف") },
          { kind: "paragraph", text: bi("Body text for the smoke run, long enough to wrap across a column of the two-column flow in the report design.", "نص للفحص، طويل بما يكفي ليلتف على عمود من عمودي التقرير في التصميم.") },
          { kind: "bullets", items: [bi("One", "واحد"), bi("Two", "اثنان")] },
          { kind: "quote", text: bi("A quoted line.", "سطر مقتبس."), attribution: bi("Someone", "شخص") },
          { kind: "callout", title: bi("Key finding", "النتيجة الأبرز"), text: bi("Callout text.", "نص التنبيه.") },
          { kind: "table", columns: [bi("A", "أ"), bi("B", "ب")], rows: [[bi("x", "س"), bi("1", "1")]], align: ["start", "end"] },
        ],
      },
      {
        code: "statistics_highlights",
        numeral: "02",
        title: bi("Statistics", "الإحصاءات"),
        layout: "chart",
        blocks: [
          {
            kind: "chart",
            chart: {
              type: "line",
              title: bi("Growth", "النمو"),
              series: [
                { name: bi("Saudi Arabia", "السعودية"), role: "primary", points: years.map((x, i) => ({ x, y: [1, 2, 3, 2.5, 3.2][i] })) },
                { name: bi("Target", "المستهدف"), role: "target", points: years.map((x) => ({ x, y: 4 })) },
              ],
              source: bi("Smoke", "فحص"),
            },
          },
        ],
      },
      {
        code: "targets_scorecard",
        numeral: "03",
        title: bi("Scorecard", "بطاقة الأداء"),
        layout: "scorecard",
        blocks: [
          {
            kind: "scorecard",
            columns: [bi("2026", "2026"), bi("Status", "الحالة")],
            rows: [
              { label: bi("Target A", "المستهدف أ"), cells: [{ text: "3.1", trend: "up" }, { text: "On track", rag: "green", trend: "up" }] },
              { label: bi("Target B", "المستهدف ب"), cells: [{ text: "57", trend: "flat" }, { text: "Behind", rag: "red", trend: "down" }] },
            ],
          },
        ],
      },
      { code: "sources_appendix", numeral: "04", title: bi("Sources", "المصادر"), layout: "sources", blocks: [{ kind: "sources", items: [{ n: 1, title: "Smoke source", url: "https://www.mewa.gov.sa" }] }] },
      { code: "closing", title: bi("Closing", "الخاتمة"), layout: "closing", blocks: [] },
    ],
  };
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  void ctx;
  const model = sampleModel();
  const outDir = path.join(process.cwd(), "data", "reports", "samples");
  fs.mkdirSync(outDir, { recursive: true });
  const bidiOn = /<w:bidi(?:\s+w:val="(?:1|true|on)")?\s*\/>/;
  const rtlOn = /<w:rtl(?:\s+w:val="(?:1|true|on)")?\s*\/>/;
  const bidiVisualOn = /<w:bidiVisual(?:\s+w:val="(?:1|true|on)")?\s*\/>/;

  const raster = await pngAvailable();
  check("template: rasteriser available (Playwright + Edge)", raster);

  for (const lang of ["en", "ar"] as const) {
    const outPath = path.join(outDir, `smoke-template-${lang}.docx`);
    let buf: Buffer | null = null;
    try {
      buf = await renderReportDocx(model, { lang, outPath });
    } catch (e) {
      check(`template ${lang}: renders`, false, String((e as Error).message));
      continue;
    }
    check(`template ${lang}: renders (${buf.length} bytes)`, buf.length > 30000);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
    check(`template ${lang}: document.xml, headers, footers`, doc.length > 0 && names.some((n) => /word\/header\d*\.xml/.test(n)) && names.some((n) => /word\/footer\d*\.xml/.test(n)));
    const media = names.filter((n) => n.startsWith("word/media/")).length;
    check(`template ${lang}: image parts (${media})`, media >= (raster ? 8 : 1));
    check(`template ${lang}: one docx section per report section`, (doc.match(/<w:sectPr/g) ?? []).length === model.sections.length);
    check(`template ${lang}: TOC field and heading styles`, /TOC \\/.test(doc) && doc.includes('w:val="Heading1"'));
    check(`template ${lang}: palette (navy, mist, aqua, RAG tints)`, doc.includes("173044") && doc.includes("F4F6FC") && doc.includes("00DECC") && doc.includes("E3F1EA") && doc.includes("F9E5E4"));
    if (lang === "ar") {
      check("template ar: bidi paragraphs, rtl runs, bidiVisual tables", bidiOn.test(doc) && rtlOn.test(doc) && bidiVisualOn.test(doc));
      check("template ar: Sakkal Majalla in the cs font slot", /w:cs="Sakkal Majalla"/.test(doc));
      check("template ar: Arabic text present", /[؀-ۿ]/.test(doc));
    } else {
      check("template en: no bidi paragraphs, Calibri runs", !bidiOn.test(doc) && doc.includes("Calibri"));
    }
    if (raster) {
      const pages = await renderDocxPreviews(outPath, { outDir: path.join(process.cwd(), "data", "reports", "previews", "smoke", lang) });
      check(`template ${lang}: page previews (${pages.length})`, pages.length >= model.sections.length && pages.every((p) => fs.existsSync(p)));
    }
  }

  const svg = chartSvg(
    {
      type: "bar",
      title: bi("t", "t"),
      series: [
        { name: bi("A", "أ"), points: [{ x: "1", y: 2 }, { x: "2", y: 3 }] },
        { name: bi("B", "ب"), role: "comparison", points: [{ x: "1", y: 1 }, { x: "2", y: 2 }] },
      ],
    },
    "en"
  );
  check("template: chart SVG carries navy and teal marks and a legend", svg.includes("#8A1538") && svg.includes("#0F6E76") && svg.includes(">A<") && svg.includes(">B<"));
}
