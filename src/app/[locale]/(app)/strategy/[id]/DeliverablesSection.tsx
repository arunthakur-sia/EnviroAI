"use client";
// CR02 2.3: the Deliverables section on initiative and project pages.
// Multi-file upload, then a list with code, title, version, date, owner,
// classification, verification status, download, and open in reader.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, BookOpen, Download, FileStack, Loader2, Upload } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, ClassificationChip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Row = {
  id: string;
  documentId: string;
  deliverableCode: string;
  milestone: string | null;
  dueDate: string | null;
  deliveredDate: string | null;
  acceptanceStatus: string;
  titleEn: string;
  titleAr: string;
  status: string;
  classificationLevel: number;
  versionNo: number;
  createdAt: string;
  ownerNameEn: string | null;
  ownerNameAr: string | null;
};

export function DeliverablesSection({
  nodeId,
  initial,
  canUpload,
  classificationLabels,
}: {
  nodeId: string;
  initial: Row[];
  canUpload: boolean;
  classificationLabels: [string, string, string, string];
}) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch(`/api/v1/deliverables?nodeId=${nodeId}`);
      const json = await res.json();
      if (res.ok) setRows(json.data ?? []);
    } catch {
      /* keep the current list */
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("nodeId", nodeId);
        const res = await fetch("/api/v1/deliverables", { method: "POST", body: form });
        if (res.ok) done++;
      }
      if (done) {
        toast(t("deliverablesUploaded", { count: done }), "points");
        await refresh();
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div data-testid="deliverables-section">
      {canUpload ? (
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
            accept=".pdf,.docx,.doc,.xlsx,.pptx,.txt,.md"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3.5 py-2 text-sm text-ink-600 transition-colors hover:border-maroon-300 hover:text-maroon-700 cursor-pointer disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t("uploadDeliverables")}
          </button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-center text-sm text-ink-600">
          {t("noDeliverables")}
        </p>
      ) : (
        <div className="card divide-y divide-sand-100">
          {rows.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-maroon-100 text-[11px] font-semibold text-maroon-900 tnum">
                {d.deliverableCode}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-ink-900">
                    {bi(locale, d.titleEn, d.titleAr)}
                  </span>
                  {d.status === "verified" ? (
                    <BadgeCheck className="size-4 shrink-0 text-gulf-600" aria-label={tc("verified")} />
                  ) : null}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-600">
                  <span className="tnum">{t("versionShort", { n: d.versionNo })}</span>
                  <span className="tnum">{formatDate(d.deliveredDate ?? d.createdAt, locale, { style: "short" })}</span>
                  {d.ownerNameEn ? <span>{bi(locale, d.ownerNameEn, d.ownerNameAr ?? "")}</span> : null}
                  {d.milestone ? (
                    <span>
                      {t("milestone")}: {d.milestone}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      d.acceptanceStatus === "accepted"
                        ? "text-ok"
                        : d.acceptanceStatus === "revised"
                          ? "text-warn"
                          : "text-ink-600"
                    )}
                  >
                    {t(`acceptance.${d.acceptanceStatus}` as never)}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <ClassificationChip level={d.classificationLevel} labels={classificationLabels} />
                <a
                  href={`/api/v1/documents/${d.documentId}/download`}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 hover:text-maroon-700"
                  aria-label={t("download")}
                >
                  <Download className="size-4" />
                </a>
                <Link
                  href={`/vault/${d.documentId}` as never}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 hover:text-maroon-700"
                  aria-label={t("openInReader")}
                >
                  <BookOpen className="size-4" />
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}
      {rows.length ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-600">
          <FileStack className="size-3" aria-hidden />
          {t("nav.deliverablesCount", { count: rows.length })}
        </p>
      ) : null}
    </div>
  );
}
