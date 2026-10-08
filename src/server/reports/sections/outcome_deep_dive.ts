// CR08 5.3: the outcome deep dive. One outcome for an outcome or project
// report, every outcome for a Office-wide one. Per outcome: the framing
// paragraph, the targets with their headline KPI, the initiative and project
// status mix, the status updates of the period, the leads and the lessons.
import { and, desc, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getOutcomeStakeholders } from "@/server/services/strategy";
import { bi, type Block, type SectionDefinition } from "../spec";
import {
  dated,
  fmt,
  fmtAuto,
  pct,
  periodLabel,
  section,
  SRC,
  makeSources,
  noteBlock,
  statusText,
  writeProse,
  T,
  type Prose,
} from "./_shared";
import { descendantsOf, leadNames, navigator, resolveScope } from "./_scope";

type OutcomeFacts = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  status: string;
  progress: number;
  leadEn: string;
  leadAr: string;
  ownerDeptEn: string | null;
  ownerDeptAr: string | null;
  targets: { code: string | null; titleEn: string; titleAr: string; status: string; kpiEn: string | null; kpiAr: string | null; latest: number | null; target: number | null; unit: string | null; period: string | null }[];
  items: { total: number; onTrack: number; atRisk: number; delayed: number; completed: number; notStarted: number };
  updates: { nodeEn: string; nodeAr: string; status: string; progressPct: number; summaryEn: string | null; summaryAr: string | null; createdAt: string }[];
  lessons: number;
};

type DeepDiveData = { outcomes: OutcomeFacts[]; editionCode: string | null; single: boolean };

