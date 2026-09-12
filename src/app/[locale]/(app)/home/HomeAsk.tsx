"use client";
// CR02 1.3.1: the Ask box is the only large element above the fold. Same
// composer as /ask; submitting starts an analyst conversation and lands on
// /ask/c/[id] with the answer streaming. The word of the day is one quiet
// caption line under the example chips, not a strip.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CornerDownLeft, MessageCircleQuestion } from "lucide-react";
import { Textarea } from "@/components/ui/primitives";

export type ExampleQuestion = { en: string; ar: string };

export function HomeAsk({
  examples,
  continueConversation,
  word,
}: {
  examples: ExampleQuestion[];
  continueConversation: { id: string; title: string } | null;
  word: { textEn: string; textAr: string; attributionEn: string | null; attributionAr: string | null } | null;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // three rotating examples: day-based offset so they change daily
  const rotating = React.useMemo(() => {
    if (!examples.length) return [];
    const day = Math.floor(Date.now() / 86400000);
    const out: ExampleQuestion[] = [];
    for (let i = 0; i < Math.min(3, examples.length); i++) {
      out.push(examples[(day + i * 5) % examples.length]);
    }
    return out;
  }, [examples]);

  function submit(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    router.push(`/ask/c/new?q=${encodeURIComponent(q.trim())}` as never);
  }

  return (
    <div className="mx-auto w-full max-w-3xl" data-testid="home-ask">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div className="card relative transition-shadow focus-within:shadow-[var(--shadow-lift)]">
          <MessageCircleQuestion className="pointer-events-none absolute start-4 top-4 size-5 text-maroon-500" />
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(query);
              }
            }}
            placeholder={t("askPlaceholder")}
            rows={2}
            className="min-h-28 border-0 bg-transparent ps-12 pe-13 pt-3.5 text-base shadow-none focus:ring-0 sm:min-h-16"
            aria-label={t("askPlaceholder")}
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="absolute bottom-3 end-3 rounded-lg bg-maroon-700 p-2 text-white transition-colors hover:bg-maroon-900 disabled:opacity-40 cursor-pointer"
            aria-label={t("askCta")}
          >
            <CornerDownLeft className="size-4 flip-rtl" />
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {rotating.map((ex, i) => {
          const text = locale === "ar" ? ex.ar : ex.en;
          return (
            <button
              key={i}
              onClick={() => setQuery(text)}
              className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-xs text-ink-600 transition-colors hover:border-maroon-300 hover:text-maroon-900 cursor-pointer"
            >
              {text}
            </button>
          );
        })}
        {continueConversation ? (
          <Link
            href={`/ask/c/${continueConversation.id}` as never}
            className="text-xs font-medium text-maroon-700 hover:underline"
          >
            {t("continueConversation", {
              title: continueConversation.title.slice(0, 40),
            })}
          </Link>
        ) : null}
      </div>
      {word ? (
        <p
          className="mx-auto mt-2.5 max-w-2xl truncate text-center text-xs text-ink-600"
          data-testid="word-caption"
        >
          {locale === "ar" ? word.textAr : word.textEn}
          {(word.attributionEn || word.attributionAr) ? (
            <span className="text-ink-400">
              {" "}· {locale === "ar" ? word.attributionAr ?? "" : word.attributionEn ?? ""}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
