// CR07 1: a lesson links to one or more strategy nodes, across both stores
// (NES editions and the Programme Strategy). One link is primary and rides on
// the card; the rest show in the expanded lesson. Parent levels (targets,
// outcomes, council goals and intermediate outcomes) roll the lessons of
// everything beneath them up, marked inherited with the originating node.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

export type NodeKind = "nes" | "council";

export type LinkedNode = {
  id: string;
  kind: NodeKind;
  code: string | null;
  titleEn: string;
  titleAr: string;
  /** strategy_nodes.node_type, or council_nodes.level */
  level: string;
  /** the NES edition code, null for council nodes */
  edition: string | null;
};

export type LessonLink = {
  id: string;
  lessonId: string;
  nodeId: string;
  nodeKind: NodeKind;
  isPrimary: boolean;
  linkedBy: string | null;
  linkedAt: string;
  node: LinkedNode | null;
};

/* ------------------------------------------------------------------ */
/* node lookups across both stores                                      */
/* ------------------------------------------------------------------ */

type TreeNode = { id: string; parentId: string | null };

/** Every node in both stores, for ancestry and subtree walks. */
export async function loadNodeIndex(): Promise<{
  byId: Map<string, LinkedNode>;
  childrenOf: Map<string, TreeNode[]>;
}> {
  const [nes, council, editions] = await Promise.all([
    db
      .select({
        id: schema.strategyNodes.id,
        parentId: schema.strategyNodes.parentId,
        code: schema.strategyNodes.code,
        titleEn: schema.strategyNodes.titleEn,
        titleAr: schema.strategyNodes.titleAr,
        nodeType: schema.strategyNodes.nodeType,
        editionId: schema.strategyNodes.editionId,
      })
      .from(schema.strategyNodes),
    db
      .select({
        id: schema.councilNodes.id,
        parentId: schema.councilNodes.parentId,
        code: schema.councilNodes.code,
        titleEn: schema.councilNodes.titleEn,
        titleAr: schema.councilNodes.titleAr,
        level: schema.councilNodes.level,
      })
      .from(schema.councilNodes),
    db
      .select({ id: schema.strategyEditions.id, code: schema.strategyEditions.code })
      .from(schema.strategyEditions),
  ]);
  const editionCode = new Map(editions.map((e) => [e.id, e.code]));
  const byId = new Map<string, LinkedNode>();
  const childrenOf = new Map<string, TreeNode[]>();
  const push = (parentId: string | null, node: TreeNode) => {
    if (!parentId) return;
    (childrenOf.get(parentId) ?? childrenOf.set(parentId, []).get(parentId)!).push(node);
  };
  for (const n of nes) {
    byId.set(n.id, {
      id: n.id,
      kind: "nes",
      code: n.code,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      level: n.nodeType,
      edition: editionCode.get(n.editionId) ?? null,
    });
    push(n.parentId, { id: n.id, parentId: n.parentId });
  }
  for (const n of council) {
    byId.set(n.id, {
      id: n.id,
      kind: "council",
      code: n.code,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      level: n.level,
      edition: null,
    });
    push(n.parentId, { id: n.id, parentId: n.parentId });
  }
  return { byId, childrenOf };
}