const def: SectionDefinition<DeepDiveData> = {
  code: "outcome_deep_dive",
  name: bi("Outcome deep dive", "قراءة معمقة في النتيجة"),
  description: bi(
    "Per outcome: the framing, the targets and their KPIs, the initiative and project mix, the period's status updates, the leads and the lessons.",
    "لكل نتيجة: الإطار، والمستهدفات ومؤشراتها، ومزيج المبادرات والمشاريع، وتحديثات الحالة في الفترة، والجهات المسؤولة، والدروس."
  ),
  layout: "opener",
  estimatedPages: 3,
  appliesTo: ["org", "outcome", "project"],
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    if (!nav) return { outcomes: [], editionCode: null, single: false };
    const single = Boolean(scope.outcome);
    const wanted = single ? nav.outcomes.filter((o) => o.id === scope.outcome!.id) : nav.outcomes;
    const period = ctx.request.period;
    const lessonLinks = await db.select({ nodeId: schema.lessonNodeLinks.nodeId, lessonId: schema.lessonNodeLinks.lessonId }).from(schema.lessonNodeLinks);
    const outcomes: OutcomeFacts[] = [];
    for (const o of wanted.slice(0, 8)) {
      const subtree = descendantsOf(o.id, scope.childrenOf);
      const subtreeIds = new Set([o.id, ...subtree.map((n) => n.id)]);
      const items = nav.items.filter((i) => i.outcomeId === o.id);
      const targets = nav.targets.filter((t) => t.outcomeId === o.id).sort((a, b) => a.sort - b.sort);
      const updates = await db
        .select()
        .from(schema.statusUpdates)
        .where(and(inArray(schema.statusUpdates.nodeId, [...subtreeIds].slice(0, 400))))
        .orderBy(desc(schema.statusUpdates.createdAt))
        .limit(40);
      const inPeriodUpdates = updates.filter((u) => dated(u.createdAt, period)).slice(0, 4);
      const stakeholders = await getOutcomeStakeholders(o.id).catch(() => null);
      const lead = leadNames(o.leads);
      outcomes.push({
        id: o.id,
        code: o.code,
        titleEn: o.titleEn,
        titleAr: o.titleAr,
        descriptionEn: o.descriptionEn,
        descriptionAr: o.descriptionAr,
        status: o.status,
        progress: o.progress,
        leadEn: lead.en,
        leadAr: lead.ar,
        ownerDeptEn: stakeholders?.departmentOwner?.nameEn ?? null,
        ownerDeptAr: stakeholders?.departmentOwner?.nameAr ?? null,
        targets: targets.map((t) => ({
          code: t.code,
          titleEn: t.titleEn,
          titleAr: t.titleAr,
          status: t.status,
          kpiEn: t.kpi?.nameEn ?? null,
          kpiAr: t.kpi?.nameAr ?? null,
          latest: t.kpi?.latest ?? null,
          target: t.kpi?.target ?? null,
          unit: t.kpi?.unit ?? null,
          period: t.kpi?.period ?? null,
        })),
        items: {
          total: items.length,
          onTrack: items.filter((i) => i.status === "on_track").length,
          atRisk: items.filter((i) => i.status === "at_risk").length,
          delayed: items.filter((i) => i.status === "delayed").length,
          completed: items.filter((i) => i.status === "completed").length,
          notStarted: items.filter((i) => i.status === "not_started").length,
        },
        updates: inPeriodUpdates.map((u) => {
          const node = scope.byId.get(u.nodeId);
          return {
            nodeEn: `${node?.code ?? ""} ${node?.titleEn ?? ""}`.trim(),
            nodeAr: `${node?.code ?? ""} ${node?.titleAr ?? ""}`.trim(),
            status: u.status,
            progressPct: u.progressPct,
            summaryEn: u.summaryEn,
            summaryAr: u.summaryAr,
            createdAt: u.createdAt.slice(0, 10),
          };
        }),
        lessons: new Set(lessonLinks.filter((l) => subtreeIds.has(l.nodeId)).map((l) => l.lessonId)).size,
      });
    }
    return { outcomes, editionCode: scope.edition?.code ?? null, single };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const paragraphFor = (o: OutcomeFacts) =>
      bi(
        `${o.code ?? ""} ${o.titleEn}${o.descriptionEn ? `: ${o.descriptionEn.split(/(?<=[.!?])\s/)[0]}` : ""} The outcome carries ${fmt(o.targets.length)} targets and ${fmt(o.items.total)} initiatives and projects, of which ${fmt(o.items.onTrack)} are on track, ${fmt(o.items.completed)} completed, ${fmt(o.items.atRisk)} at risk and ${fmt(o.items.delayed)} delayed; ${pct(o.progress)} of its targets are on track. Lead: ${o.leadEn}${o.ownerDeptEn ? `; department owner: ${o.ownerDeptEn}` : ""}. ${o.updates.length ? `${fmt(o.updates.length)} status updates were recorded in ${period.en}.` : `No status update was recorded in ${period.en}.`}`.trim(),
        `${o.code ?? ""} ${o.titleAr}${o.descriptionAr ? `: ${o.descriptionAr.split(/(?<=[.!?؟])\s/)[0]}` : ""} تحمل النتيجة ${fmt(o.targets.length)} مستهدفاً و${fmt(o.items.total)} مبادرة ومشروعاً، منها ${fmt(o.items.onTrack)} على المسار و${fmt(o.items.completed)} مكتملة و${fmt(o.items.atRisk)} معرضة للخطر و${fmt(o.items.delayed)} متأخرة؛ و${pct(o.progress)} من مستهدفاتها على المسار. الجهة المسؤولة: ${o.leadAr}${o.ownerDeptAr ? `؛ والإدارة المالكة: ${o.ownerDeptAr}` : ""}. ${o.updates.length ? `وسُجل ${fmt(o.updates.length)} تحديثات للحالة في ${period.ar}.` : `ولم يُسجل أي تحديث للحالة في ${period.ar}.`}`.trim()
      );
    const mock = (): Prose => ({
      lead: data.outcomes.length === 1
        ? bi(`${data.outcomes[0].code ?? ""} ${data.outcomes[0].titleEn} in ${period.en}.`.trim(), `${data.outcomes[0].code ?? ""} ${data.outcomes[0].titleAr} في ${period.ar}.`.trim())
        : bi(`The national outcomes one by one, ${period.en}.`, `النتائج الوطنية واحدة تلو الأخرى، ${period.ar}.`),
      paragraphs: data.outcomes.length ? data.outcomes.map(paragraphFor) : [bi("No outcome falls inside this scope.", "لا تقع أي نتيجة ضمن هذا النطاق.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "outcome_deep_dive",
      {
        purpose: "One analytical paragraph per outcome, in the order given, each opening with the outcome code and naming its targets, its delivery mix and what the period's status updates said.",
        structure: `Exactly ${data.outcomes.length} paragraphs, one per outcome in order, each starting with the outcome code. A one-sentence lead.`,
        paragraphs: data.outcomes.length,
        lead: true,
      },
      data,
      mock
    );
    const blocks: Block[] = [];
    if (!data.outcomes.length) {
      blocks.push(noteBlock("No outcome falls inside this scope; the deep dive is empty by design.", "لا تقع أي نتيجة ضمن هذا النطاق؛ والقراءة المعمقة فارغة بحكم التصميم."));
    }
    data.outcomes.forEach((o, i) => {
      if (data.outcomes.length > 1) blocks.push({ kind: "heading", level: 2, text: bi(`${o.code ?? ""} ${o.titleEn}`.trim(), `${o.code ?? ""} ${o.titleAr}`.trim()) });
      const para = prose.paragraphs[i] ?? paragraphFor(o);
      blocks.push({ kind: "paragraph", text: para });
      if (o.targets.length) {
        blocks.push({
          kind: "table",
          caption: bi(`Targets of ${o.code ?? o.titleEn}`, `مستهدفات ${o.code ?? o.titleAr}`),
          columns: [T.code, T.target, bi("Headline KPI", "المؤشر الرئيسي"), T.latest, bi("Target value", "قيمة المستهدف"), T.status],
          rows: o.targets.map((t) => [
            bi(t.code ?? "", t.code ?? ""),
            bi(t.titleEn, t.titleAr),
            bi(t.kpiEn ?? "", t.kpiAr ?? t.kpiEn ?? ""),
            bi(t.latest != null ? `${fmtAuto(t.latest)}${t.unit ? ` ${t.unit}` : ""}` : "n/a", t.latest != null ? `${fmtAuto(t.latest)}${t.unit ? ` ${t.unit}` : ""}` : "غير متاح"),
            bi(t.target != null ? fmtAuto(t.target) : "n/a", t.target != null ? fmtAuto(t.target) : "غير متاح"),
            statusText(t.status),
          ]),
          align: ["start", "start", "start", "end", "end", "start"],
        });
      }
      if (o.updates.length) {
        blocks.push({
          kind: "bullets",
          items: o.updates.map((u) =>
            bi(
              `${u.createdAt}, ${u.nodeEn} (${statusText(u.status).en}, ${fmt(u.progressPct)}%): ${u.summaryEn ?? ""}`.trim(),
              `${u.createdAt}، ${u.nodeAr} (${statusText(u.status).ar}، ${fmt(u.progressPct)}%): ${u.summaryAr ?? u.summaryEn ?? ""}`.trim()
            )
          ),
        });
      }
    });
    if (prose.bullets?.length) blocks.push({ kind: "bullets", items: prose.bullets });
    if (prose.callout) blocks.push({ kind: "callout", title: prose.callout.title, text: prose.callout.text, tone: "navy" });
    const first = data.outcomes[0];
    return section(
      "outcome_deep_dive",
      data.single && first ? bi(`${first.code ?? ""} ${first.titleEn}`.trim(), `${first.code ?? ""} ${first.titleAr}`.trim()) : bi("Outcome deep dive", "قراءة معمقة في النتائج"),
      "opener",
      {
        lead: prose.lead,
        keyFigure: first && data.single ? { value: pct(first.progress), label: bi("targets on track", "مستهدفات على المسار") } : undefined,
        blocks,
        sources: makeSources([...(data.editionCode ? [SRC.strategy(data.editionCode)] : []), SRC.lessons()]),
        meta: { live, outcomes: data.outcomes.length, proseFromModel: prose.paragraphs.length },
      }
    );
  },
};

export default def;
