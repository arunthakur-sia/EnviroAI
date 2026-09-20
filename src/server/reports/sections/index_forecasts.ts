// CR08 5.3: the index forecasts with their method note. Every horizon of
// every tracked index, the range and confidence, the direction, and the
// stored explanation; the method note describes the CR05 4.6 engine and
// says plainly that a forecast is an estimate, not a published value.
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getIndicesBoard } from "@/server/services/indices";
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, fmtAuto, internationalCards, memo, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";

type Row = { code: string; nameEn: string; nameAr: string; latestYear: number | null; latestRank: number | null; latestScore: number | null; h1: string; h3: string; h3Range: string; h5: string; direction: string; confidence: string | null; method: string | null; generatedAt: string | null; explanationEn: string | null; explanationAr: string | null };
type ForecastData = { rows: Row[]; directions: { up: number; down: number; stable: number } };

export const METHOD_NOTE = bi(
  "Method note. SiaNexus forecasts (method v1) are produced by a seeded Monte Carlo simulation of 5,000 runs over each index's own published history for Qatar: a baseline drift from the history window, adjusted by the accepted signals linked to the index (sentiment, impact, horizon and age weighted) and by the pull of any NDS3 target that names a rank or score. Ranks are derived against the stored peer pool; where the pool is a sample of the field, the movement of Qatar's position within the pool is applied to the latest published rank rather than pretending the pool is the whole field. Central values are medians; the range is the 10th to 90th percentile. A forecast is an estimate generated on the date shown, never a published value, and it is recomputed nightly and whenever its inputs change.",
  "ملاحظة المنهجية. تُنتج تنبؤات سيا نكسس (المنهجية v1) بمحاكاة مونت كارلو ذات بذرة ثابتة من 5,000 دورة على التاريخ المنشور لكل مؤشر عن قطر: انحراف أساسي مستمد من نافذة التاريخ، يُعدل بالإشارات المقبولة المرتبطة بالمؤشر (موزونة بالاتجاه والأثر والأفق والعمر) وبجاذبية أي مستهدف في الاستراتيجية الوطنية يذكر مرتبة أو درجة. وتُشتق المراتب قياساً بمجموعة النظراء المحفوظة؛ وحيث تكون المجموعة عينة من الميدان، يُطبق تحرك موقع قطر داخل المجموعة على أحدث مرتبة منشورة بدلاً من افتراض أن المجموعة هي الميدان كله. والقيم المركزية أوساط، والنطاق من المئين العاشر إلى التسعين. والتنبؤ تقدير أُنتج بالتاريخ المبين، وليس قيمة منشورة أبداً، ويُعاد حسابه ليلياً وكلما تغيرت مدخلاته."
);

