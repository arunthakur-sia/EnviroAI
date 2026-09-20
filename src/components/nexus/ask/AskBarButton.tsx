"use client";
// CR08 2.3: the solid "Ask NPC" button for the maroon top bar. White fill
// (--bar-ink) with maroon text and the sparkle glyph, the most prominent
// control after the search field. Opens the Ask NPC panel with the composer
// focused. The coordinator places it in AppShell right after <GlobalSearch />.
//
// Props:
//   className  extra classes for placement (margins) in the bar
//   showLabel  render the "Ask NPC" text beside the glyph (default true; pass
//              false for very narrow bars, the aria-label still names it)
import * as React from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAskPanel } from "./panel-store";

export function AskBarButton({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const t = useTranslations("askEverywhere");
  const { open } = useAskPanel();
  return (
    <button
      type="button"
      onClick={() => open({ focus: true })}
      aria-label={t("barButtonAria")}
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="ask-bar-button"
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-bar-ink px-3.5 text-sm font-semibold text-maroon-700 shadow-sm transition-colors hover:bg-maroon-50 hover:text-maroon-900 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 cursor-pointer",
        className
      )}
    >
      <Sparkles className="size-4 text-gold-500" aria-hidden />
      {showLabel ? <span className="whitespace-nowrap">{t("barButton")}</span> : null}
    </button>
  );
}
