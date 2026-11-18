"use client";
// The dataset catalogue grid (brief s8.2): an open card links to the
// generic dataset view; a fully-locked dataset shows only its title and a
// disabled "Request access" (ui-plan.md decision #10 — the grant workflow
// itself is out of scope for Step 1).
import { useLocale, useTranslations } from "next-intl";
import { Database, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import type { CatalogueDataset } from "@/server/ncec/types";

export function DatasetCatalogue({ datasets }: { datasets: CatalogueDataset[] }) {
  const locale = useLocale();
  const t = useTranslations("ksaNcec");
  if (!datasets.length) return <p className="text-sm text-ink-600">{t("common.noResults")}</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="ncec-catalogue">
      {datasets.map((d) => (
        <DatasetCard key={d.datasetId} d={d} locale={locale} t={t} />
      ))}
    </div>
  );
}

function DatasetCard({
  d,
  locale,
  t,
}: {
  d: CatalogueDataset;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const name = bi(locale, d.nameEn, d.nameAr);
  if (d.locked) {
    return (
      <div
        className="card flex items-center justify-between gap-3 p-3.5"
        data-testid={`ncec-dataset-${d.datasetId}`}
        data-locked="1"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-mist-100 text-ink-400">
            <Lock className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-ink-700">{name}</span>
        </span>
        <Button variant="secondary" size="sm" disabled title={t("common.notAvailableStep1")}>
          {t("common.requestAccess")}
        </Button>
      </div>
    );
  }
  const total = (d.fieldCounts?.l1 ?? 0) + (d.fieldCounts?.l2 ?? 0) + (d.fieldCounts?.l3 ?? 0);
  // every corporate dataset is catalogue-only in Step 1 (ui-plan.md decision
  // #8): none has dummy records, so the chip says so instead of a field count.
  const catalogueOnly = d.domain === "corporate_support";
  return (
    <Link
      href={`/ncec/datasets/${d.datasetId}` as never}
      className="card card-hover flex items-center justify-between gap-3 p-3.5"
      data-testid={`ncec-dataset-${d.datasetId}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
          <Database className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 truncate text-sm font-medium text-ink-900">{name}</span>
      </span>
      {catalogueOnly ? (
        <Chip tone="warn">{t("common.catalogueOnly")}</Chip>
      ) : (
        <Chip tone="mist">
          {total} {t("common.fields")}
        </Chip>
      )}
    </Link>
  );
}
