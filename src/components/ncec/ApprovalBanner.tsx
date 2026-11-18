"use client";
// The L3 approval banner (brief s8.3): scope, approver, expiry countdown,
// whether personal data is included, and a disabled "View audit log" link
// (the audit backend is out of scope for Step 1, ui-plan.md decision #10).
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { bi } from "@/lib/utils";
import type { CatalogueDataset } from "@/server/ncec/types";

export function ApprovalBanner({
  datasets,
  approverNameAr,
  approverNameEn,
  expiresAt,
  includePersonalData,
}: {
  datasets: CatalogueDataset[];
  approverNameAr: string | null;
  approverNameEn: string | null;
  expiresAt: string | null;
  includePersonalData: boolean;
}) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86400000)) : null;
  const scope = datasets.map((d) => bi(locale, d.nameEn, d.nameAr)).join(" · ") || "-";
  const approver = bi(locale, approverNameEn, approverNameAr) || "-";

  return (
    <div
      data-testid="ncec-approval-banner"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-100/70 px-4 py-3 text-xs text-amber-700"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="flex items-center gap-1.5 font-semibold text-amber-700">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {t("sensitive.approvalScope")}: <span className="font-normal">{scope}</span>
        </span>
        <span>
          {t("sensitive.approvalApprovedBy")}: <span className="font-medium">{approver}</span>
        </span>
        <span className="font-semibold">
          {daysLeft === null ? t("sensitive.approvalExpired") : t("sensitive.approvalExpires", { days: daysLeft })}
        </span>
        {!includePersonalData ? <span>{t("sensitive.approvalPersonalData")}</span> : null}
        <button
          type="button"
          disabled
          title={t("common.notAvailableStep1")}
          className="ms-auto cursor-not-allowed underline decoration-dotted opacity-60"
          data-testid="ncec-audit-log-link"
        >
          {t("common.viewAuditLog")}
        </button>
      </div>
    </div>
  );
}
