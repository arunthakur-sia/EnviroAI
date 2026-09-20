// CR08 5.3: knowledge and continuity. The HR Knowledge Dashboard read for
// the organisation or one department: readiness, continuity and handover
// rings, the risk register by severity, the departments' repositories.
// Knowledge ownership and risks only; never points, badges or streaks
// (CR05 5.1), and only for users the dashboard itself admits.
import { getHrDepartments, getHrOverview } from "@/server/services/hr";
import { bi, type Block, type KpiTile, type SectionDefinition } from "../spec";
import { fmt, memo, pct, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Dept = { code: string; nameEn: string; nameAr: string; headcount: number; readiness: number; continuity: number; openRisks: number; openHandovers: number; documents: number; verifiedShare: number; staleShare: number; lessons: number; deliverables: number; headEn: string | null; headAr: string | null };
type Risk = { severity: string; title: string; detailEn: string | null; detailAr: string | null; kind: string };
type ContinuityData = { allowed: boolean; rings: { readiness: number; continuity: number; handoversComplete: number } | null; riskCounts: { critical: number; high: number; medium: number; low: number } | null; departments: Dept[]; topRisks: Risk[]; unitName: { en: string; ar: string } | null };

const def: SectionDefinition<ContinuityData> = {
  code: "knowledge_continuity",
  name: bi("Knowledge and continuity", "المعرفة والاستمرارية"),
  description: bi(
    "Readiness, continuity and handover scores, the open knowledge risks by severity, and each department's repository.",
    "درجات الجاهزية والاستمرارية والتسليم، ومخاطر المعرفة المفتوحة بحسب الشدة، ومستودع كل إدارة."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: ["npc", "department"],
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const overview = await memo(ctx, "hr-overview", () => getHrOverview(ctx.user).catch(() => null));
    const depts = await memo(ctx, "hr-departments", () => getHrDepartments(ctx.user).catch(() => null));
    if (!overview || !depts) return { allowed: false, rings: null, riskCounts: null, departments: [], topRisks: [], unitName: scope.unit ? { en: scope.unit.nameEn, ar: scope.unit.nameAr } : null };
    const wanted = scope.kind === "department" && scope.unit ? depts.departments.filter((d) => d.id === scope.unit!.id) : depts.departments;
    const departments: Dept[] = wanted
      .map((d) => ({ code: d.code, nameEn: d.nameEn, nameAr: d.nameAr, headcount: d.headcount, readiness: d.readiness, continuity: d.continuity, openRisks: d.openRisks, openHandovers: d.openHandovers, documents: d.repository.documents, verifiedShare: d.repository.verifiedShare, staleShare: d.repository.staleShare, lessons: d.repository.lessons, deliverables: d.repository.deliverables, headEn: d.head?.nameEn ?? null, headAr: d.head?.nameAr ?? null }))
      .sort((a, b) => a.continuity - b.continuity)
      .slice(0, 40);
    const unitId = scope.kind === "department" ? scope.unit?.id ?? null : null;
    const topRisks: Risk[] = overview.topRisks
      .filter((r) => !unitId || r.departmentId === unitId)
      .slice(0, 6)
      .map((r) => ({ severity: r.severity, title: r.title, detailEn: r.detailEn, detailAr: r.detailAr, kind: r.kind }));
    const scopedDept = unitId ? departments[0] : null;
    return {
      allowed: true,
      rings: scopedDept ? { readiness: scopedDept.readiness, continuity: scopedDept.continuity, handoversComplete: overview.rings.handoversComplete } : overview.rings,
      riskCounts: overview.riskCounts,
      departments,
      topRisks,
      unitName: scope.unit ? { en: scope.unit.nameEn, ar: scope.unit.nameAr } : null,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const weakest = data.departments[0];
    const mock = (): Prose => ({
      paragraphs: data.allowed && data.rings
        ? [
            bi(
              `${data.unitName ? data.unitName.en : "The organisation"} scores ${fmt(data.rings.readiness)} on knowledge readiness and ${fmt(data.rings.continuity)} on continuity as at ${period.en}, with ${fmt(data.rings.handoversComplete)}% of handovers complete. ${data.riskCounts ? `The open register holds ${fmt(data.riskCounts.critical)} critical, ${fmt(data.riskCounts.high)} high, ${fmt(data.riskCounts.medium)} medium and ${fmt(data.riskCounts.low)} low risks.` : ""}`,
              `تسجل ${data.unitName ? data.unitName.ar : "المنظمة"} ${fmt(data.rings.readiness)} في جاهزية المعرفة و${fmt(data.rings.continuity)} في الاستمرارية حتى ${period.ar}، مع اكتمال ${fmt(data.rings.handoversComplete)}% من التسليمات. ${data.riskCounts ? `ويحتوي السجل المفتوح على ${fmt(data.riskCounts.critical)} خطراً حرجاً، و${fmt(data.riskCounts.high)} عالياً، و${fmt(data.riskCounts.medium)} متوسطاً، و${fmt(data.riskCounts.low)} منخفضاً.` : ""}`
            ),
            ...(weakest && data.departments.length > 1
              ? [bi(`The lowest continuity score sits with ${weakest.nameEn} at ${fmt(weakest.continuity)} (${fmt(weakest.openRisks)} open risks, ${fmt(weakest.headcount)} staff).`, `وتقع أدنى درجة استمرارية لدى ${weakest.nameAr} عند ${fmt(weakest.continuity)} (${fmt(weakest.openRisks)} مخاطر مفتوحة، ${fmt(weakest.headcount)} موظفاً).`)]
              : []),
          ]
        : [bi("Knowledge continuity data is visible to HR Admins, Super Admins and Department Heads only; the requester's role does not admit it, so this section reports nothing.", "بيانات استمرارية المعرفة مرئية لمسؤولي الموارد البشرية والمشرفين العامين ورؤساء الإدارات فقط؛ ودور مقدم الطلب لا يتيحها، ولذلك لا يبلغ هذا القسم عن شيء.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "knowledge_continuity",
      {
        purpose: "Describe the state of institutional knowledge: readiness, continuity, the open risks and where they concentrate.",
        structure: "Two paragraphs: the rings and risk counts; the weakest department and why. Never mention points, badges or streaks.",
        paragraphs: 2,
      },
      data,
      mock
    );
    const blocks: Block[] = [];
    if (data.rings) {
      const tiles: KpiTile[] = [
        { label: bi("Readiness", "الجاهزية"), value: fmt(data.rings.readiness), tone: "maroon" },
        { label: bi("Continuity", "الاستمرارية"), value: fmt(data.rings.continuity), tone: "gulf" },
        { label: bi("Handovers complete", "تسليمات مكتملة"), value: `${fmt(data.rings.handoversComplete)}%`, tone: "gold" },
        { label: bi("Open risks", "مخاطر مفتوحة"), value: fmt(data.riskCounts ? data.riskCounts.critical + data.riskCounts.high + data.riskCounts.medium + data.riskCounts.low : 0), tone: "ink" },
      ];
      blocks.push({ kind: "kpis", items: tiles });
    }
    blocks.push(...proseBlocks(prose));
    if (!data.allowed) {
      blocks.push(noteBlock("Not available at the requester's role.", "غير متاح لدور مقدم الطلب."));
    } else {
      if (data.departments.length) {
        blocks.push({
          kind: "table",
          caption: bi("Departments by continuity score", "الإدارات بحسب درجة الاستمرارية"),
          columns: [T.department, T.headcount, T.readiness, T.continuity, T.risks, T.documents, bi("Verified", "موثق"), T.lessons, T.deliverables],
          rows: data.departments.map((d) => [bi(d.nameEn, d.nameAr), bi(fmt(d.headcount), fmt(d.headcount)), bi(fmt(d.readiness), fmt(d.readiness)), bi(fmt(d.continuity), fmt(d.continuity)), bi(fmt(d.openRisks), fmt(d.openRisks)), bi(fmt(d.documents), fmt(d.documents)), bi(pct(d.verifiedShare), pct(d.verifiedShare)), bi(fmt(d.lessons), fmt(d.lessons)), bi(fmt(d.deliverables), fmt(d.deliverables))]),
          align: ["start", "end", "end", "end", "end", "end", "end", "end", "end"],
          source: bi("SiaNexus HR Knowledge Dashboard", "لوحة معرفة الموارد البشرية في سيا نكسس"),
        });
      }
      if (data.topRisks.length) {
        blocks.push({ kind: "heading", level: 3, text: bi("Highest open risks", "أعلى المخاطر المفتوحة") });
        blocks.push({ kind: "bullets", items: data.topRisks.map((r) => bi(`${statusText(r.severity).en}: ${r.title}${r.detailEn ? `. ${r.detailEn}` : ""}`, `${statusText(r.severity).ar}: ${r.title}${r.detailAr ? `. ${r.detailAr}` : ""}`)) });
      }
    }
    return section("knowledge_continuity", bi("Knowledge and continuity", "المعرفة والاستمرارية"), "body", {
      lead: data.rings ? bi(`Readiness ${fmt(data.rings.readiness)}, continuity ${fmt(data.rings.continuity)}.`, `الجاهزية ${fmt(data.rings.readiness)}، والاستمرارية ${fmt(data.rings.continuity)}.`) : undefined,
      keyFigure: data.rings ? { value: fmt(data.rings.continuity), label: bi("continuity score", "درجة الاستمرارية") } : undefined,
      blocks,
      sources: makeSources(data.allowed ? [SRC.hr()] : []),
      meta: { live, allowed: data.allowed, departments: data.departments.length, internal: true },
    });
  },
};

export default def;
