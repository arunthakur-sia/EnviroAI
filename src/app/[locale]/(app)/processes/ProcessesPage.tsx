"use client";
// CR08 10.1: the Processes page shell. The header with the Internal and
// Illustrative chips and the view switch, the three views (the process map
// with its in-place Level 1 panel, by unit, by policy type), the 520px
// process panel over any of them, and the add, edit, delete and RACI editing
// for the Strategy Office, Super Admins and unit heads. State lives in the
// query string, so Back unwinds the panel and the expanded chain.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Building2, FileStack, Landmark, ListTree, Plus } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { ProcessDetail, ProcessMap as ProcessMapData, ProcessMapNode, ProcessSummary, UnitRef } from "@/server/services/operating-model";
import type { PolicyTab } from "@/server/services/organisation";
import type { UnitHeadRef } from "@/server/services/operating-model-unit";
import { ProcessMap } from "@/components/nexus/processes/ProcessMap";
import { Level1Panel } from "@/components/nexus/processes/Level1Panel";
import { ProcessPanel } from "@/components/nexus/processes/ProcessPanel";
import { ProcessEditor, type EditorDefaults } from "@/components/nexus/processes/ProcessEditor";
import { ByUnitView } from "@/components/nexus/processes/ByUnitView";
import { ByPolicyView } from "@/components/nexus/processes/ByPolicyView";
import { callApi, displayFont, invalidateProcesses } from "@/components/nexus/processes/shared";

export type ProcessesView = "process" | "unit" | "policy";

export type ProcessesInitialState = {
  view: ProcessesView;
  p: string | null;
  l0: string | null;
  unit: string | null;
  tab: PolicyTab;
};

type State = ProcessesInitialState;

const VIEWS: ProcessesView[] = ["process", "unit", "policy"];
const TABS: PolicyTab[] = ["policy_internal", "procedure", "form_template", "service"];
const VIEW_ICON: Record<ProcessesView, React.ReactNode> = {
  process: <ListTree className="size-3.5 flip-rtl" aria-hidden />,
  unit: <Building2 className="size-3.5" aria-hidden />,
  policy: <FileStack className="size-3.5" aria-hidden />,
};

function stateQuery(s: State): string {
  const params = new URLSearchParams();
  if (s.view !== "process") params.set("view", s.view);
  if (s.l0) params.set("l0", s.l0);
  if (s.p) params.set("p", s.p);
  if (s.unit) params.set("unit", s.unit);
  if (s.tab !== "policy_internal") params.set("tab", s.tab);
  const q = params.toString();
  return q ? `?${q}` : "";
}

function parseState(search: string): State {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const tab = params.get("tab");
  return {
    view: VIEWS.includes(view as ProcessesView) ? (view as ProcessesView) : "process",
    p: params.get("p"),
    l0: params.get("l0"),
    unit: params.get("unit"),
    tab: TABS.includes(tab as PolicyTab) ? (tab as PolicyTab) : "policy_internal",
  };
}

function flatten(chain: ProcessMapNode[]): ProcessSummary[] {
  const out: ProcessSummary[] = [];
  for (const l0 of chain) {
    out.push(l0);
    for (const l1 of l0.children) {
      out.push(l1);
      for (const l2 of l1.children) out.push(l2);
    }
  }
  return out;
}

type EditorState = { mode: "create" | "edit"; initial: ProcessDetail | null; defaults: EditorDefaults | null };

