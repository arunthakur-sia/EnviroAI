// CR05 5: the HR Knowledge Dashboard service. Ownership inventory, the
// handover readiness score (5.3), the business-continuity score (5.4), the
// risk rules (5.5), the handover engine (5.6.4), and the page read models.
// Privacy: nothing here ever returns gamification points, badges, streaks,
// Learn sessions, or private notes (5.1).
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";

/* ------------------------------------------------------------------ */
/* access                                                               */
/* ------------------------------------------------------------------ */

export type HrScope = { all: boolean; departmentId: string | null };

/** HR Admin and Super Admin see everything; Department Heads their own
    department; everyone else nothing (the portal itself hides too, 6.1). */
export function hrScopeFor(user: CurrentUser): HrScope | null {
  const role = user.role.nameEn;
  if (role === "HR Admin" || role === "Super Admin") return { all: true, departmentId: null };
  if (role === "Department Head" && user.departmentId) {
    return { all: false, departmentId: user.departmentId };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* ownership inventory                                                  */
/* ------------------------------------------------------------------ */

export type OwnedItem = {
  itemKind:
    | "document"
    | "node_owner"
    | "node_role"
    | "indicator"
    | "lesson"
    | "expert_request"
    | "collection"
    | "community_lead"
    | "tacit_topic";
  resourceType: string;
  resourceId: string;
  title: string;
  verified: boolean;
  reviewDueAt: string | null;
  critical: boolean;
};

type Inventory = Map<string, OwnedItem[]>;

/** Builds every user's owned items in one pass (documents, node ownership and
    stakeholder roles, KPI/indicator ownership, lessons, expert-profile
    ownership, collections, community leadership). */
export async function buildInventory(): Promise<Inventory> {
  const [docs, nodes, stakeholders, kpis, lessons, experts, collections, communities, relationsRows] =
    await Promise.all([
      db.select().from(schema.documents).where(isNull(schema.documents.deletedAt)),
      db.select().from(schema.strategyNodes),
      db.select().from(schema.nodeStakeholders),
      db.select().from(schema.kpis),
      db.select().from(schema.lessons),
      db.select().from(schema.experts),
      db.select().from(schema.collections),
      db.select().from(schema.communities),
      db
        .select()
        .from(schema.relations)
        .where(
          and(eq(schema.relations.fromType, "document"), eq(schema.relations.toType, "node"))
        ),
    ]);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  // a document is critical when it is linked to a target or outcome
  const criticalDocIds = new Set<string>();
  for (const r of relationsRows) {
    const node = nodeById.get(r.toId);
    if (node && (node.nodeType === "target" || node.nodeType === "outcome")) {
      criticalDocIds.add(r.fromId);
    }
  }
  const inv: Inventory = new Map();
  const push = (userId: string | null | undefined, item: OwnedItem) => {
    if (!userId) return;
    (inv.get(userId) ?? inv.set(userId, []).get(userId)!).push(item);
  };
  for (const d of docs) {
    push(d.ownerUserId, {
      itemKind: "document",
      resourceType: "document",
      resourceId: d.id,
      title: d.titleEn,
      verified: d.status === "verified",
      reviewDueAt: d.reviewDueAt,
      critical: criticalDocIds.has(d.id) || d.classificationLevel >= 3,
    });
  }
  for (const n of nodes) {
    push(n.ownerUserId, {
      itemKind: "node_owner",
      resourceType: "node",
      resourceId: n.id,
      title: `${n.code ? n.code + " " : ""}${n.titleEn}`,
      verified: n.verified === 1,
      reviewDueAt: null,
      critical: n.nodeType === "target" || n.nodeType === "outcome",
    });
  }
  for (const s of stakeholders) {
    if (!s.userId) continue;
    if (!["sponsor", "owner", "manager"].includes(s.role)) continue;
    const node = nodeById.get(s.nodeId);
    push(s.userId, {
      itemKind: "node_role",
      resourceType: "node",
      resourceId: s.nodeId,
      title: `${s.role}: ${node ? `${node.code ? node.code + " " : ""}${node.titleEn}` : s.nodeId}`,
      verified: true,
      reviewDueAt: null,
      critical: s.role === "owner" || s.role === "manager",
    });
  }
  for (const k of kpis) {
    push(k.ownerUserId, {
      itemKind: "indicator",
      resourceType: "kpi",
      resourceId: k.id,
      title: k.nameEn,
      verified: true,
      reviewDueAt: null,
      critical: true, // indicator ownership counts as critical (5.5)
    });
  }
  for (const l of lessons) {
    push(l.authorId, {
      itemKind: "lesson",
      resourceType: "lesson",
      resourceId: l.id,
      title: l.titleEn,
      verified: l.status === "verified",
      reviewDueAt: null,
      critical: false,
    });
  }
  for (const e of experts) {
    push(e.ownerUserId, {
      itemKind: "expert_request",
      resourceType: "expert",
      resourceId: e.id,
      title: `Expert profile: ${e.nameEn}`,
      verified: e.isVerified === 1,
      reviewDueAt: null,
      critical: false,
    });
  }
  for (const c of collections) {
    push(c.ownerUserId, {
      itemKind: "collection",
      resourceType: "collection",
      resourceId: c.id,
      title: c.nameEn,
      verified: true,
      reviewDueAt: null,
      critical: false,
    });
  }
  for (const c of communities) {
    push(c.leadUserId, {
      itemKind: "community_lead",
      resourceType: "community",
      resourceId: c.id,
      title: c.nameEn,
      verified: true,
      reviewDueAt: null,
      critical: false,
    });
  }
  return inv;
}

/* ------------------------------------------------------------------ */
/* scores                                                               */
/* ------------------------------------------------------------------ */

export type Readiness = {
  score: number; // 0..100
  backupShare: number;
  freshShare: number;
  deputyShare: number;
  captureRecent: boolean;
  ownedCount: number;
};

/** CR05 5.3: readiness = 0.4 backup share + 0.3 fresh-verified share +
    0.2 deputy share + 0.1 recent capture. */
export function readinessOf(
  items: OwnedItem[],
  backups: Set<string>, // `${resourceType}:${resourceId}` with a named backup
  roleDeputies: Map<string, boolean>, // nodeId -> a deputy/successor exists
  hasRecentCapture: boolean
): Readiness {
  const owned = items.filter((i) => i.itemKind !== "node_role");
  const backupShare = owned.length
    ? owned.filter((i) => backups.has(`${i.resourceType}:${i.resourceId}`)).length / owned.length
    : 1;
  const now = nowIso();
  const freshShare = owned.length
    ? owned.filter((i) => i.verified && (!i.reviewDueAt || i.reviewDueAt >= now)).length /
      owned.length
    : 1;
  const roles = items.filter((i) => i.itemKind === "node_role");
  const deputyShare = roles.length
    ? roles.filter((i) => roleDeputies.get(i.resourceId)).length / roles.length
    : 1;
  const score = Math.round(
    100 * (0.4 * backupShare + 0.3 * freshShare + 0.2 * deputyShare + 0.1 * (hasRecentCapture ? 1 : 0))
  );
  return {
    score,
    backupShare,
    freshShare,
    deputyShare,
    captureRecent: hasRecentCapture,
    ownedCount: owned.length,
  };
}

/** CR05 5.4: start at 100, subtract 15/8/3/1 per critical/high/medium/low, floor 0. */
export function continuityOf(risks: { severity: string }[]): {
  score: number;
  counts: Record<string, number>;
} {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
  for (const r of risks) counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  const score = Math.max(
    0,
    100 - 15 * counts.critical - 8 * counts.high - 3 * counts.medium - 1 * counts.low
  );
  return { score, counts };
}

/* ------------------------------------------------------------------ */
/* shared context                                                       */
/* ------------------------------------------------------------------ */

async function loadContext() {
  const [users, departments, statuses, backups, handovers, items, stakeholders, captures, lessons] =
    await Promise.all([
      db.select().from(schema.users).where(isNull(schema.users.deletedAt)),
      db.select().from(schema.departments),
      db.select().from(schema.employeeStatus),
      db.select().from(schema.ownershipBackups),
      db.select().from(schema.handovers),
      db.select().from(schema.handoverItems),
      db.select().from(schema.nodeStakeholders),
      db.select().from(schema.knowledgeCaptures),
      db.select().from(schema.lessons),
    ]);
  const inventory = await buildInventory();
  const backupSet = new Set(backups.map((b) => `${b.resourceType}:${b.resourceId}`));
  // a node role has a deputy when any other stakeholder holds team/manager on
  // that node, or a handover item names a successor for it
  const deputies = new Map<string, boolean>();
  for (const s of stakeholders) {
    if (s.userId && (s.role === "manager" || s.role === "team")) {
      deputies.set(s.nodeId, true);
    }
  }
  for (const i of items) {
    // CR08 6.3: the recipient decision names the deputy (successor_user_id mirrors it)
    if ((i.successorUserId || i.recipientUserId) && i.resourceType === "node") deputies.set(i.resourceId, true);
  }
  // recent knowledge capture or Expert Insights lesson (12 months)
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const cutoff = yearAgo.toISOString();
  const recentCapture = new Set<string>();
  for (const l of lessons) {
    if (l.category === "expert" && l.createdAt >= cutoff) recentCapture.add(l.authorId);
  }
  const handoverByUser = new Map(handovers.map((h) => [h.userId, h]));
  for (const c of captures) {
    const h = handovers.find((x) => x.id === c.handoverId);
    if (h && c.createdAt >= cutoff) recentCapture.add(h.userId);
  }
  return {
    users,
    departments,
    statuses,
    backups,
    backupSet,
    handovers,
    handoverItems: items,
    stakeholders,
    deputies,
    recentCapture,
    inventory,
    handoverByUser,
  };
}

export type HrContext = Awaited<ReturnType<typeof loadContext>>;

export function readinessFor(ctx: HrContext, userId: string): Readiness {
  return readinessOf(
    ctx.inventory.get(userId) ?? [],
    ctx.backupSet,
    ctx.deputies,
    ctx.recentCapture.has(userId)
  );
}

/* ------------------------------------------------------------------ */
/* 5.5 risk rules                                                       */
/* ------------------------------------------------------------------ */

export async function recomputeHrRisks(): Promise<number> {
  const ctx = await loadContext();
  const [documents, indicators, indicatorValues, nodes, updates, deliverables, relationsRows] =
    await Promise.all([
      db.select().from(schema.documents).where(isNull(schema.documents.deletedAt)),
      db.select().from(schema.indicators),
      db.select().from(schema.indicatorValues),
      db.select().from(schema.strategyNodes),
      db.select().from(schema.statusUpdates),
      db.select().from(schema.deliverableMeta),
      db
        .select()
        .from(schema.relations)
        .where(and(eq(schema.relations.toType, "node"), eq(schema.relations.fromType, "document"))),
    ]);
  const now = new Date();
  const nowStr = nowIso();
  const userById = new Map(ctx.users.map((u) => [u.id, u]));
  const deptHead = new Map(ctx.departments.map((d) => [d.id, d.headUserId]));
  const hrAdmin = ctx.users.find((u) => u.email === "hr@enviroai.demo") ?? null;

  type NewRisk = {
    kind: string;
    severity: "low" | "medium" | "high" | "critical";
    departmentId: string | null;
    userId: string | null;
    resourceType: string | null;
    resourceId: string | null;
    title: string;
    detailEn: string;
    detailAr: string;
    ownerUserId: string | null;
  };
  const risks: NewRisk[] = [];
  const deptOf = (userId: string | null | undefined) =>
    userId ? userById.get(userId)?.departmentId ?? null : null;
  const actFor = (userId: string | null | undefined, departmentId: string | null) =>
    userId ?? (departmentId ? deptHead.get(departmentId) ?? null : null) ?? hrAdmin?.id ?? null;

  /* incomplete handovers (CR08 6.4: external persons carry no users row, so
     the name comes from the handover itself) */
  const [handoverInterviews, handoverPaths] = await Promise.all([
    db.select().from(schema.handoverInterviews),
    db.select().from(schema.handoverLearningPaths),
  ]);
  const handoverName = (h: (typeof ctx.handovers)[number]) => {
    const u = userById.get(h.userId);
    return { en: u?.nameEn ?? h.externalName ?? h.userId, ar: u?.nameAr ?? h.externalName ?? h.userId };
  };
  for (const h of ctx.handovers) {
    if (h.status === "complete" || !h.dueDate) continue;
    const due = new Date(h.dueDate);
    if (due > now) continue;
    const daysPast = Math.floor((now.getTime() - due.getTime()) / 86400000);
    const name = handoverName(h);
    risks.push({
      kind: "incomplete_handover",
      severity: daysPast > 30 ? "critical" : "high",
      departmentId: deptOf(h.userId),
      userId: h.personKind === "external" ? null : h.userId,
      resourceType: "handover",
      resourceId: h.id,
      title: `Handover of ${name.en} is ${daysPast} days past due`,
      detailEn: `The ${h.kind} handover was due on ${h.dueDate} and stands at ${h.completionPct}%.`,
      detailAr: `كان تسليم (${h.kind}) مستحقًا في ${h.dueDate} ولا يزال عند ${h.completionPct}%.`,
      ownerUserId: actFor(h.createdBy ?? deptHead.get(deptOf(h.userId) ?? "") ?? null, deptOf(h.userId)),
    });
  }

  /* CR08 6.4: an open handover with undecided items or a missing mandatory
     interview inside the last 14 days before the last working day is a gap;
     a closed handover lowers the register (it is skipped above and here) */
  for (const h of ctx.handovers) {
    if (h.status === "complete") continue;
    const day = h.lastWorkingDay ?? h.dueDate;
    if (!day) continue;
    const daysLeft = Math.ceil((new Date(day + "T23:59:59Z").getTime() - now.getTime()) / 86400000);
    if (daysLeft > 14) continue;
    const items = ctx.handoverItems.filter((i) => i.handoverId === h.id && i.inScope === 1 && i.status !== "not_needed");
    const undecided = items.filter((i) => !i.recipientKind).length;
    const interviewDone = handoverInterviews.some((iv) => iv.handoverId === h.id && iv.status === "complete");
    const unsigned = handoverPaths.filter((p) => p.handoverId === h.id && !p.signedOffAt).length;
    const gaps: string[] = [];
    if (undecided) gaps.push(`${undecided} items without a recipient decision`);
    if (h.interviewRequired === 1 && !interviewDone) gaps.push("the mandatory capture interview is not complete");
    if (unsigned) gaps.push(`${unsigned} recipients have not signed off`);
    if (!gaps.length) continue;
    const gapsAr: string[] = [];
    if (undecided) gapsAr.push(`${undecided} عناصر بلا قرار مستلم`);
    if (h.interviewRequired === 1 && !interviewDone) gapsAr.push("مقابلة التوثيق الإلزامية لم تكتمل");
    if (unsigned) gapsAr.push(`${unsigned} مستلمين لم يوقعوا`);
    const name = handoverName(h);
    risks.push({
      kind: "incomplete_handover",
      severity: daysLeft <= 1 ? "critical" : "high",
      departmentId: deptOf(h.userId),
      userId: h.personKind === "external" ? null : h.userId,
      resourceType: "handover_gap",
      resourceId: h.id,
      title: `Handover of ${name.en}: ${daysLeft <= 0 ? "last working day passed" : `${daysLeft} days left`} with open gaps`,
      detailEn: `${gaps.join("; ")}.`,
      detailAr: `${gapsAr.join("؛ ")}.`,
      ownerUserId: actFor(h.createdBy ?? deptHead.get(deptOf(h.userId) ?? "") ?? null, deptOf(h.userId)),
    });
  }

  /* outdated content: verified documents past review */
  for (const d of documents) {
    if (d.status !== "verified" || !d.reviewDueAt) continue;
    if (d.reviewDueAt >= nowStr) continue;
    const monthsPast =
      (now.getTime() - new Date(d.reviewDueAt).getTime()) / (30 * 86400000);
    risks.push({
      kind: "outdated_content",
      severity: monthsPast > 12 ? "high" : "medium",
      departmentId: d.departmentId ?? deptOf(d.ownerUserId),
      userId: d.ownerUserId,
      resourceType: "document",
      resourceId: d.id,
      title: `"${d.titleEn.slice(0, 60)}" is past its review date`,
      detailEn: `Verified content whose review was due ${d.reviewDueAt.slice(0, 10)}.`,
      detailAr: `محتوى موثق تجاوز موعد مراجعته المستحق في ${d.reviewDueAt.slice(0, 10)}.`,
      ownerUserId: actFor(d.ownerUserId, d.departmentId ?? null),
    });
  }

  /* outdated content: indicators missing two periods beyond frequency */
  const valuesByIndicator = new Map<string, string[]>();
  for (const v of indicatorValues) {
    (valuesByIndicator.get(v.indicatorId) ?? valuesByIndicator.set(v.indicatorId, []).get(v.indicatorId)!).push(
      v.period
    );
  }
  const periodMonths: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    annual: 12,
    biennial: 24,
  };
  for (const ind of indicators) {
    const periods = (valuesByIndicator.get(ind.id) ?? []).sort();
    const last = periods[periods.length - 1];
    if (!last) continue;
    const months = periodMonths[ind.frequency] ?? 12;
    const lastYear = Number(last.slice(0, 4));
    if (!Number.isFinite(lastYear)) continue;
    const approxLast = new Date(lastYear, last.includes("Q") ? Number(last.slice(6)) * 3 : 11, 1);
    const behindMonths = (now.getTime() - approxLast.getTime()) / (30 * 86400000);
    if (behindMonths > months * 2 + 6) {
      risks.push({
        kind: "outdated_content",
        severity: "medium",
        departmentId: ind.departmentId,
        userId: null,
        resourceType: "indicator",
        resourceId: ind.id,
        title: `Indicator "${ind.nameEn.slice(0, 50)}" has no value for two periods`,
        detailEn: `Last stored period: ${last}; frequency ${ind.frequency}.`,
        detailAr: `آخر فترة مسجلة: ${last}، والدورية ${ind.frequency}.`,
        ownerUserId: actFor(null, ind.departmentId),
      });
    }
  }

  /* missing knowledge */
  const nes3Nodes = nodes.filter((n) => n.nodeType === "initiative" || n.nodeType === "project");
  const deliverablesByNode = new Map<string, number>();
  for (const d of deliverables) {
    deliverablesByNode.set(d.nodeId, (deliverablesByNode.get(d.nodeId) ?? 0) + 1);
  }
  const lessonsByNode = new Map<string, number>();
  for (const l of await db.select().from(schema.lessons)) {
    if (l.nodeId) lessonsByNode.set(l.nodeId, (lessonsByNode.get(l.nodeId) ?? 0) + 1);
  }
  const docsByNode = new Map<string, number>();
  for (const r of relationsRows) {
    docsByNode.set(r.toId, (docsByNode.get(r.toId) ?? 0) + 1);
  }
  const leads = await db.select().from(schema.nodeLeads);
  const hasLead = new Set(leads.filter((l) => l.role === "lead").map((l) => l.nodeId));
  // a node counts as documented when it or anything beneath it carries
  // documents or deliverables (delivery paper lives on projects)
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId)
      (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n.id);
  }
  const subtreeHasDocs = (id: string): boolean => {
    if (docsByNode.get(id) || deliverablesByNode.get(id)) return true;
    for (const c of childrenOf.get(id) ?? []) if (subtreeHasDocs(c)) return true;
    return false;
  };
  for (const n of nes3Nodes) {
    const started = n.startDate ? new Date(n.startDate) : null;
    const sixMonthsIn = started
      ? new Date(started.getTime() + 182 * 86400000)
      : null;
    if (
      n.nodeType === "project" &&
      sixMonthsIn &&
      sixMonthsIn < now &&
      !deliverablesByNode.get(n.id) &&
      !lessonsByNode.get(n.id) &&
      n.status !== "not_started"
    ) {
      risks.push({
        kind: "missing_knowledge",
        severity: "medium",
        departmentId: deptOf(n.ownerUserId),
        userId: n.ownerUserId,
        resourceType: "node",
        resourceId: n.id,
        title: `${n.code ?? n.titleEn.slice(0, 40)} has no deliverables or lessons`,
        detailEn: `Active project started ${n.startDate}; nothing captured after six months.`,
        detailAr: `مشروع نشط بدأ في ${n.startDate} ولم يُوثَّق له شيء بعد ستة أشهر.`,
        ownerUserId: actFor(n.ownerUserId, deptOf(n.ownerUserId)),
      });
    }
    if (!hasLead.has(n.id)) {
      risks.push({
        kind: "missing_knowledge",
        severity: "high",
        departmentId: deptOf(n.ownerUserId),
        userId: null,
        resourceType: "node",
        resourceId: n.id,
        title: `${n.code ?? n.titleEn.slice(0, 40)} has no lead`,
        detailEn: "Initiative or project with no responsible department or entity.",
        detailAr: "مبادرة أو مشروع بلا إدارة أو جهة مسؤولة.",
        ownerUserId: actFor(null, deptOf(n.ownerUserId)),
      });
    } else if (n.status !== "not_started" && !subtreeHasDocs(n.id)) {
      risks.push({
        kind: "missing_knowledge",
        severity: "low",
        departmentId: deptOf(n.ownerUserId),
        userId: null,
        resourceType: "node",
        resourceId: n.id,
        title: `${n.code ?? n.titleEn.slice(0, 40)} has no linked documents`,
        detailEn: "No Institutional Memory documents or deliverables anywhere under this node.",
        detailAr: "لا توجد وثائق أو مخرجات من المستودع تحت هذا البند.",
        ownerUserId: actFor(null, deptOf(n.ownerUserId)),
      });
    }
  }

  /* overdue updates */
  const lastUpdate = new Map<string, string>();
  for (const u of updates) {
    const cur = lastUpdate.get(u.nodeId);
    if (!cur || u.createdAt > cur) lastUpdate.set(u.nodeId, u.createdAt);
  }
  for (const n of nes3Nodes) {
    if (n.nodeType !== "project" || n.status === "completed" || n.status === "not_started") continue;
    const last = lastUpdate.get(n.id);
    const ref = last ?? n.updatedAt;
    const days = (now.getTime() - new Date(ref).getTime()) / 86400000;
    if (days > 90) {
      risks.push({
        kind: "overdue_update",
        severity: days > 180 ? "high" : "medium",
        departmentId: deptOf(n.ownerUserId),
        userId: n.ownerUserId,
        resourceType: "node",
        resourceId: n.id,
        title: `${n.code ?? n.titleEn.slice(0, 40)}: no status update in ${Math.floor(days)} days`,
        detailEn: last ? `Last update ${last.slice(0, 10)}.` : "No update ever posted.",
        detailAr: last ? `آخر تحديث في ${last.slice(0, 10)}.` : "لم يُنشر أي تحديث بعد.",
        ownerUserId: actFor(n.ownerUserId, deptOf(n.ownerUserId)),
      });
    }
  }

  /* single point of failure + leaving (CR08 6.4: an open handover counts as leaving) */
  const statusByUser = new Map(ctx.statuses.map((s) => [s.userId, s.status]));
  const openHandoverUsers = new Set(ctx.handovers.filter((h) => h.status !== "complete" && h.personKind !== "external").map((h) => h.userId));
  for (const [userId, items] of ctx.inventory) {
    const owned = items.filter((i) => i.itemKind !== "node_role");
    const unbacked = owned.filter((i) => !ctx.backupSet.has(`${i.resourceType}:${i.resourceId}`));
    const verifiedUnbacked = unbacked.filter((i) => i.verified);
    const criticalUnbacked = unbacked.filter((i) => i.critical);
    if (verifiedUnbacked.length >= 10 || criticalUnbacked.length >= 3) {
      const leaving = statusByUser.get(userId) === "leaving" || openHandoverUsers.has(userId);
      const u = userById.get(userId);
      risks.push({
        kind: "single_point_of_failure",
        severity: leaving ? "critical" : "high",
        departmentId: deptOf(userId),
        userId,
        resourceType: "user",
        resourceId: userId,
        title: `${u?.nameEn ?? userId} is a single point of failure${leaving ? " and is leaving" : ""}`,
        detailEn: `Sole owner of ${verifiedUnbacked.length} verified and ${criticalUnbacked.length} critical items with no backup.`,
        detailAr: `المالك الوحيد لعدد ${verifiedUnbacked.length} من العناصر الموثقة و${criticalUnbacked.length} من العناصر الحرجة دون بديل.`,
        ownerUserId: actFor(deptHead.get(deptOf(userId) ?? "") ?? null, deptOf(userId)),
      });
    }
  }

  /* no backup on critical items */
  for (const [userId, items] of ctx.inventory) {
    for (const i of items) {
      if (!i.critical || i.itemKind === "node_role") continue;
      if (ctx.backupSet.has(`${i.resourceType}:${i.resourceId}`)) continue;
      risks.push({
        kind: "no_backup",
        severity: "medium",
        departmentId: deptOf(userId),
        userId,
        resourceType: i.resourceType,
        resourceId: i.resourceId,
        title: `Critical item without a backup owner: ${i.title.slice(0, 60)}`,
        detailEn: "Assign a named backup owner for this item.",
        detailAr: "عيِّن مالكًا بديلًا مسمى لهذا العنصر.",
        ownerUserId: userId,
      });
    }
  }

  /* replace unresolved rows; resolved rows stay for history */
  const existing = await db.select().from(schema.hrRisks);
  const resolvedKeys = new Set(
    existing
      .filter((r) => r.resolvedAt)
      .map((r) => `${r.kind}:${r.resourceType}:${r.resourceId}:${r.userId ?? ""}`)
  );
  await db.delete(schema.hrRisks).where(isNull(schema.hrRisks.resolvedAt));
  let openCount = 0;
  for (const r of risks) {
    // a resolved risk does not immediately reappear (resolution stands until
    // the next material change; keep the register calm)
    if (resolvedKeys.has(`${r.kind}:${r.resourceType}:${r.resourceId}:${r.userId ?? ""}`)) continue;
    await db.insert(schema.hrRisks).values({
      id: newId(),
      kind: r.kind,
      severity: r.severity,
      departmentId: r.departmentId,
      userId: r.userId,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      title: r.title,
      detailEn: r.detailEn,
      detailAr: r.detailAr,
      ownerUserId: r.ownerUserId,
      detectedAt: nowStr,
    });
    openCount++;
  }

  /* handover due-date reminders (T-14, T-7, T-1) moved to the handover_nightly
     job in src/server/services/handover.ts (CR08 6.4), which also reaches the
     leaving person and every recipient and never repeats within a day. */

  return openCount;
}

