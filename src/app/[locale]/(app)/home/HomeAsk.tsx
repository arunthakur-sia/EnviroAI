"use client";
// CR01 3.2: the Ask box on Home. Same composer style as /ask; submitting starts
// an analyst conversation and lands on /ask/c/[id] with the answer streaming.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CornerDownLeft, MessageCircleQuestion } from "lucide-react";
import { Textarea } from "@/components/ui/primitives";

export type ExampleQuestion = { en: string; ar: string };

export function HomeAsk({
  examples,
  continueConversation,
}: {
  examples: ExampleQuestion[];
  continueConversation: { id: string; title: string } | null;
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
    <div className="card mb-6 p-5" data-testid="home-ask">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div className="relative">
          <MessageCircleQuestion className="pointer-events-none absolute start-3.5 top-3.5 size-5 text-maroon-500" />
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
            className="min-h-14 ps-11 pe-12 text-base"
            aria-label={t("askPlaceholder")}
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="absolute bottom-2.5 end-2.5 rounded-lg bg-maroon-700 p-2 text-white transition-colors hover:bg-maroon-900 disabled:opacity-40 cursor-pointer"
            aria-label={t("askCta")}
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>
      </form>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
            className="ms-auto text-xs font-medium text-maroon-700 hover:underline"
          >
            {t("continueConversation", {
              title: continueConversation.title.slice(0, 40),
            })}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
