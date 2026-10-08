// CR04 3: the Learning Room service. The "worth reading" score, the page
// payload (lesson of the week, themes, lanes, browse groups), deterministic
// theme clustering, and the guided Learn sessions with reflection notes.
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { newId, nowIso, todayIso } from "@/lib/ids";
import { getSetting } from "@/server/settings";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";

/* ------------------------------------------------------------------ */
/* CR04 3.3: the worth-reading score                                    */
/* ------------------------------------------------------------------ */

export function lessonScore(l: {
  status: string;
  reuseCount: number;
  createdAt: string;
  endorsements: number;
}): number {
  const ageDays = (Date.now() - Date.parse(l.createdAt)) / 86400000;
  const recency = ageDays < 30 ? 2 : ageDays < 90 ? 1 : 0;
  return (
    3 * (l.status === "verified" ? 1 : 0) +
    2 * Math.log(1 + (l.reuseCount ?? 0)) +
    1.5 * l.endorsements +
    recency
  );
}

/* ------------------------------------------------------------------ */
/* Shared lookups                                                       */
/* ------------------------------------------------------------------ */

async function outcomeMaps() {
  const { outcomeNodeMap } = await import("@/server/scan/extract");
  const taxToNode = await outcomeNodeMap();
  const nodeToTax = new Map<string, string>();
  for (const [tax, nodeId] of taxToNode) nodeToTax.set(nodeId, tax);
  const allNodes = await db
    .select({
      id: schema.strategyNodes.id,
      parentId: schema.strategyNodes.parentId,
      code: schema.strategyNodes.code,
      nodeType: schema.strategyNodes.nodeType,
      titleEn: schema.strategyNodes.titleEn,
      titleAr: schema.strategyNodes.titleAr,
      status: schema.strategyNodes.status,
    })
    .from(schema.strategyNodes);
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const outcomeOf = (nodeId: string | null) => {
    let cur = nodeId ? nodeById.get(nodeId) : undefined;
    for (let i = 0; i < 6 && cur; i++) {
      const tax = nodeToTax.get(cur.id);
      if (tax) return { tax, node: cur };
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
    }
    return null;
  };
  const outcomeTerms = await db
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
    .orderBy(asc(schema.taxonomyTerms.sort));
  return { nodeById, outcomeOf, outcomeTerms, taxToNode };
}

export type RoomLesson = {
  id: string;
  titleEn: string;
  titleAr: string;
  contextEn: string | null;
  contextAr: string | null;
  learningEn: string | null;
  learningAr: string | null;
  recommendationEn: string | null;
  recommendationAr: string | null;
  category: string;
  status: string;
  reuseCount: number;
  createdAt: string;
  score: number;
  topReuse: boolean;
  nodeId: string | null;
  nodeCode: string | null;
  nodeTitleEn: string | null;
  nodeTitleAr: string | null;
  nodeType: string | null;
  outcome: string | null; // taxonomy code
  outcomeCode: string | null; // O1..O7
  outcomeNameEn: string | null;
  outcomeNameAr: string | null;
  /** CR08 9.1: the author's account, so the Learning Room and the reader can
      raise the person card. Null when the account is gone. */
  authorId: string | null;
  authorNameEn: string | null;
  authorNameAr: string | null;
  authorColor: string | null;
  departmentEn: string | null;
  departmentAr: string | null;
  documentIds: string[];
  /* CR07 1.2: every node this lesson links to, the primary one first */
  links: {
    id: string;
    nodeId: string;
    nodeKind: "nes" | "council";
    isPrimary: boolean;
    code: string | null;
    titleEn: string;
    titleAr: string;
    level: string;
    edition: string | null;
  }[];
};

