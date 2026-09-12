"use client";
// Result list with intent banner and type tabs. Snippets highlight the match;
// semantic matches carry a small chip. Clicking logs the click for gap analytics.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  FileText,
  BarChart3,
  Compass,
  Users,
  MessageCircleQuestion,
  Lightbulb,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Chip } from "@/components/ui/primitives";
import type { SearchResult } from "@/server/services/search";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  indicator: BarChart3,
  node: Compass,
  expert: Users,
  question: MessageCircleQuestion,
  lesson: Lightbulb,
  answer: MessageCircleQuestion,
};

const HREFS: Record<string, (id: string) => string> = {
  document: (id) => `/vault/${id}`,
  indicator: (id) => `/statistics/${id}`,
  node: (id) => `/strategy/${id}`,
  expert: (id) => `/experts/${id}`,
  question: (id) => `/ask/${id}`,
  lesson: (id) => `/lessons/${id}`,
  answer: (id) => `/ask/${id}`,
};

export function SearchResults({
  q,
  intent,
  results,
  indicatorTile,
}: {
  q: string;
  intent: string;
  results: SearchResult[];
  indicatorTile: {
    id: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    value: number | null;
    period: string | null;
    decimals: number;
  } | null;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [tab, setTab] = React.useState<string>("all");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: results.length };
    for (const r of results) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [results]);

  const visible = tab === "all" ? results : results.filter((r) => r.type === tab);

  return (
    <div>
      {/* Intent banner */}
      {intent === "number" && indicatorTile ? (
        <Link
          href={`/statistics/${indicatorTile.id}` as never}
          className="card card-hover mb-5 flex items-center gap-5 p-5"
          data-testid="intent-indicator"
        >
          <div>
            <p className="text-xs text-ink-600">{t("intentNumber")}</p>
            <p className="mt-1 font-medium text-ink-900">
              {bi(locale, indicatorTile.nameEn, indicatorTile.nameAr)}
            </p>
          </div>
          <div className="ms-auto text-end">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-maroon-900 tnum">
              {indicatorTile.value !== null
                ? formatNumber(indicatorTile.value, locale, { decimals: indicatorTile.decimals })
                : "—"}
              {indicatorTile.unit ? (
                <span className="ms-1 text-base text-ink-600">{indicatorTile.unit}</span>
              ) : null}
            </p>
            {indicatorTile.period ? (
              <p className="text-xs text-ink-400 tnum">{indicatorTile.period}</p>
            ) : null}
          </div>
        </Link>
      ) : null}
      {intent === "person" ? (
        <p className="mb-4 text-sm text-ink-600">{t("intentPerson")}</p>
      ) : null}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-sand-100 p-1">
        {["all", "document", "indicator", "node", "expert", "question", "lesson"]
          .filter((k) => k === "all" || counts[k])
          .map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer",
                tab === k ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t(`tabs.${k}` as never)}{" "}
              <span className="text-xs text-ink-400 tnum">{counts[k] ?? 0}</span>
            </button>
          ))}
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2">
        {visible.map((r, i) => {
          const Icon = ICONS[r.type] ?? FileText;
          return (
            <Link
              key={`${r.type}:${r.id}:${i}`}
              href={
                `${HREFS[r.type]?.(r.id) ?? "#"}${r.page ? `?page=${r.page}` : ""}` as never
              }
              className="card card-hover flex gap-3.5 p-4"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-ink-400" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                  {bi(locale, r.titleEn, r.titleAr)}
                  {r.verified ? <BadgeCheck className="size-4 text-gulf-600" /> : null}
                  {r.semantic ? (
                    <Chip tone="gulf">
                      <Sparkles className="size-3" /> {t("semanticMatch")}
                    </Chip>
                  ) : null}
                  {r.page ? (
                    <span className="text-xs text-ink-400 tnum">
                      {t("page")} {r.page}
                    </span>
                  ) : null}
                </p>
                <p
                  className="mt-1 line-clamp-2 text-sm text-ink-600"
                  dir={r.snippetLang === "ar" ? "rtl" : "ltr"}
                >
                  <Highlighted text={r.snippet} q={q} />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Highlighted({ text, q }: { text: string; q: string }) {
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark key={i} className="rounded bg-gold-100 px-0.5 text-ink-900">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}
