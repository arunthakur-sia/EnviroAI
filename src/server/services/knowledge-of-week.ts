// CR08 8: Knowledge of the Week. One pick per ISO week (Monday to Sunday)
// chosen by a Super Admin or a Knowledge Admin from a verified document,
// lesson, study or report. The hourly `kow_rollover` job (worker.ts) calls
// `rolloverKnowledgeOfWeek()`: it archives the active pick whose week ended
// and activates the scheduled pick whose week has started, paying the
// contributor (150 points and a permanent badge), the contributor's unit
// (100 points on the Departments board) and notifying the contributor and
// the unit head. Readers earn 10 points once for reading the pick in full.
// Every page reads through this file: the Home reveal and strip, the Hall of
// Knowledge, the ribbons (a small cached id set), the profile award and the
// Ask NPC tool.
import { and, desc, eq, inArray, lt, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can, canReadResource } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { notify, record } from "@/server/gamification/engine";
import { getSetting } from "@/server/settings";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export const KOW_RESOURCE_TYPES = ["document", "lesson", "study", "report"] as const;
export type KowResourceType = (typeof KOW_RESOURCE_TYPES)[number];
export type KowStatus = "scheduled" | "active" | "archived";

export const KOW_BADGE_CODE = "knowledge_of_week";
export const KOW_POINTS = { contributor: 150, unit: 100, read: 10 } as const;
/** The setting the seed writes so illustrative picks carry the chip. */
export const KOW_SEEDED_SETTING = "kow_seeded";

export type KowContributor = {
  id: string;
  nameEn: string;
  nameAr: string;
  positionEn: string | null;
  positionAr: string | null;
  color: string;
  unitId: string | null;
  unitNameEn: string | null;
  unitNameAr: string | null;
  /** The unit breadcrumb from the top, "Sector / Department" */
  unitPathEn: string | null;
  unitPathAr: string | null;
};

export type KowCard = {
  id: string;
  weekStart: string;
  /** The Sunday that closes the week */
  weekEnd: string;
  status: KowStatus;
  resourceType: KowResourceType;
  resourceId: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  href: string;
  classificationLevel: number;
  contributor: KowContributor | null;
  noteEn: string | null;
  noteAr: string | null;
  setByNameEn: string | null;
  setByNameAr: string | null;
  setAt: string;
  readCount: number;
  viewerRead: boolean;
  viewerSeen: boolean;
  illustrative: boolean;
};

export type KowHall = {
  canManage: boolean;
  current: KowCard | null;
  /** Upcoming scheduled picks, administrators only */
  scheduled: KowCard[];
  months: { key: string; items: KowCard[] }[];
  total: number;
};

export type SetKowInput = {
  resourceType: KowResourceType;
  resourceId: string;
  weekStart: string;
  noteEn?: string | null;
  noteAr?: string | null;
  replace?: boolean;
};

export type SetKowResult =
  | { ok: true; id: string; status: KowStatus; replaced: boolean; weekStart: string }
  | {
      ok: false;
      error: "forbidden" | "not_found" | "not_eligible" | "bad_week" | "conflict";
      existing?: { id: string; titleEn: string; titleAr: string; weekStart: string; status: KowStatus };
    };

type KowRow = typeof schema.knowledgeOfWeek.$inferSelect;

/* ------------------------------------------------------------------ */
/* Weeks                                                                */
/* ------------------------------------------------------------------ */

