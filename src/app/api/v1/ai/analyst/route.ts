// Ask EnviroAI 2.0: the analyst loop as SSE.
// Events: meta, chip, workspace, sources, delta, final, error.
import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { analystStream, maybeSummarise } from "@/server/ai/analyst";
import { audit } from "@/server/auth/audit";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";

export const maxDuration = 120;

const Body = z.object({
  message: z.string().min(2).max(4000),
  locale: z.string().default("en"),
  conversationId: z.string().optional(),
  context: z
    .object({ type: z.enum(["document", "signal", "node", "indicator"]), id: z.string() })
    .nullable()
    .optional(),
  /* CR08 2.3: the item the reader is looking at when asking from the panel */
  contextItem: z
    .object({
      kind: z.string().min(1).max(40),
      id: z.string().min(1).max(64),
      code: z.string().max(64).nullable().optional(),
      title: z.string().min(1).max(300),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("invalid body", { status: 400 });
  const { message, locale, context, contextItem } = parsed.data;

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const [conv] = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.id, conversationId))
      .limit(1);
    if (!conv || conv.userId !== user.id) {
      return new Response("conversation not found", { status: 404 });
    }
  } else {
    conversationId = newId();
    await db.insert(schema.aiConversations).values({
      id: conversationId,
      userId: user.id,
      title: message.slice(0, 120),
      contextJson: context ? JSON.stringify(context) : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  await db.insert(schema.aiMessages).values({
    id: newId(),
    conversationId,
    role: "user",
    content: message,
    createdAt: nowIso(),
  });
  await audit(user.id, "ask", "ai_conversation", conversationId, {
    analyst: true,
    context: context?.type,
    contextItem: contextItem ? `${contextItem.kind}:${contextItem.id}` : undefined,
  });

  const encoder = new TextEncoder();
  const convId = conversationId;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send("meta", { conversationId: convId });
        for await (const ev of analystStream({
          user,
          message,
          locale,
          conversationId: convId,
          context: context ?? null,
          contextItem: contextItem ?? null,
        })) {
          send(ev.type, ev);
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
            await db
              .update(schema.aiConversations)
              .set({ updatedAt: nowIso() })
              .where(eq(schema.aiConversations.id, convId));
            await maybeSummarise(convId).catch(() => {});
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
