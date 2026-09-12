/* eslint-disable no-console */
// Regenerates the five seeded analyst conversations (mock mode) in place.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema, rawClient } = await import("../../src/server/db/client");
  const { newId, nowIso } = await import("../../src/lib/ids");
  const { eq, inArray } = await import("drizzle-orm");
  const { setSetting, DEFAULT_AI_SETTINGS } = await import("../../src/server/settings");
  const { analystStream } = await import("../../src/server/ai/analyst");

  await setSetting("ai", { ...DEFAULT_AI_SETTINGS, mockMode: true });
  const [analystUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "analyst@npc.qa"))
    .limit(1);
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, analystUser.roleId)).limit(1);
  const fullUser = { ...analystUser, role, department: null } as never;

  const old = await db
    .select({ id: schema.aiConversations.id })
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.userId, analystUser.id));
  if (old.length) {
    await db.delete(schema.aiMessages).where(inArray(schema.aiMessages.conversationId, old.map((o) => o.id)));
    await db.delete(schema.aiConversations).where(inArray(schema.aiConversations.id, old.map((o) => o.id)));
  }

  const questions = [
    "How are we doing in Qatarization?",
    "How many targets are in NDS3?",
    "Which outcomes are at risk?",
    "ما هو معدل التضخم الحالي؟",
    "Compare NDS2 and NDS3 on labour market targets",
  ];
  for (const question of questions) {
    const convId = newId();
    const now = nowIso();
    await db.insert(schema.aiConversations).values({
      id: convId,
      userId: analystUser.id,
      title: question.slice(0, 120),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.aiMessages).values({
      id: newId(),
      conversationId: convId,
      role: "user",
      content: question,
      createdAt: now,
    });
    for await (const ev of analystStream({
      user: fullUser,
      message: question,
      locale: /[؀-ۿ]/.test(question) ? "ar" : "en",
      conversationId: convId,
    })) {
      if (ev.type === "final") {
        await db.insert(schema.aiMessages).values({
          id: newId(),
          conversationId: convId,
          role: "assistant",
          content: ev.markdown,
          citationsJson: JSON.stringify(ev.citations),
          confidence: ev.confidence,
          workspaceJson: JSON.stringify({
            workspace: ev.workspace,
            followUps: ev.followUps,
            includesSecret: ev.includesSecret,
          }),
          createdAt: nowIso(),
        });
        const w = ev.workspace;
        console.log(
          `seeded: ${question.slice(0, 44)} | strategy=${w.strategy.length} numbers=${w.numbers.length} docs=${w.documents.length} lessons=${w.lessons.length} signals=${w.signals.length} people=${w.people.length} followups=${ev.followUps.length}`
        );
      }
    }
  }
  await setSetting("ai", { ...DEFAULT_AI_SETTINGS, mockMode: false });
  rawClient.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
