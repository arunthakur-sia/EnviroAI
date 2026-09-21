// CR08 6: the rebuilt handover process.
//
//   6.1 start: who may start, the kinds (internal leaving | transferring |
//       long_leave, external engagement_ending), the person (a user, an
//       External Experts row, or one added on the spot), the inventory and
//       the notifications.
//   6.2 the leaving person's workspace: the checklist by category, "Add to
//       handover", the required note per item, the AI capture interview,
//       the time-limited access link for externals.
//   6.3 the recipient decision per item: to a person (the AI Handover
//       Learning Path, Mark as understood, questions, sign-off) or to the
//       system (AI filing proposals, the filing report, approve, apply).
//   6.4 close, the explicit cut-off, the handover report archived into the
//       Institutional Memory, points.
//
// Storage conventions (no schema change beyond 0007_cr08.sql):
//   * `handovers.kind` keeps the CR05 vocabulary (leaving | transferring |
//     leave); the CR08 kind is derived: person_kind = external reads as
//     engagement_ending and leave reads as long_leave.
//   * `handovers.user_id` is NOT NULL, so an external handover stores the
//     experts row id there (the same value as expert_id). Every read goes
//     through personOf(), never through a bare users join.
//   * `handover_items.successor_user_id` mirrors recipient_user_id so the
//     CR05 readiness rules (deputies) keep reading.
//   * Interview transcripts are never audited and never reach Ask NPC for
//     anyone but the person and the administrators in scope.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { dataPath } from "@/server/paths";
import { getUserById, type CurrentUser } from "@/server/auth/session";
import { newId, nowIso, todayIso } from "@/lib/ids";
import { notify, record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { aiLive, callJson } from "@/server/ai/client";
import { hrScopeFor } from "@/server/services/hr";
import { CATEGORIES, ITEM_KIND_OF, type ItemCategory } from "@/lib/handover-constants";
import type { BiText, ReportDocumentModel, SectionContent, SourceItem } from "@/server/reports/spec";

/* ------------------------------------------------------------------ */
/* types                                                                */
/* ------------------------------------------------------------------ */

export type HandoverKind = "leaving" | "transferring" | "long_leave" | "engagement_ending";
export type StoredKind = "leaving" | "transferring" | "leave";
export type PersonKind = "employee" | "external";
export type RecipientKind = "person" | "system";
export type FilingStatus = "none" | "proposed" | "approved" | "applied";

/* the categories live in a client-safe module so client components can read
   them without pulling this server module (and next/headers) into the bundle */
export { CATEGORIES, ITEM_KIND_OF } from "@/lib/handover-constants";
export type { ItemCategory } from "@/lib/handover-constants";

export type InventoryItem = {
  category: ItemCategory;
  itemKind: string;
  resourceType: string;
  resourceId: string;
  title: string;
  titleAr: string | null;
  nodeId: string | null;
  critical: boolean;
};

export type UserLite = { id: string; nameEn: string; nameAr: string; avatarColor: string; email?: string | null };

export type PersonRef = {
  kind: PersonKind;
  /** the users id for an employee, the experts id for an external */
  id: string;
  userId: string | null;
  expertId: string | null;
  nameEn: string;
  nameAr: string;
  email: string | null;
  avatarColor: string;
  organisationEn: string | null;
  organisationAr: string | null;
  positionEn: string | null;
  positionAr: string | null;
  departmentId: string | null;
  departmentCode: string | null;
  departmentNameEn: string | null;
  departmentNameAr: string | null;
};

export type PersonInput =
  | { userId: string }
  | { expertId: string }
  | { external: { name: string; email: string; organisation: string } };

export type RecipientDecision = {
  mode: "person" | "system" | "per_item";
  defaultRecipientUserId: string | null;
};

export type StartInput = {
  person: PersonInput;
  kind: HandoverKind;
  reason: string | null;
  lastWorkingDay: string | null;
  dueDate: string | null;
  recipient: RecipientDecision;
  notes: string | null;
  /** internal handovers default to a mandatory interview; externals to optional */
  interviewRequired?: boolean;
};

export type TranscriptEntry = { role: "ai" | "person"; text: string; en?: string; ar?: string; at: string };
type BiLine = { en: string; ar: string };
export type InterviewStructured = {
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  statusEn: string;
  statusAr: string;
  decisions: BiLine[];
  contacts: BiLine[];
  pitfalls: BiLine[];
  locations: BiLine[];
  adviceEn: string;
  adviceAr: string;
  answers: number;
  live: boolean;
};

export type FilingProposal = {
  location: {
    module: "vault" | "strategy" | "lessons" | "organisation" | "experts" | "statistics" | "council";
    unitId: string | null;
    unitCode: string | null;
    unitNameEn: string | null;
    unitNameAr: string | null;
    shelf: string | null;
    nodeId: string | null;
    category: string | null;
  };
  custodianUserId: string | null;
  custodianNameEn: string | null;
  custodianNameAr: string | null;
  rationaleEn: string;
  rationaleAr: string;
  proposedAt: string;
  live: boolean;
};

export type PathRef = { id: string; titleEn: string; titleAr: string; href: string };
export type PathModule = {
  id: string;
  topic: string;
  topicAr: string;
  refType: "node" | "council_node" | "category" | "topic";
  refId: string | null;
  summaryEn: string;
  summaryAr: string;
  documents: PathRef[];
  lessons: PathRef[];
  notes: string[];
  itemIds: string[];
  episodeId: string | null;
  episodeNote: string | null;
  checkQuestion: { en: string; ar: string; answerHint: string; answerHintAr: string };
  understoodAt: string | null;
  /** Bumped whenever the written text changes shape, so a seed or a job can
      tell a stored module apart from one the current code would write. */
  textVersion?: number;
};
export const PATH_TEXT_VERSION = 2;
export type PathProgress = { understood: number; total: number; pct: number; updatedAt: string };

export class HandoverError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public extra?: Record<string, unknown>
  ) {
    super(code);
  }
}

type HandoverRow = typeof schema.handovers.$inferSelect;
type ItemRow = typeof schema.handoverItems.$inferSelect;
type InterviewRow = typeof schema.handoverInterviews.$inferSelect;
type PathRow = typeof schema.handoverLearningPaths.$inferSelect;

/* ------------------------------------------------------------------ */
/* small helpers                                                        */
/* ------------------------------------------------------------------ */

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

const bi = (en: string, ar: string): BiText => ({ en, ar });

export function storedKind(kind: HandoverKind): StoredKind {
  if (kind === "long_leave") return "leave";
  if (kind === "engagement_ending") return "leaving";
  return kind;
}

export function displayKind(row: { kind: string; personKind: string }): HandoverKind {
  if (row.personKind === "external") return "engagement_ending";
  if (row.kind === "leave") return "long_leave";
  return (row.kind === "transferring" ? "transferring" : "leaving") as HandoverKind;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date.slice(0, 10) + "T23:59:59Z").getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

async function userLite(id: string | null | undefined): Promise<UserLite | null> {
  if (!id) return null;
  const [u] = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, avatarColor: schema.users.avatarColor, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return u ?? null;
}

async function usersLite(ids: string[]): Promise<Map<string, UserLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, avatarColor: schema.users.avatarColor, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}

async function hrAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id, roleName: schema.roles.nameEn })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(isNull(schema.users.deletedAt), eq(schema.roles.nameEn, "HR Admin")));
  return rows.map((r) => r.id);
}

/** Resolves the person of a handover (an employee or an external). */
export async function personOf(h: Pick<HandoverRow, "userId" | "personKind" | "expertId" | "externalName" | "externalEmail">): Promise<PersonRef> {
  if (h.personKind === "external") {
    const expertId = h.expertId ?? h.userId;
    const [e] = await db.select().from(schema.experts).where(eq(schema.experts.id, expertId)).limit(1);
    return {
      kind: "external",
      id: expertId,
      userId: null,
      expertId,
      nameEn: e?.nameEn ?? h.externalName ?? "External",
      nameAr: e?.nameAr ?? h.externalName ?? "خبير خارجي",
      email: e?.email ?? h.externalEmail ?? null,
      avatarColor: e?.avatarColor ?? "gulf",
      organisationEn: e?.organisationEn ?? null,
      organisationAr: e?.organisationAr ?? e?.organisationEn ?? null,
      positionEn: e?.positionEn ?? null,
      positionAr: e?.positionAr ?? null,
      departmentId: null,
      departmentCode: null,
      departmentNameEn: null,
      departmentNameAr: null,
    };
  }
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, h.userId)).limit(1);
  const [unit] = u?.departmentId
    ? await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, u.departmentId)).limit(1)
    : [];
  return {
    kind: "employee",
    id: h.userId,
    userId: h.userId,
    expertId: null,
    nameEn: u?.nameEn ?? "Unknown",
    nameAr: u?.nameAr ?? "غير معروف",
    email: u?.email ?? null,
    avatarColor: u?.avatarColor ?? "maroon",
    organisationEn: null,
    organisationAr: null,
    positionEn: u?.positionEn ?? null,
    positionAr: u?.positionAr ?? null,
    departmentId: u?.departmentId ?? null,
    departmentCode: unit?.code ?? null,
    departmentNameEn: unit?.nameEn ?? null,
    departmentNameAr: unit?.nameAr ?? null,
  };
}

