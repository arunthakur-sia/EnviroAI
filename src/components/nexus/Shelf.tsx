"use client";
// The shelf metaphor: documents render as book spines. Hover tilts the spine and
// reveals a small cover with summary and owner. The memorable idea of the product.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, Eye, Recycle } from "lucide-react";
import { cn, bi, truncate } from "@/lib/utils";
import { Avatar, ClassificationChip } from "@/components/ui/primitives";

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
  ownerColor?: string | null;
  publishYear?: number | null;
  reuseCount?: number;
  viewCount?: number;
  processing?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  strategy: "bg-maroon-700",
  policy: "bg-maroon-500",
  guideline: "bg-gold-500",
  study: "bg-info",
  report: "bg-ink-600",
  statistical_release: "bg-gulf-600",
  dataset: "bg-gulf-400",
  presentation: "bg-maroon-300",
  minutes: "bg-ink-400",
  template: "bg-sand-300",
  speech: "bg-warn",
  circular: "bg-ok",
};

function spineColor(code?: string | null): string {
  return TYPE_COLORS[code ?? ""] ?? "bg-ink-600";
}

export function Spine({ doc, index = 0 }: { doc: ShelfDoc; index?: number }) {
  const locale = useLocale();
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const heights = ["h-40", "h-44", "h-42", "h-46", "h-40", "h-44"]; // subtle variation
  const h = heights[index % heights.length] ?? "h-44";

  return (
    <div className="group/spine relative shrink-0" style={{ perspective: "600px" }}>
      <Link
        href={`/vault/${doc.id}`}
        className={cn(
          "relative flex w-11 flex-col items-center justify-between rounded-t-[4px] rounded-b-[2px] px-1 pb-2 pt-2.5 text-white shadow-sm transition-transform duration-300 [transform-style:preserve-3d] group-hover/spine:[transform:rotateY(-8deg)_translateY(-4px)]",
          h,
          spineColor(doc.typeCode),
          doc.processing && "animate-pulse opacity-70"
        )}
        aria-label={title}
      >
        <span
          className={cn(
            "overflow-hidden text-[11px] font-medium leading-tight opacity-95",
            locale === "ar" ? "spine-title-rtl" : "spine-title-ltr"
          )}
          style={{ maxHeight: "calc(100% - 18px)" }}
        >
          {truncate(title, 42)}
        </span>
        {doc.status === "verified" ? (
          <BadgeCheck className="size-3.5 shrink-0 text-gold-300" aria-hidden />
        ) : (
          <span className="h-3.5" />
        )}
      </Link>

      {/* Cover reveal */}
      <div className="pointer-events-none invisible absolute bottom-full start-1/2 z-30 mb-2 w-64 -translate-x-1/2 rtl:translate-x-1/2 opacity-0 transition-all duration-200 group-hover/spine:visible group-hover/spine:opacity-100">
        <div className="card p-3.5 text-start shadow-[var(--shadow-pop)]">
          <p className="mb-1 line-clamp-2 text-sm font-medium text-ink-900">{title}</p>
          {summary ? (
            <p className="mb-2 line-clamp-3 text-xs leading-relaxed text-ink-600">{summary}</p>
          ) : null}
          <div className="flex items-center gap-2">
            {doc.ownerName ? (
              <>
                <Avatar name={doc.ownerName} color={doc.ownerColor ?? "maroon"} size={18} />
                <span className="truncate text-[11px] text-ink-600">{doc.ownerName}</span>
              </>
            ) : null}
            {doc.publishYear ? (
              <span className="ms-auto text-[11px] text-ink-400 tnum">{doc.publishYear}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Shelf({
  docs,
  label,
  labelAr,
  count,
}: {
  docs: ShelfDoc[];
  label?: string;
  labelAr?: string;
  count?: number;
}) {
  const locale = useLocale();
  return (
    <div className="mb-8">
      {label ? (
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-base font-medium">{locale === "ar" && labelAr ? labelAr : label}</h3>
          {count !== undefined ? <span className="text-xs text-ink-400 tnum">{count}</span> : null}
        </div>
      ) : null}
      <div className="relative">
        <div className="flex flex-wrap items-end gap-2 px-1 pb-1 pt-3">
          {docs.map((d, i) => (
            <Spine key={d.id} doc={d} index={i} />
          ))}
        </div>
        {/* the shelf itself */}
        <div className="h-1.5 rounded-full bg-gradient-to-b from-sand-300 to-sand-200 shadow-[0_2px_4px_rgba(30,27,31,0.08)]" />
      </div>
    </div>
  );
}

export function KnowledgeCard({ doc }: { doc: ShelfDoc }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const summary = bi(locale, doc.summaryEn ?? "", doc.summaryAr ?? "");
  const typeName = bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "");

  return (
    <Link
      href={`/vault/${doc.id}`}
      className="card card-hover flex h-full flex-col gap-2.5 p-4"
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-sm", spineColor(doc.typeCode))} aria-hidden />
        {typeName ? <span className="text-[11px] font-medium text-ink-600">{typeName}</span> : null}
        <span className="ms-auto flex items-center gap-1.5">
          {doc.status === "verified" ? (
            <BadgeCheck className="size-4 text-gulf-600" aria-label={t("verified")} />
          ) : null}
          <ClassificationChip
            level={doc.classification}
            labels={[
              t("classification.1"),
              t("classification.2"),
              t("classification.3"),
              t("classification.4"),
            ]}
          />
        </span>
      </div>
      <p className="line-clamp-2 font-medium leading-snug text-ink-900">{title}</p>
      {summary ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-600">{summary}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-1">
        {doc.ownerName ? (
          <>
            <Avatar name={doc.ownerName} color={doc.ownerColor ?? "maroon"} size={20} />
            <span className="truncate text-xs text-ink-600">{doc.ownerName}</span>
          </>
        ) : null}
        <span className="ms-auto flex items-center gap-3 text-[11px] text-ink-400">
          {doc.reuseCount ? (
            <span className="flex items-center gap-1 tnum">
              <Recycle className="size-3" /> {doc.reuseCount}
            </span>
          ) : null}
          {doc.viewCount ? (
            <span className="flex items-center gap-1 tnum">
              <Eye className="size-3" /> {doc.viewCount}
            </span>
          ) : null}
        </span>
      </div>
    </Link>
  );
}
