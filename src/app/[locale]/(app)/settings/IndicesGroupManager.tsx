"use client";
// CR08 4.3: Settings > Indices > the group manager. Add, rename in both
// languages, describe, pick a colour token, reorder (drag or the arrow
// buttons), archive and restore. Self-loading from /api/v1/indices/groups.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, GripVertical, Pencil, Plus } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, Label, Skeleton, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { GROUP_COLOUR_TOKENS, groupStyle, type GroupColourToken } from "@/lib/sdg-colours";

export type GroupRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  colourToken: string;
  sort: number;
  isActive: boolean;
  memberCount: number;
  memberIds: string[];
};

type Form = {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  colourToken: GroupColourToken;
};

const EMPTY: Form = { code: "", nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "", colourToken: "navy" };

export function IndicesGroupManager({ onChanged }: { onChanged?: () => void }) {
  const t = useTranslations("settings.indicesTab.groups");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<GroupRow[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialog, setDialog] = React.useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/indices/groups");
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      setRows(j.data ?? []);
      setFailed(false);
    } catch {
      setRows([]);
      setFailed(true);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/v1/indices/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error === "code_exists" ? t("codeTaken") : tc("error"), "error");
      return false;
    }
    return true;
  }

  function openCreate() {
    setForm(EMPTY);
    setDialog({ mode: "create" });
  }
  function openEdit(g: GroupRow) {
    setForm({
      code: g.code,
      nameEn: g.nameEn,
      nameAr: g.nameAr,
      descriptionEn: g.descriptionEn ?? "",
      descriptionAr: g.descriptionAr ?? "",
      colourToken: (GROUP_COLOUR_TOKENS.includes(g.colourToken as GroupColourToken)
        ? g.colourToken
        : "navy") as GroupColourToken,
    });
    setDialog({ mode: "edit", id: g.id });
  }

  async function save() {
    if (!dialog) return;
    setBusy(true);
    try {
      const ok =
        dialog.mode === "create"
          ? await post({
              action: "create",
              code: form.code.trim() || undefined,
              nameEn: form.nameEn.trim(),
              nameAr: form.nameAr.trim(),
              descriptionEn: form.descriptionEn.trim() || undefined,
              descriptionAr: form.descriptionAr.trim() || undefined,
              colourToken: form.colourToken,
            })
          : await post({
              action: "update",
              id: dialog.id,
              nameEn: form.nameEn.trim(),
              nameAr: form.nameAr.trim(),
              descriptionEn: form.descriptionEn.trim() || null,
              descriptionAr: form.descriptionAr.trim() || null,
              colourToken: form.colourToken,
            });
      if (ok) {
        toast(dialog.mode === "create" ? t("created") : t("saved"), "points");
        setDialog(null);
        await load();
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  async function archive(g: GroupRow, isActive: boolean) {
    setBusy(true);
    try {
      if (await post({ action: "archive", id: g.id, isActive })) {
        toast(isActive ? t("restored") : t("archived"), "points");
        await load();
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  async function reorder(ids: string[]) {
    const previous = rows;
    setRows((cur) => {
      if (!cur) return cur;
      const byId = new Map(cur.map((g) => [g.id, g]));
      const ordered = ids.map((id) => byId.get(id)!).filter(Boolean);
      const rest = cur.filter((g) => !ids.includes(g.id));
      return [...ordered, ...rest].map((g, i) => ({ ...g, sort: i + 1 }));
    });
    if (await post({ action: "reorder", ids })) {
      toast(t("orderSaved"), "points");
      onChanged?.();
    } else setRows(previous);
  }

  function moveBy(id: string, dir: -1 | 1) {
    if (!rows) return;
    const ids = rows.map((g) => g.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorder(ids);
  }

  function dropOn(targetId: string) {
    if (!rows || !drag || drag === targetId) return;
    const ids = rows.map((g) => g.id).filter((id) => id !== drag);
    const at = ids.indexOf(targetId);
    ids.splice(at, 0, drag);
    setDrag(null);
    setOver(null);
    void reorder(ids);
  }

  const visible = (rows ?? []).filter((g) => showArchived || g.isActive);
  const archivedCount = (rows ?? []).filter((g) => !g.isActive).length;

  return (
    <div className="card p-4" data-testid="group-manager">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{t("title")}</p>
          <p className="mt-0.5 text-xs text-ink-600">{t("hint")}</p>
        </div>
        {archivedCount ? (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-ink-600 hover:text-navy-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
            aria-pressed={showArchived}
            data-testid="group-show-archived"
          >
            {showArchived ? t("hideArchived", { count: archivedCount }) : t("showArchived", { count: archivedCount })}
          </button>
        ) : null}
        <Button size="sm" onClick={openCreate} data-testid="group-add">
          <Plus /> {t("add")}
        </Button>
      </div>

      {rows === null ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState title={tc("error")} hint={t("loadFailed")} action={<Button size="sm" variant="secondary" onClick={load}>{t("retry")}</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState title={t("empty")} hint={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-1.5" role="list" data-testid="group-list">
          {visible.map((g, i) => {
            const style = groupStyle(g.colourToken);
            return (
              <li
                key={g.id}
                role="listitem"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDrag(g.id);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over !== g.id) setOver(g.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(g.id);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                  over === g.id && drag && drag !== g.id ? "border-aqua-500 bg-aqua-100/50" : "border-mist-200 bg-white",
                  drag === g.id && "opacity-50",
                  !g.isActive && "bg-mist-50"
                )}
                data-testid="group-row"
                data-group-code={g.code}
              >
                <span className="cursor-grab text-ink-400 active:cursor-grabbing" aria-hidden>
                  <GripVertical className="size-4" />
                </span>
                <span className={cn("h-8 w-1.5 shrink-0 rounded-full", style.bar)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink-900">{bi(locale, g.nameEn, g.nameAr)}</span>
                    <span className="truncate text-xs text-ink-400" dir="auto">{bi(locale, g.nameAr, g.nameEn)}</span>
                    {!g.isActive ? <Chip tone="ghost">{t("archivedChip")}</Chip> : null}
                  </span>
                  <span className="block truncate text-[11px] text-ink-600">
                    <span className="tnum" dir="ltr">{g.code}</span>
                    {" · "}
                    {t("memberCount", { count: g.memberCount })}
                  </span>
                </span>
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveBy(g.id, -1)}
                    disabled={i === 0}
                    className="rounded-md p-1 text-ink-600 hover:bg-mist-100 hover:text-navy-700 disabled:opacity-30 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={t("moveUp")}
                    data-testid="group-move-up"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBy(g.id, 1)}
                    disabled={i === visible.length - 1}
                    className="rounded-md p-1 text-ink-600 hover:bg-mist-100 hover:text-navy-700 disabled:opacity-30 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={t("moveDown")}
                    data-testid="group-move-down"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    className="rounded-md p-1 text-ink-600 hover:bg-mist-100 hover:text-navy-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={t("edit")}
                    data-testid="group-edit"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => archive(g, !g.isActive)}
                    disabled={busy}
                    className="rounded-md p-1 text-ink-600 hover:bg-mist-100 hover:text-navy-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={g.isActive ? t("archive") : t("restore")}
                    data-testid={g.isActive ? "group-archive" : "group-restore"}
                  >
                    {g.isActive ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-400">{t("dragHint")}</p>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title={dialog?.mode === "edit" ? t("edit") : t("add")} className="w-[min(640px,94vw)]" data-testid="group-dialog">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="group-name-en">{t("nameEn")}</Label>
              <Input id="group-name-en" value={form.nameEn} dir="ltr" onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} data-testid="group-name-en" />
            </div>
            <div>
              <Label htmlFor="group-name-ar">{t("nameAr")}</Label>
              <Input id="group-name-ar" value={form.nameAr} dir="rtl" onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} data-testid="group-name-ar" />
            </div>
            <div>
              <Label htmlFor="group-desc-en">{t("descriptionEn")}</Label>
              <Textarea id="group-desc-en" value={form.descriptionEn} dir="ltr" className="min-h-20" onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="group-desc-ar">{t("descriptionAr")}</Label>
              <Textarea id="group-desc-ar" value={form.descriptionAr} dir="rtl" className="min-h-20" onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))} />
            </div>
            {dialog?.mode === "create" ? (
              <div>
                <Label htmlFor="group-code">{t("code")}</Label>
                <Input id="group-code" value={form.code} dir="ltr" placeholder="wellbeing" onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))} data-testid="group-code" />
                <p className="mt-1 text-[11px] text-ink-400">{t("codeHint")}</p>
              </div>
            ) : null}
            <div>
              {/* a caption over a radio group of colour buttons, not a control */}
              <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("colour")}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("colour")}>
                {GROUP_COLOUR_TOKENS.map((token) => {
                  const style = groupStyle(token);
                  const on = form.colourToken === token;
                  return (
                    <button
                      key={token}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={t(`colours.${token}` as never)}
                      title={t(`colours.${token}` as never)}
                      onClick={() => setForm((f) => ({ ...f, colourToken: token }))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500",
                        on ? "border-navy-500 bg-navy-50 text-navy-900" : "border-mist-300 text-ink-600"
                      )}
                      data-testid={`group-colour-${token}`}
                    >
                      <span className={cn("size-3.5 rounded-full", style.bar)} aria-hidden />
                      {t(`colours.${token}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>{tc("cancel")}</Button>
            <Button loading={busy} disabled={form.nameEn.trim().length < 2 || !form.nameAr.trim()} onClick={save} data-testid="group-save">
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
