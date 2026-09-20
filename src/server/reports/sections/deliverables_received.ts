// CR08 5.3: deliverables received. The deliverable documents of the nodes in
// scope delivered during the period, with their acceptance status; every
// row honours the requester's clearance (listDeliverables is per node, so a
// scope-wide read joins deliverable_meta to documents here).
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { bi, type Block, type SectionDefinition } from "../spec";
import { dated, fmt, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Row = { code: string; titleEn: string; titleAr: string; nodeEn: string; nodeAr: string; delivered: string | null; acceptance: string; docStatus: string; ownerEn: string | null; ownerAr: string | null; milestone: string | null };
type DeliverablesData = { rows: Row[]; totalAllTime: number; byAcceptance: Record<string, number>; editionCode: string | null };

const def: SectionDefinition<DeliverablesData> = {
  code: "deliverables_received",
  name: bi("Deliverables received", "المخرجات المستلمة"),
  description: bi(
    "The deliverables received in the period for the initiatives and projects in scope, with acceptance status and owners.",
    "المخرجات المستلمة في الفترة للمبادرات والمشاريع ضمن النطاق، مع حالة القبول والمالكين."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: "all",
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const ids = [...scope.scopeNodeIds];
    if (!ids.length) return { rows: [], totalAllTime: 0, byAcceptance: {}, editionCode: scope.edition?.code ?? null };
    const metas = await db.select().from(schema.deliverableMeta).where(inArray(schema.deliverableMeta.nodeId, ids.slice(0, 500)));
    if (!metas.length) return { rows: [], totalAllTime: 0, byAcceptance: {}, editionCode: scope.edition?.code ?? null };
    const docs = await db.select().from(schema.documents).where(inArray(schema.documents.id, metas.map((m) => m.documentId)));
    const docById = new Map(docs.map((d) => [d.id, d]));
    const ownerIds = [...new Set(docs.map((d) => d.ownerUserId).filter(Boolean))] as string[];
    const owners = ownerIds.length ? await db.select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr }).from(schema.users).where(inArray(schema.users.id, ownerIds)) : [];
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const visible = metas
      .map((m) => ({ m, doc: docById.get(m.documentId) }))
      .filter(({ doc }) => doc && !doc.deletedAt && doc.classificationLevel <= ctx.user.clearanceLevel);
    const inPeriod = visible.filter(({ m, doc }) => dated(m.deliveredDate ?? doc!.createdAt, ctx.request.period));
    const rows: Row[] = inPeriod
      .sort((a, b) => (b.m.deliveredDate ?? "").localeCompare(a.m.deliveredDate ?? ""))
      .slice(0, 40)
      .map(({ m, doc }) => {
        const node = scope.byId.get(m.nodeId);
        const owner = doc!.ownerUserId ? ownerById.get(doc!.ownerUserId) : null;
        return {
          code: m.deliverableCode,
          titleEn: doc!.titleEn,
          titleAr: doc!.titleAr || doc!.titleEn,
          nodeEn: `${node?.code ?? ""} ${node?.titleEn ?? ""}`.trim(),
          nodeAr: `${node?.code ?? ""} ${node?.titleAr ?? ""}`.trim(),
          delivered: m.deliveredDate,
          acceptance: m.acceptanceStatus,
          docStatus: doc!.status,
          ownerEn: owner?.nameEn ?? null,
          ownerAr: owner?.nameAr ?? null,
          milestone: m.milestone,
        };
      });
    const byAcceptance: Record<string, number> = {};
    for (const r of inPeriod) byAcceptance[r.m.acceptanceStatus] = (byAcceptance[r.m.acceptanceStatus] ?? 0) + 1;
    return { rows, totalAllTime: visible.length, byAcceptance, editionCode: scope.edition?.code ?? null };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const total = Object.values(data.byAcceptance).reduce((s, n) => s + n, 0);
    const accepted = data.byAcceptance.accepted ?? 0;
    const pending = data.byAcceptance.pending ?? 0;
    const mock = (): Prose => ({
      paragraphs: total
        ? [
            bi(
              `${fmt(total)} deliverables were received in ${period.en} across the initiatives and projects in scope (${fmt(data.totalAllTime)} held in total): ${fmt(accepted)} accepted, ${fmt(pending)} pending acceptance${data.byAcceptance.rejected ? `, ${fmt(data.byAcceptance.rejected)} rejected` : ""}. Each is a document in Institutional Memory under its initiative or project, subject to the usual verification.`,
              `استُلم ${fmt(total)} مخرجاً في ${period.ar} عبر المبادرات والمشاريع ضمن النطاق (من أصل ${fmt(data.totalAllTime)} محفوظاً إجمالاً): ${fmt(accepted)} مقبولة، و${fmt(pending)} بانتظار القبول${data.byAcceptance.rejected ? `، و${fmt(data.byAcceptance.rejected)} مرفوضة` : ""}. وكل منها وثيقة في مكتبة المعرفة تحت مبادرتها أو مشروعها، وتخضع للتوثيق المعتاد.`
            ),
          ]
        : [
            bi(
              `No deliverable was received in ${period.en} for the initiatives and projects in scope${data.totalAllTime ? `; ${fmt(data.totalAllTime)} earlier deliverables remain on record` : ""}.`,
              `لم يُستلم أي مخرج في ${period.ar} للمبادرات والمشاريع ضمن النطاق${data.totalAllTime ? `؛ ويبقى ${fmt(data.totalAllTime)} مخرجاً سابقاً مسجلاً` : ""}.`
            ),
          ],
    });
    const { prose, live } = await writeProse(
      ctx,
      "deliverables_received",
      {
        purpose: "Account for the deliverables received in the period and their acceptance state.",
        structure: "One paragraph with the counts; a second only if a deliverable is pending or rejected, naming it by code.",
        paragraphs: 2,
      },
      { total, byAcceptance: data.byAcceptance, totalAllTime: data.totalAllTime, rows: data.rows.slice(0, 30) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!data.rows.length) {
      blocks.push(noteBlock("No deliverables in the period.", "لا مخرجات في الفترة."));
    } else {
      blocks.push({
        kind: "table",
        caption: bi(`Deliverables received in ${period.en}`, `المخرجات المستلمة في ${period.ar}`),
        columns: [T.code, T.title, bi("Initiative or project", "المبادرة أو المشروع"), T.delivered, T.acceptance, T.owner],
        rows: data.rows.map((r) => [
          bi(r.code, r.code),
          bi(r.titleEn, r.titleAr),
          bi(r.nodeEn, r.nodeAr),
          bi(r.delivered ?? "", r.delivered ?? ""),
          statusText(r.acceptance),
          bi(r.ownerEn ?? "", r.ownerAr ?? r.ownerEn ?? ""),
        ]),
        align: ["start", "start", "start", "end", "start", "start"],
      });
    }
    return section("deliverables_received", bi("Deliverables received", "المخرجات المستلمة"), "body", {
      lead: bi(`${fmt(total)} deliverables in ${period.en}, ${fmt(accepted)} accepted.`, `${fmt(total)} مخرجاً في ${period.ar}، منها ${fmt(accepted)} مقبولة.`),
      blocks,
      sources: makeSources([SRC.vault(), ...(data.editionCode ? [SRC.strategy(data.editionCode)] : [])]),
      meta: { live, total, byAcceptance: data.byAcceptance },
    });
  },
};

export default def;
