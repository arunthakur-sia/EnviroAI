/* eslint-disable no-console */
// CR04 5: housekeeping seeds. QNV pillar mapping, outcome chapter locations
// and extractive summaries (from the real NDS3 document chunks, DECISIONS 5),
// the Learning Room game rules, six lesson themes with syntheses when no
// clusters exist, a four-week Lesson of the week schedule, three reflection
// prompts, Lessons settings, and two seeded Learn sessions for the analyst.
// Idempotent: settings overwrite deterministically, rows insert only when
// absent. Run standalone (npx tsx scripts/cr04-seed.ts) or from seed.ts.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq, inArray, like } from "drizzle-orm";
import { ulid } from "ulid";

const STOP = new Set([
  "the", "of", "and", "a", "an", "to", "in", "for", "with", "into", "through",
  "qatar", "qatari", "national", "development", "strategy",
]);
function tokens(s: string): string[] {
  return [
    ...new Set(
      (s ?? "")
        .toLowerCase()
        .replace(/[^a-z؀-ۿ\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w))
    ),
  ];
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!؟?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 400);
}

export async function seedCr04(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { setSetting, getSetting } = await import("../src/server/settings");
  const { DEFAULT_QNV_PILLARS } = await import("../src/server/services/strategy");
  const nowIso = () => new Date().toISOString();

  /* 1. QNV pillar mapping (editable in Settings > Strategy) */
  const existingPillars = await getSetting("qnv_pillars", null as unknown);
  if (!existingPillars) await setSetting("qnv_pillars", DEFAULT_QNV_PILLARS);
  console.log("qnv_pillars ready");

  /* 2. outcome chapters: locate each outcome's pages in the NDS3 documents
     by token overlap (the public 36-page document has no formal chapter
     boundaries; the anchor page is the outcome's own section) */
  const docs = await db
    .select()
    .from(schema.documents)
    .where(like(schema.documents.titleEn, "Third National Development Strategy%"));
  const enDoc = docs.find((d) => d.languageOriginal === "en") ?? null;
  const arDoc = docs.find((d) => d.languageOriginal === "ar") ?? null;
  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"))
    .limit(1);
  const outcomes = nds3
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(
          and(
            eq(schema.strategyNodes.editionId, nds3.id),
            eq(schema.strategyNodes.nodeType, "outcome")
          )
        )
        .orderBy(asc(schema.strategyNodes.sort))
    : [];

  async function pageTexts(documentId: string): Promise<Map<number, string>> {
    const chunks = await db
      .select({ pageFrom: schema.documentChunks.pageFrom, text: schema.documentChunks.text })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId))
      .orderBy(asc(schema.documentChunks.chunkIndex));
    const map = new Map<number, string>();
    for (const c of chunks) {
      const p = c.pageFrom ?? 0;
      map.set(p, (map.get(p) ?? "") + " " + c.text);
    }
    return map;
  }

  function anchorsFor(
    pages: Map<number, string>,
    items: { code: string; query: string }[]
  ): Map<string, number> {
    const lower = new Map([...pages.entries()].map(([p, t]) => [p, t.toLowerCase()]));
    const scoresByOutcome = new Map<string, [number, number][]>();
    for (const item of items) {
      const toks = tokens(item.query);
      const scores: [number, number][] = [...lower.entries()]
        .map(([p, text]) => [p, toks.filter((t) => text.includes(t)).length] as [number, number])
        .sort((a, b) => b[1] - a[1]);
      scoresByOutcome.set(item.code, scores);
    }
    // pages that rank top-3 for four or more outcomes are overview pages
    const topCounts = new Map<number, number>();
    for (const scores of scoresByOutcome.values()) {
      for (const [p] of scores.slice(0, 3)) topCounts.set(p, (topCounts.get(p) ?? 0) + 1);
    }
    const generic = new Set([...topCounts.entries()].filter(([, c]) => c >= 4).map(([p]) => p));
    const anchors = new Map<string, number>();
    for (const [code, scores] of scoresByOutcome) {
      const best = scores.find(([p, s]) => s > 0 && !generic.has(p));
      if (best) anchors.set(code, best[0]);
    }
    return anchors;
  }

  if (enDoc && outcomes.length) {
    const enPages = await pageTexts(enDoc.id);
    const arPages = arDoc ? await pageTexts(arDoc.id) : new Map<number, string>();
    const enAnchors = anchorsFor(
      enPages,
      outcomes.map((o) => ({
        code: o.code ?? "",
        query: `${o.titleEn} ${(o.descriptionEn ?? "").slice(0, 200)}`,
      }))
    );
    const arAnchors = arDoc
      ? anchorsFor(
          arPages,
          outcomes.map((o) => ({
            code: o.code ?? "",
            query: `${o.titleAr} ${(o.descriptionAr ?? "").slice(0, 200)}`,
          }))
        )
      : new Map<string, number>();

    // chapter ranges: anchor .. next anchor - 1 (capped at +4 pages)
    const ordered = [...enAnchors.entries()].sort((a, b) => a[1] - b[1]);
    const rangeOf = new Map<string, [number, number]>();
    ordered.forEach(([code, page], i) => {
      const next = ordered[i + 1]?.[1] ?? page + 5;
      rangeOf.set(code, [page, Math.min(next - 1, page + 4)]);
    });

    // targets per outcome, for the composed summary
    const targetsByOutcome = new Map<string, { titleEn: string; titleAr: string }[]>();
    if (nds3) {
      const targetRows = await db
        .select()
        .from(schema.strategyNodes)
        .where(
          and(
            eq(schema.strategyNodes.editionId, nds3.id),
            eq(schema.strategyNodes.nodeType, "target")
          )
        )
        .orderBy(asc(schema.strategyNodes.sort));
      for (const tr of targetRows) {
        const parent = outcomes.find((o) => o.id === tr.parentId);
        if (!parent?.code) continue;
        (targetsByOutcome.get(parent.code) ?? targetsByOutcome.set(parent.code, []).get(parent.code)!).push({
          titleEn: tr.titleEn,
          titleAr: tr.titleAr,
        });
      }
    }

    // a clean prose sentence: mostly letters, real length, sentence-final
    const cleanSentences = (pages: Map<number, string>, from: number, to: number) => {
      const found: { s: string; p: number }[] = [];
      for (let p = from; p <= to && found.length < 2; p++) {
        for (const s of sentencesOf(pages.get(p) ?? "")) {
          const letters = (s.match(/[a-zA-Z؀-ۿ\s]/g) ?? []).length / s.length;
          const words = s.split(/\s+/).length;
          if (letters >= 0.8 && words >= 10 && /[.!؟?]$/.test(s)) {
            found.push({ s, p });
            if (found.length >= 2) break;
          }
        }
      }
      return found;
    };

    const chapters: Record<string, unknown> = {};
    for (const outcome of outcomes) {
      const code = outcome.code ?? "";
      const range = rangeOf.get(code);
      if (!range) continue;
      const arAnchor = arAnchors.get(code) ?? range[0];
      const arTo = Math.min(arAnchor + (range[1] - range[0]), arAnchor + 4);
      const targets = targetsByOutcome.get(code) ?? [];
      const pageRef = range[0] === range[1] ? `p. ${range[0]}` : `pp. ${range[0]}-${range[1]}`;
      const pageRefAr = arAnchor === arTo ? `ص. ${arAnchor}` : `ص. ${arAnchor}-${arTo}`;

      // composed 4-6 sentence summary: the outcome's framing, the chapter's
      // own prose where it is clean, the targets, and the delivery counts,
      // each with page citations (DECISIONS 5: deterministic at seed)
      const enParts: string[] = [];
      if (outcome.descriptionEn) enParts.push(`${outcome.descriptionEn.trim().replace(/[.]?$/, "")} (${pageRef}).`);
      for (const { s, p } of cleanSentences(enPages, range[0], range[1])) {
        enParts.push(`${s.replace(/[.]?$/, "")} (p. ${p}).`);
      }
      if (targets.length) {
        const named = targets.slice(0, 3).map((t) => t.titleEn.replace(/[.]$/, "")).join("; ");
        enParts.push(`The chapter carries ${targets.length} national targets, including: ${named} (${pageRef}).`);
      }
      enParts.push(`Delivery is tracked in the Living Strategy through the outcome's initiatives and projects (${pageRef}).`);

      const arParts: string[] = [];
      if (outcome.descriptionAr) arParts.push(`${outcome.descriptionAr.trim().replace(/[.]?$/, "")} (${pageRefAr}).`);
      for (const { s, p } of cleanSentences(arPages, arAnchor, arTo)) {
        arParts.push(`${s.replace(/[.]?$/, "")} (ص. ${p}).`);
      }
      if (targets.length) {
        const namedAr = targets.slice(0, 3).map((t) => t.titleAr.replace(/[.]$/, "")).join("؛ ");
        arParts.push(`يحمل الفصل ${targets.length} مستهدفات وطنية، منها: ${namedAr} (${pageRefAr}).`);
      }
      arParts.push(`يُتابع التنفيذ في الاستراتيجية الحية عبر مبادرات هذه النتيجة ومشاريعها (${pageRefAr}).`);

      chapters[code] = {
        documentId: enDoc.id,
        documentIdAr: arDoc?.id ?? null,
        pageFrom: range[0],
        pageTo: range[1],
        summaryEn: enParts.slice(0, 6).join(" "),
        summaryAr: arParts.slice(0, 6).join(" "),
      };
    }
    await setSetting("outcome_chapters", chapters);
    console.log(`outcome_chapters: ${Object.keys(chapters).length} chapters located`);
  }

  /* 3. Learning Room game rules */
  const newRules: [string, number][] = [
    ["learn_session_completed", 25],
    ["reflection_saved", 10],
    ["lesson_read_fully", 3],
  ];
  for (const [eventType, points] of newRules) {
    const [existing] = await db
      .select()
      .from(schema.gameRules)
      .where(eq(schema.gameRules.eventType, eventType))
      .limit(1);
    if (!existing) {
      await db.insert(schema.gameRules).values({ id: ulid(), eventType, points, isActive: 1 });
    }
  }
  console.log("learning game rules ready");

  /* 4. six lesson themes with syntheses when no clusters exist (CR04 5) */
  const clusterCount = await db.select({ id: schema.lessonClusters.id }).from(schema.lessonClusters);
  if (clusterCount.length < 6) {
    const { reclusterLessons } = await import("../src/server/services/lessons");
    const made = await reclusterLessons();
    console.log(`lesson themes clustered: ${made}`);
  } else {
    console.log(`lesson themes already exist: ${clusterCount.length}`);
    // make sure existing themes are in the unified index (CR04 5)
    const { embedStructuredRecords } = await import("../src/server/search/records");
    for (const c of clusterCount) {
      await embedStructuredRecords("lesson_theme", c.id);
    }
    console.log("lesson themes indexed");
  }

  /* 5. Lesson of the week: a four-week schedule from the worth-reading score */
  const { lessonScore } = await import("../src/server/services/lessons");
  const lessons = await db
    .select()
    .from(schema.lessons)
    .where(inArray(schema.lessons.status, ["published", "verified"]));
  const ranked = lessons
    .map((l) => ({ l, score: lessonScore({ status: l.status, reuseCount: l.reuseCount, createdAt: l.createdAt, endorsements: 0 }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const monday = (offsetWeeks: number) => {
    const now = new Date();
    const day = (now.getUTCDay() + 6) % 7;
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + offsetWeeks * 7));
    return m.toISOString().slice(0, 10);
  };
  await setSetting("lesson_of_week", {
    schedule: ranked.map((r, i) => ({ weekStart: monday(i), lessonId: r.l.id })),
  });
  console.log("lesson_of_week schedule: 4 weeks");

  /* 6. reflection prompts (editable in Settings > Lessons) */
  await setSetting("reflection_prompts", [
    {
      en: "Which of your projects could this apply to?",
      ar: "على أي من مشاريعك يمكن تطبيق هذا الدرس؟",
    },
    {
      en: "What would you do differently in your next milestone because of this?",
      ar: "ما الذي ستفعله بشكل مختلف في مرحلتك القادمة بسبب هذا الدرس؟",
    },
    {
      en: "Who on your team should hear this lesson this week?",
      ar: "من في فريقك يجب أن يسمع هذا الدرس هذا الأسبوع؟",
    },
  ]);

  /* 7. Lessons settings */
  const lessonsSettings = await getSetting("lessons_settings", null as unknown);
  if (!lessonsSettings) {
    await setSetting("lessons_settings", { learnModeEnabled: true, reclusterNightly: true });
  }

  /* 8. two seeded Learn sessions for the analyst (one finished with a note,
     one from an earlier week) */
  const [analyst] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "analyst@npc.qa"))
    .limit(1);
  if (analyst) {
    const existing = await db
      .select({ id: schema.learnSessions.id })
      .from(schema.learnSessions)
      .where(eq(schema.learnSessions.userId, analyst.id));
    if (!existing.length && ranked.length) {
      const pool = lessons.slice(0, 10).map((l) => l.id);
      const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
      await db.insert(schema.learnSessions).values([
        {
          id: ulid(),
          userId: analyst.id,
          lessonIdsJson: JSON.stringify(pool.slice(0, 5)),
          progressJson: JSON.stringify({ index: 5, read: pool.slice(0, 5) }),
          completedAt: daysAgo(2),
          createdAt: daysAgo(2),
        },
        {
          id: ulid(),
          userId: analyst.id,
          lessonIdsJson: JSON.stringify(pool.slice(5, 10)),
          progressJson: JSON.stringify({ index: 5, read: pool.slice(5, 10) }),
          completedAt: daysAgo(9),
          createdAt: daysAgo(9),
        },
      ]);
      const noteLesson = pool[0];
      const [noteExists] = await db
        .select({ id: schema.notes.id })
        .from(schema.notes)
        .where(eq(schema.notes.userId, analyst.id))
        .limit(1);
      if (!noteExists && noteLesson) {
        await db.insert(schema.notes).values({
          id: ulid(),
          userId: analyst.id,
          lessonId: noteLesson,
          text: "Applies to the census linkage work: run the small-scale format test before the next wave.",
          createdAt: daysAgo(2),
        });
      }
      console.log("analyst learn sessions seeded: 2");
    } else {
      console.log("analyst learn sessions already present");
    }
  }
}

const isMain = process.argv[1] && /cr04-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr04()
    .then(() => {
      console.log("cr04 seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