/** Every descendant id of a node, both stores, excluding the node itself. */
export function descendantsOf(
  nodeId: string,
  childrenOf: Map<string, TreeNode[]>
): string[] {
  const out: string[] = [];
  const walk = (id: string, depth: number) => {
    if (depth > 8) return;
    for (const child of childrenOf.get(id) ?? []) {
      out.push(child.id);
      walk(child.id, depth + 1);
    }
  };
  walk(nodeId, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* reading links                                                        */
/* ------------------------------------------------------------------ */

/** Links for a set of lessons, primary first, with the node hydrated. */
export async function loadLinksForLessons(
  lessonIds: string[]
): Promise<Map<string, LessonLink[]>> {
  const out = new Map<string, LessonLink[]>();
  if (!lessonIds.length) return out;
  const rows = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(inArray(schema.lessonNodeLinks.lessonId, lessonIds));
  if (!rows.length) return out;
  const { byId } = await loadNodeIndex();
  for (const r of rows.sort((a, b) => b.isPrimary - a.isPrimary)) {
    const link: LessonLink = {
      id: r.id,
      lessonId: r.lessonId,
      nodeId: r.nodeId,
      nodeKind: r.nodeKind as NodeKind,
      isPrimary: r.isPrimary === 1,
      linkedBy: r.linkedBy,
      linkedAt: r.linkedAt,
      node: byId.get(r.nodeId) ?? null,
    };
    (out.get(r.lessonId) ?? out.set(r.lessonId, []).get(r.lessonId)!).push(link);
  }
  return out;
}

export type NodeLessonRow = {
  lessonId: string;
  titleEn: string;
  titleAr: string;
  category: string;
  status: string;
  createdAt: string;
  authorNameEn: string | null;
  authorNameAr: string | null;
  authorColor: string | null;
  /** false when the lesson sits on a node beneath this one */
  direct: boolean;
  /** the node the lesson is actually linked to */
  originEn: string;
  originAr: string;
  originCode: string | null;
  originId: string;
};

/** Direct lessons of a node, then the lessons of everything beneath it. */
export async function getLessonsForNode(
  user: CurrentUser,
  nodeId: string
): Promise<{ direct: NodeLessonRow[]; inherited: NodeLessonRow[] }> {
  const { byId, childrenOf } = await loadNodeIndex();
  const subtree = descendantsOf(nodeId, childrenOf);
  const ids = [nodeId, ...subtree];
  const links = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(inArray(schema.lessonNodeLinks.nodeId, ids));
  if (!links.length) return { direct: [], inherited: [] };
  const lessonIds = [...new Set(links.map((l) => l.lessonId))];
  const lessons = await db
    .select({
      id: schema.lessons.id,
      titleEn: schema.lessons.titleEn,
      titleAr: schema.lessons.titleAr,
      category: schema.lessons.category,
      status: schema.lessons.status,
      createdAt: schema.lessons.createdAt,
      classificationLevel: schema.lessons.classificationLevel,
      authorNameEn: schema.users.nameEn,
      authorNameAr: schema.users.nameAr,
      authorColor: schema.users.avatarColor,
    })
    .from(schema.lessons)
    .leftJoin(schema.users, eq(schema.users.id, schema.lessons.authorId))
    .where(
      and(
        inArray(schema.lessons.id, lessonIds),
        inArray(schema.lessons.status, ["published", "verified"]),
        sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`
      )
    );
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const direct: NodeLessonRow[] = [];
  const inherited: NodeLessonRow[] = [];
  const seenInherited = new Set<string>();
  for (const link of links) {
    const lesson = lessonById.get(link.lessonId);
    if (!lesson) continue;
    const origin = byId.get(link.nodeId);
    const row: NodeLessonRow = {
      lessonId: lesson.id,
      titleEn: lesson.titleEn,
      titleAr: lesson.titleAr,
      category: lesson.category,
      status: lesson.status,
      createdAt: lesson.createdAt,
      authorNameEn: lesson.authorNameEn,
      authorNameAr: lesson.authorNameAr,
      authorColor: lesson.authorColor,
      direct: link.nodeId === nodeId,
      originEn: origin?.titleEn ?? "",
      originAr: origin?.titleAr ?? "",
      originCode: origin?.code ?? null,
      originId: link.nodeId,
    };
    if (row.direct) direct.push(row);
    else if (!seenInherited.has(lesson.id)) {
      seenInherited.add(lesson.id);
      inherited.push(row);
    }
  }
  const directIds = new Set(direct.map((d) => d.lessonId));
  const byDate = (a: NodeLessonRow, b: NodeLessonRow) => b.createdAt.localeCompare(a.createdAt);
  return {
    direct: direct.sort(byDate),
    // a lesson linked here as well as below counts once, as direct
    inherited: inherited.filter((i) => !directIds.has(i.lessonId)).sort(byDate),
  };
}

/** Direct and rolled-up counts for many nodes at once (chips and tab labels). */
export async function lessonCountsFor(
  nodeIds: string[]
): Promise<Map<string, { direct: number; inherited: number; total: number }>> {
  const out = new Map<string, { direct: number; inherited: number; total: number }>();
  if (!nodeIds.length) return out;
  const { childrenOf } = await loadNodeIndex();
  const allLinks = await db
    .select({
      nodeId: schema.lessonNodeLinks.nodeId,
      lessonId: schema.lessonNodeLinks.lessonId,
    })
    .from(schema.lessonNodeLinks);
  const lessonsByNode = new Map<string, Set<string>>();
  for (const l of allLinks) {
    (lessonsByNode.get(l.nodeId) ?? lessonsByNode.set(l.nodeId, new Set()).get(l.nodeId)!).add(
      l.lessonId
    );
  }
  for (const nodeId of nodeIds) {
    const directSet = lessonsByNode.get(nodeId) ?? new Set<string>();
    const belowSet = new Set<string>();
    for (const d of descendantsOf(nodeId, childrenOf)) {
      for (const lessonId of lessonsByNode.get(d) ?? []) {
        if (!directSet.has(lessonId)) belowSet.add(lessonId);
      }
    }
    out.set(nodeId, {
      direct: directSet.size,
      inherited: belowSet.size,
      total: directSet.size + belowSet.size,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* writing links (CR07 1.1.4: author, project owner, or verifier)       */
/* ------------------------------------------------------------------ */

export async function canEditLessonLinks(
  user: CurrentUser,
  lessonId: string,
  nodeId?: string
): Promise<boolean> {
  if (can(user, "verify", "lessons") || can(user, "edit_any", "lessons")) return true;
  const [lesson] = await db
    .select({ authorId: schema.lessons.authorId })
    .from(schema.lessons)
    .where(eq(schema.lessons.id, lessonId))
    .limit(1);
  if (lesson?.authorId === user.id) return true;
  if (!nodeId) return false;
  // the owner of the node: a stakeholder with role owner, or the node's owner
  const owners = await db
    .select({ userId: schema.nodeStakeholders.userId })
    .from(schema.nodeStakeholders)
    .where(
      and(eq(schema.nodeStakeholders.nodeId, nodeId), eq(schema.nodeStakeholders.role, "owner"))
    );
  if (owners.some((o) => o.userId === user.id)) return true;
  const [node] = await db
    .select({ ownerUserId: schema.strategyNodes.ownerUserId })
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (node?.ownerUserId === user.id) return true;
  const [councilNode] = await db
    .select({ ownerUserId: schema.councilNodes.ownerUserId })
    .from(schema.councilNodes)
    .where(eq(schema.councilNodes.id, nodeId))
    .limit(1);
  return councilNode?.ownerUserId === user.id;
}

/** Adds a link. The first link on a lesson becomes primary automatically. */
export async function linkLessonToNode(
  user: CurrentUser,
  input: { lessonId: string; nodeId: string; nodeKind?: NodeKind; makePrimary?: boolean }
): Promise<{ ok: boolean; error?: string; link?: LessonLink }> {
  const { lessonId, nodeId } = input;
  if (!(await canEditLessonLinks(user, lessonId, nodeId))) {
    return { ok: false, error: "forbidden" };
  }
  const { byId } = await loadNodeIndex();
  const node = byId.get(nodeId);
  if (!node) return { ok: false, error: "node_not_found" };
  const nodeKind = input.nodeKind ?? node.kind;
  const existing = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(eq(schema.lessonNodeLinks.lessonId, lessonId));
  if (existing.some((e) => e.nodeId === nodeId)) {
    return { ok: false, error: "already_linked" };
  }
  const primary = input.makePrimary || existing.length === 0;
  if (primary) {
    await db
      .update(schema.lessonNodeLinks)
      .set({ isPrimary: 0 })
      .where(eq(schema.lessonNodeLinks.lessonId, lessonId));
  }
  const id = newId();
  await db.insert(schema.lessonNodeLinks).values({
    id,
    lessonId,
    nodeId,
    nodeKind,
    isPrimary: primary ? 1 : 0,
    linkedBy: user.id,
    linkedAt: nowIso(),
  });
  await syncPrimaryMirror(lessonId);
  await audit(user.id, "lesson_linked", "lesson", lessonId, { nodeId, nodeKind, primary });
  return {
    ok: true,
    link: {
      id,
      lessonId,
      nodeId,
      nodeKind,
      isPrimary: primary,
      linkedBy: user.id,
      linkedAt: nowIso(),
      node,
    },
  };
}

export async function unlinkLesson(
  user: CurrentUser,
  linkId: string
): Promise<{ ok: boolean; error?: string }> {
  const [link] = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(eq(schema.lessonNodeLinks.id, linkId))
    .limit(1);
  if (!link) return { ok: false, error: "not_found" };
  if (!(await canEditLessonLinks(user, link.lessonId, link.nodeId))) {
    return { ok: false, error: "forbidden" };
  }
  await db.delete(schema.lessonNodeLinks).where(eq(schema.lessonNodeLinks.id, linkId));
  // a removed primary promotes the oldest remaining link
  if (link.isPrimary === 1) {
    const rest = await db
      .select()
      .from(schema.lessonNodeLinks)
      .where(eq(schema.lessonNodeLinks.lessonId, link.lessonId));
    const next = rest.sort((a, b) => a.linkedAt.localeCompare(b.linkedAt))[0];
    if (next) {
      await db
        .update(schema.lessonNodeLinks)
        .set({ isPrimary: 1 })
        .where(eq(schema.lessonNodeLinks.id, next.id));
    }
  }
  await syncPrimaryMirror(link.lessonId);
  await audit(user.id, "lesson_unlinked", "lesson", link.lessonId, { nodeId: link.nodeId });
  return { ok: true };
}

export async function setPrimaryLink(
  user: CurrentUser,
  linkId: string
): Promise<{ ok: boolean; error?: string }> {
  const [link] = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(eq(schema.lessonNodeLinks.id, linkId))
    .limit(1);
  if (!link) return { ok: false, error: "not_found" };
  if (!(await canEditLessonLinks(user, link.lessonId, link.nodeId))) {
    return { ok: false, error: "forbidden" };
  }
  await db
    .update(schema.lessonNodeLinks)
    .set({ isPrimary: 0 })
    .where(eq(schema.lessonNodeLinks.lessonId, link.lessonId));
  await db
    .update(schema.lessonNodeLinks)
    .set({ isPrimary: 1 })
    .where(eq(schema.lessonNodeLinks.id, linkId));
  await syncPrimaryMirror(link.lessonId);
  await audit(user.id, "lesson_primary_link", "lesson", link.lessonId, { nodeId: link.nodeId });
  return { ok: true };
}

/** CR07 1.2: lessons.node_id stays as the primary link's mirror so the
    CR02 era queries that read it keep returning the same answer. */
export async function syncPrimaryMirror(lessonId: string): Promise<void> {
  const rows = await db
    .select()
    .from(schema.lessonNodeLinks)
    .where(eq(schema.lessonNodeLinks.lessonId, lessonId));
  // only NES nodes can sit in the legacy column; a council-only lesson clears it
  const primary = rows.find((r) => r.isPrimary === 1 && r.nodeKind === "nes");
  await db
    .update(schema.lessons)
    .set({ nodeId: primary?.nodeId ?? null, updatedAt: nowIso() })
    .where(eq(schema.lessons.id, lessonId));
}
