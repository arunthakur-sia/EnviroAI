/* eslint-disable no-console */
// CR08 8: this week's Knowledge of the Week (a verified study), a scheduled
// pick for next week (a verified lesson) and four archived picks for the
// previous four weeks with reads by a handful of colleagues, bilingual
// notes, the permanent badge and the three game rules. Owned by the
// Knowledge of the Week agent. Idempotent: a week that already has a pick is
// left alone, awards are paid once per pick, reads are inserted once.
//   npx tsx scripts/cr08-kow-seed.ts
import { loadEnv } from "../src/lib/load-env";
loadEnv();

/** The CR08 8 rules; the gamification seed inserts the same three. */
const KOW_RULES: [string, number][] = [
  ["kow_contributor", 150],
  ["kow_unit", 100],
  ["kow_read", 10],
];

type Slot = {
  offsetWeeks: number; // 0 = this week, 1 = next week, -1 = last week ...
  pick: "study" | "lesson" | "report_doc" | "evaluation" | "module_report";
  noteEn: string;
  noteAr: string;
  reads: number;
};

const SLOTS: Slot[] = [
  {
    offsetWeeks: 0,
    pick: "study",
    noteEn: "A study the whole Council can lean on: the method is transparent, the data are Qatari, and the recommendations name who should act. Read the summary first, then chapter three.",
    noteAr: "دراسة يمكن للمجلس كله أن يستند إليها: منهجها واضح، وبياناتها قطرية، وتوصياتها تسمّي من عليه أن يتصرف. اقرأ الملخص أولًا ثم الفصل الثالث.",
    reads: 0,
  },
  {
    offsetWeeks: 1,
    pick: "lesson",
    noteEn: "A lesson we keep relearning. Two minutes to read, and it will change how you plan your next handover.",
    noteAr: "درس نعود إلى تعلّمه كل مرة. قراءته دقيقتان، وسيغيّر طريقتك في التخطيط للتسليم القادم.",
    reads: 0,
  },
  {
    offsetWeeks: -1,
    pick: "report_doc",
    noteEn: "The clearest picture of where the numbers stand this quarter. Keep it open when you write your next brief.",
    noteAr: "أوضح صورة لموقع الأرقام هذا الربع. أبقِه مفتوحًا عندما تكتب موجزك القادم.",
    reads: 9,
  },
  {
    offsetWeeks: -2,
    pick: "evaluation",
    noteEn: "An evaluation that tells us what worked and, more usefully, what did not. The findings section is worth the whole read.",
    noteAr: "تقييم يخبرنا بما نجح، والأهم بما لم ينجح. قسم النتائج يستحق القراءة كاملة.",
    reads: 12,
  },
  {
    offsetWeeks: -3,
    pick: "lesson",
    noteEn: "Short, specific and already reused by three teams. If you run projects, this one is for you.",
    noteAr: "قصير ومحدد وأعادت استخدامه ثلاثة فرق بالفعل. إن كنت تدير مشاريع فهذا الدرس لك.",
    reads: 6,
  },
  {
    offsetWeeks: -4,
    pick: "module_report",
    noteEn: "Our first report generated inside SiaNexus and published to Institutional Memory. Read it for the content, and for what the tool can now do.",
    noteAr: "أول تقرير أُنشئ داخل سيا نكسس ونُشر في مكتبة المعرفة. اقرأه لمحتواه، ولما صار بمقدور الأداة أن تفعله.",
    reads: 8,
  },
];

