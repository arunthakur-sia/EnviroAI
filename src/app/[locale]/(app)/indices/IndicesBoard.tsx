"use client";
// CR05 4.4: the Indices board. CR08 4.2: grouped. A group switcher at the top
// (All, then each active group with its count, deep-linkable with ?group=),
// one section per group with its colour cue, summary strip, cards or table,
// the SDG headline, and the Super Admin's edit mode: drag cards between
// groups or reorder them, reorder the groups, everything saved at once.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, Download, Pencil, RefreshCw } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ReportButton } from "@/components/nexus/ReportButton";
import { groupStyle } from "@/lib/sdg-colours";
import { GroupSection, type SectionEdit } from "./GroupSection";
import { ForecastSummary } from "./ForecastSummary";
import type { BoardData, Card, Group } from "./board-shared";

function summarise(cards: Card[]): BoardData["summary"] {
  return {
    improving: cards.filter((c) => (c.change ?? 0) > 0).length,
    declining: cards.filter((c) => (c.change ?? 0) < 0).length,
    stable: cards.filter((c) => c.change === 0 || c.change === null).length,
    gccLead: cards.filter((c) => c.gccPosition === 1).length,
  };
}

export function IndicesBoard({
  data,
  canRefresh,
  canManage,
  initialView,
  initialGroup,
}: {
  data: BoardData;
  canRefresh: boolean;
  canManage: boolean;
  initialView: "cards" | "table";
  initialGroup: string | null;
}) {
  const t = useTranslations("indices");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [groups, setGroups] = React.useState<Group[]>(data.groups);
  const [ungrouped, setUngrouped] = React.useState<Card[]>(data.ungrouped);
  React.useEffect(() => {
    setGroups(data.groups);
    setUngrouped(data.ungrouped);
  }, [data]);

  const [active, setActive] = React.useState<string | null>(
    initialGroup && data.groups.some((g) => g.code === initialGroup) ? initialGroup : null
  );
  const [editing, setEditing] = React.useState(false);
  const [gccMode, setGccMode] = React.useState(false);
  const [hover, setHover] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [drag, setDrag] = React.useState<{ indexId: string; fromGroupId: string | null } | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ groupId: string | null; beforeId: string | null } | null>(null);
  const [saving, setSaving] = React.useState(false);

  function selectGroup(code: string | null) {
    setActive(code);
    router.replace((code ? `/indices?group=${encodeURIComponent(code)}` : "/indices") as never, {
      scroll: false,
    });
  }

  const visibleGroups = active ? groups.filter((g) => g.code === active) : groups;
  const visibleCards = active
    ? visibleGroups.flatMap((g) => g.cards)
    : data.cards.filter((c) => !(data.sdgHeadline && c.id === data.sdgHeadline.indexId));
  const visibleCardIds = new Set(visibleCards.map((c) => c.id));
  const forecastRows = data.forecastTable.filter((f) =>
    visibleCards.some((c) => c.code === f.code)
  );

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/indices/refresh", { method: "POST" });
      if (res.ok) toast(t("refreshQueued"), "points");
      else toast(tc("error"), "error");
    } finally {
      setRefreshing(false);
    }
  }

  function exportCsv() {
    const head = [
      "code,name,publisher,groups,year,rank,score,change,gcc_rank,target,forecast_1y,forecast_3y,forecast_5y,entity",
    ];
    const rows = visibleCards.map((c) => {
      const f = data.forecastTable.find((x) => x.code === c.code);
      const dir = (h: number) => f?.horizons.find((r) => r.horizon === h)?.direction ?? "";
      return [
        c.code,
        JSON.stringify(c.nameEn),
        JSON.stringify(c.publisher ?? ""),
        JSON.stringify(c.groupCodes.join("|")),
        c.qatar?.year ?? "",
        c.qatar?.rank ?? "",
        c.qatar?.score ?? "",
        c.change ?? "",
        c.gccPosition ?? "",
        c.target?.value ?? "",
        dir(1),
        dir(3),
        dir(5),
        JSON.stringify(c.entity?.shortEn ?? ""),
      ].join(",");
    });
    const blob = new Blob([head.concat(rows).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sianexus-indices.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- edit mode ---------------- */

  async function persist(changed: Group[], nextGroups: Group[]) {
    if (!changed.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/indices/groups/members", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groups: changed.map((g) => ({ groupId: g.id, indexIds: g.cards.map((c) => c.id) })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(t("membershipSaved"), "points");
      // keep group codes on the cards honest after the move
      const codesOf = new Map<string, string[]>();
      for (const g of nextGroups) for (const c of g.cards) codesOf.set(c.id, [...(codesOf.get(c.id) ?? []), g.code]);
      setGroups((cur) =>
        cur.map((g) => ({ ...g, cards: g.cards.map((c) => ({ ...c, groupCodes: codesOf.get(c.id) ?? [] })) }))
      );
    } catch {
      toast(tc("error"), "error");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function applyMove(
    indexId: string,
    fromGroupId: string | null,
    toGroupId: string | null,
    beforeId: string | null,
    copy: boolean
  ) {
    const card =
      groups.flatMap((g) => g.cards).find((c) => c.id === indexId) ??
      ungrouped.find((c) => c.id === indexId) ??
      data.cards.find((c) => c.id === indexId);
    if (!card) return;
    if (fromGroupId === toGroupId && beforeId === indexId) return;
    const next = groups.map((g) => ({ ...g, cards: [...g.cards] }));
    const changed = new Set<string>();
    if (fromGroupId && !copy) {
      const src = next.find((g) => g.id === fromGroupId);
      if (src) {
        const before = src.cards.length;
        src.cards = src.cards.filter((c) => c.id !== indexId);
        if (src.cards.length !== before) changed.add(src.id);
      }
    }
    if (toGroupId) {
      const dst = next.find((g) => g.id === toGroupId);
      if (dst) {
        dst.cards = dst.cards.filter((c) => c.id !== indexId);
        const at = beforeId ? dst.cards.findIndex((c) => c.id === beforeId) : -1;
        if (at === -1) dst.cards.push(card);
        else dst.cards.splice(at, 0, card);
        changed.add(dst.id);
      }
    }
    for (const g of next) if (changed.has(g.id)) g.summary = summarise(g.cards);
    const grouped = new Set(next.flatMap((g) => g.cards.map((c) => c.id)));
    setGroups(next);
    setUngrouped(
      data.cards.filter((c) => !grouped.has(c.id) && !(data.sdgHeadline && c.id === data.sdgHeadline.indexId))
    );
    void persist(next.filter((g) => changed.has(g.id)), next);
  }

  async function reorderGroup(groupId: string, dir: -1 | 1) {
    const ids = groups.map((g) => g.id);
    const i = ids.indexOf(groupId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    const next = [...groups];
    [next[i], next[j]] = [next[j], next[i]];
    setGroups(next.map((g, k) => ({ ...g, sort: k + 1 })));
    const res = await fetch("/api/v1/indices/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reorder", ids: next.map((g) => g.id) }),
    });
    if (res.ok) toast(t("groupOrderSaved"), "points");
    else {
      toast(tc("error"), "error");
      router.refresh();
    }
  }

  const sectionEdit: SectionEdit | null =
    editing && canManage
      ? {
          groups: groups.map((g) => ({ id: g.id, code: g.code, nameEn: g.nameEn, nameAr: g.nameAr })),
          drag,
          dropTarget,
          setDropTarget,
          onDragStart: (indexId, fromGroupId) => setDrag({ indexId, fromGroupId }),
          onDragEnd: () => {
            setDrag(null);
            setDropTarget(null);
          },
          onDrop: (toGroupId, beforeId) => {
            if (drag) applyMove(drag.indexId, drag.fromGroupId, toGroupId, beforeId, false);
            setDrag(null);
            setDropTarget(null);
          },
          onMove: (indexId, fromGroupId, toGroupId, copy) =>
            applyMove(indexId, fromGroupId, toGroupId, null, copy),
          onRemove: (indexId, groupId) => applyMove(indexId, groupId, null, null, false),
          onReorderGroup: reorderGroup,
          canMoveUp: false,
          canMoveDown: false,
        }
      : null;

  return (
    <div data-testid="indices-board" data-editing={editing || undefined}>
      {/* header row: refresh, edit mode, gcc mode, export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-600">
          {t("lastRefresh")}{" "}
          <span className="tnum">{data.lastRefresh ? data.lastRefresh.slice(0, 10) : "-"}</span>
        </span>
        {canRefresh ? (
          <Button size="sm" variant="secondary" onClick={refresh} loading={refreshing} data-testid="indices-refresh">
            <RefreshCw /> {t("refresh")}
          </Button>
        ) : null}
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button
              size="sm"
              variant={editing ? "gold" : "secondary"}
              onClick={() => {
                setEditing((v) => !v);
                setDrag(null);
                setDropTarget(null);
              }}
              loading={saving}
              data-testid="indices-edit-toggle"
              aria-pressed={editing}
            >
              {editing ? <Check /> : <Pencil />} {editing ? t("doneEditing") : t("editGroups")}
            </Button>
          ) : null}
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            <button
              type="button"
              onClick={() => setGccMode((v) => !v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                gccMode ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
              aria-pressed={gccMode}
              data-testid="gcc-mode"
            >
              {t("qatarVsGcc")}
            </button>
          </span>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
          >
            <Download className="size-3.5" aria-hidden /> CSV
          </button>
          <ReportButton
            scope={{ kind: "indices", ids: visibleCards.map((c) => c.id), labelEn: "International indices", labelAr: "المؤشرات الدولية" }}
          />
        </span>
      </div>

      {/* group switcher */}
      <nav
        className="mb-5 flex flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label={t("groupSwitcher")}
        data-testid="group-switcher"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === null}
          onClick={() => selectGroup(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
            active === null ? "bg-maroon-700 font-medium text-white" : "bg-sand-100 text-ink-600 hover:text-ink-900"
          )}
          data-testid="group-tab-all"
        >
          {t("allGroups")}
          <span className={cn("ms-1.5 tnum", active === null ? "text-white/80" : "text-ink-400")}>{data.cards.length}</span>
        </button>
        {groups.map((g) => {
          const style = groupStyle(g.colourToken);
          const on = active === g.code;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => selectGroup(on ? null : g.code)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                on ? cn("font-medium text-ink-900 ring-1", style.soft, style.ring) : "bg-sand-100 text-ink-600 hover:text-ink-900"
              )}
              data-testid={`group-tab-${g.code}`}
            >
              <span className={cn("size-2 rounded-full", style.bar)} aria-hidden />
              {bi(locale, g.nameEn, g.nameAr)}
              <span className="tnum text-ink-400">{g.cards.length}</span>
            </button>
          );
        })}
      </nav>

      {/* the whole-board summary strip (All view) */}
      {!active ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-sm" data-testid="indices-summary">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
            {t("acrossBoard")}
          </span>
          <span><span className="tnum font-semibold text-ok">{data.summary.improving}</span> {t("improving")}</span>
          <span><span className="tnum font-semibold">{data.summary.stable}</span> {t("stableCount")}</span>
          <span><span className="tnum font-semibold text-danger">{data.summary.declining}</span> {t("declining")}</span>
          <span><span className="tnum font-semibold">{data.summary.gccLead}</span> {t("gccLeadCount")}</span>
        </div>
      ) : null}

      {editing ? (
        <p className="mb-4 rounded-lg bg-gold-100 px-3 py-2 text-xs text-maroon-900" data-testid="edit-hint">
          {t("editHint")}
        </p>
      ) : null}

      {visibleGroups.length === 0 && ungrouped.length === 0 ? (
        <EmptyState title={t("emptyBoard")} hint={t("emptyBoardHint")} className="py-12" />
      ) : null}

      {visibleGroups.map((g, i) => (
        <GroupSection
          key={g.id}
          index={i}
          group={g}
          cards={g.cards}
          summary={g.summary}
          colourToken={g.colourToken}
          sdgHeadline={data.sdgHeadline}
          initialView={initialView}
          gccMode={gccMode}
          hover={hover}
          setHover={setHover}
          edit={
            sectionEdit
              ? {
                  ...sectionEdit,
                  canMoveUp: groups.findIndex((x) => x.id === g.id) > 0,
                  canMoveDown: groups.findIndex((x) => x.id === g.id) < groups.length - 1,
                }
              : null
          }
        />
      ))}

      {!active && (ungrouped.length > 0 || editing) ? (
        <GroupSection
          index={visibleGroups.length}
          group={null}
          ungrouped
          cards={ungrouped}
          summary={summarise(ungrouped)}
          colourToken="ink"
          initialView={initialView}
          gccMode={gccMode}
          hover={hover}
          setHover={setHover}
          edit={sectionEdit}
        />
      ) : null}

      {/* CR05 4.6.8: the forecast summary */}
      <ForecastSummary rows={forecastRows.filter((f) => visibleCardIds.size === 0 || visibleCards.some((c) => c.code === f.code))} />
    </div>
  );
}
