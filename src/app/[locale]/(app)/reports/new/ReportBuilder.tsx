"use client";
// CR08 5.4: the report builder. Step 1 the type (cards grouped by family,
// custom for the Super Admin), step 2 the period (year, quarter, month or a
// range, as the type's cadence suggests) and the scope (the Office, an
// outcome, a unit, a project; only the requester's allowed scopes), step 3
// the audience and language with the classification, step 4 the sections
// (defaults ticked, optional offered, library order kept). The structure
// preview on the side lists the chosen sections with page estimates.
// Generate posts the request and opens the report page, which streams the
// per-section progress.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ChevronLeft, Landmark, Search, Sparkles, Target, Workflow } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button, Chip, ClassificationChip, EmptyState, Input, Label, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { ReportTypeView } from "@/server/services/reports";
import type { Audience, LanguageMode, ScopeKind } from "@/server/reports/spec";
import { ButtonLink } from "@/components/nexus/reports/ButtonLink";
import { useClassificationLabels } from "@/components/nexus/reports/CoverCard";
import { FAMILY_TONE, type LibraryItem } from "@/components/nexus/reports/shared";
import type { AllowedScopes, ScopeOption } from "./scopes";

type PeriodKind = "year" | "quarter" | "month" | "range";
type FamilyKey = "public" | "internal" | "custom";
type CadenceKey = "annual" | "quarterly" | "monthly" | "on_demand" | "on_closure";
type PickKind = "org" | "outcome" | "department" | "project";
const STEPS = ["type", "periodScope", "audience", "sections"] as const;
const FAMILIES: FamilyKey[] = ["public", "internal", "custom"];
const PICKABLE: PickKind[] = ["org", "outcome", "department", "project"];
const AUDIENCES: Audience[] = ["leadership", "working", "public"];
const LANGUAGES: LanguageMode[] = ["en", "ar", "both"];

type Form = {
  typeCode: string | null;
  periodKind: PeriodKind;
  year: number;
  quarter: number;
  month: number;
  from: string;
  to: string;
  scopeKind: ScopeKind;
  scopeId: string | null;
  audience: Audience;
  languageMode: LanguageMode;
  classification: number;
  selected: string[];
};

function suggestedKind(cadence: string | null): PeriodKind {
  if (cadence === "quarterly") return "quarter";
  if (cadence === "monthly") return "month";
  return "year";
}

function formFor(type: ReportTypeView | null, locale: string, prev?: Form): Form {
  const now = new Date();
  return {
    typeCode: type?.code ?? null,
    periodKind: suggestedKind(type?.cadence ?? null),
    year: prev?.year ?? now.getUTCFullYear(),
    quarter: prev?.quarter ?? Math.floor(now.getUTCMonth() / 3) + 1,
    month: prev?.month ?? now.getUTCMonth() + 1,
    from: prev?.from ?? "",
    to: prev?.to ?? "",
    scopeKind: type?.scopeKind ?? "org",
    scopeId: null,
    audience: type?.audienceDefault ?? "working",
    languageMode: prev?.languageMode ?? (locale === "ar" ? "ar" : "both"),
    classification: type?.classificationDefault ?? 2,
    selected: type ? [...type.defaultSections] : [],
  };
}

const SCOPE_ICON: Record<PickKind, React.ComponentType<{ className?: string }>> = {
  org: Landmark,
  outcome: Target,
  department: Building2,
  project: Workflow,
};

/* ------------------------------------------------------------------ */
/* the scope picker                                                     */
/* ------------------------------------------------------------------ */

