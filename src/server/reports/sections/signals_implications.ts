// CR08 5.3: signals and implications. The accepted signals of the period
// (widened to the last year with a note when the period holds none), by
// type and impact, with what they touch in the strategy and why each
// matters, as recorded at triage.
import { listSignals, type SignalListItem } from "@/server/services/signals";
import { bi, type Block, type SectionDefinition } from "../spec";
import { dated, daysSincePeriodStart, fmt, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Sig = { id: string; titleEn: string; titleAr: string; type: string; impact: string; horizon: string; publisher: string | null; publishedAt: string | null; url: string | null; whyEn: string | null; whyAr: string | null; touches: string[] };
type SignalsData = { signals: Sig[]; widened: boolean; byType: Record<string, number>; byImpact: Record<string, number>; touched: { code: string; count: number }[] };

const sigOf = (s: SignalListItem): Sig => ({
  id: s.id,
  titleEn: s.titleEn,
  titleAr: s.titleAr || s.titleEn,
  type: s.signalType,
  impact: s.impact,
  horizon: s.horizon,
  publisher: s.publisher,
  publishedAt: (s.publishedAt ?? s.createdAt)?.slice(0, 10) ?? null,
  url: s.url,
  whyEn: s.whyItMattersEn,
  whyAr: s.whyItMattersAr,
  touches: s.links.filter((l) => l.resourceType === "node").map((l) => l.code ?? l.titleEn),
});

const def: SectionDefinition<SignalsData> = {
  code: "signals_implications",
  name: bi("Signals and implications", "الإشارات ودلالاتها"),
  description: bi(
    "The accepted external signals of the period, by type and impact, and what they imply for the outcomes they touch.",
    "الإشارات الخارجية المقبولة في الفترة بحسب النوع والأثر، وما تعنيه للنتائج التي تمسها."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: "all",
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const nodeId = scope.outcome?.id ?? scope.project?.id;
    const base = { triage: "accepted", limit: 120, nodeId };
    let rows = await listSignals(ctx.user, { ...base, days: daysSincePeriodStart(ctx.request.period) }).catch(() => [] as SignalListItem[]);
    let signals = rows.filter((s) => dated(s.publishedAt ?? s.createdAt, ctx.request.period));
    let widened = false;
    if (!signals.length) {
      rows = await listSignals(ctx.user, { ...base, days: 365 }).catch(() => [] as SignalListItem[]);
      signals = rows;
      widened = rows.length > 0;
    }
    const impactRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = signals
      .map(sigOf)
      .sort((a, b) => (impactRank[a.impact] ?? 9) - (impactRank[b.impact] ?? 9) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 20);
    const byType: Record<string, number> = {};
    const byImpact: Record<string, number> = {};
    const touchedCount = new Map<string, number>();
    for (const s of sorted) {
      byType[s.type] = (byType[s.type] ?? 0) + 1;
      byImpact[s.impact] = (byImpact[s.impact] ?? 0) + 1;
      for (const t of s.touches) touchedCount.set(t, (touchedCount.get(t) ?? 0) + 1);
    }
    const touched = [...touchedCount.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    return { signals: sorted, widened, byType, byImpact, touched };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const high = data.signals.filter((s) => s.impact === "high").slice(0, 3);
    const mock = (): Prose => ({
      paragraphs: data.signals.length
        ? [
            bi(
              `${fmt(data.signals.length)} accepted signals ${data.widened ? `were on the radar in the twelve months to ${period.en} (none was published inside the period itself)` : `were published in ${period.en}`}: ${fmt(data.byImpact.high ?? 0)} of high impact, ${fmt(data.byImpact.medium ?? 0)} medium and ${fmt(data.byImpact.low ?? 0)} low, most often of type ${Object.entries(data.byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "policy"}.${data.touched.length ? ` They touch ${data.touched.map((t) => `${t.code} (${t.count})`).join(", ")}.` : ""}`,
              `${fmt(data.signals.length)} إشارة مقبولة ${data.widened ? `كانت على الرادار في الأشهر الاثني عشر حتى ${period.ar} (ولم تُنشر أي منها داخل الفترة نفسها)` : `نُشرت في ${period.ar}`}: ${fmt(data.byImpact.high ?? 0)} عالية الأثر، و${fmt(data.byImpact.medium ?? 0)} متوسطة، و${fmt(data.byImpact.low ?? 0)} منخفضة، وأكثرها من نوع ${Object.entries(data.byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "policy"}.${data.touched.length ? ` وهي تمس ${data.touched.map((t) => `${t.code} (${t.count})`).join("، ")}.` : ""}`
            ),
          ]
        : [bi(`No accepted signal touches this scope in ${period.en} or the year before it.`, `لا تمس أي إشارة مقبولة هذا النطاق في ${period.ar} ولا في العام الذي سبقه.`)],
      bullets: high.map((s) => bi(`${s.titleEn}${s.publisher ? ` (${s.publisher})` : ""}: ${s.whyEn ?? "accepted at triage without a note."}`, `${s.titleAr}${s.publisher ? ` (${s.publisher})` : ""}: ${s.whyAr ?? s.whyEn ?? "قُبلت عند الفرز دون ملاحظة."}`)),
    });
    const { prose, live } = await writeProse(
      ctx,
      "signals_implications",
      {
        purpose: "Turn the accepted signals into implications for the strategy: what each high-impact signal means for the outcomes it touches, as an assessment grounded in the recorded 'why it matters'.",
        structure: "One paragraph of counts and coverage, then one bullet per high-impact signal (title, publisher, implication). Label judgements 'Assessment:'.",
        paragraphs: 1,
        bullets: Math.min(5, high.length || data.signals.length),
      },
      { period: period.en, widened: data.widened, byType: data.byType, byImpact: data.byImpact, touched: data.touched, signals: data.signals.slice(0, 12).map((s) => ({ ...s, whyEn: s.whyEn?.slice(0, 300), whyAr: s.whyAr?.slice(0, 300) })) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (data.widened) {
      blocks.push(noteBlock(`No signal was published inside ${period.en}; the table covers the preceding twelve months.`, `لم تُنشر أي إشارة داخل ${period.ar}؛ ويغطي الجدول الأشهر الاثني عشر السابقة.`));
    }
    if (data.signals.length) {
      blocks.push({
        kind: "table",
        caption: bi("Accepted signals by impact", "الإشارات المقبولة بحسب الأثر"),
        columns: [T.title, T.publisher, T.type, T.impact, T.horizon, T.date, bi("Touches", "تمس")],
        rows: data.signals.slice(0, 15).map((s) => [bi(s.titleEn, s.titleAr), bi(s.publisher ?? "", s.publisher ?? ""), bi(s.type, s.type), statusText(s.impact), statusText(s.horizon), bi(s.publishedAt ?? "", s.publishedAt ?? ""), bi(s.touches.join(", "), s.touches.join("، "))]),
        align: ["start", "start", "start", "start", "start", "end", "start"],
      });
    } else {
      blocks.push(noteBlock("No signals to tabulate.", "لا إشارات لجدولتها."));
    }
    return section("signals_implications", bi("Signals and implications", "الإشارات ودلالاتها"), "body", {
      lead: bi(`${fmt(data.signals.length)} accepted signals, ${fmt(data.byImpact.high ?? 0)} of high impact.`, `${fmt(data.signals.length)} إشارة مقبولة، منها ${fmt(data.byImpact.high ?? 0)} عالية الأثر.`),
      blocks,
      sources: makeSources([SRC.signals(), ...data.signals.slice(0, 15).map((s) => ({ title: s.titleEn, detail: [s.publisher, s.publishedAt].filter(Boolean).join(", "), url: s.url ?? undefined }))]),
      meta: { live, count: data.signals.length, widened: data.widened, byType: data.byType },
    });
  },
};

export default def;
