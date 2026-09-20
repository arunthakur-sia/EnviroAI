"use client";
// CR08 1.2: org_snapshots. One row per save, a manual snapshot with a note,
// and restore through a confirmation (the present state is saved first).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, History } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button, Chip, EmptyState, Input, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { editorCall, editorGet, type SnapshotMeta, type UndoEntry } from "./OrganisationEditorShared";

export function OrganisationSnapshots({
  version,
  canEdit,
  onChanged,
  pushUndo,
}: {
  /** bumps whenever the structure changed, so the list reloads */
  version: number;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  pushUndo: (entry: UndoEntry) => void;
}) {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SnapshotMeta[] | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<SnapshotMeta | null>(null);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    const data = await editorGet<SnapshotMeta[]>("snapshots");
    if (data) {
      setRows(data);
      setFailed(false);
    } else {
      setRows([]);
      setFailed(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, version]);

  async function take() {
    setBusy("take");
    try {
      const res = await editorCall({ action: "snapshots.take", note: note.trim() || undefined });
      if (!res.ok) {
        toast(tc("error"), "error");
        return;
      }
      toast(t("snapshotTaken"), "success");
      setNote("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!confirm) return;
    setBusy(confirm.id);
    try {
      const res = await editorCall<{ restored: number; inserted: number; deactivated: number; beforeId: string }>({
        action: "snapshots.restore",
        id: confirm.id,
      });
      if (!res.ok || !res.data) {
        toast(res.error === "invalid_snapshot" ? t("errors.invalid_snapshot") : tc("error"), "error");
        return;
      }
      pushUndo({ label: t("undoLabels.restore"), inverse: { action: "snapshots.restore", id: res.data.beforeId } });
      toast(t("snapshotRestored", { restored: res.data.restored, inserted: res.data.inserted, deactivated: res.data.deactivated }), "success");
      setConfirm(null);
      await onChanged();
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-4" data-testid="org-snapshots">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label htmlFor="org-snapshot-note" className="mb-1.5 block text-xs font-medium text-ink-600">
            {t("snapshotNote")}
          </label>
          <Input id="org-snapshot-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("snapshotNotePlaceholder")} data-testid="org-snapshot-note" />
        </div>
        <Button size="sm" variant="secondary" loading={busy === "take"} disabled={!canEdit} onClick={take} data-testid="org-snapshot-take">
          <Camera /> {t("snapshotTake")}
        </Button>
      </div>
      {rows === null ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-5/6" />
        </div>
      ) : failed ? (
        <p className="text-sm text-danger">{tc("error")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<History />} title={t("snapshotEmpty")} className="py-8" />
      ) : (
        <div role="table" aria-label={t("snapshotsTitle")} className="divide-y divide-sand-100">
          {rows.map((s, i) => (
            <div key={s.id} role="row" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="org-snapshot-row">
              <span role="cell" className="w-36 text-xs text-ink-900 tnum" dir="ltr">
                {formatDate(s.takenAt, locale, { style: "medium" })} {s.takenAt.slice(11, 16)}
              </span>
              <span role="cell" className="min-w-0 flex-1 truncate text-sm text-ink-900" title={s.note ?? ""}>
                {s.note ?? ""}
                {i === 0 ? (
                  <Chip tone="ok" className="ms-2">
                    {t("snapshotLatest")}
                  </Chip>
                ) : null}
              </span>
              <span role="cell" className="text-xs text-ink-600">
                {s.takenByName ? t("snapshotBy", { name: s.takenByName }) : t("snapshotBySeed")}
              </span>
              <span role="cell" className="text-xs text-ink-400 tnum">
                {t("snapshotUnits", { count: s.unitCount })}
              </span>
              <span role="cell">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => setConfirm(s)}
                  aria-label={t("snapshotRestoreAria", { date: formatDate(s.takenAt, locale, { style: "medium" }) })}
                  data-testid="org-snapshot-restore"
                >
                  <History /> {t("snapshotRestore")}
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent title={confirm ? t("snapshotRestoreTitle", { date: formatDate(confirm.takenAt, locale, { style: "long" }) }) : ""} className="w-[min(520px,94vw)]">
          {confirm ? <p className="text-sm text-ink-600">{t("snapshotRestoreHint", { count: confirm.unitCount })}</p> : null}
          {confirm?.note ? <p className="mt-2 text-sm text-ink-900">{confirm.note}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button loading={Boolean(confirm && busy === confirm.id)} onClick={restore} data-testid="org-snapshot-confirm">
              <History /> {t("snapshotRestore")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
