"use client";
// CR08 8: the Home strip. A full-width band under the greeting and above the
// Ask hero, shown all week: eyebrow and kind, the title, the contributor's
// monogram, name and unit, the count of colleagues who have read it, "Read
// now" (marks the read, then opens the item) and the Hall of Knowledge link.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Star, Users, Check, ArrowRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Avatar, Button } from "@/components/ui/primitives";
import type { KowCard } from "@/server/services/knowledge-of-week";
import { kowPatch } from "./client";

export function KnowledgeOfWeekStrip({ card, numerals, className }: { card: KowCard; numerals?: string; className?: string }) {
  const t = useTranslations("kow");
  const locale = useLocale();
  const router = useRouter();
  const [readCount, setReadCount] = React.useState(card.readCount);
  const [viewerRead, setViewerRead] = React.useState(card.viewerRead);
  const [busy, setBusy] = React.useState(false);
  const title = bi(locale, card.titleEn, card.titleAr);
  const c = card.contributor;

  const read = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await kowPatch("read", card.id);
    if (r.first) {
      setViewerRead(true);
      setReadCount(r.readCount ?? readCount + 1);
    }
    setBusy(false);
    router.push(card.href as never);
  };

  return (
    <section
      data-testid="kow-strip"
      aria-label={t("strip.aria")}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-aqua-300 bg-white shadow-[var(--shadow-paper)]",
        className
      )}
    >
      <span aria-hidden className="absolute inset-y-0 start-0 w-1.5 bg-aqua-500" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4 pe-5 ps-6">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-aqua-300 bg-aqua-100"
        >
          <Star className="size-5 text-aqua-500" fill="currentColor" />
        </span>

        <div className="min-w-0 flex-1 basis-64">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">
            <span>{t("eyebrow")}</span>
            <span aria-hidden className="text-aqua-500">·</span>
            <span className="font-medium normal-case tracking-normal text-ink-400">{t(`kinds.${card.resourceType}`)}</span>
          </p>
          <a
            href={card.href}
            onClick={read}
            className="mt-0.5 block truncate font-display text-lg text-ink-900 transition-colors hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500"
            style={{ fontWeight: 550 }}
            data-testid="kow-strip-title"
          >
            {title}
          </a>
          {c ? (
            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-ink-600">
              <Avatar name={c.nameEn} color={c.color} size={20} />
              <span className="truncate">
                {bi(locale, c.nameEn, c.nameAr)}
                {c.unitNameEn ? <span className="text-ink-400"> · {bi(locale, c.unitNameEn, c.unitNameAr)}</span> : null}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-600 tnum" data-testid="kow-strip-reads">
            <Users className="size-3.5 text-ink-400" aria-hidden />
            {t("readCount", { count: readCount, n: formatNumber(readCount, locale, { decimals: 0, numerals }) })}
          </span>
          {viewerRead ? (
            <span className="flex items-center gap-1 text-xs font-medium text-ok" data-testid="kow-strip-read-mark">
              <Check className="size-3.5" aria-hidden /> {t("youRead")}
            </span>
          ) : null}
          <Button size="sm" variant={viewerRead ? "secondary" : "primary"} onClick={read} loading={busy} data-testid="kow-strip-read">
            {viewerRead ? t("readAgain") : t("readNow")}
          </Button>
          <Link
            href={"/hall-of-knowledge" as never}
            className="link-draw inline-flex items-center gap-1 text-xs font-medium text-navy-700"
            data-testid="kow-strip-hall"
          >
            {t("hallLink")} <ArrowRight className="size-3 flip-rtl" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
