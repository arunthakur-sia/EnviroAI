"use client";
// EnviroAI Source Library. The catalogue is loaded once; search and the chip
// rows filter it in the client. Items the databank flags carry a badge that
// opens the verification notes. URLs open in a new tab with rel noopener.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ExternalLink, Search, ShieldAlert, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Chip, EmptyState } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import {
  SOURCE_CATEGORIES,
  type AccessTag,
  type SourceCategory,
  type SourceItem,
  type SourcesPage,
  type VerificationItem,
} from "@/server/services/sources-types";

type CategoryKey = "all" | SourceCategory | "verification";
const ACCESS_TONE: Record<AccessTag, "ok" | "info" | "warn"> = { free: "ok", registration: "info", paid: "warn" };

/* one grid template shared by the header and every row (no HTML table, per the CR08 rule) */
const ROW_GRID =
  "grid grid-cols-[minmax(14rem,1.5fr)_minmax(11rem,1.1fr)_minmax(8rem,0.8fr)_minmax(10rem,1fr)_minmax(9rem,0.9fr)_6rem_minmax(8rem,0.9fr)_minmax(14rem,1.7fr)]";

const isHttp = (u: string | null): u is string => Boolean(u && /^https?:\/\//i.test(u));

function matches(hay: string, q: string): boolean {
  const h = hay.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => h.includes(w));
}

