"use client";
// A real, reusable banner (ui-plan.md P4: never a picture of one). Shown on
// every NCEC page, in both locales. Every record behind it carries
// is_dummy = true in the database.
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

export function DummyDataBanner() {
  const t = useTranslations("ksaNcec");
  return (
    <div
      role="status"
      data-testid="ncec-dummy-banner"
      className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      {t("common.dummyBanner")}
    </div>
  );
}
