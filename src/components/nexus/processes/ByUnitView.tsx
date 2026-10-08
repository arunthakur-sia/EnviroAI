"use client";
// CR08 10.1: the by-unit view. Every unit that owns a process or publishes a
// policy, collapsible, with the processes it owns (each opening the panel)
// and its documents behind the four policy tabs of the Organisation. The
// tab is shared with the by-policy view through ?tab=, the open unit through
// ?unit=.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Building2, ChevronDown, ExternalLink } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, EmptyState } from "@/components/ui/primitives";
import type { ProcessMap } from "@/server/services/operating-model";
import type { PolicyTab } from "@/server/services/organisation";
import { PolicyDocRow } from "./PolicyDocRow";
import { ProcessList } from "./ProcessList";
import { EASE, POLICY_TABS, SubHeading, unitHref, usePolicyTabLabels } from "./shared";

export function PolicyTabStrip({
  tab,
  counts,
  onTab,
  idBase,
}: {
  tab: PolicyTab;
  counts: Record<PolicyTab, number>;
  onTab: (tab: PolicyTab) => void;
  idBase: string;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const labels = usePolicyTabLabels();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const forward = e.key === "ArrowRight" ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
    const next = (index + forward + POLICY_TABS.length) % POLICY_TABS.length;
    onTab(POLICY_TABS[next]);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={t("byPolicy.tabsAria")} className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-[var(--shadow-paper)]" data-testid="policy-type-tabs">
      {POLICY_TABS.map((key, i) => {
        const active = key === tab;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${idBase}-tab-${key}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${key}`}
            tabIndex={active ? 0 : -1}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => onTab(key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            data-testid="policy-type-tab"
            data-tab={key}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
              active ? "bg-navy-100 font-medium text-navy-900" : "text-ink-600 hover:text-navy-900"
            )}
          >
            {labels[key]}
            <span className="text-[10px] text-ink-400 tnum">{counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}

function UnitSection({
  entry,
  open,
  tab,
  onToggle,
  onTab,
  onOpenProcess,
}: {
  entry: ProcessMap["byUnit"][number];
  open: boolean;
  tab: PolicyTab;
  onToggle: () => void;
  onTab: (tab: PolicyTab) => void;
  onOpenProcess: (code: string) => void;
}) {
  const t = useTranslations("processes");
  const to = useTranslations("organisation");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const idBase = React.useId();
  const name = bi(locale, entry.unit.nameEn, entry.unit.nameAr);
  const docCount = Object.values(entry.policies).reduce((n, list) => n + list.length, 0);
  const counts = Object.fromEntries(POLICY_TABS.map((k) => [k, entry.policies[k].length])) as Record<PolicyTab, number>;
  const docs = entry.policies[tab] ?? [];
  const emptyLabel: Record<PolicyTab, string> = {
    policy_internal: to("policies.published.policy_internal"),
    procedure: to("policies.published.procedure"),
    form_template: to("policies.published.form_template"),
    service: to("policies.published.service"),
  };

  return (
    <div
      className={cn("overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-paper)] transition-colors", open && "ring-1 ring-navy-300")}
      data-testid="by-unit-section"
      data-unit={entry.unit.code}
      data-expanded={open ? "true" : "false"}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${idBase}-body`}
        aria-label={open ? t("byUnit.collapse", { unit: name }) : t("byUnit.expand", { unit: name })}
        data-testid="by-unit-toggle"
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-900" aria-hidden>
          <Building2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-snug text-ink-900">
            <span className="me-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">{entry.unit.code}</span>
            {name}
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-600 tnum">{t("byUnit.summary", { processes: entry.processes.length, documents: docCount })}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${idBase}-body`}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-mist-100 bg-mist-50 px-4 py-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <section>
                  <SubHeading>{t("byUnit.processes")}</SubHeading>
                  {entry.processes.length ? (
                    <ProcessList processes={entry.processes} onOpen={onOpenProcess} />
                  ) : (
                    <p className="rounded-lg border border-dashed border-mist-300 bg-white px-3 py-4 text-center text-xs text-ink-600">{t("byUnit.noProcesses")}</p>
                  )}
                  <Link
                    href={unitHref(entry.unit.code)}
                    className="link-draw mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
                  >
                    <ExternalLink className="size-3" aria-hidden /> {t("byUnit.openUnit")}
                  </Link>
                </section>
                <section>
                  <SubHeading>{t("byUnit.documents")}</SubHeading>
                  <PolicyTabStrip tab={tab} counts={counts} onTab={onTab} idBase={idBase} />
                  <div role="tabpanel" id={`${idBase}-panel-${tab}`} aria-labelledby={`${idBase}-tab-${tab}`} tabIndex={-1} className="mt-3">
                    {docs.length ? (
                      <div className="flex flex-col gap-2">
                        {docs.map((d, i) => (
                          <PolicyDocRow key={d.id} doc={d} index={i} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-mist-300 bg-white px-3 py-4 text-center text-xs text-ink-600">{emptyLabel[tab]}</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ByUnitView({
  byUnit,
  initialUnit,
  tab,
  onUnitChange,
  onTab,
  onOpenProcess,
}: {
  byUnit: ProcessMap["byUnit"];
  initialUnit: string | null;
  tab: PolicyTab;
  /** the unit named in the URL: the last one opened, or null */
  onUnitChange: (code: string | null) => void;
  onTab: (tab: PolicyTab) => void;
  onOpenProcess: (code: string) => void;
}) {
  const t = useTranslations("processes");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(initialUnit ? [initialUnit.toUpperCase()] : []));
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /* a deep link scrolls its unit into view once */
  React.useEffect(() => {
    if (!initialUnit) return;
    const timer = setTimeout(() => {
      anchorRef.current
        ?.querySelector<HTMLElement>(`[data-unit="${initialUnit.toUpperCase()}"]`)
        ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 360);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(code: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      onUnitChange(next.has(code) ? code : [...next].pop() ?? null);
      return next;
    });
  }

  if (!byUnit.length) {
    return <EmptyState icon={<Building2 />} title={t("byUnit.empty")} className="mt-2" />;
  }
  const allOpen = open.size >= byUnit.length;
  return (
    <section aria-label={t("byUnit.aria")} data-testid="by-unit-view" ref={anchorRef} className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Chip tone="mist">{t("byPolicy.unitsCount", { count: byUnit.length })}</Chip>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const next = allOpen ? new Set<string>() : new Set(byUnit.map((u) => u.unit.code));
            setOpen(next);
            onUnitChange(null);
          }}
        >
          {allOpen ? t("byUnit.collapseAll") : t("byUnit.expandAll")}
        </Button>
      </div>
      <div className="flex flex-col gap-2.5">
        {byUnit.map((entry) => (
          <UnitSection
            key={entry.unit.id}
            entry={entry}
            open={open.has(entry.unit.code)}
            tab={tab}
            onToggle={() => toggle(entry.unit.code)}
            onTab={onTab}
            onOpenProcess={onOpenProcess}
          />
        ))}
      </div>
    </section>
  );
}
