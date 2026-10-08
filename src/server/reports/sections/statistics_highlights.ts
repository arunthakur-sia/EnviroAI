// CR08 5.3: statistical highlights. The headline indicators as tiles, then
// population, economy, labour, prices and trade from the catalogue with
// their latest and previous values, and one headline series as a chart.
import { catalog, headlineTiles, indicatorDetail, tileFor } from "@/server/services/statistics";
import { bi, type Block, type KpiTile, type SectionDefinition } from "../spec";
import { fmt, memo, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, signed, writeProse, T, type Prose } from "./_shared";

type Tile = { id: string; nameEn: string; nameAr: string; unit: string | null; decimals: number; direction: string; latest: number | null; latestPeriod: string | null; previous: number | null; illustrative: boolean };
type Category = { code: string; nameEn: string; nameAr: string; indicators: Tile[] };
type StatsData = {
  headline: Tile[];
  categories: Category[];
  chart: { nameEn: string; nameAr: string; unit: string | null; points: { x: string; y: number }[] } | null;
  sourceLines: string[];
};

const WANTED = ["stat_population", "stat_economy", "stat_labour", "stat_prices", "stat_trade"];

function tileOf(t: NonNullable<Awaited<ReturnType<typeof tileFor>>>): Tile {
  return { id: t.id, nameEn: t.nameEn, nameAr: t.nameAr, unit: t.unit, decimals: t.decimals, direction: t.direction, latest: t.latestValue, latestPeriod: t.latestPeriod, previous: t.previousValue, illustrative: Boolean(t.illustrative) };
}

