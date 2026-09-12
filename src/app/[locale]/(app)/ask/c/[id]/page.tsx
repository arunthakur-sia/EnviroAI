import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import type { AnalystTurnData, AnalystWorkspaceData } from "@/components/nexus/Workspace";
import type { Citation } from "@/components/nexus/AnswerStream";
import { ConversationClient } from "./ConversationClient";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ q?: string; context?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  // /ask/c/new starts a fresh conversation, optionally auto-submitting ?q=
  if (id === "new") {
    let context: { type: string; id: string } | null = null;
    if (sp.context) {
      const [type, ctxId] = sp.context.split(":");
      if (["document", "signal", "node", "indicator"].includes(type) && ctxId) {
        context = { type, id: ctxId };
      }
    }
    return (
      <ConversationClient
        conversationId={null}
        title=""
        turns={[]}
        isOwner
        isShared={false}
        initialQuery={sp.q ?? ""}
        context={context}
      />
    );
  }

  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);
  if (!conv) notFound();
  const isOwner = conv.userId === user.id;
  if (!isOwner && conv.isShared !== 1) notFound();

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
      // shared views re-run permission filtering at the viewer's clearance
      const visible = citations.filter(
        (c) => (c.classification ?? 1) <= user.clearanceLevel
      );
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
      confidence: (m.confidence as never) ?? undefined,
      includesSecret,
      hiddenSources,
    };
  });

  return (
    <ConversationClient
      conversationId={conv.id}
      title={conv.title ?? ""}
      turns={turns}
      isOwner={isOwner}
      isShared={conv.isShared === 1}
      initialQuery=""
      context={null}
    />
  );
}
