"use client";
// CR03 1.2 built the books; CR04 1 rebuilt the hover: pull, turn, preview.
// Each book is a real 3D object (spine, hinged cover, 4px page slab, its own
// shadow) inside a shelf with perspective. Hover (after a 40ms intent window)
// pulls the book forward and up, turns it 22 degrees about the fore-edge so
// the hinged cover comes into view, parts the neighbours, deepens the shadow,
// and raises a preview card. Transform and opacity only; nothing waits on the
// network. Touch uses a two-tap model; keyboard focus pulls, Enter opens,
// Escape returns the book.
import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, Check, BookOpen, FolderPlus, Loader2 } from "lucide-react";
import { cn, bi, initialsOf } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Button, ClassificationChip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";

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
  /** CR08 9.1: set when the owner still holds an account, so the preview card
      can raise the person card. Name and colour stay on their own for the
      shelves that build a ShelfDoc without a user behind it. */
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  ownerColor?: string | null;
  publishYear?: number | null;
  pageCount?: number | null;
  updatedAt?: string | null;
  reuseCount?: number;
  viewCount?: number;
  processing?: boolean;
  deliverableCode?: string | null;
  /** CR08 8: this week's Knowledge of the Week wears an aqua ribbon */
  kow?: boolean;
};

/* CR03 1.3: the Library palette. Cloth colours by knowledge type; the light
   cloth is the only one with dark text. */
const CLOTH: Record<string, { color: string; darkText?: boolean }> = {
  strategy: { color: "#173044" },
  policy: { color: "#0f2230" },
  standard: { color: "#0f2230" },
  report: { color: "#077c84" },
  study: { color: "#077c84" },
  statistical_release: { color: "#455669" },
  dataset: { color: "#455669" },
  guideline: { color: "#1f4a5a" },
  template: { color: "#1f4a5a" },
  presentation: { color: "#2b3f63" },
  speech: { color: "#2b3f63" },
  minutes: { color: "#5a6b82" },
  circular: { color: "#5a6b82" },
  deliverable: { color: "#9fb3c8", darkText: true },
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
  const cloth = CLOTH[doc.typeCode ?? ""] ?? { color: "#455669" };
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

const PAPER = "#f8fafd";
const PREVIEW_W = 320;

function isTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
}

/* ------------------------------------------------------------------ */
/* The preview card (CR04 1.4): all data from the shelf payload         */
/* ------------------------------------------------------------------ */

