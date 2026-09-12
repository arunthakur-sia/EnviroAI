"use client";
// The Ask landing composer: starts an analyst conversation.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CornerDownLeft } from "lucide-react";
import { Textarea } from "@/components/ui/primitives";

export function AskLanding({ examples }: { examples: { en: string; ar: string }[] }) {
  const t = useTranslations("askPage");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const rotating = React.useMemo(() => {
    if (!examples.length) return [];
    const day = Math.floor(Date.now() / 86400000);
    return [0, 1, 2].map((i) => examples[(day * 3 + i * 7) % examples.length]);
  }, [examples]);

  function submit(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    router.push(`/ask/c/new?q=${encodeURIComponent(q.trim())}` as never);
  }

  return (
    <div className="card p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div className="relative">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(query);
              }
            }}
            placeholder={t("placeholder")}
            rows={3}
            className="pe-12 text-base"
            aria-label={t("placeholder")}
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="absolute bottom-3 end-3 rounded-lg bg-maroon-700 p-2 text-white transition-colors hover:bg-maroon-900 disabled:opacity-40 cursor-pointer"
            aria-label={t("askCta")}
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {rotating.map((ex, i) => {
            const text = locale === "ar" ? ex.ar : ex.en;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setQuery(text)}
                className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1 text-xs text-ink-600 transition-colors hover:border-maroon-300 hover:text-maroon-900 cursor-pointer"
              >
                {text}
              </button>
            );
          })}
          <p className="ms-auto text-[11px] text-ink-400">{t("groundedHint")}</p>
        </div>
      </form>
    </div>
  );
}
