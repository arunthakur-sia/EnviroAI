/* eslint-disable no-console */
// CR07 1: gives the existing lessons the multi-node shape the change request
// asks for. The CR02 era lessons each carry exactly one link (migrated by
// 0006_cr07.sql); this seed adds a realistic set of second and third links so
// the "several nodes, one primary" behaviour, the roll-up counts and the
// "Not linked" group all have something to show.
//
// Deterministic and idempotent: a lesson that already has more than one link
// is left alone.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { findHomeEdition } from "./data/edition";

const now = () => new Date().toISOString();

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export async function seedCr07LessonLinks(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");

  const lessons = await db
    .select({
      id: schema.lessons.id,
      authorId: schema.lessons.authorId,
      category: schema.lessons.category,
    })
    .from(schema.lessons);
  if (!lessons.length) return;

  const links = await db.select().from(schema.lessonNodeLinks);
  const linksByLesson = new Map<string, typeof links>();
  for (const l of links) {
    (linksByLesson.get(l.lessonId) ?? linksByLesson.set(l.lessonId, []).get(l.lessonId)!).push(l);
  }

  const nesNodes = await db
    .select({
      id: schema.strategyNodes.id,
      parentId: schema.strategyNodes.parentId,
      nodeType: schema.strategyNodes.nodeType,
      editionId: schema.strategyNodes.editionId,
    })
    .from(schema.strategyNodes);
  const homeEdition = await findHomeEdition(db, schema);
  const delivery = nesNodes.filter(
    (n) => n.editionId === homeEdition?.id && (n.nodeType === "project" || n.nodeType === "initiative")
  );
  const councilProjects = await db
    .select({ id: schema.councilNodes.id, level: schema.councilNodes.level })
    .from(schema.councilNodes);
  const councilTargets = councilProjects.filter(
    (n) => n.level === "project" || n.level === "output"
  );
  if (!delivery.length) return;

  let added = 0;
  let unlinked = 0;
  for (const lesson of lessons) {
    const own = linksByLesson.get(lesson.id) ?? [];
    if (own.length > 1) continue;
    const h = hashOf(lesson.id);

    // one lesson in six stays unlinked, so the "Not linked" group is real
    if (own.length === 0) {
      if (h % 6 === 0) {
        unlinked++;
        continue;
      }
      const node = delivery[h % delivery.length];
      await db.insert(schema.lessonNodeLinks).values({
        id: ulid(),
        lessonId: lesson.id,
        nodeId: node.id,
        nodeKind: "nes",
        isPrimary: 1,
        linkedBy: lesson.authorId,
        linkedAt: now(),
      });
      await db
        .update(schema.lessons)
        .set({ nodeId: node.id, updatedAt: now() })
        .where(eq(schema.lessons.id, lesson.id));
      own.push({ nodeId: node.id } as (typeof own)[number]);
      added++;
      // fall through: a lesson that just got its primary link can still gain a
      // second one, which is what makes "several nodes, one primary" real on a
      // pristine database where nothing was migrated
    }

    // about two in five of the linked lessons gain a second node, and a few of
    // those a third
    if (h % 5 >= 2) continue;
    const extras = h % 11 === 0 ? 2 : 1;
    const existingIds = new Set(own.map((l) => l.nodeId));
    for (let i = 0; i < extras; i++) {
      // one in four second links reaches into the Programme Strategy
      const intoCouncil = councilTargets.length > 0 && (h + i) % 4 === 0;
      const pool = intoCouncil ? councilTargets : delivery;
      const node = pool[(h + i * 7919) % pool.length];
      if (!node || existingIds.has(node.id)) continue;
      existingIds.add(node.id);
      await db.insert(schema.lessonNodeLinks).values({
        id: ulid(),
        lessonId: lesson.id,
        nodeId: node.id,
        nodeKind: intoCouncil ? "council" : "nes",
        isPrimary: 0,
        linkedBy: lesson.authorId,
        linkedAt: now(),
      });
      added++;
    }
  }

  const total = await db.select({ id: schema.lessonNodeLinks.id }).from(schema.lessonNodeLinks);
  const multi = new Map<string, number>();
  for (const l of await db
    .select({ lessonId: schema.lessonNodeLinks.lessonId })
    .from(schema.lessonNodeLinks)) {
    multi.set(l.lessonId, (multi.get(l.lessonId) ?? 0) + 1);
  }
  console.log(
    `cr07 lessons: ${added} links added, ${total.length} links total, ${[...multi.values()].filter((c) => c > 1).length} lessons linked to several nodes, ${unlinked} deliberately unlinked`
  );

  // every lesson's legacy node_id mirrors its primary edition link
  const { syncPrimaryMirror } = await import("../src/server/services/lesson-links");
  for (const lessonId of lessons.map((l) => l.id)) await syncPrimaryMirror(lessonId);
}

const isMain = process.argv[1] && /cr07-lessons-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr07LessonLinks()
    .then(() => {
      console.log("cr07 lessons seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
