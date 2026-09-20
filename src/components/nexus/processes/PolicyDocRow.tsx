"use client";
// CR08 10.1: one policy, procedure, form or service as a row: a short book on
// its plank, the title into Institutional Memory, and the tab label, version,
// effective date, visibility and review-due chips beside it. Used by the
// by-unit and by-policy views and by the panel's document legend.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlarmClock } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/primitives";
import { Book } from "@/components/nexus/Shelf";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { PolicyDoc } from "@/server/services/operating-model";
import { SCOPE_TONE, toShelfDoc, unitHref, usePolicyTabLabels, useScopeLabels } from "./shared";

export function PolicyDocRow({
  doc,
  index = 0,
  showUnit = false,
  compact = false,
  className,
}: {
  doc: PolicyDoc;
  index?: number;
  /** name the unit the document is linked from */
  showUnit?: boolean;
  /** no book, for the panel legend */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("processes");
  const tc = useTranslations("common");
  const tp = useTranslations("people");
  const locale = useLocale();
  const tabLabels = usePolicyTabLabels();
  const scopeLabels = useScopeLabels();
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const alt = locale === "ar" ? doc.titleEn : doc.titleAr;
  const shelfDoc = toShelfDoc(doc, tabLabels);

  return (
    <div
      className={cn(compact ? "flex items-start gap-3 py-2" : "card flex items-start gap-3 p-3", className)}
      data-testid="policy-doc-row"
      data-doc-id={doc.id}
      data-tab={doc.tab}
    >
      {compact ? null : (
        <span className="flex shrink-0 flex-col items-center">
          <Book doc={shelfDoc} index={index} height={96} />
          <span
            aria-hidden
            className="mt-1 block h-1.5 w-12 rounded-[2px]"
            style={{ background: "linear-gradient(180deg, #ffffff 0 1px, var(--color-plank) 1px 55%, var(--color-plank-edge) 100%)" }}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/vault/${doc.id}`}
          aria-label={t("docs.open", { title })}
          className="link-draw block text-sm font-medium leading-snug text-ink-900 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          {title}
        </Link>
        {alt ? <p className="line-clamp-1 text-[11px] text-ink-400">{alt}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone="maroon">{tabLabels[doc.tab]}</Chip>
          {doc.versionLabel ? <Chip tone="sand">{t("docs.version", { version: doc.versionLabel })}</Chip> : null}
          {doc.effectiveFrom ? (
            <span className="text-[11px] text-ink-600 tnum">
              {t("docs.effective", { date: formatDate(doc.effectiveFrom, locale, { style: "medium" }) })}
            </span>
          ) : null}
          <Chip tone={SCOPE_TONE[doc.visibilityScope] ?? "sand"}>{scopeLabels[doc.visibilityScope] ?? doc.visibilityScope}</Chip>
          {doc.reviewDue ? (
            <Chip tone="warn">
              <AlarmClock className="size-3" aria-hidden />
              {t("docs.reviewDue")}
            </Chip>
          ) : null}
          {doc.status === "verified" ? <Chip tone="ok">{tc("verified")}</Chip> : null}
          {showUnit && doc.unit ? (
            <Link
              href={unitHref(doc.unit.code)}
              className="link-draw text-[11px] font-medium text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              {t("docs.linkedFrom", { unit: bi(locale, doc.unit.nameEn, doc.unit.nameAr) })}
            </Link>
          ) : null}
          {/* CR08 9.1: the custodian of the document, a sibling of the title
              link (the person card opens from a button, never inside a link) */}
          {doc.owner ? (
            <span className="inline-flex items-center gap-1.5" data-testid="policy-owner">
              <span className="text-[11px] text-ink-400">{tp("roles.custodian")}</span>
              <OwnerControlCompact
                owner={doc.owner}
                item={{ type: "policy", id: doc.id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: `/vault/${doc.id}` }}
              />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