const def: SectionDefinition<StatsData> = {
  code: "statistics_highlights",
  name: bi("Statistics highlights", "أبرز الإحصاءات"),
  description: bi(
    "Population, economy, labour, prices and trade: the headline indicators with their latest values and movements.",
    "السكان والاقتصاد والعمل والأسعار والتجارة: المؤشرات الرئيسية بأحدث قيمها وتحركاتها."
  ),
  layout: "glance",
  estimatedPages: 3,
  appliesTo: ["org", "period"],
  async load(ctx) {
    const headline = await memo(ctx, "stat-headline", () => headlineTiles(ctx.user).catch(() => []));
    const groups = await catalog(ctx.user).catch(() => []);
    const categories: Category[] = [];
    for (const code of WANTED) {
      const g = groups.find((x) => x.code === code);
      if (!g) continue;
      const tiles: Tile[] = [];
      for (const ind of g.indicators.slice(0, 4)) {
        const t = await tileFor(ind.id).catch(() => null);
        if (t) tiles.push(tileOf(t));
      }
      if (tiles.length) categories.push({ code: g.code, nameEn: g.nameEn, nameAr: g.nameAr, indicators: tiles });
    }
    const first = headline[0];
    const detail = first ? await indicatorDetail(ctx.user, first.id).catch(() => null) : null;
    const points = (detail?.values ?? []).filter((v) => v.dimensionKey === "total").slice(-12).map((v) => ({ x: v.period, y: v.value }));
    const sourceLines = [...new Set((detail ? [detail.ind.sourceEn] : []).filter(Boolean))] as string[];
    return {
      headline: headline.map(tileOf),
      categories,
      chart: first && points.length >= 3 ? { nameEn: first.nameEn, nameAr: first.nameAr, unit: first.unit, points } : null,
      sourceLines,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const valueText = (t: Tile) => (t.latest == null ? "n/a" : `${fmt(t.latest, t.decimals)}${t.unit ? ` ${t.unit}` : ""}`);
    const changeOf = (t: Tile) => (t.latest != null && t.previous != null ? t.latest - t.previous : null);
    const movers = data.headline.filter((t) => changeOf(t) != null).slice(0, 3);
    const mock = (): Prose => ({
      paragraphs: data.headline.length
        ? [
            bi(
              `The official series held in EnviroAI give ${period.en} its statistical frame. ${movers.map((t) => `${t.nameEn} stands at ${valueText(t)} (${t.latestPeriod}), ${signed(changeOf(t), t.decimals)} on the previous period`).join("; ")}.`,
              `تمنح السلاسل الرسمية المحفوظة في EnviroAI ${period.ar} إطارها الإحصائي. ${movers.map((t) => `يبلغ ${t.nameAr} ${valueText(t)} (${t.latestPeriod})، بتغير ${signed(changeOf(t), t.decimals)} عن الفترة السابقة`).join("؛ ")}.`
            ),
            bi(
              `${fmt(data.categories.reduce((s, c) => s + c.indicators.length, 0))} indicators across ${data.categories.map((c) => c.nameEn.toLowerCase()).join(", ")} are tabulated below with their latest and previous values; values marked illustrative are seeded placeholders awaiting the official release.`,
              `ويُجدول أدناه ${fmt(data.categories.reduce((s, c) => s + c.indicators.length, 0))} مؤشراً عبر ${data.categories.map((c) => c.nameAr).join("، ")} بأحدث قيمها والقيم السابقة؛ والقيم الموسومة بالاسترشادية هي قيم مزروعة بانتظار الإصدار الرسمي.`
            ),
          ]
        : [bi("No statistical indicator is visible at this clearance.", "لا يوجد مؤشر إحصائي مرئي عند مستوى التصريح هذا.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "statistics_highlights",
      {
        purpose: "Narrate the headline statistics: the level and the movement of the indicators that matter most this period.",
        structure: "Two paragraphs: the headline movers with their values and periods; the categories covered. Never compute a growth rate the facts do not contain.",
        paragraphs: 2,
      },
      { period: period.en, headline: data.headline, categories: data.categories.map((c) => ({ code: c.code, nameEn: c.nameEn, indicators: c.indicators.map((t) => ({ nameEn: t.nameEn, latest: t.latest, previous: t.previous, unit: t.unit, period: t.latestPeriod })) })) },
      mock
    );
    const tiles: KpiTile[] = data.headline.slice(0, 8).map((t) => ({
      label: bi(t.nameEn, t.nameAr),
      value: t.latest == null ? "n/a" : fmt(t.latest, t.decimals),
      unit: t.unit ?? undefined,
      delta: changeOf(t) != null ? `${signed(changeOf(t), t.decimals)} vs ${t.latestPeriod ? "previous" : ""}`.trim() : undefined,
      tone: "navy",
    }));
    const blocks: Block[] = [];
    if (tiles.length) blocks.push({ kind: "kpis", items: tiles });
    blocks.push(...proseBlocks(prose));
    if (!data.headline.length && !data.categories.length) {
      blocks.push(noteBlock("The Statistics Hub returned no indicators for this request.", "لم يُرجع مركز الإحصاء أي مؤشرات لهذا الطلب."));
    }
    for (const c of data.categories) {
      blocks.push({ kind: "heading", level: 3, text: bi(c.nameEn, c.nameAr) });
      blocks.push({
        kind: "table",
        columns: [bi("Indicator", "المؤشر"), T.latest, T.period, bi("Previous", "السابق"), T.change],
        rows: c.indicators.map((t) => [
          bi(`${t.nameEn}${t.illustrative ? " (illustrative)" : ""}`, `${t.nameAr}${t.illustrative ? " (استرشادي)" : ""}`),
          bi(valueText(t), valueText(t)),
          bi(t.latestPeriod ?? "", t.latestPeriod ?? ""),
          bi(t.previous == null ? "n/a" : fmt(t.previous, t.decimals), t.previous == null ? "غير متاح" : fmt(t.previous, t.decimals)),
          bi(changeOf(t) == null ? "n/a" : signed(changeOf(t), t.decimals), changeOf(t) == null ? "غير متاح" : signed(changeOf(t), t.decimals)),
        ]),
        align: ["start", "end", "end", "end", "end"],
        source: bi("General Authority for Statistics (GASTAT)", "الهيئة العامة للإحصاء"),
      });
    }
    if (data.chart) {
      blocks.push({
        kind: "chart",
        chart: {
          type: "line",
          title: bi(data.chart.nameEn, data.chart.nameAr),
          unit: data.chart.unit ?? undefined,
          series: [{ name: bi(data.chart.nameEn, data.chart.nameAr), role: "primary", points: data.chart.points }],
          source: bi("General Authority for Statistics (GASTAT), as held in EnviroAI", "الهيئة العامة للإحصاء، كما هو محفوظ في EnviroAI"),
        },
      });
    }
    return section("statistics_highlights", bi("Statistics highlights", "أبرز الإحصاءات"), "glance", {
      lead: bi(`${period.en} in the official numbers.`, `${period.ar} بالأرقام الرسمية.`),
      blocks,
      sources: makeSources([SRC.statistics(), ...data.sourceLines.map((s) => ({ title: s }))]),
      meta: { live, headline: data.headline.length, categories: data.categories.map((c) => c.code) },
    });
  },
};

export default def;
