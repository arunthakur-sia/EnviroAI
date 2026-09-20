"use client";
// CR08 8: the Hall of Knowledge gallery. The current week featured at the
// top as the reveal card, administrators' upcoming picks beneath it, then
// the archive by month: item, contributor, note, read count.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Star, Users, ArrowRight, CalendarClock, Landmark } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import { Avatar, Button, Chip, EmptyState } from "@/components/ui/primitives";
import { Stagger } from "@/components/motion";
import { KowCardBody, KowEyebrow } from "@/components/nexus/kow";
import { kowPatch } from "@/components/nexus/kow/client";
import type { KowCard, KowHall } from "@/server/services/knowledge-of-week";

function monthLabel(key: string, locale: string, numerals?: string): string {
  const d = new Date(key + "-01T12:00:00Z");
  const nu = numerals === "eastern" ? "arab" : "latn";
  return new Intl.DateTimeFormat(locale === "ar" ? `ar-QA-u-nu-${nu}` : `en-QA-u-nu-${nu}`, { month: "long", year: "numeric" }).format(d);
}

function HallCard({ card, numerals }: { card: KowCard; numerals?: string }) {
  const t = useTranslations("kow");
  const locale = useLocale();
  const c = card.contributor;
  const note = bi(locale, card.noteEn, card.noteAr);
  return (
    <article className="card card-hover flex h-full flex-col gap-3 p-5" data-testid="hall-card" data-week={card.weekStart}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="sand" className="tnum">
          {t("weekOf", { date: formatDate(card.weekStart, locale, { style: "medium", numerals }) })}
        </Chip>
        <Chip tone="gold">{t(`kinds.${card.resourceType}`)}</Chip>
        {card.illustrative ? <Chip tone="sand">{t("hall.illustrative")}</Chip> : null}
      </div>
      <Link
        href={card.href as never}
        className="font-display text-lg leading-snug text-ink-900 transition-colors hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
        style={{ fontWeight: 550 }}
      >
        {bi(locale, card.titleEn, card.titleAr)}
      </Link>
      {c ? (
        <div className="flex items-center gap-2.5">
          <Avatar name={c.nameEn} color={c.color} size={28} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</p>
            <p className="truncate text-xs text-ink-600">{bi(locale, c.unitPathEn, c.unitPathAr)}</p>
          </div>
        </div>
      ) : null}
      {note ? (
        <p className="line-clamp-3 border-s-2 border-gold-300 ps-3 text-sm leading-relaxed text-ink-600">{note}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-xs text-ink-600">
        <span className="flex items-center gap-1.5 tnum" data-testid="hall-card-reads">
          <Users className="size-3.5 text-ink-400" aria-hidden />
          {t("readCount", { count: card.readCount, n: formatNumber(card.readCount, locale, { decimals: 0, numerals }) })}
        </span>
        <Link href={card.href as never} className="link-draw inline-flex items-center gap-1 font-medium text-maroon-700">
          {t("hall.openItem")} <ArrowRight className="size-3 flip-rtl" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function HallView({ hall, numerals }: { hall: KowHall; numerals?: string }) {
  const t = useTranslations("kow");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const current = hall.current;

  const readCurrent = async () => {
    if (!current || busy) return;
    setBusy(true);
    await kowPatch("read", current.id);
    setBusy(false);
    router.push(current.href as never);
  };

  return (
    <div className="mx-auto max-w-[1240px]" data-testid="hall-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">{t("hall.eyebrow")}</p>
          <h1 className="mt-1 text-3xl">{t("hall.title")}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-600">{t("hall.subtitle")}</p>
        </div>
        <Chip tone="gold" className="tnum">
          <Star className="size-3 text-gold-500" fill="currentColor" aria-hidden />
          {t("hall.count", { count: hall.total, n: formatNumber(hall.total, locale, { decimals: 0, numerals }) })}
        </Chip>
      </div>

      {current ? (
        <section
          className="relative mb-8 overflow-hidden rounded-[var(--radius-card)] border border-gold-300 bg-white p-6 shadow-[var(--shadow-pop)] sm:p-8"
          data-testid="hall-current"
          aria-label={t("hall.current")}
        >
          <span aria-hidden className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-gold-500" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Chip tone="maroon" className="mb-3">
                {t("hall.current")}
              </Chip>
              <KowCardBody card={current} size="featured" numerals={numerals} />
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-stretch">
              <Button onClick={readCurrent} loading={busy} data-testid="hall-read-now">
                {current.viewerRead ? t("readAgain") : t("readNow")}
              </Button>
              <span className="flex items-center justify-center gap-1.5 text-xs text-ink-600 tnum">
                <Users className="size-3.5 text-ink-400" aria-hidden />
                {t("readCount", { count: current.readCount, n: formatNumber(current.readCount, locale, { decimals: 0, numerals }) })}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {hall.canManage && hall.scheduled.length ? (
        <section className="mb-8" data-testid="hall-scheduled">
          <KowEyebrow className="mb-3">
            <CalendarClock className="size-3.5 text-ink-400" aria-hidden /> {t("hall.scheduled")}
          </KowEyebrow>
          <ul className="flex flex-wrap gap-2">
            {hall.scheduled.map((s) => (
              /* CR08 Phase C: the week label and a long title together ran
                 past a phone screen; the row may shrink and the title
                 truncates inside it. */
              <li key={s.id} className="min-w-0 max-w-full">
                <Link
                  href={s.href as never}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700"
                >
                  <span className="shrink-0 text-xs text-ink-600 tnum">
                    {t("weekOf", { date: formatDate(s.weekStart, locale, { style: "medium", numerals }) })}
                  </span>
                  <span className="min-w-0 max-w-72 truncate">{bi(locale, s.titleEn, s.titleAr)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hall.months.length ? (
        <div className="flex flex-col gap-8">
          {hall.months.map((m) => (
            <section key={m.key} data-testid="hall-month" data-month={m.key}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal" style={{ fontFamily: "inherit" }}>
                  {monthLabel(m.key, locale, numerals)}
                </h2>
                <span className="h-px min-w-6 flex-1 bg-sand-300" aria-hidden />
                <span className="text-xs text-ink-400 tnum">{formatNumber(m.items.length, locale, { decimals: 0, numerals })}</span>
              </div>
              <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.04}>
                {m.items.map((c) => (
                  <HallCard key={c.id} card={c} numerals={numerals} />
                ))}
              </Stagger>
            </section>
          ))}
        </div>
      ) : !current ? (
        <EmptyState icon={<Landmark />} title={t("hall.emptyTitle")} hint={t("hall.emptyHint")} className="mt-4" />
      ) : (
        <p className={cn("mt-2 text-sm text-ink-600")}>{t("hall.firstWeek")}</p>
      )}
    </div>
  );
}
