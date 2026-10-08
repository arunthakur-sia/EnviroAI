"use client";
// CR08 1: the unit panel's sections as ONE array, so a later module can append
// a tab (for example "Processes this unit owns") without touching the panel:
// push an entry with a key, an icon, a label key under organisation.panel.tabs,
// an optional count and a render function that receives the panel data.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileStack,
  FileText,
  Gauge,
  GraduationCap,
  Landmark,
  Layers,
  Mail,
  ScrollText,
  Target,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Chip, ProgressRing } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { ItemRef } from "@/components/nexus/people/types";
import type { OrgPerson, OrgUnitNode, UnitPanelData } from "@/server/services/organisation";
import { PolicyTabs } from "./PolicyTabs";
import { UnitProcessesTab } from "../processes/UnitProcessesTab";

/** CR08 9.1: the unit as the item a person card is opened for. */
export function unitItemRef(unit: OrgUnitNode): ItemRef {
  return {
    type: "unit",
    id: unit.id,
    titleEn: unit.nameEn,
    titleAr: unit.nameAr,
    href: `/organisation?unit=${encodeURIComponent(unit.code)}`,
  };
}

export type UnitPanelTabProps = {
  data: UnitPanelData;
  onSelectUnit: (code: string) => void;
};

export type UnitPanelTabDef = {
  key: string;
  icon: React.ReactNode;
  /** a key under organisation.panel.tabs */
  labelKey: string;
  /** a small number beside the label, null for none */
  count?: (data: UnitPanelData) => number | null;
  /** when true the tab is not offered for this unit */
  hidden?: (data: UnitPanelData) => boolean;
  render: (props: UnitPanelTabProps) => React.ReactNode;
};

