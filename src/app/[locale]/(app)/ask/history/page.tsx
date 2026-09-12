import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { desc, eq, asc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { Reveal } from "@/components/motion";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { HistoryViewer } from "./HistoryViewer";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("askPage");

  const conversations = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.userId, user.id))
    .orderBy(desc(schema.aiConversations.updatedAt))
    .limit(40);

  const selectedId = sp.c ?? conversations[0]?.id;
  const messages = selectedId
    ? await db
        .select()
        .from(schema.aiMessages)
        .where(eq(schema.aiMessages.conversationId, selectedId))
        .orderBy(asc(schema.aiMessages.createdAt))
    : [];

  return (
    <Reveal>
      <h1 className="text-2xl">{t("history")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("historySubtitle")}</p>
      {conversations.length === 0 ? (
        <EmptyState title={t("noHistory")} hint={t("noHistoryHint")} className="mt-8" />
      ) : (
        <HistoryViewer
          conversations={conversations.map((c) => ({
            id: c.id,
            title: c.title ?? "…",
            updatedAt: relativeTime(c.updatedAt, locale),
          }))}
          selectedId={selectedId ?? null}
          messages={messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citationsJson: m.citationsJson,
            confidence: m.confidence,
          }))}
        />
      )}
    </Reveal>
  );
}
