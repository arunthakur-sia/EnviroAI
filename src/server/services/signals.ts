// Trends and Signals service: stream listing with filters, triage actions,
// conversion to lessons/risks/vault documents, and the outcome radar.
import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";
import { record } from "@/server/gamification/engine";
import { indexSignal } from "@/server/scan/extract";

export type SignalFilters = {
  outcome?: string; // outcome taxonomy code -> node link
  type?: string;
  impact?: string;
  horizon?: string;
  source?: string;
  triage?: string;
  days?: number;
  q?: string;
  nodeId?: string;
  indicatorId?: string;
  riskId?: string;
  rankingId?: string;
  limit?: number;
};

export type SignalListItem = typeof schema.signals.$inferSelect & {
  links: {
    resourceType: string;
    resourceId: string;
    titleEn: string;
    titleAr: string;
    code: string | null;
  }[];
};

export async function listSignals(
  _user: CurrentUser,
  filters: SignalFilters
): Promise<SignalListItem[]> {
  const conds = [];
  if (filters.type) conds.push(eq(schema.signals.signalType, filters.type));
  if (filters.impact) conds.push(eq(schema.signals.impact, filters.impact));
  if (filters.horizon) conds.push(eq(schema.signals.horizon, filters.horizon));
  if (filters.source) conds.push(eq(schema.signals.sourceKind, filters.source));
  if (filters.triage) conds.push(eq(schema.signals.triageStatus, filters.triage));
  if (filters.days) {
    const since = new Date(Date.now() - filters.days * 86400000).toISOString();
    conds.push(
      or(
        gte(schema.signals.publishedAt, since.slice(0, 10)),
        gte(schema.signals.createdAt, since)
      )!
    );
  }
  if (filters.q) {
    const pat = `%${filters.q}%`;
    conds.push(
      or(
        like(schema.signals.titleEn, pat),
        like(schema.signals.titleAr, pat),
        like(schema.signals.descriptionEn, pat),
        like(schema.signals.descriptionAr, pat)
      )!
    );
  }

  // link-scoped filters
  let idFilter: string[] | null = null;
  const scopeLink = async (resourceType: string, resourceId: string) => {
    const rows = await db
      .select({ signalId: schema.signalLinks.signalId })
      .from(schema.signalLinks)
      .where(
        and(
          eq(schema.signalLinks.resourceType, resourceType),
          eq(schema.signalLinks.resourceId, resourceId)
        )
      );
    return rows.map((r) => r.signalId);
  };
  if (filters.nodeId) idFilter = await scopeLink("node", filters.nodeId);
  if (filters.indicatorId) idFilter = await scopeLink("indicator", filters.indicatorId);
  if (filters.riskId) idFilter = await scopeLink("risk", filters.riskId);
  if (filters.rankingId) idFilter = await scopeLink("ranking", filters.rankingId);
  if (filters.outcome) {
    const { outcomeNodeMap } = await import("@/server/scan/extract");
    const map = await outcomeNodeMap();
    const nodeId = map.get(filters.outcome);
    idFilter = nodeId ? await scopeLink("node", nodeId) : [];
  }
  if (idFilter !== null) {
    if (!idFilter.length) return [];
    conds.push(inArray(schema.signals.id, idFilter));
  }

  const rows = await db
    .select()
    .from(schema.signals)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.signals.publishedAt), desc(schema.signals.createdAt))
    .limit(Math.min(filters.limit ?? 60, 120));

  return attachLinks(rows);
}

async function attachLinks(
  rows: (typeof schema.signals.$inferSelect)[]
): Promise<SignalListItem[]> {
  if (!rows.length) return [];
  const links = await db
    .select()
    .from(schema.signalLinks)
    .where(inArray(schema.signalLinks.signalId, rows.map((r) => r.id)));
  const nodeIds = [...new Set(links.filter((l) => l.resourceType === "node").map((l) => l.resourceId))];
  const indIds = [...new Set(links.filter((l) => l.resourceType === "indicator").map((l) => l.resourceId))];
  const nodes = nodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
          code: schema.strategyNodes.code,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, nodeIds))
    : [];
  const inds = indIds.length
    ? await db
        .select({
          id: schema.indicators.id,
          titleEn: schema.indicators.nameEn,
          titleAr: schema.indicators.nameAr,
          code: schema.indicators.code,
        })
        .from(schema.indicators)
        .where(inArray(schema.indicators.id, indIds))
    : [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const indMap = new Map(inds.map((n) => [n.id, n]));
  return rows.map((r) => ({
    ...r,
    links: links
      .filter((l) => l.signalId === r.id)
      .map((l) => {
        const meta =
          l.resourceType === "node"
            ? nodeMap.get(l.resourceId)
            : l.resourceType === "indicator"
              ? indMap.get(l.resourceId)
              : null;
        return {
          resourceType: l.resourceType,
          resourceId: l.resourceId,
          titleEn: meta?.titleEn ?? l.resourceType,
          titleAr: meta?.titleAr ?? l.resourceType,
          code: meta?.code ?? null,
        };
      }),
  }));
}