/** The Monday of the ISO week that holds `date`, as YYYY-MM-DD. */
export function weekStartOf(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isMondayIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

/* ------------------------------------------------------------------ */
/* Permissions                                                          */
/* ------------------------------------------------------------------ */

/** Super Admin (manages settings) or the Knowledge Admin role. */
export function canManageKnowledgeOfWeek(user: CurrentUser | null): boolean {
  if (!user) return false;
  return can(user, "manage", "settings") || user.role.nameEn === "Knowledge Admin";
}

/* ------------------------------------------------------------------ */
/* Resource resolution                                                  */
/* ------------------------------------------------------------------ */

type Resolved = {
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  href: string;
  ownerId: string | null;
  classificationLevel: number;
  departmentId: string | null;
  eligible: boolean;
};

function keyOf(type: string, id: string): string {
  return `${type === "study" ? "document" : type}:${id}`;
}

/** Loads the titles, summaries, owners and eligibility of a set of picks in
    three queries (documents, lessons, reports). */
async function resolveResources(refs: { type: string; id: string }[]): Promise<Map<string, Resolved>> {
  const out = new Map<string, Resolved>();
  const docIds = [...new Set(refs.filter((r) => r.type === "document" || r.type === "study").map((r) => r.id))];
  const lessonIds = [...new Set(refs.filter((r) => r.type === "lesson").map((r) => r.id))];
  const reportIds = [...new Set(refs.filter((r) => r.type === "report").map((r) => r.id))];

  if (docIds.length) {
    const docs = await db.select().from(schema.documents).where(inArray(schema.documents.id, docIds));
    for (const d of docs) {
      out.set(`document:${d.id}`, {
        titleEn: d.titleEn,
        titleAr: d.titleAr,
        summaryEn: d.summaryEn,
        summaryAr: d.summaryAr,
        href: `/vault/${d.id}`,
        ownerId: d.ownerUserId,
        classificationLevel: d.classificationLevel,
        departmentId: d.departmentId,
        eligible: d.status === "verified" && !d.deletedAt,
      });
    }
  }
  if (lessonIds.length) {
    const lessons = await db.select().from(schema.lessons).where(inArray(schema.lessons.id, lessonIds));
    for (const l of lessons) {
      out.set(`lesson:${l.id}`, {
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        summaryEn: l.learningEn ?? l.contextEn,
        summaryAr: l.learningAr ?? l.contextAr,
        href: `/lessons/${l.id}`,
        ownerId: l.authorId,
        classificationLevel: l.classificationLevel,
        departmentId: null,
        eligible: l.status === "verified",
      });
    }
  }
  if (reportIds.length) {
    const reports = await db.select().from(schema.reports).where(inArray(schema.reports.id, reportIds));
    const typeIds = [...new Set(reports.map((r) => r.typeId).filter(Boolean))] as string[];
    const types = typeIds.length
      ? await db.select().from(schema.reportTypes).where(inArray(schema.reportTypes.id, typeIds))
      : [];
    const typeById = new Map(types.map((t) => [t.id, t]));
    for (const r of reports) {
      const type = r.typeId ? typeById.get(r.typeId) : null;
      out.set(`report:${r.id}`, {
        titleEn: r.titleEn ?? r.title,
        titleAr: r.titleAr ?? r.title,
        summaryEn: type?.descriptionEn ?? null,
        summaryAr: type?.descriptionAr ?? null,
        href: `/reports/${r.id}`,
        ownerId: r.requestedBy ?? r.createdBy,
        classificationLevel: r.classificationLevel,
        departmentId: null,
        eligible: r.status === "approved" || r.status === "published",
      });
    }
  }
  return out;
}

type UnitLite = { id: string; nameEn: string; nameAr: string; parentId: string | null; headUserId: string | null };

async function unitMap(): Promise<Map<string, UnitLite>> {
  const rows = await db
    .select({
      id: schema.orgUnits.id,
      nameEn: schema.orgUnits.nameEn,
      nameAr: schema.orgUnits.nameAr,
      parentId: schema.orgUnits.parentId,
      headUserId: schema.orgUnits.headUserId,
    })
    .from(schema.orgUnits);
  return new Map(rows.map((u) => [u.id, u]));
}

function unitPath(units: Map<string, UnitLite>, unitId: string | null, lang: "En" | "Ar"): string | null {
  if (!unitId) return null;
  const names: string[] = [];
  let current = units.get(unitId);
  for (let i = 0; i < 5 && current; i++) {
    names.unshift(lang === "En" ? current.nameEn : current.nameAr);
    current = current.parentId ? units.get(current.parentId) : undefined;
  }
  if (!names.length) return null;
  // the Secretary General level is the root of every path and adds nothing;
  // what remains is the sector and the unit, at most two names
  const below = names.length > 1 ? names.slice(1) : names;
  return below.slice(-2).join(" / ");
}

async function contributorsOf(ids: string[]): Promise<Map<string, KowContributor>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const [users, units] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        nameEn: schema.users.nameEn,
        nameAr: schema.users.nameAr,
        positionEn: schema.users.positionEn,
        positionAr: schema.users.positionAr,
        color: schema.users.avatarColor,
        departmentId: schema.users.departmentId,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, unique)),
    unitMap(),
  ]);
  return new Map(
    users.map((u) => {
      const unit = u.departmentId ? units.get(u.departmentId) : null;
      return [
        u.id,
        {
          id: u.id,
          nameEn: u.nameEn,
          nameAr: u.nameAr,
          positionEn: u.positionEn,
          positionAr: u.positionAr,
          color: u.color,
          unitId: u.departmentId,
          unitNameEn: unit?.nameEn ?? null,
          unitNameAr: unit?.nameAr ?? null,
          unitPathEn: unitPath(units, u.departmentId, "En"),
          unitPathAr: unitPath(units, u.departmentId, "Ar"),
        },
      ];
    })
  );
}