export default async function seedCr08Kow(): Promise<void> {
  const { db, schema, rawClient } = await import("../src/server/db/client");
  const { and, asc, desc, eq, inArray, isNull, sql } = await import("drizzle-orm");
  // the shared dev server writes to the same file while this runs (WAL): wait
  // for its locks instead of failing on the first SQLITE_BUSY
  await rawClient.execute("PRAGMA busy_timeout = 8000");
  const { newId, nowIso } = await import("../src/lib/ids");
  const { getSetting, setSetting } = await import("../src/server/settings");
  const { record } = await import("../src/server/gamification/engine");
  const {
    KOW_SEEDED_SETTING,
    addDays,
    ensureKnowledgeOfWeekBadge,
    invalidateKnowledgeOfWeekIds,
    payKnowledgeOfWeekAwards,
    rolloverKnowledgeOfWeek,
    weekStartOf,
  } = await import("../src/server/services/knowledge-of-week");

  /* ---- 1. rules and the badge ---- */
  let rulesAdded = 0;
  for (const [eventType, points] of KOW_RULES) {
    const [row] = await db.select({ id: schema.gameRules.id }).from(schema.gameRules).where(eq(schema.gameRules.eventType, eventType)).limit(1);
    if (row) continue;
    await db.insert(schema.gameRules).values({ id: newId(), eventType, points, multiplierRulesJson: null, isActive: 1, excludedFromBoards: 0 });
    rulesAdded++;
  }
  await ensureKnowledgeOfWeekBadge();
  console.log(`cr08 kow: ${rulesAdded} rules added, badge knowledge_of_week present`);

  /* ---- 2. who sets, who reads ---- */
  const [setter] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "knowledge@npc.qa")).limit(1);
  const [admin] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "admin@npc.qa")).limit(1);
  const setBy = setter?.id ?? admin?.id ?? null;
  const readers = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(and(isNull(schema.users.deletedAt), sql`${schema.users.email} not in ('admin@npc.qa', 'knowledge@npc.qa')`))
    .orderBy(asc(schema.users.email))
    .limit(40);

  /* ---- 3. candidates ---- */
  const typeRows = await db
    .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
    .from(schema.taxonomyTerms)
    .where(inArray(schema.taxonomyTerms.code, ["study", "research", "evaluation", "report"]));
  const typeIdsOf = (codes: string[]) => typeRows.filter((t) => codes.includes(t.code)).map((t) => t.id);

  async function verifiedDoc(codes: string[], exclude: Set<string>) {
    const ids = typeIdsOf(codes);
    if (!ids.length) return null;
    const rows = await db
      .select({ id: schema.documents.id, ownerUserId: schema.documents.ownerUserId, titleEn: schema.documents.titleEn })
      .from(schema.documents)
      .innerJoin(schema.users, eq(schema.users.id, schema.documents.ownerUserId))
      .where(
        and(
          eq(schema.documents.status, "verified"),
          isNull(schema.documents.deletedAt),
          inArray(schema.documents.knowledgeTypeTermId, ids),
          sql`${schema.documents.classificationLevel} <= 2`,
          sql`${schema.users.departmentId} is not null`
        )
      )
      .orderBy(asc(schema.documents.classificationLevel), desc(schema.documents.createdAt))
      .limit(20);
    return rows.find((r) => !exclude.has(r.id)) ?? null;
  }
  async function verifiedLesson(exclude: Set<string>) {
    const rows = await db
      .select({ id: schema.lessons.id, authorId: schema.lessons.authorId, titleEn: schema.lessons.titleEn })
      .from(schema.lessons)
      .innerJoin(schema.users, eq(schema.users.id, schema.lessons.authorId))
      .where(and(eq(schema.lessons.status, "verified"), sql`${schema.lessons.classificationLevel} <= 2`))
      .orderBy(desc(schema.lessons.reuseCount), desc(schema.lessons.createdAt))
      .limit(20);
    return rows.find((r) => !exclude.has(r.id)) ?? null;
  }
  async function publishedReport() {
    const rows = await db
      .select({ id: schema.reports.id, requestedBy: schema.reports.requestedBy, titleEn: schema.reports.titleEn })
      .from(schema.reports)
      .where(and(inArray(schema.reports.status, ["published", "approved"]), sql`${schema.reports.typeId} is not null`, sql`${schema.reports.classificationLevel} <= 2`))
      .orderBy(desc(schema.reports.createdAt))
      .limit(5);
    return rows[0] ?? null;
  }

  /* ---- 4. one row per slot, only where the week is free ---- */
  const thisWeek = weekStartOf();
  const used = new Set<string>();
  const existingRows = await db.select().from(schema.knowledgeOfWeek);
  for (const r of existingRows) used.add(r.resourceId);
  const seeded = await getSetting<{ ids?: string[] }>(KOW_SEEDED_SETTING, {});
  const seededIds = new Set(seeded.ids ?? []);
  let inserted = 0;
  let paid = 0;
  let readsInserted = 0;

  for (const slot of SLOTS) {
    const weekStart = addDays(thisWeek, slot.offsetWeeks * 7);
    const existing = existingRows.find((r) => r.weekStart === weekStart);
    if (existing) {
      // a pick already holds the week: seeded earlier (recognised by its
      // note), or set by an administrator, which is left alone. An earlier
      // run interrupted by a busy database is reconciled here: the read
      // count from the reads rows, the awards paid once.
      const seededEarlier = seededIds.has(existing.id) || existing.noteEn === slot.noteEn;
      if (seededEarlier) {
        seededIds.add(existing.id);
        // nobody signs the note on their own work: the other administrator sets it
        if (existing.contributorUserId && existing.setBy === existing.contributorUserId) {
          const other = existing.setBy === admin?.id ? setter?.id : admin?.id;
          if (other) await db.update(schema.knowledgeOfWeek).set({ setBy: other }).where(eq(schema.knowledgeOfWeek.id, existing.id));
        }
        if (existing.status === "archived") {
          const [{ n }] = await db
            .select({ n: sql<number>`count(*)` })
            .from(schema.knowledgeOfWeekReads)
            .where(eq(schema.knowledgeOfWeekReads.kowId, existing.id));
          if (Number(n) !== existing.readCount) {
            await db.update(schema.knowledgeOfWeek).set({ readCount: Number(n) }).where(eq(schema.knowledgeOfWeek.id, existing.id));
          }
          if (await payKnowledgeOfWeekAwards(existing.id, { quiet: true })) paid++;
        }
      }
      continue;
    }

    let resourceType: string;
    let resourceId: string | null = null;
    let contributor: string | null = null;
    let label = "";
    if (slot.pick === "study") {
      const d = await verifiedDoc(["study", "research"], used);
      if (d) { resourceType = "study"; resourceId = d.id; contributor = d.ownerUserId; label = d.titleEn; }
      else resourceType = "study";
    } else if (slot.pick === "evaluation") {
      const d = (await verifiedDoc(["evaluation", "research", "study"], used)) ?? (await verifiedDoc(["report"], used));
      if (d) { resourceType = "study"; resourceId = d.id; contributor = d.ownerUserId; label = d.titleEn; }
      else resourceType = "study";
    } else if (slot.pick === "report_doc") {
      const d = (await verifiedDoc(["report"], used)) ?? (await verifiedDoc(["study", "research"], used));
      if (d) { resourceType = "document"; resourceId = d.id; contributor = d.ownerUserId; label = d.titleEn; }
      else resourceType = "document";
    } else if (slot.pick === "lesson") {
      const l = await verifiedLesson(used);
      resourceType = "lesson";
      if (l) { resourceId = l.id; contributor = l.authorId; label = l.titleEn; }
    } else {
      const r = await publishedReport();
      if (r && !used.has(r.id)) { resourceType = "report"; resourceId = r.id; contributor = r.requestedBy; label = r.titleEn ?? ""; }
      else {
        const d = await verifiedDoc(["report", "study", "research"], used);
        resourceType = "document";
        if (d) { resourceId = d.id; contributor = d.ownerUserId; label = d.titleEn; }
      }
    }
    if (!resourceId) {
      console.log(`cr08 kow: no candidate for the week of ${weekStart} (${slot.pick}), skipped`);
      continue;
    }
    used.add(resourceId);

    const [owner] = contributor
      ? await db.select({ departmentId: schema.users.departmentId }).from(schema.users).where(eq(schema.users.id, contributor)).limit(1)
      : [];
    const id = newId();
    const archived = slot.offsetWeeks < 0;
    // nobody signs the note on their own work: the other administrator sets it
    const signedBy = contributor && contributor === setBy ? (admin?.id ?? setBy) : setBy;
    await db.insert(schema.knowledgeOfWeek).values({
      id,
      weekStart,
      resourceType,
      resourceId,
      contributorUserId: contributor,
      unitId: owner?.departmentId ?? null,
      noteEn: slot.noteEn,
      noteAr: slot.noteAr,
      setBy: signedBy,
      setAt: archived ? addDays(weekStart, -3) + "T09:00:00.000Z" : nowIso(),
      status: archived ? "archived" : "scheduled",
      readCount: 0,
    });
    seededIds.add(id);
    inserted++;
    console.log(`cr08 kow: week of ${weekStart} -> ${resourceType} "${label}" (${archived ? "archived" : "scheduled"})`);

    if (archived) {
      // reads by a handful of colleagues during that week, ten points each
      const pool = readers.filter((u) => u.id !== contributor).slice(0, slot.reads);
      let day = 0;
      for (const u of pool) {
        await db.insert(schema.knowledgeOfWeekReads).values({
          id: newId(),
          kowId: id,
          userId: u.id,
          readAt: addDays(weekStart, 1 + (day++ % 5)) + "T10:30:00.000Z",
        });
        await db.insert(schema.knowledgeOfWeekSeen).values({ id: newId(), kowId: id, userId: u.id, seenAt: addDays(weekStart, 1) + "T08:15:00.000Z" });
        await record({ userId: u.id, type: "kow_read", resourceType: "knowledge_of_week", resourceId: id });
        readsInserted++;
      }
      await db.update(schema.knowledgeOfWeek).set({ readCount: pool.length }).where(eq(schema.knowledgeOfWeek.id, id));
      if (await payKnowledgeOfWeekAwards(id, { quiet: true })) paid++;
    }
  }

  await setSetting(KOW_SEEDED_SETTING, { ids: [...seededIds] });
  invalidateKnowledgeOfWeekIds();

  /* ---- 5. the job: activates this week's pick and pays its awards ---- */
  const roll = await rolloverKnowledgeOfWeek();
  const counts = await db
    .select({ status: schema.knowledgeOfWeek.status, n: sql<number>`count(*)` })
    .from(schema.knowledgeOfWeek)
    .groupBy(schema.knowledgeOfWeek.status);
  console.log(
    `cr08 kow: ${inserted} picks inserted, ${readsInserted} reads, ${paid} archived awards paid, rollover archived ${roll.archived} and activated ${roll.activated ? "this week's pick" : "nothing new"}; table: ${counts.map((c) => `${c.status}=${c.n}`).join(", ")}`
  );
}

const isMain = process.argv[1] && /cr08-kow-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Kow()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
