import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Upload } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { headlineTiles, catalog, releaseCalendar } from "@/server/services/statistics";
import { IndicatorTile } from "@/components/nexus/IndicatorTile";
import { Reveal, Stagger } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Button, SectionTitle } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("statistics");

  const [tiles, categories, upcoming] = await Promise.all([
    headlineTiles(user),
    catalog(user),
    releaseCalendar(30),
  ]);
  const canImport = can(user, "create", "statistics");

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/statistics/releases">
            <Button variant="secondary">
              <CalendarDays /> {t("releases")}
            </Button>
          </Link>
          {canImport ? (
            <Link href="/statistics/import">
              <Button>
                <Upload /> {t("import")}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Headline strip */}
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4" step={0.04}>
        {tiles.map((tile) => (
          <IndicatorTile key={tile.id} tile={tile} animate />
        ))}
      </Stagger>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Catalog */}
        <div>
          <SectionTitle>{t("catalog")}</SectionTitle>
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat.code}>
                <p className="mb-2 flex items-baseline gap-2 text-sm font-medium text-ink-900">
                  {bi(locale, cat.nameEn, cat.nameAr)}
                  <span className="text-xs text-ink-400 tnum">{cat.indicators.length}</span>
                </p>
                <div className="card divide-y divide-mist-100">
                  {cat.indicators.map((ind) => (
                    <Link
                      key={ind.id}
                      href={`/statistics/${ind.id}` as never}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-navy-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink-900">
                        {bi(locale, ind.nameEn, ind.nameAr)}
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">
                        {t(`frequency.${ind.frequency}` as never)}
                      </span>
                      {ind.lastPeriod ? (
                        <span className="hidden shrink-0 text-xs text-ink-400 tnum sm:block">
                          {ind.lastPeriod}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Release calendar */}
        <aside>
          <SectionTitle>{t("calendar")}</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-400">{t("noUpcoming")}</p>
          ) : (
            <ol className="relative ms-2 space-y-4 border-s-2 border-mist-200 ps-4">
              {upcoming.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600" />
                  <p className="text-xs font-medium text-teal-600 tnum">
                    {formatDate(r.releaseDate, locale)}
                  </p>
                  <p className="text-sm text-ink-900">{bi(locale, r.titleEn, r.titleAr)}</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </Reveal>
  );
}