async function seededIds(): Promise<Set<string>> {
  const s = await getSetting<{ ids?: string[] }>(KOW_SEEDED_SETTING, {});
  return new Set(s.ids ?? []);
}

/** Turns rows into cards; unreadable items (classification above the viewer)
    are dropped so no one is invited to open what they cannot read. */
async function toCards(rows: KowRow[], viewer: CurrentUser | null, opts: { keepUnreadable?: boolean } = {}): Promise<KowCard[]> {
  if (!rows.length) return [];
  const [resolved, contributors, setters, seeded] = await Promise.all([
    resolveResources(rows.map((r) => ({ type: r.resourceType, id: r.resourceId }))),
    contributorsOf(rows.map((r) => r.contributorUserId ?? "")),
    contributorsOf(rows.map((r) => r.setBy ?? "")),
    seededIds(),
  ]);
  const ids = rows.map((r) => r.id);
  const [reads, seen] = viewer
    ? await Promise.all([
        db
          .select({ kowId: schema.knowledgeOfWeekReads.kowId })
          .from(schema.knowledgeOfWeekReads)
          .where(and(eq(schema.knowledgeOfWeekReads.userId, viewer.id), inArray(schema.knowledgeOfWeekReads.kowId, ids))),
        db
          .select({ kowId: schema.knowledgeOfWeekSeen.kowId })
          .from(schema.knowledgeOfWeekSeen)
          .where(and(eq(schema.knowledgeOfWeekSeen.userId, viewer.id), inArray(schema.knowledgeOfWeekSeen.kowId, ids))),
      ])
    : [[], []];
  const readSet = new Set(reads.map((r) => r.kowId));
  const seenSet = new Set(seen.map((r) => r.kowId));

  const cards: KowCard[] = [];
  for (const r of rows) {
    const res = resolved.get(keyOf(r.resourceType, r.resourceId));
    if (!res) continue;
    if (
      viewer &&
      !opts.keepUnreadable &&
      !canReadResource(viewer, { classificationLevel: res.classificationLevel, departmentId: res.departmentId })
    )
      continue;
    const setter = r.setBy ? setters.get(r.setBy) : null;
    cards.push({
      id: r.id,
      weekStart: r.weekStart,
      weekEnd: addDays(r.weekStart, 6),
      status: r.status as KowStatus,
      resourceType: r.resourceType as KowResourceType,
      resourceId: r.resourceId,
      titleEn: res.titleEn,
      titleAr: res.titleAr,
      summaryEn: res.summaryEn,
      summaryAr: res.summaryAr,
      href: res.href,
      classificationLevel: res.classificationLevel,
      contributor: r.contributorUserId ? (contributors.get(r.contributorUserId) ?? null) : null,
      noteEn: r.noteEn,
      noteAr: r.noteAr,
      setByNameEn: setter?.nameEn ?? null,
      setByNameAr: setter?.nameAr ?? null,
      setAt: r.setAt,
      readCount: r.readCount,
      viewerRead: readSet.has(r.id),
      viewerSeen: seenSet.has(r.id),
      illustrative: seeded.has(r.id),
    });
  }
  return cards;
}

