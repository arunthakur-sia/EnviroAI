// CR08 5.3: the seven national outcomes side by side: targets, initiatives,
// projects, the share of targets on track, and the lead entities, with a
// bar of progress per outcome.
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, pct, proseBlocks, section, SRC, makeSources, noteBlock, writeProse, T, type Prose } from "./_shared";
import { leadNames, navigator, resolveScope } from "./_scope";

type OutcomeRow = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  progress: number;
  targets: number;
  initiatives: number;
  projects: number;
  leadEn: string;
  leadAr: string;
};

type OverviewData = { edition: { code: string; nameEn: string; nameAr: string } | null; outcomes: OutcomeRow[]; glance: { onTrack: number; total: number } };

const def: SectionDefinition<OverviewData> = {
  code: "nds3_outcomes_overview",
  name: bi("NDS3 outcomes overview", "نظرة عامة على نتائج الاستراتيجية الوطنية الثالثة"),
  description: bi(
    "The national outcomes side by side: targets, initiatives, projects and the share on track, with the lead entities.",
    "النتائج الوطنية جنباً إلى جنب: المستهدفات والمبادرات والمشاريع ونسبة ما هو على المسار، مع الجهات المسؤولة."
  ),
  layout: "body",
  estimatedPages: 3,
  appliesTo: ["npc", "period"],
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    if (!nav) return { edition: null, outcomes: [], glance: { onTrack: 0, total: 0 } };
    const outcomes = nav.outcomes
      .filter((o) => scope.kind === "npc" || scope.kind === "period" || scope.scopeNodeIds.has(o.id))
      .map((o) => {
        const lead = leadNames(o.leads);
        return {
          id: o.id,
          code: o.code,
          titleEn: o.titleEn,
          titleAr: o.titleAr,
          status: o.status,
          progress: o.progress,
          targets: o.targetCount,
          initiatives: o.initiativeCount,
          projects: o.projectCount,
          leadEn: lead.en,
          leadAr: lead.ar,
        };
      });
    return {
      edition: { code: nav.edition.code, nameEn: nav.edition.nameEn, nameAr: nav.edition.nameAr },
      outcomes,
      glance: { onTrack: nav.glance.targetsOnTrack, total: nav.glance.targetsTotal },
    };
  },
  async write(ctx, data) {
    const sorted = [...data.outcomes].sort((a, b) => b.progress - a.progress);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const mock = (): Prose => ({
      paragraphs: data.outcomes.length
        ? [
            bi(
              `${data.edition?.nameEn ?? "The strategy"} is organised around ${fmt(data.outcomes.length)} national outcomes carrying ${fmt(data.outcomes.reduce((s, o) => s + o.targets, 0))} targets, ${fmt(data.outcomes.reduce((s, o) => s + o.initiatives, 0))} initiatives and ${fmt(data.outcomes.reduce((s, o) => s + o.projects, 0))} projects; ${fmt(data.glance.onTrack)} of ${fmt(data.glance.total)} targets are on track.`,
              `تنتظم ${data.edition?.nameAr ?? "الاستراتيجية"} حول ${fmt(data.outcomes.length)} نتائج وطنية تحمل ${fmt(data.outcomes.reduce((s, o) => s + o.targets, 0))} مستهدفاً و${fmt(data.outcomes.reduce((s, o) => s + o.initiatives, 0))} مبادرة و${fmt(data.outcomes.reduce((s, o) => s + o.projects, 0))} مشروعاً؛ و${fmt(data.glance.onTrack)} من أصل ${fmt(data.glance.total)} مستهدفاً على المسار.`
            ),
            bi(
              `${best.code ?? best.titleEn} leads with ${pct(best.progress)} of its targets on track, while ${worst.code ?? worst.titleEn} stands at ${pct(worst.progress)} and carries the most delivery attention in the period.`,
              `تتصدر ${best.code ?? best.titleAr} بنسبة ${pct(best.progress)} من مستهدفاتها على المسار، بينما تقف ${worst.code ?? worst.titleAr} عند ${pct(worst.progress)} وتستأثر بأكبر قدر من الاهتمام التنفيذي في الفترة.`
            ),
          ]
        : [bi("No national outcomes are recorded for this scope.", "لا توجد نتائج وطنية مسجلة لهذا النطاق.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "nds3_outcomes_overview",
      {
        purpose: "Give the reader the shape of the national strategy and where delivery is strongest and weakest across the outcomes.",
        structure: "Two paragraphs: the structure in numbers; the spread of progress naming the leading and lagging outcomes by code.",
        paragraphs: 2,
      },
      data,
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.outcomes.length) {
      blocks.push(noteBlock("The Living Strategy holds no outcomes for this scope.", "لا تحتوي الاستراتيجية الحية على نتائج لهذا النطاق."));
    } else {
      blocks.push({
        kind: "table",
        caption: bi("Outcomes and their delivery structure", "النتائج وهيكل تنفيذها"),
        columns: [T.code, T.outcome, T.targets, T.initiatives, T.projects, T.progress, T.lead],
        rows: data.outcomes.map((o) => [
          bi(o.code ?? "", o.code ?? ""),
          bi(o.titleEn, o.titleAr),
          bi(fmt(o.targets), fmt(o.targets)),
          bi(fmt(o.initiatives), fmt(o.initiatives)),
          bi(fmt(o.projects), fmt(o.projects)),
          bi(pct(o.progress), pct(o.progress)),
          bi(o.leadEn, o.leadAr),
        ]),
        align: ["start", "start", "end", "end", "end", "end", "start"],
        source: bi("SiaNexus Living Strategy", "الاستراتيجية الحية في سيا نكسس"),
      });
      blocks.push({
        kind: "chart",
        chart: {
          type: "bar",
          title: bi("Share of targets on track, by outcome", "نسبة المستهدفات على المسار بحسب النتيجة"),
          unit: "%",
          yMin: 0,
          yMax: 100,
          series: [
            {
              name: bi("On track", "على المسار"),
              role: "primary",
              points: data.outcomes.map((o) => ({ x: o.code ?? o.titleEn, y: Math.round(o.progress * 100) })),
            },
          ],
          source: bi("SiaNexus Living Strategy", "الاستراتيجية الحية في سيا نكسس"),
        },
      });
    }
    return section("nds3_outcomes_overview", bi("NDS3 outcomes overview", "نظرة عامة على نتائج الاستراتيجية الوطنية الثالثة"), "body", {
      lead: data.edition
        ? bi(`${data.edition.nameEn}: ${fmt(data.outcomes.length)} outcomes, one picture.`, `${data.edition.nameAr}: ${fmt(data.outcomes.length)} نتائج في صورة واحدة.`)
        : undefined,
      blocks,
      sources: makeSources(data.edition ? [SRC.strategy(data.edition.code)] : []),
      meta: { live, outcomes: data.outcomes.length },
    });
  },
};

export default def;