/* ------------------------------------------------------------------ */
/* the handover engine (5.6.4)                                          */
/* ------------------------------------------------------------------ */

/** CR05 signature, kept for the People page and the CR05 seed; CR08 6.1
    rebuilt the engine in src/server/services/handover.ts and this delegates
    to it (the CR05 kinds map onto the internal kinds, the successor onto the
    default recipient). */
export async function startHandover(
  actor: CurrentUser,
  input: {
    userId: string;
    kind: "leaving" | "transferring" | "leave";
    dueDate: string | null;
    successorDefaultUserId: string | null;
  }
): Promise<{ id: string; items: number } | null> {
  const { startHandover2 } = await import("@/server/services/handover");
  const created = await startHandover2(actor, {
    person: { userId: input.userId },
    kind: input.kind === "leave" ? "long_leave" : input.kind,
    reason: null,
    lastWorkingDay: input.dueDate,
    dueDate: input.dueDate,
    recipient: { mode: input.successorDefaultUserId ? "person" : "per_item", defaultRecipientUserId: input.successorDefaultUserId },
    notes: null,
  });
  return { id: created.id, items: created.items };
}

/** CR08 6.4: completion counts in-scope items only and never closes a
    handover by itself; closing is the administrator's explicit act
    (closeHandover), which stamps completed_at. */
