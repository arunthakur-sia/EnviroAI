// CR08 5.3: the targets scorecard. Every target in scope with its headline
// KPI: the latest actual, the target value, the attainment and a RAG cell
// computed direction-aware, plus the trend against the previous value.
import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { ragOf } from "@/lib/council-math";
import { bi, type Block, type Rag, type SectionDefinition, type Trend } from "../spec";
import { fmt, fmtAuto, pct, periodLabel, proseBlocks, ragOfCouncil, section, SRC, makeSources, noteBlock, trendOf, writeProse, T, type Prose } from "./_shared";
import { navigator, resolveScope } from "./_scope";

type TargetRow = {
  outcomeCode: string | null;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  kpiEn: string | null;
  kpiAr: string | null;
  unit: string | null;
  latest: number | null;
  latestPeriod: string | null;
  previous: number | null;
  target: number | null;
  attainment: number | null;
  rag: Rag;
  trend: Trend | undefined;
};

type ScorecardData = { rows: TargetRow[]; counts: { green: number; amber: number; red: number; none: number }; editionCode: string | null };

const def: SectionDefinition<ScorecardData> = {
  code: "targets_scorecard",
  name: bi("Targets scorecard", "بطاقة أداء المستهدفات"),
  description: bi(
    "Every target in scope with its headline KPI, the latest value against the target, attainment, RAG and trend.",
    "كل مستهدف ضمن النطاق مع مؤشره الرئيسي، وأحدث قيمة مقابل المستهدف، ونسبة التحقق، وحالة الأداء، والاتجاه."
  ),
  layout: "scorecard",
  estimatedPages: 2,
  appliesTo: ["npc", "period", "outcome", "project"],
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    if (!nav) return { rows: [], counts: { green: 0, amber: 0, red: 0, none: 0 }, editionCode: null };
    const targets = nav.targets.filter((t) => scope.scopeNodeIds.has(t.id)).sort((a, b) => a.sort - b.sort);
    const kpis = targets.length
      ? await db.select().from(schema.kpis).where(inArray(schema.kpis.nodeId, targets.map((t) => t.id)))
      : [];
    const values = kpis.length
      ? await db.select().from(schema.kpiValues).where(inArray(schema.kpiValues.kpiId, kpis.map((k) => k.id))).orderBy(asc(schema.kpiValues.period))
      : [];
    const outcomeCode = new Map(nav.outcomes.map((o) => [o.id, o.code]));
    const rows: TargetRow[] = targets.map((t) => {
      const kpi = kpis.find((k) => k.nodeId === t.id) ?? null;
      const series = kpi ? values.filter((v) => v.kpiId === kpi.id && v.actualValue != null) : [];
      const latest = series[series.length - 1] ?? null;
      const previous = series[series.length - 2] ?? null;
      const target = kpi?.targetValue ?? null;
      const { rag, attainment } = ragOf(latest?.actualValue ?? null, target, kpi?.direction ?? "up_good");
      return {
        outcomeCode: outcomeCode.get(t.outcomeId) ?? null,
        code: t.code,
        titleEn: t.titleEn,
        titleAr: t.titleAr,
        status: t.status,
        kpiEn: kpi?.nameEn ?? null,
        kpiAr: kpi?.nameAr ?? null,
        unit: kpi?.unit ?? null,
        latest: latest?.actualValue ?? null,
        latestPeriod: latest?.period ?? null,
        previous: previous?.actualValue ?? null,
        target,
        attainment,
        rag: ragOfCouncil(rag),
        trend: trendOf(previous?.actualValue, latest?.actualValue, kpi?.direction ?? "up_good"),
      };
    });
    const counts = { green: 0, amber: 0, red: 0, none: 0 };
    for (const r of rows) counts[r.rag] += 1;
    return { rows, counts, editionCode: scope.edition?.code ?? null };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const c = data.counts;
    const mock = (): Prose => ({
      paragraphs: data.rows.length
        ? [
            bi(
              `Of the ${fmt(data.rows.length)} targets in scope, ${fmt(c.green)} are on target against their headline KPI, ${fmt(c.amber)} are at risk, ${fmt(c.red)} are behind and ${fmt(c.none)} have no reported value yet. Attainment is read direction-aware: a falling indicator counts as progress where lower is better.`,
              `من بين ${fmt(data.rows.length)} مستهدفاً ضمن النطاق، يقع ${fmt(c.green)} ضمن المستهدف قياساً بمؤشره الرئيسي، و${fmt(c.amber)} معرض للخطر، و${fmt(c.red)} متأخر، و${fmt(c.none)} بلا قيمة مبلغ عنها بعد. وتُقرأ نسبة التحقق بحسب اتجاه المؤشر: فالمؤشر الهابط يُعد تقدماً حيث يكون الانخفاض أفضل.`
            ),
          ]
        : [bi("No target with a headline KPI falls inside this scope.", "لا يقع أي مستهدف له مؤشر رئيسي ضمن هذا النطاق.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "targets_scorecard",
      {
        purpose: "The one-paragraph reading of the scorecard: how many targets are on target, at risk, behind, and which ones deserve attention.",
        structure: "One paragraph with the counts, then optionally a second naming up to three targets by code that are behind or at risk.",
        paragraphs: 2,
      },
      { counts: data.counts, period: period.en, rows: data.rows.slice(0, 40) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.rows.length) {
      blocks.push(noteBlock("The scorecard is empty for this scope.", "بطاقة الأداء فارغة لهذا النطاق."));
    } else {
      blocks.push({
        kind: "scorecard",
        caption: bi(`Targets against their headline KPI, ${period.en}`, `المستهدفات مقابل مؤشرها الرئيسي، ${period.ar}`),
        columns: [T.outcome, bi("KPI", "المؤشر"), T.latest, T.target, bi("Attainment", "نسبة التحقق"), T.status],
        rows: data.rows.map((r) => ({
          label: bi(`${r.code ?? ""} ${r.titleEn}`.trim(), `${r.code ?? ""} ${r.titleAr}`.trim()),
          cells: [
            { text: r.outcomeCode ?? "" },
            { text: r.kpiEn ?? "" },
            { text: r.latest != null ? `${fmtAuto(r.latest)}${r.unit ? ` ${r.unit}` : ""}${r.latestPeriod ? ` (${r.latestPeriod})` : ""}` : "n/a", trend: r.trend },
            { text: r.target != null ? fmtAuto(r.target) : "n/a" },
            { text: r.attainment != null ? pct(Math.min(r.attainment, 1.5)) : "n/a", rag: r.rag },
            { text: r.rag === "green" ? "on target" : r.rag === "amber" ? "at risk" : r.rag === "red" ? "behind" : "no data", rag: r.rag },
          ],
        })),
        source: bi("SiaNexus Living Strategy, KPI values", "الاستراتيجية الحية في سيا نكسس، قيم المؤشرات"),
      });
    }
    return section("targets_scorecard", bi("Targets scorecard", "بطاقة أداء المستهدفات"), "scorecard", {
      lead: bi(`${fmt(c.green)} on target, ${fmt(c.amber)} at risk, ${fmt(c.red)} behind.`, `${fmt(c.green)} ضمن المستهدف، و${fmt(c.amber)} معرض للخطر، و${fmt(c.red)} متأخر.`),
      keyFigure: data.rows.length ? { value: `${c.green}/${data.rows.length}`, label: bi("targets on target", "مستهدفات ضمن المستهدف") } : undefined,
      blocks,
      sources: makeSources(data.editionCode ? [SRC.strategy(data.editionCode)] : []),
      meta: { live, ...data.counts },
    });
  },
};

export default def;
