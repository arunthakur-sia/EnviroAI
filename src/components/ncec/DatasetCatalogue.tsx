"use client";
// The dataset catalogue (brief s8.2), as a card grid or as the compact list
// the dashboards use: an open dataset links to the generic dataset view; a
// fully-locked one shows only its title, "Restricted to L3" and a disabled
// "Request access" (ui-plan.md decision #10: the grant workflow itself is
// out of scope for Step 1).
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Database, Layers, Lock, Wind, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import type { CatalogueDataset } from "@/server/ncec/types";

const ICONS: Record<string, LucideIcon> = { "DS-022": Wind, "DS-027": Layers };

function fieldTotal(d: CatalogueDataset): number {
  return (d.fieldCounts?.l1 ?? 0) + (d.fieldCounts?.l2 ?? 0) + (d.fieldCounts?.l3 ?? 0);
}

export function DatasetCatalogue({ datasets, variant = "grid" }: { datasets: CatalogueDataset[]; variant?: "grid" | "list" }) {
  const locale = useLocale();
  const t = useTranslations("ksaNcec");
  if (!datasets.length) return <p className="text-sm text-ink-600">{t("common.noResults")}</p>;
  if (variant === "list") {
    return (
      <ul className="flex flex-col gap-2" data-testid="ncec-catalogue">
        {datasets.map((d) => (
          <li key={d.datasetId}>
            <DatasetRow d={d} locale={locale} t={t} />
          </li>
        ))}
      </ul>
    );
  }
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
  const total = fieldTotal(d);
  // a corporate dataset without dummy records is catalogue-only in Step 1
  // (ui-plan.md decision #8): the chip says so instead of a field count.
  const catalogueOnly = d.domain === "corporate_support" && !d.hasDummyData;
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

function DatasetRow({
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
        className="flex items-center gap-3 rounded-lg border border-mist-200 bg-mist-50 px-3 py-2.5"
        data-testid={`ncec-dataset-${d.datasetId}`}
        data-locked="1"
      >
        <Lock className="size-4 shrink-0 text-ink-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-ink-900">{name}</span>
          <span className="text-ink-600"> · {t("common.restrictedToL3")}</span>
        </span>
        <Button variant="secondary" size="sm" disabled title={t("common.notAvailableStep1")}>
          {t("common.requestAccess")}
        </Button>
      </div>
    );
  }
  const Icon = ICONS[d.datasetId] ?? Database;
  return (
    <Link
      href={`/ncec/datasets/${d.datasetId}` as never}
      className="flex items-center gap-3 rounded-lg border border-mist-200 bg-white px-3 py-2.5 transition-colors hover:border-teal-400 hover:bg-mist-50"
      data-testid={`ncec-dataset-${d.datasetId}`}
    >
      <Icon className="size-5 shrink-0 text-teal-700" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-semibold text-ink-900">{name}</span>
        <span className="text-ink-600">
          {" "}
          · {d.domain === "corporate_support" && !d.hasDummyData ? t("common.catalogueOnly") : `${fieldTotal(d)} ${t("common.fields")}`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-400 flip-rtl" aria-hidden />
    </Link>
  );
}
