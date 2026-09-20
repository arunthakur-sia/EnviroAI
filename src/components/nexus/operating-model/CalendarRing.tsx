"use client";
// CR08 10.2 section 5: the planning and reporting calendar as an annual ring.
// Twelve month arcs around a circle (d3-shape arcs), one lane per event kind
// inside the ring, single-day events as dots and ranges as arcs along the
// lane, the current month and today marked. Hover shows a tooltip, click
// opens a small popover with the details and the linked item, clicking a
// month selects it for the list beneath. The ring stays LTR in Arabic; only
// its labels are localised. Editors add, edit and delete through the
// calendar API; the year switcher fetches the year without a page reload.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { arc as d3arc } from "d3-shape";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, Label, NativeSelect, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type {
  CalendarKind,
  CalendarOccurrence,
  CalendarView,
  Recurrence,
  UnitRef,
} from "@/server/services/operating-model";
import { CALENDAR_KIND_ORDER, CALENDAR_KIND_VAR, SectionBand, displayFont, omFetch, useFmt } from "./shared";

const SIZE = 560;
const C = SIZE / 2;
const R_OUT = 250;
const R_IN = 230;
const LANE_TOP = 214;
const LANE_STEP = 12;
const LABEL_R = 268;
const KINDS: CalendarKind[] = CALENDAR_KIND_ORDER;
const RECURRENCES: Recurrence[] = ["none", "annual", "quarterly", "monthly"];
const LINKED_TYPES = ["process", "report_type", "release", "council_strategy"] as const;

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function dayOfYear(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const ms = Date.parse(`${iso}T00:00:00Z`) - Date.UTC(y, 0, 1);
  return ms / 86400000;
}

/** d3 convention: 0 at twelve o'clock, clockwise. */
function angleOf(iso: string, year: number): number {
  return (2 * Math.PI * (dayOfYear(iso) + 0.5)) / daysInYear(year);
}

/* Node and the browser can differ in the last bit of Math.sin and Math.cos,
   which React reports as a hydration mismatch on an SVG coordinate. Every
   number that reaches the markup is therefore rounded to two decimals. */
function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The same rounding over a generated path string (d3 arcs use trig inside). */
function roundPath(d: string): string {
  return d.replace(/-?\d+\.\d+(e-?\d+)?/g, (m) => String(r2(Number(m))));
}

function point(r: number, angle: number): [number, number] {
  return [r2(C + r * Math.sin(angle)), r2(C - r * Math.cos(angle))];
}

function laneOf(kind: CalendarKind): number {
  return LANE_TOP - KINDS.indexOf(kind) * LANE_STEP;
}

function linkedHref(linked: CalendarOccurrence["linked"]): string | null {
  if (!linked) return null;
  if (linked.type === "process" && linked.code) return `/processes?p=${encodeURIComponent(linked.code)}`;
  if (linked.type === "report_type") return `/reports?type=${encodeURIComponent(linked.code ?? linked.id)}`;
  if (linked.type === "release") return "/statistics";
  if (linked.type === "council_strategy") return "/council-strategy";
  return null;
}

type Draft = {
  id?: string;
  kind: CalendarKind;
  titleEn: string;
  titleAr: string;
  dateFrom: string;
  dateTo: string;
  ownerUnitId: string;
  linkedResourceType: string;
  linkedResourceId: string;
  recurrence: Recurrence;
};

function draftOf(e: CalendarOccurrence | null, year: number): Draft {
  return {
    id: e?.id,
    kind: e?.kind ?? "other",
    titleEn: e?.titleEn ?? "",
    titleAr: e?.titleAr ?? "",
    dateFrom: e?.dateFrom ?? `${year}-01-15`,
    dateTo: e?.dateTo ?? "",
    ownerUnitId: e?.ownerUnit?.id ?? "",
    linkedResourceType: e?.linked?.type ?? "",
    linkedResourceId: e?.linked ? e.linked.code ?? e.linked.id : "",
    recurrence: e?.recurrence ?? "none",
  };
}

/* ------------------------------------------------------------------ */
/* the event dialog                                                     */
/* ------------------------------------------------------------------ */