export async function refreshHandoverCompletion(handoverId: string): Promise<number> {
  const items = (
    await db
      .select()
      .from(schema.handoverItems)
      .where(eq(schema.handoverItems.handoverId, handoverId))
  ).filter((i) => i.inScope === 1 && i.status !== "not_needed");
  const done = items.filter((i) => i.status !== "pending").length;
  const pct = items.length ? Math.round((100 * done) / items.length) : 0;
  const [h] = await db.select().from(schema.handovers).where(eq(schema.handovers.id, handoverId)).limit(1);
  if (!h) return pct;
  if (h.status === "complete" || h.completedAt) {
    await db.update(schema.handovers).set({ completionPct: 100, status: "complete", updatedAt: nowIso() }).where(eq(schema.handovers.id, handoverId));
    return 100;
  }
  const overdue = h.dueDate ? h.dueDate < nowIso().slice(0, 10) : false;
  const status = overdue ? "overdue" : pct > 0 ? "in_progress" : "open";
  await db
    .update(schema.handovers)
    .set({ completionPct: pct, status, updatedAt: nowIso() })
    .where(eq(schema.handovers.id, handoverId));
  return pct;
}

/* ------------------------------------------------------------------ */
/* page read models                                                     */
/* ------------------------------------------------------------------ */