/** The locale-less app path of an item's resource, when one exists. */
export function hrefOf(resourceType: string, resourceId: string, nodeId?: string | null): string | null {
  switch (resourceType) {
    case "document":
      return `/vault/${resourceId}`;
    case "lesson":
      return `/lessons?lesson=${resourceId}`;
    case "node":
      return `/strategy/${resourceId}`;
    case "council_node":
      return `/council-strategy?node=${resourceId}`;
    case "kpi":
      return nodeId ? `/strategy/${nodeId}` : "/strategy";
    case "council_indicator":
      return "/council-strategy";
    case "expert":
      return `/experts/${resourceId}`;
    case "expert_request":
      return "/experts";
    case "community":
      return "/experts";
    case "collection":
      return `/vault?collection=${resourceId}`;
    case "org_unit":
      return `/organisation?unit=${resourceId}`;
    case "report":
      return `/reports/${resourceId}`;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 6.2 the inventory                                                    */
/* ------------------------------------------------------------------ */

/** Stakeholder role labels. Item titles are stored once and read by the
    successor, so the raw enum ("team") must never reach the screen. */
const ROLE_LABEL: Record<string, { en: string; ar: string }> = {
  sponsor: { en: "Sponsor", ar: "الراعي" },
  owner: { en: "Owner", ar: "المالك" },
  manager: { en: "Manager", ar: "مدير المشروع" },
  team: { en: "Team member", ar: "عضو الفريق" },
  expert: { en: "Expert", ar: "خبير" },
  external_partner: { en: "External partner", ar: "شريك خارجي" },
};

/** Exported for the seed's one-off repair of rows written before CR08 6. */
export function roleLabel(role: string): { en: string; ar: string } {
  return ROLE_LABEL[role] ?? { en: role.replace(/_/g, " "), ar: role.replace(/_/g, " ") };
}

/** The English label an item title carries back to Arabic. */
const ROLE_EN_TO_AR = new Map(Object.values(ROLE_LABEL).map((l) => [l.en, l.ar]));

/** Everything a person owns, in the categories of CR08 6.2. */
export async function buildInventoryFor(person: { userId?: string | null; expertId?: string | null }): Promise<InventoryItem[]> {
  const out: InventoryItem[] = [];
  const seen = new Set<string>();
  const push = (i: Omit<InventoryItem, "itemKind">) => {
    const key = `${i.category}:${i.resourceType}:${i.resourceId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...i, itemKind: ITEM_KIND_OF[i.category] });
  };
  const nodes = await db.select().from(schema.strategyNodes);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const nodeTitle = (n: { code: string | null; titleEn: string; titleAr: string }) => ({
    en: `${n.code ? n.code + " " : ""}${n.titleEn}`,
    ar: `${n.code ? n.code + " " : ""}${n.titleAr}`,
  });
  const councilNodes = await db.select().from(schema.councilNodes);
  const councilById = new Map(councilNodes.map((n) => [n.id, n]));
  const deliverables = await db.select().from(schema.deliverableMeta);
  const documentsById = new Map<string, typeof schema.documents.$inferSelect>();
  const loadDocs = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !documentsById.has(id));
    if (!missing.length) return;
    const rows = await db.select().from(schema.documents).where(inArray(schema.documents.id, missing));
    for (const d of rows) documentsById.set(d.id, d);
  };
  const stakeholders = person.userId
    ? await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.userId, person.userId))
    : person.expertId
      ? await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.expertId, person.expertId))
      : [];

  if (person.userId) {
    const userId = person.userId;
    const [docs, unitLinks, terms, dims] = await Promise.all([
      db.select().from(schema.documents).where(and(eq(schema.documents.ownerUserId, userId), isNull(schema.documents.deletedAt))),
      db.select().from(schema.documentUnitLinks),
      db.select().from(schema.taxonomyTerms),
      db.select().from(schema.taxonomyDimensions),
    ]);
    const ktDim = dims.find((d) => d.code === "knowledge_type");
    const reportTermIds = new Set(terms.filter((t) => t.dimensionId === ktDim?.id && t.code === "report").map((t) => t.id));
    const linkedDocIds = new Set(unitLinks.map((l) => l.documentId));
    const deliverableByDoc = new Map(deliverables.map((d) => [d.documentId, d]));
    for (const d of docs) {
      documentsById.set(d.id, d);
      const del = deliverableByDoc.get(d.id);
      const category: ItemCategory = linkedDocIds.has(d.id)
        ? "policy"
        : del
          ? "deliverable"
          : d.knowledgeTypeTermId && reportTermIds.has(d.knowledgeTypeTermId)
            ? "report"
            : "document";
      push({
        category,
        resourceType: "document",
        resourceId: d.id,
        title: d.titleEn,
        titleAr: d.titleAr,
        nodeId: del?.nodeId ?? null,
        critical: d.classificationLevel >= 3 || category === "policy",
      });
    }
    // module reports the person requested
    const reports = await db.select().from(schema.reports).where(eq(schema.reports.requestedBy, userId));
    for (const r of reports) {
      if (!r.typeId || r.status === "failed") continue;
      push({
        category: "report",
        resourceType: "report",
        resourceId: r.id,
        title: r.titleEn ?? r.title,
        titleAr: r.titleAr ?? r.title,
        nodeId: null,
        critical: false,
      });
    }
    // lessons authored
    const lessons = await db.select().from(schema.lessons).where(eq(schema.lessons.authorId, userId));
    for (const l of lessons) {
      push({ category: "lesson", resourceType: "lesson", resourceId: l.id, title: l.titleEn, titleAr: l.titleAr, nodeId: l.nodeId, critical: false });
    }
    // owned nodes (NDS and Council)
    for (const n of nodes) {
      if (n.ownerUserId !== userId) continue;
      const t = nodeTitle(n);
      push({ category: "project_role", resourceType: "node", resourceId: n.id, title: t.en, titleAr: t.ar, nodeId: n.id, critical: n.nodeType === "target" || n.nodeType === "outcome" });
    }
    for (const n of councilNodes) {
      if (n.ownerUserId !== userId) continue;
      const t = nodeTitle(n);
      push({ category: "project_role", resourceType: "council_node", resourceId: n.id, title: t.en, titleAr: t.ar, nodeId: n.id, critical: false });
    }
    // KPI ownership and council indicators
    const kpis = await db.select().from(schema.kpis).where(eq(schema.kpis.ownerUserId, userId));
    for (const k of kpis) {
      push({ category: "indicator", resourceType: "kpi", resourceId: k.id, title: k.nameEn, titleAr: k.nameAr, nodeId: k.nodeId, critical: true });
    }
    const councilInd = await db.select().from(schema.councilIndicators).where(eq(schema.councilIndicators.responsibleUserId, userId));
    for (const c of councilInd) {
      push({ category: "council_indicator", resourceType: "council_indicator", resourceId: c.id, title: `${c.code ? c.code + " " : ""}${c.nameEn}`, titleAr: `${c.code ? c.code + " " : ""}${c.nameAr}`, nodeId: c.nodeId, critical: true });
    }
    // open expert requests (asked by the person, or waiting on their profile)
    const [ownProfile] = await db.select().from(schema.experts).where(eq(schema.experts.userId, userId)).limit(1);
    const requests = await db.select().from(schema.expertRequests).where(eq(schema.expertRequests.status, "open"));
    for (const r of requests) {
      if (r.requesterId !== userId && r.expertId !== ownProfile?.id) continue;
      push({ category: "expert_request", resourceType: "expert_request", resourceId: r.id, title: r.subject, titleAr: r.subject, nodeId: null, critical: false });
    }
    // expert profiles the person maintains (other people's)
    const profiles = await db.select().from(schema.experts).where(eq(schema.experts.ownerUserId, userId));
    for (const e of profiles) {
      if (e.userId === userId) continue;
      push({ category: "expert_profile", resourceType: "expert", resourceId: e.id, title: e.nameEn, titleAr: e.nameAr, nodeId: null, critical: false });
    }
    // communities led, collections owned
    const communities = await db.select().from(schema.communities).where(eq(schema.communities.leadUserId, userId));
    for (const c of communities) {
      push({ category: "community", resourceType: "community", resourceId: c.id, title: c.nameEn, titleAr: c.nameAr, nodeId: null, critical: false });
    }
    const collections = await db.select().from(schema.collections).where(eq(schema.collections.ownerUserId, userId));
    for (const c of collections) {
      push({ category: "collection", resourceType: "collection", resourceId: c.id, title: c.nameEn, titleAr: c.nameAr, nodeId: null, critical: false });
    }
    // org roles: unit head or deputy
    const units = await db.select().from(schema.orgUnits);
    const members = await db.select().from(schema.orgUnitMembers).where(eq(schema.orgUnitMembers.userId, userId));
    for (const u of units) {
      const member = members.find((m) => m.unitId === u.id && (m.roleInUnit === "head" || m.roleInUnit === "deputy"));
      if (u.headUserId !== userId && !member) continue;
      const role = u.headUserId === userId || member?.roleInUnit === "head" ? "Head" : "Deputy";
      push({ category: "org_role", resourceType: "org_unit", resourceId: u.id, title: `${role}: ${u.nameEn}`, titleAr: `${role === "Head" ? "رئيس" : "نائب رئيس"}: ${u.nameAr}`, nodeId: null, critical: true });
    }
    // tacit topics from accepted expertise domains
    if (ownProfile) {
      const domains = await db.select().from(schema.expertDomains).where(eq(schema.expertDomains.expertId, ownProfile.id));
      const termById = new Map(terms.map((t) => [t.id, t]));
      for (const d of domains.slice(0, 4)) {
        const term = termById.get(d.termId);
        if (!term) continue;
        push({ category: "tacit_topic", resourceType: "term", resourceId: term.id, title: term.nameEn, titleAr: term.nameAr, nodeId: null, critical: false });
      }
    }
  }

  /* stakeholder roles (employees and externals) and the deliverables on those projects */
  const roleNodeIds = new Set<string>();
  for (const s of stakeholders) {
    if (s.nodeKind === "council") {
      const n = councilById.get(s.nodeId);
      if (!n) continue;
      const t = nodeTitle(n);
      push({ category: "stakeholder_role", resourceType: "council_node", resourceId: n.id, title: `${roleLabel(s.role).en}: ${t.en}`, titleAr: `${roleLabel(s.role).ar}: ${t.ar}`, nodeId: n.id, critical: s.role === "owner" || s.role === "manager" });
    } else {
      const n = nodeById.get(s.nodeId);
      if (!n) continue;
      roleNodeIds.add(n.id);
      const t = nodeTitle(n);
      push({ category: "stakeholder_role", resourceType: "node", resourceId: n.id, title: `${roleLabel(s.role).en}: ${t.en}`, titleAr: `${roleLabel(s.role).ar}: ${t.ar}`, nodeId: n.id, critical: s.role === "owner" || s.role === "manager" });
    }
  }
  if (person.userId) for (const n of nodes) if (n.ownerUserId === person.userId) roleNodeIds.add(n.id);
  const projectDeliverables = deliverables.filter((d) => roleNodeIds.has(d.nodeId));
  await loadDocs(projectDeliverables.map((d) => d.documentId));
  for (const d of projectDeliverables) {
    const doc = documentsById.get(d.documentId);
    if (!doc || doc.deletedAt) continue;
    push({ category: "deliverable", resourceType: "document", resourceId: doc.id, title: `${d.deliverableCode}: ${doc.titleEn}`, titleAr: `${d.deliverableCode}: ${doc.titleAr}`, nodeId: d.nodeId, critical: false });
  }

  if (person.expertId && !person.userId) {
    const engagements = await db.select().from(schema.expertEngagements).where(eq(schema.expertEngagements.expertId, person.expertId));
    for (const e of engagements) {
      push({ category: "other", resourceType: "expert_engagement", resourceId: e.id, title: e.title, titleAr: e.title, nodeId: e.linkedNodeId, critical: false });
    }
    const domains = await db.select().from(schema.expertDomains).where(eq(schema.expertDomains.expertId, person.expertId));
    if (domains.length) {
      const terms = await db.select().from(schema.taxonomyTerms).where(inArray(schema.taxonomyTerms.id, domains.map((d) => d.termId)));
      for (const t of terms.slice(0, 4)) {
        push({ category: "tacit_topic", resourceType: "term", resourceId: t.id, title: t.nameEn, titleAr: t.nameAr, nodeId: null, critical: false });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 6.1 who may start                                                    */
/* ------------------------------------------------------------------ */

/** Nodes (NDS and Council) the actor owns or manages. */
async function ownedNodeIds(actor: CurrentUser): Promise<Set<string>> {
  const ids = new Set<string>();
  const owned = await db.select({ id: schema.strategyNodes.id }).from(schema.strategyNodes).where(eq(schema.strategyNodes.ownerUserId, actor.id));
  for (const n of owned) ids.add(n.id);
  const council = await db.select({ id: schema.councilNodes.id }).from(schema.councilNodes).where(eq(schema.councilNodes.ownerUserId, actor.id));
  for (const n of council) ids.add(n.id);
  const roles = await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.userId, actor.id));
  for (const r of roles) if (["owner", "manager", "sponsor"].includes(r.role)) ids.add(r.nodeId);
  return ids;
}

export async function canStartFor(actor: CurrentUser, person: PersonRef): Promise<boolean> {
  const role = actor.role.nameEn;
  if (role === "Super Admin" || role === "HR Admin") return true;
  if (person.kind === "employee") {
    return role === "Department Head" && Boolean(actor.departmentId) && person.departmentId === actor.departmentId;
  }
  // externals: department heads and project owners on the expert's projects
  if (!person.expertId) return false;
  const rows = await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.expertId, person.expertId));
  if (!rows.length) return role === "Department Head";
  const mine = await ownedNodeIds(actor);
  if (rows.some((r) => mine.has(r.nodeId))) return true;
  if (role === "Department Head" && actor.departmentId) {
    const leads = await db.select().from(schema.nodeLeads).where(eq(schema.nodeLeads.departmentId, actor.departmentId));
    const led = new Set(leads.map((l) => l.nodeId));
    return rows.some((r) => led.has(r.nodeId));
  }
  return false;
}

/** The project owner of an external's first project (the CR08 6.3 default recipient). */
async function projectOwnerFor(expertId: string): Promise<string | null> {
  const rows = await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.expertId, expertId));
  for (const r of rows) {
    const owners = await db.select().from(schema.nodeStakeholders).where(and(eq(schema.nodeStakeholders.nodeId, r.nodeId), eq(schema.nodeStakeholders.role, "owner")));
    const withUser = owners.find((o) => o.userId);
    if (withUser?.userId) return withUser.userId;
    if (r.nodeKind === "council") {
      const [n] = await db.select().from(schema.councilNodes).where(eq(schema.councilNodes.id, r.nodeId)).limit(1);
      if (n?.ownerUserId) return n.ownerUserId;
    } else {
      const [n] = await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.id, r.nodeId)).limit(1);
      if (n?.ownerUserId) return n.ownerUserId;
      const managers = owners.length ? [] : await db.select().from(schema.nodeStakeholders).where(and(eq(schema.nodeStakeholders.nodeId, r.nodeId), eq(schema.nodeStakeholders.role, "manager")));
      const m = managers.find((x) => x.userId);
      if (m?.userId) return m.userId;
    }
  }
  return null;
}

async function resolvePerson(actor: CurrentUser, input: PersonInput): Promise<PersonRef> {
  if ("userId" in input) {
    const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, input.userId), isNull(schema.users.deletedAt))).limit(1);
    if (!u) throw new HandoverError("person_not_found", 404);
    return personOf({ userId: u.id, personKind: "employee", expertId: null, externalName: null, externalEmail: null });
  }
  if ("expertId" in input) {
    const [e] = await db.select().from(schema.experts).where(eq(schema.experts.id, input.expertId)).limit(1);
    if (!e) throw new HandoverError("person_not_found", 404);
    if (e.userId) {
      // an NPC employee's profile: the handover is internal
      return personOf({ userId: e.userId, personKind: "employee", expertId: null, externalName: null, externalEmail: null });
    }
    return personOf({ userId: e.id, personKind: "external", expertId: e.id, externalName: e.nameEn, externalEmail: e.email });
  }
  const ext = input.external;
  const name = ext.name.trim();
  if (!name) throw new HandoverError("invalid", 400);
  const id = newId();
  await db.insert(schema.experts).values({
    id,
    userId: null,
    type: "consultant",
    nameEn: name,
    nameAr: name,
    organisationEn: ext.organisation.trim() || null,
    organisationAr: ext.organisation.trim() || null,
    email: ext.email.trim() || null,
    availability: "limited",
    clearanceLevel: 2,
    ownerUserId: actor.id,
    isVerified: 0,
    visibilityClassification: 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(actor.id, "external_expert_added", "expert", id, { via: "handover" });
  return personOf({ userId: id, personKind: "external", expertId: id, externalName: name, externalEmail: ext.email });
}

/* ------------------------------------------------------------------ */
/* 6.1 start                                                            */
/* ------------------------------------------------------------------ */

/** Recomputes an item's status from its decision, note and filing state. */
function statusFor(item: Pick<ItemRow, "status" | "recipientKind" | "recipientUserId" | "note" | "filingStatus" | "inScope">): string {
  if (item.status === "not_needed" || item.status === "captured") return item.status;
  if (item.recipientKind === "system") return item.filingStatus === "applied" ? "captured" : "pending";
  if (item.recipientKind === "person" && item.recipientUserId && (item.note ?? "").trim()) return "reassigned";
  return "pending";
}

/** CR05 5.7, kept by CR08: the leaving person earns for each item of their own
    handover that reaches a done state. The engine pays once per item and caps
    the day at fifty, so both call sites can ask without counting. An external
    handover has no account to pay, and `user_id` there holds an experts row. */
async function awardItemCompleted(handoverId: string, itemId: string): Promise<void> {
  const [h] = await db.select().from(schema.handovers).where(eq(schema.handovers.id, handoverId)).limit(1);
  if (!h || (h.personKind ?? "employee") !== "employee" || !h.userId) return;
  await record({
    userId: h.userId,
    type: "handover_item_completed",
    resourceType: "handover_item",
    resourceId: itemId,
  });
}

async function syncItem(itemId: string): Promise<ItemRow | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) return null;
  const next = statusFor(item);
  if (next !== item.status || (next !== "pending" && !item.doneAt)) {
    await db
      .update(schema.handoverItems)
      .set({ status: next, doneAt: next === "pending" ? null : item.doneAt ?? nowIso() })
      .where(eq(schema.handoverItems.id, itemId));
    if (item.status === "pending" && next !== "pending" && next !== "not_needed") {
      await awardItemCompleted(item.handoverId, itemId);
    }
  }
  const [fresh] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  return fresh ?? null;
}

export async function refreshCompletion(handoverId: string): Promise<number> {
  const { refreshHandoverCompletion } = await import("@/server/services/hr");
  return refreshHandoverCompletion(handoverId);
}

export async function startHandover2(actor: CurrentUser, input: StartInput): Promise<{ id: string; items: number; person: PersonRef }> {
  const person = await resolvePerson(actor, input.person);
  if (!(await canStartFor(actor, person))) throw new HandoverError("forbidden", 403);
  const kind: HandoverKind = person.kind === "external" ? "engagement_ending" : input.kind === "engagement_ending" ? "leaving" : input.kind;
  const open = await db
    .select({ id: schema.handovers.id, status: schema.handovers.status })
    .from(schema.handovers)
    .where(and(eq(schema.handovers.userId, person.id), ne(schema.handovers.status, "complete")));
  if (open.length) throw new HandoverError("already_open", 409, { id: open[0].id });

  let defaultRecipient = input.recipient.mode === "system" ? null : input.recipient.defaultRecipientUserId;
  if (person.kind === "external" && !defaultRecipient && input.recipient.mode !== "system") {
    defaultRecipient = await projectOwnerFor(person.expertId!);
  }
  if (defaultRecipient) {
    const r = await userLite(defaultRecipient);
    if (!r) throw new HandoverError("recipient_not_found", 404);
    if (defaultRecipient === person.userId) throw new HandoverError("recipient_is_person", 400);
  }
  const lastWorkingDay = input.lastWorkingDay?.slice(0, 10) ?? null;
  const dueDate = input.dueDate?.slice(0, 10) ?? lastWorkingDay;
  const id = newId();
  const now = nowIso();
  await db.insert(schema.handovers).values({
    id,
    userId: person.id,
    kind: storedKind(kind),
    createdBy: actor.id,
    createdAt: now,
    dueDate,
    successorDefaultUserId: defaultRecipient,
    status: "open",
    completionPct: 0,
    personKind: person.kind,
    expertId: person.expertId,
    externalName: person.kind === "external" ? person.nameEn : null,
    externalEmail: person.kind === "external" ? person.email : null,
    reason: input.reason?.trim() || null,
    lastWorkingDay,
    notes: input.notes?.trim() || null,
    interviewRequired: input.interviewRequired === undefined ? (person.kind === "employee" ? 1 : 0) : input.interviewRequired ? 1 : 0,
    updatedAt: now,
  });

  const inventory = await buildInventoryFor({ userId: person.userId, expertId: person.expertId });
  let count = 0;
  for (const i of inventory) {
    const toPerson = input.recipient.mode === "person" && defaultRecipient;
    await db.insert(schema.handoverItems).values({
      id: newId(),
      handoverId: id,
      itemKind: i.itemKind,
      resourceType: i.resourceType,
      resourceId: i.resourceId,
      title: i.title,
      successorUserId: toPerson ? defaultRecipient : null,
      status: "pending",
      note: null,
      category: i.category,
      inScope: 1,
      recipientKind: input.recipient.mode === "system" ? "system" : toPerson ? "person" : null,
      recipientUserId: toPerson ? defaultRecipient : null,
      filingStatus: "none",
      addedBy: actor.id,
      createdAt: now,
    });
    count++;
  }

  /* notifications: the person, the default recipient, the unit head, HR Admins */
  const link = `/hr/handovers/${id}`;
  const targets = new Set<string>();
  if (person.userId) targets.add(person.userId);
  if (defaultRecipient) targets.add(defaultRecipient);
  if (person.departmentId) {
    const [unit] = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, person.departmentId)).limit(1);
    if (unit?.headUserId) targets.add(unit.headUserId);
  }
  for (const hr of await hrAdminIds()) targets.add(hr);
  targets.delete(actor.id);
  const kindWord: Record<HandoverKind, [string, string]> = {
    leaving: ["leaving", "مغادرة"],
    transferring: ["transfer", "نقل"],
    long_leave: ["long leave", "إجازة طويلة"],
    engagement_ending: ["engagement ending", "انتهاء تكليف"],
  };
  for (const to of targets) {
    const isPerson = to === person.userId;
    const isRecipient = to === defaultRecipient;
    await notify(
      to,
      isPerson ? "handover_mine" : isRecipient ? "handover_recipient" : "handover_started",
      isPerson
        ? "Your handover has started"
        : isRecipient
          ? `A handover has started for you: ${person.nameEn}`
          : `Handover started: ${person.nameEn} (${kindWord[kind][0]})`,
      isPerson
        ? "بدأ تسليم مهامك"
        : isRecipient
          ? `بدأ تسليم مهام إليك من ${person.nameAr}`
          : `بدأ تسليم المهام: ${person.nameAr} (${kindWord[kind][1]})`,
      isPerson ? "/handover/mine" : isRecipient ? `/handover/${id}` : link,
      {
        en: `${count} items in the inventory${lastWorkingDay ? `, last working day ${lastWorkingDay}` : ""}${dueDate ? `, due ${dueDate}` : ""}.`,
        ar: `${count} عنصرًا في الجرد${lastWorkingDay ? `، وآخر يوم عمل ${lastWorkingDay}` : ""}${dueDate ? `، والاستحقاق ${dueDate}` : ""}.`,
      }
    );
  }
  await audit(actor.id, "handover_started", "handover", id, { kind, personKind: person.kind, items: count });
  await refreshCompletion(id);
  return { id, items: count, person };
}

/* ------------------------------------------------------------------ */
/* reads: the detail model                                              */
/* ------------------------------------------------------------------ */

export type ItemView = {
  id: string;
  category: ItemCategory;
  itemKind: string;
  resourceType: string;
  resourceId: string;
  title: string;
  note: string | null;
  status: string;
  inScope: boolean;
  recipientKind: RecipientKind | null;
  recipient: UserLite | null;
  filingStatus: FilingStatus;
  filingProposal: FilingProposal | null;
  understoodAt: string | null;
  doneAt: string | null;
  href: string | null;
  addedBy: string | null;
  createdAt: string | null;
};

export type InterviewView = {
  id: string;
  topic: string;
  topicRefType: string | null;
  topicRefId: string | null;
  status: string;
  answers: number;
  transcript: TranscriptEntry[] | null;
  structured: InterviewStructured | null;
  insightLessonId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InterviewTopic = { key: string; topic: string; topicAr: string; refType: "node" | "council_node" | "topic"; refId: string | null; interviewId: string | null; status: "pending" | "in_progress" | "complete" };

export type RecipientView = {
  user: UserLite;
  items: number;
  understood: number;
  path: { id: string; modules: PathModule[]; progress: PathProgress; signedOffAt: string | null } | null;
};

export type CloseCheck = { code: "items_decided" | "items_filed" | "interview" | "sign_off"; ok: boolean; count: number; total: number };
export type Readiness = { ok: boolean; checks: CloseCheck[] };

export type HandoverDetail = {
  id: string;
  kind: HandoverKind;
  personKind: PersonKind;
  status: string;
  reason: string | null;
  notes: string | null;
  lastWorkingDay: string | null;
  dueDate: string | null;
  daysToLastWorkingDay: number | null;
  createdAt: string;
  completedAt: string | null;
  cutOffAt: string | null;
  overrideReason: string | null;
  overrideBy: UserLite | null;
  interviewRequired: boolean;
  reportDocumentId: string | null;
  completionPct: number;
  person: PersonRef;
  defaultRecipient: UserLite | null;
  createdBy: UserLite | null;
  progress: { items: { done: number; total: number; pct: number }; interviews: { complete: number; total: number; pct: number }; paths: { signedOff: number; total: number } };
  categories: { code: ItemCategory; items: ItemView[] }[];
  items: ItemView[];
  interviews: InterviewView[];
  topics: InterviewTopic[];
  recipients: RecipientView[];
  filing: { proposed: number; approved: number; applied: number; pending: number; items: ItemView[] };
  access: { active: boolean; expiresAt: string | null; revokedAt: string | null; created: boolean };
  readiness: Readiness;
  required: string[];
  viewer: "admin" | "person" | "recipient" | "token";
};

function itemView(i: ItemRow, users: Map<string, UserLite>): ItemView {
  return {
    id: i.id,
    category: (i.category ?? "other") as ItemCategory,
    itemKind: i.itemKind,
    resourceType: i.resourceType,
    resourceId: i.resourceId,
    title: i.title,
    note: i.note,
    status: i.status,
    inScope: i.inScope === 1,
    recipientKind: (i.recipientKind as RecipientKind | null) ?? null,
    recipient: i.recipientUserId ? users.get(i.recipientUserId) ?? null : null,
    filingStatus: (i.filingStatus as FilingStatus) ?? "none",
    filingProposal: parse<FilingProposal | null>(i.filingProposalJson, null),
    understoodAt: i.understoodAt,
    doneAt: i.doneAt,
    href: hrefOf(i.resourceType, i.resourceId),
    addedBy: i.addedBy,
    createdAt: i.createdAt,
  };
}

export function readinessOf(items: ItemRow[], interviews: InterviewRow[], paths: PathRow[], interviewRequired: boolean): Readiness {
  const inScope = items.filter((i) => i.inScope === 1 && i.status !== "not_needed");
  const personItems = inScope.filter((i) => i.recipientKind === "person");
  const systemItems = inScope.filter((i) => i.recipientKind === "system");
  const undecided = inScope.filter((i) => !i.recipientKind && i.status !== "captured");
  const decided = personItems.filter((i) => i.recipientUserId).length;
  const filed = systemItems.filter((i) => i.filingStatus === "applied").length;
  const recipients = new Set(personItems.map((i) => i.recipientUserId).filter(Boolean) as string[]);
  const signed = [...recipients].filter((r) => paths.find((p) => p.recipientUserId === r)?.signedOffAt).length;
  const complete = interviews.filter((i) => i.status === "complete").length;
  const checks: CloseCheck[] = [
    { code: "items_decided", ok: undecided.length === 0 && decided === personItems.length, count: decided, total: personItems.length + undecided.length },
    { code: "items_filed", ok: filed === systemItems.length, count: filed, total: systemItems.length },
    { code: "interview", ok: !interviewRequired || complete >= 1, count: complete, total: interviewRequired ? Math.max(1, interviews.length) : interviews.length },
    { code: "sign_off", ok: signed === recipients.size, count: signed, total: recipients.size },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

async function topicsFor(h: HandoverRow, items: ItemRow[], interviews: InterviewRow[]): Promise<InterviewTopic[]> {
  const topics: InterviewTopic[] = [];
  const seen = new Set<string>();
  const nodeItems = items.filter((i) => i.inScope === 1 && (i.resourceType === "node" || i.resourceType === "council_node"));
  const nodeIds = [...new Set(nodeItems.filter((i) => i.resourceType === "node").map((i) => i.resourceId))];
  const councilIds = [...new Set(nodeItems.filter((i) => i.resourceType === "council_node").map((i) => i.resourceId))];
  const nodes = nodeIds.length ? await db.select().from(schema.strategyNodes).where(inArray(schema.strategyNodes.id, nodeIds)) : [];
  const council = councilIds.length ? await db.select().from(schema.councilNodes).where(inArray(schema.councilNodes.id, councilIds)) : [];
  const findInterview = (refType: string, refId: string | null, topic: string) =>
    interviews.find((x) => (refId ? x.topicRefType === refType && x.topicRefId === refId : x.topic === topic)) ?? null;
  for (const n of nodes) {
    if (n.nodeType !== "project" && n.nodeType !== "initiative") continue;
    const key = `node:${n.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const topic = `${n.code ? n.code + " " : ""}${n.titleEn}`;
    const iv = findInterview("node", n.id, topic);
    topics.push({ key, topic, topicAr: `${n.code ? n.code + " " : ""}${n.titleAr}`, refType: "node", refId: n.id, interviewId: iv?.id ?? null, status: (iv?.status as InterviewTopic["status"]) ?? "pending" });
  }
  for (const n of council) {
    if (n.level !== "project") continue;
    const key = `council_node:${n.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const topic = `${n.code ? n.code + " " : ""}${n.titleEn}`;
    const iv = findInterview("council_node", n.id, topic);
    topics.push({ key, topic, topicAr: `${n.code ? n.code + " " : ""}${n.titleAr}`, refType: "council_node", refId: n.id, interviewId: iv?.id ?? null, status: (iv?.status as InterviewTopic["status"]) ?? "pending" });
  }
  for (const t of items.filter((i) => i.inScope === 1 && i.category === "tacit_topic")) {
    const key = `topic:${t.id}`;
    const iv = findInterview("topic", t.id, t.title);
    topics.push({ key, topic: t.title, topicAr: t.title, refType: "topic", refId: t.id, interviewId: iv?.id ?? null, status: (iv?.status as InterviewTopic["status"]) ?? "pending" });
  }
  // interviews on free topics the person opened themselves
  for (const iv of interviews) {
    if (topics.some((t) => t.interviewId === iv.id)) continue;
    topics.push({ key: `interview:${iv.id}`, topic: iv.topic, topicAr: iv.topic, refType: "topic", refId: iv.topicRefId, interviewId: iv.id, status: iv.status as InterviewTopic["status"] });
  }
  if (!topics.length) {
    const general = interviews.find((x) => x.topicRefType === "general");
    topics.push({ key: "general", topic: "General handover", topicAr: "تسليم عام", refType: "topic", refId: null, interviewId: general?.id ?? null, status: (general?.status as InterviewTopic["status"]) ?? "pending" });
  }
  void h;
  return topics;
}

export async function buildDetail(h: HandoverRow, viewer: HandoverDetail["viewer"], viewerUserId: string | null): Promise<HandoverDetail> {
  const [items, interviews, paths, person] = await Promise.all([
    db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id)).orderBy(asc(schema.handoverItems.category), asc(schema.handoverItems.title)),
    db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.handoverId, h.id)).orderBy(asc(schema.handoverInterviews.createdAt)),
    db.select().from(schema.handoverLearningPaths).where(eq(schema.handoverLearningPaths.handoverId, h.id)),
    personOf(h),
  ]);
  const userIds = [
    ...items.map((i) => i.recipientUserId),
    h.successorDefaultUserId,
    h.createdBy,
    h.overrideBy,
    ...paths.map((p) => p.recipientUserId),
  ].filter(Boolean) as string[];
  const users = await usersLite(userIds);
  const views = items.map((i) => itemView(i, users));
  const inScope = items.filter((i) => i.inScope === 1 && i.status !== "not_needed");
  const done = inScope.filter((i) => i.status !== "pending").length;
  const complete = interviews.filter((i) => i.status === "complete").length;
  const interviewTotal = Math.max(interviews.length, h.interviewRequired ? 1 : 0);
  const readiness = readinessOf(items, interviews, paths, h.interviewRequired === 1);

  const recipientIds = [...new Set(items.filter((i) => i.recipientKind === "person" && i.recipientUserId).map((i) => i.recipientUserId!))];
  for (const p of paths) if (!recipientIds.includes(p.recipientUserId)) recipientIds.push(p.recipientUserId);
  const recipients: RecipientView[] = recipientIds
    .map((rid) => {
      const u = users.get(rid);
      if (!u) return null;
      const mine = items.filter((i) => i.recipientUserId === rid && i.inScope === 1);
      const p = paths.find((x) => x.recipientUserId === rid);
      return {
        user: u,
        items: mine.length,
        understood: mine.filter((i) => i.understoodAt).length,
        path: p
          ? { id: p.id, modules: parse<PathModule[]>(p.modulesJson, []), progress: parse<PathProgress>(p.progressJson, { understood: 0, total: 0, pct: 0, updatedAt: p.updatedAt }), signedOffAt: p.signedOffAt }
          : null,
      };
    })
    .filter(Boolean) as RecipientView[];

  const systemItems = views.filter((i) => i.recipientKind === "system" && i.inScope);
  const categories = CATEGORIES.map((code) => ({ code, items: views.filter((i) => i.category === code) })).filter((c) => c.items.length);
  const required: string[] = [];
  if (inScope.some((i) => !i.recipientKind)) required.push("decide_recipients");
  if (inScope.some((i) => i.recipientKind === "person" && !(i.note ?? "").trim())) required.push("write_notes");
  if (h.interviewRequired === 1 && complete === 0) required.push("complete_interview");
  if (systemItems.some((i) => i.filingStatus === "none")) required.push("propose_filing");
  if (systemItems.some((i) => i.filingStatus === "proposed")) required.push("approve_filing");
  if (systemItems.some((i) => i.filingStatus === "approved")) required.push("apply_filing");
  if (recipients.some((r) => !r.path)) required.push("build_paths");
  if (recipients.some((r) => r.path && !r.path.signedOffAt)) required.push("sign_off");

  const showTranscripts = viewer === "admin" || viewer === "person" || viewer === "token";
  const now = nowIso();
  return {
    id: h.id,
    kind: displayKind(h),
    personKind: h.personKind as PersonKind,
    status: h.status,
    reason: h.reason,
    notes: h.notes,
    lastWorkingDay: h.lastWorkingDay,
    dueDate: h.dueDate,
    daysToLastWorkingDay: daysUntil(h.lastWorkingDay ?? h.dueDate),
    createdAt: h.createdAt,
    completedAt: h.completedAt,
    cutOffAt: h.cutOffAt,
    overrideReason: h.overrideReason,
    overrideBy: h.overrideBy ? users.get(h.overrideBy) ?? null : null,
    interviewRequired: h.interviewRequired === 1,
    reportDocumentId: h.reportDocumentId,
    completionPct: h.completionPct,
    person,
    defaultRecipient: h.successorDefaultUserId ? users.get(h.successorDefaultUserId) ?? null : null,
    createdBy: h.createdBy ? users.get(h.createdBy) ?? null : null,
    progress: {
      items: { done, total: inScope.length, pct: inScope.length ? Math.round((100 * done) / inScope.length) : 0 },
      interviews: { complete, total: interviewTotal, pct: interviewTotal ? Math.round((100 * complete) / interviewTotal) : 0 },
      paths: { signedOff: paths.filter((p) => p.signedOffAt).length, total: recipients.length },
    },
    categories,
    items: views,
    interviews: interviews.map((i) => ({
      id: i.id,
      topic: i.topic,
      topicRefType: i.topicRefType,
      topicRefId: i.topicRefId,
      status: i.status,
      answers: parse<TranscriptEntry[]>(i.transcriptJson, []).filter((e) => e.role === "person").length,
      transcript: showTranscripts ? parse<TranscriptEntry[]>(i.transcriptJson, []) : null,
      structured: parse<InterviewStructured | null>(i.structuredJson, null),
      insightLessonId: i.insightLessonId,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
    topics: await topicsFor(h, items, interviews),
    recipients: viewer === "recipient" && viewerUserId ? recipients.filter((r) => r.user.id === viewerUserId) : recipients,
    filing: {
      proposed: systemItems.filter((i) => i.filingStatus === "proposed").length,
      approved: systemItems.filter((i) => i.filingStatus === "approved").length,
      applied: systemItems.filter((i) => i.filingStatus === "applied").length,
      pending: systemItems.filter((i) => i.filingStatus === "none").length,
      items: systemItems,
    },
    access: {
      active: Boolean(h.accessTokenHash) && !h.accessRevokedAt && Boolean(h.accessExpiresAt && h.accessExpiresAt > now),
      expiresAt: h.accessExpiresAt,
      revokedAt: h.accessRevokedAt,
      created: Boolean(h.accessTokenHash),
    },
    readiness,
    required,
    viewer,
  };
}

async function loadHandover(id: string): Promise<HandoverRow> {
  const [h] = await db.select().from(schema.handovers).where(eq(schema.handovers.id, id)).limit(1);
  if (!h) throw new HandoverError("not_found", 404);
  return h;
}

/** Administrators in scope: HR scope, plus the creator (a project owner). */
export async function isAdminFor(user: CurrentUser, h: HandoverRow): Promise<boolean> {
  const scope = hrScopeFor(user);
  if (scope?.all) return true;
  if (h.createdBy === user.id) return true;
  if (scope && !scope.all) {
    const person = await personOf(h);
    if (person.kind === "employee") return person.departmentId === scope.departmentId;
    return await canStartFor(user, person);
  }
  return false;
}

export async function getHandoverForViewer(user: CurrentUser, id: string): Promise<HandoverDetail | null> {
  const h = await loadHandover(id).catch(() => null);
  if (!h) return null;
  if (await isAdminFor(user, h)) return buildDetail(h, "admin", user.id);
  if (h.personKind === "employee" && h.userId === user.id) return buildDetail(h, "person", user.id);
  const [asRecipient] = await db
    .select({ id: schema.handoverItems.id })
    .from(schema.handoverItems)
    .where(and(eq(schema.handoverItems.handoverId, id), eq(schema.handoverItems.recipientUserId, user.id)))
    .limit(1);
  const [path] = await db
    .select({ id: schema.handoverLearningPaths.id })
    .from(schema.handoverLearningPaths)
    .where(and(eq(schema.handoverLearningPaths.handoverId, id), eq(schema.handoverLearningPaths.recipientUserId, user.id)))
    .limit(1);
  if (asRecipient || path || h.successorDefaultUserId === user.id) return buildDetail(h, "recipient", user.id);
  return null;
}

/** My Handover: the open handover where the user is the person (the latest closed one otherwise). */
export async function getMyHandover(user: CurrentUser): Promise<HandoverDetail | null> {
  const rows = await db
    .select()
    .from(schema.handovers)
    .where(and(eq(schema.handovers.userId, user.id), eq(schema.handovers.personKind, "employee")))
    .orderBy(desc(schema.handovers.createdAt));
  const h = rows.find((r) => r.status !== "complete") ?? rows[0];
  if (!h) return null;
  return buildDetail(h, "person", user.id);
}

/** Handovers where the user is a recipient (the banner and the recipient page). */
export async function getMyRecipientHandovers(user: CurrentUser): Promise<{ id: string; person: PersonRef; kind: HandoverKind; lastWorkingDay: string | null; status: string; progress: PathProgress | null; signedOffAt: string | null; items: number }[]> {
  const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.recipientUserId, user.id));
  const paths = await db.select().from(schema.handoverLearningPaths).where(eq(schema.handoverLearningPaths.recipientUserId, user.id));
  const ids = [...new Set([...items.map((i) => i.handoverId), ...paths.map((p) => p.handoverId)])];
  if (!ids.length) return [];
  const rows = await db.select().from(schema.handovers).where(inArray(schema.handovers.id, ids)).orderBy(desc(schema.handovers.createdAt));
  const out = [];
  for (const h of rows) {
    const p = paths.find((x) => x.handoverId === h.id);
    out.push({
      id: h.id,
      person: await personOf(h),
      kind: displayKind(h),
      lastWorkingDay: h.lastWorkingDay,
      status: h.status,
      progress: p ? parse<PathProgress | null>(p.progressJson, null) : null,
      signedOffAt: p?.signedOffAt ?? null,
      items: items.filter((i) => i.handoverId === h.id && i.inScope === 1).length,
    });
  }
  return out;
}

export type HandoverListRow = {
  id: string;
  kind: HandoverKind;
  personKind: PersonKind;
  status: string;
  person: PersonRef;
  recipients: UserLite[];
  defaultRecipient: UserLite | null;
  items: { done: number; total: number; pct: number };
  interviews: { complete: number; total: number; pct: number };
  dueDate: string | null;
  lastWorkingDay: string | null;
  daysToLastWorkingDay: number | null;
  createdAt: string;
  readiness: boolean;
  cutOffAt: string | null;
  reportDocumentId: string | null;
  /** seeded demonstration content, marked on the row like the Council Strategy */
  illustrative: boolean;
};

/** The administrator's list: HR scope plus the handovers the user started. */
export async function listHandovers(user: CurrentUser): Promise<{ rows: HandoverListRow[]; scopeAll: boolean } | null> {
  const scope = hrScopeFor(user);
  const rows = await db.select().from(schema.handovers).orderBy(desc(schema.handovers.createdAt));
  const mine = rows.filter((h) => h.createdBy === user.id);
  if (!scope && !mine.length) return null;
  const [items, interviews, paths] = await Promise.all([
    db.select().from(schema.handoverItems),
    db.select().from(schema.handoverInterviews),
    db.select().from(schema.handoverLearningPaths),
  ]);
  const users = await usersLite([...items.map((i) => i.recipientUserId), ...rows.map((r) => r.successorDefaultUserId)].filter(Boolean) as string[]);
  const out: HandoverListRow[] = [];
  for (const h of rows) {
    const person = await personOf(h);
    const visible =
      scope?.all ||
      h.createdBy === user.id ||
      (scope && person.kind === "employee" && person.departmentId === scope.departmentId) ||
      (scope && person.kind === "external" && (await canStartFor(user, person)));
    if (!visible) continue;
    const its = items.filter((i) => i.handoverId === h.id);
    const inScope = its.filter((i) => i.inScope === 1 && i.status !== "not_needed");
    const done = inScope.filter((i) => i.status !== "pending").length;
    const ivs = interviews.filter((i) => i.handoverId === h.id);
    const complete = ivs.filter((i) => i.status === "complete").length;
    const total = Math.max(ivs.length, h.interviewRequired ? 1 : 0);
    const recipientIds = [...new Set(its.filter((i) => i.recipientKind === "person" && i.recipientUserId).map((i) => i.recipientUserId!))];
    out.push({
      id: h.id,
      kind: displayKind(h),
      personKind: h.personKind as PersonKind,
      status: h.status,
      person,
      recipients: recipientIds.map((r) => users.get(r)).filter(Boolean) as UserLite[],
      defaultRecipient: h.successorDefaultUserId ? users.get(h.successorDefaultUserId) ?? null : null,
      items: { done, total: inScope.length, pct: inScope.length ? Math.round((100 * done) / inScope.length) : 0 },
      interviews: { complete, total, pct: total ? Math.round((100 * complete) / total) : 0 },
      dueDate: h.dueDate,
      lastWorkingDay: h.lastWorkingDay,
      daysToLastWorkingDay: daysUntil(h.lastWorkingDay ?? h.dueDate),
      createdAt: h.createdAt,
      readiness: readinessOf(its, ivs, paths.filter((p) => p.handoverId === h.id), h.interviewRequired === 1).ok,
      cutOffAt: h.cutOffAt,
      reportDocumentId: h.reportDocumentId,
      illustrative: (h.notes ?? "").startsWith("[Illustrative]"),
    });
  }
  return { rows: out, scopeAll: Boolean(scope?.all) };
}

/** People the start form can pick: colleagues plus the External Experts register. */
export async function searchStartCandidates(q: string): Promise<{ employees: (UserLite & { unitEn: string | null; unitAr: string | null })[]; externals: { id: string; nameEn: string; nameAr: string; organisationEn: string | null; type: string; email: string | null }[] }> {
  const needle = q.trim().toLowerCase();
  const users = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, avatarColor: schema.users.avatarColor, email: schema.users.email, unitEn: schema.orgUnits.nameEn, unitAr: schema.orgUnits.nameAr })
    .from(schema.users)
    .leftJoin(schema.orgUnits, eq(schema.orgUnits.id, schema.users.departmentId))
    .where(isNull(schema.users.deletedAt))
    .orderBy(asc(schema.users.nameEn));
  const experts = await db.select().from(schema.experts).where(ne(schema.experts.type, "npc_employee")).orderBy(asc(schema.experts.nameEn));
  const match = (s: (string | null | undefined)[]) => !needle || s.some((x) => (x ?? "").toLowerCase().includes(needle));
  return {
    employees: users.filter((u) => match([u.nameEn, u.nameAr, u.email, u.unitEn])).slice(0, 12),
    externals: experts
      .filter((e) => !e.userId && match([e.nameEn, e.nameAr, e.organisationEn, e.email]))
      .slice(0, 12)
      .map((e) => ({ id: e.id, nameEn: e.nameEn, nameAr: e.nameAr, organisationEn: e.organisationEn, type: e.type, email: e.email })),
  };
}

/* ------------------------------------------------------------------ */
/* 6.2 items: scope, add, notes; 6.3 the recipient decision             */
/* ------------------------------------------------------------------ */

async function assertOpen(h: HandoverRow): Promise<void> {
  if (h.status === "complete") throw new HandoverError("closed", 409);
}

export async function setItemScope(actor: CurrentUser, itemId: string, inScope: boolean): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  const h = await loadHandover(item.handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);
  await db.update(schema.handoverItems).set({ inScope: inScope ? 1 : 0 }).where(eq(schema.handoverItems.id, itemId));
  await audit(actor.id, inScope ? "handover_item_scoped" : "handover_item_unscoped", "handover_item", itemId);
  await refreshCompletion(h.id);
  const fresh = await syncItem(itemId);
  return fresh ? itemView(fresh, await usersLite([fresh.recipientUserId ?? ""])) : null;
}

export type AddItemInput = {
  /** a manual entry (a tacit topic, a contact, a link, anything the inventory missed) */
  title?: string;
  category?: ItemCategory;
  note?: string | null;
  resourceType?: string;
  resourceId?: string;
  /** resources already published through /api/v1/knowledge/publish */
  published?: { type: string; id: string }[];
};

const PUBLISHED_CATEGORY: Record<string, ItemCategory> = {
  lesson: "lesson",
  document: "document",
  expert: "contact",
  signal: "other",
  decision: "other",
};

/** The person, the administrator or the token holder adds items. */
export async function addHandoverItem(
  actor: { userId: string | null; admin: boolean },
  handoverId: string,
  input: AddItemInput
): Promise<ItemView[]> {
  const h = await loadHandover(handoverId);
  await assertOpen(h);
  const now = nowIso();
  const created: string[] = [];
  const defaultRecipient = h.successorDefaultUserId;
  const insert = async (values: { category: ItemCategory; resourceType: string; resourceId: string; title: string; note: string | null }) => {
    const [dup] = await db
      .select({ id: schema.handoverItems.id })
      .from(schema.handoverItems)
      .where(and(eq(schema.handoverItems.handoverId, handoverId), eq(schema.handoverItems.resourceType, values.resourceType), eq(schema.handoverItems.resourceId, values.resourceId)))
      .limit(1);
    if (dup) {
      created.push(dup.id);
      return;
    }
    const id = newId();
    await db.insert(schema.handoverItems).values({
      id,
      handoverId,
      itemKind: ITEM_KIND_OF[values.category],
      resourceType: values.resourceType,
      resourceId: values.resourceId,
      title: values.title.slice(0, 200),
      successorUserId: defaultRecipient,
      status: "pending",
      note: values.note?.trim() || null,
      category: values.category,
      inScope: 1,
      recipientKind: defaultRecipient ? "person" : null,
      recipientUserId: defaultRecipient,
      filingStatus: "none",
      addedBy: actor.userId,
      createdAt: now,
    });
    created.push(id);
  };
  if (input.published?.length) {
    for (const p of input.published.slice(0, 12)) {
      let title = p.id;
      if (p.type === "lesson") {
        const [l] = await db.select({ t: schema.lessons.titleEn }).from(schema.lessons).where(eq(schema.lessons.id, p.id)).limit(1);
        title = l?.t ?? title;
      } else if (p.type === "document") {
        const [d] = await db.select({ t: schema.documents.titleEn }).from(schema.documents).where(eq(schema.documents.id, p.id)).limit(1);
        title = d?.t ?? title;
      } else if (p.type === "expert") {
        const [e] = await db.select({ t: schema.experts.nameEn }).from(schema.experts).where(eq(schema.experts.id, p.id)).limit(1);
        title = e?.t ?? title;
      } else if (p.type === "signal") {
        const [s] = await db.select({ t: schema.signals.titleEn }).from(schema.signals).where(eq(schema.signals.id, p.id)).limit(1);
        title = s?.t ?? title;
      } else if (p.type === "decision") {
        const [d] = await db.select({ t: schema.decisions.titleEn }).from(schema.decisions).where(eq(schema.decisions.id, p.id)).limit(1);
        title = d?.t ?? title;
      }
      await insert({ category: PUBLISHED_CATEGORY[p.type] ?? "other", resourceType: p.type, resourceId: p.id, title, note: input.note ?? null });
    }
  } else {
    const title = (input.title ?? "").trim();
    if (!title) throw new HandoverError("invalid", 400);
    const category = input.category && CATEGORIES.includes(input.category) ? input.category : "tacit_topic";
    await insert({ category, resourceType: input.resourceType ?? "manual", resourceId: input.resourceId ?? newId(), title, note: input.note ?? null });
  }
  for (const id of created) await syncItem(id);
  await refreshCompletion(handoverId);
  if (actor.userId) await audit(actor.userId, "handover_item_added", "handover", handoverId, { items: created.length });
  const rows = await db.select().from(schema.handoverItems).where(inArray(schema.handoverItems.id, created));
  const users = await usersLite(rows.map((r) => r.recipientUserId).filter(Boolean) as string[]);
  return rows.map((r) => itemView(r, users));
}

/** The required handover note per item (the person, the admin or the token holder). */
export async function setItemNote(actor: { userId: string | null; admin: boolean }, itemId: string, note: string): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  const h = await loadHandover(item.handoverId);
  await assertOpen(h);
  await db.update(schema.handoverItems).set({ note: note.trim().slice(0, 2000) || null }).where(eq(schema.handoverItems.id, itemId));
  const fresh = await syncItem(itemId);
  await refreshCompletion(h.id);
  if (actor.userId) await audit(actor.userId, "handover_note_saved", "handover_item", itemId);
  return fresh ? itemView(fresh, await usersLite([fresh.recipientUserId ?? ""])) : null;
}

export async function setItemRecipient(
  actor: CurrentUser,
  itemId: string,
  input: { recipientKind: RecipientKind | null; recipientUserId?: string | null; note?: string | null }
): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  const h = await loadHandover(item.handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);
  const recipientUserId = input.recipientKind === "person" ? input.recipientUserId ?? h.successorDefaultUserId ?? null : null;
  if (input.recipientKind === "person" && !recipientUserId) throw new HandoverError("recipient_required", 400);
  if (recipientUserId && recipientUserId === h.userId) throw new HandoverError("recipient_is_person", 400);
  if (recipientUserId && !(await userLite(recipientUserId))) throw new HandoverError("recipient_not_found", 404);
  await db
    .update(schema.handoverItems)
    .set({
      recipientKind: input.recipientKind,
      recipientUserId,
      successorUserId: recipientUserId,
      note: input.note === undefined ? item.note : input.note?.trim() || null,
      // a change of decision resets the filing and the understanding
      filingStatus: input.recipientKind === "system" ? item.filingStatus : "none",
      filingProposalJson: input.recipientKind === "system" ? item.filingProposalJson : null,
      understoodAt: recipientUserId === item.recipientUserId ? item.understoodAt : null,
      status: item.status === "not_needed" ? "pending" : item.status,
    })
    .where(eq(schema.handoverItems.id, itemId));
  const fresh = await syncItem(itemId);
  await refreshCompletion(h.id);
  await audit(actor.id, "handover_item_recipient", "handover_item", itemId, { recipientKind: input.recipientKind, recipientUserId });
  if (recipientUserId && recipientUserId !== item.recipientUserId) {
    const person = await personOf(h);
    await notify(
      recipientUserId,
      "handover_recipient",
      `Handover item assigned to you: ${item.title.slice(0, 60)}`,
      `أُسند إليك عنصر تسليم: ${item.title.slice(0, 60)}`,
      `/handover/${h.id}`,
      { en: `From the handover of ${person.nameEn}.`, ar: `من تسليم مهام ${person.nameAr}.` }
    );
  }
  return fresh ? itemView(fresh, await usersLite([fresh.recipientUserId ?? ""])) : null;
}

/* CR05 5.6.4 compatibility. The HR checklist surface speaks in item statuses;
   CR08 stopped storing a status a caller can set and derives it from the
   recipient decision instead (statusFor above). Translating one into the other
   belongs here, next to the rules it has to satisfy, rather than in the route. */
const COMPAT_NOTE = "Handed to the successor from the HR checklist.";

export async function setItemStatusCompat(
  actor: CurrentUser,
  itemId: string,
  status: "pending" | "reassigned" | "captured" | "not_needed",
  input: { recipientUserId?: string | null; note?: string | null } = {}
): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  const h = await loadHandover(item.handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);

  if (status === "not_needed") return setItemScope(actor, itemId, false);
  // every other status is a statement about an item that counts, so bring it back
  if (!item.inScope || item.status === "not_needed") await setItemScope(actor, itemId, true);
  // an explicit "captured" survives statusFor, so clear it before deriving again
  if (item.status === "captured" && status !== "captured") {
    await db.update(schema.handoverItems).set({ status: "pending", doneAt: null }).where(eq(schema.handoverItems.id, itemId));
  }
  const note = input.note ?? undefined;

  if (status === "pending") {
    return setItemRecipient(actor, itemId, { recipientKind: null, note });
  }
  if (status === "reassigned") {
    const recipientUserId = input.recipientUserId ?? item.recipientUserId ?? h.successorDefaultUserId ?? null;
    if (!recipientUserId) throw new HandoverError("recipient_required", 400);
    // CR08 only calls an item handed over once the successor has something to read
    const withNote = (note ?? item.note ?? "").trim() || COMPAT_NOTE;
    return setItemRecipient(actor, itemId, { recipientKind: "person", recipientUserId, note: withNote });
  }
  // captured: written into the system rather than handed to a person. Record it
  // directly and leave the filing proposal alone, because nothing was filed.
  await db
    .update(schema.handoverItems)
    .set({
      status: "captured",
      doneAt: item.doneAt ?? nowIso(),
      note: note === undefined ? item.note : note.trim() || null,
    })
    .where(eq(schema.handoverItems.id, itemId));
  await audit(actor.id, "handover_item_captured", "handover_item", itemId);
  const fresh = await syncItem(itemId);
  await refreshCompletion(h.id);
  return fresh ? itemView(fresh, await usersLite([fresh.recipientUserId ?? ""])) : null;
}

export async function markUnderstood(recipient: CurrentUser, itemId: string): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  if (item.recipientUserId !== recipient.id) throw new HandoverError("forbidden", 403);
  await db.update(schema.handoverItems).set({ understoodAt: item.understoodAt ?? nowIso() }).where(eq(schema.handoverItems.id, itemId));
  await audit(recipient.id, "handover_item_understood", "handover_item", itemId);
  const fresh = await syncItem(itemId);
  return fresh ? itemView(fresh, await usersLite([fresh.recipientUserId ?? ""])) : null;
}

/* ------------------------------------------------------------------ */
/* 6.2 the AI knowledge capture interview                               */
/* ------------------------------------------------------------------ */

const MOCK_QUESTIONS: BiLine[] = [
  { en: "What is the current status of {topic}, and what is the next milestone a successor must not miss?", ar: "ما الوضع الحالي لـ {topic}، وما المحطة التالية التي لا ينبغي للخلف أن يفوّتها؟" },
  { en: "Which decisions shaped this work so far, and why were they taken?", ar: "ما القرارات التي شكّلت هذا العمل حتى الآن، ولماذا اتُّخذت؟" },
  { en: "Who are the people a successor must know, inside NPC and outside it, and what does each one care about?", ar: "من الأشخاص الذين ينبغي للخلف معرفتهم داخل المجلس وخارجه، وما الذي يهم كل واحد منهم؟" },
  { en: "What went wrong or nearly went wrong, and what should a successor avoid?", ar: "ما الذي أخفق أو كاد أن يخفق، وما الذي ينبغي للخلف تجنبه؟" },
  { en: "Where do the files, the data and the working papers live, and who holds access to them?", ar: "أين تُحفظ الملفات والبيانات وأوراق العمل، ومن يملك صلاحية الوصول إليها؟" },
  { en: "If you had one hour with your successor, what would you tell them first?", ar: "لو كان لديك ساعة واحدة مع خلفك، فما أول ما ستخبره به؟" },
];
const MOCK_CLOSING: BiLine = {
  en: "Thank you, that covers the ground a successor would ask about. Press Complete to turn the answers into Expert Insights and item notes.",
  ar: "شكرًا لك، هذا يغطي ما سيسأل عنه الخلف. اضغط على إكمال لتحويل الإجابات إلى رؤى خبراء وملاحظات على العناصر.",
};

type InterviewActor = { userId: string | null; admin?: boolean; token?: boolean };

async function interviewAccess(actor: InterviewActor, h: HandoverRow, write: boolean): Promise<void> {
  if (actor.token) {
    if (h.personKind !== "external") throw new HandoverError("forbidden", 403);
    return;
  }
  if (!actor.userId) throw new HandoverError("unauthorized", 401);
  if (h.personKind === "employee" && h.userId === actor.userId) return;
  if (actor.admin && !write) return;
  if (actor.admin && h.personKind === "external") return; // the NPC counterpart interviews on behalf
  throw new HandoverError("forbidden", 403);
}

async function nextQuestion(h: HandoverRow, topic: string, transcript: TranscriptEntry[]): Promise<{ en: string; ar: string; done: boolean; live: boolean }> {
  const answers = transcript.filter((e) => e.role === "person");
  if (await aiLive()) {
    const person = await personOf(h);
    const out = await callJson<{ question_en?: string; question_ar?: string; done?: boolean }>(
      "system_handover_interview",
      JSON.stringify({
        mode: "next",
        topic,
        handover_kind: displayKind(h),
        person: { name: person.nameEn, position: person.positionEn, organisation: person.organisationEn, department: person.departmentNameEn },
        answered_count: answers.length,
        transcript: transcript.map((e) => ({ role: e.role, text: e.role === "ai" ? e.en ?? e.text : e.text })),
      }),
      { maxTokens: 800 }
    );
    if (out && (out.question_en || out.question_ar)) {
      const done = Boolean(out.done) || answers.length >= 8;
      return { en: out.question_en || out.question_ar || "", ar: out.question_ar || out.question_en || "", done, live: true };
    }
  }
  if (answers.length >= MOCK_QUESTIONS.length) return { ...MOCK_CLOSING, done: true, live: false };
  const q = MOCK_QUESTIONS[answers.length];
  return { en: q.en.replace("{topic}", topic), ar: q.ar.replace("{topic}", topic), done: false, live: false };
}

export async function startInterview(actor: InterviewActor, handoverId: string, input: { topic: string; refType?: "node" | "council_node" | "topic" | "general"; refId?: string | null }): Promise<InterviewView> {
  const h = await loadHandover(handoverId);
  await assertOpen(h);
  await interviewAccess(actor, h, true);
  const topic = input.topic.trim().slice(0, 160);
  if (!topic) throw new HandoverError("invalid", 400);
  // one interview per topic reference
  const existing = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.handoverId, handoverId));
  const dup = existing.find((x) => (input.refId ? x.topicRefType === (input.refType ?? "topic") && x.topicRefId === input.refId : x.topic === topic));
  if (dup) return (await interviewViewOf(dup)) as InterviewView;
  const first = await nextQuestion(h, topic, []);
  const now = nowIso();
  const id = newId();
  const transcript: TranscriptEntry[] = [{ role: "ai", text: first.en, en: first.en, ar: first.ar, at: now }];
  await db.insert(schema.handoverInterviews).values({
    id,
    handoverId,
    topic,
    topicRefType: input.refType ?? (input.refId ? "topic" : "general"),
    topicRefId: input.refId ?? null,
    transcriptJson: JSON.stringify(transcript),
    structuredJson: null,
    status: "in_progress",
    insightLessonId: null,
    createdAt: now,
    updatedAt: now,
  });
  if (actor.userId) await audit(actor.userId, "handover_interview_started", "handover_interview", id, { topic });
  const [row] = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.id, id)).limit(1);
  return (await interviewViewOf(row)) as InterviewView;
}

async function interviewViewOf(i: InterviewRow): Promise<InterviewView> {
  const transcript = parse<TranscriptEntry[]>(i.transcriptJson, []);
  return {
    id: i.id,
    topic: i.topic,
    topicRefType: i.topicRefType,
    topicRefId: i.topicRefId,
    status: i.status,
    answers: transcript.filter((e) => e.role === "person").length,
    transcript,
    structured: parse<InterviewStructured | null>(i.structuredJson, null),
    insightLessonId: i.insightLessonId,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export async function answerInterview(actor: InterviewActor, interviewId: string, text: string): Promise<InterviewView & { done: boolean }> {
  const [iv] = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.id, interviewId)).limit(1);
  if (!iv) throw new HandoverError("not_found", 404);
  const h = await loadHandover(iv.handoverId);
  await assertOpen(h);
  await interviewAccess(actor, h, true);
  if (iv.status === "complete") throw new HandoverError("interview_complete", 409);
  const answer = text.trim().slice(0, 4000);
  if (!answer) throw new HandoverError("invalid", 400);
  const transcript = parse<TranscriptEntry[]>(iv.transcriptJson, []);
  transcript.push({ role: "person", text: answer, at: nowIso() });
  const next = await nextQuestion(h, iv.topic, transcript);
  transcript.push({ role: "ai", text: next.en, en: next.en, ar: next.ar, at: nowIso() });
  await db
    .update(schema.handoverInterviews)
    .set({ transcriptJson: JSON.stringify(transcript), status: "in_progress", updatedAt: nowIso() })
    .where(eq(schema.handoverInterviews.id, interviewId));
  const [row] = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.id, interviewId)).limit(1);
  return { ...(await interviewViewOf(row)), done: next.done };
}

function firstSentences(s: string, n = 2): string {
  const parts = s.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟])\s+/);
  return parts.slice(0, n).join(" ").slice(0, 400);
}

function mockStructure(topic: string, transcript: TranscriptEntry[]): InterviewStructured {
  const answers = transcript.filter((e) => e.role === "person").map((e) => e.text);
  const at = (i: number) => answers[i] ?? "";
  const lines = (i: number): BiLine[] =>
    at(i)
      .split(/\n|(?<=[.!?؟])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 3)
      .slice(0, 5)
      .map((x) => ({ en: x, ar: x }));
  const summaryEn = [at(0) ? `Status: ${firstSentences(at(0))}` : "", at(3) ? `Watch out for: ${firstSentences(at(3), 1)}` : "", at(4) ? `Where things live: ${firstSentences(at(4), 1)}` : ""].filter(Boolean).join(" ");
  const summaryAr = [at(0) ? `الوضع: ${firstSentences(at(0))}` : "", at(3) ? `احذر من: ${firstSentences(at(3), 1)}` : "", at(4) ? `مواقع الملفات: ${firstSentences(at(4), 1)}` : ""].filter(Boolean).join(" ");
  return {
    titleEn: `Expert Insights: ${topic}`,
    titleAr: `رؤى الخبراء: ${topic}`,
    summaryEn: summaryEn || `Interview on ${topic} with ${answers.length} answers.`,
    summaryAr: summaryAr || `مقابلة عن ${topic} بعدد ${answers.length} من الإجابات.`,
    statusEn: at(0),
    statusAr: at(0),
    decisions: lines(1),
    contacts: lines(2),
    pitfalls: lines(3),
    locations: lines(4),
    adviceEn: at(5),
    adviceAr: at(5),
    answers: answers.length,
    live: false,
  };
}

export async function completeInterview(actor: InterviewActor, interviewId: string): Promise<InterviewView> {
  const [iv] = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.id, interviewId)).limit(1);
  if (!iv) throw new HandoverError("not_found", 404);
  const h = await loadHandover(iv.handoverId);
  await assertOpen(h);
  await interviewAccess(actor, h, true);
  if (iv.status === "complete") return interviewViewOf(iv);
  const transcript = parse<TranscriptEntry[]>(iv.transcriptJson, []);
  const answers = transcript.filter((e) => e.role === "person");
  if (!answers.length) throw new HandoverError("no_answers", 400);
  const person = await personOf(h);

  let structured: InterviewStructured | null = null;
  if (await aiLive()) {
    const out = await callJson<Partial<Record<string, unknown>>>(
      "system_handover_interview",
      JSON.stringify({
        mode: "summarise",
        topic: iv.topic,
        handover_kind: displayKind(h),
        person: { name: person.nameEn, position: person.positionEn, organisation: person.organisationEn },
        transcript: transcript.map((e) => ({ role: e.role, text: e.role === "ai" ? e.en ?? e.text : e.text })),
      }),
      { maxTokens: 2500 }
    );
    if (out && typeof out.summary_en === "string") {
      const lines = (v: unknown): BiLine[] =>
        Array.isArray(v) ? v.slice(0, 8).map((x) => ({ en: String((x as BiLine)?.en ?? ""), ar: String((x as BiLine)?.ar ?? "") })).filter((x) => x.en || x.ar) : [];
      structured = {
        titleEn: String(out.title_en ?? `Expert Insights: ${iv.topic}`),
        titleAr: String(out.title_ar ?? `رؤى الخبراء: ${iv.topic}`),
        summaryEn: String(out.summary_en),
        summaryAr: String(out.summary_ar ?? out.summary_en),
        statusEn: String(out.status_en ?? ""),
        statusAr: String(out.status_ar ?? out.status_en ?? ""),
        decisions: lines(out.decisions),
        contacts: lines(out.contacts),
        pitfalls: lines(out.pitfalls),
        locations: lines(out.locations),
        adviceEn: String(out.advice_en ?? ""),
        adviceAr: String(out.advice_ar ?? out.advice_en ?? ""),
        answers: answers.length,
        live: true,
      };
    }
  }
  if (!structured) structured = mockStructure(iv.topic, transcript);

  /* the Expert Insights lesson (category expert), linked to the topic's project */
  const authorId = person.userId ?? h.successorDefaultUserId ?? h.createdBy ?? actor.userId;
  let lessonId: string | null = null;
  if (authorId) {
    lessonId = newId();
    const join = (l: BiLine[], key: "en" | "ar") => l.map((x) => x[key]).filter(Boolean).join(" ");
    const nodeId = iv.topicRefType === "node" ? iv.topicRefId : null;
    await db.insert(schema.lessons).values({
      id: lessonId,
      authorId,
      category: "expert",
      titleEn: structured.titleEn.slice(0, 180),
      titleAr: structured.titleAr.slice(0, 180),
      contextEn: [structured.summaryEn, structured.statusEn].filter(Boolean).join("\n\n"),
      contextAr: [structured.summaryAr, structured.statusAr].filter(Boolean).join("\n\n"),
      learningEn: [join(structured.decisions, "en"), join(structured.pitfalls, "en")].filter(Boolean).join("\n\n") || structured.summaryEn,
      learningAr: [join(structured.decisions, "ar"), join(structured.pitfalls, "ar")].filter(Boolean).join("\n\n") || structured.summaryAr,
      recommendationEn: [structured.adviceEn, join(structured.locations, "en"), join(structured.contacts, "en")].filter(Boolean).join("\n\n") || null,
      recommendationAr: [structured.adviceAr, join(structured.locations, "ar"), join(structured.contacts, "ar")].filter(Boolean).join("\n\n") || null,
      nodeId,
      classificationLevel: 2,
      status: "published",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    if (iv.topicRefType === "node" || iv.topicRefType === "council_node") {
      if (iv.topicRefId) {
        await db.insert(schema.lessonNodeLinks).values({
          id: newId(),
          lessonId,
          nodeId: iv.topicRefId,
          nodeKind: iv.topicRefType === "council_node" ? "council" : "nds",
          isPrimary: 1,
          linkedBy: authorId,
          linkedAt: nowIso(),
        });
      }
    }
    await db.insert(schema.knowledgeCaptures).values({ id: newId(), handoverId: h.id, lessonId, documentId: null, topic: iv.topic, createdAt: nowIso() });
    try {
      const { enqueue } = await import("@/server/jobs/queue");
      await enqueue("embed_records", { resourceType: "lesson", resourceId: lessonId });
    } catch {
      /* indexing is best effort */
    }
  }

  /* item notes: the topic's items and the matching tacit topic */
  const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
  const noteLine = `Interview (${todayIso()}): ${structured.summaryEn}`.slice(0, 900);
  for (const i of items) {
    const onTopic = (iv.topicRefId && i.resourceId === iv.topicRefId) || (iv.topicRefType === "topic" && i.id === iv.topicRefId);
    if (!onTopic) continue;
    const note = i.note ? `${i.note}\n\n${noteLine}` : noteLine;
    await db
      .update(schema.handoverItems)
      .set({ note: note.slice(0, 2000), status: i.category === "tacit_topic" ? "captured" : i.status, doneAt: i.category === "tacit_topic" ? i.doneAt ?? nowIso() : i.doneAt })
      .where(eq(schema.handoverItems.id, i.id));
    await syncItem(i.id);
  }
  await db
    .update(schema.handoverInterviews)
    .set({ structuredJson: JSON.stringify(structured), status: "complete", insightLessonId: lessonId, updatedAt: nowIso() })
    .where(eq(schema.handoverInterviews.id, interviewId));
  await refreshCompletion(h.id);
  if (actor.userId) await audit(actor.userId, "handover_interview_completed", "handover_interview", interviewId, { lessonId });
  if (person.userId && lessonId) {
    await record({ userId: person.userId, type: "knowledge_capture_bonus", resourceType: "lesson", resourceId: lessonId });
  }
  const [row] = await db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.id, interviewId)).limit(1);
  return interviewViewOf(row);
}

/* ------------------------------------------------------------------ */
/* 6.3 to a person: the AI Handover Learning Path                       */
/* ------------------------------------------------------------------ */

const CATEGORY_TOPIC: Record<ItemCategory, BiLine> = {
  document: { en: "Documents and working papers", ar: "الوثائق وأوراق العمل" },
  report: { en: "Reports", ar: "التقارير" },
  deliverable: { en: "Deliverables", ar: "المخرجات" },
  policy: { en: "Policies and procedures", ar: "السياسات والإجراءات" },
  lesson: { en: "Lessons learned", ar: "الدروس المستفادة" },
  project_role: { en: "Owned projects", ar: "المشاريع المملوكة" },
  stakeholder_role: { en: "Project roles", ar: "الأدوار في المشاريع" },
  indicator: { en: "Indicators", ar: "المؤشرات" },
  council_indicator: { en: "Council indicators", ar: "مؤشرات المجلس" },
  expert_request: { en: "Open expert requests", ar: "طلبات الخبراء المفتوحة" },
  expert_profile: { en: "Expert profiles maintained", ar: "ملفات الخبراء المُدارة" },
  contact: { en: "Contacts", ar: "جهات الاتصال" },
  community: { en: "Communities led", ar: "المجتمعات المعرفية" },
  org_role: { en: "Organisational roles", ar: "الأدوار التنظيمية" },
  collection: { en: "Collections", ar: "المجموعات" },
  tacit_topic: { en: "Tacit knowledge", ar: "المعرفة الضمنية" },
  other: { en: "Other items", ar: "عناصر أخرى" },
};

async function moduleEpisode(recipient: CurrentUser, mod: PathModule, locale: "en" | "ar"): Promise<{ id: string | null; note: string | null }> {
  try {
    const scope =
      mod.refType === "node" && mod.refId
        ? { kind: "node" as const, ids: [mod.refId], labelEn: mod.topic, labelAr: mod.topicAr }
        : mod.refType === "council_node" && mod.refId
          ? { kind: "council_node" as const, ids: [mod.refId], labelEn: mod.topic, labelAr: mod.topicAr }
          : mod.lessons.length
            ? { kind: "lessons" as const, ids: mod.lessons.map((l) => l.id), labelEn: mod.topic, labelAr: mod.topicAr }
            : mod.documents.length
              ? { kind: "document" as const, ids: mod.documents.slice(0, 3).map((d) => d.id), labelEn: mod.topic, labelAr: mod.topicAr }
              : null;
    if (!scope) return { id: null, note: "no_scope" };
    const { generatePodcastScript } = await import("@/server/ai/podcast/script");
    const { script } = await generatePodcastScript(recipient, scope, { language: locale, minutes: 2, focus: "overview" });
    if (!script.segments.length) return { id: null, note: "empty_script" };
    // the row is written directly (the composer's createEpisode pays podcast_created
    // points, and a generated module episode is not the recipient's contribution)
    const id = newId();
    const classification = Math.max(2, ...script.sources.map((s) => s.classification ?? 2));
    await db.insert(schema.podcastEpisodes).values({
      id,
      titleEn: `Handover: ${script.title_en || mod.topic}`.slice(0, 180),
      titleAr: `التسليم: ${script.title_ar || mod.topicAr}`.slice(0, 180),
      descriptionEn: script.description_en || null,
      descriptionAr: script.description_ar || null,
      language: locale,
      focus: "overview",
      sourceScopeJson: JSON.stringify({ ...scope, handoverModule: mod.id }),
      scriptJson: JSON.stringify(script),
      audioPath: null,
      audioProvider: "browser",
      durationSec: script.estimated_seconds,
      status: "published",
      createdBy: recipient.id,
      classificationLevel: classification,
      listens: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return { id, note: null };
  } catch (e) {
    return { id: null, note: String((e as Error)?.message ?? e).slice(0, 120) };
  }
}

/** Cuts at the last word boundary before `max` so a summary never ends
    mid-word, and closes the sentence with a full stop. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[،,;:.]$/, "")}.`;
}

function mockModuleText(
  mod: Omit<PathModule, "summaryEn" | "summaryAr" | "checkQuestion">,
  itemTitles: string[],
  interviewSummary: string | null,
  itemTitlesAr: string[] = itemTitles
): Pick<PathModule, "summaryEn" | "summaryAr" | "checkQuestion"> {
  const list = itemTitles.slice(0, 5).join("; ");
  // the Arabic reader gets the Arabic titles of the same items, never the
  // English list with an Arabic frame around it
  const listAr = itemTitlesAr.slice(0, 5).join("؛ ");
  const more = itemTitles.length > 5 ? ` and ${itemTitles.length - 5} more` : "";
  const moreAr = itemTitles.length > 5 ? ` و${itemTitles.length - 5} عناصر أخرى` : "";
  // completeInterview appends its summary to the item notes, so the note is
  // stripped of that tail before it is quoted again beside the interview
  const firstNote = mod.notes.length ? mod.notes[0].split(/\n\n?Interview \(/)[0] : "";
  const notes = firstNote ? ` The leaving person's notes: ${clip(firstNote, 200)}` : "";
  const notesAr = firstNote ? ` ملاحظات المُسلِّم: ${clip(firstNote, 200)}` : "";
  const iv = interviewSummary ? ` From the capture interview: ${clip(interviewSummary, 240)}` : "";
  const ivAr = interviewSummary ? ` من مقابلة التوثيق: ${clip(interviewSummary, 240)}` : "";
  return {
    summaryEn: `This module hands over ${itemTitles.length} item${itemTitles.length === 1 ? "" : "s"} on ${mod.topic}: ${list}${more}.${notes}${iv} Read the documents and lessons below before you mark it as understood.`,
    summaryAr: `تُسلِّم هذه الوحدة ${itemTitles.length} من العناصر حول ${mod.topicAr}: ${listAr}${moreAr}.${notesAr}${ivAr} اقرأ الوثائق والدروس أدناه قبل أن تعلّم الوحدة كمفهومة.`,
    checkQuestion: {
      en: `Where does the rest of the material on ${mod.topic} live, and who is the first person to call about it?`,
      ar: `أين تُحفظ بقية المواد المتعلقة بـ ${mod.topicAr}، ومن أول شخص تتصل به بشأنها؟`,
      answerHint: firstNote ? clip(firstNote, 160) : interviewSummary ? clip(interviewSummary, 160) : "Check the handover notes and the linked documents.",
      answerHintAr: firstNote ? clip(firstNote, 160) : interviewSummary ? clip(interviewSummary, 160) : "راجع ملاحظات التسليم والوثائق المرتبطة.",
    },
  };
}

export async function buildLearningPath(handoverId: string, recipientUserId: string, opts: { locale?: "en" | "ar"; episodes?: boolean } = {}): Promise<{ id: string; modules: PathModule[]; progress: PathProgress }> {
  const h = await loadHandover(handoverId);
  const recipient = await getUserById(recipientUserId);
  if (!recipient) throw new HandoverError("recipient_not_found", 404);
  const items = (await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId))).filter(
    (i) => i.inScope === 1 && i.recipientKind === "person" && i.recipientUserId === recipientUserId && i.status !== "not_needed"
  );
  const interviews = await db.select().from(schema.handoverInterviews).where(and(eq(schema.handoverInterviews.handoverId, handoverId), eq(schema.handoverInterviews.status, "complete")));
  const [existing] = await db
    .select()
    .from(schema.handoverLearningPaths)
    .where(and(eq(schema.handoverLearningPaths.handoverId, handoverId), eq(schema.handoverLearningPaths.recipientUserId, recipientUserId)))
    .limit(1);
  const previous = existing ? parse<PathModule[]>(existing.modulesJson, []) : [];

  /* group: one module per project (node), then one per category */
  const nodeIds = [...new Set(items.filter((i) => i.resourceType === "node").map((i) => i.resourceId))];
  const councilIds = [...new Set(items.filter((i) => i.resourceType === "council_node").map((i) => i.resourceId))];
  const nodes = nodeIds.length ? await db.select().from(schema.strategyNodes).where(inArray(schema.strategyNodes.id, nodeIds)) : [];
  const council = councilIds.length ? await db.select().from(schema.councilNodes).where(inArray(schema.councilNodes.id, councilIds)) : [];
  const deliverables = await db.select().from(schema.deliverableMeta);
  const docIds = items.filter((i) => i.resourceType === "document").map((i) => i.resourceId);
  const docs = docIds.length ? await db.select().from(schema.documents).where(inArray(schema.documents.id, docIds)) : [];
  const lessonIds = items.filter((i) => i.resourceType === "lesson").map((i) => i.resourceId);
  const lessons = lessonIds.length ? await db.select().from(schema.lessons).where(inArray(schema.lessons.id, lessonIds)) : [];
  const docOf = (id: string) => docs.find((d) => d.id === id);
  const lessonOf = (id: string) => lessons.find((l) => l.id === id);
  const nodeArTitle = new Map<string, string>(
    [...nodes, ...council].map((n) => [n.id, `${n.code ? n.code + " " : ""}${n.titleAr}`] as const)
  );
  /** An item title is stored once, in English. The Arabic module summary
      names the same resources in Arabic, keeping a role or deliverable
      prefix and translating the role. */
  const arabicItemTitle = (i: ItemRow): string => {
    const m = /^([^:]{1,32}):\s*(.+)$/.exec(i.title);
    const prefixEn = m && (ROLE_EN_TO_AR.has(m[1]) || /^[A-Za-z]{1,3}\d{0,3}$/.test(m[1])) ? m[1] : null;
    const tail =
      i.resourceType === "document"
        ? docOf(i.resourceId)?.titleAr ?? null
        : i.resourceType === "lesson"
          ? lessonOf(i.resourceId)?.titleAr ?? null
          : nodeArTitle.get(i.resourceId) ?? null;
    if (!tail) return i.title;
    return prefixEn ? `${ROLE_EN_TO_AR.get(prefixEn) ?? prefixEn}: ${tail}` : tail;
  };
  const used = new Set<string>();
  const groups: { key: string; topic: string; topicAr: string; refType: PathModule["refType"]; refId: string | null; items: ItemRow[] }[] = [];
  const nodeOf = (docId: string) => deliverables.find((d) => d.documentId === docId)?.nodeId ?? null;
  for (const n of [...nodes, ...council.map((c) => ({ ...c, nodeType: "council" }))]) {
    const isCouncil = "level" in n;
    const key = `${isCouncil ? "council_node" : "node"}:${n.id}`;
    const mine = items.filter((i) => {
      if (used.has(i.id)) return false;
      if (i.resourceId === n.id) return true;
      if (i.resourceType === "document" && nodeOf(i.resourceId) === n.id) return true;
      if (i.resourceType === "lesson" && lessonOf(i.resourceId)?.nodeId === n.id) return true;
      return false;
    });
    if (!mine.length) continue;
    for (const i of mine) used.add(i.id);
    groups.push({ key, topic: `${n.code ? n.code + " " : ""}${n.titleEn}`, topicAr: `${n.code ? n.code + " " : ""}${n.titleAr}`, refType: isCouncil ? "council_node" : "node", refId: n.id, items: mine });
  }
  for (const code of CATEGORIES) {
    const mine = items.filter((i) => !used.has(i.id) && (i.category ?? "other") === code);
    if (!mine.length) continue;
    for (const i of mine) used.add(i.id);
    groups.push({ key: `category:${code}`, topic: CATEGORY_TOPIC[code].en, topicAr: CATEGORY_TOPIC[code].ar, refType: "category", refId: code, items: mine });
  }

  const live = await aiLive();
  const locale = opts.locale ?? (recipient.localePref === "ar" ? "ar" : "en");
  const modules: PathModule[] = [];
  for (const g of groups) {
    const prev = previous.find((p) => p.id === g.key);
    const documents: PathRef[] = [];
    const lessonRefs: PathRef[] = [];
    for (const i of g.items) {
      if (i.resourceType === "document") {
        const d = docOf(i.resourceId);
        documents.push({ id: i.resourceId, titleEn: d?.titleEn ?? i.title, titleAr: d?.titleAr ?? i.title, href: `/vault/${i.resourceId}` });
      } else if (i.resourceType === "lesson") {
        const l = lessonOf(i.resourceId);
        lessonRefs.push({ id: i.resourceId, titleEn: l?.titleEn ?? i.title, titleAr: l?.titleAr ?? i.title, href: `/lessons?lesson=${i.resourceId}` });
      }
    }
    // the interview on this topic feeds the module, as does its Expert Insights lesson
    const interview = interviews.find((x) => (g.refId && x.topicRefId === g.refId) || x.topic === g.topic) ?? null;
    const structured = interview ? parse<InterviewStructured | null>(interview.structuredJson, null) : null;
    if (interview?.insightLessonId && !lessonRefs.some((l) => l.id === interview.insightLessonId)) {
      const [l] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, interview.insightLessonId)).limit(1);
      if (l) lessonRefs.push({ id: l.id, titleEn: l.titleEn, titleAr: l.titleAr, href: `/lessons?lesson=${l.id}` });
    }
    // several items of one project often carry the same note; quote it once
    const notes = [...new Set(g.items.map((i) => (i.note ?? "").trim()).filter(Boolean))];
    const base: Omit<PathModule, "summaryEn" | "summaryAr" | "checkQuestion"> = {
      id: g.key,
      topic: g.topic,
      topicAr: g.topicAr,
      refType: g.refType,
      refId: g.refId,
      documents,
      lessons: lessonRefs,
      notes,
      itemIds: g.items.map((i) => i.id),
      episodeId: prev?.episodeId ?? null,
      episodeNote: prev?.episodeNote ?? null,
      understoodAt: prev?.understoodAt ?? (g.items.every((i) => i.understoodAt) ? g.items[0].understoodAt : null),
    };
    let text: Pick<PathModule, "summaryEn" | "summaryAr" | "checkQuestion"> | null = null;
    if (live) {
      const out = await callJson<Record<string, unknown>>(
        "system_handover_path",
        JSON.stringify({
          recipient: { name: recipient.nameEn },
          module: {
            topic: g.topic,
            topic_ar: g.topicAr,
            items: g.items.map((i) => ({ title: i.title, category: i.category, note: i.note })),
            documents: documents.map((d) => d.titleEn),
            lessons: lessonRefs.map((l) => l.titleEn),
            interview_summary: structured?.summaryEn ?? null,
          },
        }),
        { maxTokens: 1200 }
      );
      if (out && typeof out.summary_en === "string") {
        text = {
          summaryEn: String(out.summary_en),
          summaryAr: String(out.summary_ar ?? out.summary_en),
          checkQuestion: {
            en: String(out.check_question_en ?? ""),
            ar: String(out.check_question_ar ?? out.check_question_en ?? ""),
            answerHint: String(out.answer_hint_en ?? ""),
            answerHintAr: String(out.answer_hint_ar ?? out.answer_hint_en ?? ""),
          },
        };
      }
    }
    if (!text) text = mockModuleText(base, g.items.map((i) => i.title), structured?.summaryEn ?? null, g.items.map(arabicItemTitle));
    const mod: PathModule = { ...base, ...text, textVersion: PATH_TEXT_VERSION };
    if (opts.episodes !== false && !mod.episodeId) {
      const ep = await moduleEpisode(recipient, mod, locale);
      mod.episodeId = ep.id;
      mod.episodeNote = ep.note;
    }
    modules.push(mod);
  }
  const understood = modules.filter((m) => m.understoodAt).length;
  const progress: PathProgress = { understood, total: modules.length, pct: modules.length ? Math.round((100 * understood) / modules.length) : 0, updatedAt: nowIso() };
  const id = existing?.id ?? newId();
  if (existing) {
    await db
      .update(schema.handoverLearningPaths)
      .set({ modulesJson: JSON.stringify(modules), progressJson: JSON.stringify(progress), updatedAt: nowIso() })
      .where(eq(schema.handoverLearningPaths.id, existing.id));
  } else {
    await db.insert(schema.handoverLearningPaths).values({
      id,
      handoverId,
      recipientUserId,
      modulesJson: JSON.stringify(modules),
      progressJson: JSON.stringify(progress),
      signedOffAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const person = await personOf(h);
    await notify(
      recipientUserId,
      "handover_path",
      `Your Handover Learning Path is ready: ${person.nameEn}`,
      `مسار تعلّم التسليم جاهز: ${person.nameAr}`,
      `/handover/${handoverId}`,
      { en: `${modules.length} modules to work through before you sign off.`, ar: `${modules.length} وحدات للعمل عليها قبل التوقيع بالاستلام.` }
    );
  }
  return { id, modules, progress };
}

export async function getLearningPath(user: CurrentUser, handoverId: string): Promise<{ id: string; modules: PathModule[]; progress: PathProgress; signedOffAt: string | null } | null> {
  const [p] = await db
    .select()
    .from(schema.handoverLearningPaths)
    .where(and(eq(schema.handoverLearningPaths.handoverId, handoverId), eq(schema.handoverLearningPaths.recipientUserId, user.id)))
    .limit(1);
  if (!p) return null;
  return { id: p.id, modules: parse<PathModule[]>(p.modulesJson, []), progress: parse<PathProgress>(p.progressJson, { understood: 0, total: 0, pct: 0, updatedAt: p.updatedAt }), signedOffAt: p.signedOffAt };
}

export async function markModuleUnderstood(recipient: CurrentUser, handoverId: string, moduleId: string): Promise<{ modules: PathModule[]; progress: PathProgress }> {
  const [p] = await db
    .select()
    .from(schema.handoverLearningPaths)
    .where(and(eq(schema.handoverLearningPaths.handoverId, handoverId), eq(schema.handoverLearningPaths.recipientUserId, recipient.id)))
    .limit(1);
  if (!p) throw new HandoverError("not_found", 404);
  const modules = parse<PathModule[]>(p.modulesJson, []);
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) throw new HandoverError("not_found", 404);
  const now = nowIso();
  mod.understoodAt = mod.understoodAt ?? now;
  for (const itemId of mod.itemIds) {
    await db.update(schema.handoverItems).set({ understoodAt: now }).where(and(eq(schema.handoverItems.id, itemId), isNull(schema.handoverItems.understoodAt)));
  }
  const understood = modules.filter((m) => m.understoodAt).length;
  const progress: PathProgress = { understood, total: modules.length, pct: modules.length ? Math.round((100 * understood) / modules.length) : 0, updatedAt: now };
  await db
    .update(schema.handoverLearningPaths)
    .set({ modulesJson: JSON.stringify(modules), progressJson: JSON.stringify(progress), updatedAt: now })
    .where(eq(schema.handoverLearningPaths.id, p.id));
  await audit(recipient.id, "handover_module_understood", "handover_learning_path", p.id, { moduleId });
  return { modules, progress };
}

export async function signOff(recipient: CurrentUser, handoverId: string): Promise<{ signedOffAt: string; points: number }> {
  const [p] = await db
    .select()
    .from(schema.handoverLearningPaths)
    .where(and(eq(schema.handoverLearningPaths.handoverId, handoverId), eq(schema.handoverLearningPaths.recipientUserId, recipient.id)))
    .limit(1);
  if (!p) throw new HandoverError("not_found", 404);
  if (p.signedOffAt) return { signedOffAt: p.signedOffAt, points: 0 };
  const modules = parse<PathModule[]>(p.modulesJson, []);
  if (modules.some((m) => !m.understoodAt)) throw new HandoverError("modules_open", 409, { open: modules.filter((m) => !m.understoodAt).length });
  const now = nowIso();
  await db.update(schema.handoverLearningPaths).set({ signedOffAt: now, updatedAt: now }).where(eq(schema.handoverLearningPaths.id, p.id));
  // once per handover and recipient (the engine does not list this rule as once-per-resource)
  const [paid] = await db
    .select({ id: schema.gameEvents.id })
    .from(schema.gameEvents)
    .where(and(eq(schema.gameEvents.userId, recipient.id), eq(schema.gameEvents.eventType, "learning_path_completed"), eq(schema.gameEvents.resourceId, handoverId)))
    .limit(1);
  let points = 0;
  if (!paid) {
    const res = await record({ userId: recipient.id, type: "learning_path_completed", resourceType: "handover", resourceId: handoverId });
    points = res.points;
  }
  const h = await loadHandover(handoverId);
  const person = await personOf(h);
  const targets = new Set<string>([h.createdBy ?? "", ...(await hrAdminIds())].filter(Boolean));
  if (person.userId) targets.add(person.userId);
  for (const to of targets) {
    await notify(
      to,
      "handover_signed_off",
      `${recipient.nameEn} signed off the handover of ${person.nameEn}`,
      `وقّع ${recipient.nameAr} باستلام مهام ${person.nameAr}`,
      to === person.userId ? "/handover/mine" : `/hr/handovers/${handoverId}`
    );
  }
  await audit(recipient.id, "handover_signed_off", "handover", handoverId);
  await refreshCompletion(handoverId);
  return { signedOffAt: now, points };
}

/** A question to the leaving person: a message thread when messaging exists, a notification otherwise. */
export async function askLeavingPerson(recipient: CurrentUser, handoverId: string, text: string): Promise<{ delivered: "thread" | "notification"; threadId: string | null }> {
  const h = await loadHandover(handoverId);
  const body = text.trim().slice(0, 4000);
  if (!body) throw new HandoverError("invalid", 400);
  const person = await personOf(h);
  const toUserId = person.userId ?? h.createdBy ?? null;
  if (!toUserId) throw new HandoverError("no_recipient", 400);
  const subject = `Handover question: ${person.nameEn}`.slice(0, 200);
  try {
    // written by another agent at the same time: imported lazily, absent means a notification
    const mod = (await import("@/server/services/messaging")) as unknown as { createThread?: (u: CurrentUser, input: Record<string, unknown>) => Promise<{ id: string }> };
    if (typeof mod.createThread === "function" && toUserId !== recipient.id) {
      const res = await mod.createThread(recipient, {
        toUserId,
        subject,
        body,
        resource: { type: "handover", id: h.id, titleEn: `Handover of ${person.nameEn}`, titleAr: `تسليم مهام ${person.nameAr}`, link: `/handover/${h.id}` },
      });
      return { delivered: "thread", threadId: res.id };
    }
  } catch {
    /* fall through to the notification */
  }
  await notify(toUserId, "handover_question", `Question from ${recipient.nameEn} about your handover`, `سؤال من ${recipient.nameAr} حول تسليم مهامك`, person.userId ? "/handover/mine" : `/hr/handovers/${h.id}`, { en: body.slice(0, 300), ar: body.slice(0, 300) });
  return { delivered: "notification", threadId: null };
}

/* ------------------------------------------------------------------ */
/* 6.3 to the system: filing                                            */
/* ------------------------------------------------------------------ */

const MODULE_OF: Record<ItemCategory, FilingProposal["location"]["module"]> = {
  document: "vault",
  report: "vault",
  deliverable: "strategy",
  policy: "organisation",
  lesson: "lessons",
  project_role: "strategy",
  stakeholder_role: "strategy",
  indicator: "statistics",
  council_indicator: "council",
  expert_request: "experts",
  expert_profile: "experts",
  contact: "experts",
  community: "experts",
  org_role: "organisation",
  collection: "vault",
  tacit_topic: "lessons",
  other: "vault",
};

export async function proposeFiling(actor: CurrentUser | null, itemId: string): Promise<ItemView | null> {
  const [item] = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.id, itemId)).limit(1);
  if (!item) throw new HandoverError("not_found", 404);
  const h = await loadHandover(item.handoverId);
  await assertOpen(h);
  if (actor && !(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);
  if (item.recipientKind !== "system") throw new HandoverError("not_system_item", 400);
  const person = await personOf(h);
  const units = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.isActive, 1));
  let unit = units.find((u) => u.id === person.departmentId) ?? null;
  let nodeId: string | null = null;
  let shelf: string | null = null;
  let category: string | null = null;
  if (item.resourceType === "document") {
    const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, item.resourceId)).limit(1);
    if (d?.departmentId) unit = units.find((u) => u.id === d.departmentId) ?? unit;
    if (d?.knowledgeTypeTermId) {
      const [term] = await db.select().from(schema.taxonomyTerms).where(eq(schema.taxonomyTerms.id, d.knowledgeTypeTermId)).limit(1);
      shelf = term?.code ?? null;
    }
    const [del] = await db.select().from(schema.deliverableMeta).where(eq(schema.deliverableMeta.documentId, item.resourceId)).limit(1);
    nodeId = del?.nodeId ?? null;
  } else if (item.resourceType === "node" || item.resourceType === "council_node") {
    nodeId = item.resourceId;
  } else if (item.resourceType === "lesson") {
    const [l] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, item.resourceId)).limit(1);
    category = l?.category ?? null;
    nodeId = l?.nodeId ?? null;
  }
  // a project's owner is the natural custodian of its deliverables; else the unit head
  let custodian: string | null = null;
  if (nodeId) {
    const owners = await db.select().from(schema.nodeStakeholders).where(and(eq(schema.nodeStakeholders.nodeId, nodeId), eq(schema.nodeStakeholders.role, "owner")));
    custodian = owners.find((o) => o.userId && o.userId !== person.userId)?.userId ?? null;
    if (!custodian) {
      const [n] = await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.id, nodeId)).limit(1);
      if (n?.ownerUserId && n.ownerUserId !== person.userId) custodian = n.ownerUserId;
    }
    if (!custodian) {
      const leads = await db.select().from(schema.nodeLeads).where(and(eq(schema.nodeLeads.nodeId, nodeId), eq(schema.nodeLeads.leadKind, "department")));
      const led = leads.find((l) => l.departmentId);
      if (led?.departmentId) unit = units.find((u) => u.id === led.departmentId) ?? unit;
    }
  }
  if (!unit) unit = units.find((u) => u.headUserId) ?? null;
  if (!custodian) custodian = unit?.headUserId && unit.headUserId !== person.userId ? unit.headUserId : null;
  if (!custodian) custodian = h.successorDefaultUserId ?? h.createdBy ?? null;
  // `module` is a reserved identifier in this codebase's lint rules
  const moduleKey = MODULE_OF[(item.category ?? "other") as ItemCategory];
  const custodianUser = await userLite(custodian);

  let proposal: FilingProposal = {
    location: { module: moduleKey, unitId: unit?.id ?? null, unitCode: unit?.code ?? null, unitNameEn: unit?.nameEn ?? null, unitNameAr: unit?.nameAr ?? null, shelf, nodeId, category },
    custodianUserId: custodian,
    custodianNameEn: custodianUser?.nameEn ?? null,
    custodianNameAr: custodianUser?.nameAr ?? null,
    rationaleEn: `${item.title.slice(0, 80)} belongs to the ${moduleKey} module under ${unit?.nameEn ?? "the person's unit"}${shelf ? ` on the ${shelf} shelf` : ""}${nodeId ? ", filed with its project" : ""}; the custodian is ${custodianUser?.nameEn ?? "the unit head"} by the unit-head default.`,
    rationaleAr: `ينتمي العنصر «${item.title.slice(0, 80)}» إلى وحدة ${moduleKey} تحت ${unit?.nameAr ?? "وحدة الشخص"}${shelf ? ` على رف ${shelf}` : ""}${nodeId ? "، مع مشروعه" : ""}؛ والأمين عليه ${custodianUser?.nameAr ?? "رئيس الوحدة"} وفق قاعدة رئيس الوحدة.`,
    proposedAt: nowIso(),
    live: false,
  };
  if (await aiLive()) {
    const out = await callJson<Record<string, unknown>>(
      "system_handover_filing",
      JSON.stringify({
        item: { title: item.title, category: item.category, resourceType: item.resourceType, note: item.note, shelf, department: unit?.nameEn ?? null },
        person: { name: person.nameEn, department: person.departmentNameEn, organisation: person.organisationEn },
        units: units.slice(0, 60).map((u) => ({ id: u.id, code: u.code, nameEn: u.nameEn, headUserId: u.headUserId })),
        default: { module: moduleKey, unitId: unit?.id ?? null, custodianUserId: custodian },
      }),
      { maxTokens: 900 }
    );
    if (out && typeof out.rationale_en === "string") {
      const unitId = typeof out.unitId === "string" ? out.unitId : proposal.location.unitId;
      const chosen = units.find((u) => u.id === unitId) ?? unit;
      const cust = typeof out.custodianUserId === "string" ? await userLite(out.custodianUserId) : null;
      proposal = {
        ...proposal,
        location: {
          ...proposal.location,
          module: (["vault", "strategy", "lessons", "organisation", "experts", "statistics", "council"] as const).includes(out.module as never) ? (out.module as FilingProposal["location"]["module"]) : moduleKey,
          unitId: chosen?.id ?? null,
          unitCode: chosen?.code ?? null,
          unitNameEn: chosen?.nameEn ?? null,
          unitNameAr: chosen?.nameAr ?? null,
          shelf: typeof out.shelf === "string" ? out.shelf : shelf,
        },
        custodianUserId: cust?.id ?? custodian,
        custodianNameEn: cust?.nameEn ?? custodianUser?.nameEn ?? null,
        custodianNameAr: cust?.nameAr ?? custodianUser?.nameAr ?? null,
        rationaleEn: String(out.rationale_en),
        rationaleAr: String(out.rationale_ar ?? out.rationale_en),
        live: true,
      };
    }
  }
  await db.update(schema.handoverItems).set({ filingProposalJson: JSON.stringify(proposal), filingStatus: "proposed" }).where(eq(schema.handoverItems.id, itemId));
  if (actor) await audit(actor.id, "handover_filing_proposed", "handover_item", itemId, { module: proposal.location.module });
  const fresh = await syncItem(itemId);
  return fresh ? itemView(fresh, new Map()) : null;
}

