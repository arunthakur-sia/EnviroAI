// CR08 5.3: initiatives and projects progress. The status mix of the
// delivery items in scope, the items themselves with their leads and end
// dates, and the status updates recorded during the period.
import { and, desc, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { bi, type Block, type SectionDefinition } from "../spec";
import { dated, fmt, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, nodeTypeText, type Prose } from "./_shared";
import { leadNames, navigator, resolveScope } from "./_scope";

type Item = { code: string | null; titleEn: string; titleAr: string; type: string; status: string; leadEn: string; leadAr: string; endDate: string | null; deliverables: number; outcomeCode: string | null };
type Update = { nodeEn: string; nodeAr: string; status: string; progressPct: number; summaryEn: string | null; summaryAr: string | null; createdAt: string };
type ProgressData = {
  items: Item[];
  counts: Record<string, number>;
  updates: Update[];
  updatesTotal: number;
  editionCode: string | null;
};

const STATUS_ORDER = ["on_track", "completed", "at_risk", "delayed", "in_progress", "not_started", "paused", "cancelled"];

const def: SectionDefinition<ProgressData> = {
  code: "initiatives_progress",
  name: bi("Initiatives and projects progress", "تقدم المبادرات والمشاريع"),
  description: bi(
    "The status mix of the initiatives and projects in scope, the items with their leads and end dates, and the period's status updates.",
    "مزيج حالات المبادرات والمشاريع ضمن النطاق، والعناصر مع جهاتها المسؤولة وتواريخ انتهائها، وتحديثات الحالة في الفترة."
  ),
  layout: "body",
  estimatedPages: 3,
  appliesTo: "all",
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    if (!nav) return { items: [], counts: {}, updates: [], updatesTotal: 0, editionCode: null };
    const outcomeCode = new Map(nav.outcomes.map((o) => [o.id, o.code]));
    const navItems = nav.items.filter((i) => scope.scopeNodeIds.has(i.id));
    const items: Item[] = navItems.map((i) => {
      const lead = leadNames(i.leads);
      return { code: i.code, titleEn: i.titleEn, titleAr: i.titleAr, type: i.type, status: i.status, leadEn: lead.en, leadAr: lead.ar, endDate: i.endDate, deliverables: i.deliverableCount, outcomeCode: outcomeCode.get(i.outcomeId) ?? null };
    });
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.status] = (counts[i.status] ?? 0) + 1;
    const ids = navItems.map((i) => i.id);
    const rows = ids.length
      ? await db.select().from(schema.statusUpdates).where(and(inArray(schema.statusUpdates.nodeId, ids.slice(0, 500)))).orderBy(desc(schema.statusUpdates.createdAt)).limit(200)
      : [];
    const inPeriod = rows.filter((u) => dated(u.createdAt, ctx.request.period));
    const updates: Update[] = inPeriod.slice(0, 6).map((u) => {
      const node = scope.byId.get(u.nodeId);
      return { nodeEn: `${node?.code ?? ""} ${node?.titleEn ?? ""}`.trim(), nodeAr: `${node?.code ?? ""} ${node?.titleAr ?? ""}`.trim(), status: u.status, progressPct: u.progressPct, summaryEn: u.summaryEn, summaryAr: u.summaryAr, createdAt: u.createdAt.slice(0, 10) };
    });
    return { items, counts, updates, updatesTotal: inPeriod.length, editionCode: scope.edition?.code ?? null };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const n = (s: string) => data.counts[s] ?? 0;
    const initiatives = data.items.filter((i) => i.type === "initiative").length;
    const projects = data.items.filter((i) => i.type === "project").length;
    const attention = data.items.filter((i) => i.status === "at_risk" || i.status === "delayed").slice(0, 3);
    const mock = (): Prose => ({
      paragraphs: data.items.length
        ? [
            bi(
              `The scope holds ${fmt(initiatives)} initiatives and ${fmt(projects)} projects: ${fmt(n("on_track"))} on track, ${fmt(n("completed"))} completed, ${fmt(n("at_risk"))} at risk, ${fmt(n("delayed"))} delayed and ${fmt(n("not_started"))} not started. ${fmt(data.updatesTotal)} status updates were recorded in ${period.en}.`,
              `يضم النطاق ${fmt(initiatives)} مبادرة و${fmt(projects)} مشروعاً: ${fmt(n("on_track"))} على المسار، و${fmt(n("completed"))} مكتملة، و${fmt(n("at_risk"))} معرضة للخطر، و${fmt(n("delayed"))} متأخرة، و${fmt(n("not_started"))} لم تبدأ. وسُجل ${fmt(data.updatesTotal)} تحديثاً للحالة في ${period.ar}.`
            ),
            ...(attention.length
              ? [
                  bi(
                    `Delivery attention sits with ${attention.map((i) => `${i.code ?? i.titleEn} (${statusText(i.status).en}, lead ${i.leadEn})`).join("; ")}.`,
                    `ويتركز الاهتمام التنفيذي على ${attention.map((i) => `${i.code ?? i.titleAr} (${statusText(i.status).ar}، الجهة المسؤولة ${i.leadAr})`).join("؛ ")}.`
                  ),
                ]
              : []),
          ]
        : [bi("No initiative or project falls inside this scope.", "لا تقع أي مبادرة أو مشروع ضمن هذا النطاق.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "initiatives_progress",
      {
        purpose: "Say where delivery stands across the initiatives and projects in scope and which items need attention.",
        structure: "Two paragraphs: the status mix in numbers; the items at risk or delayed by code with their leads. Then, if updates exist, no bullets (the updates are listed separately).",
        paragraphs: 2,
      },
      { counts: data.counts, initiatives, projects, updatesTotal: data.updatesTotal, items: data.items.slice(0, 40), updates: data.updates },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.items.length) {
      blocks.push(noteBlock("No delivery items are linked to this scope in the Living Strategy.", "لا توجد عناصر تنفيذية مرتبطة بهذا النطاق في الاستراتيجية الحية."));
    } else {
      const present = STATUS_ORDER.filter((s) => data.counts[s]);
      blocks.push({
        kind: "chart",
        chart: {
          type: "bar",
          title: bi("Initiatives and projects by status", "المبادرات والمشاريع بحسب الحالة"),
          series: [{ name: bi("Items", "العناصر"), role: "primary", points: present.map((s) => ({ x: statusText(s).en, y: data.counts[s] })) }],
          source: bi("EnviroAI Living Strategy", "الاستراتيجية الحية في EnviroAI"),
        },
      });
      blocks.push({
        kind: "table",
        caption: bi("Initiatives and projects in scope", "المبادرات والمشاريع ضمن النطاق"),
        columns: [T.code, T.title, T.type, T.status, T.lead, bi("End date", "تاريخ الانتهاء"), T.deliverables],
        rows: data.items.slice(0, 40).map((i) => [
          bi(i.code ?? "", i.code ?? ""),
          bi(i.titleEn, i.titleAr),
          nodeTypeText(i.type),
          statusText(i.status),
          bi(i.leadEn, i.leadAr),
          bi(i.endDate ?? "", i.endDate ?? ""),
          bi(fmt(i.deliverables), fmt(i.deliverables)),
        ]),
        align: ["start", "start", "start", "start", "start", "end", "end"],
      });
      if (data.updates.length) {
        blocks.push({ kind: "heading", level: 3, text: bi(`Status updates recorded in ${period.en}`, `تحديثات الحالة المسجلة في ${period.ar}`) });
        blocks.push({
          kind: "bullets",
          items: data.updates.map((u) =>
            bi(
              `${u.createdAt}, ${u.nodeEn} (${statusText(u.status).en}, ${fmt(u.progressPct)}%): ${u.summaryEn ?? ""}`.trim(),
              `${u.createdAt}، ${u.nodeAr} (${statusText(u.status).ar}، ${fmt(u.progressPct)}%): ${u.summaryAr ?? u.summaryEn ?? ""}`.trim()
            )
          ),
        });
      }
    }
    return section("initiatives_progress", bi("Initiatives and projects progress", "تقدم المبادرات والمشاريع"), "body", {
      lead: bi(`${fmt(data.items.length)} delivery items, ${fmt(n("on_track") + n("completed"))} on track or completed.`, `${fmt(data.items.length)} عنصراً تنفيذياً، منها ${fmt(n("on_track") + n("completed"))} على المسار أو مكتملة.`),
      blocks,
      sources: makeSources(data.editionCode ? [SRC.strategy(data.editionCode)] : []),
      meta: { live, items: data.items.length, updates: data.updatesTotal, counts: data.counts },
    });
  },
};

export default def;
