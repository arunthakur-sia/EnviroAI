// CR02 2.3: deliverables are Vault documents with knowledge_type =
// deliverable, an about_node relation to their initiative or project, and
// inherited outcome and target links. They follow the normal classification
// and verification rules; the node owner is notified as the default verifier.
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { put } from "@/server/storage";
import { parseDocument, mimeFromFilename } from "@/server/ingest/parse";
import { enrichContent } from "@/server/ai";
import { getAllTerms } from "@/server/services/taxonomy";
import { enqueue } from "@/server/jobs/queue";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";

export async function ensureDeliverableTerm(): Promise<string> {
  const [dim] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  if (!dim) throw new Error("knowledge_type dimension missing");
  const [existing] = await db
    .select()
    .from(schema.taxonomyTerms)
    .where(
      and(
        eq(schema.taxonomyTerms.dimensionId, dim.id),
        eq(schema.taxonomyTerms.code, "deliverable")
      )
    )
    .limit(1);
  if (existing) return existing.id;
  const id = newId();
  await db.insert(schema.taxonomyTerms).values({
    id,
    dimensionId: dim.id,
    parentId: null,
    code: "deliverable",
    nameEn: "Deliverable",
    nameAr: "تسليم",
    descriptionEn: "A contracted output of an initiative or project",
    descriptionAr: "مخرج تعاقدي لمبادرة أو مشروع",
    sort: 90,
    isActive: 1,
  });
  return id;
}

/** Walk up from a node to find its target and outcome ancestors. */
export async function nodeAncestry(nodeId: string) {
  const chain: (typeof schema.strategyNodes.$inferSelect)[] = [];
  let currentId: string | null = nodeId;
  for (let i = 0; i < 6 && currentId; i++) {
    const [n] = await db
      .select()
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.id, currentId))
      .limit(1);
    if (!n) break;
    chain.push(n);
    currentId = n.parentId;
  }
  return {
    node: chain[0] ?? null,
    initiative: chain.find((n) => n.nodeType === "initiative") ?? null,
    target: chain.find((n) => n.nodeType === "target") ?? null,
    outcome: chain.find((n) => n.nodeType === "outcome") ?? null,
  };
}

export type DeliverableRow = {
  id: string; // deliverable_meta id
  documentId: string;
  deliverableCode: string;
  milestone: string | null;
  dueDate: string | null;
  deliveredDate: string | null;
  acceptanceStatus: string;
  titleEn: string;
  titleAr: string;
  status: string;
  classificationLevel: number;
  versionNo: number;
  createdAt: string;
  ownerNameEn: string | null;
  ownerNameAr: string | null;
  mime: string | null;
};

export async function listDeliverables(
  user: CurrentUser,
  nodeId: string
): Promise<DeliverableRow[]> {
  const metas = await db
    .select()
    .from(schema.deliverableMeta)
    .where(eq(schema.deliverableMeta.nodeId, nodeId))
    .orderBy(asc(schema.deliverableMeta.deliverableCode));
  if (!metas.length) return [];
  const docIds = metas.map((m) => m.documentId);
  const docs = await db
    .select()
    .from(schema.documents)
    .where(inArray(schema.documents.id, docIds));
  const ownerIds = [...new Set(docs.map((d) => d.ownerUserId).filter(Boolean))] as string[];
  const owners = ownerIds.length
    ? await db
        .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr })
        .from(schema.users)
        .where(inArray(schema.users.id, ownerIds))
    : [];
  const versions = await db
    .select()
    .from(schema.documentVersions)
    .where(inArray(schema.documentVersions.documentId, docIds));

  const rows: DeliverableRow[] = [];
  for (const m of metas) {
    const doc = docs.find((d) => d.id === m.documentId);
    if (!doc || doc.deletedAt) continue;
    if (doc.classificationLevel > user.clearanceLevel) continue;
    const owner = owners.find((o) => o.id === doc.ownerUserId) ?? null;
    const vNo = versions
      .filter((v) => v.documentId === doc.id)
      .reduce((max, v) => Math.max(max, v.versionNo), 1);
    rows.push({
      id: m.id,
      documentId: doc.id,
      deliverableCode: m.deliverableCode,
      milestone: m.milestone,
      dueDate: m.dueDate,
      deliveredDate: m.deliveredDate,
      acceptanceStatus: m.acceptanceStatus,
      titleEn: doc.titleEn,
      titleAr: doc.titleAr,
      status: doc.status,
      classificationLevel: doc.classificationLevel,
      versionNo: vNo,
      createdAt: doc.createdAt,
      ownerNameEn: owner?.nameEn ?? null,
      ownerNameAr: owner?.nameAr ?? null,
      mime: doc.mime,
    });
  }
  return rows;
}

