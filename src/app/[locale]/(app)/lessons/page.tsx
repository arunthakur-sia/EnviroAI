// CR02 3.3: the Lessons page. Category segmented control with counts in the
// header (Add Knowledge at the end), three browse modes: Feed (default),
// By project (nodes with their lesson counts, expanding), Clusters.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ChevronDown, Headphones, Lightbulb, Plus } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal, Stagger } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Button, Chip, EmptyState, RagDot } from "@/components/ui/primitives";
import { LessonCard } from "@/components/nexus/LessonCard";
import { ReportButton } from "@/components/nexus/ReportButton";
import { LessonsFilter } from "./LessonsFilter";
import { CategoryTabs } from "./CategoryTabs";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    outcome?: string;
    status?: string;
    view?: string;
    category?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("lessons");
  const ts = await getTranslations("strategy");
  const tp = await getTranslations("podcast");
  const CATEGORY_EN: Record<string, string> = {
    delivery: "delivery lessons",
    external: "external learning",
    expert: "expert insights",
    institutional: "institutional knowledge",
  };
  const tEn = (c: string) => CATEGORY_EN[c] ?? "lessons learned";

  const clearance = sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`;

  /* Category counts across everything in clearance (before other filters) */
  const countRows = await db
    .select({ category: schema.lessons.category, c: sql<number>`count(*)` })
    .from(schema.lessons)
    .where(clearance)
    .groupBy(schema.lessons.category);
  const counts: Record<string, number> = {};
  for (const r of countRows) counts[r.category] = r.c;

  const conds = [clearance];
  if (sp.status) conds.push(eq(schema.lessons.status, sp.status));
  if (sp.category) conds.push(eq(schema.lessons.category, sp.category));

  let lessons = await db
    .select()
    .from(schema.lessons)
    .where(and(...conds))
    .orderBy(desc(schema.lessons.createdAt))
    .limit(120);

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

  /* Node info for cards and the By-project mode */
  const nodeIds = [...new Set(lessons.map((l) => l.nodeId).filter(Boolean))] as string[];
  const nodes = nodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          code: schema.strategyNodes.code,
          nodeType: schema.strategyNodes.nodeType,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
          status: schema.strategyNodes.status,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, nodeIds))
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const clusters = await db.select().from(schema.lessonClusters).limit(12);
  const view =
    sp.view === "clusters" ? "clusters" : sp.view === "projects" ? "projects" : "feed";
  const canAdd = can(user, "create", "lessons");

  const toCard = (l: (typeof lessons)[number]) => {
    const node = l.nodeId ? nodeById.get(l.nodeId) : null;
    const outcome = tags.find((tg) => tg.resourceId === l.id && tg.dimension === "outcome");
    return {
      id: l.id,
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      learningEn: l.learningEn,
      learningAr: l.learningAr,
      recommendationEn: l.recommendationEn,
      recommendationAr: l.recommendationAr,
      status: l.status,
      reuseCount: l.reuseCount,
      category: l.category,
      nodeCode: node?.code ?? null,
      outcomeNameEn: outcome?.nameEn ?? null,
      outcomeNameAr: outcome?.nameAr ?? null,
    };
  };

  /* By-project grouping: nodes with their lessons, biggest first */
  const groups = nodeIds
    .map((id) => ({
      node: nodeById.get(id)!,
      lessons: lessons.filter((l) => l.nodeId === id),
    }))
    .filter((g) => g.node && g.lessons.length)
    .sort((a, b) => b.lessons.length - a.lessons.length);

  return (
    <Reveal>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* CR02 4.3: "Listen" makes an episode from the current lesson feed */}
          <Link
            href={
              `/podcast/new?topic=${encodeURIComponent(
                sp.category ? tEn(sp.category) : "lessons learned"
              )}` as never
            }
          >
            <Button variant="secondary">
              <Headphones /> {tp("listen")}
            </Button>
          </Link>
          {/* CR02 7.1: report over the current lesson filters */}
          <ReportButton
            scope={{
              kind: "lessons",
              ids: [],
              labelEn: sp.category ? tEn(sp.category) : "Lessons learned",
              labelAr: "الدروس المستفادة",
              filters: sp.category ? { category: sp.category } : undefined,
            }}
          />
          {canAdd ? (
            <Link href={"/add" as never}>
              <Button>
                <Plus /> {t("addKnowledge")}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        <CategoryTabs counts={counts} />
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
                    <LessonCard key={l.id} lesson={toCard(l)} showCategory />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "projects" ? (
        groups.length ? (
          <div className="mt-6 space-y-3" data-testid="lessons-by-project">
            {groups.map((g) => (
              <details key={g.node.id} className="card group/details overflow-hidden" open={groups.length <= 3}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-maroon-50">
                  <ChevronDown className="size-4 shrink-0 text-ink-600 transition-transform group-open/details:rotate-180" aria-hidden />
                  <RagDot status={g.node.status} />
                  {g.node.code ? (
                    <span className="text-xs text-ink-600 tnum">{g.node.code}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                    {bi(locale, g.node.titleEn, g.node.titleAr)}
                  </span>
                  <Chip tone="ghost">{ts(`nodeType.${g.node.nodeType}` as never)}</Chip>
                  <span className="text-xs text-ink-600 tnum">
                    {t("lessonCount", { count: g.lessons.length })}
                  </span>
                </summary>
                <div className="grid grid-cols-1 gap-3 border-t border-sand-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.lessons.map((l) => (
                    <LessonCard key={l.id} lesson={toCard(l)} showCategory />
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Lightbulb />} title={t("noProjectLessons")} className="mt-8" />
        )
      ) : lessons.length ? (
        <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.03}>
          {lessons.map((l) => (
            <LessonCard key={l.id} lesson={toCard(l)} showCategory />
          ))}
        </Stagger>
      ) : (
        <EmptyState
          icon={<Lightbulb />}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            canAdd ? (
              <Link href={"/add" as never}>
                <Button>
                  <Plus /> {t("addKnowledge")}
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