export async function proposeAllFiling(actor: CurrentUser, handoverId: string): Promise<number> {
  const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId));
  let n = 0;
  for (const i of items) {
    if (i.inScope !== 1 || i.recipientKind !== "system" || i.filingStatus !== "none") continue;
    await proposeFiling(actor, i.id);
    n++;
  }
  return n;
}

export async function getFilingReport(handoverId: string): Promise<{ items: ItemView[]; byModule: { module: string; count: number }[]; counts: { pending: number; proposed: number; approved: number; applied: number } }> {
  const rows = (await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId))).filter((i) => i.inScope === 1 && i.recipientKind === "system");
  const items = rows.map((r) => itemView(r, new Map()));
  const byModule = new Map<string, number>();
  for (const i of items) {
    const m = i.filingProposal?.location.module ?? "unfiled";
    byModule.set(m, (byModule.get(m) ?? 0) + 1);
  }
  return {
    items,
    byModule: [...byModule.entries()].map(([module, count]) => ({ module, count })),
    counts: {
      pending: items.filter((i) => i.filingStatus === "none").length,
      proposed: items.filter((i) => i.filingStatus === "proposed").length,
      approved: items.filter((i) => i.filingStatus === "approved").length,
      applied: items.filter((i) => i.filingStatus === "applied").length,
    },
  };
}

