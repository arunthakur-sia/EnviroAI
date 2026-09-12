"use client";
// Six generated "book cover" patterns in maroon, gulf, and gold.
import { useTranslations } from "next-intl";

const PALETTES: Record<string, { bg: string; fg: string; accent: string }> = {
  maroon: { bg: "#8A1538", fg: "#F6E7EC", accent: "#C9A24D" },
  gulf: { bg: "#0F6E76", fg: "#DFF1F2", accent: "#C9A24D" },
  gold: { bg: "#C9A24D", fg: "#5A0E24", accent: "#8A1538" },
};

export function CollectionCover({
  style,
  title,
  count,
}: {
  style: string;
  title: string;
  count?: number;
}) {
  const t = useTranslations("collections");
  const [tone, pattern] = style.split("-");
  const p = PALETTES[tone] ?? PALETTES.maroon;

  return (
    <div
      className="card-hover relative aspect-[3/4] overflow-hidden rounded-xl shadow-[var(--shadow-paper)]"
      style={{ background: p.bg }}
    >
      {/* spine edge */}
      <div className="absolute inset-y-0 start-0 w-1.5 bg-black/15" />
      <svg
        className="absolute inset-0 h-full w-full opacity-25"
        aria-hidden
        preserveAspectRatio="none"
        viewBox="0 0 100 133"
      >
        {pattern === "arc" ? (
          <>
            <circle cx="50" cy="20" r="34" fill="none" stroke={p.fg} strokeWidth="1.2" />
            <circle cx="50" cy="20" r="24" fill="none" stroke={p.accent} strokeWidth="1.2" />
            <circle cx="50" cy="20" r="14" fill="none" stroke={p.fg} strokeWidth="1.2" />
          </>
        ) : (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <path
                key={i}
                d={`M -10 ${i * 20 - 6} L 50 ${i * 20 - 26} L 110 ${i * 20 - 6}`}
                fill="none"
                stroke={i % 2 ? p.accent : p.fg}
                strokeWidth="1.4"
              />
            ))}
          </>
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p
          className="font-[family-name:var(--font-display)] text-base font-semibold leading-snug"
          style={{ color: p.fg }}
        >
          {title}
        </p>
        {count !== undefined ? (
          <p className="mt-1 text-[11px] tnum" style={{ color: p.fg, opacity: 0.75 }}>
            {t("itemCount", { count })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
