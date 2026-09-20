"use client";
// CR03 4.5: the Ask hero. A 64px input whose placeholder types out the seeded
// example questions letter by letter (35ms per character, 2.5s pause, delete,
// next), stopping the moment the user types. Two quiet suggestion chips
// rotate with the placeholder. Focus dims the constellation and draws a soft
// maroon glow; submitting expands the card into the answer workspace.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CornerDownLeft, MessageCircleQuestion } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useConnections } from "./connections";

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
  const reduced = useReducedMotion();
  const conn = useConnections();
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [placeholder, setPlaceholder] = React.useState("");
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const stopped = React.useRef(false);

  const texts = React.useMemo(
    () => examples.map((ex) => (locale === "ar" ? ex.ar : ex.en)).filter(Boolean),
    [examples, locale]
  );

  /* the typewriter placeholder cycle (CR03 4.5) */
  React.useEffect(() => {
    if (!texts.length || reduced) {
      setPlaceholder(texts[0] ?? t("askPlaceholder"));
      return;
    }
    let index = 0;
    let pos = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (stopped.current) return;
      const text = texts[index];
      if (!deleting) {
        pos++;
        setPlaceholder(text.slice(0, pos));
        if (pos >= text.length) {
          deleting = true;
          timer = setTimeout(tick, 2500);
          return;
        }
        timer = setTimeout(tick, 35);
      } else {
        pos -= 3;
        setPlaceholder(text.slice(0, Math.max(0, pos)));
        if (pos <= 0) {
          deleting = false;
          index = (index + 1) % texts.length;
          setExampleIndex(index);
          timer = setTimeout(tick, 300);
          return;
        }
        timer = setTimeout(tick, 18);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, reduced]);

  // typing by the user stops the cycle
  React.useEffect(() => {
    if (query) stopped.current = true;
  }, [query]);

  function submit(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setLeaving(true);
    // the input expands toward the workspace, then the route change carries on
    setTimeout(() => {
      router.push(`/ask/c/new?q=${encodeURIComponent(q.trim())}` as never);
    }, reduced ? 0 : 240);
  }

  /* two quiet suggestion chips rotating with the placeholder */
  const chips = React.useMemo(() => {
    if (!texts.length) return [];
    return [texts[(exampleIndex + 1) % texts.length], texts[(exampleIndex + 2) % texts.length]].filter(
      Boolean
    );
  }, [texts, exampleIndex]);

  return (
    <div className="w-full" data-testid="home-ask">
      <motion.form
        animate={
          leaving && !reduced ? { scale: 1.02, y: 6, opacity: 0.9 } : { scale: 1, y: 0, opacity: 1 }
        }
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div className="relative">
          {/* the soft radial glow when focused (CR03 4.2) */}
          <span
            aria-hidden
            /* CR08 Phase C: the glow used to reach 32px past the hero, which
               is 8px more than the page's own gutter, so every Home page
               carried a horizontal scrollbar for a decoration that is
               invisible until the box is focused. */
            className="pointer-events-none absolute -inset-5 rounded-full transition-opacity duration-300"
            style={{
              background: "radial-gradient(ellipse, var(--color-maroon-100), transparent 65%)",
              opacity: conn?.askFocused ? 1 : 0,
            }}
          />
          <div
            className="relative flex items-center rounded-2xl border border-sand-300 bg-white shadow-[var(--shadow-paper)] transition-all duration-200 focus-within:border-maroon-500 focus-within:shadow-[var(--shadow-lift)] focus-within:ring-2 focus-within:ring-maroon-100"
            style={{ height: 64 }}
          >
            <MessageCircleQuestion className="pointer-events-none ms-5 size-5 shrink-0 text-maroon-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => conn?.setAskFocused(true)}
              onBlur={() => conn?.setAskFocused(false)}
              placeholder={placeholder || t("askPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-base text-ink-900 placeholder:text-ink-400 focus:outline-none"
              aria-label={t("askPlaceholder")}
              data-testid="ask-input"
            />
            <button
              type="submit"
              disabled={busy || !query.trim()}
              className="me-3 rounded-xl bg-maroon-700 p-2.5 text-white transition-colors hover:bg-maroon-900 disabled:opacity-40 cursor-pointer"
              aria-label={t("askCta")}
            >
              <CornerDownLeft className="size-4 flip-rtl" />
            </button>
          </div>
        </div>
      </motion.form>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {chips.map((text, i) => (
          <button
            key={`${exampleIndex}-${i}`}
            onClick={() => {
              stopped.current = true;
              setQuery(text);
            }}
            className="max-w-full truncate rounded-lg border border-sand-200 bg-sand-50/80 px-2.5 py-1 text-xs text-ink-600 transition-colors hover:border-maroon-300 hover:text-maroon-900 cursor-pointer"
          >
            {text}
          </button>
        ))}
        {continueConversation ? (
          <Link
            href={`/ask/c/${continueConversation.id}` as never}
            className="link-draw text-xs font-medium text-maroon-700"
          >
            {t("continueConversation", { title: continueConversation.title.slice(0, 40) })}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