export async function approveFiling(admin: CurrentUser, handoverId: string, itemIds: string[]): Promise<number> {
  const h = await loadHandover(handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(admin, h))) throw new HandoverError("forbidden", 403);
  const rows = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId));
  let n = 0;
  for (const r of rows) {
    if (!itemIds.includes(r.id) || r.filingStatus !== "proposed") continue;
    await db.update(schema.handoverItems).set({ filingStatus: "approved" }).where(eq(schema.handoverItems.id, r.id));
    n++;
  }
  await audit(admin.id, "handover_filing_approved", "handover", handoverId, { items: n });
  return n;
}

async function applyOne(item: ItemRow, proposal: FilingProposal, admin: CurrentUser): Promise<void> {
  const custodian = proposal.custodianUserId;
  const unitId = proposal.location.unitId;
  switch (item.resourceType) {
    case "document":
      await db
        .update(schema.documents)
        .set({ ownerUserId: custodian ?? undefined, departmentId: unitId ?? undefined, updatedAt: nowIso() })
        .where(eq(schema.documents.id, item.resourceId));
      break;
    case "lesson":
      // authorship is history; custodianship is recorded as the backup owner below
      break;
    case "expert":
      if (custodian) await db.update(schema.experts).set({ ownerUserId: custodian, updatedAt: nowIso() }).where(eq(schema.experts.id, item.resourceId));
      break;
    case "expert_request":
      if (custodian) await db.update(schema.expertRequests).set({ requesterId: custodian, updatedAt: nowIso() }).where(eq(schema.expertRequests.id, item.resourceId));
      break;
    case "community":
      if (custodian) await db.update(schema.communities).set({ leadUserId: custodian }).where(eq(schema.communities.id, item.resourceId));
      break;
    case "collection":
      if (custodian) await db.update(schema.collections).set({ ownerUserId: custodian, departmentId: unitId ?? undefined, updatedAt: nowIso() }).where(eq(schema.collections.id, item.resourceId));
      break;
    case "kpi":
      if (custodian) await db.update(schema.kpis).set({ ownerUserId: custodian }).where(eq(schema.kpis.id, item.resourceId));
      break;
    case "council_indicator":
      if (custodian) await db.update(schema.councilIndicators).set({ responsibleUserId: custodian, updatedAt: nowIso() }).where(eq(schema.councilIndicators.id, item.resourceId));
      break;
    case "node":
      if (custodian) {
        if (item.itemKind === "node_owner") {
          await db.update(schema.strategyNodes).set({ ownerUserId: custodian, updatedAt: nowIso() }).where(eq(schema.strategyNodes.id, item.resourceId));
        } else {
          const h = await loadHandover(item.handoverId);
          const person = await personOf(h);
          const cond = person.userId ? eq(schema.nodeStakeholders.userId, person.userId) : eq(schema.nodeStakeholders.expertId, person.expertId ?? "");
          await db.update(schema.nodeStakeholders).set({ userId: custodian, expertId: null, personKind: "employee", untilDate: todayIso() }).where(and(eq(schema.nodeStakeholders.nodeId, item.resourceId), cond));
        }
      }
      break;
    case "council_node":
      if (custodian) await db.update(schema.councilNodes).set({ ownerUserId: custodian, updatedAt: nowIso() }).where(eq(schema.councilNodes.id, item.resourceId));
      break;
    case "org_unit":
      if (custodian) await db.update(schema.orgUnits).set({ headUserId: custodian, updatedAt: nowIso() }).where(eq(schema.orgUnits.id, item.resourceId));
      break;
    default:
      break;
  }
  // custodianship: the named backup owner the readiness rules read
  if (custodian && !["manual", "term", "expert_engagement"].includes(item.resourceType)) {
    const [existing] = await db
      .select({ id: schema.ownershipBackups.id })
      .from(schema.ownershipBackups)
      .where(and(eq(schema.ownershipBackups.resourceType, item.resourceType), eq(schema.ownershipBackups.resourceId, item.resourceId)))
      .limit(1);
    if (existing) {
      await db.update(schema.ownershipBackups).set({ backupUserId: custodian, setBy: admin.id, setAt: nowIso() }).where(eq(schema.ownershipBackups.id, existing.id));
    } else {
      await db.insert(schema.ownershipBackups).values({ id: newId(), resourceType: item.resourceType, resourceId: item.resourceId, backupUserId: custodian, setBy: admin.id, setAt: nowIso() });
    }
  }
}