export async function getHrOverview(user: CurrentUser) {
  const scope = hrScopeFor(user);
  if (!scope) return null;
  const ctx = await loadContext();
  const risks = await db.select().from(schema.hrRisks).where(isNull(schema.hrRisks.resolvedAt));
  const scopedUsers = ctx.users.filter(
    (u) => scope.all || u.departmentId === scope.departmentId
  );
  const scopedRisks = risks.filter((r) => scope.all || r.departmentId === scope.departmentId);
  const scopedHandovers = ctx.handovers.filter((h) => {
    const u = ctx.users.find((x) => x.id === h.userId);
    return scope.all || u?.departmentId === scope.departmentId;
  });

  // organisation readiness: ownership-weighted average over people
  let weighted = 0;
  let weight = 0;
  const readinessByUser = new Map<string, Readiness>();
  for (const u of scopedUsers) {
    const r = readinessFor(ctx, u.id);
    readinessByUser.set(u.id, r);
    const w = Math.max(1, r.ownedCount);
    weighted += r.score * w;
    weight += w;
  }
  const readiness = weight ? Math.round(weighted / weight) : 100;
  // department continuity uses its own risks (5.4); the organisation ring is
  // the average of department scores so one big register cannot floor it
  const perDeptContinuity = ctx.departments
    .filter((d) => scope.all || d.id === scope.departmentId)
    .map((d) => continuityOf(risks.filter((r) => r.departmentId === d.id)).score);
  const continuity = continuityOf(scopedRisks);
  const continuityScore = perDeptContinuity.length
    ? Math.round(perDeptContinuity.reduce((s, v) => s + v, 0) / perDeptContinuity.length)
    : continuity.score;
  const handoversComplete = scopedHandovers.length
    ? Math.round(
        (100 * scopedHandovers.filter((h) => h.status === "complete").length) /
          scopedHandovers.length
      )
    : 100;

  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topRisks = [...scopedRisks]
    .sort(
      (a, b) =>
        (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) ||
        a.detectedAt.localeCompare(b.detectedAt)
    )
    .slice(0, 10);

  const heat = ctx.departments
    .filter((d) => scope.all || d.id === scope.departmentId)
    .map((d) => {
      const deptRisks = risks.filter((r) => r.departmentId === d.id);
      return {
        id: d.id,
        code: d.code,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        continuity: continuityOf(deptRisks).score,
        openRisks: deptRisks.length,
      };
    });

  const userLite = (id: string | null) => {
    if (!id) return null;
    const u = ctx.users.find((x) => x.id === id);
    return u ? { id: u.id, nameEn: u.nameEn, nameAr: u.nameAr, avatarColor: u.avatarColor } : null;
  };

  return {
    scope,
    rings: { readiness, continuity: continuityScore, handoversComplete },
    continuityCounts: continuity.counts,
    riskCounts: {
      critical: scopedRisks.filter((r) => r.severity === "critical").length,
      high: scopedRisks.filter((r) => r.severity === "high").length,
      medium: scopedRisks.filter((r) => r.severity === "medium").length,
      low: scopedRisks.filter((r) => r.severity === "low").length,
    },
    heat,
    topRisks: topRisks.map((r) => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      title: r.title,
      detailEn: r.detailEn,
      detailAr: r.detailAr,
      detectedAt: r.detectedAt,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      owner: userLite(r.ownerUserId),
      departmentId: r.departmentId,
    })),
    handovers: {
      open: scopedHandovers.filter((h) => h.status !== "complete").length,
      total: scopedHandovers.length,
    },
  };
}

