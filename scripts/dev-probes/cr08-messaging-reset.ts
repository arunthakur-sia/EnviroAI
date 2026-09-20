/* eslint-disable no-console */
// CR08 9 verification helper: removes the six seeded conversations (and the
// notifications that point at them) so scripts/cr08-messaging-seed.ts can be
// proved to build them from nothing and then to stay idempotent. It never
// touches a thread a person actually created.
//   npx tsx scripts/dev-probes/cr08-messaging-reset.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { like, inArray } = await import("drizzle-orm");
  const rows = await db
    .select({ id: schema.messageThreads.id })
    .from(schema.messageThreads)
    .where(like(schema.messageThreads.id, "cr08msg_thread_%"));
  const ids = rows.map((r) => r.id);
  if (!ids.length) {
    console.log("cr08 messaging reset: nothing seeded");
    return;
  }
  // a conversation turned into an Ask NPC question keeps that question alive;
  // take it with the thread so a reset then reseed leaves nothing orphaned
  const questionIds = (await db.select().from(schema.messageThreads).where(inArray(schema.messageThreads.id, ids)))
    .map((t) => t.questionId)
    .filter((q): q is string => Boolean(q));
  await db.delete(schema.messages).where(inArray(schema.messages.threadId, ids));
  await db.delete(schema.threadParticipants).where(inArray(schema.threadParticipants.threadId, ids));
  await db.delete(schema.messageThreads).where(inArray(schema.messageThreads.id, ids));
  for (const id of ids) {
    await db.delete(schema.notifications).where(like(schema.notifications.link, `%thread=${id}`));
  }
  if (questionIds.length) {
    await db.delete(schema.questionRoutes).where(inArray(schema.questionRoutes.questionId, questionIds));
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    for (const q of questionIds) {
      await db.delete(schema.notifications).where(like(schema.notifications.link, `%/ask/${q}`));
    }
  }
  console.log(
    `cr08 messaging reset: removed ${ids.length} seeded conversation(s)` +
      (questionIds.length ? ` and ${questionIds.length} converted question(s)` : "")
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