export async function applyFiling(admin: CurrentUser, handoverId: string): Promise<number> {
  const h = await loadHandover(handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(admin, h))) throw new HandoverError("forbidden", 403);
  const rows = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId));
  let n = 0;
  for (const r of rows) {
    if (r.filingStatus !== "approved" || r.inScope !== 1) continue;
    const proposal = parse<FilingProposal | null>(r.filingProposalJson, null);
    if (!proposal) continue;
    await applyOne(r, proposal, admin);
    await db.update(schema.handoverItems).set({ filingStatus: "applied", status: "captured", doneAt: r.doneAt ?? nowIso() }).where(eq(schema.handoverItems.id, r.id));
    if (r.status === "pending") await awardItemCompleted(handoverId, r.id);
    if (proposal.custodianUserId) {
      await notify(
        proposal.custodianUserId,
        "handover_custodian",
        `You are now custodian of: ${r.title.slice(0, 60)}`,
        `أصبحت أمينًا على: ${r.title.slice(0, 60)}`,
        hrefOf(r.resourceType, r.resourceId) ?? `/hr/handovers/${handoverId}`
      );
    }
    n++;
  }
  await audit(admin.id, "handover_filing_applied", "handover", handoverId, { items: n });
  await refreshCompletion(handoverId);
  return n;
}

