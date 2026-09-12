// CR02 4.6: the podcast library. Grid of episode cards with filters by
// outcome, focus, and language; visible to everyone whose clearance covers
// the episode's classification.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { listEpisodes } from "@/server/services/podcast";
import { Reveal, Stagger } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { Button, EmptyState } from "@/components/ui/primitives";
import { WaveformMark } from "../home/HomeToday";
import { EpisodeCardClient } from "./EpisodeCardClient";
import { PodcastFilters } from "./PodcastFilters";

export const dynamic = "force-dynamic";

export default async function PodcastPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ language?: string; focus?: string; outcome?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("podcast");

  const episodes = await listEpisodes(user, {
    language: sp.language,
    focus: sp.focus,
    outcome: sp.outcome,
  });
  const outcomes = await db
    .select({
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"))
    .orderBy(schema.taxonomyTerms.sort);

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl">
            <WaveformMark className="h-6 w-12" />
            {t("title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <Link href={"/podcast/new" as never}>
          <Button>
            <Plus /> {t("make")}
          </Button>
        </Link>
      </div>

      <PodcastFilters
        outcomes={outcomes.map((o) => ({ code: o.code, nameEn: o.nameEn, nameAr: o.nameAr }))}
      />

      {episodes.length ? (
        <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.04}>
          {episodes.map((e) => (
            <EpisodeCardClient key={e.id} episode={e} />
          ))}
        </Stagger>
      ) : (
        <EmptyState
          title={t("empty")}
          action={
            <Link href={"/podcast/new" as never}>
              <Button size="sm">
                <Plus /> {t("make")}
              </Button>
            </Link>
          }
          className="mt-8"
        />
      )}
    </Reveal>
  );
}
