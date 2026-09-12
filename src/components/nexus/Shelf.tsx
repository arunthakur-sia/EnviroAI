"use client";
// CR03 1.2: books, not boxes. Every document renders as a physical book
// standing on a plank: cloth spine coloured by knowledge type, headbands,
// gold rules, a page block on the fore-edge, and a pull-off-the-shelf hover
// that reveals the front cover in 3D. The memorable idea of the product.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn, bi, initialsOf } from "@/lib/utils";

export type ShelfDoc = {
  id: string;
  titleEn: string;
  titleAr: string;
  summaryEn?: string | null;
  summaryAr?: string | null;
  typeCode?: string | null;
  typeNameEn?: string | null;
  typeNameAr?: string | null;
  classification: number;
  status: string;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  ownerColor?: string | null;
  publishYear?: number | null;
  pageCount?: number | null;
  reuseCount?: number;
  viewCount?: number;
  processing?: boolean;
  deliverableCode?: string | null;
};

/* CR03 1.3: the Library palette. Cloth colours by knowledge type; the sand
   cloth is the only one with dark text. */
const CLOTH: Record<string, { color: string; darkText?: boolean }> = {
  strategy: { color: "#7a1533" },
  policy: { color: "#23303f" },
  standard: { color: "#23303f" },
  report: { color: "#145c63" },
  study: { color: "#145c63" },
  statistical_release: { color: "#4a5563" },
  dataset: { color: "#4a5563" },
  guideline: { color: "#4f5a3a" },
  template: { color: "#4f5a3a" },
  presentation: { color: "#4e2a4c" },
  speech: { color: "#4e2a4c" },
  minutes: { color: "#6b4a2e" },
  circular: { color: "#6b4a2e" },
  deliverable: { color: "#b9a57f", darkText: true },
};

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Mixes a hex colour toward white (amount > 0) or black (amount < 0). */
function mix(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (to - c) * a);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

export function clothFor(doc: Pick<ShelfDoc, "typeCode" | "id">): {
  base: string;
  light: string;
  dark: string;
  cover: string;
  darkText: boolean;
} {
  const cloth = CLOTH[doc.typeCode ?? ""] ?? { color: "#4a5563" };
  // per-book lightness variance of +/- 6 percent by id hash (CR03 1.3)
  const variance = ((hashOf(doc.id) % 13) - 6) / 100;
  const base = mix(cloth.color, variance);
  return {
    base,
    light: mix(base, 0.14),
    dark: mix(base, -0.28),
    cover: mix(base, 0.32),
    darkText: cloth.darkText ?? false,
  };
}

function spineWidth(pageCount: number | null | undefined): number {
  if (!pageCount) return 52;
  if (pageCount < 30) return 40;
  if (pageCount <= 150) return 52;
  return 64;
}

const PAPER = "#fbf9f5";

/* ------------------------------------------------------------------ */
/* The book                                                            */
/* ------------------------------------------------------------------ */