function otherLang(locale: string, en: string, ar: string): string {
  return locale === "ar" ? en : ar;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal" style={{ fontFamily: "inherit" }}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

function PersonRow({ person, lead = false }: { person: OrgPerson; lead?: boolean }) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const name = bi(locale, person.nameEn, person.nameAr);
  const position = bi(locale, person.positionEn ?? "", person.positionAr ?? "");
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2", lead ? "bg-white shadow-[var(--shadow-paper)]" : "hover:bg-white/70")}>
      <Avatar name={name} color={person.avatarColor} size={lead ? 34 : 26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-900">{name}</span>
        {position ? <span className="block truncate text-xs text-ink-600">{position}</span> : null}
      </span>
      {person.roleInUnit === "head" ? (
        <Chip tone="navy">{t("people.roleHead")}</Chip>
      ) : person.roleInUnit === "deputy" ? (
        <Chip tone="mist">{t("people.roleDeputy")}</Chip>
      ) : null}
      {person.email ? (
        <a
          href={`mailto:${person.email}`}
          aria-label={t("panel.email", { name })}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-600 hover:bg-white hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
        >
          <Mail className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What the unit owns                                                   */
/* ------------------------------------------------------------------ */

function OwnsCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-3.5 shadow-[var(--shadow-paper)]">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal">
        <span className="text-navy-700 [&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the tabs                                                             */
/* ------------------------------------------------------------------ */

function OverviewTab({ data }: UnitPanelTabProps) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  return (
    <section>
      <Eyebrow>{t("mandate.eyebrow")}</Eyebrow>
      {data.mandateEn.length || data.mandateAr.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.mandateEn.length ? (
            <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-paper)]" dir="ltr">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">{t("mandate.english")}</p>
              <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed text-ink-900">
                {data.mandateEn.map((line, i) => (
                  <li key={i} lang="en">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {data.mandateAr.length ? (
            <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-paper)]" dir="rtl">
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-ink-400">{t("mandate.arabic")}</p>
              <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed text-ink-900">
                {data.mandateAr.map((line, i) => (
                  <li key={i} lang="ar">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl bg-white p-4 text-sm text-ink-600 shadow-[var(--shadow-paper)]">{t("mandate.empty")}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {(locale === "ar" ? data.mandateSourceUrlAr : data.mandateSourceUrl) || data.mandateSourceUrl ? (
          <a
            href={(locale === "ar" ? data.mandateSourceUrlAr : data.mandateSourceUrl) ?? data.mandateSourceUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="link-draw inline-flex cursor-pointer items-center gap-1 font-medium text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
          >
            <ExternalLink className="size-3.5" aria-hidden /> {t("mandate.source")}
          </a>
        ) : null}
        {data.mandateDocumentId ? (
          <Link href={`/vault/${data.mandateDocumentId}`} className="link-draw inline-flex items-center gap-1 font-medium text-ink-600">
            <BookOpen className="size-3.5" aria-hidden /> {t("mandate.document")}
          </Link>
        ) : null}
        {data.mandateFetchedAt ? (
          <span className="text-ink-600 tnum">
            {t("mandate.fetched", { date: formatDate(data.mandateFetchedAt, locale, { style: "medium" }) })}
          </span>
        ) : null}
      </div>
      {data.responsibilitiesEn || data.responsibilitiesAr ? (
        <div className="mt-3 rounded-xl border border-mist-300 bg-mist-50 p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal">{t("mandate.responsibilities")}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">
            {bi(locale, data.responsibilitiesEn ?? "", data.responsibilitiesAr ?? "")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function PeopleTab({ data }: UnitPanelTabProps) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const members = data.people.filter((p) => p.id !== data.head?.id);
  return (
    <section>
      <Eyebrow>{t("people.eyebrow")}</Eyebrow>
      {data.head ? (
        <div className="mb-2">
          <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("people.head")}</p>
          {/* CR08 9.1: the head's person card, with the Head chip and the mail
              action beside it (the card opens from a button, so neither may
              wrap the other) */}
          <div className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-[var(--shadow-paper)]" data-testid="unit-head-row">
            <span className="min-w-0 flex-1">
              <OwnerControl owner={data.head} role="unit_head" size="md" align="end" item={unitItemRef(data.unit)} className="max-w-full" />
              {/* ps-[46px]: the position lines up with the name, past the 36px monogram and its gap */}
              {data.head.positionEn || data.head.positionAr ? (
                <span className="block truncate ps-[46px] text-xs text-ink-600">
                  {bi(locale, data.head.positionEn ?? "", data.head.positionAr ?? "")}
                </span>
              ) : null}
            </span>
            <Chip tone="navy">{t("people.roleHead")}</Chip>
            {data.head.email ? (
              <a
                href={`mailto:${data.head.email}`}
                aria-label={t("panel.email", { name: bi(locale, data.head.nameEn, data.head.nameAr) })}
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-600 hover:bg-mist-50 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
              >
                <Mail className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {members.length ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("people.members")}</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {members.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </div>
        </div>
      ) : null}
      {!data.head && !members.length ? <p className="text-sm text-ink-600">{t("people.empty")}</p> : null}
      {data.subUnitPeople.map((group) => (
        <div key={group.unit.id} className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{bi(locale, group.unit.nameEn, group.unit.nameAr)}</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {group.people.map((person) => (
              <PersonRow key={`${group.unit.id}:${person.id}`} person={person} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function OwnsTab({ data }: UnitPanelTabProps) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const owns = data.owns;
  const hasOwns =
    owns.councilNodes.length > 0 ||
    owns.nesNodes.length > 0 ||
    owns.documentsByType.length > 0 ||
    owns.indicators.length > 0 ||
    owns.experts.length > 0 ||
    owns.openHandovers.length > 0 ||
    owns.lessons > 0;
  return (
    <section>
      <Eyebrow>{t("owns.eyebrow")}</Eyebrow>
      {hasOwns ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {owns.councilNodes.length ? (
            <OwnsCard icon={<Landmark />} label={t("owns.council")}>
              <ul className="flex flex-col gap-1">
                {owns.councilNodes.slice(0, 6).map((node) => (
                  <li key={node.id} className="truncate text-xs text-ink-900">
                    {node.code ? <span className="me-1 text-ink-400 tnum">{node.code}</span> : null}
                    {bi(locale, node.titleEn, node.titleAr)}
                  </li>
                ))}
              </ul>
              <Link href="/council-strategy" className="link-draw mt-2 inline-block text-[11px] font-medium text-navy-700">
                {t("owns.councilOpen")}
              </Link>
            </OwnsCard>
          ) : null}
          {owns.nesNodes.length ? (
            <OwnsCard icon={<Target />} label={t("owns.nes")}>
              <ul className="flex flex-col gap-1">
                {owns.nesNodes.slice(0, 6).map((node) => (
                  <li key={node.id} className="truncate text-xs">
                    <Link href={`/strategy/${node.id}`} className="link-draw text-ink-900 hover:text-navy-700">
                      {node.code ? <span className="me-1 text-ink-400 tnum">{node.code}</span> : null}
                      {bi(locale, node.titleEn, node.titleAr)}
                    </Link>
                  </li>
                ))}
              </ul>
            </OwnsCard>
          ) : null}
          {owns.documentsByType.length ? (
            <OwnsCard icon={<FileText />} label={t("owns.documents")}>
              <div className="flex flex-wrap gap-1.5">
                {owns.documentsByType.slice(0, 10).map((type) => (
                  <Chip key={type.code} tone="mist">
                    {bi(locale, type.nameEn, type.nameAr)}
                    <span className="tnum font-semibold">{type.count}</span>
                  </Chip>
                ))}
              </div>
            </OwnsCard>
          ) : null}
          {owns.indicators.length ? (
            <OwnsCard icon={<Gauge />} label={t("owns.indicators")}>
              <ul className="flex flex-col gap-1">
                {owns.indicators.slice(0, 6).map((indicator) => (
                  <li key={indicator.id} className="truncate text-xs text-ink-900">
                    {indicator.code ? <span className="me-1 text-ink-400 tnum">{indicator.code}</span> : null}
                    {bi(locale, indicator.nameEn, indicator.nameAr)}
                  </li>
                ))}
              </ul>
            </OwnsCard>
          ) : null}
          {owns.lessons > 0 ? (
            <OwnsCard icon={<GraduationCap />} label={t("owns.lessons")}>
              <p className="text-sm text-ink-900 tnum">{t("owns.lessonsCount", { count: owns.lessons })}</p>
              <Link href="/lessons" className="link-draw mt-2 inline-block text-[11px] font-medium text-navy-700">
                {t("owns.lessonsOpen")}
              </Link>
            </OwnsCard>
          ) : null}
          {owns.experts.length ? (
            <OwnsCard icon={<UserRound />} label={t("owns.experts")}>
              <ul className="flex flex-col gap-1">
                {owns.experts.slice(0, 6).map((expert) => (
                  <li key={expert.id} className="truncate text-xs">
                    <Link href={`/experts/${expert.id}`} className="link-draw text-ink-900 hover:text-navy-700">
                      {bi(locale, expert.nameEn, expert.nameAr)}
                    </Link>
                  </li>
                ))}
              </ul>
            </OwnsCard>
          ) : null}
          {owns.openHandovers.length ? (
            <OwnsCard icon={<Users />} label={t("owns.handovers")}>
              <ul className="flex flex-col gap-1.5">
                {owns.openHandovers.slice(0, 5).map((handover) => (
                  <li key={handover.id} className="flex items-center gap-2">
                    <ProgressRing value={handover.completionPct / 100} size={26} stroke={3} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-ink-900">{bi(locale, handover.personEn, handover.personAr)}</span>
                      <span className="block text-[10px] text-ink-600 tnum">{t("owns.handoverProgress", { pct: handover.completionPct })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </OwnsCard>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-600">{t("owns.empty")}</p>
      )}
    </section>
  );
}

function PoliciesTab({ data }: UnitPanelTabProps) {
  const t = useTranslations("organisation");
  return (
    <section>
      <Eyebrow>{t("policies.eyebrow")}</Eyebrow>
      <PolicyTabs unitCode={data.unit.code} policies={data.policies} canEdit={data.canEdit} canAddPolicy={data.canAddPolicy} />
    </section>
  );
}

function SubUnitsTab({ data, onSelectUnit }: UnitPanelTabProps) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  return (
    <section>
      <Eyebrow>{t("subUnits.eyebrow")}</Eyebrow>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {data.subUnits.map((sub: OrgUnitNode) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => onSelectUnit(sub.code)}
            className="card flex cursor-pointer items-center gap-2.5 px-3.5 py-3 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-900">{bi(locale, sub.nameEn, sub.nameAr)}</span>
              <span className="block truncate text-[11px] text-ink-400">{otherLang(locale, sub.nameEn, sub.nameAr)}</span>
              <span className="mt-1 block text-[11px] text-ink-600 tnum">{t("subUnits.staff", { count: sub.headcountTotal })}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-400 flip-rtl" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}

/** The panel's tabs, in order. Append here to add a section. */
export const UNIT_PANEL_TABS: UnitPanelTabDef[] = [
  { key: "overview", icon: <ScrollText />, labelKey: "overview", render: (p) => <OverviewTab {...p} /> },
  {
    key: "people",
    icon: <Users />,
    labelKey: "people",
    count: (d) => d.people.length + d.subUnitPeople.reduce((n, g) => n + g.people.length, 0),
    render: (p) => <PeopleTab {...p} />,
  },
  {
    key: "owns",
    icon: <Landmark />,
    labelKey: "owns",
    count: (d) =>
      d.owns.councilNodes.length + d.owns.nesNodes.length + d.owns.indicators.length + d.owns.experts.length + d.owns.lessons + d.owns.openHandovers.length,
    render: (p) => <OwnsTab {...p} />,
  },
  {
    key: "policies",
    icon: <FileStack />,
    labelKey: "policies",
    count: (d) => Object.values(d.policies).reduce((n, list) => n + list.length, 0),
    render: (p) => <PoliciesTab {...p} />,
  },
  {
    // CR08 10.1: the unit's own processes, loaded by the tab itself
    key: "processes",
    icon: <Workflow />,
    labelKey: "processes",
    render: (p) => <UnitProcessesTab unitId={p.data.unit.id} unitCode={p.data.unit.code} />,
  },
  {
    key: "subUnits",
    icon: <Layers />,
    labelKey: "subUnits",
    count: (d) => d.subUnits.length,
    hidden: (d) => d.subUnits.length === 0,
    render: (p) => <SubUnitsTab {...p} />,
  },
];
