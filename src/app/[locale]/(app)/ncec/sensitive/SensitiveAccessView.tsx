"use client";
// Shown to an L2 visitor with no active L3 grant: the datasets they could
// request, locked, and nothing about what those datasets actually hold
// (brief s6: no field or record counts for a fully-locked dataset).
import { useLocale, useTranslations } from "next-intl";
import { Lock, ShieldAlert } from "lucide-react";
import { bi } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import type { CatalogueDataset } from "@/server/ncec/types";

export function SensitiveAccessView({ datasets }: { datasets: CatalogueDataset[] }) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  return (
    <div data-testid="ncec-sensitive-access-page">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl">{t("sensitive.title")}</h1>
          <p className="text-sm text-ink-600">{t("access.title")}</p>
        </div>
      </header>
      <DummyDataBanner />
      <section className="card p-5">
        <p className="mb-4 max-w-2xl text-sm text-ink-700">{t("access.body")}</p>
        <div className="flex flex-col gap-2" data-testid="ncec-sensitive-requestable">
          {datasets.map((d) => (
            <div key={d.datasetId} className="flex items-center justify-between gap-3 rounded-lg border border-mist-300 bg-mist-50 px-3.5 py-2.5">
              <span className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
                <Lock className="size-4 text-ink-400" aria-hidden />
                {bi(locale, d.nameEn, d.nameAr)}
              </span>
              <Button variant="secondary" size="sm" disabled title={t("common.notAvailableStep1")}>
                {t("common.requestAccess")}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