function ScopePicker({
  kind,
  options,
  value,
  onChange,
  countLine,
}: {
  kind: PickKind;
  options: ScopeOption[];
  value: string | null;
  onChange: (id: string) => void;
  countLine: string | null;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => [o.nameEn, o.nameAr, o.code ?? "", o.contextEn ?? "", o.contextAr ?? ""].join(" ").toLowerCase().includes(needle))
    : options;
  if (!options.length) {
    return <EmptyState title={t("builder.noScopes")} hint={t("builder.noScopesHint")} className="py-8" />;
  }
  return (
    <div>
      {countLine ? <p className="mb-2 text-xs text-ink-600">{countLine}</p> : null}
      {options.length > 6 ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("builder.searchScopes")} aria-label={t("builder.searchScopes")} className="ps-9" data-testid="scope-search" />
        </div>
      ) : null}
      <div role="radiogroup" aria-label={t(`scopeKinds.${kind}`)} className="max-h-80 space-y-1 overflow-y-auto pe-1" data-testid="scope-options">
        {filtered.map((o) => {
          const checked = value === o.id;
          const sub =
            kind === "project" && o.subKind
              ? o.subKind === "initiative"
                ? locale === "ar"
                  ? "مبادرة"
                  : "Initiative"
                : locale === "ar"
                  ? "مشروع"
                  : "Project"
              : null;
          const context = bi(locale, o.contextEn, o.contextAr);
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(o.id)}
              data-testid="scope-option"
              data-scope-id={o.id}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-aqua-500",
                checked ? "border-navy-700 bg-navy-50" : "border-mist-200 bg-white hover:border-navy-300"
              )}
            >
              <span
                className={cn("mt-1 size-3.5 shrink-0 rounded-full border-[1.5px]", checked ? "border-navy-700 bg-navy-700 shadow-[inset_0_0_0_2px_white]" : "border-mist-300")}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-900">
                  {o.code ? <span className="me-1.5 text-ink-400 tnum">{o.code}</span> : null}
                  {bi(locale, o.nameEn, o.nameAr)}
                </span>
                {sub || context ? (
                  <span className="block truncate text-xs text-ink-600">
                    {sub}
                    {sub && context ? " · " : ""}
                    {context}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
        {!filtered.length ? <p className="px-3 py-4 text-sm text-ink-600">{t("builder.noMatches")}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the builder                                                          */
/* ------------------------------------------------------------------ */

export function ReportBuilder({
  types,
  library,
  scopes,
  isSuperAdmin,
  initialType,
}: {
  types: ReportTypeView[];
  library: LibraryItem[];
  scopes: AllowedScopes;
  isSuperAdmin: boolean;
  initialType: string | null;
}) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const labels = useClassificationLabels();

  const initial = initialType ? types.find((tp) => tp.code === initialType) ?? null : null;
  const [form, setForm] = React.useState<Form>(() => formFor(initial, locale));
  const [step, setStep] = React.useState(initial ? 1 : 0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const type = types.find((tp) => tp.code === form.typeCode) ?? null;
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const applyType = (tp: ReportTypeView) => {
    setForm((f) => formFor(tp, locale, f));
    setError(null);
  };

  const available = React.useMemo(() => {
    if (!type) return [];
    if (type.family === "custom") return library;
    const set = new Set<string>([...type.defaultSections, ...type.optionalSections]);
    return library.filter((l) => set.has(l.code));
  }, [type, library]);
  const ordered = available.filter((l) => form.selected.includes(l.code));
  const totalPages = ordered.reduce((sum, l) => sum + l.estimatedPages, 0);

  const scopeOptions: Record<PickKind, ScopeOption[]> = {
    org: [],
    outcome: scopes.outcomes,
    department: scopes.departments,
    project: scopes.projects,
  };
  const pickKind: PickKind = form.scopeKind === "period" ? "org" : (form.scopeKind as PickKind);
  const scopeChosen = pickKind === "org" ? null : scopeOptions[pickKind].find((o) => o.id === form.scopeId) ?? null;
  const periodValid =
    form.periodKind === "range" ? Boolean(form.from && form.to && form.from <= form.to) : form.periodKind === "quarter" ? form.quarter >= 1 && form.quarter <= 4 : true;
  const scopeValid = pickKind === "org" || Boolean(scopeChosen);
  const valid = [Boolean(type), periodValid && scopeValid, true, ordered.length > 0];
  const reachable = (i: number) => valid.slice(0, i).every(Boolean);

  const periodText = (() => {
    if (form.periodKind === "year") return String(form.year);
    if (form.periodKind === "quarter") return `${t("builder.quarterLabel", { n: form.quarter })} ${form.year}`;
    if (form.periodKind === "month") {
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", { month: "long", year: "numeric" }).format(new Date(Date.UTC(form.year, form.month - 1, 1)));
    }
    return form.from && form.to ? t("builder.rangeLabel", { from: formatDate(form.from, locale), to: formatDate(form.to, locale) }) : t("builder.notChosen");
  })();
  const scopeText = pickKind === "org" ? t("builder.scopeCouncil") : scopeChosen ? `${scopeChosen.code ? `${scopeChosen.code} ` : ""}${bi(locale, scopeChosen.nameEn, scopeChosen.nameAr)}` : t("builder.notChosen");

  async function generate() {
    if (!type || !valid.every(Boolean)) return;
    setSubmitting(true);
    setError(null);
    const period: Record<string, unknown> = { kind: form.periodKind, year: form.year };
    if (form.periodKind === "quarter") period.quarter = form.quarter;
    if (form.periodKind === "month") period.month = form.month;
    if (form.periodKind === "range") {
      period.from = form.from;
      period.to = form.to;
    }
    const body = {
      typeCode: type.code,
      period,
      scope: pickKind === "org" ? { kind: form.scopeKind === "period" ? "period" : "org" } : { kind: pickKind, id: form.scopeId },
      audience: form.audience,
      languageMode: form.languageMode,
      sectionCodes: ordered.map((l) => l.code),
      classification: form.classification,
    };
    try {
      const res = await fetch("/api/v1/report-builder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.data?.id) {
        const key = j?.error as string | undefined;
        const message =
          key === "forbidden"
            ? t("builder.errors.forbidden")
            : key === "invalid"
              ? t("builder.errors.invalid", { detail: String(j?.detail ?? "") })
              : key === "not_found"
                ? t("builder.errors.not_found")
                : t("builder.errors.generic");
        setError(message);
        toast(message, "error");
        setSubmitting(false);
        return;
      }
      toast(t("builder.queued"), "success");
      router.push(`/reports/${j.data.id}`);
    } catch {
      setError(t("builder.errors.generic"));
      setSubmitting(false);
    }
  }

  const years = React.useMemo(() => {
    const y = new Date().getUTCFullYear();
    return [y - 4, y - 3, y - 2, y - 1, y, y + 1];
  }, []);
  const monthNames = React.useMemo(() => {
    const f = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", { month: "long" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 1))));
  }, [locale]);

  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal";
  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
      active ? "border-navy-700 bg-navy-700 text-white" : "border-mist-300 bg-white text-ink-600 hover:border-navy-300 hover:text-navy-700"
    );

  /* ---------------- steps ---------------- */

  const stepType = (
    <div className="space-y-6">
      {FAMILIES.map((family) => {
        const group = types.filter((tp) => tp.family === family);
        if (!group.length) return null;
        return (
          <div key={family} data-testid={`type-family-${family}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-900">{t(`builder.familyGroups.${family}`)}</h3>
              <span className="text-xs text-ink-600">{t(`builder.familyHints.${family}`)}</span>
            </div>
            <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.map((tp) => {
                const selected = tp.code === form.typeCode;
                return (
                  <button
                    key={tp.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => applyType(tp)}
                    data-testid="type-card"
                    data-type-code={tp.code}
                    className={cn(
                      "flex h-full cursor-pointer flex-col gap-2 rounded-xl border p-4 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
                      selected ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-mist-300 bg-white"
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink-900">{bi(locale, tp.nameEn, tp.nameAr)}</span>
                      {selected ? <CheckCircle2 className="size-4 shrink-0 text-navy-700" aria-hidden /> : null}
                    </span>
                    <span className="line-clamp-3 text-xs leading-5 text-ink-600">{bi(locale, tp.descriptionEn, tp.descriptionAr)}</span>
                    <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      {t(`families.${tp.family as FamilyKey}`) !== labels[Math.min(3, Math.max(0, tp.classificationDefault - 1))] ? (
                        <Chip tone={FAMILY_TONE[tp.family] ?? "mist"}>{t(`families.${tp.family as FamilyKey}`)}</Chip>
                      ) : null}
                      {tp.cadence ? <Chip tone="mist">{t(`cadences.${tp.cadence as CadenceKey}`)}</Chip> : null}
                      <Chip tone="mist">{t(`scopeKinds.${tp.scopeKind}`)}</Chip>
                      <ClassificationChip level={tp.classificationDefault} labels={labels} />
                      <span className="text-[11px] text-ink-400 tnum">{t("builder.defaultSections", { count: tp.defaultSections.length })}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const stepPeriodScope = type ? (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-mist-200 p-4" data-testid="period-card">
        <p className={eyebrow}>{t("builder.period")}</p>
        <p className="mt-1 text-xs text-ink-600">
          {t("builder.periodHint", { cadence: t(`cadences.${(type.cadence ?? "on_demand") as CadenceKey}`), kind: t(`builder.periodKinds.${suggestedKind(type.cadence)}`) })}
        </p>
        <div role="radiogroup" aria-label={t("builder.period")} className="mt-3 flex flex-wrap gap-1.5">
          {(["year", "quarter", "month", "range"] as PeriodKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={form.periodKind === k} onClick={() => patch({ periodKind: k })} className={pill(form.periodKind === k)} data-testid={`period-kind-${k}`}>
              {t(`builder.periodKinds.${k}`)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {form.periodKind !== "range" ? (
            <div>
              <Label htmlFor="period-year">{t("builder.year")}</Label>
              <NativeSelect id="period-year" value={form.year} onChange={(e) => patch({ year: Number(e.target.value) })} data-testid="period-year">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {form.periodKind === "quarter" ? (
            <div>
              {/* a caption over a radio group of buttons, not one control */}
              <span id="period-quarter-label" className="mb-1.5 block text-xs font-medium text-ink-600">
                {t("builder.quarter")}
              </span>
              <div role="radiogroup" aria-labelledby="period-quarter-label" className="flex gap-1.5">
                {[1, 2, 3, 4].map((qn) => (
                  <button key={qn} type="button" role="radio" aria-checked={form.quarter === qn} onClick={() => patch({ quarter: qn })} className={cn(pill(form.quarter === qn), "flex-1 px-2 tnum")} data-testid={`period-quarter-${qn}`}>
                    {t("builder.quarterLabel", { n: qn })}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {form.periodKind === "month" ? (
            <div>
              <Label htmlFor="period-month">{t("builder.month")}</Label>
              <NativeSelect id="period-month" value={form.month} onChange={(e) => patch({ month: Number(e.target.value) })} data-testid="period-month">
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {form.periodKind === "range" ? (
            <>
              <div>
                <Label htmlFor="period-from">{t("builder.from")}</Label>
                <Input id="period-from" type="date" value={form.from} onChange={(e) => patch({ from: e.target.value })} data-testid="period-from" />
              </div>
              <div>
                <Label htmlFor="period-to">{t("builder.to")}</Label>
                <Input id="period-to" type="date" value={form.to} onChange={(e) => patch({ to: e.target.value })} data-testid="period-to" />
              </div>
              {form.from && form.to && form.from > form.to ? <p className="text-xs text-danger sm:col-span-2">{t("builder.rangeInvalid")}</p> : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-mist-200 p-4" data-testid="scope-card">
        <p className={eyebrow}>{t("builder.scope")}</p>
        {type.family === "custom" ? (
          <div role="radiogroup" aria-label={t("builder.scopeKind")} className="mt-3 flex flex-wrap gap-1.5">
            {PICKABLE.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={pickKind === k} onClick={() => patch({ scopeKind: k, scopeId: null })} className={pill(pickKind === k)} data-testid={`scope-kind-${k}`}>
                {t(`scopeKinds.${k}`)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-600">{t(`scopeKinds.${type.scopeKind}`)}</p>
        )}
        <div className="mt-3">
          {pickKind === "org" ? (
            <div className="flex items-center gap-3 rounded-lg bg-mist-50 px-3 py-3" data-testid="scope-council">
              <Landmark className="size-5 shrink-0 text-navy-700" aria-hidden />
              <div>
                <p className="text-sm font-medium text-ink-900">{t("builder.scopeCouncil")}</p>
                <p className="text-xs text-ink-600">{t("builder.scopeCouncilHint")}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-900">
                {React.createElement(SCOPE_ICON[pickKind], { className: "size-4 text-navy-700" })}
                {pickKind === "outcome" ? t("builder.pickOutcome") : pickKind === "department" ? t("builder.pickDepartment") : t("builder.pickProject")}
              </p>
              <ScopePicker
                kind={pickKind}
                options={scopeOptions[pickKind]}
                value={form.scopeId}
                onChange={(id) => patch({ scopeId: id })}
                countLine={
                  pickKind === "project"
                    ? scopes.isSuperAdmin
                      ? t("builder.allProjects", { count: scopes.projects.length })
                      : t("builder.allowedProjects", { count: scopes.projects.length })
                    : pickKind === "department" && !scopes.isSuperAdmin
                      ? t("builder.yourUnit")
                      : null
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const stepAudience = type ? (
    <div className="space-y-6">
      <div>
        <p className={eyebrow}>{t("builder.audience")}</p>
        <div role="radiogroup" className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {AUDIENCES.map((a) => {
            const selected = form.audience === a;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patch({ audience: a })}
                data-testid={`audience-${a}`}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
                  selected ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-mist-300 bg-white hover:border-navy-300"
                )}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink-900">
                  {t(`audiences.${a}`)}
                  {selected ? <CheckCircle2 className="size-4 text-navy-700" aria-hidden /> : null}
                </span>
                <span className="text-xs leading-5 text-ink-600">{t(`audienceHints.${a}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={eyebrow}>{t("builder.language")}</p>
        <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={form.languageMode === l} onClick={() => patch({ languageMode: l })} className={pill(form.languageMode === l)} data-testid={`language-${l}`}>
              {t(`languages.${l}`)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-600">{t("builder.languageHint")}</p>
      </div>
      <div>
        <p className={eyebrow}>{t("builder.classification")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!isSuperAdmin ? <ClassificationChip level={form.classification} labels={labels} /> : null}
          {isSuperAdmin ? (
            <NativeSelect value={form.classification} onChange={(e) => patch({ classification: Number(e.target.value) })} className="w-auto" aria-label={t("builder.classification")} data-testid="classification-select">
              {[1, 2, 3, 4]
                .filter((lvl) => lvl >= type.classificationDefault)
                .map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {labels[lvl - 1]}
                  </option>
                ))}
            </NativeSelect>
          ) : null}
          <span className="text-xs text-ink-600">{t("builder.classificationHint")}</span>
        </div>
      </div>
    </div>
  ) : null;

  const stepSections = type ? (
    <div>
      <p className="text-xs text-ink-600">{t("builder.sectionsHint")}</p>
      <div className="mt-3 space-y-2" data-testid="section-list">
        {available.map((l) => {
          const checked = form.selected.includes(l.code);
          const isDefault = type.defaultSections.includes(l.code);
          return (
            <label
              key={l.code}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:outline-2 focus-within:outline-aqua-500",
                checked ? "border-navy-300 bg-navy-50/60" : "border-mist-300 bg-white hover:border-navy-300"
              )}
              data-testid="section-toggle"
              data-section-code={l.code}
              data-checked={checked}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => patch({ selected: e.target.checked ? [...form.selected, l.code] : form.selected.filter((c) => c !== l.code) })}
                className="mt-1 size-4 accent-[var(--color-navy-700)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-ink-900">{bi(locale, l.name.en, l.name.ar)}</span>
                  <Chip tone={isDefault ? "navy" : "mist"}>{isDefault ? t("builder.default") : t("builder.optional")}</Chip>
                  <span className="text-[11px] text-ink-400 tnum">{t("builder.pagesEach", { count: l.estimatedPages })}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-600">{bi(locale, l.description.en, l.description.ar)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {!ordered.length ? <p className="mt-3 text-sm text-danger">{t("builder.noSections")}</p> : null}
    </div>
  ) : null;

  const content = [stepType, stepPeriodScope, stepAudience, stepSections][step];

  /* ---------------- structure preview ---------------- */

  let numeral = 0;
  const structure = ordered.map((l) => {
    const numbered = l.code !== "cover" && l.code !== "contents" && l.code !== "closing";
    if (numbered) numeral += 1;
    return { ...l, numeral: numbered ? String(numeral).padStart(2, "0") : "" };
  });

  return (
    <div data-testid="report-builder">
      <div className="mb-5">
        <ButtonLink href="/reports" variant="ghost" size="sm" className="-ms-2">
          <ChevronLeft className="flip-rtl" /> {t("builder.back")}
        </ButtonLink>
        <p className={cn(eyebrow, "mt-2")}>{t("builder.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl text-ink-900">{t("builder.title")}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-600">{t("builder.lede")}</p>
      </div>

      <ol className="flex flex-wrap gap-2" data-testid="builder-steps">
        {STEPS.map((s, i) => {
          const current = i === step;
          const done = i < step;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => reachable(i) && setStep(i)}
                disabled={!reachable(i)}
                aria-current={current ? "step" : undefined}
                data-testid={`step-${s}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500 disabled:cursor-not-allowed disabled:opacity-60",
                  current ? "border-navy-700 bg-navy-700 text-white" : done ? "border-navy-300 bg-navy-100 text-navy-900" : "border-mist-300 bg-white text-ink-600"
                )}
              >
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tnum", current ? "bg-white/20" : done ? "bg-navy-700 text-white" : "bg-mist-100")}>{i + 1}</span>
                {t(`builder.steps.${s}`)}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="card min-w-0 p-5 sm:p-6" data-testid={`builder-step-${STEPS[step]}`}>
          <p className={eyebrow}>{t("builder.stepOf", { n: step + 1, total: STEPS.length })}</p>
          <h2 className="mt-1 font-display text-xl text-ink-900">{t(`builder.steps.${STEPS[step]}`)}</h2>
          <div className="mt-4">{content}</div>
          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" data-testid="builder-error">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-mist-200 pt-4">
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting} data-testid="builder-prev">
              <ArrowLeft className="flip-rtl" /> {t("builder.previous")}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!valid[step]} data-testid="builder-next">
                {t("builder.next")} <ArrowRight className="flip-rtl" />
              </Button>
            ) : (
              <Button onClick={generate} loading={submitting} disabled={!valid.every(Boolean)} data-testid="generate">
                <Sparkles /> {submitting ? t("builder.generating") : t("builder.generate")}
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6" data-testid="structure-preview" aria-labelledby="structure-heading">
          <div className="card p-5">
            <p id="structure-heading" className={eyebrow}>
              {t("builder.structure")}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">{t("builder.structureHint")}</p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-400">{t("builder.summary.type")}</dt>
              <dd className="truncate text-ink-900" data-testid="summary-type">
                {type ? bi(locale, type.nameEn, type.nameAr) : t("builder.notChosen")}
              </dd>
              <dt className="text-ink-400">{t("builder.summary.period")}</dt>
              <dd className="text-ink-900 tnum" data-testid="summary-period">
                {type ? periodText : t("builder.notChosen")}
              </dd>
              <dt className="text-ink-400">{t("builder.summary.scope")}</dt>
              <dd className="truncate text-ink-900" data-testid="summary-scope">
                {type ? scopeText : t("builder.notChosen")}
              </dd>
              <dt className="text-ink-400">{t("builder.summary.audience")}</dt>
              <dd className="text-ink-900">{type ? t(`audiences.${form.audience}`) : t("builder.notChosen")}</dd>
              <dt className="text-ink-400">{t("builder.summary.language")}</dt>
              <dd className="text-ink-900">{type ? t(`languages.${form.languageMode}`) : t("builder.notChosen")}</dd>
              <dt className="text-ink-400">{t("builder.summary.classification")}</dt>
              <dd>{type ? <ClassificationChip level={form.classification} labels={labels} /> : <span className="text-ink-900">{t("builder.notChosen")}</span>}</dd>
            </dl>
            {structure.length ? (
              <>
                <div className="mt-4 flex h-2 gap-px overflow-hidden rounded-full bg-mist-100" aria-hidden>
                  {structure.map((l, i) => (
                    <span key={l.code} className={cn("h-full", i % 2 === 0 ? "bg-navy-700" : "bg-navy-300")} style={{ flexGrow: l.estimatedPages }} title={bi(locale, l.name.en, l.name.ar)} />
                  ))}
                </div>
                <ol className="mt-3 space-y-1 text-sm" data-testid="structure-list">
                  {structure.map((l) => (
                    <li key={l.code} className="flex items-center gap-2" data-section-code={l.code}>
                      <span className="w-6 shrink-0 text-end font-display text-ink-400 tnum">{l.numeral}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-900">{bi(locale, l.name.en, l.name.ar)}</span>
                      <span className="shrink-0 text-[11px] text-ink-400 tnum">{l.estimatedPages}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 border-t border-mist-200 pt-3 text-sm font-medium text-ink-900 tnum" data-testid="structure-total">
                  {t("builder.totalPages", { count: totalPages })}
                </p>
              </>
            ) : (
              <p className="mt-4 rounded-lg bg-mist-50 px-3 py-4 text-center text-xs text-ink-600">{type ? t("builder.noSections") : tc("nothingHere")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