function BookPreview({
  doc,
  pos,
  onPointerEnter,
  onPointerLeave,
}: {
  doc: ShelfDoc;
  pos: { x: number; y: number; below: boolean };
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("vault");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const cloth = clothFor(doc);
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const typeName = bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");
  const owner = bi(locale, doc.ownerName ?? "", doc.ownerNameAr ?? doc.ownerName ?? "");
  const [saving, setSaving] = React.useState(false);
  const [collections, setCollections] = React.useState<
    { id: string; nameEn: string; nameAr: string }[] | null
  >(null);

  async function openCollections() {
    if (collections) {
      setCollections(null);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/collections");
      const json = await res.json();
      setCollections(json.data ?? []);
    } catch {
      setCollections([]);
    } finally {
      setSaving(false);
    }
  }

  async function saveTo(collectionId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectionId, resourceType: "document", resourceId: doc.id }),
      });
      if (res.ok) toast(t("preview.saved"), "success");
      else toast(tc("error"), "error");
    } catch {
      toast(tc("error"), "error");
    } finally {
      setSaving(false);
      setCollections(null);
    }
  }

  return createPortal(
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={cn(
        "card fixed z-[70] p-3.5 shadow-[var(--shadow-pop)]",
        pos.below ? "book-preview-below" : "book-preview-above"
      )}
      style={{ left: pos.x, top: pos.y, width: PREVIEW_W }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocusCapture={onPointerEnter}
      data-testid="book-preview"
    >
      <div className="flex gap-3">
        {/* a 48 by 64 miniature of the cover face */}
        <span
          aria-hidden
          className="relative block shrink-0 overflow-hidden rounded-[3px]"
          style={{
            width: 48,
            height: 64,
            background: cloth.cover,
            boxShadow: "inset 0 0 6px rgba(0,0,0,0.14), 0 1px 3px rgba(30,27,31,0.25)",
          }}
        >
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: cloth.dark }} />
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: cloth.dark }} />
          <span
            className="absolute inset-x-1 rounded-[2px]"
            style={{
              top: 8,
              height: 34,
              // cool book paper: an object colour, pinned as an object colour
              background: PAPER,
              border: "1px solid #d5dce8",
            }}
          />
          <span className="absolute inset-y-0 start-0 w-1" style={{ background: cloth.base }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-600">
            {typeName}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-ink-900">{title}</p>
        </div>
      </div>
      {summary ? (
        <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-ink-600">{summary}</p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-600">
        {/* CR08 9.1: a spine is 40 to 64px of cloth with the title running up
            it, so the owner lives on the preview instead, where the name has
            room and the person card can open from it */}
        {doc.ownerUserId && doc.ownerName ? (
          <OwnerControlCompact
            owner={{
              id: doc.ownerUserId,
              nameEn: doc.ownerName,
              nameAr: doc.ownerNameAr ?? doc.ownerName,
              avatarColor: doc.ownerColor ?? "navy",
            }}
            item={{ type: "document", id: doc.id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: `/vault/${doc.id}` }}
            className="min-w-0 max-w-[60%]"
          />
        ) : owner ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={owner} color={doc.ownerColor ?? "navy"} size={18} />
            <span className="truncate">{owner}</span>
          </span>
        ) : null}
        {doc.pageCount ? <span className="tnum shrink-0">{t("pages", { count: doc.pageCount })}</span> : null}
        <ClassificationChip
          level={doc.classification}
          labels={
            [
              tc("classification.1"),
              tc("classification.2"),
              tc("classification.3"),
              tc("classification.4"),
            ] as [string, string, string, string]
          }
        />
        {doc.status === "verified" ? (
          <span className="flex items-center gap-1 text-teal-600">
            <Check className="size-3" /> {tc("verified")}
          </span>
        ) : null}
        {doc.updatedAt ? (
          <span className="tnum shrink-0">
            {t("preview.updated", { date: formatDate(doc.updatedAt, locale, { style: "short" }) })}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Link href={`/vault/${doc.id}`} className="flex-1">
          <Button size="sm" className="w-full">
            <BookOpen /> {t("preview.open")}
          </Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={openCollections} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <FolderPlus />} {t("preview.save")}
        </Button>
      </div>
      {collections ? (
        <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-mist-300 bg-mist-50">
          {collections.length ? (
            collections.map((c) => (
              <button
                key={c.id}
                onClick={() => saveTo(c.id)}
                className="block w-full truncate px-3 py-1.5 text-start text-xs text-ink-900 hover:bg-navy-100 cursor-pointer"
              >
                {bi(locale, c.nameEn, c.nameAr)}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-ink-600">{t("preview.noCollections")}</p>
          )}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* The book (CR04 1.2, 1.3)                                             */
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
  const tk = useTranslations("kow");
  const router = useRouter();
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const typeName = bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");

  const h = height ?? (index % 2 === 0 ? 216 : 184);
  const scale = Math.min(1, h / 200);
  const w = Math.round(spineWidth(doc.pageCount) * scale);
  const coverW = Math.round(120 * scale);
  const cloth = clothFor(doc);
  const ink = cloth.darkText ? "#0a151e" : PAPER;

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [pulled, setPulled] = React.useState(false);
  const [cardPos, setCardPos] = React.useState<{ x: number; y: number; below: boolean } | null>(null);
  const intentRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const pull = React.useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const below = rect.top < 430; // no room above: flip under the plank
      const x = Math.min(
        Math.max(rect.left + rect.width / 2, PREVIEW_W / 2 + 12),
        window.innerWidth - PREVIEW_W / 2 - 12
      );
      setCardPos({ x, y: below ? rect.bottom + 22 : rect.top - 14, below });
    }
    setPulled(true);
    // only one pulled book at a time, and the reader route warms up now
    window.dispatchEvent(new CustomEvent("sia:book:pull", { detail: { id: doc.id } }));
    try {
      router.prefetch(`/vault/${doc.id}` as never);
    } catch {
      /* prefetch is a hint */
    }
  }, [doc.id, router]);

  const release = React.useCallback(() => {
    if (intentRef.current) clearTimeout(intentRef.current);
    if (leaveRef.current) clearTimeout(leaveRef.current);
    setPulled(false);
  }, []);

  React.useEffect(() => {
    function onOtherPull(e: Event) {
      if ((e as CustomEvent).detail?.id !== doc.id) release();
    }
    window.addEventListener("sia:book:pull", onOtherPull);
    return () => window.removeEventListener("sia:book:pull", onOtherPull);
  }, [doc.id, release]);

  // touch: tapping elsewhere returns the book
  React.useEffect(() => {
    if (!pulled) return;
    function onDocDown(e: PointerEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      // CR08 9.1: the person card and its dialogs belong to this preview
      if (
        (target as HTMLElement).closest?.(
          '[data-testid="book-preview"], [data-testid="person-card-popover"], [role="dialog"]'
        )
      )
        return;
      release();
    }
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [pulled, release]);

  React.useEffect(() => () => release(), [release]);

  const cancelLeave = React.useCallback(() => {
    if (leaveRef.current) clearTimeout(leaveRef.current);
  }, []);
  const scheduleLeave = React.useCallback(() => {
    if (intentRef.current) clearTimeout(intentRef.current);
    if (leaveRef.current) clearTimeout(leaveRef.current);
    /* CR08 9.1: the person card opened from the preview is portalled to the
       body, and so are the message and question dialogs it opens, so the
       pointer moving onto them reads as a leave here and would take the
       preview, the card and the half-typed message down with it. Hold the
       book out while any of them is open and look again once it closes. */
    const tick = () => {
      if (document.querySelector('[data-testid="person-card-popover"], [role="dialog"][data-state="open"]')) {
        leaveRef.current = setTimeout(tick, 300);
        return;
      }
      setPulled(false);
    };
    leaveRef.current = setTimeout(tick, 120);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("book-wrap", leaning && "origin-bottom")}
      style={leaning ? { transform: `rotate(${isRtl ? -4 : 4}deg)` } : undefined}
      data-pulled={pulled || undefined}
      data-testid="book"
      data-doc-id={doc.id}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelLeave();
        if (intentRef.current) clearTimeout(intentRef.current);
        // pointer intent: 40ms of continuous hover before the state applies
        intentRef.current = setTimeout(pull, 40);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        scheduleLeave();
      }}
    >
      {/* the shadow is its own element, animated independently (CR04 1.2) */}
      <span aria-hidden className="book-shadow" />

      <Link
        href={`/vault/${doc.id}`}
        aria-label={`${title}${doc.status === "verified" ? ` (${t("verifiedSeal")})` : ""}${doc.kow ? ` (${tk("ribbonAria")})` : ""}`}
        aria-expanded={pulled}
        className="book rounded-t-[3px] rounded-b-[2px] outline-none"
        style={{ width: w, height: h }}
        onFocus={() => {
          cancelLeave();
          pull();
        }}
        onBlur={scheduleLeave}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            release();
            (e.target as HTMLElement).blur();
          }
        }}
        onClick={(e) => {
          // touch: first tap pulls, the second tap (or Open) navigates
          if (isTouch() && !pulled) {
            e.preventDefault();
            pull();
          }
        }}
      >
        {/* ---- the spine (front face at rest) ---- */}
        <span
          className={cn(
            "absolute inset-0 block rounded-t-[3px] rounded-b-[2px]",
            doc.processing && "book-processing"
          )}
          style={{
            background: cloth.base,
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)",
            boxShadow: isRtl
              ? "inset -3px 0 6px rgba(0,0,0,0.18)"
              : "inset 3px 0 6px rgba(0,0,0,0.18)",
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 rounded-t-[3px]" style={{ background: cloth.dark }} />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 rounded-b-[2px]" style={{ background: cloth.dark }} />
          <span aria-hidden className="absolute inset-x-1 h-px" style={{ top: 14, background: "rgba(0, 222, 204,0.7)" }} />
          <span aria-hidden className="absolute inset-x-1 h-px" style={{ bottom: 14, background: "rgba(0, 222, 204,0.7)" }} />

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

          {h >= 150 ? (
            <span aria-hidden className="absolute inset-x-0 bottom-2.5 flex flex-col items-center gap-0.5" style={{ color: ink }}>
              {doc.publishYear ? (
                <span className="tnum" style={{ fontSize: 9, opacity: 0.85 }}>
                  {doc.publishYear}
                </span>
              ) : null}
              <span style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 600, letterSpacing: "0.08em", opacity: 0.75 }}>
                the Office
              </span>
            </span>
          ) : null}

          {doc.status === "verified" ? (
            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: 14,
                height: 14,
                insetInlineStart: "50%",
                bottom: h >= 150 ? 40 : 18,
                transform: "translateX(-50%)",
                background: "var(--color-aqua-500)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
              aria-hidden
            >
              <Check className="size-2.5 text-white" strokeWidth={3.5} />
            </span>
          ) : null}

          {/* CR08 8: a small aqua ribbon hangs over the head of this week's pick */}
          {doc.kow ? (
            <span
              aria-hidden
              data-testid="book-kow-ribbon"
              className="absolute"
              style={{
                top: -3,
                insetInlineEnd: 5,
                width: 9,
                height: h >= 150 ? 28 : 20,
                background: "var(--color-aqua-500)",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
              }}
            />
          ) : null}
        </span>

        {/* ---- the page slab: 4px of paper between spine and cover ---- */}
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5"
          style={{
            width: 5,
            insetInlineEnd: 0,
            transform: isRtl ? "rotateY(90deg)" : "rotateY(-90deg)",
            transformOrigin: isRtl ? "0% 50%" : "100% 50%",
            background:
              "repeating-linear-gradient(to bottom, #eef2f8 0 2px, #dfe5ef 2px 3px), " + PAPER,
          }}
        />

        {/* ---- the cover, hinged along the fore-edge (CR04 1.3) ---- */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 overflow-hidden rounded-[2px]"
          style={{
            width: coverW,
            height: h,
            insetInlineEnd: 0,
            transform: isRtl
              ? "translateZ(-4px) rotateY(90deg)"
              : "translateZ(-4px) rotateY(-90deg)",
            transformOrigin: isRtl ? "0% 50%" : "100% 50%",
            background: cloth.base,
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)",
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.12)",
          }}
        >
          <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: cloth.dark }} />
          <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: cloth.dark }} />
          <span className="absolute inset-x-1.5 h-px" style={{ top: 14, background: "rgba(0, 222, 204,0.7)" }} />
          <span className="absolute inset-x-1.5 h-px" style={{ bottom: 14, background: "rgba(0, 222, 204,0.7)" }} />

          {/* the viewer sees the plane's back face; mirror the content back */}
          <span
            className="absolute inset-0 block"
            style={{ transform: "scaleX(-1)" }}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* paper title plate in the upper two thirds */}
            <span
              className="absolute inset-x-2 flex flex-col gap-1 overflow-hidden rounded-[3px] px-2 py-2"
              style={{
                top: 20,
                height: Math.round((h - 40) * 0.66),
                // cool book paper: an object colour, pinned as an object colour
                background: PAPER,
                border: "1px solid #d5dce8",
                boxShadow: "inset 0 2px 3px rgba(30,27,31,0.08)",
              }}
            >
              {typeName ? (
                <span
                  className="truncate font-semibold uppercase"
                  style={{ fontSize: 8, letterSpacing: "0.1em", color: "var(--color-ink-600)" }}
                >
                  {typeName}
                </span>
              ) : null}
              <span
                className="line-clamp-3 font-semibold leading-snug"
                style={{
                  fontSize: 15 * Math.max(0.72, scale),
                  fontFamily: isRtl ? "var(--font-kufi)" : "var(--font-display)",
                  color: "var(--color-ink-900)",
                }}
              >
                {title}
              </span>
              {summary ? (
                <span
                  className="line-clamp-2 leading-snug"
                  style={{ fontSize: 11 * Math.max(0.72, scale), color: "var(--color-ink-600)" }}
                >
                  {summary}
                </span>
              ) : null}
              {doc.publishYear ? (
                <span className="mt-auto tnum" style={{ fontSize: 9, color: "var(--color-ink-600)" }}>
                  {doc.publishYear}
                </span>
              ) : null}
            </span>
            {/* below the plate: the the Office mark and the seal */}
            <span
              className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2"
              style={{ color: cloth.darkText ? "#0a151e" : PAPER }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.8 }}>
                the Office
              </span>
              {doc.status === "verified" ? (
                <span
                  className="flex size-3.5 items-center justify-center rounded-full"
                  style={{ background: "var(--color-aqua-500)" }}
                >
                  <Check className="size-2.5 text-white" strokeWidth={3.5} />
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </Link>

      {pulled && cardPos ? (
        <BookPreview
          doc={doc}
          pos={cardPos}
          onPointerEnter={cancelLeave}
          onPointerLeave={scheduleLeave}
        />
      ) : null}
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
            className="absolute start-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-mist-300 bg-white/95 p-1.5 text-ink-600 opacity-0 shadow-sm transition-opacity hover:text-navy-700 group-hover/shelf:opacity-100 focus-visible:opacity-100 cursor-pointer"
          >
            <ChevronLeft className="size-4 flip-rtl" />
          </button>
        ) : null}
        {overflow.end ? (
          <button
            onClick={() => scrollBy(1)}
            aria-label={t("scrollForward")}
            className="absolute end-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-mist-300 bg-white/95 p-1.5 text-ink-600 opacity-0 shadow-sm transition-opacity hover:text-navy-700 group-hover/shelf:opacity-100 focus-visible:opacity-100 cursor-pointer"
          >
            <ChevronRight className="size-4 flip-rtl" />
          </button>
        ) : null}
        {/* fade masks at both ends */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 start-0 z-10 w-10 bg-gradient-to-r from-mist-50 to-transparent transition-opacity rtl:bg-gradient-to-l",
            overflow.start ? "opacity-100" : "opacity-0"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 end-0 z-10 w-10 bg-gradient-to-l from-mist-50 to-transparent transition-opacity rtl:bg-gradient-to-r",
            overflow.end ? "opacity-100" : "opacity-0"
          )}
        />

        {/* the shelf back: mist-100 with a very faint vertical grain */}
        <div
          className="rounded-t-lg"
          style={{
            background:
              "repeating-linear-gradient(to right, rgba(10, 21, 30,0.016) 0 1px, transparent 1px 7px), var(--color-mist-100)",
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
              style={{ minWidth: "min-content" }}
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

        {/* the plank: a 12px board with highlight, gradient, and shadow
            (CR05 1.2: the board is --plank with a --plank-edge bottom line) */}
        <div className="relative">
          <div
            className="h-3 rounded-[3px]"
            style={{
              background:
                "linear-gradient(180deg, #ffffff 0 1px, var(--color-plank) 1px 55%, var(--color-plank-edge) 100%)",
              boxShadow: "0 6px 12px -6px rgba(10, 21, 30,0.35)",
            }}
          />
          {/* shelf ends: 10px brackets */}
          <span
            aria-hidden
            className="absolute bottom-0 start-0 w-2.5 rounded-t-[2px]"
            style={{ height: 34, background: "var(--color-plank-edge)", boxShadow: "0 6px 8px -5px rgba(10, 21, 30,0.3)" }}
          />
          <span
            aria-hidden
            className="absolute bottom-0 end-0 w-2.5 rounded-t-[2px]"
            style={{ height: 34, background: "var(--color-plank-edge)", boxShadow: "0 6px 8px -5px rgba(10, 21, 30,0.3)" }}
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
  const ink = cloth.darkText ? "#0a151e" : PAPER;

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
      <span aria-hidden className="absolute inset-x-3 h-px" style={{ top: 14, background: "rgba(0, 222, 204,0.7)" }} />
      <span aria-hidden className="absolute inset-x-3 h-px" style={{ bottom: 14, background: "rgba(0, 222, 204,0.7)" }} />

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
                style={{ background: "var(--color-aqua-500)" }}
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
