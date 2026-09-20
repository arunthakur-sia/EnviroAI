// Vault document service: the same functions back the pages and the API routes.
import { and, desc, eq, inArray, isNull, like, or, sql, asc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { can, canReadResource } from "@/server/auth/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";
import { record, notify } from "@/server/gamification/engine";
import { getKnowledgeOfWeekIds } from "./knowledge-of-week";

export type VaultFilters = {
  q?: string;
  knowledgeType?: string;
  outcome?: string;
  sector?: string;
  topic?: string;
  department?: string;
  year?: number;
  language?: string;
  classification?: number;
  status?: string;
  owner?: string;
  sort?: "newest" | "reused" | "viewed" | "review_due";
  limit?: number;
  cursor?: number;
};

export async function listDocuments(user: CurrentUser, filters: VaultFilters) {
  const conds = [
    isNull(schema.documents.deletedAt),
    sql`${schema.documents.classificationLevel} <= ${user.clearanceLevel}`,
  ];
  if (user.departmentScope === "own") {
    conds.push(
      or(
        isNull(schema.documents.departmentId),
        eq(schema.documents.departmentId, user.departmentId ?? "")
      )!
    );
  }
  if (filters.knowledgeType)
    conds.push(eq(schema.documents.knowledgeTypeTermId, filters.knowledgeType));
  if (filters.department) conds.push(eq(schema.documents.departmentId, filters.department));
  if (filters.year) conds.push(eq(schema.documents.publishYear, filters.year));
  if (filters.language) conds.push(eq(schema.documents.languageOriginal, filters.language));
  if (filters.classification)
    conds.push(eq(schema.documents.classificationLevel, filters.classification));
  if (filters.status) conds.push(eq(schema.documents.status, filters.status));
  if (filters.owner) conds.push(eq(schema.documents.ownerUserId, filters.owner));
  if (filters.q) {
    const pat = `%${filters.q}%`;
    conds.push(
      or(
        like(schema.documents.titleEn, pat),
        like(schema.documents.titleAr, pat),
        like(schema.documents.summaryEn, pat),
        like(schema.documents.summaryAr, pat)
      )!
    );
  }
  // taxonomy filters go through taggings
  for (const [_key, val] of [
    ["outcome", filters.outcome],
    ["sector", filters.sector],
    ["topic", filters.topic],
  ] as const) {
    if (!val) continue;
    const tagged = await db
      .select({ id: schema.taggings.resourceId })
      .from(schema.taggings)
      .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.taggings.termId))
      .where(
        and(eq(schema.taggings.resourceType, "document"), eq(schema.taxonomyTerms.code, val))
      );
    const ids = tagged.map((t) => t.id);
    conds.push(ids.length ? inArray(schema.documents.id, ids) : sql`0 = 1`);
  }

  const orderBy =
    filters.sort === "reused"
      ? desc(schema.documents.reuseCount)
      : filters.sort === "viewed"
        ? desc(schema.documents.viewCount)
        : filters.sort === "review_due"
          ? asc(schema.documents.reviewDueAt)
          : desc(schema.documents.createdAt);

  // CR03 1.1: the shelves view shows the whole library, so the cap allows it
  const limit = Math.min(filters.limit ?? 60, 300);
  const offset = filters.cursor ?? 0;
  const rows = await db
    .select()
    .from(schema.documents)
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(limit + 1)
    .offset(offset);

  return {
    documents: rows.slice(0, limit),
    nextCursor: rows.length > limit ? offset + limit : null,
  };
}

export async function getDocument(user: CurrentUser, id: string) {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .limit(1);
  if (!doc || doc.deletedAt) return { doc: null, allowed: false };
  const allowed = canReadResource(user, {
    classificationLevel: doc.classificationLevel,
    departmentId: doc.departmentId,
  });
  return { doc, allowed };
}

export async function documentTags(documentId: string) {
  return db
    .select({
      id: schema.taggings.id,
      termId: schema.taggings.termId,
      source: schema.taggings.source,
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
      dimension: schema.taxonomyDimensions.code,
    })
    .from(schema.taggings)
    .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.taggings.termId))
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(
      and(
        eq(schema.taggings.resourceType, "document"),
        eq(schema.taggings.resourceId, documentId)
      )
    );
}