export type HrOverview = NonNullable<Awaited<ReturnType<typeof getHrOverview>>>;

export async function getHrDepartments(user: CurrentUser) {
  const scope = hrScopeFor(user);
  if (!scope) return null;
  const ctx = await loadContext();
  const risks = await db.select().from(schema.hrRisks).where(isNull(schema.hrRisks.resolvedAt));
  const [documents, lessons, deliverables, leads] = await Promise.all([
    db.select().from(schema.documents).where(isNull(schema.documents.deletedAt)),
    db.select().from(schema.lessons),
    db.select().from(schema.deliverableMeta),
    db.select().from(schema.nodeLeads),
  ]);
  const nodes = await db.select().from(schema.strategyNodes);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const docById = new Map(documents.map((d) => [d.id, d]));

  const departments = ctx.departments
    .filter((d) => scope.all || d.id === scope.departmentId)
    .map((d) => {
      const people = ctx.users.filter((u) => u.departmentId === d.id);
      const deptDocs = documents.filter((x) => x.departmentId === d.id);
      const verified = deptDocs.filter((x) => x.status === "verified").length;
      const stale = deptDocs.filter(
        (x) => x.reviewDueAt && x.reviewDueAt < nowIso()
      ).length;
      const deptLessons = lessons.filter((l) =>
        people.some((p) => p.id === l.authorId)
      ).length;
      const deptDeliverables = deliverables.filter((del) => {
        const doc = docById.get(del.documentId);
        return doc?.departmentId === d.id;
      }).length;
      // key projects: nodes this department leads, plus stakeholder roles
      const ledNodeIds = leads
        .filter((l) => l.leadKind === "department" && l.departmentId === d.id)
        .map((l) => l.nodeId);
      const roleNodeIds = ctx.stakeholders
        .filter(
          (s) =>
            s.userId &&
            people.some((p) => p.id === s.userId) &&
            ["sponsor", "owner", "manager"].includes(s.role)
        )
        .map((s) => s.nodeId);
      const keyProjects = [...new Set([...ledNodeIds, ...roleNodeIds])]
        .map((id) => nodeById.get(id))
        .filter((n) => n && (n.nodeType === "project" || n.nodeType === "initiative"))
        .slice(0, 6)
        .map((n) => ({
          id: n!.id,
          code: n!.code,
          titleEn: n!.titleEn,
          titleAr: n!.titleAr,
          status: n!.status,
        }));
      const deptRisks = risks.filter((r) => r.departmentId === d.id);
      let weighted = 0;
      let weight = 0;
      for (const p of people) {
        const r = readinessFor(ctx, p.id);
        const w = Math.max(1, r.ownedCount);
        weighted += r.score * w;
        weight += w;
      }
      const byType = new Map<string, number>();
      for (const doc of deptDocs) {
        const key = doc.knowledgeTypeTermId ?? "other";
        byType.set(key, (byType.get(key) ?? 0) + 1);
      }
      const head = d.headUserId ? ctx.users.find((u) => u.id === d.headUserId) : null;
      const openHandovers = ctx.handovers.filter((h) => {
        const u = ctx.users.find((x) => x.id === h.userId);
        return u?.departmentId === d.id && h.status !== "complete";
      }).length;
      return {
        id: d.id,
        code: d.code,
        nameEn: d.nameEn,
        nameAr: d.nameAr,
        responsibilitiesEn: d.responsibilitiesEn,
        responsibilitiesAr: d.responsibilitiesAr,
        head: head
          ? { id: head.id, nameEn: head.nameEn, nameAr: head.nameAr, avatarColor: head.avatarColor }
          : null,
        headcount: people.length,
        repository: {
          documents: deptDocs.length,
          verifiedShare: deptDocs.length ? verified / deptDocs.length : 0,
          staleShare: deptDocs.length ? stale / deptDocs.length : 0,
          lessons: deptLessons,
          deliverables: deptDeliverables,
        },
        keyProjects,
        readiness: weight ? Math.round(weighted / weight) : 100,
        continuity: continuityOf(deptRisks).score,
        openHandovers,
        openRisks: deptRisks.length,
        people: people.map((p) => ({
          id: p.id,
          nameEn: p.nameEn,
          nameAr: p.nameAr,
          avatarColor: p.avatarColor,
          positionEn: p.positionEn,
          positionAr: p.positionAr,
          readiness: readinessFor(ctx, p.id).score,
          status: ctx.statuses.find((s) => s.userId === p.id)?.status ?? "active",
        })),
        risks: deptRisks.slice(0, 8).map((r) => ({
          id: r.id,
          kind: r.kind,
          severity: r.severity,
          title: r.title,
        })),
        canEdit: scope.all || user.departmentId === d.id,
      };
    });
  return { scope, departments };
}

