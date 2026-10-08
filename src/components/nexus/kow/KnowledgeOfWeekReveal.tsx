"use client";
// CR08 8: the first-open reveal. A light full-screen overlay that slides in
// over Home once per person per week: "Read now" marks the pick read and
// opens it, "Later", the close button, Escape or a click on the ground
// dismiss it, and every exit marks it seen so it is never shown again that
// week. Focus is trapped inside, the page behind does not scroll, the
// overlay is a modal dialog to assistive technology, and reduced motion
// skips the slide. It renders through a portal so no animated ancestor can
// turn `fixed` into a local box.
import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/primitives";
import type { KowCard } from "@/server/services/knowledge-of-week";
import { KowCardBody } from "./KowCardBody";
import { kowPatch } from "./client";

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function KnowledgeOfWeekReveal({ card, numerals }: { card: KowCard; numerals?: string }) {
  const t = useTranslations("kow");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const primaryRef = React.useRef<HTMLButtonElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    void kowPatch("seen", card.id);
  }, [card.id]);

  const readNow = React.useCallback(async () => {
    setOpen(false);
    await kowPatch("read", card.id);
    router.push(card.href as never);
  }, [card.href, card.id, router]);

  // focus in, scroll lock, focus back out
  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => primaryRef.current?.focus(), reduced ? 0 : 120);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = previous;
      restoreRef.current?.focus?.();
    };
  }, [open, reduced]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="kow-reveal"
          className="fixed inset-0 z-[80] overflow-y-auto bg-mist-50/95 backdrop-blur-md"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.22 }}
          onClick={dismiss}
          data-testid="kow-reveal"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kow-reveal-title"
              aria-describedby="kow-reveal-desc"
              className="relative rounded-[var(--radius-card)] border border-aqua-300 bg-white p-6 shadow-[var(--shadow-pop)] outline-none sm:p-9"
              initial={reduced ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: 12, transition: { duration: 0.18 } }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKeyDown}
              tabIndex={-1}
            >
              <span aria-hidden className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-aqua-500" />
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("reveal.close")}
                className="absolute end-4 top-4 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-mist-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-aqua-500 cursor-pointer"
                data-testid="kow-reveal-close"
              >
                <X className="size-4" />
              </button>

              <h2 id="kow-reveal-title" className="sr-only">
                {t("reveal.aria")}
              </h2>
              <div id="kow-reveal-desc" className="pe-8">
                <KowCardBody card={card} size="reveal" numerals={numerals} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button ref={primaryRef} size="lg" onClick={readNow} data-testid="kow-reveal-read">
                  {t("readNow")}
                </Button>
                <Button size="lg" variant="secondary" onClick={dismiss} data-testid="kow-reveal-later">
                  {t("later")}
                </Button>
                <span className="ms-auto text-xs text-ink-400">{t("reveal.hint")}</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