function EventDialog({
  draft,
  units,
  busy,
  onChange,
  onSave,
  onClose,
}: {
  draft: Draft;
  units: UnitRef[];
  busy: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const valid = draft.titleEn.trim() && draft.titleAr.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateFrom);
  const badRange = draft.dateTo && draft.dateTo < draft.dateFrom;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={draft.id ? t("calendar.dialog.editTitle") : t("calendar.dialog.addTitle")} data-testid="calendar-dialog">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !badRange) onSave();
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="cal-kind">{t("calendar.dialog.kind")}</Label>
            <NativeSelect id="cal-kind" value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as CalendarKind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`calendar.kind.${k}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="cal-title-en">{t("calendar.dialog.titleEn")}</Label>
            <Input id="cal-title-en" dir="ltr" value={draft.titleEn} maxLength={300} onChange={(e) => onChange({ ...draft, titleEn: e.target.value })} data-testid="calendar-title-en" />
          </div>
          <div>
            <Label htmlFor="cal-title-ar">{t("calendar.dialog.titleAr")}</Label>
            <Input id="cal-title-ar" dir="rtl" value={draft.titleAr} maxLength={300} onChange={(e) => onChange({ ...draft, titleAr: e.target.value })} data-testid="calendar-title-ar" />
          </div>
          <div>
            <Label htmlFor="cal-from">{t("calendar.dialog.dateFrom")}</Label>
            <Input id="cal-from" type="date" value={draft.dateFrom} onChange={(e) => onChange({ ...draft, dateFrom: e.target.value })} data-testid="calendar-date-from" />
          </div>
          <div>
            <Label htmlFor="cal-to">{t("calendar.dialog.dateTo")}</Label>
            <Input id="cal-to" type="date" value={draft.dateTo} onChange={(e) => onChange({ ...draft, dateTo: e.target.value })} />
            {badRange ? <p className="mt-1 text-xs text-danger">{t("calendar.dialog.invalidDate")}</p> : null}
          </div>
          <div>
            <Label htmlFor="cal-unit">{t("calendar.dialog.ownerUnit")}</Label>
            <NativeSelect id="cal-unit" value={draft.ownerUnitId} onChange={(e) => onChange({ ...draft, ownerUnitId: e.target.value })}>
              <option value="">{t("calendar.dialog.noUnit")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} {bi(locale, u.nameEn, u.nameAr)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="cal-rec">{t("calendar.dialog.recurrence")}</Label>
            <NativeSelect id="cal-rec" value={draft.recurrence} onChange={(e) => onChange({ ...draft, recurrence: e.target.value as Recurrence })}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {t(`calendar.recurrence.${r}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="cal-ltype">{t("calendar.dialog.linkedType")}</Label>
            <NativeSelect id="cal-ltype" value={draft.linkedResourceType} onChange={(e) => onChange({ ...draft, linkedResourceType: e.target.value })}>
              <option value="">{t("calendar.dialog.linkedNone")}</option>
              {LINKED_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`calendar.linkedType.${k}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="cal-lid">{t("calendar.dialog.linkedId")}</Label>
            <Input id="cal-lid" dir="ltr" value={draft.linkedResourceId} maxLength={60} disabled={!draft.linkedResourceType} onChange={(e) => onChange({ ...draft, linkedResourceId: e.target.value })} />
            <p className="mt-1 text-[11px] text-ink-400">{t("calendar.dialog.linkedHint")}</p>
          </div>
          <div className="mt-2 flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid || Boolean(badRange)} loading={busy} data-testid="calendar-save">
              {t("calendar.dialog.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actions.cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* the section                                                          */
/* ------------------------------------------------------------------ */

export function CalendarSection({
  initial,
  units,
  canEdit,
  n,
}: {
  initial: CalendarView;
  units: UnitRef[];
  canEdit: boolean;
  n: number;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const fmt = useFmt();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;

  const [year, setYear] = React.useState(initial.year);
  const [events, setEvents] = React.useState<CalendarOccurrence[]>(initial.events);
  const [loading, setLoading] = React.useState(false);
  const [month, setMonth] = React.useState(initial.year === thisYear ? thisMonth : 0);
  const [hover, setHover] = React.useState<string | null>(null);
  const [popover, setPopover] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initial.year === year) setEvents(initial.events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const load = React.useCallback(
    async (y: number) => {
      setLoading(true);
      const res = await omFetch<CalendarView>(`/api/v1/operating-model/calendar?year=${y}`);
      setLoading(false);
      if (res.ok && res.data) {
        setEvents(res.data.events);
        setYear(res.data.year);
        setMonth(res.data.year === thisYear ? thisMonth : 0);
        setPopover(null);
        const url = new URL(window.location.href);
        url.searchParams.set("year", String(res.data.year));
        window.history.replaceState(window.history.state, "", url.toString());
      } else {
        toast(t("actions.failed"), "error");
      }
    },
    [thisYear, thisMonth, toast, t]
  );

  React.useEffect(() => {
    if (popover) closeRef.current?.focus();
  }, [popover]);

  /* geometry */
  const monthArc = React.useMemo(() => d3arc<{ start: number; end: number }>().innerRadius(R_IN).outerRadius(R_OUT).padAngle(0.012).cornerRadius(3).startAngle((d) => d.start).endAngle((d) => d.end), []);
  const months = React.useMemo(() => {
    const total = daysInYear(year);
    return Array.from({ length: 12 }, (_, m) => {
      const start = (2 * Math.PI * dayOfYear(`${year}-${String(m + 1).padStart(2, "0")}-01`)) / total;
      const end = m === 11 ? 2 * Math.PI : (2 * Math.PI * dayOfYear(`${year}-${String(m + 2).padStart(2, "0")}-01`)) / total;
      return { m, start, end, mid: (start + end) / 2 };
    });
  }, [year]);
  const byMonth = React.useMemo(() => {
    const out = Array.from({ length: 12 }, () => [] as CalendarOccurrence[]);
    for (const e of events) {
      const m = Number(e.dateFrom.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) out[m].push(e);
    }
    return out;
  }, [events]);
  const marks = React.useMemo(
    () =>
      events.map((e) => {
        const r = laneOf(e.kind);
        const a1 = angleOf(e.dateFrom, year);
        const a2 = e.dateTo && e.dateTo > e.dateFrom ? angleOf(e.dateTo, year) : null;
        const [x, y] = point(r, a1);
        const range =
          a2 != null
            ? roundPath(d3arc()({ innerRadius: r - 2.5, outerRadius: r + 2.5, startAngle: a1, endAngle: Math.max(a2, a1 + 0.02) }) ?? "")
            : null;
        return { e, r, x, y, range, a1 };
      }),
    [events, year]
  );
  const todayAngle = year === thisYear ? angleOf(today, year) : null;
  const hovered = marks.find((m) => m.e.occurrenceKey === (popover ?? hover)) ?? null;

  /* writes */
  async function save() {
    if (!draft) return;
    setBusy(true);
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      kind: draft.kind,
      titleEn: draft.titleEn.trim(),
      titleAr: draft.titleAr.trim(),
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo || null,
      ownerUnitId: draft.ownerUnitId || null,
      linkedResourceType: draft.linkedResourceType || null,
      linkedResourceId: draft.linkedResourceType ? draft.linkedResourceId.trim() || null : null,
      recurrence: draft.recurrence,
    };
    const res = await omFetch("/api/v1/operating-model/calendar", { method: draft.id ? "PATCH" : "POST", body });
    setBusy(false);
    if (res.ok) {
      toast(t("calendar.dialog.saved"), "success");
      setDraft(null);
      setPopover(null);
      void load(year);
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }

  async function remove(e: CalendarOccurrence) {
    if (!window.confirm(t("calendar.deleteConfirm", { title: bi(locale, e.titleEn, e.titleAr) }))) return;
    const res = await omFetch(`/api/v1/operating-model/calendar?id=${encodeURIComponent(e.id)}`, { method: "DELETE" });
    if (res.ok) {
      toast(t("calendar.dialog.deleted"), "success");
      setPopover(null);
      void load(year);
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }

  const kindLabel = (k: CalendarKind) => t(`calendar.kind.${k}` as never);
  const dateLine = (e: CalendarOccurrence) =>
    e.dateTo && e.dateTo !== e.dateFrom
      ? t("calendar.dateRange", { from: fmt.d(e.dateFrom), to: fmt.d(e.dateTo) })
      : fmt.d(e.dateFrom, "long");

  function EventDetails({ e }: { e: CalendarOccurrence }) {
    const href = linkedHref(e.linked);
    return (
      <>
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: CALENDAR_KIND_VAR[e.kind] }} aria-hidden />
          <span className="text-[11px] font-semibold text-ink-600">{kindLabel(e.kind)}</span>
          {e.recurrence !== "none" ? <Chip tone="sand">{t(`calendar.recurrence.${e.recurrence}` as never)}</Chip> : null}
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-ink-900">{bi(locale, e.titleEn, e.titleAr)}</p>
        <p className="mt-0.5 text-xs text-ink-600 tnum">{dateLine(e)}</p>
        {e.ownerUnit ? (
          <p className="mt-1 text-xs text-ink-600">
            <span className="text-ink-400">{t("calendar.owner")}: </span>
            {bi(locale, e.ownerUnit.nameEn, e.ownerUnit.nameAr)}
          </p>
        ) : null}
        {e.linked ? (
          <p className="mt-1.5 text-xs">
            <span className="text-ink-400">{t("calendar.linked")}: </span>
            {href ? (
              <Link href={href as never} className="link-draw inline-flex items-center gap-1 font-medium text-maroon-700" data-testid="calendar-linked-link">
                {bi(locale, e.linked.titleEn, e.linked.titleAr)}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              <span className="text-ink-900">{bi(locale, e.linked.titleEn, e.linked.titleAr)}</span>
            )}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <SectionBand
      id="om-calendar"
      n={n}
      eyebrow={t("section.n", { n })}
      title={t("calendar.title")}
      hint={t("calendar.hint")}
      testId="om-calendar"
      aside={
        <>
          <span className="inline-flex items-center gap-1 rounded-lg bg-sand-100 p-0.5" role="group" aria-label={t("calendar.yearAria")} data-testid="calendar-year-switch">
            <button
              type="button"
              onClick={() => void load(year - 1)}
              aria-label={t("calendar.prevYear")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-600 hover:bg-white hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <ChevronLeft className="size-4 flip-rtl" aria-hidden />
            </button>
            <span className="min-w-14 text-center text-sm font-semibold text-maroon-900 tnum" data-testid="calendar-year">
              {fmt.year(year)}
            </span>
            <button
              type="button"
              onClick={() => void load(year + 1)}
              aria-label={t("calendar.nextYear")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-600 hover:bg-white hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <ChevronRight className="size-4 flip-rtl" aria-hidden />
            </button>
          </span>
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setDraft(draftOf(null, year))} data-testid="calendar-add">
              <Plus /> {t("calendar.add")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* the ring */}
        <div className="relative">
          <div
            ref={ringRef}
            className="relative mx-auto w-full max-w-[560px]"
            style={{ direction: "ltr" }}
            onPointerDown={(e) => {
              if (popover && !(e.target as HTMLElement).closest("[data-calendar-popover]") && !(e.target as HTMLElement).closest("[data-calendar-mark]")) {
                setPopover(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && popover) {
                e.preventDefault();
                setPopover(null);
              }
            }}
          >
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className={cn("h-auto w-full", loading && "opacity-40")}
              role="group"
              aria-label={t("calendar.ringAria", { year })}
              data-testid="calendar-ring"
            >
              {/* the month band */}
              {months.map((mo) => {
                const count = byMonth[mo.m].length;
                const isNow = year === thisYear && mo.m === thisMonth;
                const isSel = month === mo.m;
                const [lx, ly] = point(LABEL_R, mo.mid);
                return (
                  <g key={mo.m}>
                    <path
                      d={roundPath(monthArc({ start: mo.start, end: mo.end }) ?? "")}
                      transform={`translate(${C} ${C})`}
                      fill={isSel ? "var(--color-maroon-700)" : isNow ? "var(--color-maroon-100)" : "var(--color-sand-100)"}
                      stroke={isNow && !isSel ? "var(--color-maroon-300)" : "var(--color-sand-300)"}
                      strokeWidth={isNow && !isSel ? 1.5 : 1}
                      className="cursor-pointer outline-none transition-colors duration-200 focus-visible:stroke-gold-500 focus-visible:[stroke-width:3]"
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSel}
                      aria-label={t("calendar.monthAria", { month: fmt.month(mo.m, "long"), count })}
                      onClick={() => setMonth(mo.m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setMonth(mo.m);
                        }
                      }}
                      data-testid="calendar-month"
                      data-month={mo.m}
                      data-current={isNow || undefined}
                    />
                    <text
                      x={lx}
                      y={ly + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={isSel || isNow ? 600 : 500}
                      fill={isSel ? "var(--color-maroon-900)" : isNow ? "var(--color-maroon-700)" : "var(--color-ink-600)"}
                      className="pointer-events-none select-none"
                      style={{ fontFamily: locale === "ar" ? "var(--font-arabic)" : "var(--font-sans)" }}
                    >
                      {fmt.month(mo.m, "short")}
                    </text>
                    {count ? (
                      <text
                        x={point(R_IN + (R_OUT - R_IN) / 2, mo.mid)[0]}
                        y={point(R_IN + (R_OUT - R_IN) / 2, mo.mid)[1] + 3.5}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={isSel ? "#ffffff" : "var(--color-ink-600)"}
                        className="pointer-events-none select-none tnum"
                      >
                        {count}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {/* the lanes */}
              {KINDS.map((k) => (
                <circle key={k} cx={C} cy={C} r={laneOf(k)} fill="none" stroke="var(--color-sand-200)" strokeWidth={0.75} strokeDasharray="1 3" />
              ))}

              {/* today */}
              {todayAngle != null ? (
                <line
                  x1={point(LANE_TOP - KINDS.length * LANE_STEP + 2, todayAngle)[0]}
                  y1={point(LANE_TOP - KINDS.length * LANE_STEP + 2, todayAngle)[1]}
                  x2={point(R_OUT + 3, todayAngle)[0]}
                  y2={point(R_OUT + 3, todayAngle)[1]}
                  stroke="var(--color-maroon-700)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  data-testid="calendar-today"
                />
              ) : null}

              {/* the events */}
              {marks.map(({ e, x, y, range }) => {
                const active = hover === e.occurrenceKey || popover === e.occurrenceKey;
                const dim = (hover || popover) && !active;
                const inMonth = Number(e.dateFrom.slice(5, 7)) - 1 === month;
                const label = t("calendar.eventAria", { title: bi(locale, e.titleEn, e.titleAr), date: dateLine(e) });
                return (
                  <g
                    key={e.occurrenceKey}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-expanded={popover === e.occurrenceKey}
                    className="cursor-pointer outline-none"
                    data-calendar-mark
                    data-testid="calendar-event"
                    data-kind={e.kind}
                    onMouseEnter={() => setHover(e.occurrenceKey)}
                    onMouseLeave={() => setHover((cur) => (cur === e.occurrenceKey ? null : cur))}
                    onFocus={() => setHover(e.occurrenceKey)}
                    onBlur={() => setHover((cur) => (cur === e.occurrenceKey ? null : cur))}
                    onClick={() => {
                      setPopover((cur) => (cur === e.occurrenceKey ? null : e.occurrenceKey));
                      setMonth(Number(e.dateFrom.slice(5, 7)) - 1);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setPopover((cur) => (cur === e.occurrenceKey ? null : e.occurrenceKey));
                        setMonth(Number(e.dateFrom.slice(5, 7)) - 1);
                      }
                    }}
                    style={{ transition: reduced ? undefined : "opacity 200ms var(--ease-paper)" }}
                    opacity={dim ? 0.3 : 1}
                  >
                    {range ? (
                      <path d={range} transform={`translate(${C} ${C})`} fill={CALENDAR_KIND_VAR[e.kind]} stroke="#ffffff" strokeWidth={1} />
                    ) : null}
                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 7 : inMonth ? 5 : 4}
                      fill={CALENDAR_KIND_VAR[e.kind]}
                      stroke={active ? "var(--color-gold-500)" : "#ffffff"}
                      strokeWidth={active ? 2.5 : 1.5}
                      style={{ transition: reduced ? undefined : "r 150ms var(--ease-paper)" }}
                    />
                    {active ? <circle cx={x} cy={y} r={11} fill="none" stroke={CALENDAR_KIND_VAR[e.kind]} strokeOpacity={0.35} strokeWidth={1} /> : null}
                    <title>{label}</title>
                    {/* an invisible larger target keeps small dots easy to hit */}
                    <circle cx={x} cy={y} r={8} fill="transparent" stroke="none" />
                  </g>
                );
              })}

              {/* the centre */}
              <text x={C} y={C - 8} textAnchor="middle" fontSize={44} fontWeight={600} fill="var(--color-maroon-900)" className="select-none tnum" style={{ fontFamily: displayFont(locale) }}>
                {fmt.year(year)}
              </text>
              <text x={C} y={C + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-600)" className="select-none tnum" style={{ fontFamily: locale === "ar" ? "var(--font-arabic)" : "var(--font-sans)" }}>
                {t("calendar.eventsInYear", { count: events.length, year: String(year) })}
              </text>
              {todayAngle != null ? (
                <text x={C} y={C + 34} textAnchor="middle" fontSize={10} fill="var(--color-maroon-700)" className="select-none tnum" style={{ fontFamily: locale === "ar" ? "var(--font-arabic)" : "var(--font-sans)" }}>
                  {t("calendar.today")}: {fmt.d(today, "medium")}
                </text>
              ) : null}
            </svg>

            {/* hover tooltip or click popover, anchored to the mark */}
            {hovered ? (
              <div
                className={cn(
                  "absolute z-20 w-64 rounded-xl border border-sand-300 bg-white p-3 shadow-[var(--shadow-pop)]",
                  popover ? "pointer-events-auto" : "pointer-events-none"
                )}
                style={{
                  /* the box is 16rem wide and centred on the mark: clamping the
                     centre keeps it inside the ring on a narrow screen, where a
                     mark on the left edge would otherwise push it off screen */
                  left: `clamp(8.25rem, ${(hovered.x / SIZE) * 100}%, calc(100% - 8.25rem))`,
                  top: `${(hovered.y / SIZE) * 100}%`,
                  transform: hovered.y < SIZE / 2 ? "translate(-50%, 14px)" : "translate(-50%, calc(-100% - 14px))",
                  direction: locale === "ar" ? "rtl" : "ltr",
                }}
                dir={locale === "ar" ? "rtl" : "ltr"}
                role={popover ? "dialog" : "tooltip"}
                aria-label={popover ? bi(locale, hovered.e.titleEn, hovered.e.titleAr) : undefined}
                data-calendar-popover
                data-testid={popover ? "calendar-popover" : "calendar-tooltip"}
              >
                {popover ? (
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setPopover(null)}
                    aria-label={t("calendar.closePopover")}
                    className="absolute end-2 top-2 cursor-pointer rounded-md p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-gold-500"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
                <div className={cn(popover && "pe-6")}>
                  <EventDetails e={hovered.e} />
                </div>
                {popover && canEdit ? (
                  <div className="mt-2.5 flex items-center gap-1 border-t border-sand-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setDraft(draftOf(hovered.e, year))}
                      aria-label={t("calendar.editAria", { title: bi(locale, hovered.e.titleEn, hovered.e.titleAr) })}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-sand-100 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
                      data-testid="calendar-edit"
                    >
                      <Pencil className="size-3" aria-hidden /> {t("actions.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(hovered.e)}
                      aria-label={t("calendar.deleteAria", { title: bi(locale, hovered.e.titleEn, hovered.e.titleAr) })}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-sand-100 hover:text-danger focus-visible:outline-2 focus-visible:outline-gold-500"
                      data-testid="calendar-delete"
                    >
                      <Trash2 className="size-3" aria-hidden /> {t("actions.delete")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center" aria-live="polite" aria-busy>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-ink-600 shadow-[var(--shadow-paper)]">{t("calendar.loading")}</span>
              </div>
            ) : null}
          </div>

          {/* the legend */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" data-testid="calendar-legend">
            {KINDS.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span className="inline-block size-2.5 rounded-full" style={{ background: CALENDAR_KIND_VAR[k] }} aria-hidden />
                {kindLabel(k)}
              </span>
            ))}
            {todayAngle != null ? (
              <span className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span className="inline-block h-3 w-0.5 rounded bg-maroon-700" aria-hidden />
                {t("calendar.today")}
              </span>
            ) : null}
          </div>
        </div>

        {/* the month list */}
        <div className="card p-4 sm:p-5" data-testid="calendar-month-list" aria-live="polite">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-lg text-ink-900" style={{ fontFamily: displayFont(locale) }} data-testid="calendar-month-title">
              {fmt.month(month, "long")} <span className="text-ink-400 tnum">{fmt.year(year)}</span>
            </h3>
            <span className="text-xs text-ink-600 tnum">{t("calendar.listCount", { count: byMonth[month].length })}</span>
          </div>
          {loading ? (
            <div className="space-y-2" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title={t("calendar.empty")} hint={t("calendar.emptyHint")} />
          ) : byMonth[month].length === 0 ? (
            <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-6 text-center text-xs text-ink-600">{t("calendar.listEmpty")}</p>
          ) : (
            <ol className="max-h-[520px] space-y-1.5 overflow-y-auto pe-1">
              {byMonth[month].map((e) => {
                const href = linkedHref(e.linked);
                const isOpen = popover === e.occurrenceKey;
                return (
                  <li
                    key={e.occurrenceKey}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors",
                      isOpen ? "border-maroon-300 bg-maroon-50/60" : "border-sand-200 hover:bg-sand-50"
                    )}
                    onMouseEnter={() => setHover(e.occurrenceKey)}
                    onMouseLeave={() => setHover((cur) => (cur === e.occurrenceKey ? null : cur))}
                    data-testid="calendar-list-item"
                  >
                    <span className="mt-0.5 w-12 shrink-0 text-[11px] font-semibold text-ink-600 tnum">{fmt.dayMonth(e.dateFrom)}</span>
                    <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full" style={{ background: CALENDAR_KIND_VAR[e.kind] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setPopover((cur) => (cur === e.occurrenceKey ? null : e.occurrenceKey))}
                        aria-expanded={isOpen}
                        className="block w-full cursor-pointer text-start text-sm font-medium leading-snug text-ink-900 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
                      >
                        {bi(locale, e.titleEn, e.titleAr)}
                      </button>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-600">
                        <span>{kindLabel(e.kind)}</span>
                        {e.ownerUnit ? <span className="text-ink-400">{e.ownerUnit.code}</span> : null}
                        {e.dateTo && e.dateTo !== e.dateFrom ? <span className="tnum">{t("calendar.dateRange", { from: fmt.d(e.dateFrom, "short"), to: fmt.d(e.dateTo, "short") })}</span> : null}
                        {href && e.linked ? (
                          <Link href={href as never} className="link-draw font-medium text-maroon-700" aria-label={t("calendar.openLinked", { title: bi(locale, e.linked.titleEn, e.linked.titleAr) })}>
                            {bi(locale, e.linked.titleEn, e.linked.titleAr)}
                          </Link>
                        ) : null}
                      </span>
                    </span>
                    {canEdit ? (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDraft(draftOf(e, year))}
                          aria-label={t("calendar.editAria", { title: bi(locale, e.titleEn, e.titleAr) })}
                          className="cursor-pointer rounded-md p-1 text-ink-400 hover:bg-white hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(e)}
                          aria-label={t("calendar.deleteAria", { title: bi(locale, e.titleEn, e.titleAr) })}
                          className="cursor-pointer rounded-md p-1 text-ink-400 hover:bg-white hover:text-danger focus-visible:outline-2 focus-visible:outline-gold-500"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {draft ? (
        <EventDialog draft={draft} units={units} busy={busy} onChange={setDraft} onSave={() => void save()} onClose={() => setDraft(null)} />
      ) : null}
    </SectionBand>
  );
}