/* ------------------------------------------------------------------ */
/* 6.2 external access link                                             */
/* ------------------------------------------------------------------ */

export async function createAccessLink(actor: CurrentUser, handoverId: string): Promise<{ token: string; expiresAt: string; url: string }> {
  const h = await loadHandover(handoverId);
  await assertOpen(h);
  if (!(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);
  if (h.personKind !== "external") throw new HandoverError("not_external", 400);
  if (h.cutOffAt) throw new HandoverError("cut_off", 409);
  const token = crypto.randomBytes(24).toString("hex");
  const day = h.lastWorkingDay ?? h.dueDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const expiresAt = `${day}T23:59:59.000Z`;
  await db
    .update(schema.handovers)
    .set({ accessTokenHash: sha256(token), accessExpiresAt: expiresAt, accessRevokedAt: null, updatedAt: nowIso() })
    .where(eq(schema.handovers.id, handoverId));
  await audit(actor.id, "handover_access_created", "handover", handoverId, { expiresAt });
  return { token, expiresAt, url: `/handover/access/${token}` };
}

export async function revokeAccess(actor: CurrentUser | null, handoverId: string, reason = "revoked"): Promise<void> {
  const h = await loadHandover(handoverId);
  if (actor && !(await isAdminFor(actor, h))) throw new HandoverError("forbidden", 403);
  if (!h.accessTokenHash || h.accessRevokedAt) return;
  await db.update(schema.handovers).set({ accessRevokedAt: nowIso(), updatedAt: nowIso() }).where(eq(schema.handovers.id, handoverId));
  await audit(actor?.id ?? null, "handover_access_revoked", "handover", handoverId, { reason });
}

export async function resolveAccessToken(token: string): Promise<HandoverRow | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const [h] = await db.select().from(schema.handovers).where(eq(schema.handovers.accessTokenHash, sha256(token))).limit(1);
  if (!h) return null;
  if (h.accessRevokedAt || h.cutOffAt || h.status === "complete") return null;
  if (!h.accessExpiresAt || h.accessExpiresAt < nowIso()) return null;
  return h;
}