export function ProcessesPage({
  map,
  initialProcess,
  initialState,
  unitHeads,
  units,
  editableUnitIds,
}: {
  map: ProcessMapData;
  initialProcess: ProcessDetail | null;
  initialState: ProcessesInitialState;
  unitHeads: Record<string, UnitHeadRef>;
  units: UnitRef[];
  /** the units whose processes the reader may write (every unit for an editor) */
  editableUnitIds: string[];
}) {
  const t = useTranslations("processes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { toast } = useToast();

  const [state, setState] = React.useState<State>(initialState);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [deleting, setDeleting] = React.useState<ProcessDetail | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  /* set once hydrated, so probes wait on a fact rather than a delay */
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const depthRef = React.useRef(0);
  const anchorRef = React.useRef<HTMLDivElement>(null);

  const all = React.useMemo(() => flatten(map.chain), [map.chain]);
  const byId = React.useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const byCode = React.useMemo(() => new Map(all.map((p) => [p.code.toLowerCase(), p])), [all]);
  const unitDocs = React.useMemo(() => Object.fromEntries(map.byUnit.map((u) => [u.unit.id, u.policies])), [map.byUnit]);
  const editable = React.useMemo(() => new Set(editableUnitIds), [editableUnitIds]);

  const level0Of = React.useCallback(
    (code: string | null): ProcessMapNode | null => {
      if (!code) return null;
      let cursor = byCode.get(code.toLowerCase()) ?? null;
      for (let i = 0; i < 4 && cursor && cursor.level > 0; i++) cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
      return cursor ? map.chain.find((n) => n.id === cursor!.id) ?? null : null;
    },
    [byCode, byId, map.chain]
  );

  const selectedL0 = React.useMemo(() => {
    const explicit = state.l0 ? map.chain.find((n) => n.code.toLowerCase() === state.l0!.toLowerCase()) ?? null : null;
    return explicit ?? level0Of(state.p);
  }, [state.l0, state.p, map.chain, level0Of]);

  const canAddAny = map.canEdit || editableUnitIds.length > 0;
  const canWriteUnder = React.useCallback(
    (owner: UnitRef | null | undefined) => map.canEdit || Boolean(owner && editable.has(owner.id)),
    [map.canEdit, editable]
  );

  /* ---- URL state, the way the Programme Strategy does it ---- */

  const applyUrl = React.useCallback(
    (next: State, push: boolean) => {
      const url = `/${locale}/processes${stateQuery(next)}`;
      if (push) {
        window.history.pushState({ processes: true }, "", url);
        depthRef.current++;
      } else {
        window.history.replaceState({ processes: true }, "", url);
      }
    },
    [locale]
  );

  React.useEffect(() => {
    function onPop() {
      setState(parseState(window.location.search));
      depthRef.current = Math.max(0, depthRef.current - 1);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const closeLevel = React.useCallback(
    (next: State) => {
      if (depthRef.current > 0) {
        window.history.back(); // popstate applies the previous state
      } else {
        setState(next);
        applyUrl(next, false);
      }
    },
    [applyUrl]
  );

  const toggleL0 = (node: ProcessMapNode) => {
    if (selectedL0?.id === node.id && !state.p) {
      closeLevel({ ...state, l0: null, p: null });
      return;
    }
    const next: State = { ...state, l0: node.code, p: null };
    setState(next);
    applyUrl(next, true);
  };

  const openProcess = (code: string) => {
    const l0 = level0Of(code);
    const next: State = { ...state, p: code, l0: l0?.code ?? state.l0 };
    setState(next);
    applyUrl(next, true);
  };

  /** breadcrumbs and children replace, so Back still closes the panel.
   *  The URL is written here and never inside the state updater: replaceState
   *  reaches the Next router, and a router update during another component's
   *  render is a React error. */
  const navigatePanel = React.useCallback(
    (code: string) => {
      const next: State = { ...state, p: code, l0: level0Of(code)?.code ?? state.l0 };
      setState(next);
      applyUrl(next, false);
    },
    [applyUrl, level0Of, state]
  );

  const closePanel = React.useCallback(() => {
    closeLevel({ ...state, p: null });
  }, [closeLevel, state]);

  const switchView = (view: ProcessesView) => {
    const next: State = { ...state, view };
    setState(next);
    applyUrl(next, false);
  };
  const setUnit = (unit: string | null) => {
    const next: State = { ...state, unit };
    setState(next);
    applyUrl(next, false);
  };
  const setTab = (tab: PolicyTab) => {
    const next: State = { ...state, tab };
    setState(next);
    applyUrl(next, false);
  };

  /* a deep link brings the expanded chain into view once */
  React.useEffect(() => {
    if (initialState.view !== "process" || (!initialState.l0 && !initialState.p)) return;
    depthRef.current = 0;
    const timer = setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 420);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- writes ---- */

  const afterWrite = React.useCallback(() => {
    invalidateProcesses();
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  const openEditor = (mode: "create" | "edit", initial: ProcessDetail | null, defaults: EditorDefaults | null) =>
    setEditor({ mode, initial, defaults });

  const addUnder = (parent: ProcessSummary | null) => {
    const level = (parent ? Math.min(2, parent.level + 1) : 0) as 0 | 1 | 2;
    const ownerUnitId = parent?.ownerUnit && canWriteUnder(parent.ownerUnit) ? parent.ownerUnit.id : editableUnitIds[0] ?? null;
    openEditor("create", null, { level, parentId: parent?.id ?? null, ownerUnitId: map.canEdit ? parent?.ownerUnit?.id ?? null : ownerUnitId });
  };

  const onSaved = (result: { id: string; code: string }) => {
    const wasCreate = editor?.mode === "create";
    setEditor(null);
    afterWrite();
    if (wasCreate) navigatePanel(result.code);
    else if (state.p && state.p.toLowerCase() !== result.code.toLowerCase()) navigatePanel(result.code);
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await callApi(`/api/v1/processes?id=${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      if (res.status === 200) {
        toast(t("panel.deleted"), "success");
        setDeleting(null);
        /* the panel drops in the same commit as the refresh, so it never
           refetches the process that has just gone, and the deleted code is
           replaced in history rather than left behind for the Back button */
        const next: State = { ...state, p: null };
        setState(next);
        applyUrl(next, false);
        afterWrite();
      } else if (res.body.error === "has_children") {
        toast(t("panel.deleteBlocked"), "error");
      } else {
        toast(t("panel.deleteFailed"), "error");
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  const keyboardLocked = Boolean(editor) || Boolean(deleting);

  return (
    <div className="relative" data-testid="processes-page" data-view={state.view} data-ready={ready || undefined}>
      {/* the header */}
      <header className="mb-6" data-testid="processes-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="navy" title={t("internalTitle")} data-testid="internal-chip">
                {t("internal")}
              </Chip>
              {map.totals.illustrative > 0 ? (
                <Chip tone="aqua" title={t("illustrativeTitle")} data-testid="illustrative-chip">
                  {t("illustrative")}
                </Chip>
              ) : null}
            </div>
            <h1 className="text-[28px] leading-tight sm:text-[34px]" style={{ fontFamily: displayFont(locale) }}>
              {t("title")}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
            <p className="mt-1 text-[12px] text-ink-400 tnum" data-testid="processes-totals">
              {t("totals", { level0: map.totals.level0, level1: map.totals.level1, level2: map.totals.level2 })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-0.5 rounded-lg bg-mist-100 p-0.5"
              role="group"
              aria-label={t("views.aria")}
              data-testid="processes-view-switch"
            >
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => switchView(v)}
                  aria-pressed={state.view === v}
                  data-testid={`processes-view-${v}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
                    state.view === v ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600 hover:text-navy-900"
                  )}
                >
                  {VIEW_ICON[v]} {t(`views.${v}` as never)}
                </button>
              ))}
            </span>
            {canAddAny ? (
              <Button onClick={() => addUnder(null)} data-testid="processes-add">
                <Plus /> {t("addProcess")}
              </Button>
            ) : null}
            <Link
              href="/operating-model"
              className="inline-flex h-9.5 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-navy-100/60 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
            >
              <Landmark className="size-4" aria-hidden /> {t("openOperatingModel")}
            </Link>
          </div>
        </div>
      </header>

      {state.view === "unit" ? (
        <ByUnitView
          key={`unit-${initialState.unit ?? ""}`}
          byUnit={map.byUnit}
          initialUnit={state.unit}
          tab={state.tab}
          onUnitChange={setUnit}
          onTab={setTab}
          onOpenProcess={openProcess}
        />
      ) : state.view === "policy" ? (
        <ByPolicyView byPolicyType={map.byPolicyType} tab={state.tab} onTab={setTab} />
      ) : (
        <ProcessMap
          chain={map.chain}
          selectedCode={selectedL0?.code ?? null}
          onToggle={toggleL0}
          onEscape={() => (state.p ? closePanel() : selectedL0 ? closeLevel({ ...state, l0: null, p: null }) : undefined)}
          anchorRef={anchorRef}
          panelKey={selectedL0?.id ?? null}
          panel={
            selectedL0 ? (
              <Level1Panel
                node={selectedL0}
                unitHeads={unitHeads}
                onOpen={openProcess}
                onClose={() => closeLevel({ ...state, l0: null, p: null })}
                canAdd={canWriteUnder(selectedL0.ownerUnit) || (!map.canEdit && editableUnitIds.length > 0)}
                onAdd={() => addUnder(selectedL0)}
              />
            ) : null
          }
        />
      )}

      {/* the process panel over any view */}
      <AnimatePresence>
        {state.p ? (
          <ProcessPanel
            key="process-panel"
            code={state.p}
            initial={initialProcess}
            unitHeads={unitHeads}
            units={units}
            canEditRaci={map.canEdit}
            canAddChild={(d) => canWriteUnder(d.ownerUnit) || (!map.canEdit && editableUnitIds.length > 0)}
            keyboardLocked={keyboardLocked}
            refreshKey={refreshKey}
            onNavigate={navigatePanel}
            onClose={closePanel}
            onEdit={(d) => openEditor("edit", d, null)}
            onDelete={(d) => setDeleting(d)}
            onAddChild={(d) => addUnder(d)}
            onChanged={afterWrite}
          />
        ) : null}
      </AnimatePresence>

      {/* the editor */}
      {editor ? (
        <ProcessEditor
          open
          mode={editor.mode}
          initial={editor.initial}
          defaults={editor.defaults}
          units={units}
          allowedUnitIds={map.canEdit ? null : editableUnitIds}
          processes={all}
          unitDocs={unitDocs}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      ) : null}

      {/* delete confirmation */}
      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && !deleteBusy && setDeleting(null)}>
        {deleting ? (
          <DialogContent
            title={t("panel.deleteTitle", { code: deleting.code })}
            /* above the process panel (z-60) that opens it */
            className="z-[75]"
            data-testid="process-delete-dialog"
            data-editor-dialog
            /* Escape closes this dialog only, never the panel beneath it */
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              if (!deleteBusy) setDeleting(null);
            }}
          >
            <p className="text-sm leading-relaxed text-ink-600">
              {t("panel.deleteText", { title: locale === "ar" ? deleting.nameAr : deleting.nameEn })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                {tc("cancel")}
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} loading={deleteBusy} data-testid="process-delete-confirm">
                {t("panel.delete")}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
