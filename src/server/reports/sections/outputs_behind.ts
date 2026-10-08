// CR08 5.3: outputs behind and decisions needed. The Programme Strategy
// outputs and projects whose indicators read behind or at risk, the NES
// initiatives and projects that are delayed or at risk, and the open
// council risks with the highest likelihood times impact as the decisions
// the leadership is asked to take.
import { getCouncilPageData } from "@/server/services/council";
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, memo, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { leadNames, navigator, resolveScope } from "./_scope";

type BehindRow = { code: string | null; titleEn: string; titleAr: string; level: string; ownerEn: string; ownerAr: string; behind: number; atRisk: number; status: string };
type NdsRow = { code: string | null; titleEn: string; titleAr: string; status: string; leadEn: string; leadAr: string; endDate: string | null };
type Decision = { code: string | null; titleEn: string; titleAr: string; score: number; mitigationEn: string | null; mitigationAr: string | null; ownerEn: string | null; ownerAr: string | null; nodeEn: string | null; nodeAr: string | null };
type BehindData = { council: BehindRow[]; nes: NdsRow[]; decisions: Decision[]; illustrative: boolean; hasCouncil: boolean; editionCode: string | null };

const def: SectionDefinition<BehindData> = {
  code: "outputs_behind",
  name: bi("Outputs behind and decisions needed", "المخرجات المتأخرة والقرارات المطلوبة"),
  description: bi(
    "The outputs and projects whose indicators are behind or at risk, the delayed NES items, and the open risks that need a leadership decision.",
    "المخرجات والمشاريع التي تأخرت مؤشراتها أو تعرضت للخطر، وعناصر الاستراتيجية الوطنية المتأخرة، والمخاطر المفتوحة التي تحتاج إلى قرار قيادي."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: ["org", "period", "department"],
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    const data = await memo(ctx, "council", () => getCouncilPageData(ctx.user).catch(() => null));
    const council: BehindRow[] = [];
    if (data) {
      const byNode = new Map<string, { behind: number; atRisk: number }>();
      for (const i of data.indicators) {
        const e = byNode.get(i.nodeId) ?? { behind: 0, atRisk: 0 };
        if (i.rag === "behind") e.behind += 1;
        if (i.rag === "at_risk") e.atRisk += 1;
        byNode.set(i.nodeId, e);
      }
      for (const n of data.nodes) {
        if (n.level !== "output" && n.level !== "project") continue;
        if (scope.kind === "department" && scope.unit && n.ownerUnit?.id !== scope.unit.id) continue;
        const e = byNode.get(n.id);
        const flagged = (e && (e.behind || e.atRisk)) || n.status === "delayed" || n.status === "at_risk";
        if (!flagged) continue;
        council.push({ code: n.code, titleEn: n.titleEn, titleAr: n.titleAr, level: n.level, ownerEn: n.ownerUnit?.nameEn ?? n.ownerUser?.nameEn ?? "unassigned", ownerAr: n.ownerUnit?.nameAr ?? n.ownerUser?.nameAr ?? "غير محدد", behind: e?.behind ?? 0, atRisk: e?.atRisk ?? 0, status: n.status });
      }
      council.sort((a, b) => b.behind - a.behind || b.atRisk - a.atRisk);
    }
    const nes: NdsRow[] = (nav?.items ?? [])
      .filter((i) => scope.scopeNodeIds.has(i.id) && (i.status === "delayed" || i.status === "at_risk"))
      .slice(0, 12)
      .map((i) => {
        const lead = leadNames(i.leads);
        return { code: i.code, titleEn: i.titleEn, titleAr: i.titleAr, status: i.status, leadEn: lead.en, leadAr: lead.ar, endDate: i.endDate };
      });
    const nodeById = new Map((data?.nodes ?? []).map((n) => [n.id, n]));
    const decisions: Decision[] = (data?.risks ?? [])
      .filter((r) => r.status !== "closed" && r.status !== "resolved")
      .map((r) => ({ code: r.code, titleEn: r.titleEn, titleAr: r.titleAr, score: r.likelihood * r.impact, mitigationEn: r.mitigationEn, mitigationAr: r.mitigationAr, ownerEn: r.owner?.nameEn ?? null, ownerAr: r.owner?.nameAr ?? null, nodeEn: r.nodeId ? nodeById.get(r.nodeId)?.titleEn ?? null : null, nodeAr: r.nodeId ? nodeById.get(r.nodeId)?.titleAr ?? null : null }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { council: council.slice(0, 15), nes, decisions, illustrative: data?.strategy.isIllustrative ?? false, hasCouncil: Boolean(data), editionCode: scope.edition?.code ?? null };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const mock = (): Prose => ({
      paragraphs: [
        bi(
          `${data.council.length ? `${fmt(data.council.length)} Programme Strategy outputs and projects carry at least one indicator behind or at risk` : "No Programme Strategy output carries an indicator behind or at risk"}${data.nes.length ? `, and ${fmt(data.nes.length)} NES initiatives and projects in scope are delayed or at risk` : ""} as at ${period.en}.${data.council[0] ? ` The most exposed is ${data.council[0].code ?? data.council[0].titleEn} (${fmt(data.council[0].behind)} behind, ${fmt(data.council[0].atRisk)} at risk), owned by ${data.council[0].ownerEn}.` : ""}`,
          `${data.council.length ? `يحمل ${fmt(data.council.length)} من مخرجات ومشاريع استراتيجية المكتب مؤشراً واحداً على الأقل متأخراً أو معرضاً للخطر` : "لا يحمل أي مخرج في استراتيجية المكتب مؤشراً متأخراً أو معرضاً للخطر"}${data.nes.length ? `، ويوجد ${fmt(data.nes.length)} من مبادرات ومشاريع الاستراتيجية الوطنية ضمن النطاق متأخرة أو معرضة للخطر` : ""} حتى ${period.ar}.${data.council[0] ? ` وأكثرها تعرضاً ${data.council[0].code ?? data.council[0].titleAr} (${fmt(data.council[0].behind)} متأخر، ${fmt(data.council[0].atRisk)} معرض للخطر)، وتملكه ${data.council[0].ownerAr}.` : ""}`
        ),
      ],
      callout: data.decisions.length
        ? {
            title: bi("Decisions needed", "القرارات المطلوبة"),
            text: bi(
              data.decisions.map((d, i) => `${i + 1}. ${d.titleEn}${d.mitigationEn ? `: ${d.mitigationEn}` : ""}${d.ownerEn ? ` (${d.ownerEn})` : ""}`).join(" "),
              data.decisions.map((d, i) => `${i + 1}. ${d.titleAr}${d.mitigationAr ? `: ${d.mitigationAr}` : ""}${d.ownerAr ? ` (${d.ownerAr})` : ""}`).join(" ")
            ),
          }
        : undefined,
    });
    const { prose, live } = await writeProse(
      ctx,
      "outputs_behind",
      {
        purpose: "Tell the leadership what is behind and what they are asked to decide, using the open risks and their recorded mitigations as the decision list.",
        structure: "One or two paragraphs on what is behind, naming items by code and owner. Then a callout titled 'Decisions needed' listing each decision as a numbered sentence built from the risk title and its mitigation.",
        paragraphs: 2,
        callout: true,
      },
      data,
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.hasCouncil && !data.nes.length) {
      blocks.push(noteBlock("Neither the Programme Strategy nor the NES items in scope report anything behind.", "لا تبلغ استراتيجية المكتب ولا عناصر الاستراتيجية الوطنية ضمن النطاق عن أي تأخر."));
    }
    if (data.council.length) {
      blocks.push({
        kind: "table",
        caption: bi("Programme Strategy outputs and projects behind or at risk (Internal)", "مخرجات ومشاريع استراتيجية المكتب المتأخرة أو المعرضة للخطر (داخلي)"),
        columns: [T.code, T.title, bi("Level", "المستوى"), T.owner, bi("Indicators behind", "مؤشرات متأخرة"), bi("Indicators at risk", "مؤشرات معرضة للخطر"), T.status],
        rows: data.council.map((r) => [bi(r.code ?? "", r.code ?? ""), bi(r.titleEn, r.titleAr), bi(r.level.replace(/_/g, " "), r.level === "output" ? "مخرج" : "مشروع"), bi(r.ownerEn, r.ownerAr), bi(fmt(r.behind), fmt(r.behind)), bi(fmt(r.atRisk), fmt(r.atRisk)), statusText(r.status)]),
        align: ["start", "start", "start", "start", "end", "end", "start"],
      });
    }
    if (data.nes.length) {
      blocks.push({
        kind: "table",
        caption: bi("NES initiatives and projects delayed or at risk", "مبادرات ومشاريع الاستراتيجية الوطنية المتأخرة أو المعرضة للخطر"),
        columns: [T.code, T.title, T.status, T.lead, bi("End date", "تاريخ الانتهاء")],
        rows: data.nes.map((r) => [bi(r.code ?? "", r.code ?? ""), bi(r.titleEn, r.titleAr), statusText(r.status), bi(r.leadEn, r.leadAr), bi(r.endDate ?? "", r.endDate ?? "")]),
        align: ["start", "start", "start", "start", "end"],
      });
    }
    if (data.decisions.length && !prose.callout) {
      blocks.push({ kind: "callout", title: bi("Decisions needed", "القرارات المطلوبة"), text: mock().callout!.text, tone: "navy" });
    }
    return section("outputs_behind", bi("Outputs behind and decisions needed", "المخرجات المتأخرة والقرارات المطلوبة"), "body", {
      lead: bi(`${fmt(data.council.length + data.nes.length)} items behind or at risk, ${fmt(data.decisions.length)} decisions for the leadership.`, `${fmt(data.council.length + data.nes.length)} عنصراً متأخراً أو معرضاً للخطر، و${fmt(data.decisions.length)} قرارات مطلوبة من القيادة.`),
      blocks,
      sources: makeSources([...(data.hasCouncil ? [SRC.council(data.illustrative)] : []), ...(data.editionCode ? [SRC.strategy(data.editionCode)] : [])]),
      meta: { live, internal: true, illustrative: data.illustrative, council: data.council.length, nes: data.nes.length, decisions: data.decisions.length },
    });
  },
};

export default def;
