"use client";
// CR08 3: one toolbar, two filter sets. Internal: unit, domain, level and
// "involved in projects". External: type, organisation, domain, availability,
// "worked with NPC" and country. The search field runs the semantic matcher
// on Enter and the cheap name match while typing; every filter lives in the
// URL so a view is shareable.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Rows3, Search, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { AVAILABILITY_VALUES, EXTERNAL_TYPES, LEVEL_ORDER } from "@/lib/experts-constants";
import type { ExpertKind, ExpertsPageData } from "@/server/services/experts";

type Term = { code: string; nameEn: string; nameAr: string };

const INTERNAL_KEYS = ["q", "unit", "domain", "level", "projects", "layout"];
const EXTERNAL_KEYS = ["q", "type", "organisation", "domain", "availability", "workedWith", "country"];

export function ExpertsToolbar({
  view,
  topics,
  facets,
}: {
  view: ExpertKind;
  topics: Term[];
  facets: ExpertsPageData["facets"];
}) {
  const t = useTranslations("experts");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const typing = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = React.useCallback(
    (next: URLSearchParams) => {
      next.set("view", view);
      router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
    },
    [pathname, router, view]
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  const keys = view === "internal" ? INTERNAL_KEYS : EXTERNAL_KEYS;
  const activeCount = keys.filter((k) => k !== "layout" && sp.get(k)).length;

  function clear() {
    setQ("");
    const next = new URLSearchParams();
    if (sp.get("layout")) next.set("layout", sp.get("layout")!);
    push(next);
  }

  // the cheap name match while typing (single word), the semantic pass on Enter
  function onType(value: string) {
    setQ(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => {
      const words = value.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) setParam("q", value.trim() || null);
    }, 350);
  }

  const selectClass = (key: string) => cn("w-auto max-w-56", sp.get(key) && "border-maroon-300");
  const layout = sp.get("layout") === "flat" ? "flat" : "grouped";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="experts-toolbar" data-view={view}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (typing.current) clearTimeout(typing.current);
          setParam("q", q.trim() || null);
        }}
        className="relative w-full max-w-md"
      >
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-600" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => onType(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="ps-9"
          data-testid="experts-search"
        />
      </form>

      {view === "internal" ? (
        <>
          <NativeSelect
            value={sp.get("unit") ?? ""}
            onChange={(e) => setParam("unit", e.target.value || null)}
            className={selectClass("unit")}
            aria-label={t("filterUnit")}
            data-testid="filter-unit"
          >
            <option value="">{t("filterUnit")}</option>
            {facets.units.map((u) => (
              <option key={u.id} value={u.id}>
                {bi(locale, u.nameEn, u.nameAr)} ({u.count})
              </option>
            ))}
          </NativeSelect>
          <DomainSelect topics={topics} value={sp.get("domain") ?? ""} onChange={(v) => setParam("domain", v)} />
          <NativeSelect
            value={sp.get("level") ?? ""}
            onChange={(e) => setParam("level", e.target.value || null)}
            className={selectClass("level")}
            aria-label={t("filterLevel")}
            data-testid="filter-level"
          >
            <option value="">{t("filterLevel")}</option>
            {LEVEL_ORDER.map((v) => (
              <option key={v} value={v}>
                {t(`levels.${v}` as never)}
              </option>
            ))}
          </NativeSelect>
          <Toggle
            id="filter-projects"
            label={t("filterProjects")}
            checked={sp.get("projects") === "1"}
            onChange={(on) => setParam("projects", on ? "1" : null)}
          />
          <div
            className="ms-auto flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5"
            role="group"
            aria-label={t("layout.label")}
            data-testid="layout-toggle"
          >
            {(["grouped", "flat"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={layout === v}
                onClick={() => setParam("layout", v === "grouped" ? null : v)}
                data-testid={`layout-${v}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  "focus-visible:outline-2 focus-visible:outline-gold-500",
                  layout === v ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
                )}
              >
                {v === "grouped" ? <Rows3 className="size-3.5" aria-hidden /> : <LayoutGrid className="size-3.5" aria-hidden />}
                {t(`layout.${v}`)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <NativeSelect
            value={sp.get("type") ?? ""}
            onChange={(e) => setParam("type", e.target.value || null)}
            className={selectClass("type")}
            aria-label={t("filterType")}
            data-testid="filter-type"
          >
            <option value="">{t("filterType")}</option>
            {EXTERNAL_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`types.${v}` as never)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={sp.get("organisation") ?? ""}
            onChange={(e) => setParam("organisation", e.target.value || null)}
            className={selectClass("organisation")}
            aria-label={t("filterOrganisation")}
            data-testid="filter-organisation"
          >
            <option value="">{t("filterOrganisation")}</option>
            {facets.organisations.map((o) => (
              <option key={o.en} value={o.en}>
                {bi(locale, o.en, o.ar)} ({o.count})
              </option>
            ))}
          </NativeSelect>
          <DomainSelect topics={topics} value={sp.get("domain") ?? ""} onChange={(v) => setParam("domain", v)} />
          <NativeSelect
            value={sp.get("availability") ?? ""}
            onChange={(e) => setParam("availability", e.target.value || null)}
            className={selectClass("availability")}
            aria-label={t("filterAvailability")}
            data-testid="filter-availability"
          >
            <option value="">{t("filterAvailability")}</option>
            {AVAILABILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`availability.${v}` as never)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={sp.get("country") ?? ""}
            onChange={(e) => setParam("country", e.target.value || null)}
            className={selectClass("country")}
            aria-label={t("filterCountry")}
            data-testid="filter-country"
          >
            <option value="">{t("filterCountry")}</option>
            {facets.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {t.has(`countries.${c.code}` as never) ? t(`countries.${c.code}` as never) : c.code} ({c.count})
              </option>
            ))}
          </NativeSelect>
          <Toggle
            id="filter-worked"
            label={t("filterWorkedWith")}
            checked={sp.get("workedWith") === "1"}
            onChange={(on) => setParam("workedWith", on ? "1" : null)}
          />
        </>
      )}

      {activeCount ? (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-maroon-700 transition-colors hover:bg-maroon-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
          data-testid="clear-filters"
        >
          <X className="size-3.5" aria-hidden /> {t("clearFilters")}
        </button>
      ) : null}
    </div>
  );
}

function DomainSelect({
  topics,
  value,
  onChange,
}: {
  topics: Term[];
  value: string;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations("experts");
  const locale = useLocale();
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn("w-auto max-w-56", value && "border-maroon-300")}
      aria-label={t("filterDomain")}
      data-testid="filter-domain"
    >
      <option value="">{t("filterDomain")}</option>
      {topics.map((topic) => (
        <option key={topic.code} value={topic.code}>
          {bi(locale, topic.nameEn, topic.nameAr)}
        </option>
      ))}
    </NativeSelect>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex h-9.5 cursor-pointer items-center gap-2 rounded-lg border bg-white px-2.5 text-sm text-ink-900 transition-colors",
        checked ? "border-maroon-300" : "border-sand-300"
      )}
    >
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={id} />
      {label}
    </label>
  );
}
