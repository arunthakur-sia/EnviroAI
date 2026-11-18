"use client";
import { useLocale, useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { DatasetCatalogue } from "@/components/ncec/DatasetCatalogue";
import type { CorporateGroup } from "@/server/ncec/catalogue";

export function CorporateView({ groups }: { groups: CorporateGroup[] }) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  return (
    <div data-testid="ncec-corporate-page">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-100 text-navy-900">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl">{t("corporate.title")}</h1>
          <p className="text-sm text-ink-600">{t("corporate.subtitle")}</p>
        </div>
      </header>
      <DummyDataBanner />
      <p className="mb-5 max-w-2xl text-xs text-ink-600">{t("corporate.catalogueOnlyNote")}</p>
      <div className="flex flex-col gap-6" data-testid="ncec-corporate-groups">
        {groups.map((g) => (
          <section key={g.key} className="card p-4" aria-labelledby={`ncec-corp-${g.key}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={`ncec-corp-${g.key}`} className="text-lg">
                {bi(locale, g.deptNameEn, g.deptNameAr)}
              </h2>
              <Chip tone="mist">{t("corporate.datasetCount", { count: g.datasetCount })}</Chip>
            </div>
            <DatasetCatalogue datasets={g.datasets} />
          </section>
        ))}
      </div>
    </div>
  );
}