/** The minimal workspace of the token holder. */
export async function getTokenWorkspace(token: string): Promise<HandoverDetail | null> {
  const h = await resolveAccessToken(token);
  if (!h) return null;
  const detail = await buildDetail(h, "token", null);
  // the external sees their checklist and their own interviews; never recipients or filing internals
  return { ...detail, recipients: [], filing: { ...detail.filing, items: [] } };
}

/** A text note or an uploaded file added through the token, owned by the NPC counterpart. */
export async function addItemViaToken(
  token: string,
  input: { title: string; note: string | null; text?: string | null; file?: { name: string; mime: string; data: Buffer } | null }
): Promise<ItemView[]> {
  const h = await resolveAccessToken(token);
  if (!h) throw new HandoverError("token_invalid", 403);
  const counterpart = h.successorDefaultUserId ?? h.createdBy;
  const owner = counterpart ? await getUserById(counterpart) : null;
  const person = await personOf(h);
  const title = input.title.trim().slice(0, 180);
  if (!title) throw new HandoverError("invalid", 400);
  if (!input.file && !(input.text ?? "").trim()) {
    return addHandoverItem({ userId: null, admin: false }, h.id, { title, category: "tacit_topic", note: input.note });
  }
  const { put, putText } = await import("@/server/storage");
  const id = newId();
  const versionId = newId();
  const storagePath = input.file ? await put(id, input.file.name, input.file.data) : await putText(id, "note.txt", `${title}\n\n${input.text ?? ""}`);
  await db.insert(schema.documents).values({
    id,
    titleEn: title,
    titleAr: title,
    titleArMachine: 0,
    summaryEn: (input.text ?? input.note ?? "").slice(0, 800) || `Handed over by ${person.nameEn}.`,
    summaryAr: (input.text ?? input.note ?? "").slice(0, 800) || `سلّمه ${person.nameAr}.`,
    summaryMachine: 0,
    keyFactsJson: JSON.stringify([{ text_en: `Handed over by ${person.nameEn}${person.organisationEn ? ` (${person.organisationEn})` : ""}`, text_ar: `سلّمه ${person.nameAr}${person.organisationAr ? ` (${person.organisationAr})` : ""}`, page: null }]),
    classificationLevel: 2,
    departmentId: owner?.departmentId ?? null,
    ownerUserId: owner?.id ?? null,
    languageOriginal: "en",
    status: "draft",
    sourceOrigin: "external",
    originalFilename: input.file?.name ?? "note.txt",
    mime: input.file?.mime ?? "text/plain",
    sizeBytes: input.file?.data.length ?? (input.text ?? "").length,
    storagePath,
    currentVersionId: versionId,
    isSeeded: 0,
    sourceRef: `handover:${h.id}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await db.insert(schema.documentVersions).values({ id: versionId, documentId: id, versionNo: 1, storagePath, uploadedBy: owner?.id ?? null, note: `Handover upload by ${person.nameEn}`, createdAt: nowIso() });
  try {
    const { enqueue } = await import("@/server/jobs/queue");
    await enqueue("ingest_document", { documentId: id });
  } catch {
    /* best effort */
  }
  await audit(null, "handover_token_upload", "document", id, { handoverId: h.id });
  return addHandoverItem({ userId: null, admin: false }, h.id, { published: [{ type: "document", id }], note: input.note });
}

/* ------------------------------------------------------------------ */
/* 6.4 close, cut-off, the report                                       */
/* ------------------------------------------------------------------ */

export async function canClose(handoverId: string): Promise<Readiness> {
  const h = await loadHandover(handoverId);
  const [items, interviews, paths] = await Promise.all([
    db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, handoverId)),
    db.select().from(schema.handoverInterviews).where(eq(schema.handoverInterviews.handoverId, handoverId)),
    db.select().from(schema.handoverLearningPaths).where(eq(schema.handoverLearningPaths.handoverId, handoverId)),
  ]);
  return readinessOf(items, interviews, paths, h.interviewRequired === 1);
}

const CATEGORY_LABEL: Record<ItemCategory, BiText> = Object.fromEntries(Object.entries(CATEGORY_TOPIC).map(([k, v]) => [k, bi(v.en, v.ar)])) as Record<ItemCategory, BiText>;

const STATUS_LABEL: Record<string, BiText> = {
  pending: bi("Pending", "قيد الانتظار"),
  reassigned: bi("Reassigned", "أُعيد إسناده"),
  captured: bi("Filed", "أُودع"),
  not_needed: bi("Not needed", "غير مطلوب"),
};

/** The ReportDocumentModel of the handover report (CR08 5 design, both languages). */
export async function buildHandoverReportModel(detail: HandoverDetail, admin: CurrentUser): Promise<ReportDocumentModel> {
  const person = detail.person;
  const kindLabel: Record<HandoverKind, BiText> = {
    leaving: bi("Leaving", "مغادرة"),
    transferring: bi("Transferring", "نقل"),
    long_leave: bi("Long leave", "إجازة طويلة"),
    engagement_ending: bi("Engagement ending", "انتهاء التكليف"),
  };
  const from = detail.createdAt.slice(0, 10);
  const to = (detail.completedAt ?? nowIso()).slice(0, 10);
  const year = Number(to.slice(0, 4));
  const inScope = detail.items.filter((i) => i.inScope && i.status !== "not_needed");
  const toPerson = inScope.filter((i) => i.recipientKind === "person");
  const toSystem = inScope.filter((i) => i.recipientKind === "system");
  const sources: SourceItem[] = [];
  const sourceN = (title: string, detailText?: string) => {
    const hit = sources.find((s) => s.title === title);
    if (hit) return hit.n;
    const n = sources.length + 1;
    sources.push({ n, title, detail: detailText });
    return n;
  };
  const sections: SectionContent[] = [];
  sections.push({ code: "cover", title: bi("Handover report", "تقرير التسليم"), lead: bi(`${person.nameEn}, ${kindLabel[detail.kind].en}`, `${person.nameAr}، ${kindLabel[detail.kind].ar}`), layout: "cover", blocks: [] });
  sections.push({ code: "contents", title: bi("Contents", "المحتويات"), layout: "contents", blocks: [] });
  sections.push({
    code: "handover_summary",
    title: bi("The handover at a glance", "التسليم في لمحة"),
    lead: bi(
      `${person.nameEn}${person.positionEn ? `, ${person.positionEn}` : ""}${person.departmentNameEn ? ` (${person.departmentNameEn})` : person.organisationEn ? ` (${person.organisationEn})` : ""} handed over ${inScope.length} items between ${from} and ${to}.`,
      `سلّم ${person.nameAr}${person.positionAr ? `، ${person.positionAr}` : ""}${person.departmentNameAr ? ` (${person.departmentNameAr})` : person.organisationAr ? ` (${person.organisationAr})` : ""} ${inScope.length} من العناصر بين ${from} و${to}.`
    ),
    keyFigure: { value: String(inScope.length), label: bi("items handed over", "عنصرًا مُسلَّمًا") },
    layout: "opener",
    blocks: [
      {
        kind: "kpis",
        items: [
          { label: bi("To people", "إلى أشخاص"), value: String(toPerson.length), tone: "maroon" },
          { label: bi("To the system", "إلى النظام"), value: String(toSystem.length), tone: "gulf" },
          { label: bi("Interviews complete", "مقابلات مكتملة"), value: String(detail.progress.interviews.complete), tone: "gold" },
          { label: bi("Recipients signed off", "مستلمون وقّعوا"), value: `${detail.progress.paths.signedOff}/${detail.progress.paths.total}`, tone: "ink" },
        ],
      },
      {
        kind: "bullets",
        items: [
          bi(`Kind: ${kindLabel[detail.kind].en}${detail.reason ? `. Reason: ${detail.reason}` : ""}`, `النوع: ${kindLabel[detail.kind].ar}${detail.reason ? `. السبب: ${detail.reason}` : ""}`),
          bi(`Last working day: ${detail.lastWorkingDay ?? "not set"}; due date: ${detail.dueDate ?? "not set"}.`, `آخر يوم عمل: ${detail.lastWorkingDay ?? "غير محدد"}؛ تاريخ الاستحقاق: ${detail.dueDate ?? "غير محدد"}.`),
          bi(`Started by ${detail.createdBy?.nameEn ?? "an administrator"} on ${from}; closed by ${admin.nameEn} on ${to}.`, `بدأه ${detail.createdBy?.nameAr ?? "مسؤول"} في ${from}؛ وأغلقه ${admin.nameAr} في ${to}.`),
          ...(detail.overrideReason ? [bi(`Closed with an administrator override: ${detail.overrideReason}`, `أُغلق بتجاوز إداري: ${detail.overrideReason}`)] : []),
          ...(detail.cutOffAt ? [bi(`Access cut off on ${detail.cutOffAt.slice(0, 10)}.`, `قُطع الوصول في ${detail.cutOffAt.slice(0, 10)}.`)] : []),
        ],
      },
    ],
    sources: [],
  });
  for (const cat of detail.categories) {
    const rows = cat.items.filter((i) => i.inScope && i.status !== "not_needed");
    if (!rows.length) continue;
    sections.push({
      code: `items_${cat.code}`,
      title: CATEGORY_LABEL[cat.code],
      layout: "body",
      blocks: [
        {
          kind: "paragraph",
          style: "lead",
          text: bi(`${rows.length} item${rows.length === 1 ? "" : "s"} in this category, ${rows.filter((r) => r.recipientKind === "person").length} to people and ${rows.filter((r) => r.recipientKind === "system").length} to the system.`, `${rows.length} من العناصر في هذه الفئة، ${rows.filter((r) => r.recipientKind === "person").length} إلى أشخاص و${rows.filter((r) => r.recipientKind === "system").length} إلى النظام.`),
        },
        {
          kind: "table",
          columns: [bi("Item", "العنصر"), bi("Recipient", "المستلم"), bi("Status", "الحالة"), bi("Handover note", "ملاحظة التسليم")],
          rows: rows.map((r) => {
            if (r.resourceType === "document") sourceN(r.title, "SiaNexus Institutional Memory");
            const recipient = r.recipientKind === "system" ? bi(`Institutional Memory${r.filingProposal?.custodianNameEn ? ` (custodian ${r.filingProposal.custodianNameEn})` : ""}`, `مكتبة المعرفة${r.filingProposal?.custodianNameAr ? ` (الأمين ${r.filingProposal.custodianNameAr})` : ""}`) : r.recipient ? bi(r.recipient.nameEn, r.recipient.nameAr) : bi("Undecided", "لم يُقرر");
            return [bi(r.title, r.title), recipient, STATUS_LABEL[r.status] ?? bi(r.status, r.status), bi((r.note ?? "").slice(0, 300) || "No note", (r.note ?? "").slice(0, 300) || "لا توجد ملاحظة")];
          }),
          align: ["start", "start", "start", "start"],
        },
      ],
      sources: [],
    });
  }
  detail.interviews
    .filter((iv) => iv.status === "complete" && iv.structured)
    .forEach((iv, idx) => {
      const s = iv.structured!;
      const list = (l: BiLine[]) => l.map((x) => bi(x.en, x.ar));
      sections.push({
        code: `interview_${idx + 1}`,
        title: bi(`Capture interview: ${iv.topic}`, `مقابلة التوثيق: ${iv.topic}`),
        layout: "body",
        blocks: [
          { kind: "paragraph", style: "lead", text: bi(s.summaryEn, s.summaryAr) },
          ...(s.statusEn ? [{ kind: "heading" as const, level: 3 as const, text: bi("Status", "الوضع") }, { kind: "paragraph" as const, text: bi(s.statusEn, s.statusAr) }] : []),
          ...(s.decisions.length ? [{ kind: "heading" as const, level: 3 as const, text: bi("Decisions", "القرارات") }, { kind: "bullets" as const, items: list(s.decisions) }] : []),
          ...(s.contacts.length ? [{ kind: "heading" as const, level: 3 as const, text: bi("Contacts", "جهات الاتصال") }, { kind: "bullets" as const, items: list(s.contacts) }] : []),
          ...(s.pitfalls.length ? [{ kind: "heading" as const, level: 3 as const, text: bi("Pitfalls", "المزالق") }, { kind: "bullets" as const, items: list(s.pitfalls) }] : []),
          ...(s.locations.length ? [{ kind: "heading" as const, level: 3 as const, text: bi("Where things live", "مواقع الملفات") }, { kind: "bullets" as const, items: list(s.locations) }] : []),
          ...(s.adviceEn ? [{ kind: "quote" as const, text: bi(s.adviceEn, s.adviceAr), attribution: bi(person.nameEn, person.nameAr) }] : []),
        ],
        sources: [],
      });
    });
  sections.push({
    code: "handover_scorecard",
    title: bi("Recipients and readiness", "المستلمون والجاهزية"),
    layout: "scorecard",
    blocks: [
      {
        kind: "scorecard",
        caption: bi("Every recipient with the items assigned, the modules understood and the sign-off.", "كل مستلم مع العناصر المسندة إليه والوحدات المفهومة والتوقيع."),
        columns: [bi("Items", "العناصر"), bi("Understood", "مفهومة"), bi("Learning path", "مسار التعلم"), bi("Signed off", "التوقيع")],
        rows: [
          ...detail.recipients.map((r) => ({
            label: bi(r.user.nameEn, r.user.nameAr),
            cells: [
              { text: String(r.items) },
              { text: `${r.understood}/${r.items}`, rag: (r.items === 0 ? "none" : r.understood === r.items ? "green" : r.understood > 0 ? "amber" : "red") as "none" | "green" | "amber" | "red" },
              { text: r.path ? `${r.path.progress.pct}%` : "0%", rag: (r.path ? (r.path.progress.pct === 100 ? "green" : r.path.progress.pct > 0 ? "amber" : "red") : "red") as "green" | "amber" | "red" },
              { text: r.path?.signedOffAt ? r.path.signedOffAt.slice(0, 10) : "open", rag: (r.path?.signedOffAt ? "green" : "red") as "green" | "red" },
            ],
          })),
          {
            label: bi("Institutional Memory", "مكتبة المعرفة"),
            cells: [
              { text: String(toSystem.length) },
              { text: `${detail.filing.applied}/${toSystem.length}`, rag: (toSystem.length === 0 ? "none" : detail.filing.applied === toSystem.length ? "green" : "amber") as "none" | "green" | "amber" },
              { text: "filed", rag: "none" as const },
              { text: detail.filing.applied === toSystem.length ? "complete" : "open", rag: (detail.filing.applied === toSystem.length ? "green" : "amber") as "green" | "amber" },
            ],
          },
        ],
      },
    ],
    sources: [],
  });
  sections.push({ code: "sources_appendix", title: bi("Sources", "المصادر"), layout: "sources", blocks: [{ kind: "sources", items: sources }], sources });
  sections.push({ code: "closing", title: bi("SiaNexus", "سيا نكسس"), layout: "closing", blocks: [] });
  let n = 0;
  const numbered = sections.map((s) => (s.code === "cover" || s.code === "contents" || s.code === "closing" ? s : { ...s, numeral: String(++n).padStart(2, "0") }));
  return {
    request: {
      reportId: detail.id,
      typeCode: "handover_report",
      family: "internal",
      period: { kind: "range", year, from, to, label: bi(`${from} to ${to}`, `من ${from} إلى ${to}`) },
      scope: { kind: "department", id: person.departmentId, code: person.departmentCode, label: bi(person.nameEn, person.nameAr) },
      audience: "working",
      languageMode: "both",
      sectionCodes: numbered.map((s) => s.code),
      classification: 2,
      requestedBy: admin.id,
    },
    typeName: bi("Handover report", "تقرير التسليم"),
    title: bi(`Handover report: ${person.nameEn}`, `تقرير التسليم: ${person.nameAr}`),
    subtitle: bi(`${kindLabel[detail.kind].en}, ${from} to ${to}`, `${kindLabel[detail.kind].ar}، من ${from} إلى ${to}`),
    periodLabel: bi(`${from} to ${to}`, `من ${from} إلى ${to}`),
    yearMark: String(year),
    classification: 2,
    generatedAt: nowIso(),
    preparedBy: bi(admin.nameEn, admin.nameAr),
    sections: numbered,
    coverFigure: { value: String(inScope.length), label: bi("items handed over", "عنصرًا مُسلَّمًا") },
  };
}

const REPORT_DIR = dataPath("reports", "handover");

/** Renders the report in both languages and archives it into the Institutional Memory. */
async function archiveReport(admin: CurrentUser, detail: HandoverDetail): Promise<{ documentId: string | null; paths: { en: string | null; ar: string | null }; error: string | null }> {
  const model = await buildHandoverReportModel(detail, admin);
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const paths: { en: string | null; ar: string | null } = { en: null, ar: null };
  const buffers: { en: Buffer | null; ar: Buffer | null } = { en: null, ar: null };
  let error: string | null = null;
  try {
    const { renderReportDocx } = await import("@/server/reports/template");
    for (const lang of ["en", "ar"] as const) {
      const abs = path.join(REPORT_DIR, `${detail.id}-${lang}.docx`);
      const buf = await renderReportDocx(model, { lang, outPath: abs });
      try {
        await fs.access(abs);
      } catch {
        await fs.writeFile(abs, buf);
      }
      paths[lang] = `reports/handover/${detail.id}-${lang}.docx`;
      buffers[lang] = buf;
    }
  } catch (e) {
    error = String((e as Error)?.message ?? e).slice(0, 300);
    console.error("[handover] report render failed:", error);
  }
  const primary = buffers.en ?? buffers.ar;
  if (!primary) return { documentId: null, paths, error: error ?? "no_render" };
  const [dim] = await db.select().from(schema.taxonomyDimensions).where(eq(schema.taxonomyDimensions.code, "knowledge_type")).limit(1);
  const [reportTerm] = dim
    ? await db.select().from(schema.taxonomyTerms).where(and(eq(schema.taxonomyTerms.dimensionId, dim.id), eq(schema.taxonomyTerms.code, "report"))).limit(1)
    : [];
  const { put } = await import("@/server/storage");
  const documentId = newId();
  const person = detail.person;
  const filename = `Handover report ${person.nameEn.replace(/[^\w؀-ۿ -]+/g, "").slice(0, 50)} en.docx`;
  const storagePath = await put(documentId, filename, primary);
  const versionId = newId();
  const now = nowIso();
  await db.insert(schema.documents).values({
    id: documentId,
    titleEn: `Handover report: ${person.nameEn}`,
    titleAr: `تقرير التسليم: ${person.nameAr}`,
    titleArMachine: 0,
    summaryEn: `Handover report of ${person.nameEn} (${detail.kind.replace("_", " ")}): ${detail.progress.items.total} items, ${detail.progress.interviews.complete} capture interviews, ${detail.recipients.length} recipients.`,
    summaryAr: `تقرير تسليم مهام ${person.nameAr}: ${detail.progress.items.total} من العناصر، و${detail.progress.interviews.complete} من مقابلات التوثيق، و${detail.recipients.length} من المستلمين.`,
    summaryMachine: 0,
    keyFactsJson: JSON.stringify([
      { text_en: `Kind: ${detail.kind}; last working day ${detail.lastWorkingDay ?? "not set"}`, text_ar: `النوع: ${detail.kind}؛ آخر يوم عمل ${detail.lastWorkingDay ?? "غير محدد"}`, page: 1 },
      { text_en: `Items: ${detail.progress.items.total}; recipients: ${detail.recipients.map((r) => r.user.nameEn).join(", ") || "Institutional Memory"}`, text_ar: `العناصر: ${detail.progress.items.total}؛ المستلمون: ${detail.recipients.map((r) => r.user.nameAr).join("، ") || "مكتبة المعرفة"}`, page: 1 },
    ]),
    knowledgeTypeTermId: reportTerm?.id ?? null,
    classificationLevel: 2,
    departmentId: person.departmentId ?? admin.departmentId,
    ownerUserId: admin.id,
    languageOriginal: "en",
    status: "published",
    sourceOrigin: "npc",
    publishYear: Number(now.slice(0, 4)),
    originalFilename: filename,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: primary.length,
    storagePath,
    currentVersionId: versionId,
    isSeeded: 0,
    sourceRef: `handover:${detail.id}`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.documentVersions).values({ id: versionId, documentId, versionNo: 1, storagePath, uploadedBy: admin.id, note: "English edition", createdAt: now });
  if (buffers.ar && buffers.en) {
    const arPath = await put(documentId, filename.replace(/ en\.docx$/, " ar.docx"), buffers.ar);
    await db.insert(schema.documentVersions).values({ id: newId(), documentId, versionNo: 2, storagePath: arPath, uploadedBy: admin.id, note: "Arabic edition", createdAt: now });
  }
  try {
    const { enqueue } = await import("@/server/jobs/queue");
    await enqueue("ingest_document", { documentId });
  } catch {
    /* best effort */
  }
  await audit(admin.id, "create", "document", documentId, { fromHandover: detail.id });
  return { documentId, paths, error };
}

export async function closeHandover(admin: CurrentUser, handoverId: string, opts: { override?: string | null } = {}): Promise<{ closed: boolean; reportDocumentId: string | null; reportError: string | null }> {
  const h = await loadHandover(handoverId);
  if (!(await isAdminFor(admin, h))) throw new HandoverError("forbidden", 403);
  if (h.status === "complete") return { closed: true, reportDocumentId: h.reportDocumentId, reportError: null };
  const readiness = await canClose(handoverId);
  const override = opts.override?.trim() || null;
  if (!readiness.ok && !override) throw new HandoverError("not_ready", 409, { checks: readiness.checks });
  const now = nowIso();
  if (!readiness.ok && override) {
    await db.update(schema.handovers).set({ overrideReason: override.slice(0, 1000), overrideBy: admin.id, updatedAt: now }).where(eq(schema.handovers.id, handoverId));
    await audit(admin.id, "handover_override", "handover", handoverId, { reason: override.slice(0, 300), failed: readiness.checks.filter((c) => !c.ok).map((c) => c.code) });
  }
  await db
    .update(schema.handovers)
    .set({ status: "complete", completedAt: now, completionPct: 100, updatedAt: now })
    .where(eq(schema.handovers.id, handoverId));
  const detail = await buildDetail(await loadHandover(handoverId), "admin", admin.id);
  const report = await archiveReport(admin, detail);
  if (report.documentId) {
    await db.update(schema.handovers).set({ reportDocumentId: report.documentId, updatedAt: nowIso() }).where(eq(schema.handovers.id, handoverId));
  }
  /* points: 60 to the default recipient, 40 to the leaving person when closed before the due date */
  const beforeDue = !h.dueDate || now.slice(0, 10) <= h.dueDate;
  if (h.successorDefaultUserId) {
    await record({ userId: h.successorDefaultUserId, type: "handover_completed", resourceType: "handover", resourceId: handoverId });
  }
  if (beforeDue && h.personKind === "employee") {
    await record({ userId: h.userId, type: "handover_completed_owner", resourceType: "handover", resourceId: handoverId });
  }
  const person = detail.person;
  const targets = new Set<string>([...detail.recipients.map((r) => r.user.id), h.successorDefaultUserId ?? "", h.createdBy ?? "", ...(await hrAdminIds())].filter(Boolean));
  if (person.userId) targets.add(person.userId);
  targets.delete(admin.id);
  for (const to of targets) {
    await notify(
      to,
      "handover_closed",
      `Handover closed: ${person.nameEn}`,
      `أُغلق التسليم: ${person.nameAr}`,
      report.documentId ? `/vault/${report.documentId}` : `/hr/handovers/${handoverId}`,
      report.documentId ? { en: "The handover report is archived in the Institutional Memory.", ar: "أُرشف تقرير التسليم في مكتبة المعرفة." } : undefined
    );
  }
  await audit(admin.id, "handover_closed", "handover", handoverId, { override: Boolean(override), reportDocumentId: report.documentId });
  return { closed: true, reportDocumentId: report.documentId, reportError: report.error };
}

/** The explicit cut-off: the person's access ends now; the external token is revoked. */
export async function performCutOff(admin: CurrentUser, handoverId: string): Promise<{ cutOffAt: string }> {
  const h = await loadHandover(handoverId);
  if (!(await isAdminFor(admin, h))) throw new HandoverError("forbidden", 403);
  if (h.cutOffAt) return { cutOffAt: h.cutOffAt };
  const now = nowIso();
  if (h.personKind === "external") {
    await revokeAccess(admin, handoverId, "cut_off");
  } else {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, h.userId));
    // the login lockout mechanism holds the account closed until an administrator lifts it
    await db.update(schema.users).set({ lockedUntil: "2099-12-31T00:00:00.000Z", updatedAt: now }).where(eq(schema.users.id, h.userId));
  }
  await db.update(schema.handovers).set({ cutOffAt: now, cutOffBy: admin.id, updatedAt: now }).where(eq(schema.handovers.id, handoverId));
  await audit(admin.id, "handover_cut_off", "handover", handoverId, { personKind: h.personKind });
  const person = await personOf(h);
  for (const to of [h.createdBy, ...(await hrAdminIds())].filter((x): x is string => Boolean(x) && x !== admin.id)) {
    await notify(to, "handover_cut_off", `Access cut off: ${person.nameEn}`, `قُطع الوصول: ${person.nameAr}`, `/hr/handovers/${handoverId}`);
  }
  return { cutOffAt: now };
}

/** The rendered report file for download (en or ar). */
export async function reportFile(handoverId: string, lang: "en" | "ar"): Promise<{ buffer: Buffer; filename: string } | null> {
  const h = await loadHandover(handoverId);
  const abs = path.join(REPORT_DIR, `${handoverId}-${lang}.docx`);
  try {
    const buffer = await fs.readFile(abs);
    const person = await personOf(h);
    return { buffer, filename: `Handover report ${person.nameEn.replace(/[^\w؀-ۿ -]+/g, "").slice(0, 50)} ${lang}.docx` };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* the nightly job                                                      */
/* ------------------------------------------------------------------ */

export async function runHandoverNightly(): Promise<{ reminders: number; expired: number; refreshed: number }> {
  const rows = await db.select().from(schema.handovers).where(ne(schema.handovers.status, "complete"));
  const now = nowIso();
  let reminders = 0;
  let expired = 0;
  let refreshed = 0;
  const todayStart = todayIso() + "T00:00:00.000Z";
  // one reminder per person and link per day, however often the job runs
  const recent = (await db.select({ userId: schema.notifications.userId, link: schema.notifications.link, createdAt: schema.notifications.createdAt }).from(schema.notifications).where(eq(schema.notifications.kind, "handover_due"))).filter((n) => n.createdAt >= todayStart);
  for (const h of rows) {
    const day = h.lastWorkingDay ?? h.dueDate;
    const days = daysUntil(day);
    if (days !== null && [14, 7, 1].includes(days)) {
      const person = await personOf(h);
      const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
      const recipients = new Set(items.filter((i) => i.recipientKind === "person" && i.recipientUserId).map((i) => i.recipientUserId!));
      if (h.successorDefaultUserId) recipients.add(h.successorDefaultUserId);
      const targets: { id: string; link: string }[] = [...recipients].map((id) => ({ id, link: `/handover/${h.id}` }));
      if (person.userId) targets.push({ id: person.userId, link: "/handover/mine" });
      if (h.createdBy) targets.push({ id: h.createdBy, link: `/hr/handovers/${h.id}` });
      for (const t of targets) {
        if (recent.some((n) => n.userId === t.id && n.link === t.link)) continue;
        await notify(
          t.id,
          "handover_due",
          `Handover of ${person.nameEn}: ${days} day${days === 1 ? "" : "s"} to the last working day`,
          `تسليم ${person.nameAr}: ${days === 1 ? "يوم واحد" : `${days} أيام`} حتى آخر يوم عمل`,
          t.link,
          { en: `Completion stands at ${h.completionPct}%.`, ar: `نسبة الإنجاز الحالية ${h.completionPct}%.` }
        );
        reminders++;
      }
    }
    if (h.accessTokenHash && !h.accessRevokedAt && h.accessExpiresAt && h.accessExpiresAt < now) {
      await db.update(schema.handovers).set({ accessRevokedAt: now, updatedAt: now }).where(eq(schema.handovers.id, h.id));
      await audit(null, "handover_access_expired", "handover", h.id);
      expired++;
    }
    await refreshCompletion(h.id);
    refreshed++;
  }
  return { reminders, expired, refreshed };
}
