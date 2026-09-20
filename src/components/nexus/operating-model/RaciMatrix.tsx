"use client";
// CR08 10.2 section 4: the RACI matrix. Level 1 processes as rows grouped
// under their Level 0 parent, units as columns, R/A/C/I as coloured chips.
// A CSS grid with ARIA table roles (no <table>), the first column and the
// header sticky inside a horizontal scroll container, filters by Level 0
// group and by unit, roving-focus keyboard navigation, and for editors a
// click (or Enter) that cycles blank, R, A, C, I through PUT /raci with the
// 409 accountable_exists answered as a toast.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { bi, cn } from "@/lib/utils";
import { Chip, EmptyState, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { ProcessMapNode, RaciMatrix as RaciMatrixData, RaciRole, UnitRef } from "@/server/services/operating-model";
import { RACI_TONE, SectionBand, omFetch } from "./shared";

const ROLES: RaciRole[] = ["R", "A", "C", "I"];
const CYCLE: (RaciRole | null)[] = [null, "R", "A", "C", "I"];
const FIRST_COL = 248;
const UNIT_COL = 52;

function cellKey(processId: string, unitId: string): string {
  return `${processId}|${unitId}`;
}

export function RaciMatrix({
  raci,
  chain,
  canEdit,
  n,
}: {
  raci: RaciMatrixData;
  chain: ProcessMapNode[];
  canEdit: boolean;
  n: number;
}) {
  const t = useTranslations("operatingModel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [group, setGroup] = React.useState("all");
  const [unit, setUnit] = React.useState("all");
  const [cells, setCells] = React.useState<Map<string, RaciRole>>(() => new Map());
  const [busy, setBusy] = React.useState<string | null>(null);
  /* the same guard as `busy`, read synchronously so two fast clicks cannot both start a write */
  const busyRef = React.useRef<string | null>(null);
  const [active, setActive] = React.useState<{ r: number; c: number }>({ r: 0, c: 0 });
  /* processes whose A was refused since the last successful write on them: the cycle skips A */
  const refusedA = React.useRef(new Set<string>());

  React.useEffect(() => {
    setCells(new Map(raci.cells.map((c) => [cellKey(c.processId, c.unitId), c.role])));
  }, [raci.cells]);

  const groups = React.useMemo(
    () => chain.map((l0) => ({ code: l0.code, nameEn: l0.nameEn, nameAr: l0.nameAr })),
    [chain]
  );
  const unitsById = React.useMemo(() => new Map(raci.units.map((u) => [u.id, u])), [raci.units]);

  const rows = React.useMemo(() => {
    const list = raci.processes.filter((p) => group === "all" || p.parentCode === group);
    if (unit === "all") return list;
    return list.filter((p) => cells.has(cellKey(p.id, unit)));
  }, [raci.processes, group, unit, cells]);

  const columns: UnitRef[] = raci.units;
  const rowIndex = new Map(rows.map((p, i) => [p.id, i]));

  /* rows grouped under their Level 0 parent, in chain order */
  const grouped = React.useMemo(() => {
    const out: { code: string | null; label: string; rows: typeof rows }[] = [];
    for (const p of rows) {
      const last = out[out.length - 1];
      if (last && last.code === p.parentCode) {
        last.rows.push(p);
      } else {
        const g = groups.find((x) => x.code === p.parentCode);
        out.push({ code: p.parentCode, label: g ? `${g.code} ${bi(locale, g.nameEn, g.nameAr)}` : p.parentCode ?? "", rows: [p] });
      }
    }
    return out;
  }, [rows, groups, locale]);

  const focusCell = React.useCallback((r: number, c: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    el?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent, r: number, c: number, process: (typeof rows)[number], u: UnitRef) {
    const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const backward = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    let nr = r;
    let nc = c;
    if (e.key === "ArrowDown") nr = Math.min(rows.length - 1, r + 1);
    else if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
    else if (e.key === forward) nc = Math.min(columns.length - 1, c + 1);
    else if (e.key === backward) nc = Math.max(0, c - 1);
    else if (e.key === "Home") nc = 0;
    else if (e.key === "End") nc = columns.length - 1;
    else if ((e.key === "Enter" || e.key === " ") && canEdit) {
      e.preventDefault();
      void cycle(process, u);
      return;
    } else if ((e.key === "Delete" || e.key === "Backspace") && canEdit) {
      e.preventDefault();
      void cycle(process, u, null);
      return;
    } else return;
    e.preventDefault();
    setActive({ r: nr, c: nc });
    focusCell(nr, nc);
  }

  async function cycle(process: (typeof rows)[number], u: UnitRef, forced?: RaciRole | null) {
    const key = cellKey(process.id, u.id);
    if (busyRef.current) return;
    const current = cells.get(key) ?? null;
    let next = forced === undefined ? CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] : forced;
    if (next === "A" && forced === undefined && refusedA.current.has(process.id) && current !== "A") next = "C";
    if (next === current) return;
    const previous = new Map(cells);
    const optimistic = new Map(cells);
    if (next) optimistic.set(key, next);
    else optimistic.delete(key);
    setCells(optimistic);
    busyRef.current = key;
    setBusy(key);
    const res = await omFetch<{ role: RaciRole | null }>("/api/v1/operating-model/raci", {
      method: "PUT",
      body: { processId: process.id, unitId: u.id, role: next },
    });
    busyRef.current = null;
    setBusy(null);
    const pName = `${process.code} ${bi(locale, process.nameEn, process.nameAr)}`;
    if (res.ok) {
      refusedA.current.delete(process.id);
      toast(
        next
          ? t("raci.saved", { process: process.code, unit: u.code, role: next })
          : t("raci.cleared", { process: process.code, unit: u.code }),
        "success"
      );
      return;
    }
    setCells(previous);
    if (res.status === 409 && res.error === "accountable_exists") {
      refusedA.current.add(process.id);
      const holderId = typeof res.detail?.accountableUnitId === "string" ? res.detail.accountableUnitId : null;
      const holder = holderId ? unitsById.get(holderId) : null;
      toast(t("raci.accountableExists", { unit: holder ? bi(locale, holder.nameEn, holder.nameAr) : "?" }), "error");
    } else if (res.status === 403) {
      toast(t("actions.forbidden"), "error");
    } else {
      toast(`${t("raci.failed")} (${pName})`, "error");
    }
  }

  /* the process column gives way on a phone so more unit columns stay in view */
  const gridTemplate = `clamp(9.5rem, 42vw, ${FIRST_COL}px) repeat(${columns.length}, ${UNIT_COL}px)`;

  return (
    <SectionBand
      id="om-raci"
      n={n}
      eyebrow={t("section.n", { n })}
      title={t("raci.title")}
      hint={t("raci.hint")}
      testId="om-raci"
      aside={
        <Chip tone="sand" className="tnum">
          {t("raci.count", { count: raci.processes.length, units: raci.units.length })}
        </Chip>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("raci.filterGroup")}</span>
          <NativeSelect
            className="w-64 cursor-pointer"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            data-testid="raci-filter-group"
          >
            <option value="all">{t("raci.allGroups")}</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} {bi(locale, g.nameEn, g.nameAr)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("raci.filterUnit")}</span>
          <NativeSelect
            className="w-64 cursor-pointer"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            data-testid="raci-filter-unit"
          >
            <option value="all">{t("raci.allUnits")}</option>
            {raci.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} {bi(locale, u.nameEn, u.nameAr)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {group !== "all" || unit !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setGroup("all");
              setUnit("all");
            }}
            className="h-9.5 cursor-pointer text-xs font-medium text-maroon-700 underline-offset-4 hover:underline"
          >
            {t("raci.clear")}
          </button>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="raci-legend">
          {ROLES.map((r) => (
            <span key={r} className="flex items-center gap-1.5 text-xs text-ink-600">
              <Chip tone={RACI_TONE[r]} className="w-6 justify-center px-0 tnum">
                {r}
              </Chip>
              {t(`raci.legend.${r}` as never)}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <EmptyState title={t("raci.empty")} hint={t("raci.emptyHint")} />
      ) : (
        <div
          className="relative max-h-[600px] overflow-auto rounded-xl border border-sand-300 bg-white"
          style={{ overscrollBehaviorX: "contain" }}
          data-testid="raci-scroll"
        >
          <div
            ref={gridRef}
            role="table"
            aria-label={t("raci.gridAria")}
            aria-rowcount={rows.length + 1}
            aria-colcount={columns.length + 1}
            className="min-w-max text-sm"
            data-testid="raci-grid"
          >
            <div role="rowgroup">
              <div role="row" className="grid" style={{ gridTemplateColumns: gridTemplate }}>
                <div
                  role="columnheader"
                  className="sticky start-0 top-0 z-30 border-b border-e border-sand-300 bg-sand-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600 rtl:tracking-normal"
                >
                  {t("raci.processHeader")}
                </div>
                {columns.map((u) => {
                  const name = bi(locale, u.nameEn, u.nameAr);
                  return (
                    <div
                      key={u.id}
                      role="columnheader"
                      aria-label={name}
                      title={name}
                      className={cn(
                        "sticky top-0 z-20 flex items-end justify-center border-b border-sand-300 bg-sand-50 px-1 pb-2 pt-2 text-[10px] font-semibold text-ink-600 tnum",
                        unit === u.id && "bg-maroon-50 text-maroon-900"
                      )}
                    >
                      <span className="truncate">{u.code}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div role="rowgroup">
              {grouped.map((g) => (
                <React.Fragment key={g.code ?? "none"}>
                  <div role="row" className="grid" style={{ gridTemplateColumns: gridTemplate }}>
                    <div
                      role="cell"
                      aria-colspan={columns.length + 1}
                      className="sticky start-0 z-10 col-span-full border-b border-sand-200 bg-maroon-50/70 px-3 py-1.5 text-[11px] font-semibold text-maroon-900"
                      style={{ gridColumn: `1 / span ${columns.length + 1}` }}
                      data-testid="raci-group-row"
                    >
                      <span className="sticky start-3 inline-block">{g.label}</span>
                    </div>
                  </div>
                  {g.rows.map((p) => {
                    const r = rowIndex.get(p.id) ?? 0;
                    const pName = bi(locale, p.nameEn, p.nameAr);
                    return (
                      <div key={p.id} role="row" className="group/raci-row grid" style={{ gridTemplateColumns: gridTemplate }} data-testid="raci-row">
                        <div
                          role="rowheader"
                          className="sticky start-0 z-10 flex min-w-0 items-center gap-2 border-b border-e border-sand-200 bg-white px-3 py-1.5 group-hover/raci-row:bg-sand-50"
                          title={pName}
                        >
                          <span className="shrink-0 text-[10px] font-semibold text-ink-400 tnum">{p.code}</span>
                          <span className="truncate text-xs text-ink-900">{pName}</span>
                        </div>
                        {columns.map((u, c) => {
                          const key = cellKey(p.id, u.id);
                          const role = cells.get(key) ?? null;
                          const isActive = active.r === r && active.c === c;
                          const uName = bi(locale, u.nameEn, u.nameAr);
                          const label = t("raci.cellAria", {
                            process: `${p.code} ${pName}`,
                            unit: uName,
                            role: role ? t(`raci.roleFull.${role}` as never) : t("raci.roleNone"),
                          });
                          return (
                            <div
                              key={u.id}
                              role="cell"
                              className={cn(
                                "flex items-center justify-center border-b border-sand-200 group-hover/raci-row:bg-sand-50",
                                unit === u.id && "bg-maroon-50/50"
                              )}
                            >
                              <button
                                type="button"
                                tabIndex={isActive ? 0 : -1}
                                data-r={r}
                                data-c={c}
                                data-testid="raci-cell"
                                data-role={role ?? ""}
                                aria-label={label}
                                aria-disabled={!canEdit || undefined}
                                onFocus={() => setActive({ r, c })}
                                onKeyDown={(e) => onKeyDown(e, r, c, p, u)}
                                onClick={() => (canEdit ? void cycle(p, u) : undefined)}
                                /* never disabled: a disabled button drops the
                                   keyboard focus while the write is in flight.
                                   cycle() ignores a second call while busy. */
                                aria-busy={busy === key || undefined}
                                className={cn(
                                  "flex h-8 w-full items-center justify-center outline-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500",
                                  canEdit ? "cursor-pointer hover:bg-maroon-100/50" : "cursor-default",
                                  busy === key && "opacity-50"
                                )}
                              >
                                {role ? (
                                  <Chip tone={RACI_TONE[role]} className="w-6 justify-center px-0 tnum">
                                    {role}
                                  </Chip>
                                ) : (
                                  <span className="text-ink-200" aria-hidden>
                                    {canEdit ? "+" : "·"}
                                  </span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-ink-400">{canEdit ? t("raci.keyboard") : t("raci.readOnlyHint")}</p>
      {group !== "all" || unit !== "all" ? (
        <p className="sr-only" role="status" aria-live="polite">
          {rows.length ? t("raci.count", { count: rows.length, units: columns.length }) : tc("nothingHere")}
        </p>
      ) : null}
    </SectionBand>
  );
}