export async function createDeliverable(
  user: CurrentUser,
  input: {
    nodeId: string;
    filename: string;
    buffer: Buffer;
    mime?: string;
    milestone?: string;
    dueDate?: string;
  }
): Promise<{ ok: boolean; error?: string; documentId?: string; code?: string; points?: number }> {
  if (!can(user, "create", "vault")) return { ok: false, error: "forbidden" };
  const { node, target, outcome } = await nodeAncestry(input.nodeId);
  if (!node || (node.nodeType !== "initiative" && node.nodeType !== "project")) {
    return { ok: false, error: "not_a_delivery_node" };
  }

  const termId = await ensureDeliverableTerm();
  const mime = input.mime || mimeFromFilename(input.filename);
  const documentId = newId();
  const storagePath = await put(documentId, input.filename, input.buffer);
  const parsed = await parseDocument(input.buffer, input.filename, mime);
  const terms = await getAllTerms();
  const enrichment = await enrichContent({
    filename: input.filename,
    text: parsed.text,
    pages: parsed.pages,
    lang: parsed.lang,
    terms: terms.map((t) => ({
      code: t.code,
      nameEn: t.nameEn,
      nameAr: t.nameAr,
      dimension: t.dimension,
    })),
    sourceOrigin: "npc",
  });

  const versionId = newId();
  await db.insert(schema.documents).values({
    id: documentId,
    titleEn: enrichment.title_en || input.filename,
    titleAr: enrichment.title_ar || "",
    titleArMachine: enrichment.machine && enrichment.title_ar ? 1 : 0,
    summaryEn: enrichment.summary_en || null,
    summaryAr: enrichment.summary_ar || null,
    summaryMachine: enrichment.machine ? 1 : 0,
    keyFactsJson: JSON.stringify(enrichment.key_facts ?? []),
    knowledgeTypeTermId: termId,
    classificationLevel: enrichment.classification_level ?? 2,
    departmentId: user.departmentId,
    ownerUserId: user.id,
    languageOriginal: parsed.lang,
    status: "under_review",
    reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    sourceOrigin: "npc",
    publishYear: enrichment.publish_year,
    originalFilename: input.filename,
    mime,
    sizeBytes: input.buffer.length,
    pageCount: parsed.pageCount,
    storagePath,
    currentVersionId: versionId,
    isSeeded: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await db.insert(schema.documentVersions).values({
    id: versionId,
    documentId,
    versionNo: 1,
    storagePath,
    uploadedBy: user.id,
    createdAt: nowIso(),
  });

  // about_node to the delivery node, plus inherited target and outcome links
  const linkTargets = [node.id];
  if (target) linkTargets.push(target.id);
  if (outcome) linkTargets.push(outcome.id);
  for (const toId of [...new Set(linkTargets)]) {
    await db.insert(schema.relations).values({
      id: newId(),
      fromType: "document",
      fromId: documentId,
      toType: "node",
      toId,
      relation: "about_node",
      source: toId === node.id ? "human" : "inherited",
      createdAt: nowIso(),
    });
  }

  // deliverable code: D1, D2, ... per node
  const existing = await db
    .select({ id: schema.deliverableMeta.id })
    .from(schema.deliverableMeta)
    .where(eq(schema.deliverableMeta.nodeId, node.id));
  const code = `D${existing.length + 1}`;
  await db.insert(schema.deliverableMeta).values({
    id: newId(),
    documentId,
    nodeId: node.id,
    deliverableCode: code,
    milestone: input.milestone ?? null,
    dueDate: input.dueDate ?? null,
    deliveredDate: nowIso().slice(0, 10),
    acceptanceStatus: "pending",
    createdAt: nowIso(),
  });

  await enqueue("ingest_document", { documentId });
  await enqueue("translate_document", { documentId });
  const game = await record({
    userId: user.id,
    type: "document_uploaded",
    resourceType: "document",
    resourceId: documentId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "deliverable", documentId, {
    nodeId: node.id,
    code,
  });

  // the node owner is the default verifier: tell them
  if (node.ownerUserId && node.ownerUserId !== user.id) {
    await db.insert(schema.notifications).values({
      id: newId(),
      userId: node.ownerUserId,
      kind: "deliverable_uploaded",
      titleEn: `New deliverable ${code} on ${node.code ?? node.titleEn}`,
      titleAr: `تسليم جديد ${code} في ${node.code ?? node.titleAr}`,
      bodyEn: "You are the default verifier for this node's deliverables.",
      bodyAr: "أنت الموثق الافتراضي لتسليمات هذه العقدة.",
      link: `/vault/${documentId}`,
      readAt: null,
      createdAt: nowIso(),
    });
  }

  return { ok: true, documentId, code, points: game.points };
}

/** Deliverable badges for document lists and Ask citations:
    documentId -> { code, nodeCode, nodeTitleEn, nodeTitleAr, nodeType }. */
export async function deliverableInfoForDocs(docIds: string[]) {
  if (!docIds.length) return new Map<string, { code: string; nodeCode: string | null; nodeTitleEn: string; nodeTitleAr: string; nodeType: string; nodeId: string }>();
  const metas = await db
    .select()
    .from(schema.deliverableMeta)
    .where(inArray(schema.deliverableMeta.documentId, docIds));
  const nodeIds = [...new Set(metas.map((m) => m.nodeId))];
  const nodes = nodeIds.length
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, nodeIds))
    : [];
  const map = new Map<string, { code: string; nodeCode: string | null; nodeTitleEn: string; nodeTitleAr: string; nodeType: string; nodeId: string }>();
  for (const m of metas) {
    const n = nodes.find((x) => x.id === m.nodeId);
    if (!n) continue;
    map.set(m.documentId, {
      code: m.deliverableCode,
      nodeCode: n.code,
      nodeTitleEn: n.titleEn,
      nodeTitleAr: n.titleAr,
      nodeType: n.nodeType,
      nodeId: n.id,
    });
  }
  return map;
}
