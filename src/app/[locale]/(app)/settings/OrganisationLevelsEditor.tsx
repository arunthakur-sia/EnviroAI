"use client";
// CR08 1.2: the org_levels editor. Rename in both languages, add, reorder by
// drag, and remove a level only when no unit uses it.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { editorCall, type Inverse, type LevelDef, type UndoEntry, type Unit } from "./OrganisationEditorShared";

export function OrganisationLevelsEditor({
  levels,
  units,
  canEdit,
  onChanged,
  pushUndo,
}: {
  levels: LevelDef[];
  units: Unit[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  pushUndo: (entry: UndoEntry) => void;
}) {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const uid = React.useId();
  const [editing, setEditing] = React.useState<{ id: string; code: string; nameEn: string; nameAr: string } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ code: "", nameEn: "", nameAr: "" });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<string[] | null>(null);
  const orderRef = React.useRef<string[] | null>(null);

  const usage = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const u of units) map.set(u.level, (map.get(u.level) ?? 0) + 1);
    return map;
  }, [units]);

  const ordered = React.useMemo(() => {
    if (!order) return levels;
    const byId = new Map(levels.map((l) => [l.id, l]));
    return order.map((id) => byId.get(id)).filter((l): l is LevelDef => Boolean(l));
  }, [levels, order]);

  function explain(code: string | null | undefined): string {
    if (code === "code_taken") return t("codeTaken");
    if (code === "level_in_use") return t("errors.level_in_use");
    if (code === "forbidden") return tc("forbidden");
    return tc("error");
  }

  async function save(input: { id?: string; code: string; nameEn: string; nameAr: string }) {
    setBusy(input.id ?? "new");
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "levels.save", ...input });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return false;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.level", { level: input.nameEn }), inverse: res.data.inverse });
      toast(t("levelSaved"), "success");
      await onChanged();
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function remove(level: LevelDef) {
    setBusy(level.id);
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "levels.delete", id: level.id });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.level", { level: level.nameEn }), inverse: res.data.inverse });
      toast(t("levelRemoved"), "success");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function commitOrder(ids: string[]) {
    setBusy("order");
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "levels.reorder", ids });
      if (!res.ok) {
        toast(explain(res.error), "error");
        setOrder(null);
        return;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.levels"), inverse: res.data.inverse });
      toast(t("levelReordered"), "success");
      await onChanged();
      setOrder(null);
    } finally {
      setBusy(null);
    }
  }

  /* pointer events with capture: the row under the pointer takes the
     dragged level's place in the preview; the order is saved on release */
  function onHandleDown(e: React.PointerEvent<HTMLSpanElement>, id: string) {
    if (!canEdit || e.button) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    orderRef.current = levels.map((l) => l.id);
    setOrder(orderRef.current);
    setDragId(id);
  }

  function onHandleMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!dragId || !orderRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetId = el?.closest<HTMLElement>("[data-level-id]")?.getAttribute("data-level-id") ?? null;
    if (!targetId || targetId === dragId) return;
    const ids = orderRef.current.slice();
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    orderRef.current = ids;
    setOrder(ids);
  }

  function onHandleUp(e: React.PointerEvent<HTMLSpanElement>) {
    if (!dragId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const ids = orderRef.current;
    orderRef.current = null;
    setDragId(null);
    if (e.type === "pointerup" && ids && ids.join() !== levels.map((l) => l.id).join()) void commitOrder(ids);
    else setOrder(null);
  }

  const iconButton =
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-sand-100 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-default disabled:opacity-40";

  return (
    <div className="card divide-y divide-sand-100" data-testid="org-levels">
      {ordered.map((level, i) => {
        const used = usage.get(level.code) ?? 0;
        const isEditing = editing?.id === level.id;
        return (
          <div
            key={level.id}
            data-testid="org-level-row"
            data-level-id={level.id}
            data-level-code={level.code}
            className={cn("flex flex-wrap items-center gap-2 px-3 py-2", dragId && "select-none", dragId === level.id && "bg-gold-100/50")}
          >
            <span
              onPointerDown={(e) => !isEditing && onHandleDown(e, level.id)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              style={{ touchAction: "none" }}
              data-testid="org-level-drag"
              className={cn("flex size-6 shrink-0 items-center justify-center text-ink-400", canEdit ? "cursor-grab active:cursor-grabbing" : "opacity-40")}
              aria-label={t("levelDrag", { level: bi(locale, level.nameEn, level.nameAr) })}
              title={t("levelDrag", { level: bi(locale, level.nameEn, level.nameAr) })}
            >
              <GripVertical className="size-4" aria-hidden />
            </span>
            <span className="w-5 text-[11px] text-ink-400 tnum">{i + 1}</span>
            {isEditing ? (
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} dir="ltr" aria-label={t("levelCode")} className="h-8 w-40 font-mono text-xs" />
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} dir="ltr" aria-label={t("levelNameEn")} className="h-8 min-w-40 flex-1 text-xs" data-testid="org-level-name-en" />
                <Input value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} dir="rtl" aria-label={t("levelNameAr")} className="h-8 min-w-40 flex-1 text-xs" data-testid="org-level-name-ar" />
                <button
                  type="button"
                  className={iconButton}
                  aria-label={tc("save")}
                  disabled={busy === level.id || !editing.nameEn.trim() || !editing.nameAr.trim()}
                  onClick={async () => {
                    if (await save(editing)) setEditing(null);
                  }}
                  data-testid="org-level-save"
                >
                  <Check className="size-4 text-ok" />
                </button>
                <button type="button" className={iconButton} aria-label={tc("cancel")} onClick={() => setEditing(null)}>
                  <X className="size-4" />
                </button>
              </span>
            ) : (
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-900">{bi(locale, level.nameEn, level.nameAr)}</span>
                  <span className="text-xs text-ink-400" dir="auto">
                    {locale === "ar" ? level.nameEn : level.nameAr}
                  </span>
                  <span className="text-[11px] text-ink-400 tnum" dir="ltr">
                    {level.code}
                  </span>
                </span>
                <span className="block text-[11px] text-ink-400 tnum">{used ? t("levelInUse", { count: used }) : t("levelUnused")}</span>
              </span>
            )}
            {!isEditing ? (
              <>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t("levelEdit", { level: bi(locale, level.nameEn, level.nameAr) })}
                  disabled={!canEdit}
                  onClick={() => setEditing({ id: level.id, code: level.code, nameEn: level.nameEn, nameAr: level.nameAr })}
                  data-testid="org-level-edit"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t("levelRemove", { level: bi(locale, level.nameEn, level.nameAr) })}
                  title={used ? t("levelInUse", { count: used }) : undefined}
                  disabled={!canEdit || used > 0 || busy === level.id}
                  onClick={() => void remove(level)}
                  data-testid="org-level-remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            ) : null}
          </div>
        );
      })}
      <div className="px-3 py-2.5">
        {adding ? (
          <div className="flex flex-wrap items-end gap-2" data-testid="org-level-add-form">
            <div>
              <Label htmlFor={`${uid}-code`}>{t("levelCode")}</Label>
              <Input id={`${uid}-code`} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} dir="ltr" className="h-8 w-40 font-mono text-xs" placeholder="division" />
            </div>
            <div className="min-w-40 flex-1">
              <Label htmlFor={`${uid}-en`}>{t("levelNameEn")}</Label>
              <Input id={`${uid}-en`} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} dir="ltr" className="h-8 text-xs" />
            </div>
            <div className="min-w-40 flex-1">
              <Label htmlFor={`${uid}-ar`}>{t("levelNameAr")}</Label>
              <Input id={`${uid}-ar`} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} dir="rtl" className="h-8 text-xs" />
            </div>
            <Button
              size="sm"
              loading={busy === "new"}
              disabled={!draft.code.trim() || !draft.nameEn.trim() || !draft.nameAr.trim()}
              onClick={async () => {
                if (await save(draft)) {
                  setDraft({ code: "", nameEn: "", nameAr: "" });
                  setAdding(false);
                }
              }}
              data-testid="org-level-add-save"
            >
              <Check /> {tc("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {tc("cancel")}
            </Button>
            <p className="w-full text-[11px] text-ink-400">{t("levelCodeHint")}</p>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={!canEdit} data-testid="org-level-add">
            <Plus /> {t("levelAdd")}
          </Button>
        )}
      </div>
      {!levels.length ? (
        <p className="px-3 py-3 text-sm text-ink-600">
          <Chip tone="sand">{t("levelUnused")}</Chip>
        </p>
      ) : null}
    </div>
  );
}
