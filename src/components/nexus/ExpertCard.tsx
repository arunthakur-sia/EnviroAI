"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, Handshake } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Avatar, Chip } from "@/components/ui/primitives";
import type { ExpertCardData } from "@/server/services/experts";

const AVAILABILITY_DOT: Record<string, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  unavailable: "bg-danger",
};

export function ExpertCard({ expert }: { expert: ExpertCardData }) {
  const locale = useLocale();
  const t = useTranslations("experts");
  return (
    <Link href={`/experts/${expert.id}` as never} className="card card-hover flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={expert.nameEn} color={expert.avatarColor} size={46} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-ink-900">
            {bi(locale, expert.nameEn, expert.nameAr)}
            {expert.isVerified ? <BadgeCheck className="size-4 shrink-0 text-gulf-600" /> : null}
          </p>
          <p className="truncate text-xs text-ink-600">
            {bi(locale, expert.positionEn ?? "", expert.positionAr ?? "")}
            {expert.organisationEn ? (
              <span className="text-ink-400">
                {" · "}
                {bi(locale, expert.organisationEn ?? "", expert.organisationAr ?? "")}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {expert.matchReason ? (
        <p className="rounded-lg bg-gulf-100/60 px-2.5 py-1.5 text-xs leading-relaxed text-gulf-600">
          {expert.matchReason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <Chip tone="sand">{t(`types.${expert.type}` as never)}</Chip>
        {expert.domains.slice(0, 3).map((d) => (
          <Chip key={d.code} tone="maroon">
            {bi(locale, d.nameEn, d.nameAr)}
          </Chip>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-sand-100 pt-2.5 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", AVAILABILITY_DOT[expert.availability])} />
          {t(`availability.${expert.availability}` as never)}
        </span>
        {expert.engagementCount ? (
          <span className="flex items-center gap-1 tnum">
            <Handshake className="size-3" /> {t("workedWith", { count: expert.engagementCount })}
          </span>
        ) : null}
        {expert.endorsementCount ? (
          <span className="ms-auto tnum">{t("endorsements", { count: expert.endorsementCount })}</span>
        ) : null}
      </div>
    </Link>
  );
}