export function Book({
  doc,
  index = 0,
  height,
  leaning = false,
}: {
  doc: ShelfDoc;
  index?: number;
  /** Fixed height variant (Home mini shelf 184, project mini shelf 140).
      When omitted, heights alternate tall 216 / short 184 along the shelf. */
  height?: number;
  leaning?: boolean;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("vault");
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const typeName = bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");
  const owner = bi(locale, doc.ownerName ?? "", doc.ownerNameAr ?? doc.ownerName ?? "");

  const h = height ?? (index % 2 === 0 ? 216 : 184);
  const scale = Math.min(1, h / 200);
  const w = Math.round(spineWidth(doc.pageCount) * scale);
  const cloth = clothFor(doc);
  const ink = cloth.darkText ? "#2b241c" : PAPER;
  const coverInk = cloth.darkText ? "#2b241c" : PAPER;

  return (
    <div
      className={cn(
        "group/book relative shrink-0 hover:z-10 focus-within:z-10",
        leaning && "origin-bottom"
      )}
      style={leaning ? { transform: `rotate(${isRtl ? -4 : 4}deg)` } : undefined}
      data-testid="book"
      data-doc-id={doc.id}
    >
      {/* the drop shadow lands on the plank and deepens on hover; it lives
          outside the 3D transform so filters cannot flatten the book */}
      <span
        aria-hidden
        className="absolute inset-x-0.5 bottom-0 h-2 rounded-full transition-all duration-200 group-hover/book:inset-x-0 group-hover/book:opacity-80"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30,27,31,0.45), transparent 70%)",
          filter: "blur(3px)",
          opacity: 0.6,
          transform: "translateY(4px)",
        }}
      />
      <Link
        href={`/vault/${doc.id}`}
        aria-label={`${title}${doc.status === "verified" ? ` (${t("verifiedSeal")})` : ""}`}
        className={cn(
          "relative block rounded-t-[3px] rounded-b-[2px] outline-none",
          "transition-transform duration-[160ms] ease-[var(--ease-paper)]",
          "group-hover/book:duration-[220ms] group-hover/book:[transform:translateY(-10px)_rotateY(var(--book-turn))]",
          "focus-visible:duration-[220ms] focus-visible:[transform:translateY(-10px)_rotateY(var(--book-turn))]",
          doc.processing && "book-processing"
        )}
        style={
          {
            width: w,
            height: h,
            transformStyle: "preserve-3d",
            "--book-turn": isRtl ? "14deg" : "-14deg",
            background: cloth.base,
            // vertical cloth texture at 4 percent opacity (CR03 1.2)
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)",
            boxShadow: [
              // curvature on the spine's outer edge
              isRtl
                ? "inset -3px 0 6px rgba(0,0,0,0.18)"
                : "inset 3px 0 6px rgba(0,0,0,0.18)",
              "0 10px 14px -10px rgba(30,27,31,0.45)",
            ].join(", "),
          } as React.CSSProperties
        }
      >
        {/* headbands: 6px darker band top and bottom */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 rounded-t-[3px]"
          style={{ background: cloth.dark }}
        />
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1.5 rounded-b-[2px]"
          style={{ background: cloth.dark }}
        />
        {/* two 1px gold rules, 14px from top and bottom */}
        <span
          aria-hidden
          className="absolute inset-x-1 h-px"
          style={{ top: 14, background: "rgba(201,162,77,0.7)" }}
        />
        <span
          aria-hidden
          className="absolute inset-x-1 h-px"
          style={{ bottom: 14, background: "rgba(201,162,77,0.7)" }}
        />
        {/* page block on the fore-edge side */}
        <span
          aria-hidden
          className="absolute bottom-1.5 top-1.5 w-[3px] rounded-[1px]"
          style={{
            insetInlineEnd: 0,
            background: PAPER,
            boxShadow: isRtl
              ? "1px 0 1px rgba(30,27,31,0.25)"
              : "-1px 0 1px rgba(30,27,31,0.25)",
          }}
        />

        {/* spine title, running along the spine */}
        <span
          className="absolute inset-x-0 flex justify-center overflow-hidden"
          style={{ top: 20, bottom: h > 150 ? 52 : 34 }}
        >
          <span
            lang={locale}
            className="line-clamp-2 max-h-full font-semibold"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontFamily: isRtl ? "var(--font-kufi)" : "var(--font-display)",
              fontSize: h >= 180 ? 13 : 11,
              lineHeight: 1.25,
              color: ink,
              textShadow: cloth.darkText ? "none" : "0 1px 0 rgba(0,0,0,0.25)",
              letterSpacing: "0.01em",
            }}
          >
            {title}
          </span>
        </span>

        {/* year above the NPC mark, near the bottom headband */}
        {h >= 150 ? (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-2.5 flex flex-col items-center gap-0.5"
            style={{ color: ink }}
          >
            {doc.publishYear ? (
              <span className="tnum" style={{ fontSize: 9, opacity: 0.85 }}>
                {doc.publishYear}
              </span>
            ) : null}
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                opacity: 0.75,
              }}
            >
              NPC
            </span>
          </span>
        ) : null}

        {/* verification seal: 14px gold circle with a check */}
        {doc.status === "verified" ? (
          <span
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: 14,
              height: 14,
              insetInlineStart: "50%",
              bottom: h >= 150 ? 40 : 18,
              transform: "translateX(-50%)",
              background: "var(--color-gold-500)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
            aria-hidden
          >
            <Check className="size-2.5 text-white" strokeWidth={3.5} />
          </span>
        ) : null}

        {/* the front cover face: hinged on the fore-edge, receding into the
            shelf; the book's turn reveals it toward the reader (CR03 1.2) */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 overflow-hidden rounded-[2px]"
          style={{
            width: 120 * scale,
            height: h,
            insetInlineEnd: 0,
            // extends backward from the fore-edge; the visible face is the
            // back face, so the content wrapper counter-mirrors it
            transform: isRtl ? "rotateY(90deg)" : "rotateY(-90deg)",
            transformOrigin: isRtl ? "0% 50%" : "100% 50%",
            background: cloth.cover,
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.12)",
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: cloth.dark }}
          />
          <span
            className="absolute inset-x-0 bottom-0 h-1.5"
            style={{ background: cloth.dark }}
          />
          <span
            className="absolute inset-x-1.5 h-px"
            style={{ top: 14, background: "rgba(201,162,77,0.7)" }}
          />
          <span
            className="absolute inset-x-1.5 h-px"
            style={{ bottom: 14, background: "rgba(201,162,77,0.7)" }}
          />
          <span
            className="absolute inset-x-0 flex flex-col gap-1 px-2"
            // the viewer sees the plane's back face; mirror the content back
            style={{ top: 22, bottom: 22, color: coverInk, transform: "scaleX(-1)" }}
          >
            {typeName ? (
              <span
                className="truncate"
                style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}
              >
                {typeName}
              </span>
            ) : null}
            <span
              className="line-clamp-3 font-semibold leading-snug"
              style={{
                fontSize: 10,
                fontFamily: isRtl ? "var(--font-kufi)" : "var(--font-display)",
              }}
            >
              {title}
            </span>
            {summary ? (
              <span className="line-clamp-3 leading-snug" style={{ fontSize: 8.5, opacity: 0.85 }}>
                {summary}
              </span>
            ) : null}
            <span className="mt-auto flex items-center justify-between" style={{ fontSize: 8.5 }}>
              {owner ? (
                <span
                  className="flex size-4 items-center justify-center rounded-full font-semibold"
                  style={{
                    background: cloth.darkText ? "rgba(43,36,28,0.14)" : "rgba(251,249,245,0.22)",
                    fontSize: 7,
                  }}
                >
                  {initialsOf(owner)}
                </span>
              ) : (
                <span />
              )}
              {doc.pageCount ? (
                <span className="tnum" style={{ opacity: 0.8 }}>
                  {t("pages", { count: doc.pageCount })}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The shelf: plank, brackets, grain, overflow scroll                  */
/* ------------------------------------------------------------------ */

export function Shelf({
  docs,
  label,
  labelAr,
  count,
  height,
  className,
}: {
  docs: ShelfDoc[];
  label?: string;
  labelAr?: string;
  count?: number;
  /** Fixed book height variant; omitted = alternating 216/184. */
  height?: number;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("vault");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = React.useState<{ start: boolean; end: boolean }>({
    start: false,
    end: false,
  });

  const measure = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) {
      setOverflow({ start: false, end: false });
      return;
    }
    // RTL scrollLeft runs negative in modern engines
    const pos = Math.abs(el.scrollLeft);
    setOverflow({ start: pos > 4, end: pos < max - 4 });
  }, []);

  React.useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, docs.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const sign = locale === "ar" ? -dir : dir;
    el.scrollBy({ left: sign * Math.round(el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className={cn("group/shelf mb-8", className)}>
      {label ? (
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-base font-medium">{locale === "ar" && labelAr ? labelAr : label}</h3>
          {count !== undefined ? <span className="text-xs text-ink-600 tnum">{count}</span> : null}
        </div>
      ) : null}
      <div className="relative">
        {/* arrows appear on hover of the shelf */}
        {overflow.start ? (
          <button
            onClick={() => scrollBy(-1)}
            aria-label={t("scrollBack")}
            className="absolute start-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-sand-300 bg-white/95 p-1.5 text-ink-600 opacity-0 shadow-sm transition-opacity hover:text-maroon-700 group-hover/shelf:opacity-100 focus-visible:opacity-100 cursor-pointer"
          >
            <ChevronLeft className="size-4 flip-rtl" />
          </button>
        ) : null}
        {overflow.end ? (
          <button
            onClick={() => scrollBy(1)}
            aria-label={t("scrollForward")}
            className="absolute end-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-sand-300 bg-white/95 p-1.5 text-ink-600 opacity-0 shadow-sm transition-opacity hover:text-maroon-700 group-hover/shelf:opacity-100 focus-visible:opacity-100 cursor-pointer"
          >
            <ChevronRight className="size-4 flip-rtl" />
          </button>
        ) : null}
        {/* fade masks at both ends */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 start-0 z-10 w-10 bg-gradient-to-r from-sand-50 to-transparent transition-opacity rtl:bg-gradient-to-l",
            overflow.start ? "opacity-100" : "opacity-0"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 end-0 z-10 w-10 bg-gradient-to-l from-sand-50 to-transparent transition-opacity rtl:bg-gradient-to-r",
            overflow.end ? "opacity-100" : "opacity-0"
          )}
        />

        {/* the shelf back: sand-100 with a very faint vertical grain */}
        <div
          className="rounded-t-lg"
          style={{
            background:
              "repeating-linear-gradient(to right, rgba(30,27,31,0.016) 0 1px, transparent 1px 7px), var(--color-sand-100)",
          }}
        >
          <div
            ref={scrollRef}
            onScroll={measure}
            className="overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ overscrollBehaviorX: "contain" }}
          >
            <div
              className="flex items-end gap-2.5 pt-4"
              style={{ perspective: "900px", minWidth: "min-content" }}
            >
              {docs.map((d, i) => (
                <Book
                  key={d.id}
                  doc={d}
                  index={i}
                  height={height}
                  leaning={i === docs.length - 1 && docs.length > 2}
                />
              ))}
            </div>
          </div>
        </div>

        {/* the plank: a 12px board with highlight, gradient, and shadow */}
        <div className="relative">
          <div
            className="h-3 rounded-[3px]"
            style={{
              background:
                "linear-gradient(180deg, var(--color-sand-100) 0 1px, var(--color-sand-300) 1px 55%, #d0c7b1 100%)",
              boxShadow: "0 6px 12px -6px rgba(30,27,31,0.35)",
            }}
          />
          {/* shelf ends: 10px brackets */}
          <span
            aria-hidden
            className="absolute bottom-0 start-0 w-2.5 rounded-t-[2px]"
            style={{ height: 34, background: "var(--color-sand-300)", boxShadow: "0 6px 8px -5px rgba(30,27,31,0.3)" }}
          />
          <span
            aria-hidden
            className="absolute bottom-0 end-0 w-2.5 rounded-t-[2px]"
            style={{ height: 34, background: "var(--color-sand-300)", boxShadow: "0 6px 8px -5px rgba(30,27,31,0.3)" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grid view: the front-cover design at 160 by 220 (CR03 1.4)          */
/* ------------------------------------------------------------------ */

export function KnowledgeCard({ doc }: { doc: ShelfDoc }) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const typeName = bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");
  const owner = bi(locale, doc.ownerName ?? "", doc.ownerNameAr ?? doc.ownerName ?? "");
  const cloth = clothFor(doc);
  const ink = cloth.darkText ? "#2b241c" : PAPER;

  return (
    <Link
      href={`/vault/${doc.id}`}
      className="group/cover relative block overflow-hidden rounded-[6px] outline-none transition-transform duration-200 ease-[var(--ease-paper)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5"
      style={{
        width: 160,
        height: 220,
        background: cloth.cover,
        boxShadow:
          "inset 0 0 16px rgba(0,0,0,0.10), 0 2px 4px rgba(30,27,31,0.12), 0 10px 20px -8px rgba(30,27,31,0.28)",
      }}
      aria-label={title}
      data-testid="book-cover"
    >
      {/* spine hint on the start edge */}
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-1.5"
        style={{ background: cloth.base, boxShadow: isRtl ? "-1px 0 2px rgba(0,0,0,0.2)" : "1px 0 2px rgba(0,0,0,0.2)" }}
      />
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: cloth.dark }} />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: cloth.dark }} />
      <span aria-hidden className="absolute inset-x-3 h-px" style={{ top: 14, background: "rgba(201,162,77,0.7)" }} />
      <span aria-hidden className="absolute inset-x-3 h-px" style={{ bottom: 14, background: "rgba(201,162,77,0.7)" }} />

      <span className="absolute inset-x-0 flex flex-col gap-1.5 px-3.5" style={{ top: 24, bottom: 24, color: ink }}>
        <span
          className="truncate"
          style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}
        >
          {typeName || " "}
        </span>
        <span
          className="line-clamp-3 font-semibold leading-snug"
          style={{ fontSize: 13.5, fontFamily: isRtl ? "var(--font-kufi)" : "var(--font-display)" }}
        >
          {title}
        </span>
        {summary ? (
          <span className="line-clamp-3 leading-snug" style={{ fontSize: 10, opacity: 0.85 }}>
            {summary}
          </span>
        ) : null}
        <span className="mt-auto flex items-center justify-between gap-2" style={{ fontSize: 10 }}>
          <span className="flex items-center gap-1.5">
            {owner ? (
              <span
                className="flex size-5 items-center justify-center rounded-full font-semibold"
                style={{
                  background: cloth.darkText ? "rgba(43,36,28,0.14)" : "rgba(251,249,245,0.22)",
                  fontSize: 8,
                }}
                aria-hidden
              >
                {initialsOf(owner)}
              </span>
            ) : null}
            {doc.status === "verified" ? (
              <span
                className="flex size-4 items-center justify-center rounded-full"
                style={{ background: "var(--color-gold-500)" }}
                aria-label={tc("verified")}
              >
                <Check className="size-2.5 text-white" strokeWidth={3.5} />
              </span>
            ) : null}
          </span>
          {doc.pageCount ? (
            <span className="tnum" style={{ opacity: 0.8 }}>
              {t("pages", { count: doc.pageCount })}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