async function loadRoomLessons(user: CurrentUser): Promise<RoomLesson[]> {
  const rows = await db
    .select({
      lesson: schema.lessons,
      // CR08 9.1: the id travels with the name for the person card
      authorId: schema.users.id,
      authorNameEn: schema.users.nameEn,
      authorNameAr: schema.users.nameAr,
      authorColor: schema.users.avatarColor,
      authorDeletedAt: schema.users.deletedAt,
      departmentEn: schema.departments.nameEn,
      departmentAr: schema.departments.nameAr,
    })
    .from(schema.lessons)
    .leftJoin(schema.users, eq(schema.users.id, schema.lessons.authorId))
    .leftJoin(schema.departments, eq(schema.departments.id, schema.users.departmentId))
    .where(
      and(
        inArray(schema.lessons.status, ["published", "verified"]),
        sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`
      )
    )
    .orderBy(desc(schema.lessons.createdAt))
    .limit(200);

  const endorsementRows = rows.length
    ? await db
        .select({
          resourceId: schema.reviews.resourceId,
          c: sql<number>`count(*)`,
        })
        .from(schema.reviews)
        .where(
          and(
            eq(schema.reviews.resourceType, "lesson"),
            eq(schema.reviews.decision, "endorse"),
            inArray(schema.reviews.resourceId, rows.map((r) => r.lesson.id))
          )
        )
        .groupBy(schema.reviews.resourceId)
    : [];
  const endorsements = new Map(endorsementRows.map((r) => [r.resourceId, r.c]));

  const { outcomeOf, nodeById, outcomeTerms } = await outcomeMaps();
  const termByTax = new Map(outcomeTerms.map((t) => [t.code, t]));

  // CR07 1.2: a lesson carries every link, the primary one first
  const { loadLinksForLessons } = await import("./lesson-links");
  const linkMap = await loadLinksForLessons(rows.map((r) => r.lesson.id));

  const withScore = rows.map(({ lesson, ...author }) => {
    const links = linkMap.get(lesson.id) ?? [];
    const primary = links.find((l) => l.isPrimary) ?? links[0] ?? null;
    // the card shows the primary link; NES nodes keep their outcome roll-up
    const node = primary?.node
      ? {
          id: primary.node.id,
          code: primary.node.code,
          titleEn: primary.node.titleEn,
          titleAr: primary.node.titleAr,
          nodeType: primary.node.level,
        }
      : lesson.nodeId
        ? nodeById.get(lesson.nodeId) ?? null
        : null;
    const outcome = outcomeOf(primary?.nodeKind === "nes" ? primary.nodeId : lesson.nodeId);
    const term = outcome ? termByTax.get(outcome.tax) : null;
    let documentIds: string[] = [];
    try {
      documentIds = JSON.parse(lesson.documentIdsJson ?? "[]");
    } catch {
      documentIds = [];
    }
    return {
      id: lesson.id,
      titleEn: lesson.titleEn,
      titleAr: lesson.titleAr,
      contextEn: lesson.contextEn,
      contextAr: lesson.contextAr,
      learningEn: lesson.learningEn,
      learningAr: lesson.learningAr,
      recommendationEn: lesson.recommendationEn,
      recommendationAr: lesson.recommendationAr,
      category: lesson.category,
      status: lesson.status,
      reuseCount: lesson.reuseCount,
      createdAt: lesson.createdAt,
      score: lessonScore({
        status: lesson.status,
        reuseCount: lesson.reuseCount,
        createdAt: lesson.createdAt,
        endorsements: endorsements.get(lesson.id) ?? 0,
      }),
      topReuse: false,
      nodeId: primary?.nodeId ?? lesson.nodeId,
      nodeCode: node?.code ?? null,
      nodeTitleEn: node?.titleEn ?? null,
      nodeTitleAr: node?.titleAr ?? null,
      nodeType: node?.nodeType ?? null,
      links: links.map((l) => ({
        id: l.id,
        nodeId: l.nodeId,
        nodeKind: l.nodeKind,
        isPrimary: l.isPrimary,
        code: l.node?.code ?? null,
        titleEn: l.node?.titleEn ?? "",
        titleAr: l.node?.titleAr ?? "",
        level: l.node?.level ?? "",
        edition: l.node?.edition ?? null,
      })),
      outcome: outcome?.tax ?? null,
      outcomeCode: outcome?.node.code ?? null,
      outcomeNameEn: term?.nameEn ?? null,
      outcomeNameAr: term?.nameAr ?? null,
      authorId: author.authorDeletedAt ? null : author.authorId,
      authorNameEn: author.authorNameEn,
      authorNameAr: author.authorNameAr,
      authorColor: author.authorColor,
      departmentEn: author.departmentEn,
      departmentAr: author.departmentAr,
      documentIds,
    };
  });

  // aqua mark: top 10 percent by reuse
  const reuseSorted = [...withScore].sort((a, b) => b.reuseCount - a.reuseCount);
  const topCut = reuseSorted[Math.max(0, Math.floor(reuseSorted.length * 0.1) - 1)]?.reuseCount ?? Infinity;
  for (const l of withScore) l.topReuse = l.reuseCount > 0 && l.reuseCount >= topCut;
  return withScore;
}

export type RoomTheme = {
  id: string;
  labelEn: string;
  labelAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  lessonIds: string[];
  count: number;
  outcomes: { code: string; nameEn: string; nameAr: string }[];
  perMonth: number[]; // last 8 months, oldest first
  relevance: number;
};

export type LearningRoomData = {
  lessons: RoomLesson[];
  categoryCounts: Record<string, number>;
  lessonOfWeek: { lesson: RoomLesson; suggested: boolean } | null;
  themes: RoomTheme[];
  contributors: { nameEn: string; nameAr: string; color: string; count: number }[];
  projects: { id: string; code: string | null; titleEn: string; titleAr: string; nodeType: string; status: string; count: number }[];
  outcomes: { tax: string; nameEn: string; nameAr: string; count: number }[];
  lanePrefs: Record<string, boolean>;
  learnModeEnabled: boolean;
  reflectionPrompts: { en: string; ar: string }[];
  sessionToday: { id: string; completed: boolean; index: number } | null;
  /* CR07 1.3: the By project picker, both strategy stores */
  picker: LessonPicker;
};

/** One node in the By project drill-down, carrying its lesson counts. */
export type PickerNode = {
  id: string;
  kind: "nes" | "council";
  parentId: string | null;
  code: string | null;
  titleEn: string;
  titleAr: string;
  /** strategy_nodes.node_type or council_nodes.level */
  level: string;
  edition: string | null;
  /** lessons linked to this node itself */
  direct: number;
  /** direct plus everything beneath it, deduplicated */
  total: number;
};

export type LessonPicker = {
  nes: PickerNode[];
  council: PickerNode[];
  /** lessons with no link at all */
  unlinkedIds: string[];
};

export async function getLearningRoomData(user: CurrentUser): Promise<LearningRoomData> {
  const lessons = await loadRoomLessons(user);
  const byId = new Map(lessons.map((l) => [l.id, l]));

  const categoryCounts: Record<string, number> = {};
  for (const l of lessons) categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;

  /* Lesson of the week: the scheduled one, else the AI suggestion (highest
     score not featured in the last 12 weeks) with the Suggested chip */
  const low = await getSetting<{ schedule: { weekStart: string; lessonId: string }[] }>(
    "lesson_of_week",
    { schedule: [] }
  );
  const monday = (() => {
    const now = new Date();
    const day = (now.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day))
      .toISOString()
      .slice(0, 10);
  })();
  const scheduled = low.schedule.find((s) => s.weekStart === monday);
  let lessonOfWeek: LearningRoomData["lessonOfWeek"] = null;
  if (scheduled && byId.has(scheduled.lessonId)) {
    lessonOfWeek = { lesson: byId.get(scheduled.lessonId)!, suggested: false };
  } else {
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 86400000).toISOString().slice(0, 10);
    const recentlyFeatured = new Set(
      low.schedule.filter((s) => s.weekStart >= twelveWeeksAgo).map((s) => s.lessonId)
    );
    const pick = [...lessons]
      .filter((l) => !recentlyFeatured.has(l.id))
      .sort((a, b) => b.score - a.score)[0];
    if (pick) lessonOfWeek = { lesson: pick, suggested: true };
  }

  /* Themes from lesson_clusters, ordered by relevance */
  const clusters = await db.select().from(schema.lessonClusters);
  const months: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const themes: RoomTheme[] = clusters
    .map((c) => {
      let ids: string[] = [];
      try {
        ids = JSON.parse(c.lessonIdsJson ?? "[]");
      } catch {
        ids = [];
      }
      const members = ids.map((id) => byId.get(id)).filter(Boolean) as RoomLesson[];
      const outcomes = [...new Map(
        members
          .filter((m) => m.outcome)
          .map((m) => [m.outcome!, { code: m.outcomeCode ?? m.outcome!, nameEn: m.outcomeNameEn ?? "", nameAr: m.outcomeNameAr ?? "" }])
      ).values()];
      const perMonth = months.map(
        (m) => members.filter((l) => l.createdAt.startsWith(m)).length
      );
      const newest = members.reduce((max, l) => (l.createdAt > max ? l.createdAt : max), "");
      const recencyDays = newest ? (Date.now() - Date.parse(newest)) / 86400000 : 999;
      const reuse = members.reduce((sum, l) => sum + l.reuseCount, 0);
      return {
        id: c.id,
        labelEn: c.labelEn,
        labelAr: c.labelAr,
        summaryEn: c.summaryEn,
        summaryAr: c.summaryAr,
        lessonIds: members.map((m) => m.id),
        count: members.length,
        outcomes,
        perMonth,
        relevance: members.length * 2 + reuse + (recencyDays < 30 ? 4 : recencyDays < 90 ? 2 : 0),
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.relevance - a.relevance);

  /* browse groups */
  const contributorMap = new Map<string, { nameEn: string; nameAr: string; color: string; count: number }>();
  for (const l of lessons) {
    const key = l.authorNameEn ?? "?";
    const entry = contributorMap.get(key) ?? {
      nameEn: l.authorNameEn ?? "",
      nameAr: l.authorNameAr ?? "",
      color: l.authorColor ?? "navy",
      count: 0,
    };
    entry.count++;
    contributorMap.set(key, entry);
  }
  const projectsMap = new Map<string, LearningRoomData["projects"][number]>();
  for (const l of lessons) {
    if (!l.nodeId || !l.nodeTitleEn) continue;
    const entry = projectsMap.get(l.nodeId) ?? {
      id: l.nodeId,
      code: l.nodeCode,
      titleEn: l.nodeTitleEn,
      titleAr: l.nodeTitleAr ?? l.nodeTitleEn,
      nodeType: l.nodeType ?? "project",
      status: "on_track",
      count: 0,
    };
    entry.count++;
    projectsMap.set(l.nodeId, entry);
  }
  const { outcomeTerms } = await outcomeMaps();
  const outcomes = outcomeTerms.map((t) => ({
    tax: t.code,
    nameEn: t.nameEn,
    nameAr: t.nameAr,
    count: lessons.filter((l) => l.outcome === t.code).length,
  }));

  /* per-user lane collapse state + settings */
  let lanePrefs: Record<string, boolean> = {};
  try {
    const prefs = user.prefsJson ? JSON.parse(user.prefsJson) : {};
    if (prefs && typeof prefs.lessonLanes === "object" && prefs.lessonLanes) {
      lanePrefs = prefs.lessonLanes as Record<string, boolean>;
    }
  } catch {
    lanePrefs = {};
  }
  const lessonsSettings = await getSetting<{ learnModeEnabled?: boolean }>("lessons_settings", {});
  const reflectionPrompts = await getSetting<{ en: string; ar: string }[]>("reflection_prompts", []);

  /* today's session, for resume (CR04 3.5) */
  const [todayRow] = await db
    .select()
    .from(schema.learnSessions)
    .where(
      and(
        eq(schema.learnSessions.userId, user.id),
        gte(schema.learnSessions.createdAt, todayIso() + "T00:00:00.000Z")
      )
    )
    .orderBy(desc(schema.learnSessions.createdAt))
    .limit(1);
  let sessionToday: LearningRoomData["sessionToday"] = null;
  if (todayRow) {
    let progress = { index: 0 };
    try {
      progress = JSON.parse(todayRow.progressJson ?? "{}");
    } catch {
      progress = { index: 0 };
    }
    sessionToday = {
      id: todayRow.id,
      completed: Boolean(todayRow.completedAt),
      index: progress.index ?? 0,
    };
  }

  const picker = await buildLessonPicker(lessons);

  return {
    lessons: [...lessons].sort((a, b) => b.score - a.score),
    categoryCounts,
    lessonOfWeek,
    themes,
    contributors: [...contributorMap.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    projects: [...projectsMap.values()].sort((a, b) => b.count - a.count),
    outcomes,
    lanePrefs,
    learnModeEnabled: lessonsSettings.learnModeEnabled !== false,
    reflectionPrompts,
    sessionToday,
    picker,
  };
}

/* ------------------------------------------------------------------ */
/* CR07 1.3: the By project picker over both strategy stores            */
/* ------------------------------------------------------------------ */

async function buildLessonPicker(lessons: RoomLesson[]): Promise<LessonPicker> {
  const { loadNodeIndex, descendantsOf } = await import("./lesson-links");
  const { byId, childrenOf } = await loadNodeIndex();

  // which of the visible lessons sit on each node
  const lessonsOnNode = new Map<string, Set<string>>();
  const linkedLessonIds = new Set<string>();
  for (const lesson of lessons) {
    for (const link of lesson.links) {
      linkedLessonIds.add(lesson.id);
      (
        lessonsOnNode.get(link.nodeId) ?? lessonsOnNode.set(link.nodeId, new Set()).get(link.nodeId)!
      ).add(lesson.id);
    }
  }

  // one pass to invert the children map rather than scanning it per node
  const parentById = new Map<string, string>();
  for (const [parentId, children] of childrenOf) {
    for (const child of children) parentById.set(child.id, parentId);
  }

  const build = (kind: "nes" | "council"): PickerNode[] => {
    const nodes: PickerNode[] = [];
    for (const node of byId.values()) {
      if (node.kind !== kind) continue;
      const direct = lessonsOnNode.get(node.id) ?? new Set<string>();
      const all = new Set(direct);
      for (const child of descendantsOf(node.id, childrenOf)) {
        for (const id of lessonsOnNode.get(child) ?? []) all.add(id);
      }
      // the picker only carries branches that lead somewhere
      if (!all.size && !["outcome", "target", "goal", "intermediate_outcome"].includes(node.level)) {
        continue;
      }
      nodes.push({
        id: node.id,
        kind: node.kind,
        parentId: parentById.get(node.id) ?? null,
        code: node.code,
        titleEn: node.titleEn,
        titleAr: node.titleAr,
        level: node.level,
        edition: node.edition,
        direct: direct.size,
        total: all.size,
      });
    }
    return nodes.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
  };

  return {
    nes: build("nes"),
    council: build("council"),
    unlinkedIds: lessons.filter((l) => !linkedLessonIds.has(l.id)).map((l) => l.id),
  };
}

/* ------------------------------------------------------------------ */
/* CR04 3.2/5: deterministic theme clustering (nightly and on demand)   */
/* ------------------------------------------------------------------ */

const THEME_LABELS: Record<string, { en: string; ar: string }> = {
  eco_growth: { en: "Delivering economic diversification", ar: "تنفيذ التنويع الاقتصادي" },
  fiscal_sust: { en: "Fiscal discipline in practice", ar: "الانضباط المالي في التطبيق" },
  workforce: { en: "Building the future workforce", ar: "بناء القوى العاملة المستقبلية" },
  cohesive_society: { en: "Strengthening social cohesion", ar: "تعزيز التماسك الاجتماعي" },
  quality_life: { en: "Quality of life on the ground", ar: "جودة الحياة على أرض الواقع" },
  env_sust: { en: "Environmental delivery lessons", ar: "دروس التنفيذ البيئي" },
  gov_excellence: { en: "Government that delivers", ar: "حكومة تنجز" },
  data_systems: { en: "Data and statistical systems", ar: "البيانات والأنظمة الإحصائية" },
};

export async function reclusterLessons(): Promise<number> {
  const lessons = await db
    .select()
    .from(schema.lessons)
    .where(inArray(schema.lessons.status, ["published", "verified"]));
  const { outcomeOf } = await outcomeMaps();

  // group by outcome; data/statistics lessons (no outcome) form their own theme
  const groups = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const outcome = outcomeOf(l.nodeId);
    const key = outcome?.tax ?? "data_systems";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(l);
  }
  const chosen = [...groups.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  await db.delete(schema.lessonClusters);
  let made = 0;
  for (const [key, members] of chosen) {
    const label = THEME_LABELS[key] ?? { en: "Cross-cutting lessons", ar: "دروس عابرة للقطاعات" };
    const top = [...members].sort((a, b) => b.reuseCount - a.reuseCount)[0];
    const firstSentence = (s: string | null) =>
      (s ?? "").replace(/\s+/g, " ").split(/(?<=[.!؟?])\s+/)[0] ?? "";
    const summaryEn = top
      ? `${members.length} lessons converge on one thread: ${firstSentence(top.learningEn) || top.titleEn}`.slice(0, 280)
      : null;
    const summaryAr = top
      ? `${members.length} دروس تلتقي عند خيط واحد: ${firstSentence(top.learningAr) || top.titleAr}`.slice(0, 280)
      : null;
    const id = newId();
    await db.insert(schema.lessonClusters).values({
      id,
      labelEn: label.en,
      labelAr: label.ar,
      summaryEn,
      summaryAr,
      lessonIdsJson: JSON.stringify(members.map((m) => m.id)),
      generatedAt: nowIso(),
    });
    await db
      .update(schema.lessons)
      .set({ clusterId: id })
      .where(inArray(schema.lessons.id, members.map((m) => m.id)));
    // CR04 5: theme syntheses join the unified index for Ask EnviroAI
    try {
      const { embedStructuredRecords } = await import("@/server/search/records");
      await embedStructuredRecords("lesson_theme", id);
    } catch {
      /* indexing is best effort here; the nightly job retries */
    }
    made++;
  }
  return made;
}

/* ------------------------------------------------------------------ */
/* CR04 3.5: Learn mode sessions                                        */
/* ------------------------------------------------------------------ */

export type LearnSessionPayload = {
  id: string;
  lessons: RoomLesson[];
  index: number;
  read: string[];
  completed: boolean;
  prompts: { en: string; ar: string }[];
};

async function readLessonIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ resourceId: schema.gameEvents.resourceId })
    .from(schema.gameEvents)
    .where(
      and(eq(schema.gameEvents.userId, userId), eq(schema.gameEvents.eventType, "lesson_read_fully"))
    );
  return new Set(rows.map((r) => r.resourceId).filter(Boolean) as string[]);
}

/** Five lessons: two near the user, two top unread, one from an untouched theme. */
async function selectSessionLessons(user: CurrentUser): Promise<RoomLesson[]> {
  const lessons = await loadRoomLessons(user);
  const read = await readLessonIds(user.id);
  const unread = lessons.filter((l) => !read.has(l.id));
  const pool = unread.length >= 5 ? unread : lessons;
  const picked: RoomLesson[] = [];
  const take = (l: RoomLesson | undefined) => {
    if (l && !picked.some((p) => p.id === l.id)) picked.push(l);
  };

  // "near": followed outcomes, else the outcomes where the user has breadth
  const follows = await db
    .select({ resourceType: schema.follows.resourceType, resourceId: schema.follows.resourceId })
    .from(schema.follows)
    .where(eq(schema.follows.userId, user.id));
  const followedNodeIds = new Set(
    follows.filter((f) => f.resourceType === "node").map((f) => f.resourceId)
  );
  let nearTaxes = new Set<string>();
  if (followedNodeIds.size) {
    const { outcomeOf } = await outcomeMaps();
    for (const id of followedNodeIds) {
      const o = outcomeOf(id);
      if (o) nearTaxes.add(o.tax);
    }
  }
  if (!nearTaxes.size) {
    const [state] = await db
      .select({ breadthJson: schema.userGameState.breadthJson })
      .from(schema.userGameState)
      .where(eq(schema.userGameState.userId, user.id))
      .limit(1);
    try {
      const breadth = JSON.parse(state?.breadthJson ?? "{}") as Record<string, number>;
      nearTaxes = new Set(
        Object.entries(breadth)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tax]) => tax)
      );
    } catch {
      nearTaxes = new Set();
    }
  }
  const near = pool
    .filter((l) => l.outcome && nearTaxes.has(l.outcome))
    .sort((a, b) => b.score - a.score);
  take(near[0]);
  take(near[1]);

  // two highest worth-reading unread
  const topUnread = [...pool].sort((a, b) => b.score - a.score);
  take(topUnread[0]);
  take(topUnread[1]);

  // one from a theme the user has not touched
  const clusters = await db.select().from(schema.lessonClusters);
  for (const c of clusters) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(c.lessonIdsJson ?? "[]");
    } catch {
      ids = [];
    }
    if (ids.some((id) => read.has(id))) continue;
    const candidate = pool.find((l) => ids.includes(l.id));
    if (candidate) {
      take(candidate);
      break;
    }
  }

  // fill to five
  for (const l of topUnread) {
    if (picked.length >= 5) break;
    take(l);
  }
  return picked.slice(0, 5);
}

export async function getOrStartSession(user: CurrentUser): Promise<LearnSessionPayload> {
  const prompts = await getSetting<{ en: string; ar: string }[]>("reflection_prompts", []);
  const [existing] = await db
    .select()
    .from(schema.learnSessions)
    .where(
      and(
        eq(schema.learnSessions.userId, user.id),
        gte(schema.learnSessions.createdAt, todayIso() + "T00:00:00.000Z")
      )
    )
    .orderBy(desc(schema.learnSessions.createdAt))
    .limit(1);
  const lessons = await loadRoomLessons(user);
  const byId = new Map(lessons.map((l) => [l.id, l]));

  if (existing) {
    let ids: string[] = [];
    let progress: { index?: number; read?: string[] } = {};
    try {
      ids = JSON.parse(existing.lessonIdsJson);
      progress = JSON.parse(existing.progressJson ?? "{}");
    } catch {
      ids = [];
    }
    const sessionLessons = ids.map((id) => byId.get(id)).filter(Boolean) as RoomLesson[];
    if (sessionLessons.length) {
      return {
        id: existing.id,
        lessons: sessionLessons,
        index: Math.min(progress.index ?? 0, sessionLessons.length - 1),
        read: progress.read ?? [],
        completed: Boolean(existing.completedAt),
        prompts,
      };
    }
  }

  const picked = await selectSessionLessons(user);
  const id = newId();
  await db.insert(schema.learnSessions).values({
    id,
    userId: user.id,
    lessonIdsJson: JSON.stringify(picked.map((l) => l.id)),
    progressJson: JSON.stringify({ index: 0, read: [] }),
    completedAt: null,
    createdAt: nowIso(),
  });
  await audit(user.id, "create", "learn_session", id, { lessons: picked.length });
  return { id, lessons: picked, index: 0, read: [], completed: false, prompts };
}

export async function markSessionRead(
  user: CurrentUser,
  sessionId: string,
  lessonId: string,
  index: number
): Promise<{ points: number }> {
  const [session] = await db
    .select()
    .from(schema.learnSessions)
    .where(and(eq(schema.learnSessions.id, sessionId), eq(schema.learnSessions.userId, user.id)))
    .limit(1);
  if (!session) return { points: 0 };
  let progress: { index?: number; read?: string[] } = {};
  try {
    progress = JSON.parse(session.progressJson ?? "{}");
  } catch {
    progress = {};
  }
  const read = new Set(progress.read ?? []);
  read.add(lessonId);
  await db
    .update(schema.learnSessions)
    .set({ progressJson: JSON.stringify({ index, read: [...read] }) })
    .where(eq(schema.learnSessions.id, sessionId));
  const game = await record({
    userId: user.id,
    type: "lesson_read_fully",
    resourceType: "lesson",
    resourceId: lessonId,
  });
  return { points: game.points };
}

export async function completeSession(
  user: CurrentUser,
  sessionId: string,
  reflection?: { lessonId: string; text: string }
): Promise<{ points: number; reflectionPoints: number }> {
  const [session] = await db
    .select()
    .from(schema.learnSessions)
    .where(and(eq(schema.learnSessions.id, sessionId), eq(schema.learnSessions.userId, user.id)))
    .limit(1);
  if (!session) return { points: 0, reflectionPoints: 0 };
  if (!session.completedAt) {
    await db
      .update(schema.learnSessions)
      .set({ completedAt: nowIso() })
      .where(eq(schema.learnSessions.id, sessionId));
  }
  const game = await record({
    userId: user.id,
    type: "learn_session_completed",
    resourceType: "learn_session",
    resourceId: sessionId,
  });
  let reflectionPoints = 0;
  if (reflection && reflection.text.trim().length >= 8) {
    await db.insert(schema.notes).values({
      id: newId(),
      userId: user.id,
      lessonId: reflection.lessonId,
      text: reflection.text.trim().slice(0, 2000),
      createdAt: nowIso(),
    });
    const noteGame = await record({
      userId: user.id,
      type: "reflection_saved",
      resourceType: "lesson",
      resourceId: reflection.lessonId,
    });
    reflectionPoints = noteGame.points;
  }
  await audit(user.id, "edit", "learn_session", sessionId, {
    completed: true,
    reflection: Boolean(reflection),
  });
  return { points: game.points, reflectionPoints };
}

/* ------------------------------------------------------------------ */
/* CR04 3.6: lesson and theme episodes (generated once, reused)         */
/* ------------------------------------------------------------------ */

export async function findOrCreateLessonEpisode(
  user: CurrentUser,
  input: { lessonId?: string; themeId?: string; locale: "en" | "ar" }
): Promise<{ ok: boolean; episodeId?: string; created?: boolean; error?: string }> {
  const kind = input.lessonId ? "lesson" : "theme";
  const targetId = input.lessonId ?? input.themeId;
  if (!targetId) return { ok: false, error: "invalid" };

  // reuse: an existing episode for this scope and language
  const existing = await db
    .select({ id: schema.podcastEpisodes.id, sourceScopeJson: schema.podcastEpisodes.sourceScopeJson })
    .from(schema.podcastEpisodes)
    .where(
      and(
        eq(schema.podcastEpisodes.status, "published"),
        eq(schema.podcastEpisodes.language, input.locale),
        sql`${schema.podcastEpisodes.classificationLevel} <= ${user.clearanceLevel}`
      )
    );
  for (const row of existing) {
    try {
      const scope = JSON.parse(row.sourceScopeJson ?? "{}");
      if (scope.kind === kind && Array.isArray(scope.ids) && scope.ids[0] === targetId) {
        return { ok: true, episodeId: row.id, created: false };
      }
    } catch {
      /* skip */
    }
  }

  const { generatePodcastScript } = await import("@/server/ai/podcast/script");
  const { createEpisode } = await import("@/server/services/podcast");

  let labelEn = "";
  let labelAr = "";
  let outcomeCode: string | null = null;
  if (kind === "lesson") {
    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, targetId))
      .limit(1);
    if (!lesson || lesson.classificationLevel > user.clearanceLevel) {
      return { ok: false, error: "not_found" };
    }
    labelEn = lesson.titleEn;
    labelAr = lesson.titleAr;
    const { outcomeOf } = await outcomeMaps();
    outcomeCode = outcomeOf(lesson.nodeId)?.tax ?? null;
  } else {
    const [cluster] = await db
      .select()
      .from(schema.lessonClusters)
      .where(eq(schema.lessonClusters.id, targetId))
      .limit(1);
    if (!cluster) return { ok: false, error: "not_found" };
    labelEn = cluster.labelEn;
    labelAr = cluster.labelAr;
  }

  const { script } = await generatePodcastScript(
    user,
    { kind: kind as "lesson" | "theme", ids: [targetId], labelEn, labelAr },
    { language: input.locale, minutes: kind === "lesson" ? 2 : 4, focus: "lessons" }
  );
  const created = await createEpisode(user, {
    scope: { kind: kind as "lesson" | "theme", ids: [targetId], labelEn, labelAr, outcomeCode },
    options: { language: input.locale, minutes: kind === "lesson" ? 2 : 4, focus: "lessons" },
    script,
  });
  if (!created.ok || !created.id) return { ok: false, error: created.error ?? "failed" };
  return { ok: true, episodeId: created.id, created: true };
}