/* ------------------------------------------------------------------ */
/* Reads                                                                */
/* ------------------------------------------------------------------ */

async function activeRow(): Promise<KowRow | null> {
  const [row] = await db
    .select()
    .from(schema.knowledgeOfWeek)
    .where(eq(schema.knowledgeOfWeek.status, "active"))
    .orderBy(desc(schema.knowledgeOfWeek.weekStart))
    .limit(1);
  return row ?? null;
}

/** The active pick as the Home strip and the reveal show it, or null. */
export async function getActiveKnowledgeOfWeek(user: CurrentUser): Promise<KowCard | null> {
  const row = await activeRow();
  if (!row) return null;
  const [card] = await toCards([row], user);
  return card ?? null;
}

/** A resource as the reveal would show it, before it is saved (the set
    dialog's preview). Null when the item does not exist. */
export async function previewKnowledgeOfWeek(
  user: CurrentUser,
  resourceType: KowResourceType,
  resourceId: string,
  weekStart: string
): Promise<(KowCard & { eligible: boolean }) | null> {
  const resolved = await resolveResources([{ type: resourceType, id: resourceId }]);
  const res = resolved.get(keyOf(resourceType, resourceId));
  if (!res) return null;
  const fake: KowRow = {
    id: "preview",
    weekStart,
    resourceType,
    resourceId,
    contributorUserId: res.ownerId,
    unitId: null,
    noteEn: null,
    noteAr: null,
    setBy: user.id,
    setAt: nowIso(),
    status: "scheduled",
    readCount: 0,
  };
  const [card] = await toCards([fake], null, { keepUnreadable: true });
  return card ? { ...card, eligible: res.eligible } : null;
}

/** Every pick, newest first, for administrators (Settings and the Hall's
    upcoming list). */
export async function getKnowledgeOfWeekSchedule(user: CurrentUser): Promise<KowCard[]> {
  if (!canManageKnowledgeOfWeek(user)) return [];
  const rows = await db.select().from(schema.knowledgeOfWeek).orderBy(desc(schema.knowledgeOfWeek.weekStart));
  return toCards(rows, user, { keepUnreadable: true });
}

/** The Hall of Knowledge: the current pick featured, then the archive
    grouped by month, newest first. */
export async function getHallOfKnowledge(user: CurrentUser): Promise<KowHall> {
  const canManage = canManageKnowledgeOfWeek(user);
  const rows = await db.select().from(schema.knowledgeOfWeek).orderBy(desc(schema.knowledgeOfWeek.weekStart));
  const cards = await toCards(rows, user);
  const current = cards.find((c) => c.status === "active") ?? null;
  const past = cards.filter((c) => c.status === "archived");
  const scheduled = canManage ? cards.filter((c) => c.status === "scheduled").reverse() : [];
  const months = new Map<string, KowCard[]>();
  for (const c of past) {
    const key = c.weekStart.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(c);
  }
  return {
    canManage,
    current,
    scheduled,
    months: [...months.entries()].map(([key, items]) => ({ key, items })),
    total: past.length + (current ? 1 : 0),
  };
}

/** The permanent award on a profile: how many weeks the person's work was
    the pick, and the most recent one. */