const def: SectionDefinition<ForecastData> = {
  code: "index_forecasts",
  name: bi("Index forecasts", "تنبؤات المؤشرات"),
  description: bi(
    "The SiaNexus forecasts at one, three and five years for every tracked index, with ranges, confidence and the method note.",
    "تنبؤات سيا نكسس على آفاق سنة وثلاث وخمس سنوات لكل مؤشر متابع، مع النطاقات ودرجة الثقة وملاحظة المنهجية."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: ["npc", "period"],
  async load(ctx) {
    const board = await memo(ctx, "indices-board", () => getIndicesBoard(ctx.user).catch(() => null));
    if (!board) return { rows: [], directions: { up: 0, down: 0, stable: 0 } };
    // the board row carries score bounds only; rank-mode indices need their
    // rank bounds so the range column never mixes units with the central value
    const international = internationalCards(board.cards);
    const idByCode = new Map(international.map((c) => [c.code, c.id]));
    const rankBounds = new Map<string, { rankLow: number | null; rankHigh: number | null }>();
    const current = await db
      .select({ indexId: schema.indexForecasts.indexId, rankLow: schema.indexForecasts.rankLow, rankHigh: schema.indexForecasts.rankHigh })
      .from(schema.indexForecasts)
      .where(and(eq(schema.indexForecasts.status, "current"), eq(schema.indexForecasts.horizonYears, 3)))
      .catch(() => []);
    for (const c of current) rankBounds.set(c.indexId, { rankLow: c.rankLow, rankHigh: c.rankHigh });
    const central = (h: { centralRank: number | null; centralScore: number | null } | undefined) =>
      !h ? "n/a" : h.centralRank != null ? `rank ${fmt(Math.round(h.centralRank))}` : h.centralScore != null ? fmtAuto(h.centralScore) : "n/a";
    const rows: Row[] = board.forecastTable
      .filter((f) => f.horizons.length && idByCode.has(f.code))
      .map((f) => {
        const h1 = f.horizons.find((h) => h.horizon === 1);
        const h3 = f.horizons.find((h) => h.horizon === 3);
        const h5 = f.horizons.find((h) => h.horizon === 5);
        const bounds = rankBounds.get(idByCode.get(f.code) ?? "");
        const range = h3
          ? h3.centralRank != null && bounds?.rankLow != null && bounds?.rankHigh != null
            ? `${fmt(Math.round(Math.min(bounds.rankLow, bounds.rankHigh)))} to ${fmt(Math.round(Math.max(bounds.rankLow, bounds.rankHigh)))}`
            : h3.centralRank == null && h3.low != null && h3.high != null
              ? `${fmtAuto(h3.low)} to ${fmtAuto(h3.high)}`
              : ""
          : "";
        return {
          code: f.code,
          nameEn: f.nameEn,
          nameAr: f.nameAr,
          latestYear: f.latest?.year ?? null,
          latestRank: f.latest?.rank ?? null,
          latestScore: f.latest?.score ?? null,
          h1: central(h1),
          h3: central(h3),
          h3Range: range,
          h5: central(h5),
          direction: h3?.direction ?? h1?.direction ?? "stable",
          confidence: f.confidence,
          method: h3?.methodVersion ?? null,
          generatedAt: h3?.generatedAt?.slice(0, 10) ?? null,
          explanationEn: h3?.explanationEn ?? null,
          explanationAr: h3?.explanationAr ?? null,
        };
      });
    const directions = { up: rows.filter((r) => r.direction === "up").length, down: rows.filter((r) => r.direction === "down").length, stable: rows.filter((r) => r.direction === "stable").length };
    return { rows, directions };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const upward = data.rows.filter((r) => r.direction === "up").slice(0, 3);
    const downward = data.rows.filter((r) => r.direction === "down").slice(0, 2);
    const mock = (): Prose => ({
      paragraphs: data.rows.length
        ? [
            bi(
              `As at ${period.en}, the current SiaNexus forecasts cover ${fmt(data.rows.length)} indices: ${fmt(data.directions.up)} point upward over three years, ${fmt(data.directions.down)} downward and ${fmt(data.directions.stable)} sideways. Assessment: these are model estimates generated from published history, accepted signals and target pull, not forecasts endorsed by any publisher.`,
              `حتى ${period.ar}، تغطي تنبؤات سيا نكسس الحالية ${fmt(data.rows.length)} مؤشراً: يشير ${fmt(data.directions.up)} منها إلى الصعود على أفق ثلاث سنوات، و${fmt(data.directions.down)} إلى الهبوط، و${fmt(data.directions.stable)} إلى الاستقرار. تقدير: هذه تقديرات نموذجية مستمدة من التاريخ المنشور والإشارات المقبولة وجاذبية المستهدفات، لا تنبؤات معتمدة من أي ناشر.`
            ),
            ...(upward.length
              ? [
                  bi(
                    `The upward cases are ${upward.map((r) => `${r.nameEn} (three-year central ${r.h3}${r.h3Range ? `, range ${r.h3Range}` : ""})`).join("; ")}.${downward.length ? ` The downward cases are ${downward.map((r) => `${r.nameEn} (${r.h3})`).join(" and ")}.` : ""}`,
                    `والحالات الصاعدة هي ${upward.map((r) => `${r.nameAr} (القيمة المركزية بعد ثلاث سنوات ${r.h3}${r.h3Range ? `، النطاق ${r.h3Range}` : ""})`).join("؛ ")}.${downward.length ? ` والحالات الهابطة هي ${downward.map((r) => `${r.nameAr} (${r.h3})`).join(" و")}.` : ""}`
                  ),
                ]
              : []),
          ]
        : [bi("No current forecast is stored for any tracked index.", "لا يوجد تنبؤ حالي محفوظ لأي مؤشر متابع.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "index_forecasts",
      {
        purpose: "Present the forecasts as estimates with their direction, central value and range, and never as facts.",
        structure: "Two paragraphs: the direction counts with an explicit 'Assessment:' sentence; the notable upward and downward cases with their three-year central value and range.",
        paragraphs: 2,
      },
      { period: period.en, directions: data.directions, rows: data.rows.map((r) => ({ ...r, explanationEn: r.explanationEn?.slice(0, 400), explanationAr: r.explanationAr?.slice(0, 400) })) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.rows.length) {
      blocks.push(noteBlock("No forecasts to tabulate.", "لا تنبؤات لجدولتها."));
    } else {
      blocks.push({
        kind: "table",
        caption: bi("SiaNexus forecasts by horizon (central values; three-year range)", "تنبؤات سيا نكسس بحسب الأفق (القيم المركزية؛ نطاق الثلاث سنوات)"),
        columns: [bi("Index", "المؤشر"), bi("Latest", "الأحدث"), bi("1 year", "سنة"), bi("3 years", "ثلاث سنوات"), bi("3-year range", "نطاق الثلاث سنوات"), bi("5 years", "خمس سنوات"), T.direction, T.confidence],
        rows: data.rows.map((r) => [
          bi(r.nameEn, r.nameAr),
          bi(r.latestRank != null ? `rank ${fmt(r.latestRank)} (${r.latestYear})` : r.latestScore != null ? `${fmtAuto(r.latestScore)} (${r.latestYear})` : "", r.latestRank != null ? `المرتبة ${fmt(r.latestRank)} (${r.latestYear})` : r.latestScore != null ? `${fmtAuto(r.latestScore)} (${r.latestYear})` : ""),
          bi(r.h1, r.h1.replace("rank", "المرتبة")),
          bi(r.h3, r.h3.replace("rank", "المرتبة")),
          bi(r.h3Range, r.h3Range.replace(" to ", " إلى ")),
          bi(r.h5, r.h5.replace("rank", "المرتبة")),
          statusText(r.direction),
          bi(r.confidence ?? "", r.confidence === "narrow" ? "ضيق" : r.confidence === "medium" ? "متوسط" : r.confidence === "wide" ? "واسع" : ""),
        ]),
        align: ["start", "end", "end", "end", "end", "end", "start", "start"],
        source: bi("SiaNexus index forecasts, method v1", "تنبؤات المؤشرات في سيا نكسس، المنهجية v1"),
      });
      const explained = data.rows.filter((r) => r.explanationEn && r.explanationAr).slice(0, 4);
      if (explained.length) {
        blocks.push({ kind: "heading", level: 3, text: bi("Why the numbers moved", "لماذا تحركت الأرقام") });
        blocks.push({ kind: "bullets", items: explained.map((r) => bi(`${r.nameEn}: ${r.explanationEn}`, `${r.nameAr}: ${r.explanationAr}`)) });
      }
      blocks.push({ kind: "callout", title: bi("Method note", "ملاحظة المنهجية"), text: METHOD_NOTE, tone: "ink" });
    }
    return section("index_forecasts", bi("Index forecasts", "تنبؤات المؤشرات"), "body", {
      lead: bi(`${fmt(data.rows.length)} indices forecast; ${fmt(data.directions.up)} upward, ${fmt(data.directions.down)} downward.`, `${fmt(data.rows.length)} مؤشراً متنبأً به؛ ${fmt(data.directions.up)} صاعداً و${fmt(data.directions.down)} هابطاً.`),
      blocks,
      sources: makeSources([SRC.forecasts()]),
      meta: { live, indices: data.rows.length, directions: data.directions, method: "v1", generatedAt: data.rows[0]?.generatedAt ?? null },
    });
  },
};

export default def;