export async function getSignal(user: CurrentUser, id: string) {
  const [row] = await db.select().from(schema.signals).where(eq(schema.signals.id, id)).limit(1);
  if (!row) return null;
  const [withLinks] = await attachLinks([row]);
  return withLinks;
}

export function canTriage(user: CurrentUser): boolean {
  return can(user, "verify", "foresight") || can(user, "manage", "foresight") || can(user, "create", "foresight");
}

export async function triageSignal(
  user: CurrentUser,
  signalId: string,
  action: "accept" | "dismiss",
  _note?: string
): Promise<{ ok: boolean; error?: string; points?: number }> {
  if (!canTriage(user)) return { ok: false, error: "forbidden" };
  const [signal] = await db
    .select()
    .from(schema.signals)
    .where(eq(schema.signals.id, signalId))
    .limit(1);
  if (!signal) return { ok: false, error: "not_found" };
  const status = action === "accept" ? "accepted" : "dismissed";
  await db
    .update(schema.signals)
    .set({ triageStatus: status, triagedBy: user.id, triagedAt: nowIso() })
    .where(eq(schema.signals.id, signalId));
  await audit(user.id, "triage", "signal", signalId, { action });
  let points = 0;
  if (action === "accept") {
    await indexSignal(signalId);
    const game = await record({
      userId: user.id,
      type: "signal_accepted",
      resourceType: "signal",
      resourceId: signalId,
      meta: { departmentId: user.departmentId },
    });
    points = game.points;
  }
  return { ok: true, points };
}

