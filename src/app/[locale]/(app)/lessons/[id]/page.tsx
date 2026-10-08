import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { EmptyState, Chip, RagDot } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { getOwnerRefs } from "@/server/services/people";
import { BadgeCheck } from "lucide-react";
import { LessonVerify } from "./LessonVerify";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { SetKnowledgeOfWeekButton } from "@/components/nexus/kow";
import { canManageKnowledgeOfWeek } from "@/server/services/knowledge-of-week";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("lessons");
  const tc = await getTranslations("common");

  const [lesson] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id)).limit(1);
  if (!lesson || lesson.classificationLevel > user.clearanceLevel) {
    return <EmptyState title={tc("notFound")} className="mt-12" />;
  }
  const { audit } = await import("@/server/auth/audit");
  await audit(user.id, "view", "lesson", id);
  // CR08 9.1: the author as a person chip, so the card opens from the lesson
  const authorRefs = await getOwnerRefs([lesson.authorId]);
  const author = lesson.authorId ? authorRefs[lesson.authorId] ?? null : null;
  const node = lesson.nodeId
    ? (
        await db
          .select()
          .from(schema.strategyNodes)
          .where(eq(schema.strategyNodes.id, lesson.nodeId))
          .limit(1)
      )[0] ?? null
    : null;
  const tags = await db
    .select({
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
      dimension: schema.taxonomyDimensions.code,
    })
    .from(schema.taggings)
    .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.taggings.termId))
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(and(eq(schema.taggings.resourceType, "lesson"), eq(schema.taggings.resourceId, id)));

  const canVerify =
    lesson.status !== "verified" &&
    can(user, "verify", "lessons", { classificationLevel: lesson.classificationLevel });

  const sections = [
    { key: "context", en: lesson.contextEn, ar: lesson.contextAr, tone: "mist" },
    { key: "learning", en: lesson.learningEn, ar: lesson.learningAr, tone: "aqua" },
    { key: "recommendation", en: lesson.recommendationEn, ar: lesson.recommendationAr, tone: "teal" },
  ] as const;

  return (
    <Reveal>
      {/* CR08 2.3: the Ask EnviroAI launcher knows this lesson */}
      <AskContextItem item={{ kind: "lesson", id, titleEn: lesson.titleEn, titleAr: lesson.titleAr, href: `/lessons/${id}` }} />
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {lesson.status === "verified" ? (
              <Chip tone="ok">
                <BadgeCheck className="size-3" /> {tc("verified")}
              </Chip>
            ) : (
              <Chip tone="mist">{tc(`status.${lesson.status}` as never)}</Chip>
            )}
            {tags.map((tag, i) => (
              <Chip key={i} tone={tag.dimension === "outcome" ? "navy" : "mist"}>
                {bi(locale, tag.nameEn, tag.nameAr)}
              </Chip>
            ))}
          </div>
          <h1 className="mt-3 text-2xl leading-snug">{bi(locale, lesson.titleEn, lesson.titleAr)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-600">
            {author ? (
              <OwnerControl
                owner={author}
                role="author"
                size="sm"
                align="start"
                item={{ type: "lesson", id, titleEn: lesson.titleEn, titleAr: lesson.titleAr, href: `/lessons/${id}` }}
              />
            ) : null}
            <span className="text-xs text-ink-400 tnum">
              {formatDate(lesson.createdAt, locale)}
            </span>
            <span className="ms-auto flex items-center gap-2">
              {/* CR08 8: a Knowledge Admin can make a verified lesson the week's pick */}
              {canManageKnowledgeOfWeek(user) && lesson.status === "verified" ? (
                <SetKnowledgeOfWeekButton
                  resourceType="lesson"
                  resourceId={id}
                  titleEn={lesson.titleEn}
                  titleAr={lesson.titleAr}
                  numerals={user.numeralsPref}
                />
              ) : null}
              {canVerify ? <LessonVerify lessonId={id} /> : null}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map((s) =>
            s.en || s.ar ? (
              <section
                key={s.key}
                className={
                  s.tone === "aqua"
                    ? "rounded-xl border border-aqua-300 bg-aqua-100/40 p-5"
                    : s.tone === "teal"
                      ? "rounded-xl border border-teal-100 bg-teal-100/40 p-5"
                      : "card p-5"
                }
              >
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t(`${s.key}Field` as never)}
                </p>
                <p className="text-[15px] leading-relaxed text-ink-900">
                  {bi(locale, s.en ?? "", s.ar ?? "")}
                </p>
              </section>
            ) : null
          )}
        </div>

        {node ? (
          <Link
            href={`/strategy/${node.id}` as never}
            className="card card-hover mt-6 flex items-center gap-3 p-4"
          >
            <RagDot status={node.status} />
            <span className="text-sm text-ink-900">{bi(locale, node.titleEn, node.titleAr)}</span>
            <Chip tone="ghost" className="ms-auto">{t("linkedNode")}</Chip>
          </Link>
        ) : null}
      </div>
    </Reveal>
  );
}