export async function getKnowledgeOfWeekAward(userId: string): Promise<{ weeks: number; latestWeekStart: string | null }> {
  const rows = await db
    .select({ weekStart: schema.knowledgeOfWeek.weekStart })
    .from(schema.knowledgeOfWeek)
    .where(
      and(
        eq(schema.knowledgeOfWeek.contributorUserId, userId),
        inArray(schema.knowledgeOfWeek.status, ["active", "archived"])
      )
    )
    .orderBy(desc(schema.knowledgeOfWeek.weekStart));
  return { weeks: rows.length, latestWeekStart: rows[0]?.weekStart ?? null };
}

/* ------------------------------------------------------------------ */
/* The ribbon id set (cached one minute per process)                    */
/* ------------------------------------------------------------------ */

let idsCache: { at: number; set: Set<string> } | null = null;
const IDS_TTL = 60_000;

/** `type:id` keys of the active pick. A study is a document, so both keys
    are present for it; the ribbons on shelves, lesson cards and search rows
    look themselves up here. */
export async function getKnowledgeOfWeekIds(): Promise<Set<string>> {
  if (idsCache && Date.now() - idsCache.at < IDS_TTL) return idsCache.set;
  const rows = await db
    .select({ resourceType: schema.knowledgeOfWeek.resourceType, resourceId: schema.knowledgeOfWeek.resourceId })
    .from(schema.knowledgeOfWeek)
    .where(eq(schema.knowledgeOfWeek.status, "active"));
  const set = new Set<string>();
  for (const r of rows) {
    set.add(`${r.resourceType}:${r.resourceId}`);
    if (r.resourceType === "document" || r.resourceType === "study") {
      set.add(`document:${r.resourceId}`);
      set.add(`study:${r.resourceId}`);
    }
  }
  idsCache = { at: Date.now(), set };
  return set;
}

export function invalidateKnowledgeOfWeekIds(): void {
  idsCache = null;
}

export async function isKnowledgeOfWeekResource(type: string, id: string): Promise<boolean> {
  const ids = await getKnowledgeOfWeekIds();
  return ids.has(`${type}:${id}`);
}

/** A study is a document with a study, research or evaluation knowledge type.
    The document page passes the answer to `SetKnowledgeOfWeekButton` so the
    reveal names the item "Study" rather than "Document"; everything else
    treats the two the same. */
export async function kowKindForDocument(documentId: string): Promise<"document" | "study"> {
  const rows = await db
    .select({ code: schema.taxonomyTerms.code })
    .from(schema.documents)
    .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.documents.knowledgeTypeTermId))
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  return ["study", "research", "evaluation"].includes(rows[0]?.code ?? "") ? "study" : "document";
}

/* ------------------------------------------------------------------ */
/* Writes                                                               */
/* ------------------------------------------------------------------ */

