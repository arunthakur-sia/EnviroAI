// CR08 5.3: the at-a-glance page. Eight KPI tiles counted for the period and
// the scope (targets on track, initiatives, projects, status updates,
// deliverables, lessons, signals, indices improving), a bar of status
// updates per month, and a short narrative.
import { and, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { listSignals } from "@/server/services/signals";
import { getIndicesBoard } from "@/server/services/indices";
import { getLearningRoomData } from "@/server/services/lessons";
import { bi, type Block, type KpiTile, type SectionDefinition } from "../spec";
import {
  daysSincePeriodStart,
  dated,
  fmt,
  inPeriod,
  internationalCards,
  memo,
  periodLabel,
  periodWord,
  proseBlocks,
  section,
  SRC,
  makeSources,
  summaryOf,
  writeProse,
  type Prose,
} from "./_shared";
import { navigator, resolveScope } from "./_scope";

type GlanceData = {
  isOrg: boolean;
  scopeLabel: { en: string; ar: string };
  targetsOnTrack: number;
  targetsTotal: number;
  initiatives: number;
  projects: number;
  completed: number;
  atRisk: number;
  updates: number;
  deliverables: number;
  lessons: number;
  signals: number;
  indices: { improving: number; declining: number; tracked: number } | null;
  months: { month: string; updates: number }[];
  editionCode: string | null;
};

const def: SectionDefinition<GlanceData> = {
  code: "year_at_a_glance",
  name: bi("At a glance", "في لمحة"),
  description: bi(
    "Infographic tiles for the period: targets on track, initiatives and projects, updates, deliverables, lessons, signals and indices.",
    "بلاطات إنفوغرافية للفترة: المستهدفات على المسار، والمبادرات والمشاريع، والتحديثات، والمخرجات، والدروس، والإشارات، والمؤشرات."
  ),
  layout: "glance",
  estimatedPages: 2,
  appliesTo: "all",
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    const period = ctx.request.period;
    const isOrg = scope.kind === "org" || scope.kind === "period";
    const targets = (nav?.targets ?? []).filter((t) => scope.scopeNodeIds.has(t.id));
    const items = (nav?.items ?? []).filter((i) => scope.scopeNodeIds.has(i.id));
    const ids = [...scope.scopeNodeIds];
    const updates = ids.length
      ? await db
          .select({ createdAt: schema.statusUpdates.createdAt })
          .from(schema.statusUpdates)
          .where(inArray(schema.statusUpdates.nodeId, ids.slice(0, 500)))
      : [];
    const deliverables = ids.length
      ? await db
          .select({ deliveredDate: schema.deliverableMeta.deliveredDate, createdAt: schema.deliverableMeta.createdAt })
          .from(schema.deliverableMeta)
          .where(and(inArray(schema.deliverableMeta.nodeId, ids.slice(0, 500))))
      : [];
    const room = await memo(ctx, "learning-room", () => getLearningRoomData(ctx.user).catch(() => null));
    const lessons = (room?.lessons ?? []).filter(
      (l) => inPeriod(l.createdAt, period) && (isOrg || l.links.some((k) => scope.scopeNodeIds.has(k.nodeId)))
    );
    const signals = await listSignals(ctx.user, {
      triage: "accepted",
      days: daysSincePeriodStart(period),
      limit: 200,
      nodeId: !isOrg && (scope.outcome ?? scope.project) ? (scope.outcome ?? scope.project)!.id : undefined,
    }).catch(() => []);
    const board = isOrg
      ? await memo(ctx, "indices-board", () => getIndicesBoard(ctx.user).catch(() => null))
      : null;
    const months = (nav?.glance.months ?? []).map((m, i) => ({ month: m, updates: nav?.glance.updatesPerMonth[i] ?? 0 }));
    return {
      isOrg,
      scopeLabel: scope.label,
      targetsOnTrack: targets.filter((t) => t.status === "on_track" || t.status === "completed").length,
      targetsTotal: targets.length,
      initiatives: items.filter((i) => i.type === "initiative").length,
      projects: items.filter((i) => i.type === "project").length,
      completed: items.filter((i) => i.status === "completed").length,
      atRisk: items.filter((i) => i.status === "at_risk" || i.status === "delayed").length,
      updates: updates.filter((u) => dated(u.createdAt, period)).length,
      deliverables: deliverables.filter((d) => dated(d.deliveredDate ?? d.createdAt, period)).length,
      lessons: lessons.length,
      signals: signals.filter((s) => dated(s.publishedAt ?? s.createdAt, period)).length,
      indices: board
        ? { improving: summaryOf(internationalCards(board.cards)).improving, declining: summaryOf(internationalCards(board.cards)).declining, tracked: internationalCards(board.cards).length }
        : null,
      months: months.filter((m) => inPeriod(`${m.month}-15`, period)),
      editionCode: scope.edition?.code ?? null,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const word = periodWord(ctx.request.period);
    const tiles: KpiTile[] = [
      { label: bi("Targets on track", "مستهدفات على المسار"), value: `${data.targetsOnTrack}/${data.targetsTotal}`, tone: "navy" },
      { label: bi("Initiatives", "المبادرات"), value: fmt(data.initiatives), tone: "ink" },
      { label: bi("Projects", "المشاريع"), value: fmt(data.projects), delta: data.completed ? `${fmt(data.completed)} completed` : undefined, tone: "ink" },
      { label: bi("Status updates", "تحديثات الحالة"), value: fmt(data.updates), tone: "teal" },
      { label: bi("Deliverables received", "مخرجات مستلمة"), value: fmt(data.deliverables), tone: "teal" },
      { label: bi("Lessons documented", "دروس موثقة"), value: fmt(data.lessons), tone: "aqua" },
      { label: bi("Signals accepted", "إشارات مقبولة"), value: fmt(data.signals), tone: "aqua" },
    ];
    if (data.indices) {
      tiles.push({
        label: bi("Indices improving", "مؤشرات في تحسن"),
        value: `${data.indices.improving}/${data.indices.tracked}`,
        delta: data.indices.declining ? `${fmt(data.indices.declining)} declining` : undefined,
        tone: "navy",
      });
    } else {
      tiles.push({ label: bi("At risk or delayed", "معرض للخطر أو متأخر"), value: fmt(data.atRisk), tone: "navy" });
    }
    const mock = (): Prose => ({
      paragraphs: [
        bi(
          `${data.isOrg ? "The Office" : data.scopeLabel.en} closed ${period.en} with ${fmt(data.targetsOnTrack)} of ${fmt(data.targetsTotal)} tracked targets on track, ${fmt(data.initiatives)} initiatives and ${fmt(data.projects)} projects in delivery, of which ${fmt(data.completed)} are completed and ${fmt(data.atRisk)} are at risk or delayed.`,
          `أنهى ${data.isOrg ? "المكتب" : data.scopeLabel.ar} ${period.ar} وقد كان ${fmt(data.targetsOnTrack)} من أصل ${fmt(data.targetsTotal)} مستهدفاً متابعاً على المسار، مع ${fmt(data.initiatives)} مبادرة و${fmt(data.projects)} مشروعاً قيد التنفيذ، اكتمل منها ${fmt(data.completed)} وتعرض ${fmt(data.atRisk)} للخطر أو التأخر.`
        ),
        bi(
          `During ${word.en} the teams recorded ${fmt(data.updates)} status updates and received ${fmt(data.deliverables)} deliverables; ${fmt(data.lessons)} lessons were documented and ${fmt(data.signals)} external signals were accepted onto the radar${data.indices ? `, while Saudi Arabia improved in ${fmt(data.indices.improving)} of the ${fmt(data.indices.tracked)} international indices tracked` : ""}.`,
          `وخلال ${word.ar} سجلت الفرق ${fmt(data.updates)} تحديثاً للحالة واستلمت ${fmt(data.deliverables)} مخرجاً؛ ووُثق ${fmt(data.lessons)} درساً وقُبلت ${fmt(data.signals)} إشارة خارجية على الرادار${data.indices ? `، بينما تحسنت السعودية في ${fmt(data.indices.improving)} من المؤشرات الدولية الـ${fmt(data.indices.tracked)} المتابعة` : ""}.`
        ),
      ],
    });
    const { prose, live } = await writeProse(
      ctx,
      "year_at_a_glance",
      {
        purpose: "The narrative under the infographic tiles: what the numbers of the period add up to.",
        structure: "Two short paragraphs. The first on delivery (targets, initiatives, projects), the second on the knowledge activity (updates, deliverables, lessons, signals, indices). Cite each figure once.",
        paragraphs: 2,
      },
      data,
      mock
    );
    const blocks: Block[] = [{ kind: "kpis", items: tiles }, ...proseBlocks(prose)];
    if (data.months.length >= 2) {
      blocks.push({
        kind: "chart",
        chart: {
          type: "bar",
          title: bi("Status updates per month", "تحديثات الحالة شهرياً"),
          series: [
            {
              name: bi("Updates", "التحديثات"),
              role: "primary",
              points: data.months.map((m) => ({ x: m.month, y: m.updates })),
            },
          ],
          source: bi("EnviroAI Living Strategy", "الاستراتيجية الحية في EnviroAI"),
        },
      });
    }
    return section("year_at_a_glance", bi(`${word.en[0].toUpperCase()}${word.en.slice(1)} at a glance`, `${word.ar} في لمحة`), "glance", {
      lead: bi(`${period.en} in eight numbers.`, `${period.ar} في ثمانية أرقام.`),
      blocks,
      sources: makeSources([
        ...(data.editionCode ? [SRC.strategy(data.editionCode)] : []),
        SRC.vault(),
        SRC.lessons(),
        SRC.signals(),
        ...(data.indices ? [{ title: "EnviroAI Indices board", detail: "Saudi Arabia's latest movements" }] : []),
      ]),
      meta: { live, tiles: tiles.length },
    });
  },
};

export default def;
