"use client";
// CR07 3.4: the unit panel. It opens in place beneath the chart, in the
// language of the outcome panel: a sand-100 surface, section eyebrows, and
// everything the structure knows about one unit. Header, the verbatim mandate
// in both languages with its source, the people, what the unit owns, the
// policies and procedures (3.5), and the sub-units.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Gauge,
  GraduationCap,
  Landmark,
  Link as LinkIcon,
  Mail,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Chip, ProgressRing } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { OrgPerson, OrgUnitNode, UnitPanelData } from "@/server/services/organisation";
import { PolicyTabs } from "./PolicyTabs";

function otherLang(locale: string, en: string, ar: string): string {
  return locale === "ar" ? en : ar;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600"
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </p>
  );
}

function useLevelLabel(): (level: string) => string {
  const t = useTranslations("organisation");
  return React.useCallback(
    (level: string) => {
      switch (level) {
        case "secretary_general":
          return t("levels.secretary_general");
        case "sector":
          return t("levels.sector");
        case "office":
          return t("levels.office");
        case "department":
          return t("levels.department");
        case "section":
          return t("levels.section");
        default:
          return level;
      }
    },
    [t]
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
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
        lead ? "bg-white shadow-[var(--shadow-paper)]" : "hover:bg-white/70"
      )}
    >
      <Avatar name={name} color={person.avatarColor} size={lead ? 34 : 26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-900">{name}</span>
        {position ? (
          <span className="block truncate text-xs text-ink-600">{position}</span>
        ) : null}
      </span>
      {person.roleInUnit === "head" ? (
        <Chip tone="maroon">{t("people.roleHead")}</Chip>
      ) : person.roleInUnit === "deputy" ? (
        <Chip tone="sand">{t("people.roleDeputy")}</Chip>
      ) : null}
      {person.email ? (
        <a
          href={`mailto:${person.email}`}
          aria-label={t("panel.email", { name })}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-600 hover:bg-white hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
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

function OwnsCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-3.5 shadow-[var(--shadow-paper)]">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
        <span className="text-maroon-700 [&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                            */
/* ------------------------------------------------------------------ */

export function UnitPanel({
  data,
  onClose,
  onSelectUnit,
}: {
  data: UnitPanelData;
  onClose: () => void;
  onSelectUnit: (code: string) => void;
}) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const levelLabel = useLevelLabel();
  const { toast } = useToast();
  const unit = data.unit;
  const name = bi(locale, unit.nameEn, unit.nameAr);
  const alt = otherLang(locale, unit.nameEn, unit.nameAr);
  const publishedHead = bi(locale, unit.headNameEn ?? "", unit.headNameAr ?? "");
  const publishedTitle = bi(locale, unit.headTitleEn ?? "", unit.headTitleAr ?? "");
  const headName = data.head ? bi(locale, data.head.nameEn, data.head.nameAr) : publishedHead;
  const headTitle = data.head
    ? bi(locale, data.head.positionEn ?? "", data.head.positionAr ?? "") || publishedTitle
    : publishedTitle;
  const members = data.people.filter((p) => p.id !== data.head?.id);
  const owns = data.owns;
  const hasOwns =
    owns.councilNodes.length > 0 ||
    owns.ndsNodes.length > 0 ||
    owns.documentsByType.length > 0 ||
    owns.indicators.length > 0 ||
    owns.experts.length > 0 ||
    owns.openHandovers.length > 0 ||
    owns.lessons > 0;

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?unit=${encodeURIComponent(
      unit.code
    )}`;
    void navigator.clipboard?.writeText(url);
    toast(t("panel.linkCopied"), "success");
  }

  return (
    <div className="rounded-2xl bg-sand-100" data-testid="org-unit-panel">
      <div className="px-4 py-5 sm:px-7 sm:py-6">
        {/* 1. header */}
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl flex-1">
            {data.breadcrumb.length ? (
              <nav
                aria-label={t("panel.breadcrumb")}
                className="mb-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-ink-600"
              >
                {data.breadcrumb.map((crumb, i) => (
                  <React.Fragment key={crumb.id}>
                    {i > 0 ? (
                      <ChevronRight className="size-3 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSelectUnit(crumb.code)}
                      className="link-draw cursor-pointer rounded text-ink-600 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
                    >
                      {bi(locale, crumb.nameEn, crumb.nameAr)}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h2 style={{ fontSize: 28, lineHeight: 1.2 }}>{name}</h2>
            <p className="mt-0.5 text-sm text-ink-400">{alt}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="gold">{levelLabel(unit.level)}</Chip>
              <Chip tone="sand">
                <Users className="size-3" aria-hidden />
                {t("panel.headcount", { count: unit.headcountTotal })}
              </Chip>
              {unit.policyCount > 0 ? (
                <Chip tone="maroon">{t("policyChip", { count: unit.policyCount })}</Chip>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            {headName ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-paper)]">
                <Avatar name={headName} color={data.head?.avatarColor ?? "maroon"} size={36} />
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                    {t("panel.head")}
                  </span>
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {headName}
                  </span>
                  {headTitle ? (
                    <span className="block truncate text-xs text-ink-600">{headTitle}</span>
                  ) : null}
                </span>
              </div>
            ) : (
              <span className="rounded-xl bg-white px-3 py-2 text-xs text-ink-600 shadow-[var(--shadow-paper)]">
                {t("headVacant")}
              </span>
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={copyLink}
                aria-label={t("panel.copyLink")}
                className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
              >
                <LinkIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("panel.close")}
                className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. the mandate, verbatim, in both languages */}
        <section className="mt-6">
          <Eyebrow>{t("mandate.eyebrow")}</Eyebrow>
          {data.mandateEn.length || data.mandateAr.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data.mandateEn.length ? (
                <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-paper)]" dir="ltr">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    {t("mandate.english")}
                  </p>
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
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    {t("mandate.arabic")}
                  </p>
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
            <p className="rounded-xl bg-white p-4 text-sm text-ink-600 shadow-[var(--shadow-paper)]">
              {t("mandate.empty")}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {(locale === "ar" ? data.mandateSourceUrlAr : data.mandateSourceUrl) ||
            data.mandateSourceUrl ? (
              <a
                href={
                  (locale === "ar" ? data.mandateSourceUrlAr : data.mandateSourceUrl) ??
                  data.mandateSourceUrl ??
                  "#"
                }
                target="_blank"
                rel="noreferrer"
                className="link-draw inline-flex cursor-pointer items-center gap-1 font-medium text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
              >
                <ExternalLink className="size-3.5" aria-hidden /> {t("mandate.source")}
              </a>
            ) : null}
            {data.mandateDocumentId ? (
              <Link
                href={`/vault/${data.mandateDocumentId}`}
                className="link-draw inline-flex items-center gap-1 font-medium text-ink-600"
              >
                <BookOpen className="size-3.5" aria-hidden /> {t("mandate.document")}
              </Link>
            ) : null}
            {data.mandateFetchedAt ? (
              <span className="text-ink-600 tnum">
                {t("mandate.fetched", {
                  date: formatDate(data.mandateFetchedAt, locale, { style: "medium" }),
                })}
              </span>
            ) : null}
          </div>

          {data.responsibilitiesEn || data.responsibilitiesAr ? (
            <div className="mt-3 rounded-xl border border-sand-300 bg-sand-50 p-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                {t("mandate.responsibilities")}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">
                {bi(locale, data.responsibilitiesEn ?? "", data.responsibilitiesAr ?? "")}
              </p>
            </div>
          ) : null}
        </section>

        {/* 3. people */}
        <section className="mt-6">
          <Eyebrow>{t("people.eyebrow")}</Eyebrow>
          {data.head ? (
            <div className="mb-2">
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400">
                {t("people.head")}
              </p>
              <PersonRow person={data.head} lead />
            </div>
          ) : null}
          {members.length ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400">
                {t("people.members")}
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {members.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            </div>
          ) : null}
          {!data.head && !members.length ? (
            <p className="text-sm text-ink-600">{t("people.empty")}</p>
          ) : null}
          {data.subUnitPeople.map((group) => (
            <div key={group.unit.id} className="mt-3">
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-ink-400">
                {bi(locale, group.unit.nameEn, group.unit.nameAr)}
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {group.people.map((person) => (
                  <PersonRow key={`${group.unit.id}:${person.id}`} person={person} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* 4. what this unit owns */}
        <section className="mt-6">
          <Eyebrow>{t("owns.eyebrow")}</Eyebrow>
          {hasOwns ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owns.councilNodes.length ? (
                <OwnsCard icon={<Landmark />} label={t("owns.council")}>
                  <ul className="flex flex-col gap-1">
                    {owns.councilNodes.slice(0, 6).map((node) => (
                      <li key={node.id} className="truncate text-xs text-ink-900">
                        {node.code ? (
                          <span className="me-1 text-ink-400 tnum">{node.code}</span>
                        ) : null}
                        {bi(locale, node.titleEn, node.titleAr)}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/council-strategy"
                    className="link-draw mt-2 inline-block text-[11px] font-medium text-maroon-700"
                  >
                    {t("owns.councilOpen")}
                  </Link>
                </OwnsCard>
              ) : null}

              {owns.ndsNodes.length ? (
                <OwnsCard icon={<Target />} label={t("owns.nds")}>
                  <ul className="flex flex-col gap-1">
                    {owns.ndsNodes.slice(0, 6).map((node) => (
                      <li key={node.id} className="truncate text-xs">
                        <Link
                          href={`/strategy/${node.id}`}
                          className="link-draw text-ink-900 hover:text-maroon-700"
                        >
                          {node.code ? (
                            <span className="me-1 text-ink-400 tnum">{node.code}</span>
                          ) : null}
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
                      <Chip key={type.code} tone="sand">
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
                        {indicator.code ? (
                          <span className="me-1 text-ink-400 tnum">{indicator.code}</span>
                        ) : null}
                        {bi(locale, indicator.nameEn, indicator.nameAr)}
                      </li>
                    ))}
                  </ul>
                </OwnsCard>
              ) : null}

              {owns.lessons > 0 ? (
                <OwnsCard icon={<GraduationCap />} label={t("owns.lessons")}>
                  <p className="text-sm text-ink-900 tnum">
                    {t("owns.lessonsCount", { count: owns.lessons })}
                  </p>
                  <Link
                    href="/lessons"
                    className="link-draw mt-2 inline-block text-[11px] font-medium text-maroon-700"
                  >
                    {t("owns.lessonsOpen")}
                  </Link>
                </OwnsCard>
              ) : null}

              {owns.experts.length ? (
                <OwnsCard icon={<UserRound />} label={t("owns.experts")}>
                  <ul className="flex flex-col gap-1">
                    {owns.experts.slice(0, 6).map((expert) => (
                      <li key={expert.id} className="truncate text-xs">
                        <Link
                          href={`/experts/${expert.id}`}
                          className="link-draw text-ink-900 hover:text-maroon-700"
                        >
                          {bi(locale, expert.nameEn, expert.nameAr)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </OwnsCard>
              ) : null}

              {/* the service only returns handovers to HR admins and the head */}
              {owns.openHandovers.length ? (
                <OwnsCard icon={<Users />} label={t("owns.handovers")}>
                  <ul className="flex flex-col gap-1.5">
                    {owns.openHandovers.slice(0, 5).map((handover) => (
                      <li key={handover.id} className="flex items-center gap-2">
                        <ProgressRing value={handover.completionPct / 100} size={26} stroke={3} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-ink-900">
                            {bi(locale, handover.personEn, handover.personAr)}
                          </span>
                          <span className="block text-[10px] text-ink-600 tnum">
                            {t("owns.handoverProgress", { pct: handover.completionPct })}
                          </span>
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

        {/* 5. policies and procedures (CR07 3.5) */}
        <section className="mt-6">
          <Eyebrow>{t("policies.eyebrow")}</Eyebrow>
          <PolicyTabs
            unitCode={unit.code}
            policies={data.policies}
            canEdit={data.canEdit}
            canAddPolicy={data.canAddPolicy}
          />
        </section>

        {/* 6. sub-units */}
        {data.subUnits.length ? (
          <section className="mt-6">
            <Eyebrow>{t("subUnits.eyebrow")}</Eyebrow>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.subUnits.map((sub: OrgUnitNode) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelectUnit(sub.code)}
                  className="card flex cursor-pointer items-center gap-2.5 px-3.5 py-3 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {bi(locale, sub.nameEn, sub.nameAr)}
                    </span>
                    <span className="block truncate text-[11px] text-ink-400">
                      {otherLang(locale, sub.nameEn, sub.nameAr)}
                    </span>
                    <span className="mt-1 block text-[11px] text-ink-600 tnum">
                      {t("subUnits.staff", { count: sub.headcountTotal })}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