export type HrDepartments = NonNullable<Awaited<ReturnType<typeof getHrDepartments>>>;

export async function getHrPeople(user: CurrentUser) {
  const scope = hrScopeFor(user);
  if (!scope) return null;
  const ctx = await loadContext();
  const [expertsRows, domains, terms, backups] = await Promise.all([
    db.select().from(schema.experts),
    db.select().from(schema.expertDomains),
    db.select().from(schema.taxonomyTerms),
    db.select().from(schema.ownershipBackups),
  ]);
  const termById = new Map(terms.map((t) => [t.id, t]));
  const expertByUser = new Map(expertsRows.filter((e) => e.userId).map((e) => [e.userId!, e]));
  const nodes = await db.select().from(schema.strategyNodes);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const backupsByUser = new Map<string, number>();
  for (const b of backups) {
    backupsByUser.set(b.backupUserId, (backupsByUser.get(b.backupUserId) ?? 0) + 1);
  }

  const people = ctx.users
    .filter((u) => scope.all || u.departmentId === scope.departmentId)
    .map((u) => {
      const readiness = readinessFor(ctx, u.id);
      const items = ctx.inventory.get(u.id) ?? [];
      const owned = items.filter((i) => i.itemKind !== "node_role");
      const byKind = new Map<string, { count: number; verified: number }>();
      for (const i of owned) {
        const cur = byKind.get(i.itemKind) ?? { count: 0, verified: 0 };
        cur.count++;
        if (i.verified) cur.verified++;
        byKind.set(i.itemKind, cur);
      }
      const expert = expertByUser.get(u.id);
      const expertise = expert
        ? domains
            .filter((d) => d.expertId === expert.id)
            .map((d) => termById.get(d.termId))
            .filter(Boolean)
            .slice(0, 4)
            .map((t) => ({ id: t!.id, nameEn: t!.nameEn, nameAr: t!.nameAr }))
        : [];
      const roles = ctx.stakeholders
        .filter((s) => s.userId === u.id)
        .map((s) => {
          const n = nodeById.get(s.nodeId);
          return n
            ? {
                nodeId: n.id,
                code: n.code,
                titleEn: n.titleEn,
                titleAr: n.titleAr,
                role: s.role,
              }
            : null;
        })
        .filter(Boolean) as {
        nodeId: string;
        code: string | null;
        titleEn: string;
        titleAr: string;
        role: string;
      }[];
      const dept = ctx.departments.find((d) => d.id === u.departmentId);
      const handover = ctx.handoverByUser.get(u.id) ?? null;
      const ownedBackedUp = owned.filter((i) =>
        ctx.backupSet.has(`${i.resourceType}:${i.resourceId}`)
      ).length;
      return {
        id: u.id,
        nameEn: u.nameEn,
        nameAr: u.nameAr,
        email: u.email,
        avatarColor: u.avatarColor,
        positionEn: u.positionEn,
        positionAr: u.positionAr,
        department: dept
          ? { id: dept.id, code: dept.code, nameEn: dept.nameEn, nameAr: dept.nameAr }
          : null,
        status: ctx.statuses.find((s) => s.userId === u.id)?.status ?? "active",
        readiness,
        ownedByKind: [...byKind.entries()].map(([kind, v]) => ({ kind, ...v })),
        ownedTotal: owned.length,
        backedUpShare: owned.length ? ownedBackedUp / owned.length : 1,
        backupFor: backupsByUser.get(u.id) ?? 0,
        expertise,
        roles: roles.slice(0, 6),
        handover: handover
          ? { id: handover.id, status: handover.status, completionPct: handover.completionPct, dueDate: handover.dueDate }
          : null,
      };
    });
  return { scope, people, departments: ctx.departments };
}

