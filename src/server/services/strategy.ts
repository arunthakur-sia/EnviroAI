import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";

export async function getEditions() {
  return db
    .select()
    .from(schema.strategyEditions)
    .orderBy(desc(schema.strategyEditions.periodFrom));
}

export async function getEditionByCode(code: string) {
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, code))
    .limit(1);
  return edition ?? null;
}

export type NodeLite = typeof schema.strategyNodes.$inferSelect;

export async function getEditionNodes(editionId: string): Promise<NodeLite[]> {
  return db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.editionId, editionId))
    .orderBy(asc(schema.strategyNodes.sort));
}

export type OutcomeTile = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  progress: number; // 0..1 share of descendants on track
  initiativeCount: number;
  projectCount: number;
  headlineKpi: {
    nameEn: string;
    nameAr: string;
    unit: string | null;
    latest: number | null;
    target: number | null;
  } | null;
};

export async function getOverview(editionId: string): Promise<OutcomeTile[]> {
  const nodes = await getEditionNodes(editionId);
  const topLevel = nodes.filter(
    (n) => !n.parentId && (n.nodeType === "outcome" || n.nodeType === "sector_strategy")
  );
  const childrenOf = new Map<string, NodeLite[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
  }
  const descendants = (id: string): NodeLite[] => {
    const direct = childrenOf.get(id) ?? [];
    return [...direct, ...direct.flatMap((d) => descendants(d.id))];
  };
  const allKpis = await db.select().from(schema.kpis);
  const kpiByNode = new Map<string, (typeof allKpis)[number][]>();
  for (const k of allKpis) {
    (kpiByNode.get(k.nodeId) ?? kpiByNode.set(k.nodeId, []).get(k.nodeId)!).push(k);
  }

  const tiles: OutcomeTile[] = [];
  for (const outcome of topLevel) {
    const subtree = descendants(outcome.id);
    const active = subtree.filter((d) => d.nodeType === "initiative" || d.nodeType === "project");
    const good = active.filter((d) => d.status === "on_track" || d.status === "completed");
    const kpi = kpiByNode.get(outcome.id)?.[0] ?? null;
    let headlineKpi: OutcomeTile["headlineKpi"] = null;
    if (kpi) {
      const [latest] = await db
        .select()
        .from(schema.kpiValues)
        .where(eq(schema.kpiValues.kpiId, kpi.id))
        .orderBy(desc(schema.kpiValues.period))
        .limit(1);
      headlineKpi = {
        nameEn: kpi.nameEn,
        nameAr: kpi.nameAr,
        unit: kpi.unit,
        latest: latest?.actualValue ?? null,
        target: kpi.targetValue,
      };
    }
    tiles.push({
      id: outcome.id,
      code: outcome.code,
      titleEn: outcome.titleEn,
      titleAr: outcome.titleAr,
      status: outcome.status,
      progress: active.length ? good.length / active.length : 0,
      initiativeCount: subtree.filter((d) => d.nodeType === "initiative").length,
      projectCount: subtree.filter((d) => d.nodeType === "project").length,
      headlineKpi,
    });
  }
  return tiles;
}

