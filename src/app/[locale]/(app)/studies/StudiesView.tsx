"use client";
// CR08 2.2: the Studies listing. A featured hero for the latest verified
// study, chip rows that filter by type, topic, outcome and year (each one a
// URL parameter, so a view is shareable), and one shelf of books per year.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, BookOpenText, FilePlus2, Sparkles, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Chip, EmptyState } from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { StudiesPage, StudyDoc } from "@/server/services/studies";

const EASE = [0.22, 1, 0.36, 1] as const;

/* the cover cloth per type, in tokens */
const COVER: Record<string, string> = {
  study: "bg-teal-600",
  research: "bg-navy-900",
  evaluation: "bg-ink-900",
};

const LINK_BUTTON =
  "inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 [&_svg]:size-4 [&_svg]:shrink-0";

export function StudiesView({
  data,
  canAdd,
  active,
}: {
  data: StudiesPage;
  canAdd: boolean;
  active: { type: string | null; topic: string | null; outcome: string | null; year: string | null };
}) {
  const t = useTranslations("studies");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const reduced = useReducedMotion();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ""}` as never, { scroll: false });
  }
  const anyFilter = Boolean(active.type || active.topic || active.outcome || active.year);

  return (
    <div data-testid="studies-page">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600" data-testid="studies-count" data-count={data.total}>
            {t("subtitle", { count: data.totalAll })}
          </p>
        </div>
        {canAdd ? (
          <Link
            href={"/vault/upload?type=study" as never}
            className={cn(LINK_BUTTON, "bg-navy-700 text-white shadow-sm hover:bg-navy-900")}
            data-testid="add-study"
          >
            <FilePlus2 /> {t("addStudy")}
          </Link>
        ) : null}
      </div>

      {data.totalAll === 0 ? (
        <EmptyState
          icon={<BookOpenText />}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            canAdd ? (
              <Link
                href={"/vault/upload?type=study" as never}
                className={cn(LINK_BUTTON, "bg-navy-700 text-white shadow-sm hover:bg-navy-900")}
              >
                <FilePlus2 /> {t("addStudy")}
              </Link>
            ) : undefined
          }
          className="mt-8"
        />
      ) : (
        <>
          {data.featured ? <FeaturedStudy doc={data.featured} reduced={Boolean(reduced)} /> : null}

          <div className="mt-6 flex flex-col gap-3" data-testid="studies-filters">
            <FacetRow
              label={t("byType")}
              items={data.facets.types.map((f) => ({ key: f.code, label: t.has(`types.${f.code}` as never) ? t(`types.${f.code}` as never) : bi(locale, f.nameEn, f.nameAr), count: f.count }))}
              active={active.type}
              onPick={(v) => setParam("type", v)}
              testId="facet-type"
            />
            <FacetRow
              label={t("byTopic")}
              items={data.facets.topics.map((f) => ({ key: f.code, label: bi(locale, f.nameEn, f.nameAr), count: f.count }))}
              active={active.topic}
              onPick={(v) => setParam("topic", v)}
              testId="facet-topic"
            />
            <FacetRow
              label={t("byOutcome")}
              items={data.facets.outcomes.map((f) => ({ key: f.code, label: bi(locale, f.nameEn, f.nameAr), count: f.count }))}
              active={active.outcome}
              onPick={(v) => setParam("outcome", v)}
              testId="facet-outcome"
            />
            <FacetRow
              label={t("byYear")}
              items={data.facets.years.map((f) => ({
                key: f.year === null ? "undated" : String(f.year),
                label: f.year === null ? t("undated") : formatNumber(f.year, locale, { decimals: 0 }).replace(/[,٬]/g, ""),
                count: f.count,
              }))}
              active={active.year}
              onPick={(v) => setParam("year", v)}
              testId="facet-year"
            />
            {anyFilter ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-600 tnum" data-testid="filtered-count">
                  {t("matching", { count: data.total })}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(pathname as never, { scroll: false })}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                  data-testid="studies-clear"
                >
                  <X className="size-3.5" aria-hidden /> {t("clear")}
                </button>
              </div>
            ) : null}
          </div>

          {data.total === 0 ? (
            <EmptyState icon={<BookOpenText />} title={t("noMatch")} hint={t("noMatchHint")} className="mt-8" />
          ) : (
            <div className="mt-8" data-testid="year-shelves">
              {data.shelves.map((s, i) => (
                <motion.section
                  key={s.year ?? "undated"}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.05, ease: EASE }}
                  data-testid="year-shelf"
                  data-year={s.year ?? "undated"}
                >
                  <Shelf
                    docs={s.docs}
                    label={s.year === null ? t("undated") : t("yearShelf", { year: String(s.year) })}
                    labelAr={s.year === null ? t("undated") : t("yearShelf", { year: String(s.year) })}
                    count={s.docs.length}
                    height={196}
                  />
                </motion.section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FacetRow({
  label,
  items,
  active,
  onPick,
  testId,
}: {
  label: string;
  items: { key: string; label: string; count: number }[];
  active: string | null;
  onPick: (value: string | null) => void;
  testId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("studies");
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label} data-testid={testId}>
      <span className="me-1 w-24 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
        {label}
      </span>
      <FacetChip label={t("all")} active={!active} onClick={() => onPick(null)} />
      {items.map((it) => (
        <FacetChip
          key={it.key}
          label={it.label}
          count={formatNumber(it.count, locale, { decimals: 0 })}
          active={active === it.key}
          onClick={() => onPick(active === it.key ? null : it.key)}
        />
      ))}
    </div>
  );
}

function FacetChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500",
        active
          ? "border-navy-700 bg-navy-100 font-medium text-navy-900"
          : "border-mist-300 bg-white text-ink-600 hover:border-navy-300 hover:text-ink-900"
      )}
    >
      {label}
      {count ? <span className={cn("tnum", active ? "text-navy-700" : "text-ink-400")}>{count}</span> : null}
    </button>
  );
}

/** The featured study: a cover on the start side, the summary and key facts beside it. */
function FeaturedStudy({ doc, reduced }: { doc: StudyDoc; reduced: boolean }) {
  const t = useTranslations("studies");
  const locale = useLocale();
  const typeLabel = doc.typeCode && t.has(`types.${doc.typeCode}` as never)
    ? t(`types.${doc.typeCode}` as never)
    : bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="card relative overflow-hidden"
      data-testid="featured-study"
      aria-labelledby="featured-title"
    >
      <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <Link
          href={`/vault/${doc.id}` as never}
          className={cn(
            "relative flex min-h-[220px] flex-col justify-between p-5 text-white transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-aqua-500",
            COVER[doc.typeCode ?? "study"] ?? "bg-teal-600"
          )}
          aria-label={bi(locale, doc.titleEn, doc.titleAr)}
        >
          <span aria-hidden className="absolute inset-y-0 start-0 w-2 bg-white/15" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80 rtl:tracking-normal">
            {typeLabel}
          </span>
          <span className="font-display text-lg font-semibold leading-snug">
            {bi(locale, doc.titleEn, doc.titleAr)}
          </span>
          <span className="text-xs text-white/80 tnum">
            {doc.publishYear ?? ""}
            {doc.departmentNameEn ? ` · ${bi(locale, doc.departmentNameEn, doc.departmentNameAr ?? "")}` : ""}
          </span>
        </Link>
        <div className="flex min-w-0 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua-500 rtl:tracking-normal">
              <Sparkles className="size-3.5" aria-hidden /> {t("featuredEyebrow")}
            </span>
            {doc.status === "verified" ? (
              <Chip tone="teal">
                <BadgeCheck className="size-3" aria-hidden /> {t("verified")}
              </Chip>
            ) : null}
            {doc.illustrative ? <Chip tone="mist">{t("illustrative")}</Chip> : null}
          </div>
          <h2 id="featured-title" className="font-display text-xl font-semibold text-ink-900">
            <Link href={`/vault/${doc.id}` as never} className="hover:text-navy-900">
              {bi(locale, doc.titleEn, doc.titleAr)}
            </Link>
          </h2>
          {/* CR08 9.1: the author of the study, with the person card */}
          {doc.ownerUserId && doc.ownerName ? (
            <OwnerControlCompact
              owner={{
                id: doc.ownerUserId,
                nameEn: doc.ownerName,
                nameAr: doc.ownerNameAr ?? doc.ownerName,
                avatarColor: doc.ownerColor ?? "navy",
              }}
              item={{ type: "study", id: doc.id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: `/vault/${doc.id}` }}
              size="md"
              className="-mt-1 max-w-full"
            />
          ) : null}
          {doc.summaryEn || doc.summaryAr ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-600">
              {bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "")}
            </p>
          ) : null}
          {doc.keyFacts.length ? (
            <ul className="flex flex-col gap-1 text-sm text-ink-900">
              {doc.keyFacts.slice(0, 3).map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-700" />
                  <span>{bi(locale, f.text_en, f.text_ar)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            {doc.outcomes.slice(0, 2).map((o) => (
              <Chip key={o.code} tone="navy">
                {bi(locale, o.nameEn, o.nameAr)}
              </Chip>
            ))}
            {doc.topics.slice(0, 3).map((o) => (
              <Chip key={o.code} tone="mist">
                {bi(locale, o.nameEn, o.nameAr)}
              </Chip>
            ))}
            <Link
              href={`/vault/${doc.id}` as never}
              className="ms-auto text-sm font-medium text-navy-700 underline-offset-4 hover:underline"
              data-testid="featured-open"
            >
              {t("read")}
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
