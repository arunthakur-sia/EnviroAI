"use client";
// CR08 1.2: bulk import of units from a CSV (code, parent_code, level,
// name_en, name_ar, head_name, head_title). Preview with per-row validation
// first; the import runs only when every row is valid.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Copy, FileUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Chip, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { editorCall, type UndoEntry } from "./OrganisationEditorShared";

type CsvRow = {
  line: number;
  code: string;
  parentCode: string | null;
  level: string;
  nameEn: string;
  nameAr: string;
  headName: string | null;
  headTitle: string | null;
  status: "new" | "update" | "unchanged" | "error";
  errors: string[];
  changes: string[];
};
type CsvPreview = { rows: CsvRow[]; counts: { new: number; update: number; unchanged: number; error: number }; columns: string[] };

const HEADER = "code,parent_code,level,name_en,name_ar,head_name,head_title";
const STATUS_TONE: Record<CsvRow["status"], "ok" | "info" | "mist" | "danger"> = {
  new: "ok",
  update: "info",
  unchanged: "mist",
  error: "danger",
};

export function OrganisationCsvImport({
  canEdit,
  onChanged,
  pushUndo,
}: {
  canEdit: boolean;
  onChanged: () => Promise<void>;
  pushUndo: (entry: UndoEntry) => void;
}) {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const uid = React.useId();
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<CsvPreview | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  function describeError(code: string): string {
    const [key, arg] = code.split(":");
    if (key === "missing_columns") return t("csvErrorCodes.missing_columns", { columns: arg ?? "" });
    const known = ["code_required", "name_en_required", "name_ar_required", "unknown_level", "duplicate_code", "parent_is_self", "unknown_parent", "would_create_a_cycle"];
    return known.includes(key) ? t(`csvErrorCodes.${key}` as never) : key;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setPreview(null);
  }

  async function runPreview() {
    setBusy("preview");
    try {
      const res = await editorCall<CsvPreview>({ action: "csv.preview", text });
      if (!res.ok || !res.data) {
        toast(tc("error"), "error");
        return;
      }
      setPreview(res.data);
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    setBusy("apply");
    try {
      const res = await editorCall<{ inserted: number; updated: number; snapshotId: string; beforeId: string }>({ action: "csv.apply", text });
      if (!res.ok || !res.data) {
        toast(res.error === "csv_has_errors" ? t("errors.csv_has_errors") : tc("error"), "error");
        return;
      }
      toast(t("csvApplied", { inserted: res.data.inserted, updated: res.data.updated }), "success");
      // the undo restores the snapshot taken just before the import
      pushUndo({ label: t("undoLabels.csv"), inverse: { action: "snapshots.restore", id: res.data.beforeId } });
      setPreview(null);
      setText("");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = preview ? preview.counts.new + preview.counts.update : 0;

  return (
    <div className="card flex flex-col gap-3 p-4" data-testid="org-csv">
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-mist-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:border-navy-300 hover:text-navy-700", !canEdit && "pointer-events-none opacity-50")}>
          <FileUp className="size-4" aria-hidden />
          {t("csvFile")}
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" disabled={!canEdit} data-testid="org-csv-file" />
        </label>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(HEADER + "\n");
            toast(t("csvTemplateCopied"), "success");
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-600 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
        >
          <Copy className="size-3.5" aria-hidden /> {t("csvCopyTemplate")}
        </button>
      </div>
      <div>
        <Label htmlFor={`${uid}-csv`}>{t("csvPaste")}</Label>
        <Textarea
          id={`${uid}-csv`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          placeholder={t("csvPastePlaceholder")}
          dir="ltr"
          className="min-h-28 font-mono text-xs"
          disabled={!canEdit}
          data-testid="org-csv-text"
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {preview ? (
          <span className={cn("me-auto text-xs", preview.counts.error ? "text-danger" : "text-ink-600")} role="status">
            {preview.rows.length === 0 ? t("csvNoRows") : preview.counts.error ? t("csvErrors", { count: preview.counts.error }) : t("csvClean")}
          </span>
        ) : null}
        <Button size="sm" variant="secondary" loading={busy === "preview"} disabled={!canEdit || text.trim().length < 5} onClick={runPreview} data-testid="org-csv-preview">
          {t("csvPreview")}
        </Button>
        <Button size="sm" loading={busy === "apply"} disabled={!canEdit || !preview || preview.counts.error > 0 || pendingCount === 0} onClick={apply} data-testid="org-csv-apply">
          <Upload /> {pendingCount > 0 ? t("csvApply", { count: pendingCount }) : t("csvApplyPlain")}
        </Button>
      </div>
      {preview && preview.rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-mist-200">
          <div role="table" aria-label={t("csvTitle")} className="min-w-[720px] text-xs">
            <div role="row" className="grid grid-cols-[3rem_5rem_6rem_6rem_1fr_1fr_1fr] gap-2 bg-mist-50 px-3 py-2 font-semibold text-ink-600">
              <span role="columnheader">{t("csvLine")}</span>
              <span role="columnheader">{t("csvStatusHeader")}</span>
              <span role="columnheader" dir="ltr">code</span>
              <span role="columnheader" dir="ltr">parent_code</span>
              <span role="columnheader" dir="ltr">name_en</span>
              <span role="columnheader" dir="ltr">name_ar</span>
              <span role="columnheader">{t("csvChangesHeader")}</span>
            </div>
            {preview.rows.map((row) => (
              <div
                key={row.line}
                role="row"
                data-testid="org-csv-row"
                data-status={row.status}
                className={cn("grid grid-cols-[3rem_5rem_6rem_6rem_1fr_1fr_1fr] items-start gap-2 border-t border-mist-100 px-3 py-2", row.status === "error" && "bg-danger-light/40")}
              >
                <span role="cell" className="text-ink-400 tnum">
                  {row.line}
                </span>
                <span role="cell">
                  <Chip tone={STATUS_TONE[row.status]}>{t(`csvStatus.${row.status}` as never)}</Chip>
                </span>
                <span role="cell" className="truncate text-ink-900 tnum" dir="ltr">
                  {row.code}
                </span>
                <span role="cell" className="truncate text-ink-600 tnum" dir="ltr">
                  {row.parentCode ?? ""}
                </span>
                <span role="cell" className="truncate text-ink-900" dir="ltr">
                  {row.nameEn}
                </span>
                <span role="cell" className="truncate text-ink-900" dir="rtl">
                  {row.nameAr}
                </span>
                <span role="cell" className={cn(row.status === "error" ? "text-danger" : "text-ink-600")}>
                  {row.status === "error" ? row.errors.map(describeError).join("; ") : row.changes.length ? t("csvChanges", { fields: row.changes.join(", ") }) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