export async function getNodeDetail(user: CurrentUser, nodeId: string) {
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (!node) return null;
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.id, node.editionId))
    .limit(1);
  const children = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.parentId, nodeId))
    .orderBy(asc(schema.strategyNodes.sort));
  const parent = node.parentId
    ? (
        await db
          .select()
          .from(schema.strategyNodes)
          .where(eq(schema.strategyNodes.id, node.parentId))
          .limit(1)
      )[0] ?? null
    : null;
  const kpis = await db.select().from(schema.kpis).where(eq(schema.kpis.nodeId, nodeId));
  const kpiValues = kpis.length
    ? await db
        .select()
        .from(schema.kpiValues)
        .where(inArray(schema.kpiValues.kpiId, kpis.map((k) => k.id)))
        .orderBy(asc(schema.kpiValues.period))
    : [];
  const updates = await db
    .select({
      id: schema.statusUpdates.id,
      status: schema.statusUpdates.status,
      progressPct: schema.statusUpdates.progressPct,
      summaryEn: schema.statusUpdates.summaryEn,
      summaryAr: schema.statusUpdates.summaryAr,
      risksJson: schema.statusUpdates.risksJson,
      nextStepsJson: schema.statusUpdates.nextStepsJson,
      evidenceDocumentIdsJson: schema.statusUpdates.evidenceDocumentIdsJson,
      period: schema.statusUpdates.period,
      createdAt: schema.statusUpdates.createdAt,
      authorNameEn: schema.users.nameEn,
      authorNameAr: schema.users.nameAr,
      authorColor: schema.users.avatarColor,
    })
    .from(schema.statusUpdates)
    .innerJoin(schema.users, eq(schema.users.id, schema.statusUpdates.authorId))
    .where(eq(schema.statusUpdates.nodeId, nodeId))
    .orderBy(desc(schema.statusUpdates.createdAt))
    .limit(20);

  // linked resources via relations
  const rels = await db
    .select()
    .from(schema.relations)
    .where(
      or(
        and(eq(schema.relations.fromType, "node"), eq(schema.relations.fromId, nodeId)),
        and(eq(schema.relations.toType, "node"), eq(schema.relations.toId, nodeId))
      )
    );
  const linkedDocIds = rels
    .map((r) => (r.fromType === "document" ? r.fromId : r.toType === "document" ? r.toId : null))
    .filter(Boolean) as string[];
  const linkedExpertIds = rels
    .map((r) => (r.fromType === "expert" ? r.fromId : r.toType === "expert" ? r.toId : null))
    .filter(Boolean) as string[];

  const linkedDocs = linkedDocIds.length
    ? await db.select().from(schema.documents).where(inArray(schema.documents.id, linkedDocIds))
    : [];
  const linkedExperts = linkedExpertIds.length
    ? await db.select().from(schema.experts).where(inArray(schema.experts.id, linkedExpertIds))
    : [];
  const lessons = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.nodeId, nodeId))
    .limit(6);

  const deps = await db
    .select()
    .from(schema.nodeDependencies)
    .where(
      or(eq(schema.nodeDependencies.nodeId, nodeId), eq(schema.nodeDependencies.dependsOnNodeId, nodeId))
    );
  const depNodeIds = [
    ...new Set(deps.flatMap((d) => [d.nodeId, d.dependsOnNodeId]).filter((id) => id !== nodeId)),
  ];
  const depNodes = depNodeIds.length
    ? await db.select().from(schema.strategyNodes).where(inArray(schema.strategyNodes.id, depNodeIds))
    : [];

  // lineage across editions
  const lineage = await db
    .select()
    .from(schema.nodeLineage)
    .where(or(eq(schema.nodeLineage.fromNodeId, nodeId), eq(schema.nodeLineage.toNodeId, nodeId)));
  const lineageNodeIds = [
    ...new Set(lineage.flatMap((l) => [l.fromNodeId, l.toNodeId]).filter((id) => id !== nodeId)),
  ];
  const lineageNodes = lineageNodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
          editionId: schema.strategyNodes.editionId,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, lineageNodeIds))
    : [];
  const editions = await getEditions();

  return {
    node,
    edition,
    parent,
    children,
    kpis,
    kpiValues,
    updates,
    linkedDocs: linkedDocs.filter((d) => !d.deletedAt && d.classificationLevel <= user.clearanceLevel),
    linkedExperts,
    lessons,
    deps,
    depNodes,
    lineage,
    lineageNodes,
    editions,
  };
}

export async function createStatusUpdate(
  user: CurrentUser,
  input: {
    nodeId: string;
    status: string;
    progressPct: number;
    summaryEn?: string;
    summaryAr?: string;
    risks?: { text_en: string; text_ar?: string; severity?: string }[];
    nextSteps?: { text_en: string; text_ar?: string }[];
    evidenceDocumentIds?: string[];
    period?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, input.nodeId))
    .limit(1);
  if (!node) return { ok: false, error: "not_found" };
  if (!can(user, "create", "strategy")) return { ok: false, error: "forbidden" };
  await db.insert(schema.statusUpdates).values({
    id: newId(),
    nodeId: input.nodeId,
    authorId: user.id,
    status: input.status,
    progressPct: input.progressPct,
    summaryEn: input.summaryEn ?? null,
    summaryAr: input.summaryAr ?? null,
    risksJson: input.risks ? JSON.stringify(input.risks) : null,
    nextStepsJson: input.nextSteps ? JSON.stringify(input.nextSteps) : null,
    evidenceDocumentIdsJson: input.evidenceDocumentIds
      ? JSON.stringify(input.evidenceDocumentIds)
      : null,
    period: input.period ?? null,
    createdAt: nowIso(),
  });
  await db
    .update(schema.strategyNodes)
    .set({ status: input.status, updatedAt: nowIso() })
    .where(eq(schema.strategyNodes.id, input.nodeId));
  await record({
    userId: user.id,
    type: "status_update_posted",
    resourceType: "node",
    resourceId: input.nodeId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "status_update", input.nodeId, { status: input.status });
  await enqueue("embed_records", { resourceType: "node", resourceId: input.nodeId });
  return { ok: true };
}

export async function addKpiValue(
  user: CurrentUser,
  kpiId: string,
  period: string,
  value: number,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!can(user, "create", "strategy")) return { ok: false, error: "forbidden" };
  const [kpi] = await db.select().from(schema.kpis).where(eq(schema.kpis.id, kpiId)).limit(1);
  if (!kpi) return { ok: false, error: "not_found" };
  await db.insert(schema.kpiValues).values({
    id: newId(),
    kpiId,
    period,
    actualValue: value,
    note: note ?? null,
    enteredBy: user.id,
    createdAt: nowIso(),
  });
  await record({
    userId: user.id,
    type: "kpi_value_entered",
    resourceType: "kpi",
    resourceId: kpiId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "kpi_value", kpiId, { period, value });
  return { ok: true };
}
