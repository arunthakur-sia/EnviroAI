"use client";
// CR02 1.3.2: the Today row. Exactly three cards of identical size and internal
// structure: eyebrow label, title, body, one action. No motion beyond the page
// entrance; the quiz and play are user-triggered.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowRight, Check, Play, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { RagDot } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type FactCard = {
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

type Changed = {
  highlights: { kind: string; text_en: string; text_ar: string }[];
} | null;

type Episode = {
  id: string;
  titleEn: string;
  titleAr: string;
  durationSec: number;
  language: string;
  audioProvider: string;
  source: { en: string; ar: string } | null;
} | null;

function TodayCard({
  eyebrow,
  action,
  children,
  testId,
}: {
  eyebrow: string;
  action: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="card flex h-full min-h-56 flex-col p-5"
      data-testid={testId}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
        {eyebrow}
      </p>
      <div className="flex-1">{children}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2">{action}</div>
    </div>
  );
}

/* The podcast mark: a simple maroon waveform glyph drawn as SVG (CR02 1.4). */
export function WaveformMark({ className }: { className?: string }) {
  const bars = [7, 13, 19, 11, 16, 8, 14, 6];
  return (
    <svg
      viewBox="0 0 46 24"
      className={cn("text-maroon-700", className)}
      aria-hidden
      fill="currentColor"
    >
      {bars.map((h, i) => (
        <rect key={i} x={i * 6} y={12 - h / 2} width="3.2" height={h} rx="1.6" />
      ))}
    </svg>
  );
}

export function HomeToday({
  card,
  changed,
  episode,
  quiet,
}: {
  card: FactCard | null;
  changed: Changed;
  episode: Episode;
  quiet: boolean;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  /* Quiz state for the fact card */
  const [result, setResult] = React.useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(
    card?.answered
      ? {
          isCorrect: card.answered.isCorrect,
          correctIndex: card.answered.isCorrect ? card.answered.chosenIndex : -1,
          explanation: bi(locale, card.explanationEn ?? "", card.explanationAr ?? ""),
        }
      : null
  );
  const [chosen, setChosen] = React.useState<number | null>(
    card?.answered?.chosenIndex ?? null
  );
  const [busy, setBusy] = React.useState(false);

  async function answer(index: number) {
    if (!card || result || busy) return;
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

  function playEpisode() {
    if (!episode) return;
    window.dispatchEvent(
      new CustomEvent("sia:podcast:play", { detail: { id: episode.id } })
    );
  }

  const highlights = changed?.highlights.slice(0, 3) ?? [];
  const minutes = episode ? Math.max(1, Math.round(episode.durationSec / 60)) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="home-today">
      {/* Card 1: Did you know Qatar */}
      <TodayCard
        eyebrow={t("didYouKnow")}
        testId="daily-card"
        action={
          card ? (
            result ? (
              card.indicator ? (
                <Link
                  href={`/statistics/${card.indicator.id}` as never}
                  className="text-sm font-medium text-maroon-700 hover:underline"
                >
                  {t("openIndicator", {
                    name: bi(locale, card.indicator.nameEn, card.indicator.nameAr),
                  })}
                </Link>
              ) : (
                <span className="text-sm text-ink-600">{result.explanation}</span>
              )
            ) : card.quizQuestionEn && card.options.length === 3 ? (
              card.options.map((option, i) => {
                const isChosen = chosen === i;
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={busy}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer disabled:cursor-default",
                      isChosen
                        ? "border-maroon-700 bg-maroon-100 text-maroon-900"
                        : "border-sand-300 bg-white text-ink-900 hover:border-maroon-300"
                    )}
                  >
                    {bi(locale, option.en, option.ar)}
                  </button>
                );
              })
            ) : (
              card.indicator ? (
                <Link
                  href={`/statistics/${card.indicator.id}` as never}
                  className="text-sm font-medium text-maroon-700 hover:underline"
                >
                  {t("openIndicator", {
                    name: bi(locale, card.indicator.nameEn, card.indicator.nameAr),
                  })}
                </Link>
              ) : null
            )
          ) : (
            <Link
              href="/statistics"
              className="text-sm font-medium text-maroon-700 hover:underline"
            >
              {t("factEmptyAction")}
            </Link>
          )
        }
      >
        {card ? (
          <>
            {card.bigNumber ? (
              <p className="font-[family-name:var(--font-display)] text-[34px] font-semibold leading-tight tracking-tight text-maroon-900 tnum">
                {card.bigNumber}
              </p>
            ) : null}
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-900">
              {bi(locale, card.factEn, card.factAr)}
            </p>
            {result ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
                {result.isCorrect ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-danger" />
                )}
                {result.explanation}
              </p>
            ) : card.quizQuestionEn ? (
              <p className="mt-2 line-clamp-2 text-xs font-medium text-ink-600">
                {bi(locale, card.quizQuestionEn ?? "", card.quizQuestionAr ?? "")}
              </p>
            ) : (card.hookEn || card.hookAr) ? (
              <p className="mt-1 line-clamp-2 text-xs text-ink-600">
                {bi(locale, card.hookEn ?? "", card.hookAr ?? "")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-600">{t("factEmpty")}</p>
        )}
      </TodayCard>

      {/* Card 2: What changed in NDS3 */}
      <TodayCard
        eyebrow={t("whatChanged")}
        testId="what-changed"
        action={
          <Link
            href="/strategy"
            className="flex items-center gap-1 text-sm font-medium text-maroon-700 hover:underline"
          >
            {t("openStrategy")} <ArrowRight className="size-3.5 flip-rtl" />
          </Link>
        }
      >
        {highlights.length ? (
          <ul className="flex flex-col gap-2.5">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <RagDot
                  status={h.kind === "risk" ? "at_risk" : "on_track"}
                  className="mt-1.5"
                />
                <span className="line-clamp-2 text-sm leading-relaxed text-ink-900">
                  {locale === "ar" ? h.text_ar : h.text_en}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink-600">{t("changedEmpty")}</p>
        )}
      </TodayCard>

      {/* Card 3: NPC Nexus Podcast */}
      <TodayCard
        eyebrow={t("podcastEyebrow")}
        testId="podcast-card"
        action={
          episode ? (
            <>
              <button
                onClick={playEpisode}
                className="flex items-center gap-1.5 rounded-lg bg-maroon-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-maroon-900 cursor-pointer"
              >
                <Play className="size-3.5 fill-current" /> {t("podcastPlay")}
              </button>
              <Link
                href={"/podcast/new" as never}
                className="text-sm font-medium text-maroon-700 hover:underline"
              >
                {t("podcastMake")}
              </Link>
            </>
          ) : (
            <Link
              href={"/podcast/new" as never}
              className="flex items-center gap-1.5 rounded-lg bg-maroon-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-maroon-900"
            >
              {t("podcastMake")}
            </Link>
          )
        }
      >
        <WaveformMark className="h-6 w-12" />
        {episode ? (
          <>
            <p className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-ink-900">
              {bi(locale, episode.titleEn, episode.titleAr)}
            </p>
            <p className="mt-1.5 text-xs text-ink-600 tnum">
              {t("podcastMinutes", { minutes })}
              {episode.audioProvider === "browser" ? (
                <span className="ms-2">· {t("podcastBrowserVoice")}</span>
              ) : null}
            </p>
            {episode.source ? (
              <p className="mt-1 line-clamp-1 text-xs text-ink-600">
                {t("podcastFrom", { source: bi(locale, episode.source.en, episode.source.ar) })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
            {t("podcastEmpty")}
          </p>
        )}
      </TodayCard>
    </div>
  );
}
