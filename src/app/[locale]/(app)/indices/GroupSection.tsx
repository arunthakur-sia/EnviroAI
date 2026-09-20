"use client";
// CR08 4.2: one group on the board. A thin bar and an eyebrow in the group's
// colour token, the name and description, the group's own summary strip, the
// cards-or-table toggle, the SDG headline tile for the SDG group, and the
// drop targets of edit mode.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LayoutGrid,
  Minus,
  Table2,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { EmptyState } from "@/components/ui/primitives";
import { groupStyle } from "@/lib/sdg-colours";
import { IndexCard, type CardEditProps } from "./IndexCard";
import { GroupTable } from "./GroupTable";
import { fmtValue, type BoardData, type Card, type Group } from "./board-shared";

export type SectionEdit = {
  groups: Pick<Group, "id" | "code" | "nameEn" | "nameAr">[];
  drag: { indexId: string; fromGroupId: string | null } | null;
  dropTarget: { groupId: string | null; beforeId: string | null } | null;
  setDropTarget: (t: { groupId: string | null; beforeId: string | null } | null) => void;
  onDragStart: (indexId: string, fromGroupId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (toGroupId: string | null, beforeId: string | null) => void;
  onMove: (indexId: string, fromGroupId: string | null, toGroupId: string | null, copy: boolean) => void;
  onRemove: (indexId: string, groupId: string) => void;
  onReorderGroup: (groupId: string, dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function GroupSection({
  group,
  cards,
  summary,
  colourToken,
  ungrouped = false,
  sdgHeadline,
  initialView,
  gccMode,
  hover,
  setHover,
  edit,
  index,
}: {
  group: Pick<Group, "id" | "code" | "nameEn" | "nameAr" | "descriptionEn" | "descriptionAr"> | null;
  cards: Card[];
  summary: BoardData["summary"];
  colourToken: string;
  ungrouped?: boolean;
  sdgHeadline?: BoardData["sdgHeadline"];
  initialView: "cards" | "table";
  gccMode: boolean;
  hover: string | null;
  setHover: (id: string | null) => void;
  edit: SectionEdit | null;
  index: number;
}) {
  const t = useTranslations("indices");
  const locale = useLocale();
  const [view, setView] = React.useState<"cards" | "table">(initialView);
  const style = groupStyle(colourToken);
  const groupId = group?.id ?? null;
  const isDropHere = edit?.dropTarget?.groupId === groupId && edit?.dropTarget?.beforeId === null;
  const canEditHere = !!edit;

  const title = group ? bi(locale, group.nameEn, group.nameAr) : t("ungrouped");
  const description = group
    ? bi(locale, group.descriptionEn ?? "", group.descriptionAr ?? "")
    : t("ungroupedHint");

  return (
    <Reveal delay={Math.min(index, 8) * 0.04}>
    <section
      className="mb-8"
      data-testid="group-section"
      data-group-code={group?.code ?? "ungrouped"}
      aria-labelledby={`group-${group?.code ?? "ungrouped"}`}
    >
      <div className={cn("mb-3 h-1 w-full rounded-full", ungrouped ? "bg-sand-300" : style.bar)} aria-hidden />
      <div className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em] rtl:tracking-normal",
              ungrouped ? "text-ink-400" : style.text
            )}
          >
            {t("groupCount", { count: cards.length })}
          </p>
          <h2 id={`group-${group?.code ?? "ungrouped"}`} className="font-display text-xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-sm text-ink-600">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {edit && group ? (
            <span className="inline-flex items-center gap-0.5" data-testid="group-reorder">
              <button
                type="button"
                onClick={() => edit.onReorderGroup(group.id, -1)}
                disabled={!edit.canMoveUp}
                className="rounded-md p-1 text-ink-600 hover:bg-sand-100 hover:text-maroon-700 disabled:opacity-30 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                aria-label={t("groupUp")}
                data-testid="group-up"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => edit.onReorderGroup(group.id, 1)}
                disabled={!edit.canMoveDown}
                className="rounded-md p-1 text-ink-600 hover:bg-sand-100 hover:text-maroon-700 disabled:opacity-30 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                aria-label={t("groupDown")}
                data-testid="group-down"
              >
                <ChevronDown className="size-4" />
              </button>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5" role="group" aria-label={t("viewToggle")}>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                view === "cards" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="size-3.5" aria-hidden /> {t("cards")}
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                view === "table" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
              aria-pressed={view === "table"}
              data-testid="indices-table-toggle"
            >
              <Table2 className="size-3.5" aria-hidden /> {t("table")}
            </button>
          </span>
        </div>
      </div>

      {/* the group's summary strip (an empty group has nothing to summarise) */}
      {cards.length > 0 ? (
      <div
        className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-sand-100 px-4 py-2.5 text-sm"
        data-testid="group-summary"
      >
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="size-4 text-ok" aria-hidden />
          <span className="tnum font-semibold">{summary.improving}</span> {t("improving")}
        </span>
        <span className="flex items-center gap-1.5">
          <Minus className="size-4 text-ink-400" aria-hidden />
          <span className="tnum font-semibold">{summary.stable}</span> {t("stableCount")}
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowDownRight className="size-4 text-danger" aria-hidden />
          <span className="tnum font-semibold">{summary.declining}</span> {t("declining")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="tnum font-semibold">{summary.gccLead}</span> {t("gccLeadCount")}
        </span>
      </div>
      ) : null}

      {/* SDG headline tile */}
      {group?.code === "sdg" && sdgHeadline ? (
        <div
          className={cn("card mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4", style.soft)}
          data-testid="sdg-headline"
        >
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] rtl:tracking-normal", style.text)}>
              {t("sdgHeadline")} · <span className="tnum">{sdgHeadline.year}</span>
            </p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
                {fmtValue(sdgHeadline.score, 1)}
              </span>
              <span className="text-xs text-ink-600">{t("sdgHeadlineScore")}</span>
            </p>
          </div>
          {sdgHeadline.rank != null ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
                {t("colRank")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
                {sdgHeadline.rank}
                {sdgHeadline.total ? <span className="text-sm font-normal text-ink-400"> / {sdgHeadline.total}</span> : null}
              </p>
            </div>
          ) : null}
          <div className="ms-auto flex items-center gap-3 text-xs">
            <Link href={`/indices/${sdgHeadline.code}` as never} className="link-draw font-medium text-maroon-700">
              {t("sdgOpen")}
            </Link>
            {sdgHeadline.sourceUrl ? (
              <a
                href={sdgHeadline.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-ink-600 hover:text-maroon-700"
              >
                <ExternalLink className="size-3" aria-hidden /> {t("source")}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* cards or table */}
      {cards.length === 0 && !canEditHere ? (
        <EmptyState title={t("noGroupMembers")} hint={t("noGroupMembersHint")} className="py-8" />
      ) : view === "table" && !edit ? (
        <GroupTable cards={cards} />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
            edit && "min-h-24 rounded-xl border border-dashed p-2 transition-colors",
            edit && (isDropHere ? cn("border-gold-500", style.soft) : "border-sand-300")
          )}
          onDragOver={
            edit
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (edit.dropTarget?.groupId !== groupId || edit.dropTarget?.beforeId !== null) {
                    edit.setDropTarget({ groupId, beforeId: null });
                  }
                }
              : undefined
          }
          onDrop={
            edit
              ? (e) => {
                  e.preventDefault();
                  edit.onDrop(groupId, null);
                }
              : undefined
          }
          data-testid={edit ? "group-dropzone" : undefined}
        >
          {cards.length === 0 && edit ? (
            <p className="col-span-full py-6 text-center text-sm text-ink-400">{t("dropHere")}</p>
          ) : null}
          {cards.map((c) => {
            const editProps: CardEditProps | undefined = edit
              ? {
                  groupId,
                  groups: edit.groups,
                  dragging: edit.drag?.indexId === c.id && edit.drag?.fromGroupId === groupId,
                  onDragStart: edit.onDragStart,
                  onDragEnd: edit.onDragEnd,
                  onDragOverCard: (g, beforeId) => {
                    if (edit.dropTarget?.groupId !== g || edit.dropTarget?.beforeId !== beforeId) {
                      edit.setDropTarget({ groupId: g, beforeId });
                    }
                  },
                  onDropOnCard: (g, beforeId) => edit.onDrop(g, beforeId),
                  onMove: edit.onMove,
                  onRemove: edit.onRemove,
                  isDropBefore: edit.dropTarget?.groupId === groupId && edit.dropTarget?.beforeId === c.id,
                }
              : undefined;
            return (
              <IndexCard key={c.id} c={c} gccMode={gccMode} hover={hover} setHover={setHover} edit={editProps} />
            );
          })}
        </div>
      )}
    </section>
    </Reveal>
  );
}
