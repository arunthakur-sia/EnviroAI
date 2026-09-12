"use client";
// "Did you know Qatar?": big count-up number, hook, three-option quiz that flips
// to reveal the answer, awards points, links to the indicator.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { CountUp } from "@/components/motion";
import { useToast } from "@/components/ui/toast";

type Card = {
  id: string;
  bigNumber: string | null;
  factEn: string;
  factAr: string;
  hookEn: string | null;
  hookAr: string | null;
  quizQuestionEn: string | null;
  quizQuestionAr: string | null;
  options: { en: string; ar: string }[];
  explanationEn: string | null;
  explanationAr: string | null;
  indicator: { id: string; nameEn: string; nameAr: string } | null;
  answered: { chosenIndex: number; isCorrect: boolean } | null;
};

export function DailyFactCard({ card, quiet }: { card: Card; quiet: boolean }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { toast } = useToast();
  const [result, setResult] = React.useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(
    card.answered
      ? {
          isCorrect: card.answered.isCorrect,
          correctIndex: card.answered.isCorrect ? card.answered.chosenIndex : -1,
          explanation: bi(locale, card.explanationEn ?? "", card.explanationAr ?? ""),
        }
      : null
  );
  const [chosen, setChosen] = React.useState<number | null>(card.answered?.chosenIndex ?? null);
  const [busy, setBusy] = React.useState(false);

  const numericValue = Number((card.bigNumber ?? "").replace(/[^\d.]/g, ""));
  const showCountUp = Number.isFinite(numericValue) && numericValue > 0;

  async function answer(index: number) {
    if (result || busy) return;
    setBusy(true);
    setChosen(index);
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
          correctIndex: json.data.correctIndex,
          explanation: bi(locale, json.data.explanationEn ?? "", json.data.explanationAr ?? ""),
        });
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

  return (
    <div className="card relative h-full overflow-hidden p-6" data-testid="daily-card">
      {/* soft weave accent */}
      <div
        className="pointer-events-none absolute -end-10 -top-10 h-44 w-44 rounded-full opacity-[0.06]"
        style={{
          background:
            "repeating-conic-gradient(var(--color-maroon-700) 0 12deg, transparent 12deg 24deg)",
        }}
        aria-hidden
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700">
        {t("didYouKnow")}
      </p>
      <p className="mt-3 font-[family-name:var(--font-display)] text-[52px] font-semibold leading-none tracking-tight text-maroon-900 tnum">
        {showCountUp ? (
          <CountUp
            value={numericValue}
            format={(v) =>
              card.bigNumber!.replace(/[\d,.]+/, Math.round(v).toLocaleString(locale === "ar" ? "ar-QA-u-nu-latn" : "en-US"))
            }
          />
        ) : (
          card.bigNumber
        )}
      </p>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-900">
        {bi(locale, card.factEn, card.factAr)}
      </p>
      {(card.hookEn || card.hookAr) ? (
        <p className="mt-1 text-sm text-ink-600">{bi(locale, card.hookEn ?? "", card.hookAr ?? "")}</p>
      ) : null}

      {card.quizQuestionEn && card.options.length === 3 ? (
        <div className="mt-5 border-t border-sand-100 pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-ink-900">
            <Sparkles className="size-4 text-gold-500" />
            {bi(locale, card.quizQuestionEn ?? "", card.quizQuestionAr ?? "")}
          </p>
          <div className="flex flex-wrap gap-2">
            {card.options.map((option, i) => {
              const isChosen = chosen === i;
              const isCorrect = result && result.correctIndex === i;
              const isWrongChoice = result && isChosen && !result.isCorrect;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={Boolean(result) || busy}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm transition-all cursor-pointer disabled:cursor-default",
                    isCorrect
                      ? "border-ok bg-ok-light font-medium text-ok"
                      : isWrongChoice
                        ? "border-danger bg-danger-light text-danger"
                        : isChosen
                          ? "border-maroon-700 bg-maroon-100 text-maroon-900"
                          : "border-sand-300 bg-white text-ink-900 hover:border-maroon-300 hover:-translate-y-px"
                  )}
                >
                  {isCorrect ? <Check className="size-3.5" /> : null}
                  {isWrongChoice ? <X className="size-3.5" /> : null}
                  {bi(locale, option.en, option.ar)}
                </button>
              );
            })}
          </div>
          {result ? (
            <p className="reveal mt-3 text-sm text-ink-600">
              {result.explanation}
              {card.indicator ? (
                <Link
                  href={`/statistics/${card.indicator.id}` as never}
                  className="ms-2 font-medium text-gulf-600 hover:underline"
                >
                  {t("openIndicator", {
                    name: bi(locale, card.indicator.nameEn, card.indicator.nameAr),
                  })}
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
