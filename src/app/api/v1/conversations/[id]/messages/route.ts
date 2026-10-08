// CR08 2.3: the turns of one analyst conversation (GET), so the Ask EnviroAI panel
// can continue a recent conversation in place. Same rules as /ask/c/[id]: the
// owner sees everything, a shared conversation is filtered to the viewer's
// clearance, anything else is not found.
import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import type { AnalystTurnData, AnalystWorkspaceData } from "@/components/nexus/Workspace";
import type { Citation } from "@/components/nexus/AnswerStream";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);
  if (!conv) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const isOwner = conv.userId === user.id;
  if (!isOwner && conv.isShared !== 1) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, id))
    .orderBy(asc(schema.aiMessages.createdAt));

  const turns: AnalystTurnData[] = rows.map((m) => {
    if (m.role === "user") return { role: "user", content: m.content };
    let citations: Citation[] = [];
    let workspace: AnalystWorkspaceData | null = null;
    let followUps: string[] = [];
    let includesSecret = false;
    try {
      citations = JSON.parse(m.citationsJson ?? "[]");
    } catch {
      /* none */
    }
    try {
      const ws = JSON.parse(m.workspaceJson ?? "{}");
      workspace = ws.workspace ?? null;
      followUps = ws.followUps ?? [];
      includesSecret = Boolean(ws.includesSecret);
    } catch {
      /* none */
    }
    let hiddenSources = 0;
    if (!isOwner) {
      const visible = citations.filter((c) => (c.classification ?? 1) <= user.clearanceLevel);
      hiddenSources = citations.length - visible.length;
      citations = visible;
      if (workspace) {
        workspace = {
          ...workspace,
          documents: workspace.documents.filter(
            (d) => (d.classification ?? 1) <= user.clearanceLevel
          ),
        };
      }
    }
    return {
      role: "assistant",
      content: m.content,
      citations,
      workspace,
      followUps,
      confidence: (m.confidence as AnalystTurnData["confidence"]) ?? undefined,
      includesSecret,
      hiddenSources,
    };
  });

  return NextResponse.json({
    data: {
      id: conv.id,
      title: conv.title ?? "",
      isShared: conv.isShared === 1,
      isOwner,
      turns,
    },
    error: null,
  });
}
