// CR08 5.3: the Council Strategy scorecard for the report period: the five
// strategic goals with their indicators reported, on target, at risk and
// behind, the share on target as a RAG cell, and the indicators of another
// cadence stated rather than hidden (CR07 2.4.3). Internal; illustrative
// while the seeded strategy stands.
import { buildScorecard, getCouncilPageData, type Scorecard } from "@/server/services/council";
import { bi, type Block, type SectionDefinition } from "../spec";
import { cadenceOf, fmt, memo, pct, periodKey, periodLabel, proseBlocks, ragOfCouncil, section, SRC, makeSources, noteBlock, writeProse, T, type Prose } from "./_shared";

type CouncilData = {
  strategy: { nameEn: string; nameAr: string; illustrative: boolean; periodFrom: string | null; periodTo: string | null } | null;
  scorecard: Scorecard | null;
  indicatorsTotal: number;
};

function ragOfShare(share: number | null): "on_target" | "at_risk" | "behind" | "no_data" {
  if (share == null) return "no_data";
  return share >= 0.8 ? "on_target" : share >= 0.5 ? "at_risk" : "behind";
}

const def: SectionDefinition<CouncilData> = {
  code: "council_scorecard",
  name: bi("Council Strategy scorecard", "بطاقة أداء استراتيجية المجلس"),
  description: bi(
    "The Council's strategic goals for the period: indicators reported, on target, at risk and behind, with the share on target as a RAG cell.",
    "الأهداف الاستراتيجية للمجلس في الفترة: المؤشرات المبلغ عنها، وما هو ضمن المستهدف، والمعرض للخطر، والمتأخر، مع نسبة ما هو ضمن المستهدف كخلية أداء."
  ),
  layout: "scorecard",
  estimatedPages: 2,
  appliesTo: ["npc", "period"],
  async load(ctx) {
    const data = await memo(ctx, "council", () => getCouncilPageData(ctx.user).catch(() => null));
    if (!data) return { strategy: null, scorecard: null, indicatorsTotal: 0 };
    const scorecard = buildScorecard(data, periodKey(ctx.request.period), cadenceOf(ctx.request.period));
    return {
      strategy: { nameEn: data.strategy.nameEn, nameAr: data.strategy.nameAr, illustrative: data.strategy.isIllustrative, periodFrom: data.strategy.periodFrom, periodTo: data.strategy.periodTo },
      scorecard,
      indicatorsTotal: data.indicators.length,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const goals = data.scorecard?.goals ?? [];
    const totals = goals.reduce(
      (t, g) => ({ reported: t.reported + g.reported, onTarget: t.onTarget + g.onTarget, atRisk: t.atRisk + g.atRisk, behind: t.behind + g.behind, other: t.other + g.otherCadence.monthly + g.otherCadence.quarterly + g.otherCadence.yearly }),
      { reported: 0, onTarget: 0, atRisk: 0, behind: 0, other: 0 }
    );
    const best = [...goals].sort((a, b) => (b.share ?? -1) - (a.share ?? -1))[0];
    const worst = [...goals].filter((g) => g.share != null).sort((a, b) => (a.share ?? 2) - (b.share ?? 2))[0];
    const mock = (): Prose => ({
      paragraphs: data.strategy && goals.length
        ? [
            bi(
              `For ${period.en}, ${fmt(totals.reported)} of the ${fmt(data.indicatorsTotal)} indicators of ${data.strategy.nameEn} reported on the ${data.scorecard!.cadence} cadence: ${fmt(totals.onTarget)} on target, ${fmt(totals.atRisk)} at risk and ${fmt(totals.behind)} behind; ${fmt(totals.other)} indicators report on another cadence and are not scored here.${data.strategy.illustrative ? " The strategy on record is illustrative until the approved text replaces it." : ""}`,
              `في ${period.ar}، أبلغ ${fmt(totals.reported)} من أصل ${fmt(data.indicatorsTotal)} مؤشراً في ${data.strategy.nameAr} وفق الوتيرة ${data.scorecard!.cadence === "yearly" ? "السنوية" : data.scorecard!.cadence === "quarterly" ? "الربع سنوية" : "الشهرية"}: ${fmt(totals.onTarget)} ضمن المستهدف، و${fmt(totals.atRisk)} معرض للخطر، و${fmt(totals.behind)} متأخر؛ ويبلغ ${fmt(totals.other)} مؤشراً وفق وتيرة أخرى ولا يُحتسب هنا.${data.strategy.illustrative ? " والاستراتيجية المسجلة استرشادية إلى أن يحل النص المعتمد محلها." : ""}`
            ),
            ...(best && worst && best.goalId !== worst.goalId
              ? [
                  bi(
                    `${best.code ?? best.titleEn} leads with ${pct(best.share)} of its reported indicators on target; ${worst.code ?? worst.titleEn} is lowest at ${pct(worst.share)}.`,
                    `يتصدر ${best.code ?? best.titleAr} بنسبة ${pct(best.share)} من مؤشراته المبلغ عنها ضمن المستهدف؛ ويأتي ${worst.code ?? worst.titleAr} في الأدنى بنسبة ${pct(worst.share)}.`
                  ),
                ]
              : []),
          ]
        : [bi("No Council Strategy has been recorded, so there is no scorecard to report.", "لم تُسجل أي استراتيجية للمجلس، ولذلك لا توجد بطاقة أداء للإبلاغ عنها.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "council_scorecard",
      {
        purpose: "Read the Council's own strategy scorecard for the period: how the goals performed on their indicators.",
        structure: "Two paragraphs: the totals with the cadence caveat; the leading and lowest goals by code. Say plainly if the data is illustrative.",
        paragraphs: 2,
      },
      { strategy: data.strategy, period: period.en, cadence: data.scorecard?.cadence, totals, goals: goals.map((g) => ({ code: g.code, titleEn: g.titleEn, titleAr: g.titleAr, reported: g.reported, onTarget: g.onTarget, atRisk: g.atRisk, behind: g.behind, share: g.share, otherCadence: g.otherCadence })) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!goals.length) {
      blocks.push(noteBlock("The Council Strategy scorecard is empty for this period.", "بطاقة أداء استراتيجية المجلس فارغة لهذه الفترة."));
    } else {
      blocks.push({
        kind: "scorecard",
        caption: bi(`Strategic goals, ${period.en} (${data.scorecard!.cadence} indicators)`, `الأهداف الاستراتيجية، ${period.ar}`),
        columns: [T.reported, T.onTarget, T.atRisk, T.behind, T.share, bi("Other cadence", "وتيرة أخرى")],
        rows: goals.map((g) => ({
          label: bi(`${g.code ?? ""} ${g.titleEn}`.trim(), `${g.code ?? ""} ${g.titleAr}`.trim()),
          cells: [
            { text: fmt(g.reported) },
            { text: fmt(g.onTarget), rag: g.onTarget ? "green" : "none" },
            { text: fmt(g.atRisk), rag: g.atRisk ? "amber" : "none" },
            { text: fmt(g.behind), rag: g.behind ? "red" : "none" },
            { text: pct(g.share), rag: ragOfCouncil(ragOfShare(g.share)) },
            { text: fmt(g.otherCadence.monthly + g.otherCadence.quarterly + g.otherCadence.yearly) },
          ],
        })),
        source: bi(data.strategy?.illustrative ? "SiaNexus Council Strategy, illustrative data" : "SiaNexus Council Strategy", data.strategy?.illustrative ? "استراتيجية المجلس في سيا نكسس، بيانات استرشادية" : "استراتيجية المجلس في سيا نكسس"),
      });
      blocks.push({
        kind: "chart",
        chart: {
          type: "bar",
          title: bi("Share of reported indicators on target, by goal", "نسبة المؤشرات المبلغ عنها ضمن المستهدف بحسب الهدف"),
          unit: "%",
          yMin: 0,
          yMax: 100,
          series: [{ name: bi("On target", "ضمن المستهدف"), role: "primary", points: goals.map((g) => ({ x: g.code ?? g.titleEn, y: g.share == null ? null : Math.round(g.share * 100) })) }],
          note: bi("Internal. Illustrative while the seeded strategy stands.", "داخلي. استرشادي ما دامت الاستراتيجية المزروعة قائمة."),
        },
      });
    }
    return section("council_scorecard", bi("Council Strategy scorecard", "بطاقة أداء استراتيجية المجلس"), "scorecard", {
      lead: data.strategy ? bi(`${data.strategy.nameEn}, ${period.en}.`, `${data.strategy.nameAr}، ${period.ar}.`) : undefined,
      keyFigure: totals.reported ? { value: pct(totals.onTarget / totals.reported), label: bi("of reported indicators on target", "من المؤشرات المبلغ عنها ضمن المستهدف") } : undefined,
      blocks,
      sources: makeSources(data.strategy ? [SRC.council(data.strategy.illustrative)] : []),
      meta: { live, illustrative: data.strategy?.illustrative ?? false, internal: true, cadence: data.scorecard?.cadence, totals },
    });
  },
};

export default def;
