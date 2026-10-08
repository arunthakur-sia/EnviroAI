"use client";
// CR08 2.3: the floating Ask EnviroAI launcher. A navy pill at the bottom end
// corner of every page with a slow gold halo (3s breath, still under reduced
// motion), lifted above the mini-player while an episode plays, a round
// button under 640px, hidden while the panel is open. When the page declares
// an item (useAskContext) the pill widens into "Ask about this project" for
// three seconds, then settles back.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAskContext } from "./context-store";
import { askPanel, contextKey, useAskPanelOpen } from "./panel-store";

const EASE = [0.22, 1, 0.36, 1] as const;
const NUDGE_MS = 3000;

/** True while the CR02 mini-player bar is docked at the bottom of the shell.
 *  It announces itself on "sia:podcast:state" (id null once closed); the DOM
 *  check covers a launcher mounted after playback already started. */
function useMiniPlayerVisible(): boolean {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    setVisible(Boolean(document.querySelector('[data-testid="mini-player"]')));
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string | null }>).detail;
      setVisible(Boolean(detail?.id));
    };
    window.addEventListener("sia:podcast:state", onState);
    return () => window.removeEventListener("sia:podcast:state", onState);
  }, []);
  return visible;
}

export function AskLauncher() {
  const t = useTranslations("askEverywhere");
  const reduced = useReducedMotion();
  const open = useAskPanelOpen();
  const item = useAskContext();
  const miniPlayer = useMiniPlayerVisible();
  const [nudge, setNudge] = React.useState<string | null>(null);
  const key = item ? contextKey(item) : null;
  const kind = item?.kind ?? null;

  React.useEffect(() => {
    if (!key || !kind) {
      setNudge(null);
      return;
    }
    setNudge(t(`nudge.${kind}`));
    const timer = setTimeout(() => setNudge(null), NUDGE_MS);
    return () => clearTimeout(timer);
    // the nudge fires once per item identity, not on every title re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (open) return null;

  const label = nudge ?? t("launcher");

  return (
    <div
      className={cn(
        "fixed end-6 z-[62] transition-[bottom] duration-200",
        miniPlayer ? "bottom-[calc(3.5rem+1.25rem)]" : "bottom-6"
      )}
      data-testid="ask-launcher"
      data-nudge={nudge ? "true" : "false"}
      data-above-player={miniPlayer ? "true" : "false"}
    >
      {/* the gold halo: transform and opacity only, a 3 second breath */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-aqua-500"
        animate={
          reduced
            ? { scale: 1.14, opacity: 0.35 }
            : { scale: [1, 1.32, 1], opacity: [0.5, 0, 0.5] }
        }
        transition={
          reduced ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.button
        type="button"
        layout={!reduced}
        transition={{ duration: 0.24, ease: EASE }}
        onClick={() => askPanel.open({ focus: true })}
        aria-label={nudge ? `${t("launcherAria")}. ${nudge}` : t("launcherAria")}
        aria-keyshortcuts="Control+K Meta+K"
        data-testid="ask-launcher-button"
        className={cn(
          "relative flex items-center justify-center gap-2 rounded-full bg-navy-700 text-white shadow-[var(--shadow-lift)] transition-colors hover:bg-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500 cursor-pointer",
          "size-14 sm:h-12 sm:w-auto sm:px-5"
        )}
      >
        <Sparkles className="size-5 shrink-0 text-aqua-300" aria-hidden />
        <span className="hidden overflow-hidden sm:block">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              className="block whitespace-nowrap text-sm font-medium"
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
    </div>
  );
}
