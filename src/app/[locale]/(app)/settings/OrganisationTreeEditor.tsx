"use client";
// CR08 1.2: the structure editor. The same tree as the chart, in edit mode:
// drag a row onto another to move it with everything beneath (live preview
// while dragging, then a confirmation with the counts that move), a plus on
// every row to add a child at any level, inline rename in both languages, and
// a kebab menu with edit (code, level, head by user or by name and title,
// mandate, responsibilities, sort), deactivate and delete. Deactivate and
// delete open the risk dialog that lists everything beneath the unit and
// requires a unit to reassign it all to; nothing is ever orphaned. Every
// mutation returns its inverse, which the tab keeps for undo.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  FolderInput,
  Check,
  X,
} from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  editorCall,
  editorGet,
  ImpactList,
  type Impact,
  type Inverse,
  type LevelDef,
  type UndoEntry,
  type Unit,
  type UserLite,
} from "./OrganisationEditorShared";

type TreeRow = { unit: Unit; depth: number; parentCode: string | null; hasChildren: boolean };

/** Walks the tree from the roots so every unit sits under its parent. */
function orderTree(units: Unit[], open: Set<string> | null, showInactive: boolean): TreeRow[] {
  const ids = new Set(units.map((u) => u.id));
  const ROOT = " root";
  const byParent = new Map<string, Unit[]>();
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const u of units) {
    if (!showInactive && !u.isActive) continue;
    const key = u.parentId && ids.has(u.parentId) ? u.parentId : ROOT;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(u);
    else byParent.set(key, [u]);
  }
  for (const bucket of byParent.values()) bucket.sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
  const out: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (key: string, depth: number) => {
    for (const unit of byParent.get(key) ?? []) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      const kids = byParent.get(unit.id) ?? [];
      const parent = unit.parentId ? byId.get(unit.parentId) : undefined;
      out.push({ unit, depth, parentCode: parent?.code ?? null, hasChildren: kids.length > 0 });
      if (!open || open.has(unit.id)) walk(unit.id, depth + 1);
    }
  };
  walk(ROOT, 0);
  return out;
}

function descendantIds(id: string, units: Unit[]): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const u of units) {
      if (u.parentId === cur && !out.has(u.id)) {
        out.add(u.id);
        stack.push(u.id);
      }
    }
  }
  return out;
}

type HeadMode = "none" | "user" | "external";

type UnitForm = {
  code: string;
  nameEn: string;
  nameAr: string;
  level: string;
  parentId: string;
  headMode: HeadMode;
  headUserId: string;
  headNameEn: string;
  headNameAr: string;
  headTitleEn: string;
  headTitleAr: string;
  mandateEn: string;
  mandateAr: string;
  responsibilitiesEn: string;
  responsibilitiesAr: string;
  sort: string;
};

const EMPTY_FORM: UnitForm = {
  code: "",
  nameEn: "",
  nameAr: "",
  level: "department",
  parentId: "",
  headMode: "none",
  headUserId: "",
  headNameEn: "",
  headNameAr: "",
  headTitleEn: "",
  headTitleAr: "",
  mandateEn: "",
  mandateAr: "",
  responsibilitiesEn: "",
  responsibilitiesAr: "",
  sort: "",
};

