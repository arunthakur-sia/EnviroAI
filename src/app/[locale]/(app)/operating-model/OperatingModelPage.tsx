"use client";
// CR08 10.2: the Operating Model page body. The hero band (title, the
// Internal and Illustrative chips, one line of explanation, the in-page
// section nav that highlights on scroll and sticks under the top bar), then
// the seven sections in order. Every section is its own component under
// src/components/nexus/operating-model.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import type { OperatingModel, ProcessRef, UnitRef } from "@/server/services/operating-model";
import { NumeralsProvider, displayFont } from "@/components/nexus/operating-model/shared";
import { Principles } from "@/components/nexus/operating-model/Principles";
import { GovernanceMap } from "@/components/nexus/operating-model/GovernanceMap";
import { ProcessLandscape } from "@/components/nexus/operating-model/ProcessLandscape";
import { RaciMatrix } from "@/components/nexus/operating-model/RaciMatrix";
import { CalendarSection } from "@/components/nexus/operating-model/CalendarRing";
import { Interfaces } from "@/components/nexus/operating-model/Interfaces";
import { KpiScorecard } from "@/components/nexus/operating-model/KpiScorecard";

const SECTIONS = [
  { id: "om-principles", key: "principles" },
  { id: "om-governance", key: "governance" },
  { id: "om-processes", key: "processes" },
  { id: "om-raci", key: "raci" },
  { id: "om-calendar", key: "calendar" },
  { id: "om-interfaces", key: "interfaces" },
  { id: "om-kpis", key: "kpis" },
] as const;

export type Viewer = { id: string; numerals: string };

export function OperatingModelPage({
  model,
  viewer,
  initialSection,
}: {
  model: OperatingModel;
  viewer: Viewer;
  initialSection: string | null;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [active, setActive] = React.useState<string>(SECTIONS[0].id);

  /* every unit the calendar and interface dialogs may name, in org order */
  const allUnits = React.useMemo<UnitRef[]>(() => {
    const map = new Map<string, UnitRef>();
    for (const u of model.raci.units) map.set(u.id, u);
    for (const u of model.interfaces.units) map.set(u.id, u);
    for (const l0 of model.chain) {
      if (l0.ownerUnit) map.set(l0.ownerUnit.id, l0.ownerUnit);
      for (const l1 of l0.children) if (l1.ownerUnit) map.set(l1.ownerUnit.id, l1.ownerUnit);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [model.raci.units, model.interfaces.units, model.chain]);

  const level1: ProcessRef[] = React.useMemo(
    () => model.raci.processes.map((p) => ({ id: p.id, code: p.code, nameEn: p.nameEn, nameAr: p.nameAr, level: 1 })),
    [model.raci.processes]
  );

  /* The nav highlights the last section whose heading has passed under the top
     bar, and the final section once the page is scrolled to the end: the last
     section is shorter than the viewport and never reaches the top itself. */
  React.useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 12) {
        setActive(SECTIONS[SECTIONS.length - 1].id);
        return;
      }
      let current: string = SECTIONS[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= 140) current = el.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  /* ?section=interfaces (the notification deep link) and #hash bring the section into view */
  React.useEffect(() => {
    const wanted = initialSection ? `om-${initialSection}` : window.location.hash.replace(/^#/, "");
    if (!wanted) return;
    const el = document.getElementById(wanted);
    if (!el) return;
    const timer = window.setTimeout(() => el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", `#${id}`);
    setActive(id);
    const heading = el.querySelector<HTMLElement>("h2");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  };

  return (
    <div className="relative" data-testid="operating-model-page">
      <AskContextItem
        item={{ kind: "process", id: "operating-model", code: "OM", titleEn: "Operating Model", titleAr: "نموذج التشغيل", href: "/operating-model" }}
      />

      {/* the hero band */}
      <header className="mb-2" data-testid="om-hero">
        {/* a column on a phone: as a row the Ask link keeps its width while the
            text block (flex-basis 0) collapses to a few characters */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0 max-w-3xl sm:flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{t("eyebrow")}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] leading-tight sm:text-[34px]" style={{ fontFamily: displayFont(locale) }}>
                {t("title")}
              </h1>
              <span className="flex items-center gap-1.5">
                <Chip tone="maroon" title={t("internalTitle")} data-testid="internal-chip">
                  {t("internal")}
                </Chip>
                {model.isIllustrative ? (
                  <Chip tone="sand" title={t("illustrativeTitle")} data-testid="illustrative-chip">
                    {t("illustrative")}
                  </Chip>
                ) : null}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{t("intro")}</p>
            <p className="mt-1 text-[11px] text-ink-400" data-testid="om-edit-note">
              {model.canEdit ? t("editorNote") : t("readerNote")}
            </p>
          </div>
          <Link
            href={`/ask?q=${encodeURIComponent(t("askAbout"))}` as never}
            className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            data-testid="om-ask"
          >
            <MessageCircleQuestion className="size-4" aria-hidden /> {t("askAbout")}
          </Link>
        </div>
      </header>

      {/* the in-page section nav, sticky under the top bar */}
      <nav
        aria-label={t("nav.aria")}
        className="sticky top-16 z-30 -mx-6 mb-8 border-b border-sand-200 bg-sand-50/95 px-6 py-2 backdrop-blur"
        data-testid="om-nav"
      >
        <ol className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {SECTIONS.map((s, i) => {
            const isActive = active === s.id;
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  onClick={jump(s.id)}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                    isActive ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600 hover:bg-white/70 hover:text-ink-900"
                  )}
                  data-testid={`om-nav-${s.key}`}
                >
                  <span className={cn("tnum", isActive ? "text-maroon-700" : "text-ink-400")}>{i + 1}</span>
                  {t(`nav.${s.key}` as never)}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <NumeralsProvider numerals={viewer.numerals}>
        <div className="space-y-16">
          <Principles principles={model.principles} canEdit={model.canEdit} isIllustrative={model.isIllustrative} n={1} />
          <GovernanceMap governance={model.governance} n={2} />
          <ProcessLandscape chain={model.chain} n={3} />
          <RaciMatrix raci={model.raci} chain={model.chain} canEdit={model.canEdit} n={4} />
          <CalendarSection initial={model.calendar} units={allUnits} canEdit={model.canEdit} n={5} />
          <Interfaces interfaces={model.interfaces} allUnits={allUnits} processes={level1} canEdit={model.canEdit} n={6} />
          <KpiScorecard kpis={model.kpis} canEdit={model.canEdit} n={7} />
        </div>
      </NumeralsProvider>
    </div>
  );
}
