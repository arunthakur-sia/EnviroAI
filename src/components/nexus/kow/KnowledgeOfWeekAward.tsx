"use client";
// CR08 8: the permanent award on a contributor's profile, with the number of
// weeks their work was the pick. Renders nothing for people never chosen.
import { useLocale, useTranslations } from "next-intl";
import { Crown } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Tip } from "@/components/ui/overlays";

export function KnowledgeOfWeekAward({
  weeks,
  latestWeekStart,
  numerals,
}: {
  weeks: number;
  latestWeekStart?: string | null;
  numerals?: string;
}) {
  const t = useTranslations("kow");
  const locale = useLocale();
  if (!weeks) return null;
  const chip = (
    <span
      data-testid="kow-award"
      className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-gold-300 bg-gold-100 px-2.5 py-1 text-xs font-medium text-maroon-900"
      tabIndex={0}
    >
      <Crown className="size-3.5 text-gold-500" aria-hidden />
      {t("award.title")}
      <span aria-hidden className="text-gold-500">·</span>
      <span className="tnum text-ink-600">{t("award.weeks", { count: weeks })}</span>
    </span>
  );
  if (!latestWeekStart) return chip;
  return (
    <Tip
      content={t("award.tip", {
        count: weeks,
        date: formatDate(latestWeekStart, locale, { style: "medium", numerals }),
      })}
    >
      {chip}
    </Tip>
  );
}