async function eventExists(userId: string, type: string, resourceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.gameEvents.id })
    .from(schema.gameEvents)
    .where(
      and(
        eq(schema.gameEvents.userId, userId),
        eq(schema.gameEvents.eventType, type),
        eq(schema.gameEvents.resourceId, resourceId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** The permanent badge row (family guardian); the seed inserts it too. */
export async function ensureKnowledgeOfWeekBadge(): Promise<string> {
  const [existing] = await db
    .select({ id: schema.badges.id })
    .from(schema.badges)
    .where(eq(schema.badges.code, KOW_BADGE_CODE))
    .limit(1);
  if (existing) return existing.id;
  const id = newId();
  await db.insert(schema.badges).values({
    id,
    code: KOW_BADGE_CODE,
    family: "guardian",
    nameEn: "Knowledge of the Week",
    nameAr: "معرفة الأسبوع",
    descriptionEn: "Your work was chosen as the Council's Knowledge of the Week.",
    descriptionAr: "اختير عملك معرفةَ الأسبوع في المجلس.",
    criteriaJson: JSON.stringify({ kind: "kow_contributor", weeks: 1 }),
    icon: "star",
    tier: "gold",
  });
  return id;
}

/** Pays the contributor and the unit for one pick, awards the badge and
    notifies the contributor and the unit head. Idempotent per pick: the
    contributor's `kow_contributor` event on the pick id is the marker for
    the whole set (the unit event must carry the unit id, so it cannot be its
    own marker). Returns true when something was paid. */
export async function payKnowledgeOfWeekAwards(kowId: string, opts: { quiet?: boolean } = {}): Promise<boolean> {
  const [row] = await db.select().from(schema.knowledgeOfWeek).where(eq(schema.knowledgeOfWeek.id, kowId)).limit(1);
  if (!row || !row.contributorUserId) return false;
  if (await eventExists(row.contributorUserId, "kow_contributor", row.id)) return false;

  const contributorId = row.contributorUserId;
  await record({ userId: contributorId, type: "kow_contributor", resourceType: "knowledge_of_week", resourceId: row.id });
  if (row.unitId) {
    // the leaderboard attributes `kow_unit` to resourceId when resourceType is org_unit
    await record({ userId: contributorId, type: "kow_unit", resourceType: "org_unit", resourceId: row.unitId });
  }

  const badgeId = await ensureKnowledgeOfWeekBadge();
  const [owned] = await db
    .select({ id: schema.userBadges.id })
    .from(schema.userBadges)
    .where(and(eq(schema.userBadges.userId, contributorId), eq(schema.userBadges.badgeId, badgeId)))
    .limit(1);
  if (!owned) {
    await db.insert(schema.userBadges).values({ id: newId(), userId: contributorId, badgeId, awardedAt: nowIso() });
  }

  if (opts.quiet) return true;
  const [cards, units] = await Promise.all([toCards([row], null, { keepUnreadable: true }), unitMap()]);
  const card = cards[0];
  const titleEn = card?.titleEn ?? "";
  const titleAr = card?.titleAr ?? "";
  await notify(
    contributorId,
    "kow_award",
    "Your work is the Knowledge of the Week",
    "عملك هو معرفة الأسبوع",
    "/hall-of-knowledge",
    {
      en: `"${titleEn}" opens on Home for every colleague this week. ${KOW_POINTS.contributor} points and the Knowledge of the Week award are yours; your unit earns ${KOW_POINTS.unit}.`,
      ar: `تُفتتح "${titleAr}" على الصفحة الرئيسية لكل الزملاء هذا الأسبوع. لك ${KOW_POINTS.contributor} نقطة وجائزة معرفة الأسبوع، ولوحدتك ${KOW_POINTS.unit} نقطة.`,
    }
  );
  const head = row.unitId ? units.get(row.unitId)?.headUserId : null;
  if (head && head !== contributorId) {
    const who = card?.contributor;
    await notify(
      head,
      "kow_unit_award",
      "Your unit's work is the Knowledge of the Week",
      "عمل وحدتك هو معرفة الأسبوع",
      "/hall-of-knowledge",
      {
        en: `${who?.nameEn ?? "A colleague"}'s "${titleEn}" is this week's pick. The unit earns ${KOW_POINTS.unit} points on the Departments board.`,
        ar: `"${titleAr}" من إعداد ${who?.nameAr ?? "أحد الزملاء"} هي اختيار هذا الأسبوع، وتحصل الوحدة على ${KOW_POINTS.unit} نقطة في لوحة الإدارات.`,
      }
    );
  }
  return true;
}

/** Scheduled to active, then the awards. Only the scheduled-to-active
    transition pays, so a pick can never be paid twice. */
async function activatePick(row: KowRow, opts: { quiet?: boolean } = {}): Promise<boolean> {
  const res = await db
    .update(schema.knowledgeOfWeek)
    .set({ status: "active" })
    .where(and(eq(schema.knowledgeOfWeek.id, row.id), eq(schema.knowledgeOfWeek.status, "scheduled")));
  if (!res.rowsAffected) return false;
  invalidateKnowledgeOfWeekIds();
  await payKnowledgeOfWeekAwards(row.id, opts);
  return true;
}

/** Sets the pick for a week. The resource must be verified (or an approved
    or published report); the contributor is the document owner, the lesson
    author or the report requester and the unit is theirs. One pick per week:
    a taken week answers `conflict` unless `replace` is set, in which case
    the old row and its reads and seen marks go and the new pick takes the
    week. A pick for the current week activates at once. */
export async function setKnowledgeOfWeek(user: CurrentUser, input: SetKowInput): Promise<SetKowResult> {
  if (!canManageKnowledgeOfWeek(user)) return { ok: false, error: "forbidden" };
  if (!isMondayIso(input.weekStart) || input.weekStart < weekStartOf()) return { ok: false, error: "bad_week" };

  const resolved = await resolveResources([{ type: input.resourceType, id: input.resourceId }]);
  const res = resolved.get(keyOf(input.resourceType, input.resourceId));
  if (!res) return { ok: false, error: "not_found" };
  if (!res.eligible) return { ok: false, error: "not_eligible" };

  const [existing] = await db
    .select()
    .from(schema.knowledgeOfWeek)
    .where(eq(schema.knowledgeOfWeek.weekStart, input.weekStart))
    .limit(1);
  if (existing && !input.replace) {
    const [card] = await toCards([existing], null, { keepUnreadable: true });
    return {
      ok: false,
      error: "conflict",
      existing: {
        id: existing.id,
        titleEn: card?.titleEn ?? existing.resourceId,
        titleAr: card?.titleAr ?? existing.resourceId,
        weekStart: existing.weekStart,
        status: existing.status as KowStatus,
      },
    };
  }

  // the unit is the contributor's; a document with no owner keeps its own unit
  let unitId: string | null = res.departmentId;
  if (res.ownerId) {
    const [owner] = await db
      .select({ departmentId: schema.users.departmentId })
      .from(schema.users)
      .where(eq(schema.users.id, res.ownerId))
      .limit(1);
    unitId = owner?.departmentId ?? unitId;
  }

  if (existing) {
    await db.delete(schema.knowledgeOfWeekReads).where(eq(schema.knowledgeOfWeekReads.kowId, existing.id));
    await db.delete(schema.knowledgeOfWeekSeen).where(eq(schema.knowledgeOfWeekSeen.kowId, existing.id));
    await db.delete(schema.knowledgeOfWeek).where(eq(schema.knowledgeOfWeek.id, existing.id));
  }

  const row: KowRow = {
    id: newId(),
    weekStart: input.weekStart,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    contributorUserId: res.ownerId,
    unitId,
    noteEn: input.noteEn?.trim() || null,
    noteAr: input.noteAr?.trim() || null,
    setBy: user.id,
    setAt: nowIso(),
    status: "scheduled",
    readCount: 0,
  };
  await db.insert(schema.knowledgeOfWeek).values(row);
  invalidateKnowledgeOfWeekIds();

  let status: KowStatus = "scheduled";
  if (input.weekStart === weekStartOf()) {
    // this week: any other active pick steps down, this one opens now
    await db
      .update(schema.knowledgeOfWeek)
      .set({ status: "archived" })
      .where(and(eq(schema.knowledgeOfWeek.status, "active"), lt(schema.knowledgeOfWeek.weekStart, input.weekStart)));
    await activatePick(row);
    status = "active";
  }
  return { ok: true, id: row.id, status, replaced: Boolean(existing), weekStart: input.weekStart };
}

/** The reveal was shown (or dismissed): never again for this person this week. */
export async function markSeen(user: CurrentUser, kowId: string): Promise<{ ok: boolean }> {
  const [row] = await db
    .select({ id: schema.knowledgeOfWeek.id })
    .from(schema.knowledgeOfWeek)
    .where(eq(schema.knowledgeOfWeek.id, kowId))
    .limit(1);
  if (!row) return { ok: false };
  const [seen] = await db
    .select({ id: schema.knowledgeOfWeekSeen.id })
    .from(schema.knowledgeOfWeekSeen)
    .where(and(eq(schema.knowledgeOfWeekSeen.kowId, kowId), eq(schema.knowledgeOfWeekSeen.userId, user.id)))
    .limit(1);
  if (!seen) {
    await db.insert(schema.knowledgeOfWeekSeen).values({ id: newId(), kowId, userId: user.id, seenAt: nowIso() });
  }
  return { ok: true };
}

/** The person opened the pick: counted once, ten points once, only while the
    pick is active. The contributor's own visit is not a colleague's read. */
export async function markRead(
  user: CurrentUser,
  kowId: string
): Promise<{ ok: boolean; first: boolean; readCount: number; points: number }> {
  const [row] = await db.select().from(schema.knowledgeOfWeek).where(eq(schema.knowledgeOfWeek.id, kowId)).limit(1);
  if (!row) return { ok: false, first: false, readCount: 0, points: 0 };
  /* Opening the item counts as seeing the reveal, and "Read now" is one of
     the reveal's exits, so the mark is taken before anything that can return
     early. It used to sit after the insert below, which left the reveal to
     open again on every visit for the one person whose visit is never a read:
     the contributor of the week's own pick. */
  if (row.status === "active") await markSeen(user, kowId);
  if (row.status !== "active" || row.contributorUserId === user.id) {
    return { ok: true, first: false, readCount: row.readCount, points: 0 };
  }
  const [already] = await db
    .select({ id: schema.knowledgeOfWeekReads.id })
    .from(schema.knowledgeOfWeekReads)
    .where(and(eq(schema.knowledgeOfWeekReads.kowId, kowId), eq(schema.knowledgeOfWeekReads.userId, user.id)))
    .limit(1);
  if (already) return { ok: true, first: false, readCount: row.readCount, points: 0 };

  await db.insert(schema.knowledgeOfWeekReads).values({ id: newId(), kowId, userId: user.id, readAt: nowIso() });
  const readCount = row.readCount + 1;
  await db.update(schema.knowledgeOfWeek).set({ readCount }).where(eq(schema.knowledgeOfWeek.id, kowId));
  let points = 0;
  if (!(await eventExists(user.id, "kow_read", kowId))) {
    const r = await record({ userId: user.id, type: "kow_read", resourceType: "knowledge_of_week", resourceId: kowId });
    points = r.points;
  }
  return { ok: true, first: true, readCount, points };
}

/** The hourly job. Archives the active pick whose week ended, activates the
    scheduled pick whose week has started (paying the awards), and archives
    scheduled picks whose week went by unactivated without paying them. */
export async function rolloverKnowledgeOfWeek(): Promise<{ archived: number; activated: string | null }> {
  const thisWeek = weekStartOf();
  let archived = 0;

  const stale = await db
    .select()
    .from(schema.knowledgeOfWeek)
    .where(and(eq(schema.knowledgeOfWeek.status, "active"), lt(schema.knowledgeOfWeek.weekStart, thisWeek)));
  for (const row of stale) {
    await db.update(schema.knowledgeOfWeek).set({ status: "archived" }).where(eq(schema.knowledgeOfWeek.id, row.id));
    archived++;
  }

  const due = await db
    .select()
    .from(schema.knowledgeOfWeek)
    .where(and(eq(schema.knowledgeOfWeek.status, "scheduled"), lte(schema.knowledgeOfWeek.weekStart, thisWeek)))
    .orderBy(desc(schema.knowledgeOfWeek.weekStart));
  let activated: string | null = null;
  const current = await activeRow();
  for (const row of due) {
    if (!activated && !current && row.weekStart === thisWeek) {
      if (await activatePick(row)) activated = row.id;
      continue;
    }
    // a missed week, or a week that already has its active pick
    await db.update(schema.knowledgeOfWeek).set({ status: "archived" }).where(eq(schema.knowledgeOfWeek.id, row.id));
    archived++;
  }
  if (archived || activated) invalidateKnowledgeOfWeekIds();
  return { archived, activated };
}
