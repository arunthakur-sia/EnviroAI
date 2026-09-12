import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { SearchX } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { runSearch } from "@/server/services/search";
import { Reveal } from "@/components/motion";
import { EmptyState, Button } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { SearchResults } from "./SearchResults";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("search");

  if (!q?.trim()) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={t("noQuery")}
        hint={t("noQueryHint")}
        className="mt-16"
      />
    );
  }

  const { intent, results } = await runSearch(user, q.trim(), locale);

  // intent banner data
  let indicatorTile: {
    id: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    value: number | null;
    period: string | null;
    decimals: number;
  } | null = null;
  if (intent.intent === "number") {
    const firstIndicator = results.find((r) => r.type === "indicator");
    if (firstIndicator) {
      const [ind] = await db
        .select()
        .from(schema.indicators)
        .where(eq(schema.indicators.id, firstIndicator.id))
        .limit(1);
      if (ind) {
        const [latest] = await db
          .select()
          .from(schema.indicatorValues)
          .where(
            and(
              eq(schema.indicatorValues.indicatorId, ind.id),
              eq(schema.indicatorValues.dimensionKey, "total")
            )
          )
          .orderBy(desc(schema.indicatorValues.period))
          .limit(1);
        indicatorTile = {
          id: ind.id,
          nameEn: ind.nameEn,
          nameAr: ind.nameAr,
          unit: ind.unit,
          value: latest?.value ?? null,
          period: latest?.period ?? null,
          decimals: ind.decimals,
        };
      }
    }
  }

  return (
    <Reveal>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl">{t("resultsFor", { q })}</h1>
          <p className="mt-1 text-sm text-ink-600" data-testid="result-count" data-count={results.length}>
            {t("resultCount", { count: results.length })}
          </p>
        </div>
        <Link href={`/ask?q=${encodeURIComponent(q)}` as never}>
          <Button variant="secondary">{t("answerInstead")}</Button>
        </Link>
      </div>

      {results.length === 0 ? (
        <div data-testid="zero-results">
          <EmptyState
            icon={<SearchX />}
            title={t("zeroTitle")}
            hint={t("zeroHint")}
            action={
              <Link href={`/ask?q=${encodeURIComponent(q)}&post=1` as never}>
                <Button>{t("askNetwork")}</Button>
              </Link>
            }
            className="mt-8"
          />
        </div>
      ) : (
        <SearchResults
          q={q}
          intent={intent.intent}
          results={results}
          indicatorTile={indicatorTile}
        />
      )}
    </Reveal>
  );
}
