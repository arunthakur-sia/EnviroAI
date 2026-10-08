"use client";
// CR08 3: one card, two registers. Internal cards carry a navy accent, the
// unit breadcrumb (sector, then the unit), domains, badges and the projects
// the person is involved in. External cards carry a teal accent, the
// organisation, the type, availability, the last engagement year and the
// number of engagements, with "Request this expert" as the primary action.
// The whole card is reachable through one stretched link on the name, so the
// request button stays a real button and never nests inside the link.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, Building2, ChevronRight, FolderKanban, Handshake, Medal } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Avatar, Chip } from "@/components/ui/primitives";
import type { ExpertCardData } from "@/server/services/experts";
import { RequestExpertDialog } from "./RequestExpertDialog";

const AVAILABILITY_DOT: Record<string, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  unavailable: "bg-danger",
};

const MAX_DOMAINS = 3;

export function ExpertCard({
  expert,
  showRequest = true,
}: {
  expert: ExpertCardData;
  /** the request action; externals show it by default */
  showRequest?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("experts");
  const name = bi(locale, expert.nameEn, expert.nameAr);
  const internal = expert.kind === "internal";
  const position = bi(locale, expert.positionEn ?? "", expert.positionAr ?? "");
  const organisation = bi(locale, expert.organisationEn ?? "", expert.organisationAr ?? "");
  const hiddenDomains = expert.domains.length - MAX_DOMAINS;

  return (
    <article
      className={cn(
        "card card-hover relative flex h-full flex-col gap-3 overflow-hidden p-4 ps-5",
        "focus-within:outline-2 focus-within:outline-aqua-500"
      )}
      data-testid="expert-card"
      data-kind={expert.kind}
      data-expert-id={expert.id}
    >
      {/* the accent stripe: navy for Office staff, teal for externals */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 start-0 w-1", internal ? "bg-navy-700" : "bg-teal-600")}
      />

      <div className="flex items-start gap-3">
        <Avatar name={expert.nameEn} color={expert.avatarColor} size={46} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium text-ink-900">
            <Link
              href={`/experts/${expert.id}` as never}
              className="truncate after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              aria-label={position ? `${name}, ${position}` : name}
              data-testid="expert-link"
            >
              {name}
            </Link>
            {expert.isVerified ? (
              <BadgeCheck className="size-4 shrink-0 text-teal-600" role="img" aria-label={t("verified")} />
            ) : null}
          </p>
          {position ? <p className="truncate text-xs text-ink-600">{position}</p> : null}
          {internal ? (
            expert.unitPath.length ? (
              <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-ink-600" data-testid="unit-crumb">
                {expert.unitPath.map((u, i) => (
                  <span key={u.id} className="flex min-w-0 items-center gap-1">
                    {i > 0 ? <ChevronRight className="size-3 shrink-0 text-ink-400 flip-rtl" aria-hidden /> : null}
                    <span className={cn("truncate", i === expert.unitPath.length - 1 && "text-navy-900")}>
                      {bi(locale, u.nameEn, u.nameAr)}
                    </span>
                  </span>
                ))}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-ink-600">{t("unassignedUnit")}</p>
            )
          ) : organisation ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-600">
              <Building2 className="size-3 shrink-0 text-ink-400" aria-hidden />
              <span className="truncate">{organisation}</span>
            </p>
          ) : null}
        </div>
      </div>

      {expert.matchReason ? (
        <p className="rounded-lg bg-teal-100/60 px-2.5 py-1.5 text-xs leading-relaxed text-teal-600">
          {expert.matchReason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {!internal ? <Chip tone="teal">{t(`types.${expert.type}` as never)}</Chip> : null}
        {expert.domains.slice(0, MAX_DOMAINS).map((d) => (
          <Chip key={d.code} tone={internal ? "navy" : "mist"}>
            {bi(locale, d.nameEn, d.nameAr)}
          </Chip>
        ))}
        {hiddenDomains > 0 ? (
          <Chip tone="ghost" className="tnum">
            {t("moreDomains", { count: hiddenDomains })}
          </Chip>
        ) : null}
        {internal
          ? expert.badges.map((b) => (
              <Chip key={b.code} tone="aqua" title={bi(locale, b.nameEn, b.nameAr)}>
                <Medal className="size-3" aria-hidden /> {bi(locale, b.nameEn, b.nameAr)}
              </Chip>
            ))
          : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mist-100 pt-2.5 text-[11px] text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", AVAILABILITY_DOT[expert.availability])} aria-hidden />
          {t(`availability.${expert.availability}` as never)}
        </span>
        {internal ? (
          <span className="flex items-center gap-1 tnum" data-testid="project-count">
            <FolderKanban className="size-3 text-navy-700" aria-hidden />
            {t("projectsCount", { count: expert.projectCount })}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1 tnum" data-testid="engagement-count">
              <Handshake className="size-3 text-teal-600" aria-hidden />
              {t("engagementsCount", { count: expert.engagementCount })}
            </span>
            {expert.lastEngagementYear ? (
              <span className="tnum">{t("lastEngagement", { year: String(expert.lastEngagementYear) })}</span>
            ) : null}
          </>
        )}
        {expert.endorsementCount ? (
          <span className="ms-auto tnum">{t("endorsements", { count: expert.endorsementCount })}</span>
        ) : null}
      </div>

      {!internal && showRequest ? (
        <div className="relative z-10">
          <RequestExpertDialog expertId={expert.id} expertName={name} />
        </div>
      ) : null}
    </article>
  );
}