export function OrganisationTreeEditor({
  units,
  users,
  levels,
  canEdit,
  onChanged,
  pushUndo,
}: {
  units: Unit[];
  users: UserLite[];
  levels: LevelDef[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  pushUndo: (entry: UndoEntry) => void;
}) {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const uid = React.useId();

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<Set<string> | null>(null); // null = everything open
  const [showInactive, setShowInactive] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  // drag and drop (pointer events with capture: mouse, pen and touch alike)
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const dragRef = React.useRef<{ id: string; over: string | null; moved: boolean; x: number; y: number } | null>(null);
  const scrollRaf = React.useRef<number | null>(null);

  // dialogs
  const [move, setMove] = React.useState<{ id: string; targetId: string | null; step: "pick" | "confirm" } | null>(null);
  const [risk, setRisk] = React.useState<{ id: string; mode: "delete" | "deactivate"; reassignTo: string } | null>(null);
  const [impact, setImpact] = React.useState<Impact | null>(null);
  const [impactLoading, setImpactLoading] = React.useState(false);
  const [dialog, setDialog] = React.useState<{ mode: "add" | "edit"; unit: Unit | null; parentId: string | null } | null>(null);
  const [form, setForm] = React.useState<UnitForm>(EMPTY_FORM);
  const [rename, setRename] = React.useState<{ id: string; nameEn: string; nameAr: string } | null>(null);

  const byId = React.useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const usersById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const levelLabel = React.useCallback(
    (code: string) => {
      const l = levels.find((x) => x.code === code);
      return l ? bi(locale, l.nameEn, l.nameAr) : code;
    },
    [levels, locale]
  );
  const unitLabel = React.useCallback((unit: Unit) => bi(locale, unit.nameEn, unit.nameAr), [locale]);

  /* the live preview: while a row hovers over a target, the tree is drawn
     as if the move had happened */
  const previewUnits = React.useMemo(() => {
    if (!dragId || !overId || dragId === overId) return units;
    return units.map((u) => (u.id === dragId ? { ...u, parentId: overId } : u));
  }, [units, dragId, overId]);

  const rows = React.useMemo(() => {
    const all = orderTree(previewUnits, null, showInactive);
    const needle = query.trim().toLowerCase();
    let keep: Set<string> | null = null;
    if (needle) {
      keep = new Set();
      for (const row of all) {
        const hay = `${row.unit.code} ${row.unit.nameEn} ${row.unit.nameAr}`.toLowerCase();
        if (hay.includes(needle)) {
          keep.add(row.unit.id);
          let cursor = row.unit.parentId ? byId.get(row.unit.parentId) : undefined;
          for (let i = 0; i < 10 && cursor; i++) {
            keep.add(cursor.id);
            cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
          }
        }
      }
    }
    const visible = keep ? all.filter((r) => keep!.has(r.unit.id)) : orderTree(previewUnits, open, showInactive);
    return visible;
  }, [previewUnits, open, showInactive, query, byId]);

  const draggedSubtree = React.useMemo(() => (dragId ? new Set([dragId, ...descendantIds(dragId, units)]) : null), [dragId, units]);

  const depthById = React.useMemo(() => {
    const all = orderTree(units, null, true);
    return new Map(all.map((r) => [r.unit.id, r.depth]));
  }, [units]);
  const indented = React.useCallback(
    (unit: Unit) => `${"  ".repeat(depthById.get(unit.id) ?? 0)}${unit.code} ${unitLabel(unit)}`,
    [depthById, unitLabel]
  );
  const allOrdered = React.useMemo(() => orderTree(units, null, true), [units]);

  function explain(code: string | null | undefined): string {
    if (code === "would_create_a_cycle") return t("cycleError");
    if (code === "code_taken") return t("codeTaken");
    if (code === "forbidden") return tc("forbidden");
    if (code === "unknown_level") return t("errors.unknown_level");
    if (code === "reassign_inside_subtree") return t("errors.reassign_inside_subtree");
    if (code === "reassign_required") return t("errors.reassign_required");
    if (code === "unknown_parent") return t("errors.unknown_parent");
    if (code === "duplicate_code") return t("errors.duplicate_code");
    return tc("error");
  }

  /* --------------------------- expand and collapse -------------------------- */

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = prev ? new Set(prev) : new Set(units.filter((u) => units.some((c) => c.parentId === u.id)).map((u) => u.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ------------------------------ the impact ------------------------------ */

  const loadImpact = React.useCallback(async (id: string) => {
    setImpactLoading(true);
    setImpact(null);
    const data = await editorGet<Impact>("impact", { id });
    setImpact(data);
    setImpactLoading(false);
  }, []);

  /* -------------------------------- moving -------------------------------- */

  function beginMove(id: string, targetId: string | null) {
    if (targetId) {
      setMove({ id, targetId, step: "confirm" });
      void loadImpact(id);
    } else {
      setMove({ id, targetId: null, step: "pick" });
    }
  }

  async function confirmMove() {
    if (!move || !move.targetId) return;
    const unit = byId.get(move.id);
    const target = byId.get(move.targetId);
    if (!unit || !target) return;
    setBusy("move");
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "unit.move", id: move.id, parentId: move.targetId });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.move", { unit: unitLabel(unit) }), inverse: res.data.inverse });
      toast(t("moved", { unit: unitLabel(unit), target: unitLabel(target) }), "success");
      setMove(null);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------- deactivate and delete ------------------------- */

  function beginRisk(id: string, mode: "delete" | "deactivate") {
    setRisk({ id, mode, reassignTo: "" });
    void loadImpact(id);
  }

  async function confirmRisk() {
    if (!risk) return;
    const unit = byId.get(risk.id);
    if (!unit) return;
    setBusy("risk");
    try {
      const res = await editorCall<{ inverse: Inverse; moved: number }>({
        action: "unit.retire",
        id: risk.id,
        mode: risk.mode,
        reassignTo: risk.reassignTo || null,
      });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return;
      }
      if (res.data?.inverse) {
        pushUndo({
          label: t(risk.mode === "delete" ? "undoLabels.delete" : "undoLabels.deactivate", { unit: unitLabel(unit) }),
          inverse: res.data.inverse,
        });
      }
      toast(t(risk.mode === "delete" ? "deleted" : "deactivated", { unit: unitLabel(unit), count: res.data?.moved ?? 0 }), "success");
      setRisk(null);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(unit: Unit) {
    setBusy("active");
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "unit.deactivateOnly", id: unit.id, active: true });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.reactivate", { unit: unitLabel(unit) }), inverse: res.data.inverse });
      toast(t("unitReactivated"), "success");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  /* ----------------------------- add and edit ------------------------------ */

  /** a new child takes the level its siblings use, else the next level down */
  function nextLevelAfter(parent: Unit | null): string {
    if (!parent) return levels[0]?.code ?? "department";
    const tally = new Map<string, number>();
    for (const u of units) {
      if (u.parentId === parent.id) tally.set(u.level, (tally.get(u.level) ?? 0) + 1);
    }
    const common = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (common) return common;
    const i = levels.findIndex((l) => l.code === parent.level);
    return levels[Math.min(levels.length - 1, i + 1)]?.code ?? levels[levels.length - 1]?.code ?? "department";
  }

  function openAdd(parentId: string | null) {
    const parent = parentId ? byId.get(parentId) ?? null : null;
    setDialog({ mode: "add", unit: null, parentId });
    setForm({ ...EMPTY_FORM, parentId: parentId ?? "", level: nextLevelAfter(parent) });
  }

  function openEdit(unit: Unit) {
    setDialog({ mode: "edit", unit, parentId: unit.parentId });
    setForm({
      code: unit.code,
      nameEn: unit.nameEn,
      nameAr: unit.nameAr,
      level: unit.level,
      parentId: unit.parentId ?? "",
      headMode: unit.headUserId ? "user" : unit.headNameEn || unit.headNameAr ? "external" : "none",
      headUserId: unit.headUserId ?? "",
      headNameEn: unit.headNameEn ?? "",
      headNameAr: unit.headNameAr ?? "",
      headTitleEn: unit.headTitleEn ?? "",
      headTitleAr: unit.headTitleAr ?? "",
      mandateEn: unit.mandateEn ?? "",
      mandateAr: unit.mandateAr ?? "",
      responsibilitiesEn: unit.responsibilitiesEn ?? "",
      responsibilitiesAr: unit.responsibilitiesAr ?? "",
      sort: String(unit.sort),
    });
  }

  function headFields() {
    if (form.headMode === "user") {
      return { headUserId: form.headUserId || null, headNameEn: null, headNameAr: null, headTitleEn: form.headTitleEn.trim() || null, headTitleAr: form.headTitleAr.trim() || null };
    }
    if (form.headMode === "external") {
      return {
        headUserId: null,
        headNameEn: form.headNameEn.trim() || null,
        headNameAr: form.headNameAr.trim() || null,
        headTitleEn: form.headTitleEn.trim() || null,
        headTitleAr: form.headTitleAr.trim() || null,
      };
    }
    return { headUserId: null, headNameEn: null, headNameAr: null, headTitleEn: null, headTitleAr: null };
  }

  async function submitDialog() {
    if (!dialog) return;
    setBusy("dialog");
    try {
      if (dialog.mode === "add") {
        const res = await editorCall<{ id: string; inverse: Inverse }>({
          action: "unit.add",
          code: form.code.trim(),
          nameEn: form.nameEn.trim(),
          nameAr: form.nameAr.trim(),
          level: form.level,
          parentId: form.parentId || null,
          ...headFields(),
          mandateEn: form.mandateEn.trim() || null,
          mandateAr: form.mandateAr.trim() || null,
          responsibilitiesEn: form.responsibilitiesEn.trim() || null,
          responsibilitiesAr: form.responsibilitiesAr.trim() || null,
          ...(form.sort.trim() ? { sort: Number(form.sort) } : {}),
        });
        if (!res.ok) {
          toast(explain(res.error), "error");
          return;
        }
        if (res.data?.inverse) pushUndo({ label: t("undoLabels.add", { unit: form.nameEn.trim() }), inverse: res.data.inverse });
        toast(t("unitAdded", { unit: bi(locale, form.nameEn.trim(), form.nameAr.trim()) }), "success");
      } else if (dialog.unit) {
        const unit = dialog.unit;
        const patch: Record<string, unknown> = {};
        if (form.code.trim() !== unit.code) patch.code = form.code.trim();
        if (form.nameEn.trim() !== unit.nameEn) patch.nameEn = form.nameEn.trim();
        if (form.nameAr.trim() !== unit.nameAr) patch.nameAr = form.nameAr.trim();
        if (form.level !== unit.level) patch.level = form.level;
        const heads = headFields();
        if ((heads.headUserId ?? null) !== (unit.headUserId ?? null)) patch.headUserId = heads.headUserId;
        if ((heads.headNameEn ?? null) !== (unit.headNameEn ?? null)) patch.headNameEn = heads.headNameEn;
        if ((heads.headNameAr ?? null) !== (unit.headNameAr ?? null)) patch.headNameAr = heads.headNameAr;
        if ((heads.headTitleEn ?? null) !== (unit.headTitleEn ?? null)) patch.headTitleEn = heads.headTitleEn;
        if ((heads.headTitleAr ?? null) !== (unit.headTitleAr ?? null)) patch.headTitleAr = heads.headTitleAr;
        if (form.mandateEn.trim() !== (unit.mandateEn ?? "")) patch.mandateEn = form.mandateEn.trim() || null;
        if (form.mandateAr.trim() !== (unit.mandateAr ?? "")) patch.mandateAr = form.mandateAr.trim() || null;
        if (form.responsibilitiesEn.trim() !== (unit.responsibilitiesEn ?? "")) patch.responsibilitiesEn = form.responsibilitiesEn.trim() || null;
        if (form.responsibilitiesAr.trim() !== (unit.responsibilitiesAr ?? "")) patch.responsibilitiesAr = form.responsibilitiesAr.trim() || null;
        if (form.sort.trim() && Number(form.sort) !== unit.sort) patch.sort = Number(form.sort);
        const parentId = form.parentId || null;
        if (Object.keys(patch).length) {
          const res = await editorCall<{ inverse: Inverse }>({ action: "unit.edit", id: unit.id, patch });
          if (!res.ok) {
            toast(explain(res.error), "error");
            return;
          }
          if (res.data?.inverse) pushUndo({ label: t("undoLabels.edit", { unit: unitLabel(unit) }), inverse: res.data.inverse });
        }
        if (parentId !== (unit.parentId ?? null)) {
          const res = await editorCall<{ inverse: Inverse }>({ action: "unit.move", id: unit.id, parentId });
          if (!res.ok) {
            toast(explain(res.error), "error");
            return;
          }
          if (res.data?.inverse) pushUndo({ label: t("undoLabels.move", { unit: unitLabel(unit) }), inverse: res.data.inverse });
        }
        toast(t("unitSaved"), "success");
      }
      setDialog(null);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------ inline rename ---------------------------- */

  async function saveRename() {
    if (!rename) return;
    const unit = byId.get(rename.id);
    if (!unit) return;
    const patch: Record<string, string> = {};
    if (rename.nameEn.trim() && rename.nameEn.trim() !== unit.nameEn) patch.nameEn = rename.nameEn.trim();
    if (rename.nameAr.trim() && rename.nameAr.trim() !== unit.nameAr) patch.nameAr = rename.nameAr.trim();
    if (!Object.keys(patch).length) {
      setRename(null);
      return;
    }
    setBusy("rename");
    try {
      const res = await editorCall<{ inverse: Inverse }>({ action: "unit.edit", id: unit.id, patch });
      if (!res.ok) {
        toast(explain(res.error), "error");
        return;
      }
      if (res.data?.inverse) pushUndo({ label: t("undoLabels.rename", { unit: unitLabel(unit) }), inverse: res.data.inverse });
      toast(t("renamed", { unit: bi(locale, patch.nameEn ?? unit.nameEn, patch.nameAr ?? unit.nameAr) }), "success");
      setRename(null);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  /* ---------------------------- drag and drop ----------------------------- */

  const canDropOnRef = React.useCallback(
    (fromId: string, targetId: string): boolean => {
      if (targetId === fromId) return false;
      if (descendantIds(fromId, units).has(targetId)) return false;
      const dragged = byId.get(fromId);
      return Boolean(dragged) && dragged!.parentId !== targetId;
    },
    [units, byId]
  );

  function canDropOn(targetId: string): boolean {
    return dragId ? canDropOnRef(dragId, targetId) : false;
  }

  /** the row under the pointer becomes the drop target, when it may be one */
  const targetAt = React.useCallback(
    (x: number, y: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const el = document.elementFromPoint(x, y);
      const row = el?.closest<HTMLElement>("[data-unit-id]");
      const target = row?.getAttribute("data-unit-id") ?? null;
      const next = target && canDropOnRef(drag.id, target) ? target : null;
      if (next !== drag.over) {
        drag.over = next;
        setOverId(next);
      }
    },
    [canDropOnRef]
  );

  /* a 39-row tree is taller than any screen: while a drag sits near the top
     or the bottom edge, the page scrolls on its own and the target under the
     (still) pointer is re-read */
  const stopAutoScroll = React.useCallback(() => {
    if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = null;
  }, []);
  const startAutoScroll = React.useCallback(() => {
    if (scrollRaf.current !== null) return;
    const EDGE = 72;
    const tick = () => {
      const drag = dragRef.current;
      if (!drag) {
        scrollRaf.current = null;
        return;
      }
      const h = window.innerHeight;
      let dy = 0;
      if (drag.y < EDGE) dy = -Math.ceil((EDGE - drag.y) / 6);
      else if (drag.y > h - EDGE) dy = Math.ceil((drag.y - (h - EDGE)) / 6);
      if (dy) {
        window.scrollBy(0, dy);
        targetAt(drag.x, drag.y);
      }
      scrollRaf.current = requestAnimationFrame(tick);
    };
    scrollRaf.current = requestAnimationFrame(tick);
  }, [targetAt]);
  React.useEffect(() => stopAutoScroll, [stopAutoScroll]);

  function onHandleDown(e: React.PointerEvent<HTMLSpanElement>, id: string) {
    if (!canEdit || e.button) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, over: null, moved: false, x: e.clientX, y: e.clientY };
    setDragId(id);
    setOverId(null);
    startAutoScroll();
  }

  function onHandleMove(e: React.PointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    targetAt(e.clientX, e.clientY);
  }

  function onHandleUp(e: React.PointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    stopAutoScroll();
    setDragId(null);
    setOverId(null);
    if (drag.over && e.type === "pointerup") beginMove(drag.id, drag.over);
  }

  /* Escape drops the drag without moving anything */
  React.useEffect(() => {
    if (!dragId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dragRef.current = null;
      stopAutoScroll();
      setDragId(null);
      setOverId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragId, stopAutoScroll]);

  const headOf = (unit: Unit): string => {
    if (unit.headUserId) {
      const person = usersById.get(unit.headUserId);
      if (person) return bi(locale, person.nameEn, person.nameAr);
    }
    return bi(locale, unit.headNameEn, unit.headNameAr);
  };

  const moveUnit = move ? byId.get(move.id) ?? null : null;
  const moveTarget = move?.targetId ? byId.get(move.targetId) ?? null : null;
  const riskUnit = risk ? byId.get(risk.id) ?? null : null;
  const riskExcluded = React.useMemo(() => (risk ? new Set([risk.id, ...descendantIds(risk.id, units)]) : new Set<string>()), [risk, units]);
  const moveExcluded = React.useMemo(() => (move ? new Set([move.id, ...descendantIds(move.id, units)]) : new Set<string>()), [move, units]);
  const canSaveDialog = form.code.trim().length >= 1 && form.nameEn.trim().length >= 2 && form.nameAr.trim().length >= 2;
  const iconButton =
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-mist-100 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500 disabled:cursor-default disabled:opacity-40";

  return (
    <div data-testid="org-tree-editor">
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-400" style={{ insetInlineStart: 10 }} aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filterUnits")}
            aria-label={t("filterUnits")}
            style={{ paddingInlineStart: 34 }}
            data-testid="org-editor-filter"
          />
        </div>
        <button type="button" onClick={() => setOpen(null)} className={cn(iconButton, "w-auto gap-1 px-2 text-xs")} aria-label={t("expandAll")} title={t("expandAll")}>
          <ChevronsUpDown className="size-3.5" /> {t("expandAll")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(new Set())}
          className={cn(iconButton, "w-auto gap-1 px-2 text-xs")}
          aria-label={t("collapseAll")}
          title={t("collapseAll")}
        >
          <ChevronsDownUp className="size-3.5" /> {t("collapseAll")}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-3.5 cursor-pointer accent-navy-700" />
          {t("showInactive")}
        </label>
        <Button size="sm" className="ms-auto" onClick={() => openAdd(null)} disabled={!canEdit} data-testid="org-unit-add">
          <Plus /> {t("addRoot")}
        </Button>
      </div>

      {/* the rows */}
      <div className="card divide-y divide-mist-100" role="tree" aria-label={t("editorTitle")}>
        {rows.length === 0 ? <p className="px-4 py-6 text-sm text-ink-600">{t("noUnits")}</p> : null}
        {rows.map(({ unit, depth, parentCode, hasChildren }) => {
          const label = unitLabel(unit);
          const isOpen = !open || open.has(unit.id);
          const inDrag = draggedSubtree?.has(unit.id) ?? false;
          const isOver = overId === unit.id && canDropOn(unit.id);
          const renaming = rename?.id === unit.id;
          return (
            <div
              key={unit.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={renaming}
              aria-expanded={hasChildren ? isOpen : undefined}
              data-testid="org-editor-row"
              data-unit-id={unit.id}
              data-unit-code={unit.code}
              data-parent-code={parentCode ?? ""}
              data-drop-target={isOver ? "true" : undefined}
              className={cn(
                "flex flex-wrap items-center gap-2 py-2 pe-3 transition-colors",
                dragId && "select-none",
                isOver && "bg-navy-100/50 ring-2 ring-inset ring-navy-500",
                inDrag && dragId !== unit.id && "bg-aqua-100/50",
                dragId === unit.id && "opacity-60"
              )}
              style={{ paddingInlineStart: 8 + depth * 20 }}
            >
              <span
                onPointerDown={(e) => !renaming && onHandleDown(e, unit.id)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                aria-label={t("dragHandle", { unit: label })}
                title={t("dragHandle", { unit: label })}
                data-testid="org-editor-drag"
                style={{ touchAction: "none" }}
                className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-ink-400", canEdit ? "cursor-grab active:cursor-grabbing hover:text-navy-700" : "opacity-40")}
              >
                <GripVertical className="size-4" aria-hidden />
              </span>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleOpen(unit.id)}
                  aria-label={isOpen ? t("collapseAll") : t("expandAll")}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-400 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90 rtl:rotate-90")} aria-hidden />
                </button>
              ) : (
                <span aria-hidden className="size-6 shrink-0" />
              )}

              <span className="min-w-56 flex-1">
                {renaming ? (
                  <span className="flex flex-wrap items-center gap-2" data-testid="org-rename-form">
                    <Input
                      value={rename.nameEn}
                      onChange={(e) => setRename({ ...rename, nameEn: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename();
                        if (e.key === "Escape") setRename(null);
                      }}
                      dir="ltr"
                      aria-label={t("nameEn")}
                      className="h-8 min-w-48 flex-1 text-xs"
                      data-testid="org-rename-en"
                      autoFocus
                    />
                    <Input
                      value={rename.nameAr}
                      onChange={(e) => setRename({ ...rename, nameAr: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename();
                        if (e.key === "Escape") setRename(null);
                      }}
                      dir="rtl"
                      aria-label={t("nameAr")}
                      className="h-8 min-w-48 flex-1 text-xs"
                      data-testid="org-rename-ar"
                    />
                    <button type="button" onClick={saveRename} className={iconButton} aria-label={t("renameSave")} data-testid="org-rename-save" disabled={busy === "rename"}>
                      <Check className="size-4 text-ok" />
                    </button>
                    <button type="button" onClick={() => setRename(null)} className={iconButton} aria-label={tc("cancel")}>
                      <X className="size-4" />
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-ink-400 tnum" dir="ltr">
                        {unit.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => canEdit && setRename({ id: unit.id, nameEn: unit.nameEn, nameAr: unit.nameAr })}
                        className={cn("cursor-text rounded text-start font-medium text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500", !unit.isActive && "text-ink-600", canEdit && "hover:text-navy-700")}
                        aria-label={t("renameAria", { unit: label })}
                        data-testid="org-editor-rename"
                        disabled={!canEdit}
                      >
                        {label}
                      </button>
                      <Chip tone="mist">{levelLabel(unit.level)}</Chip>
                      {!unit.isActive ? <Chip tone="ghost">{t("inactive")}</Chip> : null}
                    </span>
                    <span className="block text-xs text-ink-400" dir="auto">
                      {locale === "ar" ? unit.nameEn : unit.nameAr}
                    </span>
                  </>
                )}
              </span>

              <span className="hidden min-w-36 text-xs text-ink-600 md:block">
                {headOf(unit) ? <span className="block truncate text-ink-900">{headOf(unit)}</span> : <span className="text-ink-400">{t("headVacant")}</span>}
              </span>
              <span className="hidden text-xs text-ink-400 tnum lg:block">{t("staffCount", { count: unit.headcount })}</span>

              <button type="button" onClick={() => openAdd(unit.id)} className={iconButton} aria-label={t("addChild", { unit: label })} title={t("addChild", { unit: label })} disabled={!canEdit} data-testid="org-editor-add">
                <Plus className="size-4" />
              </button>
              <Dropdown>
                <DropdownTrigger asChild>
                  <button type="button" className={iconButton} aria-label={t("menu", { unit: label })} disabled={!canEdit} data-testid="org-editor-menu">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end">
                  <DropdownItem onSelect={() => openEdit(unit)} data-testid="org-menu-edit">
                    <Pencil /> {t("menuEdit")}
                  </DropdownItem>
                  <DropdownItem onSelect={() => openAdd(unit.id)} data-testid="org-menu-add">
                    <Plus /> {t("menuAddChild")}
                  </DropdownItem>
                  <DropdownItem onSelect={() => beginMove(unit.id, null)} data-testid="org-menu-move">
                    <FolderInput /> {t("menuMove")}
                  </DropdownItem>
                  <DropdownSeparator />
                  {unit.isActive ? (
                    <DropdownItem onSelect={() => beginRisk(unit.id, "deactivate")} data-testid="org-menu-deactivate">
                      <Power /> {t("menuDeactivate")}
                    </DropdownItem>
                  ) : (
                    <DropdownItem onSelect={() => void reactivate(unit)} data-testid="org-menu-reactivate">
                      <Power /> {t("menuReactivate")}
                    </DropdownItem>
                  )}
                  <DropdownItem onSelect={() => beginRisk(unit.id, "delete")} className="text-danger [&_svg]:text-danger" data-testid="org-menu-delete">
                    <Trash2 /> {t("menuDelete")}
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </div>
          );
        })}
      </div>
      {dragId && overId && canDropOn(overId) ? (
        <p className="mt-2 text-xs text-navy-700" role="status" data-testid="org-move-preview">
          {t("movePreview", { unit: unitLabel(byId.get(dragId)!), target: unitLabel(byId.get(overId)!) })}
        </p>
      ) : null}

      {/* move: pick a target, then confirm with the counts */}
      <Dialog open={Boolean(move)} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent
          title={move?.step === "confirm" && moveUnit && moveTarget ? t("confirmMoveTitle", { unit: unitLabel(moveUnit), target: unitLabel(moveTarget) }) : t("moveTitle", { unit: moveUnit ? unitLabel(moveUnit) : "" })}
          className="w-[min(560px,94vw)]"
          data-testid="org-move-dialog"
        >
          {move?.step === "pick" ? (
            <div>
              <Label htmlFor={`${uid}-move-target`}>{t("moveTarget")}</Label>
              <NativeSelect
                id={`${uid}-move-target`}
                value={move.targetId ?? ""}
                onChange={(e) => setMove({ ...move, targetId: e.target.value || null })}
                className="cursor-pointer"
                data-testid="org-move-target"
              >
                <option value="">{tc("choose")}</option>
                {allOrdered.filter(({ unit }) => !moveExcluded.has(unit.id)).map(({ unit }) => (
                  <option key={unit.id} value={unit.id}>
                    {indented(unit)}
                  </option>
                ))}
              </NativeSelect>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMove(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  disabled={!move.targetId}
                  onClick={() => {
                    if (!move.targetId) return;
                    setMove({ ...move, step: "confirm" });
                    void loadImpact(move.id);
                  }}
                  data-testid="org-move-next"
                >
                  {t("confirmMove")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink-600">{t("confirmMoveHint")}</p>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("movesWith")}</p>
              <ImpactList impact={impact} loading={impactLoading} />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMove(null)}>
                  {tc("cancel")}
                </Button>
                <Button loading={busy === "move"} onClick={confirmMove} disabled={impactLoading} data-testid="org-move-confirm">
                  {t("confirmMove")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* the risk dialog for delete and deactivate */}
      <Dialog open={Boolean(risk)} onOpenChange={(o) => !o && setRisk(null)}>
        <DialogContent
          title={riskUnit ? t(risk?.mode === "delete" ? "riskTitleDelete" : "riskTitleDeactivate", { unit: unitLabel(riskUnit) }) : ""}
          className="w-[min(600px,94vw)]"
          data-testid="org-risk-dialog"
        >
          <p className="text-sm text-ink-600">{t("riskHint")}</p>
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("riskBeneath")}</p>
          <ImpactList impact={impact} loading={impactLoading} />
          {impact && impact.subUnits.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {impact.subUnits.slice(0, 12).map((s) => (
                <li key={s.id}>
                  <Chip tone="mist">{bi(locale, s.nameEn, s.nameAr)}</Chip>
                </li>
              ))}
              {impact.subUnits.length > 12 ? <li className="text-xs text-ink-400 tnum">+{impact.subUnits.length - 12}</li> : null}
            </ul>
          ) : null}
          {impact && impact.total > 0 ? (
            <div className="mt-4">
              <Label htmlFor={`${uid}-reassign`}>{t("reassignTo")}</Label>
              <NativeSelect
                id={`${uid}-reassign`}
                value={risk?.reassignTo ?? ""}
                onChange={(e) => risk && setRisk({ ...risk, reassignTo: e.target.value })}
                className="cursor-pointer"
                data-testid="org-risk-target"
              >
                <option value="">{t("reassignChoose")}</option>
                {allOrdered.filter(({ unit }) => !riskExcluded.has(unit.id) && unit.isActive).map(({ unit }) => (
                  <option key={unit.id} value={unit.id}>
                    {indented(unit)}
                  </option>
                ))}
              </NativeSelect>
              {!risk?.reassignTo ? <p className="mt-1.5 text-[11px] text-warn">{t("reassignRequired")}</p> : null}
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRisk(null)} data-testid="org-risk-cancel">
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy === "risk"}
              disabled={impactLoading || !impact || (impact.total > 0 && !risk?.reassignTo)}
              onClick={confirmRisk}
              data-testid="org-risk-confirm"
            >
              {t(risk?.mode === "delete" ? "confirmDelete" : "confirmDeactivate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* add or edit */}
      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          title={
            dialog?.mode === "edit" && dialog.unit
              ? t("editTitle", { unit: unitLabel(dialog.unit) })
              : dialog?.parentId && byId.get(dialog.parentId)
                ? t("newUnitTitle", { parent: unitLabel(byId.get(dialog.parentId)!) })
                : t("newRootTitle")
          }
          className="max-h-[88vh] w-[min(720px,94vw)] overflow-y-auto"
          data-testid="org-unit-dialog"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${uid}-code`}>{t("code")}</Label>
              <Input id={`${uid}-code`} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" placeholder="IDP" data-testid="org-unit-code" />
            </div>
            <div>
              <Label htmlFor={`${uid}-level`}>{t("level")}</Label>
              <NativeSelect id={`${uid}-level`} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} className="cursor-pointer" data-testid="org-unit-level">
                {levels.map((level) => (
                  <option key={level.code} value={level.code}>
                    {bi(locale, level.nameEn, level.nameAr)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor={`${uid}-name-en`}>{t("nameEn")}</Label>
              <Input id={`${uid}-name-en`} value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} dir="ltr" data-testid="org-unit-name-en" />
            </div>
            <div>
              <Label htmlFor={`${uid}-name-ar`}>{t("nameAr")}</Label>
              <Input id={`${uid}-name-ar`} value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" data-testid="org-unit-name-ar" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${uid}-parent`}>{t("parent")}</Label>
              <NativeSelect id={`${uid}-parent`} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} className="cursor-pointer">
                <option value="">{t("noParent")}</option>
                {allOrdered.filter(({ unit }) => unit.id !== dialog?.unit?.id).map(({ unit }) => (
                  <option key={unit.id} value={unit.id}>
                    {indented(unit)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${uid}-head`}>{t("head")}</Label>
              <NativeSelect
                id={`${uid}-head`}
                value={form.headMode === "user" ? form.headUserId : form.headMode}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none" || value === "external") setForm((f) => ({ ...f, headMode: value, headUserId: "" }));
                  else setForm((f) => ({ ...f, headMode: "user", headUserId: value }));
                }}
                className="cursor-pointer"
              >
                <option value="none">{t("headNone")}</option>
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {bi(locale, person.nameEn, person.nameAr)}
                  </option>
                ))}
                <option value="external">{t("headExternal")}</option>
              </NativeSelect>
            </div>
            {form.headMode === "external" ? (
              <>
                <div>
                  <Label htmlFor={`${uid}-head-name-en`}>{t("headNameEn")}</Label>
                  <Input id={`${uid}-head-name-en`} value={form.headNameEn} onChange={(e) => setForm((f) => ({ ...f, headNameEn: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <Label htmlFor={`${uid}-head-name-ar`}>{t("headNameAr")}</Label>
                  <Input id={`${uid}-head-name-ar`} value={form.headNameAr} onChange={(e) => setForm((f) => ({ ...f, headNameAr: e.target.value }))} dir="rtl" />
                </div>
              </>
            ) : null}
            {form.headMode !== "none" ? (
              <>
                <div>
                  <Label htmlFor={`${uid}-head-title-en`}>{t("headTitleEn")}</Label>
                  <Input id={`${uid}-head-title-en`} value={form.headTitleEn} onChange={(e) => setForm((f) => ({ ...f, headTitleEn: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <Label htmlFor={`${uid}-head-title-ar`}>{t("headTitleAr")}</Label>
                  <Input id={`${uid}-head-title-ar`} value={form.headTitleAr} onChange={(e) => setForm((f) => ({ ...f, headTitleAr: e.target.value }))} dir="rtl" />
                </div>
              </>
            ) : null}
            <div>
              <Label htmlFor={`${uid}-mandate-en`}>{t("mandateEn")}</Label>
              <Textarea id={`${uid}-mandate-en`} value={form.mandateEn} onChange={(e) => setForm((f) => ({ ...f, mandateEn: e.target.value }))} dir="ltr" className="min-h-20 text-xs" placeholder={t("mandateHint")} />
            </div>
            <div>
              <Label htmlFor={`${uid}-mandate-ar`}>{t("mandateAr")}</Label>
              <Textarea id={`${uid}-mandate-ar`} value={form.mandateAr} onChange={(e) => setForm((f) => ({ ...f, mandateAr: e.target.value }))} dir="rtl" className="min-h-20 text-xs" placeholder={t("mandateHint")} />
            </div>
            <div>
              <Label htmlFor={`${uid}-resp-en`}>{t("responsibilitiesEn")}</Label>
              <Textarea id={`${uid}-resp-en`} value={form.responsibilitiesEn} onChange={(e) => setForm((f) => ({ ...f, responsibilitiesEn: e.target.value }))} dir="ltr" className="min-h-16 text-xs" />
            </div>
            <div>
              <Label htmlFor={`${uid}-resp-ar`}>{t("responsibilitiesAr")}</Label>
              <Textarea id={`${uid}-resp-ar`} value={form.responsibilitiesAr} onChange={(e) => setForm((f) => ({ ...f, responsibilitiesAr: e.target.value }))} dir="rtl" className="min-h-16 text-xs" />
            </div>
            <div>
              <Label htmlFor={`${uid}-sort`}>{t("sortLabel")}</Label>
              <Input id={`${uid}-sort`} type="number" value={form.sort} onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))} dir="ltr" className="w-32" />
              <p className="mt-1 text-[11px] text-ink-400">{t("sortHint")}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {tc("cancel")}
            </Button>
            <Button loading={busy === "dialog"} disabled={!canSaveDialog} onClick={submitDialog} data-testid="org-unit-save">
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