export async function verifyDocument(
  user: CurrentUser,
  documentId: string,
  decision: "verified" | "needs_changes",
  note?: string,
  bothLanguagesChecked?: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { doc, allowed } = await getDocument(user, documentId);
  if (!doc || !allowed) return { ok: false, error: "not_found" };
  if (
    !can(user, "verify", "vault", {
      classificationLevel: doc.classificationLevel,
      departmentId: doc.departmentId,
    })
  ) {
    return { ok: false, error: "forbidden" };
  }
  await db.insert(schema.reviews).values({
    id: newId(),
    resourceType: "document",
    resourceId: documentId,
    reviewerId: user.id,
    decision,
    note: note ?? null,
    createdAt: nowIso(),
  });
  if (decision === "verified") {
    const patch: Record<string, unknown> = {
      status: "verified",
      verifiedBy: user.id,
      verifiedAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (bothLanguagesChecked) {
      patch.titleArMachine = 0;
      patch.summaryMachine = 0;
    }
    await db.update(schema.documents).set(patch).where(eq(schema.documents.id, documentId));
    await record({
      userId: user.id,
      type: "content_verified",
      resourceType: "document",
      resourceId: documentId,
      meta: { departmentId: user.departmentId },
    });
    if (doc.ownerUserId && doc.ownerUserId !== user.id) {
      await record({
        userId: doc.ownerUserId,
        type: "document_verified",
        resourceType: "document",
        resourceId: documentId,
      });
      // CR01 5.5: items born in Add Knowledge also award knowledge_verified
      const provenance = await db
        .select({ id: schema.relations.id })
        .from(schema.relations)
        .where(
          and(
            eq(schema.relations.fromType, "knowledge_submission"),
            eq(schema.relations.toType, "document"),
            eq(schema.relations.toId, documentId)
          )
        )
        .limit(1);
      if (provenance.length) {
        await record({
          userId: doc.ownerUserId,
          type: "knowledge_verified",
          resourceType: "document",
          resourceId: documentId,
        });
      }
      await notify(
        doc.ownerUserId,
        "verify",
        `"${doc.titleEn.slice(0, 60)}" was verified`,
        `تم توثيق "${(doc.titleAr || doc.titleEn).slice(0, 60)}"`,
        `/vault/${documentId}`
      );
    }
  } else {
    await db
      .update(schema.documents)
      .set({ status: "under_review", updatedAt: nowIso() })
      .where(eq(schema.documents.id, documentId));
    if (doc.ownerUserId && doc.ownerUserId !== user.id) {
      await notify(
        doc.ownerUserId,
        "verify",
        `"${doc.titleEn.slice(0, 60)}" needs changes`,
        `"${(doc.titleAr || doc.titleEn).slice(0, 60)}" يحتاج إلى تعديلات`,
        `/vault/${documentId}`
      );
    }
  }
  await audit(user.id, "verify", "document", documentId, { decision });
  return { ok: true };
}

export async function logView(user: CurrentUser, documentId: string) {
  await db
    .update(schema.documents)
    .set({ viewCount: sql`${schema.documents.viewCount} + 1` })
    .where(eq(schema.documents.id, documentId));
  await audit(user.id, "view", "document", documentId);
}

export type DocRow = typeof schema.documents.$inferSelect;

/** Maps DB documents to the serializable shape shelves and cards render. */
export async function toShelfDocs(docs: DocRow[]) {
  const ownerIds = [...new Set(docs.map((d) => d.ownerUserId).filter(Boolean))] as string[];
  const typeIds = [...new Set(docs.map((d) => d.knowledgeTypeTermId).filter(Boolean))] as string[];
  const owners = ownerIds.length
    ? await db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          color: schema.users.avatarColor,
          deletedAt: schema.users.deletedAt,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, ownerIds))
    : [];
  const types = typeIds.length
    ? await db
        .select({
          id: schema.taxonomyTerms.id,
          code: schema.taxonomyTerms.code,
          nameEn: schema.taxonomyTerms.nameEn,
          nameAr: schema.taxonomyTerms.nameAr,
        })
        .from(schema.taxonomyTerms)
        .where(inArray(schema.taxonomyTerms.id, typeIds))
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  const typeMap = new Map(types.map((t) => [t.id, t]));
  // CR08 8: this week's Knowledge of the Week wears a ribbon on every shelf
  const kowIds = await getKnowledgeOfWeekIds();
  return docs.map((d) => {
    const owner = d.ownerUserId ? ownerMap.get(d.ownerUserId) : null;
    const type = d.knowledgeTypeTermId ? typeMap.get(d.knowledgeTypeTermId) : null;
    return {
      id: d.id,
      kow: kowIds.has(`document:${d.id}`),
      titleEn: d.titleEn,
      titleAr: d.titleAr,
      summaryEn: d.summaryEn,
      summaryAr: d.summaryAr,
      typeCode: type?.code ?? null,
      typeNameEn: type?.nameEn ?? null,
      typeNameAr: type?.nameAr ?? null,
      classification: d.classificationLevel,
      status: d.status,
      /* CR08 9.1: the owner id travels with the name and the colour, so every
         shelf, book and list row can raise the person card for the owner. A
         retired account keeps its name on the item but has no card to open,
         so it carries no id. */
      ownerUserId: owner && !owner.deletedAt ? owner.id : null,
      ownerName: owner?.nameEn ?? null,
      ownerNameAr: owner?.nameAr ?? null,
      ownerColor: owner?.color ?? null,
      publishYear: d.publishYear,
      // CR03 1.2: spine width and cover caption need a credible page count.
      // Web captures and generated docx record 1 page, so unpaginated items
      // get an equivalent estimated from stored size (~3000 bytes per page).
      pageCount:
        d.pageCount && d.pageCount > 1
          ? d.pageCount
          : Math.max(1, Math.min(400, Math.round((d.sizeBytes ?? 3000) / 3000))),
      updatedAt: d.updatedAt,
      reuseCount: d.reuseCount,
      viewCount: d.viewCount,
    };
  });
}

