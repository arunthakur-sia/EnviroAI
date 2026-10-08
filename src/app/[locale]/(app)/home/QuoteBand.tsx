"use client";
// CR03 4.4.1: Words that guide us. A full-width editorial band: navy wash
// fading to sand from the start side, an aqua hairline, the quote in Sora
// italic (Kufi in Arabic), the speaker's monogram circle, and a quiet arrow
// that crossfades to the next quote; the day's quote also changes at midnight.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { bi, initialsOf } from "@/lib/utils";

export type Quote = {
  textEn: string;
  textAr: string;
  attributionEn: string | null;
  attributionAr: string | null;
  sourceRef: string | null;
};

export function QuoteBand({ quotes }: { quotes: Quote[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const dayIndex = Math.floor(Date.now() / 86400000);
  const [offset, setOffset] = React.useState(0);
  const [dayBase, setDayBase] = React.useState(dayIndex);

  // crossfade to the next quote at midnight (CR03 4.4.1)
  React.useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0);
    const timer = setTimeout(
      () => setDayBase(Math.floor(Date.now() / 86400000)),
      midnight.getTime() - now.getTime()
    );
    return () => clearTimeout(timer);
  }, [dayBase]);

  if (!quotes.length) return null;
  const index = ((dayBase + offset) % quotes.length + quotes.length) % quotes.length;
  const quote = quotes[index];
  const attribution = bi(locale, quote.attributionEn ?? "", quote.attributionAr ?? "");

  return (
    <section
      className="relative flex min-h-40 items-center overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(to ${locale === "ar" ? "left" : "right"}, var(--color-navy-100), var(--color-mist-100) 55%, var(--color-mist-50))`,
      }}
      aria-label={t("quoteEyebrow")}
      data-testid="quote-band"
    >
      {/* aqua hairline rule */}
      <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-aqua-500/70" />
      <div className="flex w-full items-center gap-5 px-7 py-6">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy-700 text-sm font-semibold text-white"
        >
          {initialsOf(attribution || "the Office")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-900/70" style={{ fontFamily: "inherit" }}>
            {t("quoteEyebrow")}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.blockquote
              key={index}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p
                className={
                  locale === "ar"
                    ? "text-[17px] leading-snug text-ink-900 sm:text-2xl"
                    : "text-[17px] italic leading-snug text-ink-900 sm:text-[26px]"
                }
                style={{
                  fontFamily: locale === "ar" ? "var(--font-kufi)" : "var(--font-display)",
                }}
              >
                {"“"}
                {bi(locale, quote.textEn, quote.textAr)}
                {"”"}
              </p>
              <footer className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-600">
                <span className="font-medium text-ink-900">{attribution}</span>
                {quote.sourceRef ? (
                  <span className="text-xs text-ink-600">
                    {t("quoteSource")}: {quote.sourceRef}
                  </span>
                ) : null}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>
        <button
          onClick={() => setOffset((v) => v + 1)}
          aria-label={t("quoteNext")}
          className="shrink-0 rounded-full border border-mist-300 bg-white/70 p-2 text-ink-600 transition-colors hover:border-navy-300 hover:text-navy-700 cursor-pointer"
        >
          <ChevronRight className="size-4 flip-rtl" />
        </button>
      </div>
    </section>
  );
}
