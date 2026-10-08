import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { pastReleases, releaseCalendar } from "@/server/services/statistics";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Chip } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ReleasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("statistics");

  const [past, upcoming] = await Promise.all([pastReleases(40), releaseCalendar(45)]);
  const all = [...upcoming.map((r) => ({ ...r, upcoming: true })), ...past.map((r) => ({ ...r, upcoming: false }))];

  const indicatorIds = new Set<string>();
  for (const r of all) {
    try {
      for (const id of JSON.parse(r.indicatorIdsJson ?? "[]") as string[]) indicatorIds.add(id);
    } catch { /* skip */ }
  }
  const indicators = indicatorIds.size
    ? await db
        .select({ id: schema.indicators.id, nameEn: schema.indicators.nameEn, nameAr: schema.indicators.nameAr })
        .from(schema.indicators)
        .where(inArray(schema.indicators.id, [...indicatorIds]))
    : [];
  const indMap = new Map(indicators.map((i) => [i.id, i]));

  return (
    <Reveal>
      <h1 className="text-2xl">{t("releases")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("releasesSubtitle")}</p>
      <div className="mt-6 flex max-w-3xl flex-col gap-3">
        {all.map((r) => {
          let linked: string[] = [];
          try {
            linked = (JSON.parse(r.indicatorIdsJson ?? "[]") as string[]).slice(0, 4);
          } catch { /* skip */ }
          return (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink-900">{bi(locale, r.titleEn, r.titleAr)}</p>
                {r.upcoming ? <Chip tone="teal">{t("upcoming")}</Chip> : null}
                <span className="ms-auto text-xs text-ink-400 tnum">
                  {formatDate(r.releaseDate, locale)}
                </span>
              </div>
              {(r.summaryEn || r.summaryAr) ? (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                  {bi(locale, r.summaryEn ?? "", r.summaryAr ?? "")}
                </p>
              ) : null}
              {linked.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {linked.map((id) => {
                    const ind = indMap.get(id);
                    if (!ind) return null;
                    return (
                      <Link key={id} href={`/statistics/${id}` as never}>
                        <Chip tone="navy" className="cursor-pointer hover:bg-navy-700 hover:text-white">
                          {bi(locale, ind.nameEn, ind.nameAr)}
                        </Chip>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              {r.documentId ? (
                <Link
                  href={`/vault/${r.documentId}` as never}
                  className="mt-2 inline-block text-xs font-medium text-navy-700 hover:underline"
                >
                  {t("openReleaseDoc")}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}