export type HrPeople = NonNullable<Awaited<ReturnType<typeof getHrPeople>>>;

/** CR08 6: the HR handover list reads the rebuilt records (kept as the
    CR05 export name; the pages import listHandovers directly). */
export async function getHrHandovers(user: CurrentUser) {
  const { listHandovers } = await import("@/server/services/handover");
  const data = await listHandovers(user);
  if (!data) return null;
  const users = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, departmentId: schema.users.departmentId })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  return {
    scope: hrScopeFor(user) ?? { all: false, departmentId: user.departmentId },
    handovers: data.rows.map((h) => ({
      id: h.id,
      kind: h.kind,
      status: h.status,
      dueDate: h.dueDate,
      completionPct: h.items.pct,
      createdAt: h.createdAt,
      person: { id: h.person.id, nameEn: h.person.nameEn, nameAr: h.person.nameAr, avatarColor: h.person.avatarColor },
      successor: h.defaultRecipient ? { id: h.defaultRecipient.id, nameEn: h.defaultRecipient.nameEn, nameAr: h.defaultRecipient.nameAr } : null,
      items: h.items.total,
    })),
    users,
  };
}

/** CR08 6: one handover for an administrator in scope (the rebuilt detail). */
export async function getHrHandover(user: CurrentUser, id: string) {
  const { getHandoverForViewer } = await import("@/server/services/handover");
  const detail = await getHandoverForViewer(user, id);
  if (!detail || detail.viewer !== "admin") return null;
  return detail;
}

