// CR08 5.3: project closure. For a project report: the objective, the key
// facts, the KPIs against target, the deliverables, the stakeholders, the
// last status update and the lessons the project leaves. For any other
// scope: the projects completed inside it, briefly.
import { getNodeDetail } from "@/server/services/strategy";
import { listDeliverables } from "@/server/services/deliverables";
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, fmtAuto, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { leadNames, navigator, resolveScope } from "./_scope";

type Closure = {
  code: string | null;
  titleEn: string;
  titleAr: string;
  type: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetQar: number | null;
  parentEn: string | null;
  parentAr: string | null;
  outcomeEn: string | null;
  outcomeAr: string | null;
  leadEn: string;
  leadAr: string;
  kpis: { nameEn: string; nameAr: string; unit: string | null; latest: number | null; target: number | null; baseline: number | null }[];
  deliverables: { code: string; titleEn: string; titleAr: string; delivered: string | null; acceptance: string }[];
  stakeholders: { role: string; nameEn: string; nameAr: string; orgEn: string | null; orgAr: string | null }[];
  lastUpdate: { date: string; status: string; progressPct: number; summaryEn: string | null; summaryAr: string | null } | null;
  lessons: { titleEn: string; titleAr: string; recommendationEn: string | null; recommendationAr: string | null }[];
};
type Brief = { code: string | null; titleEn: string; titleAr: string; endDate: string | null; leadEn: string; leadAr: string; deliverables: number };
type ClosureData = { project: Closure | null; completed: Brief[] };

const ROLE_AR: Record<string, string> = { sponsor: "الراعي", owner: "المالك", manager: "المدير", team: "الفريق", expert: "خبير", external_partner: "شريك خارجي" };

