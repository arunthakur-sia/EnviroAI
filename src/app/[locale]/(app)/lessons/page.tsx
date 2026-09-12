import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Lightbulb, Plus } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal, Stagger } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Button, EmptyState } from "@/components/ui/primitives";
import { LessonCard } from "@/components/nexus/LessonCard";
import { LessonsFilter } from "./LessonsFilter";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ outcome?: string; status?: string; view?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("lessons");

  const conds = [sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`];
  if (sp.status) conds.push(eq(schema.lessons.status, sp.status));

  let lessons = await db
    .select()
    .from(schema.lessons)
    .where(and(...conds))
    .orderBy(desc(schema.lessons.createdAt))
    .limit(80);

  // outcome filter + names via taggings
  const terms = await termsByDimension();
  const lessonIds = lessons.map((l) => l.id);
  const tags = lessonIds.length
    ? await db
        .select({
          resourceId: schema.taggings.resourceId,
          code: schema.taxonomyTerms.code,
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
        .where(
          and(
            eq(schema.taggings.resourceType, "lesson"),
            inArray(schema.taggings.resourceId, lessonIds)
          )
        )
    : [];
  if (sp.outcome) {
    const tagged = new Set(
      tags.filter((tg) => tg.dimension === "outcome" && tg.code === sp.outcome).map((tg) => tg.resourceId)
    );
    lessons = lessons.filter((l) => tagged.has(l.id));
  }

  const clusters = await db.select().from(schema.lessonClusters).limit(12);
  const view = sp.view === "clusters" ? "clusters" : "feed";

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        {can(user, "create", "lessons") ? (
          <Link href="/add">
            <Button>
              <Plus /> {t("capture")}
            </Button>
          </Link>
        ) : null}
      </div>

      <LessonsFilter
        outcomes={(terms.outcome ?? []).map((o) => ({ code: o.code, nameEn: o.nameEn, nameAr: o.nameAr }))}
        hasClusters={clusters.length > 0}
      />

      {view === "clusters" && clusters.length ? (
        <div className="mt-6 space-y-5">
          {clusters.map((c) => {
            let ids: string[] = [];
            try {
              ids = JSON.parse(c.lessonIdsJson ?? "[]");
            } catch { /* skip */ }
            const members = lessons.filter((l) => ids.includes(l.id));
            return (
              <div key={c.id} className="card p-5">
                <p className="font-medium text-ink-900">{bi(locale, c.labelEn, c.labelAr)}</p>
                {(c.summaryEn || c.summaryAr) ? (
                  <p className="mt-1 text-sm text-ink-600">
                    {bi(locale, c.summaryEn ?? "", c.summaryAr ?? "")}
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.slice(0, 6).map((l) => (
                    <LessonCard
                      key={l.id}
                      lesson={{
                        id: l.id,
                        titleEn: l.titleEn,
                        titleAr: l.titleAr,
                        learningEn: l.learningEn,
                        learningAr: l.learningAr,
                        recommendationEn: l.recommendationEn,
                        recommendationAr: l.recommendationAr,
                        status: l.status,
                        reuseCount: l.reuseCount,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : lessons.length ? (
        <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.03}>
          {lessons.map((l) => {
            const outcome = tags.find(
              (tg) => tg.resourceId === l.id && tg.dimension === "outcome"
            );
            return (
              <LessonCard
                key={l.id}
                lesson={{
                  id: l.id,
                  titleEn: l.titleEn,
                  titleAr: l.titleAr,
                  learningEn: l.learningEn,
                  learningAr: l.learningAr,
                  recommendationEn: l.recommendationEn,
                  recommendationAr: l.recommendationAr,
                  status: l.status,
                  reuseCount: l.reuseCount,
                  outcomeNameEn: outcome?.nameEn ?? null,
                  outcomeNameAr: outcome?.nameAr ?? null,
                }}
              />
            );
          })}
        </Stagger>
      ) : (
        <EmptyState
          icon={<Lightbulb />}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            can(user, "create", "lessons") ? (
              <Link href="/add">
                <Button>
                  <Plus /> {t("capture")}
                </Button>
              </Link>
            ) : undefined
          }
          className="mt-8"
        />
      )}
    </Reveal>
  );
}
