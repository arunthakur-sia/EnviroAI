"use client";
// A real, reusable watermark overlay (ui-plan.md P4/P5), not a picture.
// pointer-events: none keeps it from blocking clicks, aria-hidden keeps it
// out of the accessibility tree, and it carries no classes that would hide
// it from print. One server timestamp only (no per-tile re-rendering), so
// the date never differs across the same page (P5). The parent element
// needs position: relative for this to anchor correctly.
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";

export function Watermark({ userName, stampedAt }: { userName: string; stampedAt: string }) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const stamp = `${userName} · ${formatDate(stampedAt, locale)} · ${t("sensitive.watermarkConfidential")}`;
  const tiles = Array.from({ length: 18 });
  return (
    <div
      aria-hidden
      data-testid="ncec-watermark"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <div
        className="grid grid-cols-2 gap-x-10 gap-y-16 p-6 opacity-[0.09] md:grid-cols-3"
        style={{ transform: "rotate(-22deg) scale(1.35)" }}
      >
        {tiles.map((_, i) => (
          <span key={i} className="whitespace-nowrap text-sm font-semibold text-amber-700" dir="ltr">
            {stamp}
          </span>
        ))}
      </div>
    </div>
  );
}
