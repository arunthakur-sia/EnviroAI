"use client";
// Result list with intent banner and type tabs. Snippets highlight the match;
// semantic matches carry a small chip. CR08 3: expert results never blend
// with the stream: they render as two labelled groups, internal first, where
// the first expert would have appeared.
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
import { KowRibbon } from "@/components/nexus/kow/KowRibbon";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
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

  // CR08 3: the expert block sits where the first expert ranked; the two
  // groups inside it are internal first, then external.
  const experts = visible.filter((r) => r.type === "expert");
  const internal = experts.filter((r) => r.kind !== "external");
  const external = experts.filter((r) => r.kind === "external");
  const firstExpert = visible.findIndex((r) => r.type === "expert");
  const before = (firstExpert === -1 ? visible : visible.slice(0, firstExpert)).filter((r) => r.type !== "expert");
  const after = firstExpert === -1 ? [] : visible.slice(firstExpert).filter((r) => r.type !== "expert");

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
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-navy-900 tnum">
              {formatNumber(indicatorTile.value, locale, { decimals: indicatorTile.decimals })}
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
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-mist-100 p-1">
        {["all", "document", "indicator", "node", "expert", "question", "lesson"]
          .filter((k) => k === "all" || counts[k])
          .map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer",
                tab === k ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t(`tabs.${k}` as never)}{" "}
              <span className="text-xs text-ink-400 tnum">{counts[k] ?? 0}</span>
            </button>
          ))}
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2">
        {before.map((r, i) => (
          <ResultRow key={`${r.type}:${r.id}:${i}`} r={r} q={q} />
        ))}
        {experts.length ? <ExpertGroups internal={internal} external={external} q={q} /> : null}
        {after.map((r, i) => (
          <ResultRow key={`${r.type}:${r.id}:after:${i}`} r={r} q={q} />
        ))}
      </div>
    </div>
  );
}

function ResultRow({ r, q, accent }: { r: SearchResult; q: string; accent?: "navy" | "teal" }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const Icon = ICONS[r.type] ?? FileText;
  const href = `${HREFS[r.type]?.(r.id) ?? "#"}${r.page ? `?page=${r.page}` : ""}`;
  return (
    /* CR08 9.1: the row is no longer one link. The title carries a stretched
       link so the whole card still opens the item, and the owner control sits
       beside it as a sibling, because a button may never live inside a link. */
    <div
      className={cn("card card-hover relative flex gap-3.5 overflow-hidden p-4", accent && "ps-5")}
      data-testid={`result-${r.type}`}
      data-kind={r.kind}
    >
      {accent ? (
        <span aria-hidden className={cn("absolute inset-y-0 start-0 w-1", accent === "navy" ? "bg-navy-700" : "bg-teal-600")} />
      ) : null}
      <Icon className="mt-0.5 size-5 shrink-0 text-ink-400" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
          <Link
            href={href as never}
            className="rounded after:absolute after:inset-0 after:content-[''] hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
            data-testid="result-link"
          >
            {bi(locale, r.titleEn, r.titleAr)}
          </Link>
          {r.verified ? <BadgeCheck className="size-4 text-teal-600" /> : null}
          {/* CR08 8: the ribbon on this week's document or lesson */}
          {r.type === "document" || r.type === "lesson" ? <KowRibbon resourceType={r.type} resourceId={r.id} /> : null}
          {r.semantic ? (
            <Chip tone="teal">
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
      {/* z-[1]: above the stretched link that covers the card */}
      {r.owner ? (
        <div className="relative z-[1] max-w-[45%] shrink-0 self-center" data-testid="result-owner">
          <OwnerControl
            owner={r.owner}
            role={r.owner.role}
            size="sm"
            align="end"
            item={{ type: r.type, id: r.id, titleEn: r.titleEn, titleAr: r.titleAr, href: HREFS[r.type]?.(r.id) ?? "#" }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** CR08 3: the two expert groups, labelled, internal first. */
function ExpertGroups({
  internal,
  external,
  q,
}: {
  internal: SearchResult[];
  external: SearchResult[];
  q: string;
}) {
  const te = useTranslations("experts");
  const locale = useLocale();
  const groups: { key: "internal" | "external"; items: SearchResult[]; accent: "navy" | "teal" }[] = [
    { key: "internal", items: internal, accent: "navy" },
    { key: "external", items: external, accent: "teal" },
  ];
  return (
    <section className="my-1 flex flex-col gap-3" data-testid="expert-groups" aria-label={te("title")}>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <div key={g.key} data-testid={`expert-group-${g.key}`} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 px-1">
              <span aria-hidden className={cn("h-3.5 w-1 rounded-full", g.accent === "navy" ? "bg-navy-700" : "bg-teal-600")} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">
                {te(`groups.${g.key}`)}
              </span>
              <span className="text-xs text-ink-600 tnum">{formatNumber(g.items.length, locale, { decimals: 0 })}</span>
              <span className="text-xs text-ink-400">{te(`groups.${g.key}Hint`)}</span>
            </p>
            {g.items.map((r, i) => (
              <ResultRow key={`${r.type}:${r.id}:${i}`} r={r} q={q} accent={g.accent} />
            ))}
          </div>
        ))}
    </section>
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
          <mark key={i} className="rounded bg-aqua-100 px-0.5 text-ink-900">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}