const def: SectionDefinition<ClosureData> = {
  code: "project_closure",
  name: bi("Project closure", "إقفال المشروع"),
  description: bi(
    "The closing record of a project: objective, results against KPIs, deliverables, stakeholders and the lessons it leaves.",
    "السجل الختامي للمشروع: الهدف، والنتائج مقابل المؤشرات، والمخرجات، وأصحاب المصلحة، والدروس التي يخلفها."
  ),
  layout: "opener",
  estimatedPages: 3,
  appliesTo: ["project"],
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    if (scope.project) {
      const detail = await getNodeDetail(ctx.user, scope.project.id);
      if (!detail) return { project: null, completed: [] };
      const deliverables = await listDeliverables(ctx.user, scope.project.id).catch(() => []);
      const lead = leadNames(detail.leads);
      const latestValueOf = (kpiId: string) => {
        const vals = detail.kpiValues.filter((v) => v.kpiId === kpiId && v.actualValue != null);
        return vals[vals.length - 1]?.actualValue ?? null;
      };
      const last = detail.updates[0] ?? null;
      return {
        project: {
          code: detail.node.code,
          titleEn: detail.node.titleEn,
          titleAr: detail.node.titleAr,
          type: detail.node.nodeType,
          descriptionEn: detail.node.descriptionEn,
          descriptionAr: detail.node.descriptionAr,
          status: detail.node.status,
          startDate: detail.node.startDate,
          endDate: detail.node.endDate,
          budgetQar: detail.node.budgetQar,
          parentEn: detail.parent ? `${detail.parent.code ?? ""} ${detail.parent.titleEn}`.trim() : null,
          parentAr: detail.parent ? `${detail.parent.code ?? ""} ${detail.parent.titleAr}`.trim() : null,
          outcomeEn: scope.outcome ? `${scope.outcome.code ?? ""} ${scope.outcome.titleEn}`.trim() : null,
          outcomeAr: scope.outcome ? `${scope.outcome.code ?? ""} ${scope.outcome.titleAr}`.trim() : null,
          leadEn: lead.en,
          leadAr: lead.ar,
          kpis: detail.kpis.map((k) => ({ nameEn: k.nameEn, nameAr: k.nameAr, unit: k.unit, latest: latestValueOf(k.id), target: k.targetValue, baseline: k.baselineValue })),
          deliverables: deliverables.map((d) => ({ code: d.deliverableCode, titleEn: d.titleEn, titleAr: d.titleAr || d.titleEn, delivered: d.deliveredDate, acceptance: d.acceptanceStatus })),
          stakeholders: detail.stakeholders.slice(0, 12).map((s) => ({ role: s.role, nameEn: s.nameEn, nameAr: s.nameAr, orgEn: s.organisationEn, orgAr: s.organisationAr })),
          lastUpdate: last ? { date: last.createdAt.slice(0, 10), status: last.status, progressPct: last.progressPct, summaryEn: last.summaryEn, summaryAr: last.summaryAr } : null,
          lessons: detail.lessons.slice(0, 6).map((l) => ({ titleEn: l.titleEn, titleAr: l.titleAr || l.titleEn, recommendationEn: l.recommendationEn, recommendationAr: l.recommendationAr })),
        },
        completed: [],
      };
    }
    const completed: Brief[] = (nav?.items ?? [])
      .filter((i) => scope.scopeNodeIds.has(i.id) && i.status === "completed")
      .slice(0, 8)
      .map((i) => {
        const lead = leadNames(i.leads);
        return { code: i.code, titleEn: i.titleEn, titleAr: i.titleAr, endDate: i.endDate, leadEn: lead.en, leadAr: lead.ar, deliverables: i.deliverableCount };
      });
    return { project: null, completed };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const p = data.project;
    const mock = (): Prose => {
      if (!p) {
        return {
          paragraphs: data.completed.length
            ? [bi(`${fmt(data.completed.length)} projects in scope reached completion: ${data.completed.map((c) => c.code ?? c.titleEn).join(", ")}.`, `بلغ ${fmt(data.completed.length)} مشاريع ضمن النطاق مرحلة الاكتمال: ${data.completed.map((c) => c.code ?? c.titleAr).join("، ")}.`)]
            : [bi("This section closes a single project; the request names none, and no project in scope is completed.", "يقفل هذا القسم مشروعاً واحداً؛ ولا يذكر الطلب أي مشروع، ولا يوجد مشروع مكتمل ضمن النطاق.")],
        };
      }
      const accepted = p.deliverables.filter((d) => d.acceptance === "accepted").length;
      return {
        lead: bi(`${p.code ?? ""} ${p.titleEn}: the closing record.`.trim(), `${p.code ?? ""} ${p.titleAr}: السجل الختامي.`.trim()),
        paragraphs: [
          bi(
            `${p.code ?? ""} ${p.titleEn}${p.parentEn ? `, under ${p.parentEn}` : ""}${p.outcomeEn ? ` within ${p.outcomeEn}` : ""}, ${p.descriptionEn ? `set out to ${p.descriptionEn.charAt(0).toLowerCase()}${p.descriptionEn.slice(1).split(/(?<=[.!?])\s/)[0]}` : "was delivered by its lead"}. It ran ${p.startDate ? `from ${p.startDate}` : ""}${p.endDate ? ` to ${p.endDate}` : ""}${p.budgetQar ? ` with a budget of QAR ${fmt(p.budgetQar)}` : ""} under ${p.leadEn}, and closes ${statusText(p.status).en}${p.lastUpdate ? ` at ${fmt(p.lastUpdate.progressPct)}% progress as last reported on ${p.lastUpdate.date}` : ""}.`.trim(),
            `${p.code ?? ""} ${p.titleAr}${p.parentAr ? `، ضمن ${p.parentAr}` : ""}${p.outcomeAr ? ` في إطار ${p.outcomeAr}` : ""}، ${p.descriptionAr ? `سعى إلى: ${p.descriptionAr.split(/(?<=[.!?؟])\s/)[0]}` : "نُفذ تحت إشراف جهته المسؤولة"}. وامتد ${p.startDate ? `من ${p.startDate}` : ""}${p.endDate ? ` إلى ${p.endDate}` : ""}${p.budgetQar ? ` بميزانية قدرها ${fmt(p.budgetQar)} ريالاً السعوديةياً` : ""} تحت إشراف ${p.leadAr}، ويُقفل بحالة ${statusText(p.status).ar}${p.lastUpdate ? ` عند ${fmt(p.lastUpdate.progressPct)}% من التقدم وفق آخر تقرير في ${p.lastUpdate.date}` : ""}.`.trim()
          ),
          bi(
            `${fmt(p.deliverables.length)} deliverables were received, ${fmt(accepted)} accepted; ${fmt(p.kpis.length)} KPIs were tracked and ${fmt(p.stakeholders.length)} stakeholders are on record. ${p.lessons.length ? `The project leaves ${fmt(p.lessons.length)} lessons for the ones that follow.` : "No lesson has been documented for it yet."}`,
            `واستُلم ${fmt(p.deliverables.length)} مخرجاً، قُبل منها ${fmt(accepted)}؛ وتُوبع ${fmt(p.kpis.length)} مؤشراً، وسُجل ${fmt(p.stakeholders.length)} من أصحاب المصلحة. ${p.lessons.length ? `ويخلف المشروع ${fmt(p.lessons.length)} دروس للمشاريع التالية.` : "ولم يُوثق له أي درس بعد."}`
          ),
        ],
      };
    };
    const { prose, live } = await writeProse(
      ctx,
      "project_closure",
      {
        purpose: "Write the closing narrative of the project: what it set out to do, what it delivered and measured, who carried it, and what it teaches.",
        structure: "A lead sentence, then two or three paragraphs: objective and timeline; results (deliverables, KPIs) ; stakeholders and lessons. Name the project by code.",
        paragraphs: 3,
        lead: true,
      },
      p ? { ...p, descriptionEn: p.descriptionEn?.slice(0, 800), descriptionAr: p.descriptionAr?.slice(0, 800) } : { completed: data.completed },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!p) {
      if (data.completed.length) {
        blocks.push({
          kind: "table",
          caption: bi("Completed projects in scope", "المشاريع المكتملة ضمن النطاق"),
          columns: [T.code, T.title, T.lead, bi("End date", "تاريخ الانتهاء"), T.deliverables],
          rows: data.completed.map((c) => [bi(c.code ?? "", c.code ?? ""), bi(c.titleEn, c.titleAr), bi(c.leadEn, c.leadAr), bi(c.endDate ?? "", c.endDate ?? ""), bi(fmt(c.deliverables), fmt(c.deliverables))]),
          align: ["start", "start", "start", "end", "end"],
        });
      } else {
        blocks.push(noteBlock("No project to close in this scope.", "لا مشروع لإقفاله ضمن هذا النطاق."));
      }
    } else {
      blocks.push({
        kind: "table",
        caption: bi("Key facts", "الحقائق الأساسية"),
        columns: [bi("Field", "الحقل"), T.value],
        rows: [
          [T.status, statusText(p.status)],
          [bi("Start", "البداية"), bi(p.startDate ?? "", p.startDate ?? "")],
          [bi("End", "النهاية"), bi(p.endDate ?? "", p.endDate ?? "")],
          [bi("Budget (SAR)", "الميزانية (ريال سعودي)"), bi(p.budgetQar ? fmt(p.budgetQar) : "", p.budgetQar ? fmt(p.budgetQar) : "")],
          [T.lead, bi(p.leadEn, p.leadAr)],
          [bi("Parent", "الأصل"), bi(p.parentEn ?? "", p.parentAr ?? "")],
          [T.outcome, bi(p.outcomeEn ?? "", p.outcomeAr ?? "")],
        ],
      });
      if (p.kpis.length) {
        blocks.push({
          kind: "table",
          caption: bi("Results against KPIs", "النتائج مقابل المؤشرات"),
          columns: [bi("KPI", "المؤشر"), bi("Baseline", "خط الأساس"), T.latest, T.target, T.unit],
          rows: p.kpis.map((k) => [bi(k.nameEn, k.nameAr), bi(k.baseline != null ? fmtAuto(k.baseline) : "", k.baseline != null ? fmtAuto(k.baseline) : ""), bi(k.latest != null ? fmtAuto(k.latest) : "n/a", k.latest != null ? fmtAuto(k.latest) : "غير متاح"), bi(k.target != null ? fmtAuto(k.target) : "", k.target != null ? fmtAuto(k.target) : ""), bi(k.unit ?? "", k.unit ?? "")]),
          align: ["start", "end", "end", "end", "start"],
        });
      }
      if (p.deliverables.length) {
        blocks.push({
          kind: "table",
          caption: bi("Deliverables", "المخرجات"),
          columns: [T.code, T.title, T.delivered, T.acceptance],
          rows: p.deliverables.map((d) => [bi(d.code, d.code), bi(d.titleEn, d.titleAr), bi(d.delivered ?? "", d.delivered ?? ""), statusText(d.acceptance)]),
          align: ["start", "start", "end", "start"],
        });
      }
      if (p.stakeholders.length) {
        blocks.push({
          kind: "table",
          caption: bi("Stakeholders", "أصحاب المصلحة"),
          columns: [T.role, T.name, T.organisation],
          rows: p.stakeholders.map((s) => [bi(s.role.replace(/_/g, " "), ROLE_AR[s.role] ?? s.role), bi(s.nameEn, s.nameAr), bi(s.orgEn ?? "", s.orgAr ?? s.orgEn ?? "")]),
        });
      }
      if (p.lastUpdate?.summaryEn) {
        blocks.push({ kind: "quote", text: bi(p.lastUpdate.summaryEn, p.lastUpdate.summaryAr ?? p.lastUpdate.summaryEn), attribution: bi(`Last status update, ${p.lastUpdate.date}`, `آخر تحديث للحالة، ${p.lastUpdate.date}`) });
      }
      if (p.lessons.length) {
        blocks.push({ kind: "heading", level: 3, text: bi("Lessons the project leaves", "الدروس التي يخلفها المشروع") });
        blocks.push({ kind: "bullets", items: p.lessons.map((l) => bi(`${l.titleEn}${l.recommendationEn ? `: ${l.recommendationEn}` : ""}`, `${l.titleAr}${l.recommendationAr ? `: ${l.recommendationAr}` : ""}`)) });
      }
    }
    return section("project_closure", p ? bi(`${p.code ?? ""} ${p.titleEn}`.trim(), `${p.code ?? ""} ${p.titleAr}`.trim()) : bi("Project closure", "إقفال المشروع"), "opener", {
      lead: prose.lead ?? bi(`Closure record, ${period.en}.`, `سجل الإقفال، ${period.ar}.`),
      keyFigure: p ? { value: `${p.deliverables.filter((d) => d.acceptance === "accepted").length}/${p.deliverables.length}`, label: bi("deliverables accepted", "مخرجات مقبولة") } : undefined,
      blocks,
      sources: makeSources([SRC.strategy("nes3"), SRC.vault(), SRC.lessons()]),
      meta: { live, project: p?.code ?? null, completed: data.completed.length },
    });
  },
};

export default def;