export async function convertSignal(
  user: CurrentUser,
  signalId: string,
  target: "lesson" | "risk" | "document"
): Promise<{ ok: boolean; error?: string; resourceType?: string; resourceId?: string; points?: number }> {
  if (!canTriage(user)) return { ok: false, error: "forbidden" };
  const [s] = await db.select().from(schema.signals).where(eq(schema.signals.id, signalId)).limit(1);
  if (!s) return { ok: false, error: "not_found" };

  const nodeLink = await db
    .select({ resourceId: schema.signalLinks.resourceId })
    .from(schema.signalLinks)
    .where(
      and(eq(schema.signalLinks.signalId, signalId), eq(schema.signalLinks.resourceType, "node"))
    )
    .limit(1);
  const nodeId = nodeLink[0]?.resourceId ?? null;

  let resourceType = "";
  let resourceId = "";

  if (target === "lesson") {
    resourceType = "lesson";
    resourceId = newId();
    await db.insert(schema.lessons).values({
      id: resourceId,
      authorId: user.id,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      contextEn: s.descriptionEn,
      contextAr: s.descriptionAr,
      learningEn: s.whyItMattersEn,
      learningAr: s.whyItMattersAr,
      recommendationEn: s.publisher
        ? `Track this development via ${s.publisher} and reflect it in the next outcome review.`
        : "Reflect this development in the next outcome review.",
      recommendationAr: "متابعة هذا التطور وإدراجه في المراجعة المقبلة للنتيجة الوطنية المعنية.",
      nodeId,
      classificationLevel: 1,
      status: "published",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    // CR07 1.2: a converted signal's node becomes the lesson's primary link
    if (nodeId) {
      await db.insert(schema.lessonNodeLinks).values({
        id: newId(),
        lessonId: resourceId,
        nodeId,
        nodeKind: "nds",
        isPrimary: 1,
        linkedBy: user.id,
        linkedAt: nowIso(),
      });
    }
    await record({
      userId: user.id,
      type: "lesson_published",
      resourceType: "lesson",
      resourceId,
      meta: { departmentId: user.departmentId },
    });
  } else if (target === "risk") {
    resourceType = "risk";
    resourceId = newId();
    await db.insert(schema.risks).values({
      id: resourceId,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      likelihood: s.impact === "high" ? 4 : s.impact === "low" ? 2 : 3,
      impact: s.impact === "high" ? 4 : s.impact === "low" ? 2 : 3,
      ownerUserId: user.id,
      nodeId,
      mitigationEn: s.whyItMattersEn,
      mitigationAr: s.whyItMattersAr,
      status: "open",
      createdAt: nowIso(),
    });
  } else {
    // document from the source URL
    resourceType = "document";
    if (!s.url) return { ok: false, error: "no_url" };
    const { fetchPageText } = await import("@/server/scan/manual");
    let pageText = s.sourceExcerpt ?? "";
    let pageTitle = s.titleEn;
    try {
      const page = await fetchPageText(s.url);
      pageText = page.text;
      pageTitle = page.title || s.titleEn;
    } catch {
      if (!pageText) return { ok: false, error: "fetch_failed" };
    }
    resourceId = newId();
    const { putText } = await import("@/server/storage");
    const storagePath = await putText(resourceId, "source.txt", `${pageTitle}\n${s.url}\n\n${pageText}`);
    await db.insert(schema.documents).values({
      id: resourceId,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      summaryEn: s.descriptionEn,
      summaryAr: s.descriptionAr,
      classificationLevel: 1,
      departmentId: user.departmentId,
      ownerUserId: user.id,
      languageOriginal: "en",
      status: "draft",
      sourceOrigin: "external",
      originalFilename: "source.txt",
      mime: "text/plain",
      sizeBytes: pageText.length,
      storagePath,
      sourceRef: s.url,
      isSeeded: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const { enqueue } = await import("@/server/jobs/queue");
    await enqueue("ingest_document", { documentId: resourceId });
  }

  await db
    .update(schema.signals)
    .set({
      triageStatus: "converted",
      triagedBy: user.id,
      triagedAt: nowIso(),
      convertedResourceType: resourceType,
      convertedResourceId: resourceId,
    })
    .where(eq(schema.signals.id, signalId));
  await db.insert(schema.signalLinks).values({
    id: newId(),
    signalId,
    resourceType,
    resourceId,
    relation: "converted_to",
    source: "human",
    createdAt: nowIso(),
  });
  await indexSignal(signalId).catch(() => {});
  await audit(user.id, "convert", "signal", signalId, { target, resourceId });
  const game = await record({
    userId: user.id,
    type: "signal_accepted",
    resourceType: "signal",
    resourceId: signalId,
    meta: { departmentId: user.departmentId },
  });
  return { ok: true, resourceType, resourceId, points: game.points };
}

/** Radar: per-outcome accepted counts + daily sparkline for the last 30 days. */
export async function radarByOutcome() {
  const { outcomeNodeMap } = await import("@/server/scan/extract");
  const map = await outcomeNodeMap(); // outcome code -> node id
  const outcomes = await db
    .select({
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
      sort: schema.taxonomyTerms.sort,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"))
    .orderBy(schema.taxonomyTerms.sort);

  const since = new Date(Date.now() - 30 * 86400000);
  const sinceIso = since.toISOString();
  const accepted = await db
    .select()
    .from(schema.signals)
    .where(
      and(
        inArray(schema.signals.triageStatus, ["accepted", "converted"]),
        gte(schema.signals.createdAt, sinceIso)
      )
    );
  const links = accepted.length
    ? await db
        .select()
        .from(schema.signalLinks)
        .where(
          and(
            inArray(schema.signalLinks.signalId, accepted.map((s) => s.id)),
            eq(schema.signalLinks.resourceType, "node")
          )
        )
    : [];

  return outcomes.map((o) => {
    const nodeId = map.get(o.code);
    const signalIds = new Set(
      links.filter((l) => l.resourceId === nodeId).map((l) => l.signalId)
    );
    const mine = accepted.filter((s) => signalIds.has(s.id));
    // daily counts, oldest -> newest
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
      return mine.filter((s) => (s.publishedAt ?? s.createdAt.slice(0, 10)) === day).length;
    });
    return {
      code: o.code,
      nameEn: o.nameEn,
      nameAr: o.nameAr,
      count: mine.length,
      daily,
      top: mine
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 3)
        .map((s) => ({ id: s.id, titleEn: s.titleEn, titleAr: s.titleAr })),
    };
  });
}

/** Related-signal counts for risks and index rankings (heat map + tracker rows). */
export async function relatedSignalCounts(
  resourceType: "risk" | "ranking",
  ids: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const rows = await db
    .select({
      resourceId: schema.signalLinks.resourceId,
      c: sql<number>`count(distinct ${schema.signalLinks.signalId})`,
    })
    .from(schema.signalLinks)
    .where(
      and(
        eq(schema.signalLinks.resourceType, resourceType),
        inArray(schema.signalLinks.resourceId, ids)
      )
    )
    .groupBy(schema.signalLinks.resourceId);
  for (const r of rows) map.set(r.resourceId, r.c);
  return map;
}

export async function lastScanInfo() {
  const [run] = await db
    .select()
    .from(schema.scanRuns)
    .orderBy(desc(schema.scanRuns.startedAt))
    .limit(1);
  return run ?? null;
}
