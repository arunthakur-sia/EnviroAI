"use client";
// CR08 4.2: one index card. The CR05 rendering (value, sparkline, change,
// GCC standing, entity, target chip) extended with the SDG goal chip, the
// national target line, the Statistics Hub chip, and the edit-mode handle
// with its keyboard alternatives to dragging.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowDownRight, ArrowUpRight, BarChart3, GripVertical, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { DirectionIcon, RankSparkline, SdgChip, TargetLine, type Card, type Group } from "./board-shared";

export type CardEditProps = {
  groupId: string | null;
  groups: Pick<Group, "id" | "code" | "nameEn" | "nameAr">[];
  dragging: boolean;
  onDragStart: (indexId: string, fromGroupId: string | null) => void;
  onDragEnd: () => void;
  onDragOverCard: (groupId: string | null, beforeId: string) => void;
  onDropOnCard: (groupId: string | null, beforeId: string) => void;
  onMove: (indexId: string, fromGroupId: string | null, toGroupId: string | null, copy: boolean) => void;
  onRemove: (indexId: string, groupId: string) => void;
  isDropBefore: boolean;
};

export function IndexCard({
  c,
  gccMode,
  hover,
  setHover,
  edit,
}: {
  c: Card;
  gccMode: boolean;
  hover: string | null;
  setHover: (id: string | null) => void;
  edit?: CardEditProps;
}) {
  const t = useTranslations("indices");
  const locale = useLocale();
  const router = useRouter();

  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {c.sdgGoal != null ? <SdgChip goal={c.sdgGoal} /> : null}
            <span className="block truncate text-sm font-semibold text-ink-900">
              {bi(locale, c.nameEn, c.nameAr)}
            </span>
          </span>
          <span className="block text-xs text-ink-600">
            {c.statistics ? t("statisticsSource") : c.publisher}
          </span>
        </span>
        {edit ? null : <DirectionIcon d={c.forecastDirection} className="mt-1 size-4" />}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span>
          <span className="block text-2xl font-semibold text-navy-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
            {c.home?.rank != null ? c.home.rank : c.home?.score != null ? c.home.score.toFixed(c.home.score < 10 ? 2 : 1) : "-"}
          </span>
          <span className="block text-[11px] text-ink-600 tnum">
            {c.home?.rank != null && c.home?.total
              ? t("rankOf", { total: c.home.total })
              : c.home?.score != null
                ? c.statistics?.unit ?? t("scoreLabel")
                : t("noData")}
            {" · "}
            {c.home?.year ?? "-"}
          </span>
          {c.home?.score != null && c.home?.rank != null ? (
            <span className="block text-[11px] text-ink-600 tnum">
              {t("scoreShort")} {c.home.score.toFixed(c.home.score < 10 ? 2 : 1)}
            </span>
          ) : null}
        </span>
        <RankSparkline points={c.sparkline} highlight={hover === c.id} />
      </span>
      {c.target ? <TargetLine target={c.target} unit={c.statistics?.unit} /> : null}
      <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {c.change != null && c.change !== 0 ? (
          <span
            className={cn(
              "flex items-center gap-0.5 tnum",
              c.change > 0 ? "text-ok" : "text-danger"
            )}
          >
            {c.change > 0 ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden />
            )}
            {c.changeKind === "rank"
              ? t("rankChange", { n: Math.abs(c.change) })
              : Math.abs(c.change).toFixed(2)}
          </span>
        ) : null}
        {c.gccPosition ? (
          <Chip tone={c.gccPosition === 1 ? "aqua" : "mist"}>
            {t("gccPosition", { pos: c.gccPosition })}
          </Chip>
        ) : null}
        {c.statistics ? (
          <Chip tone="teal">
            <BarChart3 className="size-3" aria-hidden /> {t("statisticsChip")}
          </Chip>
        ) : null}
        {c.entity ? <Chip tone="teal">{bi(locale, c.entity.shortEn, c.entity.shortAr)}</Chip> : null}
        {c.linkedTargets.slice(0, 1).map((tg) => (
          <Chip key={tg.id} tone="navy">{tg.code ?? bi(locale, tg.titleEn, tg.titleAr).slice(0, 18)}</Chip>
        ))}
        {!c.forecastEnabled ? <Chip tone="ghost">{t("forecastOff")}</Chip> : null}
      </span>
      {gccMode ? (
        <span className="mt-1 border-t border-mist-100 pt-2" data-testid="gcc-scale">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600 rtl:tracking-normal">
            {t("gccScale")}
            {c.gccLeader ? (
              <span className="ms-1 font-normal normal-case tracking-normal">
                · {t("leaderIs", { country: c.gccLeader.country })}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1" dir="ltr">
            {Array.from({ length: c.gccCount || 6 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i + 1 === c.gccPosition ? "bg-navy-700" : "bg-mist-300"
                )}
                title={`${i + 1}`}
              />
            ))}
          </span>
        </span>
      ) : null}
    </>
  );

  if (!edit) {
    return (
      <button
        onClick={() => router.push(`/indices/${c.code}` as never)}
        onMouseEnter={() => setHover(c.id)}
        onMouseLeave={() => setHover(null)}
        className="card card-hover flex flex-col gap-2 p-4 text-start cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
        data-testid="index-card"
        data-index-code={c.code}
      >
        {body}
      </button>
    );
  }

  const others = edit.groups.filter((g) => g.id !== edit.groupId);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        edit.onDragStart(c.id, edit.groupId);
      }}
      onDragEnd={edit.onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        edit.onDragOverCard(edit.groupId, c.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        edit.onDropOnCard(edit.groupId, c.id);
      }}
      className={cn(
        "card relative flex flex-col gap-2 p-4 text-start transition-shadow",
        edit.dragging ? "opacity-40" : "",
        edit.isDropBefore ? "ring-2 ring-aqua-500" : ""
      )}
      data-testid="index-card"
      data-index-code={c.code}
      data-group-id={edit.groupId ?? ""}
      aria-grabbed={edit.dragging || undefined}
    >
      <span className="flex items-center gap-1.5 border-b border-mist-100 pb-2">
        <span
          className="flex cursor-grab items-center text-ink-400 active:cursor-grabbing"
          aria-hidden
          data-testid="card-grip"
        >
          <GripVertical className="size-4" />
        </span>
        <select
          aria-label={t("moveTo")}
          value=""
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            if (!kind) return;
            edit.onMove(c.id, edit.groupId, id || null, kind === "add");
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-mist-300 bg-white px-1.5 text-[11px] text-ink-600 focus:border-navy-500 focus:outline-none"
          data-testid="card-move-select"
        >
          <option value="">{t("moveTo")}</option>
          <optgroup label={t("moveOptions")}>
            {others.map((g) => (
              <option key={`move:${g.id}`} value={`move:${g.id}`}>
                {bi(locale, g.nameEn, g.nameAr)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("addOptions")}>
            {others.map((g) => (
              <option key={`add:${g.id}`} value={`add:${g.id}`}>
                {bi(locale, g.nameEn, g.nameAr)}
              </option>
            ))}
          </optgroup>
        </select>
        {edit.groupId ? (
          <button
            type="button"
            onClick={() => edit.onRemove(c.id, edit.groupId!)}
            className="rounded-md p-1 text-ink-400 hover:bg-danger-light hover:text-danger cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
            aria-label={t("removeFromGroup")}
            data-testid="card-remove"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
      {body}
    </div>
  );
}
