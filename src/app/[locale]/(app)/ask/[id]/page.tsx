import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { EmptyState, Avatar, Chip } from "@/components/ui/primitives";
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

  const [author] = await db
    .select({ nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, color: schema.users.avatarColor })
    .from(schema.users)
    .where(eq(schema.users.id, q.authorId))
    .limit(1);

  const answers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.questionId, id))
    .orderBy(asc(schema.answers.createdAt));
  const authorIds = [...new Set(answers.map((a) => a.authorId).filter(Boolean))] as string[];
  const authors = authorIds.length
    ? await db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          color: schema.users.avatarColor,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, authorIds))
    : [];

  const bounty = q.bountyId
    ? (await db.select().from(schema.bounties).where(eq(schema.bounties.id, q.bountyId)).limit(1))[0]
    : null;

  const canVerify = can(user, "verify", "ask", {
    departmentId: q.departmentId,
    classificationLevel: q.classificationLevel,
  });
  const canAnswer = can(user, "create", "ask");

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
          {author ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-600">
              <Avatar name={author.nameEn} color={author.color} size={24} />
              {bi(locale, author.nameEn, author.nameAr)}
            </p>
          ) : null}
        </div>

        <ThreadAnswers
          questionId={id}
          verifiedAnswerId={q.verifiedAnswerId}
          canVerify={canVerify}
          canAnswer={canAnswer}
          answers={answers.map((a) => {
            const authorMeta = authors.find((x) => x.id === a.authorId);
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
              authorNameEn: authorMeta?.nameEn ?? null,
              authorNameAr: authorMeta?.nameAr ?? null,
              authorColor: authorMeta?.color ?? "maroon",
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
