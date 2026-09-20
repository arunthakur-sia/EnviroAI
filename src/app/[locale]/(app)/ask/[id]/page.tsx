import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { EmptyState, Chip } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { getOwnerRefs } from "@/server/services/people";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { ThreadAnswers } from "./ThreadAnswers";

export const dynamic = "force-dynamic";

export default async function QuestionThreadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("askPage");
  const tc = await getTranslations("common");

  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id)).limit(1);
  if (!q || q.classificationLevel > user.clearanceLevel) {
    return <EmptyState title={tc("notFound")} className="mt-12" />;
  }
  await db
    .update(schema.questions)
    .set({ viewCount: sql`${schema.questions.viewCount} + 1` })
    .where(eq(schema.questions.id, id));

  const answers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.questionId, id))
    .orderBy(asc(schema.answers.createdAt));
  /* CR08 9.1: one bulk load for the asker and every human answer author, so
     each of them carries the id the person card needs */
  const people = await getOwnerRefs([q.authorId, ...answers.map((a) => a.authorId)]);
  const author = q.authorId ? people[q.authorId] ?? null : null;

  const bounty = q.bountyId
    ? (await db.select().from(schema.bounties).where(eq(schema.bounties.id, q.bountyId)).limit(1))[0]
    : null;

  const canVerify = can(user, "verify", "ask", {
    departmentId: q.departmentId,
    classificationLevel: q.classificationLevel,
  });
  const canAnswer = can(user, "create", "ask");
  const item = { type: "question", id, titleEn: q.titleEn, titleAr: q.titleAr, href: `/ask/${id}` };

  return (
    <Reveal>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={q.status === "verified" ? "ok" : q.status === "open" ? "warn" : "gulf"}>
              {tc(`status.${q.status}` as never)}
            </Chip>
            {bounty ? (
              <Chip tone="gold">
                {t("bountyChip", { points: bounty.points })}
              </Chip>
            ) : null}
            <span className="text-xs text-ink-400">{relativeTime(q.createdAt, locale)}</span>
          </div>
          <h1 className="mt-2 text-2xl leading-snug">{bi(locale, q.titleEn, q.titleAr)}</h1>
          {(q.bodyEn || q.bodyAr) ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-900">
              {bi(locale, q.bodyEn ?? "", q.bodyAr ?? "")}
            </p>
          ) : null}
          {/* CR08 9.1: the person who asked, with the person card */}
          {author ? (
            <div className="mt-3">
              <OwnerControl owner={author} role="author" size="sm" align="start" item={item} />
            </div>
          ) : null}
        </div>

        <ThreadAnswers
          questionId={id}
          verifiedAnswerId={q.verifiedAnswerId}
          canVerify={canVerify}
          canAnswer={canAnswer}
          item={item}
          answers={answers.map((a) => {
            const authorMeta = a.authorId ? people[a.authorId] ?? null : null;
            return {
              id: a.id,
              isAi: a.isAi === 1,
              bodyEn: a.bodyEn,
              bodyAr: a.bodyAr,
              citationsJson: a.citationsJson,
              confidence: a.confidence,
              isVerified: a.isVerified === 1,
              helpfulCount: a.helpfulCount,
              createdAt: a.createdAt,
              authorId: authorMeta?.id ?? null,
              authorNameEn: authorMeta?.nameEn ?? null,
              authorNameAr: authorMeta?.nameAr ?? null,
              authorColor: authorMeta?.avatarColor ?? "maroon",
            };
          })}
        />

        <div className="mt-8 flex justify-end">
          <BriefDialog resourceType="question" resourceId={id} variant="ghost" />
        </div>
      </div>
    </Reveal>
  );
}