export async function getHrRisks(user: CurrentUser) {
  const scope = hrScopeFor(user);
  if (!scope) return null;
  const ctx = await loadContext();
  const rows = await db.select().from(schema.hrRisks);
  const scoped = rows.filter((r) => scope.all || r.departmentId === scope.departmentId);
  const open = scoped.filter((r) => !r.resolvedAt);
  // 12-week trend of open risks (detected before week end, not resolved by it)
  const weeks: { week: string; open: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const end = new Date();
    end.setDate(end.getDate() - w * 7);
    const endIso = end.toISOString();
    weeks.push({
      week: endIso.slice(0, 10),
      open: scoped.filter(
        (r) => r.detectedAt <= endIso && (!r.resolvedAt || r.resolvedAt > endIso)
      ).length,
    });
  }
  const userLite = (id: string | null) => {
    if (!id) return null;
    const u = ctx.users.find((x) => x.id === id);
    return u ? { id: u.id, nameEn: u.nameEn, nameAr: u.nameAr } : null;
  };
  return {
    scope,
    departments: ctx.departments,
    weeks,
    risks: scoped
      .sort((a, b) => (a.resolvedAt ? 1 : 0) - (b.resolvedAt ? 1 : 0) || b.detectedAt.localeCompare(a.detectedAt))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        title: r.title,
        detailEn: r.detailEn,
        detailAr: r.detailAr,
        departmentId: r.departmentId,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        owner: userLite(r.ownerUserId),
        detectedAt: r.detectedAt,
        resolvedAt: r.resolvedAt,
        resolutionNote: r.resolutionNote,
      })),
    openCount: open.length,
  };
}