export function SourcesView({ data }: { data: SourcesPage }) {
  const t = useTranslations("ksaSources");
  const locale = useLocale();
  const [category, setCategory] = React.useState<CategoryKey>("all");
  const [q, setQ] = React.useState("");
  const [access, setAccess] = React.useState<AccessTag | "any">("any");
  const [flaggedOnly, setFlaggedOnly] = React.useState(false);
  const [panel, setPanel] = React.useState<{ source: SourceItem } | { note: VerificationItem } | null>(null);

  const sourceById = React.useMemo(() => new Map(data.items.map((s) => [s.id, s])), [data.items]);

  const items = React.useMemo(() => {
    if (category === "verification") return [];
    return data.items.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (access !== "any" && !s.accessTags.includes(access)) return false;
      if (flaggedOnly && !(s.flags.length || s.unverified)) return false;
      if (q.trim()) {
        const hay = [s.nameEn, s.nameAr, s.organizationEn, s.organizationAr, s.subCategoryEn, s.subCategoryAr, s.formats, s.languages, s.access, s.notesEn, s.notesAr, s.mainUrl, s.dataUrl, s.dataHint]
          .filter(Boolean)
          .join("\n");
        if (!matches(hay, q)) return false;
      }
      return true;
    });
  }, [data.items, category, access, flaggedOnly, q]);

  const notes = React.useMemo(() => {
    if (category !== "verification") return [];
    return data.verification.filter((n) => !q.trim() || matches([n.item, n.tab, n.issue, n.action].filter(Boolean).join("\n"), q));
  }, [data.verification, category, q]);

  const anyFilter = category !== "all" || q.trim() !== "" || access !== "any" || flaggedOnly;
  function clearAll() {
    setCategory("all");
    setQ("");
    setAccess("any");
    setFlaggedOnly(false);
  }

  const catItems: { key: CategoryKey; label: string; count: number }[] = [
    { key: "all", label: t("all"), count: data.counts.all },
    ...SOURCE_CATEGORIES.map((c) => ({ key: c as CategoryKey, label: t(`categories.${c}` as never), count: data.counts[c] })),
    { key: "verification", label: t("categories.verification"), count: data.counts.verification },
  ];

  const total = category === "verification" ? data.counts.verification : category === "all" ? data.counts.all : data.counts[category];
  const shown = category === "verification" ? notes.length : items.length;

  return (
    <div data-testid="sources-page">
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600" data-testid="sources-count" data-count={data.counts.all}>
          {t("subtitle", { count: data.counts.all })}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            data-testid="sources-search"
            className="h-10 w-full rounded-lg border border-mist-300 bg-white ps-9 pe-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("categoryLabel")} data-testid="sources-categories">
          {catItems.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              data-testid={`sources-cat-${c.key}`}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
                category === c.key
                  ? "border-navy-700 bg-navy-700 text-white"
                  : "border-mist-300 bg-white text-ink-600 hover:border-navy-300 hover:text-navy-700"
              )}
            >
              {c.label}
              <span className={cn("tnum", category === c.key ? "text-white/80" : "text-ink-400")}>{c.count}</span>
            </button>
          ))}
        </div>

        {category !== "verification" ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("accessLabel")}>
            <span className="me-1 text-xs text-ink-600">{t("accessLabel")}</span>
            {(["any", "free", "registration", "paid"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAccess(a)}
                aria-pressed={access === a}
                data-testid={`sources-access-${a}`}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
                  access === a
                    ? "border-teal-600 bg-teal-100 text-teal-600"
                    : "border-mist-300 bg-white text-ink-600 hover:border-teal-600/50"
                )}
              >
                {a === "any" ? t("anyAccess") : t(`access.${a}` as never)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              aria-pressed={flaggedOnly}
              data-testid="sources-flagged-only"
              className={cn(
                "ms-1 flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
                flaggedOnly ? "border-warn bg-warn-light text-warn" : "border-mist-300 bg-white text-ink-600 hover:border-warn/60"
              )}
            >
              <ShieldAlert className="size-3.5" aria-hidden /> {t("flaggedOnly")}
              <span className="tnum text-ink-400">{data.counts.flagged}</span>
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-600 tnum" data-testid="sources-showing" data-shown={shown}>
            {category === "verification" ? t("showingNotes", { shown, total }) : t("showing", { shown, total })}
          </span>
          {anyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-aqua-500"
              data-testid="sources-clear"
            >
              <X className="size-3.5" aria-hidden /> {t("clear")}
            </button>
          ) : null}
        </div>
      </div>

      {category === "verification" ? (
        <VerificationList
          notes={notes}
          sourceById={sourceById}
          locale={locale}
          onOpen={(note) => setPanel({ note })}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<Search />} title={t("noResults")} hint={t("noResultsHint")} className="mt-6" />
      ) : (
        <div className="card mt-4 overflow-x-auto" data-testid="sources-table">
          <div role="table" aria-label={t("title")} className="min-w-[1180px]">
            <div role="rowgroup">
              <div role="row" className={cn(ROW_GRID, "bg-mist-50 text-xs font-semibold text-ink-600")}>
                {(["name", "organization", "subCategory", "links", "formats", "languages", "access", "notes"] as const).map((c) => (
                  <div key={c} role="columnheader" className="px-3 py-2.5 text-start">
                    {t(`columns.${c}` as never)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {items.map((s) => (
                <SourceRow key={s.id} s={s} locale={locale} onFlag={() => setPanel({ source: s })} />
              ))}
            </div>
          </div>
        </div>
      )}
      {category !== "verification" && items.length ? (
        <p className="mt-3 text-xs text-ink-400">{t("notesInEnglish")}</p>
      ) : null}

      <Dialog open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        {panel ? (
          <DialogContent
            title={t("panel.title")}
            className="max-h-[85vh] w-[min(640px,94vw)] overflow-y-auto"
            aria-describedby={undefined}
            data-testid="verification-panel"
          >
            <PanelBody panel={panel} sourceById={sourceById} locale={locale} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function SourceRow({ s, locale, onFlag }: { s: SourceItem; locale: string; onFlag: () => void }) {
  const t = useTranslations("ksaSources");
  const name = bi(locale, s.nameEn, s.nameAr);
  const flagged = s.flags.length > 0 || s.unverified;
  return (
    <div role="row" className={cn(ROW_GRID, "border-t border-mist-100")} data-testid="source-row" data-flagged={flagged ? "1" : "0"}>
      <div role="cell" className="max-w-[16rem] px-3 py-2.5">
        <p className="font-medium text-ink-900">{name}</p>
        {flagged ? (
          <button
            type="button"
            onClick={onFlag}
            data-testid="source-flag"
            className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md bg-warn-light px-2 py-0.5 text-[11px] font-medium text-warn transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-aqua-500"
          >
            <AlertTriangle className="size-3" aria-hidden />
            {s.flags.length ? t("flagged") : t("unverified")}
          </button>
        ) : null}
      </div>
      <div role="cell" className="max-w-[14rem] px-3 py-2.5 text-ink-900">{bi(locale, s.organizationEn, s.organizationAr)}</div>
      <div role="cell" className="max-w-[10rem] px-3 py-2.5 text-ink-600">{bi(locale, s.subCategoryEn, s.subCategoryAr)}</div>
      <div role="cell" className="px-3 py-2.5">
        <div className="flex flex-col gap-1">
          {isHttp(s.mainUrl) ? <UrlLink href={s.mainUrl} label={t("mainSite")} name={name} openLabel={t("openLink", { name })} /> : null}
          {isHttp(s.dataUrl) ? <UrlLink href={s.dataUrl} label={t("dataPage")} name={name} openLabel={t("openLink", { name })} /> : null}
          {s.dataHint ? (
            <span className="max-w-[14rem] text-xs text-ink-600" dir="auto">
              <span className="font-medium">{t("searchHint")}:</span> {s.dataHint}
            </span>
          ) : null}
        </div>
      </div>
      <div role="cell" className="max-w-[12rem] px-3 py-2.5 text-xs text-ink-600" dir="auto">{s.formats ?? "-"}</div>
      <div role="cell" className="px-3 py-2.5 text-xs text-ink-600" dir="auto">{s.languages ?? "-"}</div>
      <div role="cell" className="max-w-[12rem] px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {s.accessTags.map((a) => (
            <Chip key={a} tone={ACCESS_TONE[a]}>{t(`access.${a}` as never)}</Chip>
          ))}
        </div>
        {s.access && !["free", "paid"].includes(s.access.trim().toLowerCase()) ? (
          <p className="mt-1 text-[11px] leading-snug text-ink-400" dir="auto">{s.access}</p>
        ) : null}
      </div>
      <div role="cell" className="max-w-[20rem] px-3 py-2.5 text-xs leading-relaxed text-ink-600" dir="auto">
        {bi(locale, s.notesEn, s.notesAr) || "-"}
      </div>
    </div>
  );
}

function UrlLink({ href, label, name, openLabel }: { href: string; label: string; name: string; openLabel: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={openLabel}
      title={`${name}: ${href}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-aqua-500"
    >
      {label} <ExternalLink className="size-3 shrink-0 flip-rtl" aria-hidden />
    </a>
  );
}

function VerificationList({
  notes,
  sourceById,
  locale,
  onOpen,
}: {
  notes: VerificationItem[];
  sourceById: Map<string, SourceItem>;
  locale: string;
  onOpen: (n: VerificationItem) => void;
}) {
  const t = useTranslations("ksaSources");
  if (!notes.length) return <EmptyState icon={<Search />} title={t("noResults")} hint={t("noResultsHint")} className="mt-6" />;
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-ink-600">{t("verification.intro")}</p>
      <ul className="grid gap-3 md:grid-cols-2" data-testid="verification-list">
        {notes.map((n) => (
          <li key={n.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-ink-900">{n.item}</p>
              <Chip tone={n.sourceIds.length ? "warn" : "mist"}>
                {n.sourceIds.length ? t("flagged") : t("panel.gap")}
              </Chip>
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("panel.issue")}</p>
            <p className="text-sm text-ink-900">{n.issue}</p>
            {n.action ? (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("panel.action")}</p>
                <p className="text-sm text-ink-900">{n.action}</p>
              </>
            ) : null}
            {n.sourceIds.length ? (
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="mt-3 cursor-pointer text-xs font-medium text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-aqua-500"
              >
                {t("panel.appliesTo")}: {n.sourceIds.map((id) => bi(locale, sourceById.get(id)?.nameEn, sourceById.get(id)?.nameAr)).join(", ")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PanelBody({
  panel,
  sourceById,
  locale,
}: {
  panel: { source: SourceItem } | { note: VerificationItem };
  sourceById: Map<string, SourceItem>;
  locale: string;
}) {
  const t = useTranslations("ksaSources");
  const flags: { id: string; item?: string; tab?: string | null; issue: string; action: string | null }[] =
    "source" in panel
      ? panel.source.flags.map((f) => ({ id: f.id, issue: f.issue, action: f.action }))
      : [{ id: panel.note.id, item: panel.note.item, tab: panel.note.tab, issue: panel.note.issue, action: panel.note.action }];
  const heading = "source" in panel ? bi(locale, panel.source.nameEn, panel.source.nameAr) : panel.note.item;
  const applies = "note" in panel ? panel.note.sourceIds.map((id) => sourceById.get(id)).filter((x): x is SourceItem => Boolean(x)) : [];
  return (
    <div className="space-y-4">
      <p className="text-base font-medium text-navy-900">{heading}</p>
      {"source" in panel && panel.source.unverified ? (
        <p className="rounded-lg bg-warn-light px-3 py-2 text-sm text-warn">{t("panel.statusOnly")}</p>
      ) : null}
      {flags.length === 0 && !("source" in panel && panel.source.unverified) ? (
        <p className="text-sm text-ink-600">{t("panel.none")}</p>
      ) : null}
      {flags.map((f) => (
        <div key={f.id} className="rounded-xl border border-mist-300 bg-mist-50 p-3">
          {f.tab ? <Chip tone="mist" className="mb-2">{f.tab}</Chip> : null}
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("panel.issue")}</p>
          <p className="text-sm text-ink-900">{f.issue}</p>
          {f.action ? (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("panel.action")}</p>
              <p className="text-sm text-ink-900">{f.action}</p>
            </>
          ) : null}
        </div>
      ))}
      {applies.length ? (
        <p className="text-xs text-ink-600">
          {t("panel.appliesTo")}: {applies.map((s) => bi(locale, s.nameEn, s.nameAr)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
