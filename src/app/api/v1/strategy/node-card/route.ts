import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getNodeDetail } from "@/server/services/strategy";
import { listDeliverables } from "@/server/services/deliverables";
import { toShelfDocs } from "@/server/services/documents";
import { listSignals } from "@/server/services/signals";

/* CR04 2.4: the slide-over drawer payload for an initiative or project (and
   any node). Everything the drawer renders, one JSON round trip, prefetchable
   for siblings. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const detail = await getNodeDetail(user, id);
  if (!detail) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const {
    node,
    leads,
    stakeholders,
    kpis,
    kpiValues,
    updates,
    linkedExperts,
    lessons,
    lineage,
    lineageNodes,
    editions,
  } = detail;

  const isDeliveryNode = node.nodeType === "initiative" || node.nodeType === "project";
  const deliverables = isDeliveryNode ? await listDeliverables(user, id) : [];
  const deliverableDocs = deliverables.length
    ? await db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, deliverables.map((d) => d.documentId)))
    : [];
  const deliverableShelf = await toShelfDocs(deliverableDocs);
  const signals = await listSignals(user, { nodeId: id, days: 365, limit: 5 });
  const editionById = new Map(editions.map((e) => [e.id, e]));

  return NextResponse.json({
    data: {
      node: {
        id: node.id,
        code: node.code,
        nodeType: node.nodeType,
        titleEn: node.titleEn,
        titleAr: node.titleAr,
        descriptionEn: node.descriptionEn,
        descriptionAr: node.descriptionAr,
        status: node.status,
        budgetQar: node.budgetQar,
        startDate: node.startDate,
        endDate: node.endDate,
      },
      /* CR05 2.2: lead chips in the header, supporting under them */
      leads,
      /* CR05 3.2: the stakeholder section at the end of the drawer */
      stakeholders,
      kpis: kpis.map((k) => ({
        id: k.id,
        nameEn: k.nameEn,
        nameAr: k.nameAr,
        unit: k.unit,
        direction: k.direction,
        baselineValue: k.baselineValue,
        baselineYear: k.baselineYear,
        targetValue: k.targetValue,
        targetYear: k.targetYear,
        indicatorId: k.indicatorId,
      })),
      kpiValues: kpiValues.map((v) => ({
        kpiId: v.kpiId,
        period: v.period,
        actual: v.actualValue,
        target: v.targetForPeriod,
        note: v.note,
      })),
      deliverables: deliverables.map((d) => ({
        id: d.id,
        documentId: d.documentId,
        deliverableCode: d.deliverableCode,
        milestone: d.milestone,
        dueDate: d.dueDate,
        deliveredDate: d.deliveredDate,
        acceptanceStatus: d.acceptanceStatus,
        titleEn: d.titleEn,
        titleAr: d.titleAr,
        status: d.status,
      })),
      deliverableShelf,
      lessons: lessons.slice(0, 6).map((l) => ({
        id: l.id,
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        learningEn: l.learningEn,
        learningAr: l.learningAr,
        category: l.category,
        status: l.status,
        reuseCount: l.reuseCount,
      })),
      experts: linkedExperts.slice(0, 5).map((e) => ({
        id: e.id,
        nameEn: e.nameEn,
        nameAr: e.nameAr,
        positionEn: e.positionEn,
        positionAr: e.positionAr,
        avatarColor: e.avatarColor,
      })),
      signals: signals.map((s) => ({
        id: s.id,
        titleEn: s.titleEn,
        titleAr: s.titleAr,
        publisher: s.publisher,
        publishedAt: s.publishedAt,
        impact: s.impact,
        horizon: s.horizon,
        triageStatus: s.triageStatus,
      })),
      updates: updates.slice(0, 6).map((u) => ({
        id: u.id,
        status: u.status,
        progressPct: u.progressPct,
        summaryEn: u.summaryEn,
        summaryAr: u.summaryAr,
        period: u.period,
        createdAt: u.createdAt,
        authorNameEn: u.authorNameEn,
        authorNameAr: u.authorNameAr,
      })),
      lineage: lineage
        .map((l) => {
          const otherId = l.fromNodeId === id ? l.toNodeId : l.fromNodeId;
          const other = lineageNodes.find((n) => n.id === otherId);
          if (!other) return null;
          return {
            id: l.id,
            relation: l.relation,
            forward: l.fromNodeId === id,
            nodeId: otherId,
            titleEn: other.titleEn,
            titleAr: other.titleAr,
            editionCode: editionById.get(other.editionId)?.code?.toUpperCase() ?? "",
          };
        })
        .filter(Boolean),
    },
    error: null,
  });
}
