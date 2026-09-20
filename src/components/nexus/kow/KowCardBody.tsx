"use client";
// CR08 8: the one card body the reveal, the set dialog's preview and the
// Hall's featured slot all draw: eyebrow, kind and week, the title in the
// display face, the two-line summary, the contributor (monogram, name,
// position, unit breadcrumb) and the administrator's note.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Star, Quote } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Chip } from "@/components/ui/primitives";
import type { KowCard } from "@/server/services/knowledge-of-week";

export type KowCardSize = "reveal" | "featured" | "preview";

export function KowEyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal",
        className
      )}
    >
      <Star className="size-3 text-gold-500" fill="currentColor" aria-hidden />
      {children}
    </p>
  );
}

export function KowContributorRow({
  card,
  size = "md",
  className,
}: {
  card: Pick<KowCard, "contributor">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("kow");
  const c = card.contributor;
  if (!c) return null;
  const avatar = size === "lg" ? 44 : size === "md" ? 32 : 22;
  const position = bi(locale, c.positionEn, c.positionAr);
  const unit = bi(locale, c.unitPathEn, c.unitPathAr);
  return (
    <div className={cn("flex items-center gap-3", className)} data-testid="kow-contributor">
      <Avatar name={c.nameEn} color={c.color} size={avatar} />
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-ink-900", size === "lg" ? "text-base" : "text-sm")}>
          {bi(locale, c.nameEn, c.nameAr)}
          <span className="ms-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400 rtl:tracking-normal">
            {t("contributor")}
          </span>
        </p>
        {(position || unit) && (
          // the reveal has the room to wrap; the strip and the cards keep one line
          <p className={cn("text-ink-600", size === "lg" ? "text-sm leading-snug" : "truncate text-xs")}>
            {[position, unit].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function KowCardBody({
  card,
  size = "featured",
  numerals,
  className,
}: {
  card: KowCard;
  size?: KowCardSize;
  numerals?: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("kow");
  const title = bi(locale, card.titleEn, card.titleAr);
  const summary = bi(locale, card.summaryEn, card.summaryAr);
  const note = bi(locale, card.noteEn, card.noteAr);
  const setBy = bi(locale, card.setByNameEn, card.setByNameAr);
  const week = t("weekOf", { date: formatDate(card.weekStart, locale, { style: "medium", numerals }) });
  const big = size === "reveal";

  return (
    <div className={cn("flex flex-col", big ? "gap-5" : "gap-3.5", className)} data-testid={`kow-card-${size}`}>
      <div className="flex flex-wrap items-center gap-2">
        <KowEyebrow>{t("eyebrow")}</KowEyebrow>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-gold-300/70" />
        <Chip tone="gold">{t(`kinds.${card.resourceType}`)}</Chip>
        <Chip tone="sand" className="tnum">{week}</Chip>
        {card.illustrative ? <Chip tone="sand">{t("hall.illustrative")}</Chip> : null}
      </div>

      <h2
        className={cn(
          "font-display text-ink-900",
          big ? "text-3xl leading-[1.15] sm:text-4xl" : size === "featured" ? "text-2xl leading-snug" : "text-xl leading-snug"
        )}
        style={{ fontWeight: 550 }}
        data-testid="kow-title"
      >
        {title}
      </h2>

      {summary ? (
        <p className={cn("line-clamp-2 text-ink-600", big ? "text-base leading-relaxed sm:text-lg" : "text-sm leading-relaxed")}>
          {summary}
        </p>
      ) : null}

      <KowContributorRow card={card} size={big ? "lg" : "md"} />

      {note ? (
        <figure
          className={cn(
            "relative rounded-lg border border-gold-300/70 bg-gold-100/50 ps-4 pe-4",
            big ? "py-4" : "py-3"
          )}
          data-testid="kow-note"
        >
          <Quote aria-hidden className="absolute end-3 top-2.5 size-4 text-gold-300 flip-rtl" />
          <figcaption className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">
            {setBy ? t("note", { name: setBy }) : t("noteAdmin")}
          </figcaption>
          <blockquote className={cn("text-ink-900", big ? "text-[15px] leading-relaxed" : "text-sm leading-relaxed")}>
            {note}
          </blockquote>
        </figure>
      ) : null}
    </div>
  );
}
