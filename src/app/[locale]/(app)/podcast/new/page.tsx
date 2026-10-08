// CR02 4.3: the podcast composer. Pre-filled when opened from a node,
// document, collection, lesson feed, or Ask answer; otherwise a picker.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { Reveal } from "@/components/motion";
import { ComposerClient, type ComposerScope } from "./ComposerClient";

export const dynamic = "force-dynamic";

export default async function PodcastComposerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    node?: string;
    document?: string;
    collection?: string;
    lesson?: string;
    conversation?: string;
    topic?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("podcast");

  // resolve a pre-filled scope from the entry context
  let initialScope: ComposerScope | null = null;
  if (sp.node) {
    const [n] = await db
      .select()
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.id, sp.node))
      .limit(1);
    if (n) {
      initialScope = {
        kind: "node",
        ids: [n.id],
        labelEn: `${n.code ? n.code + " " : ""}${n.titleEn}`,
        labelAr: `${n.code ? n.code + " " : ""}${n.titleAr}`,
      };
    }
  } else if (sp.document) {
    const [d] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, sp.document))
      .limit(1);
    if (d && d.classificationLevel <= user.clearanceLevel) {
      initialScope = { kind: "document", ids: [d.id], labelEn: d.titleEn, labelAr: d.titleAr || d.titleEn };
    }
  } else if (sp.collection) {
    const [c] = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, sp.collection))
      .limit(1);
    if (c) initialScope = { kind: "collection", ids: [c.id], labelEn: c.nameEn, labelAr: c.nameAr };
  } else if (sp.lesson) {
    const [l] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, sp.lesson))
      .limit(1);
    if (l) initialScope = { kind: "lessons", ids: [l.id], labelEn: l.titleEn, labelAr: l.titleAr, query: l.titleEn };
  } else if (sp.conversation) {
    const [conv] = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.id, sp.conversation))
      .limit(1);
    if (conv && conv.userId === user.id) {
      const messages = await db
        .select()
        .from(schema.aiMessages)
        .where(eq(schema.aiMessages.conversationId, conv.id));
      const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
      initialScope = {
        kind: "conversation",
        ids: [conv.id],
        labelEn: conv.title ?? "Ask EnviroAI answer",
        labelAr: conv.title ?? "إجابة اسأل EnviroAI",
        query: lastAnswer?.content?.slice(0, 6000) ?? "",
      };
    }
  } else if (sp.topic) {
    initialScope = {
      kind: "topic",
      ids: [sp.topic],
      labelEn: sp.topic,
      labelAr: sp.topic,
      query: sp.topic,
    };
  }

  return (
    <Reveal>
      <div className="mb-6">
        <h1 className="text-2xl">{t("make")}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-600">{t("hosts")}</p>
      </div>
      <ComposerClient initialScope={initialScope} defaultLanguage={locale === "ar" ? "ar" : "en"} />
    </Reveal>
  );
}
