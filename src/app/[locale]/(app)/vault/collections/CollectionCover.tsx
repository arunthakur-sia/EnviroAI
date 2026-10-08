"use client";
// Six generated "book cover" patterns in navy, teal, and aqua.
import { colourKey } from "@/lib/colour-keys";
import { useTranslations } from "next-intl";

const PALETTES: Record<string, { bg: string; fg: string; accent: string }> = {
  navy: { bg: "#173044", fg: "#E6ECF4", accent: "#00DECC" },
  teal: { bg: "#077C84", fg: "#DCF4F4", accent: "#00DECC" },
  aqua: { bg: "#00DECC", fg: "#0A151E", accent: "#173044" },
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
  const p = PALETTES[colourKey(tone)] ?? PALETTES.navy;

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
