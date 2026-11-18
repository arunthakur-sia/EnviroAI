"use client";
// A generic dataset view: metadata, a locked state with "Request access"
// (brief s6), or the paged records table built from exactly the columns the
// server decided this caller may see (ui-plan.md s3.2).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Database, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { NcecTable } from "@/components/ncec/NcecTable";
import type { DatasetView, RecordsPage } from "@/server/ncec/types";

const PAGE_SIZE = 25;

export function DatasetDetailView({ view }: { view: DatasetView }) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const { dataset, columns } = view;
  const name = bi(locale, dataset.nameEn, dataset.nameAr);
  const execDept = bi(locale, dataset.execDeptNameEn, dataset.execDeptNameAr);
  const generalDept = bi(locale, dataset.generalDeptNameEn, dataset.generalDeptNameAr);

  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<RecordsPage | null>(null);
  const [loading, setLoading] = React.useState(!dataset.locked);

  React.useEffect(() => {
    if (dataset.locked) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/ncec/datasets/${dataset.datasetId}/records?page=${page}&size=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json.data as RecordsPage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataset.datasetId, dataset.locked, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div data-testid="ncec-dataset-page">
      <Link href={"/ncec" as never} className="mb-3 inline-flex text-sm font-medium text-navy-700 hover:underline">
        {t("common.backToCatalogue")}
      </Link>
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
          <Database className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl">{name}</h1>
          <p className="text-sm text-ink-600">
            {execDept}
            {generalDept ? ` · ${generalDept}` : ""}
          </p>
        </div>
      </header>
      <DummyDataBanner />

      {dataset.locked ? (
        <section className="card flex flex-col items-start gap-3 p-6" data-testid="ncec-dataset-locked">
          <Chip tone="warn" className="gap-1.5">
            <Lock className="size-3.5" aria-hidden /> {t("common.locked")}
          </Chip>
          <h2 className="text-lg">{t("dataset.lockedTitle")}</h2>
          <p className="max-w-xl text-sm text-ink-700">{t("dataset.lockedBody")}</p>
          <Button variant="secondary" disabled title={t("common.notAvailableStep1")}>
            {t("common.requestAccess")}
          </Button>
        </section>
      ) : (
        <>
          <section className="card mb-4 p-4" aria-labelledby="ncec-fields-title">
            <h2 id="ncec-fields-title" className="mb-2 text-base font-semibold text-ink-900">
              {t("dataset.fieldCountsTitle")}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <Chip key={c.assetId} tone={c.locked ? "mist" : c.layer === 3 ? "danger" : c.layer === 2 ? "teal" : "ok"}>
                  {t(`common.layerShort.l${c.layer}` as never)}
                  {c.locked ? <Lock className="ms-1 size-3" aria-hidden /> : null}
                </Chip>
              ))}
            </div>
          </section>

          <section className="card p-4" aria-labelledby="ncec-records-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="ncec-records-title" className="text-lg">
                {t("dataset.recordsTitle")}
              </h2>
              {data ? <span className="text-xs text-ink-400">{t("dataset.page", { page, total: totalPages })}</span> : null}
            </div>
            {loading || !data ? (
              <div className="skeleton h-40 w-full rounded-lg" aria-hidden />
            ) : (
              <>
                <NcecTable columns={data.columns} rows={data.rows} caption={name} />
                {totalPages > 1 ? (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4 flip-rtl" aria-hidden />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="size-4 flip-rtl" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
