"use client";
// CR03 4.4.3: the Daily challenge, now its own compact card. Question in
// Sora, three answer chips, and a 500ms Y-flip to the answer with the
// explanation, the points in gold, and a link to the source indicator.
// Answered state persists for the day; streak counter in the corner.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, Flame, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export type ChallengeCard = {
  id: string;
  quizQuestionEn: string | null;
  quizQuestionAr: string | null;
  options: { en: string; ar: string }[];
  explanationEn: string | null;
  explanationAr: string | null;
  indicator: { id: string; nameEn: string; nameAr: string } | null;
  answered: { chosenIndex: number; isCorrect: boolean } | null;
};

export function DailyChallenge({
  card,
  streak,
  quiet,
}: {
  card: ChallengeCard | null;
  streak: number;
  quiet: boolean;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const [flipped, setFlipped] = React.useState(Boolean(card?.answered));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    isCorrect: boolean;
    points: number;
    explanation: string;
  } | null>(
    card?.answered
      ? {
          isCorrect: card.answered.isCorrect,
          points: 0,
          explanation: bi(locale, card.explanationEn ?? "", card.explanationAr ?? ""),
        }
      : null
  );

  async function answer(index: number) {
    if (!card || result || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/daily-card/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, chosenIndex: index }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({
          isCorrect: json.data.isCorrect,
          points: json.data.points ?? 0,
          explanation: bi(locale, json.data.explanationEn ?? "", json.data.explanationAr ?? ""),
        });
        setFlipped(true);
        if (!quiet && json.data.points) {
          toast(
            json.data.isCorrect
              ? t("quizCorrectToast", { points: json.data.points })
              : t("quizWrongToast", { points: json.data.points }),
            "points"
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const question = card ? bi(locale, card.quizQuestionEn ?? "", card.quizQuestionAr ?? "") : "";

  return (
    <div className="relative h-full" style={{ perspective: 1100 }} data-testid="daily-challenge">
      <motion.div
        className="relative h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* front: the question */}
        <div
          className="bento-card absolute inset-0 flex flex-col p-5"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-ink-600" style={{ fontFamily: "inherit" }}>
            {t("dailyChallenge")}
            {streak > 0 && !quiet ? (
              <span className="flex items-center gap-1 font-medium normal-case tracking-normal text-warn tnum">
                <Flame className="size-3.5" aria-hidden /> {streak}
              </span>
            ) : null}
          </p>
          {card && question && card.options.length === 3 ? (
            <>
              <p
                className="leading-snug text-ink-900"
                style={{ fontFamily: locale === "ar" ? "var(--font-kufi)" : "var(--font-display)", fontSize: 18 }}
              >
                {question}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                {card.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={busy}
                    className="rounded-lg border border-mist-300 bg-white px-2.5 py-1.5 text-xs text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-900 cursor-pointer disabled:cursor-default"
                  >
                    {bi(locale, option.en, option.ar)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ink-600">{t("challengeEmpty")}</p>
          )}
        </div>

        {/* back: the answer */}
        <div
          className="bento-card absolute inset-0 flex flex-col p-5"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-ink-600" style={{ fontFamily: "inherit" }}>
            {t("dailyChallenge")}
            <span className="flex items-center gap-1 normal-case tracking-normal">
              {result?.isCorrect ? (
                <Check className="size-4 text-ok" aria-hidden />
              ) : (
                <X className="size-4 text-danger" aria-hidden />
              )}
              <span className={cn("text-xs font-medium", result?.isCorrect ? "text-ok" : "text-danger")}>
                {result?.isCorrect ? t("challengeRight") : t("challengeWrong")}
              </span>
            </span>
          </p>
          <p className="line-clamp-4 text-sm leading-relaxed text-ink-900">{result?.explanation}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            {result?.points && !quiet ? (
              <span className="font-semibold text-aqua-500 tnum" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                +{result.points}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-ink-600">
                <Check className="size-3.5 text-ok" aria-hidden /> {t("challengeDone")}
              </span>
            )}
            {card?.indicator ? (
              <Link
                href={`/statistics/${card.indicator.id}` as never}
                className="link-draw text-xs font-medium text-navy-700"
              >
                {t("openIndicator", { name: bi(locale, card.indicator.nameEn, card.indicator.nameAr) })}
              </Link>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
