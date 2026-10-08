// Ask EnviroAI: streams the grounded answer as SSE events.
// Events: sources, delta, final (see src/server/ai/ask.ts).
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { askStream } from "@/server/ai/ask";
import { audit } from "@/server/auth/audit";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";

const Body = z.object({
  query: z.string().min(2).max(2000),
  locale: z.string().default("en"),
  scopeDocumentIds: z.array(z.string()).optional(),
  conversationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("invalid body", { status: 400 });
  const { query, locale, scopeDocumentIds } = parsed.data;

  // conversation bookkeeping
  let conversationId = parsed.data.conversationId;
  if (!conversationId) {
    conversationId = newId();
    await db.insert(schema.aiConversations).values({
      id: conversationId,
      userId: user.id,
      title: query.slice(0, 120),
      contextJson: scopeDocumentIds ? JSON.stringify({ scopeDocumentIds }) : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  await db.insert(schema.aiMessages).values({
    id: newId(),
    conversationId,
    role: "user",
    content: query,
    createdAt: nowIso(),
  });
  await audit(user.id, "ask", "ai_conversation", conversationId, { scoped: Boolean(scopeDocumentIds) });

  const encoder = new TextEncoder();
  const convId = conversationId;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      try {
        send("meta", { conversationId: convId });
        for await (const ev of askStream({ user, query, locale, scopeDocumentIds })) {
          send(ev.type, ev);
          if (ev.type === "final") {
            await db.insert(schema.aiMessages).values({
              id: newId(),
              conversationId: convId,
              role: "assistant",
              content: ev.markdown,
              citationsJson: JSON.stringify(ev.citations),
              confidence: ev.confidence,
              retrievedChunkIdsJson: JSON.stringify(ev.chunkIds),
              createdAt: nowIso(),
            });
            await db
              .update(schema.aiConversations)
              .set({ updatedAt: nowIso() })
              .where((await import("drizzle-orm")).eq(schema.aiConversations.id, convId));
          }
        }
      } catch (e) {
        send("error", { message: String((e as Error)?.message ?? e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
