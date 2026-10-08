import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { listQuestions, createQuestion } from "@/server/services/ask";
import { getSetting } from "@/server/settings";
import { db, schema } from "@/server/db/client";
import { Reveal } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { Users2, ListTodo, History, MessageCircleQuestion, Share2 } from "lucide-react";
import { Button, Chip } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { AskLanding } from "./AskLanding";
import { QuestionRow } from "./QuestionRow";

export const dynamic = "force-dynamic";

export default async function AskPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; post?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  // zero-result search path: post the query straight to the unanswered board
  if (sp.q && sp.post === "1") {
    const created = await createQuestion(user, { title: sp.q.slice(0, 300) });
    if (created.ok && created.id) redirect(`/${locale}/ask/${created.id}`);
  }
  // legacy deep links: ?q= goes straight into a new analyst conversation
  if (sp.q) redirect(`/${locale}/ask/c/new?q=${encodeURIComponent(sp.q)}`);
  const t = await getTranslations("askPage");

  const [recentThreads, conversations, examples] = await Promise.all([
    listQuestions(user, { limit: 6 }),
    db
      .select({
        id: schema.aiConversations.id,
        title: schema.aiConversations.title,
        isShared: schema.aiConversations.isShared,
        updatedAt: schema.aiConversations.updatedAt,
      })
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.userId, user.id))
      .orderBy(desc(schema.aiConversations.updatedAt))
      .limit(8),
    getSetting<{ en: string; ar: string }[]>("example_questions", []),
  ]);

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ask/communities">
            <Button variant="secondary">
              <Users2 /> {t("communities")}
            </Button>
          </Link>
          <Link href="/ask/open">
            <Button variant="secondary">
              <ListTodo /> {t("openBoard")}
            </Button>
          </Link>
          <Link href="/ask/history">
            <Button variant="ghost">
              <History /> {t("history")}
            </Button>
          </Link>
        </div>
      </div>

      <AskLanding examples={examples} />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {conversations.length ? (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("recentConversations")}
            </p>
            <div className="card divide-y divide-mist-100">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/ask/c/${c.id}` as never}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50"
                >
                  <MessageCircleQuestion className="size-4 shrink-0 text-navy-500" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                    {c.title || t("untitled")}
                  </span>
                  {c.isShared === 1 ? (
                    <Chip tone="teal">
                      <Share2 className="size-3" /> {t("sharedChip")}
                    </Chip>
                  ) : null}
                  <span className="shrink-0 text-[11px] text-ink-400">
                    {relativeTime(c.updatedAt, locale)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {recentThreads.length ? (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("recentThreads")}
            </p>
            <div className="card divide-y divide-mist-100">
              {recentThreads.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Reveal>
  );
}