export async function relatedItems(documentId: string) {
  const rels = await db
    .select()
    .from(schema.relations)
    .where(
      or(
        and(eq(schema.relations.fromType, "document"), eq(schema.relations.fromId, documentId)),
        and(eq(schema.relations.toType, "document"), eq(schema.relations.toId, documentId))
      )
    )
    .limit(40);
  const items = rels.map((r) => {
    const isFrom = r.fromType === "document" && r.fromId === documentId;
    return {
      type: isFrom ? r.toType : r.fromType,
      id: isFrom ? r.toId : r.fromId,
      relation: r.relation,
      source: r.source,
    };
  });
  return resolveResourceTitles(items);
}

/** Attaches bilingual titles to mixed-type resource references. */
export async function resolveResourceTitles<
  T extends { type: string; id: string },
>(items: T[]): Promise<(T & { titleEn: string; titleAr: string })[]> {
  const byType = new Map<string, string[]>();
  for (const item of items) {
    (byType.get(item.type) ?? byType.set(item.type, []).get(item.type)!).push(item.id);
  }
  const titles = new Map<string, { titleEn: string; titleAr: string }>();
  const lookups: [string, any, any, any][] = [
    ["document", schema.documents, schema.documents.titleEn, schema.documents.titleAr],
    ["indicator", schema.indicators, schema.indicators.nameEn, schema.indicators.nameAr],
    ["node", schema.strategyNodes, schema.strategyNodes.titleEn, schema.strategyNodes.titleAr],
    ["expert", schema.experts, schema.experts.nameEn, schema.experts.nameAr],
    ["question", schema.questions, schema.questions.titleEn, schema.questions.titleAr],
    ["lesson", schema.lessons, schema.lessons.titleEn, schema.lessons.titleAr],
  ];
  for (const [type, table, colEn, colAr] of lookups) {
    const ids = byType.get(type);
    if (!ids?.length) continue;
    const rows = await db
      .select({ id: (table as typeof schema.documents).id, titleEn: colEn, titleAr: colAr })
      .from(table)
      .where(inArray((table as typeof schema.documents).id, ids));
    for (const r of rows) titles.set(`${type}:${r.id}`, { titleEn: r.titleEn, titleAr: r.titleAr });
  }
  return items.map((item) => ({
    ...item,
    titleEn: titles.get(`${item.type}:${item.id}`)?.titleEn ?? "",
    titleAr: titles.get(`${item.type}:${item.id}`)?.titleAr ?? "",
  }));
}
