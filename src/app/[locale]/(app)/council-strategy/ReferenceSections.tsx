"use client";
// CR07 2.4.7: the six reference sections beneath the results chain. Situation
// analysis, the implementation plan, the monitoring and evaluation framework,
// the risk register, governance, and the prioritisation matrix. Each opens in
// place; every chart is inline SVG or a CSS grid, never a table.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import {
  CalendarDays,
  ChevronDown,
  Gauge,
  Landmark,
  Lightbulb,
  ListOrdered,
  ShieldAlert,
  ShieldCheck,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import { Avatar, Chip, EmptyState, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { CouncilNodeView, CouncilPageData, Rag } from "@/server/services/council";

const EASE = [0.22, 1, 0.36, 1] as const;

const STATUS_KEYS = ["not_started", "on_track", "at_risk", "delayed", "completed"] as const;

const STATUS_TOKEN: Record<string, string> = {
  not_started: "var(--color-ink-400)",
  on_track: "var(--color-info)",
  at_risk: "var(--color-warn)",
  delayed: "var(--color-danger)",
  completed: "var(--color-ok)",
};

const STATUS_CHIP: Record<string, "mist" | "info" | "warn" | "danger" | "ok"> = {
  not_started: "mist",
  on_track: "info",
  at_risk: "warn",
  delayed: "danger",
  completed: "ok",
};

const RAG_CHIP: Record<Rag, "ok" | "warn" | "danger" | "mist"> = {
  on_target: "ok",
  at_risk: "warn",
  behind: "danger",
  no_data: "mist",
};

const RISK_STATUSES = ["open", "mitigating", "closed"] as const;

/** Governance cadences the seed uses; anything else is shown as stored. */
const KNOWN_CADENCES = new Set(["monthly", "quarterly", "yearly", "weekly", "annual"]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function patchCouncil(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/council", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* the accordion shell                                                  */
/* ------------------------------------------------------------------ */

function Section({
  testId,
  icon,
  title,
  hint,
  badge,
  children,
}: {
  testId: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const panelId = React.useId();
  return (
    <section className="card overflow-hidden" data-testid={testId}>
      {/* h2, not h3: these are top level sections of the page and the only
          heading above them is the strategy name */}
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-mist-50"
        >
          <span className="text-navy-700 [&_svg]:size-4.5" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">{title}</span>
            <span className="mt-0.5 block text-xs text-ink-600">{hint}</span>
          </span>
          {badge ? <Chip tone="mist">{badge}</Chip> : null}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </h2>
      <motion.div
        id={panelId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.26, ease: EASE }}
        className="overflow-hidden"
        aria-hidden={!open}
      >
        {/* inert keeps the collapsed panel out of the tab order as well as
            out of the accessibility tree */}
        <div
          inert={!open}
          className={cn("border-t border-mist-200 px-5 py-5", !open && "pointer-events-none")}
        >
          {children}
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 1. situation analysis                                                */
/* ------------------------------------------------------------------ */

const SWOT_QUADRANTS = [
  { key: "strength", token: "var(--color-ok)", Icon: ShieldCheck },
  { key: "weakness", token: "var(--color-danger)", Icon: ShieldAlert },
  { key: "opportunity", token: "var(--color-info)", Icon: Lightbulb },
  { key: "threat", token: "var(--color-warn)", Icon: TriangleAlert },
] as const;

function StakeholderGrid({ data }: { data: CouncilPageData }) {
  const t = useTranslations("council");
  const locale = useLocale();
  const [active, setActive] = React.useState<number | null>(null);
  const people = data.analysis.stakeholders;

  const W = 380;
  const H = 320;
  const PL = 52;
  const PR = 20;
  const PT = 20;
  const PB = 48;
  const px = (influence: number) => PL + ((clamp(influence, 1, 5) - 1) / 4) * (W - PL - PR);
  const py = (interest: number) => H - PB - ((clamp(interest, 1, 5) - 1) / 4) * (H - PT - PB);

  /* people sharing a coordinate are spread so no dot hides another */
  const placed = React.useMemo(() => {
    const groups = new Map<string, number[]>();
    people.forEach((p, i) => {
      const key = `${Math.round(p.influence)}|${Math.round(p.interest)}`;
      const list = groups.get(key) ?? [];
      list.push(i);
      groups.set(key, list);
    });
    return people.map((p, i) => {
      const key = `${Math.round(p.influence)}|${Math.round(p.interest)}`;
      const group = groups.get(key) ?? [i];
      const k = group.indexOf(i);
      const offset = (k - (group.length - 1) / 2) * 26;
      return {
        person: p,
        index: i,
        cx: clamp(px(p.influence) + offset, PL - 6, W - PR + 6),
        cy: py(p.interest),
      };
    });
  }, [people]);

  if (!people.length) return <EmptyState title={t("situation.noStakeholders")} />;

  const hovered = active != null ? placed.find((p) => p.index === active) ?? null : null;

  return (
    <div data-testid="stakeholder-grid">
      <div className="relative" style={{ direction: "ltr" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={t("situation.stakeholderAria")}
        >
          <rect
            x={PL}
            y={PT}
            width={W - PL - PR}
            height={H - PT - PB}
            fill="var(--color-mist-50)"
            stroke="var(--color-mist-300)"
          />
          {/* the quadrant divide */}
          <line
            x1={px(3)}
            y1={PT}
            x2={px(3)}
            y2={H - PB}
            stroke="var(--color-mist-300)"
            strokeDasharray="4 4"
          />
          <line
            x1={PL}
            y1={py(3)}
            x2={W - PR}
            y2={py(3)}
            stroke="var(--color-mist-300)"
            strokeDasharray="4 4"
          />
          <text x={PL + 8} y={PT + 16} fontSize={9} fill="var(--color-ink-400)">
            {t("situation.quadrant.keepInformed")}
          </text>
          <text x={W - PR - 8} y={PT + 16} fontSize={9} fill="var(--color-ink-400)" textAnchor="end">
            {t("situation.quadrant.manageClosely")}
          </text>
          <text x={PL + 8} y={H - PB - 8} fontSize={9} fill="var(--color-ink-400)">
            {t("situation.quadrant.monitor")}
          </text>
          <text
            x={W - PR - 8}
            y={H - PB - 8}
            fontSize={9}
            fill="var(--color-ink-400)"
            textAnchor="end"
          >
            {t("situation.quadrant.keepSatisfied")}
          </text>

          {[1, 2, 3, 4, 5].map((v) => (
            <text
              key={`x${v}`}
              x={px(v)}
              y={H - PB + 16}
              fontSize={10}
              textAnchor="middle"
              fill="var(--color-ink-600)"
            >
              {v}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((v) => (
            <text
              key={`y${v}`}
              x={PL - 10}
              y={py(v) + 3}
              fontSize={10}
              textAnchor="end"
              fill="var(--color-ink-600)"
            >
              {v}
            </text>
          ))}
          <text
            x={PL + (W - PL - PR) / 2}
            y={H - 8}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink-900)"
          >
            {t("situation.influenceAxis")}
          </text>
          <text
            x={14}
            y={PT + (H - PT - PB) / 2}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink-900)"
            transform={`rotate(-90 14 ${PT + (H - PT - PB) / 2})`}
          >
            {t("situation.interestAxis")}
          </text>

          {placed.map((p) => (
            <g
              key={p.index}
              tabIndex={0}
              role="img"
              className="cursor-pointer focus:outline-none"
              aria-label={t("situation.stakeholderDotAria", {
                name: bi(locale, p.person.nameEn, p.person.nameAr),
                role: bi(locale, p.person.roleEn, p.person.roleAr),
                interest: p.person.interest,
                influence: p.person.influence,
              })}
              onMouseEnter={() => setActive(p.index)}
              onMouseLeave={() => setActive((cur) => (cur === p.index ? null : cur))}
              onFocus={() => setActive(p.index)}
              onBlur={() => setActive((cur) => (cur === p.index ? null : cur))}
            >
              <circle
                cx={p.cx}
                cy={p.cy}
                r={12}
                fill="var(--color-navy-100)"
                stroke={active === p.index ? "var(--color-aqua-500)" : "var(--color-navy-700)"}
                strokeWidth={active === p.index ? 3 : 1.5}
              />
              <text
                x={p.cx}
                y={p.cy + 4}
                fontSize={10}
                textAnchor="middle"
                fill="var(--color-navy-900)"
                fontWeight={600}
              >
                {p.index + 1}
              </text>
            </g>
          ))}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-mist-300 bg-white p-3 shadow-[var(--shadow-pop)]"
            style={{
              left: `${(hovered.cx / W) * 100}%`,
              top: `${(hovered.cy / H) * 100}%`,
              transform: "translate(-50%, -115%)",
            }}
          >
            <p className="text-sm font-semibold text-ink-900" dir="ltr">
              {hovered.person.nameEn}
            </p>
            <p className="text-sm font-semibold text-ink-900" dir="rtl">
              {hovered.person.nameAr}
            </p>
            <p className="mt-1 text-xs text-ink-600" dir="ltr">
              {hovered.person.roleEn}
            </p>
            <p className="text-xs text-ink-600" dir="rtl">
              {hovered.person.roleAr}
            </p>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {placed.map((p) => (
          <li
            key={p.index}
            className={cn(
              "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
              active === p.index ? "bg-navy-50" : "bg-transparent"
            )}
            onMouseEnter={() => setActive(p.index)}
            onMouseLeave={() => setActive((cur) => (cur === p.index ? null : cur))}
          >
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[10px] font-semibold text-navy-900 tnum">
              {p.index + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink-900">
                {bi(locale, p.person.nameEn, p.person.nameAr)}
              </span>
              <span className="block text-ink-600">
                {bi(locale, p.person.roleEn, p.person.roleAr)}
              </span>
              <span className="block text-ink-400 tnum">
                {t("situation.interestInfluence", {
                  interest: p.person.interest,
                  influence: p.person.influence,
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SituationAnalysis({ data }: { data: CouncilPageData }) {
  const t = useTranslations("council");
  const locale = useLocale();
  const goals = data.nodes.filter((n) => n.level === "goal");

  return (
    <div className="space-y-8">
      <div>
        <h4 className="mb-3 text-sm font-semibold text-ink-900">{t("situation.swotTitle")}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {SWOT_QUADRANTS.map(({ key, token, Icon }) => {
            const items = data.analysis.swot.filter((s) => s.quadrant === key);
            return (
              <div
                key={key}
                className="rounded-xl border p-4"
                style={{
                  borderColor: `color-mix(in srgb, ${token} 34%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${token} 6%, transparent)`,
                }}
              >
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: token }}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(`situation.swot.${key}`)}
                  <span className="ms-auto text-ink-400 tnum">{items.length}</span>
                </p>
                {items.length ? (
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-900">
                        <span aria-hidden style={{ color: token }}>
                          &bull;
                        </span>
                        <span>{bi(locale, item.textEn, item.textAr)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-400">{t("situation.swotEmpty")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-ink-900">
          {t("situation.stakeholderTitle")}
        </h4>
        <p className="mb-3 text-xs text-ink-600">{t("situation.stakeholderHint")}</p>
        <StakeholderGrid data={data} />
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-ink-900">{t("situation.challengesTitle")}</h4>
        {data.analysis.challenges.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.analysis.challenges.map((challenge, i) => {
              const goal = goals.find((g) => g.code === challenge.goalCode);
              return (
                <article key={i} className="rounded-xl border border-mist-200 p-4">
                  <h5 className="text-sm font-semibold text-ink-900">
                    {bi(locale, challenge.titleEn, challenge.titleAr)}
                  </h5>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    {bi(locale, challenge.descriptionEn, challenge.descriptionAr)}
                  </p>
                  <div className="mt-2.5">
                    <Chip tone="navy">
                      <Target className="size-3" aria-hidden />
                      {goal
                        ? `${goal.code ? `${goal.code} ` : ""}${bi(locale, goal.titleEn, goal.titleAr)}`
                        : t("situation.noGoal")}
                    </Chip>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{t("situation.challengesEmpty")}</p>
        )}
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-ink-900">{t("situation.baselineTitle")}</h4>
        {data.analysis.baseline.length ? (
          <ol className="measure list-decimal space-y-2 ps-5 text-sm leading-relaxed text-ink-900 marker:text-navy-700 marker:tnum">
            {data.analysis.baseline.map((item, i) => (
              <li key={i}>{bi(locale, item.textEn, item.textAr)}</li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-ink-400">{t("situation.baselineEmpty")}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. implementation plan: projects by department on one 2025 to 2030   */
/* axis                                                                 */
/* ------------------------------------------------------------------ */

const AXIS_FROM = Date.UTC(2025, 0, 1);
const AXIS_TO = Date.UTC(2030, 11, 31);
const AXIS_SPAN = AXIS_TO - AXIS_FROM;
const AXIS_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

function pctOf(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return clamp(((ms - AXIS_FROM) / AXIS_SPAN) * 100, 0, 100);
}

function ImplementationPlan({ data }: { data: CouncilPageData }) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [unitFilter, setUnitFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [hover, setHover] = React.useState<string | null>(null);

  const projects = React.useMemo(
    () => data.nodes.filter((n) => n.level === "project").sort((a, b) => a.sort - b.sort),
    [data.nodes]
  );

  const units = React.useMemo(() => {
    const map = new Map<string, { id: string; code: string; nameEn: string; nameAr: string }>();
    for (const p of projects) if (p.ownerUnit) map.set(p.ownerUnit.id, p.ownerUnit);
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [projects]);

  const shown = projects.filter(
    (p) =>
      (unitFilter === "all" || (p.ownerUnit?.id ?? "none") === unitFilter) &&
      (statusFilter === "all" || p.status === statusFilter)
  );

  const groups = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: CouncilNodeView[] }>();
    for (const p of shown) {
      const key = p.ownerUnit?.id ?? "none";
      const label = p.ownerUnit
        ? bi(locale, p.ownerUnit.nameEn, p.ownerUnit.nameAr)
        : t("implementation.noUnit");
      const entry = map.get(key) ?? { key, label, items: [] };
      entry.items.push(p);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [shown, locale, t]);

  const todayPct = pctOf(new Date().toISOString().slice(0, 10));
  const hoveredProject = hover ? shown.find((p) => p.id === hover) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-600">
            {t("implementation.unitFilter")}
          </span>
          <NativeSelect
            className="w-48 cursor-pointer"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
          >
            <option value="all">{tc("all")}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {bi(locale, u.nameEn, u.nameAr)}
              </option>
            ))}
            <option value="none">{t("implementation.noUnit")}</option>
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("risks.statusLabel")}</span>
          <NativeSelect
            className="w-44 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{tc("all")}</option>
            {STATUS_KEYS.map((s) => (
              <option key={s} value={s}>
                {t(`implementation.status.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {!groups.length ? (
        <EmptyState title={tc("nothingHere")} hint={t("implementation.emptyHint")} />
      ) : (
        <div className="overflow-x-auto" data-testid="implementation-timeline">
          <div className="relative" style={{ direction: "ltr", minWidth: "42rem" }}>
            {/* the year axis */}
            <div className="relative mb-2 h-6 border-b border-mist-300">
              {AXIS_YEARS.map((year) => {
                const left = ((Date.UTC(year, 0, 1) - AXIS_FROM) / AXIS_SPAN) * 100;
                return (
                  <span
                    key={year}
                    className="absolute top-0 text-[11px] text-ink-600 tnum"
                    style={{ left: `${left}%` }}
                  >
                    {year}
                  </span>
                );
              })}
            </div>

            {/* today */}
            {todayPct != null ? (
              <div
                className="pointer-events-none absolute bottom-0 top-6 w-px bg-navy-700/60"
                style={{ left: `${todayPct}%` }}
                aria-hidden
              >
                <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded bg-navy-700 px-1.5 py-0.5 text-[10px] text-white">
                  {t("implementation.today")}
                </span>
              </div>
            ) : null}

            {groups.map((group) => (
              <div key={group.key} className="mb-4">
                <p
                  className="mb-1 text-xs font-semibold text-ink-900"
                  style={{ direction: locale === "ar" ? "rtl" : "ltr", textAlign: "start" }}
                >
                  {group.label}
                  <span className="ms-2 font-normal text-ink-400 tnum">{group.items.length}</span>
                </p>
                {group.items.map((project) => {
                  const start = pctOf(project.startDate);
                  const end = pctOf(project.endDate);
                  const dates =
                    project.startDate && project.endDate
                      ? t("implementation.dateRange", {
                          from: formatDate(project.startDate, locale, { style: "medium" }),
                          to: formatDate(project.endDate, locale, { style: "medium" }),
                        })
                      : t("implementation.noDates");
                  const label = t("implementation.barAria", {
                    code: project.code ?? "",
                    title: bi(locale, project.titleEn, project.titleAr),
                    owner: project.ownerUnit
                      ? bi(locale, project.ownerUnit.nameEn, project.ownerUnit.nameAr)
                      : t("implementation.noUnit"),
                    status: t(`implementation.status.${project.status}`),
                    dates,
                  });
                  if (start == null || end == null) {
                    return (
                      <div key={project.id} className="mb-1 flex h-7 items-center gap-2">
                        <Chip tone="mist">{project.code ?? ""}</Chip>
                        <span className="text-[11px] text-ink-400">
                          {t("implementation.noDates")}
                        </span>
                      </div>
                    );
                  }
                  const width = Math.max(1.5, end - start);
                  const token = STATUS_TOKEN[project.status] ?? "var(--color-ink-400)";
                  return (
                    <div key={project.id} className="relative mb-1 h-7">
                      <button
                        type="button"
                        aria-label={label}
                        onMouseEnter={() => setHover(project.id)}
                        onMouseLeave={() => setHover((c) => (c === project.id ? null : c))}
                        onFocus={() => setHover(project.id)}
                        onBlur={() => setHover((c) => (c === project.id ? null : c))}
                        className="absolute top-0.5 flex h-6 cursor-pointer items-center overflow-hidden rounded-md px-2 transition-transform duration-150 hover:-translate-y-0.5"
                        style={{
                          left: `${start}%`,
                          width: `${width}%`,
                          backgroundColor: `color-mix(in srgb, ${token} 20%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${token} 55%, transparent)`,
                          color: token,
                        }}
                      >
                        <span className="truncate text-[10px] font-semibold tnum">
                          {project.code ?? ""}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* the raised card for the bar under the pointer or the keyboard focus */}
      {hoveredProject ? (
        <div className="mt-2 rounded-xl border border-mist-300 bg-white p-3 shadow-[var(--shadow-paper)]">
          <p className="text-[11px] font-semibold text-navy-700 tnum">
            {hoveredProject.code ?? ""}
          </p>
          <p className="text-sm font-semibold text-ink-900">
            {bi(locale, hoveredProject.titleEn, hoveredProject.titleAr)}
          </p>
          <p className="mt-1 text-xs text-ink-600">
            {hoveredProject.ownerUnit
              ? bi(locale, hoveredProject.ownerUnit.nameEn, hoveredProject.ownerUnit.nameAr)
              : t("implementation.noUnit")}
          </p>
          <p className="text-xs text-ink-600 tnum">
            {hoveredProject.startDate && hoveredProject.endDate
              ? t("implementation.dateRange", {
                  from: formatDate(hoveredProject.startDate, locale, { style: "medium" }),
                  to: formatDate(hoveredProject.endDate, locale, { style: "medium" }),
                })
              : t("implementation.noDates")}
          </p>
          <div className="mt-2">
            <Chip tone={STATUS_CHIP[hoveredProject.status] ?? "mist"}>
              {t(`implementation.status.${hoveredProject.status}`)}
            </Chip>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-600">
        {STATUS_KEYS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-4 rounded-sm"
              style={{
                backgroundColor: `color-mix(in srgb, ${STATUS_TOKEN[s]} 30%, transparent)`,
                border: `1px solid color-mix(in srgb, ${STATUS_TOKEN[s]} 60%, transparent)`,
              }}
              aria-hidden
            />
            {t(`implementation.status.${s}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. monitoring and evaluation                                         */
/* ------------------------------------------------------------------ */

function MonitoringFramework({ data }: { data: CouncilPageData }) {
  const t = useTranslations("council");
  const locale = useLocale();
  const nodeById = React.useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  const lanes = React.useMemo(
    () =>
      (["monthly", "quarterly", "yearly"] as const).map((cadence) => ({
        cadence,
        items: data.indicators
          .filter((i) => i.frequency === cadence)
          .sort((a, b) => a.code.localeCompare(b.code)),
      })),
    [data.indicators]
  );

  /* the next twelve reporting moments: month ends carry the monthly
     indicators, quarter ends add the quarterly ones, December adds the
     yearly ones */
  const calendar = React.useMemo(() => {
    const counts = {
      monthly: lanes[0].items.length,
      quarterly: lanes[1].items.length,
      yearly: lanes[2].items.length,
    };
    const now = new Date();
    const out: { date: string; count: number; parts: string[] }[] = [];
    for (let i = 0; i < 60 && out.length < 12; i++) {
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 0));
      if (end.getTime() < now.getTime()) continue;
      const month = end.getUTCMonth();
      const isQuarter = month === 2 || month === 5 || month === 8 || month === 11;
      const isYear = month === 11;
      let count = counts.monthly;
      const parts: string[] = [];
      if (counts.monthly) parts.push("monthly");
      if (isQuarter && counts.quarterly) {
        count += counts.quarterly;
        parts.push("quarterly");
      }
      if (isYear && counts.yearly) {
        count += counts.yearly;
        parts.push("yearly");
      }
      if (!count) continue;
      out.push({ date: end.toISOString().slice(0, 10), count, parts });
    }
    return out;
  }, [lanes]);

  return (
    <div className="space-y-6">
      {lanes.map((lane) => (
        <div key={lane.cadence}>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Gauge className="size-4 text-navy-700" aria-hidden />
            {t(`me.cadence.${lane.cadence}`)}
            <span className="text-ink-400 tnum">{lane.items.length}</span>
          </h4>
          {lane.items.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lane.items.map((indicator) => {
                const node = nodeById.get(indicator.nodeId);
                return (
                  <article
                    key={indicator.id}
                    className="rounded-xl border border-mist-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-navy-700 tnum">
                        {indicator.code}
                      </p>
                      <Chip tone={RAG_CHIP[indicator.rag]}>{t(`me.rag.${indicator.rag}`)}</Chip>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-snug text-ink-900">
                      {bi(locale, indicator.nameEn, indicator.nameAr)}
                    </p>
                    <p className="mt-1.5 text-[11px] text-ink-600">
                      {t("me.measures")}{" "}
                      {node ? bi(locale, node.titleEn, node.titleAr) : t("me.unknownNode")}
                    </p>
                    {indicator.unit ? (
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {t("me.unit")} {indicator.unit}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-400">{t("me.laneEmpty")}</p>
          )}
        </div>
      ))}

      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <CalendarDays className="size-4 text-navy-700" aria-hidden />
          {t("me.calendarTitle")}
        </h4>
        <p className="mb-3 text-xs text-ink-600">{t("me.calendarHint")}</p>
        {calendar.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {calendar.map((moment) => (
              <div key={moment.date} className="rounded-xl border border-mist-200 px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-900 tnum">
                  {formatDate(moment.date, locale, { style: "medium" })}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-600 tnum">
                  {t("me.reportingCount", { count: moment.count })}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {moment.parts.map((part) => (
                    <Chip key={part} tone="mist">
                      {t(`me.cadenceShort.${part}`)}
                    </Chip>
                  ))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{t("me.calendarEmpty")}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. risk register                                                     */
/* ------------------------------------------------------------------ */

function severityToken(score: number): string {
  if (score <= 6) return "var(--color-ok)";
  if (score <= 12) return "var(--color-warn)";
  return "var(--color-danger)";
}

function RiskRegister({ data, canEdit }: { data: CouncilPageData; canEdit: boolean }) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [cell, setCell] = React.useState<{ likelihood: number; impact: number } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const risk of data.risks) {
      const key = `${clamp(risk.likelihood, 1, 5)}|${clamp(risk.impact, 1, 5)}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [data.risks]);

  const shown = cell
    ? data.risks.filter((r) => r.likelihood === cell.likelihood && r.impact === cell.impact)
    : data.risks;

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const ok = await patchCouncil({ kind: "risk", id, status });
    setBusy(null);
    if (ok) router.refresh();
    else toast(tc("error"), "error");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-ink-600">{t("risks.heatHint")}</p>
        <div data-testid="risk-heatmap" className="inline-block max-w-full">
          <div role="grid" aria-label={t("risks.heatAria")}>
            {[5, 4, 3, 2, 1].map((impact) => (
            <div
              key={impact}
              role="row"
              className="grid gap-1 pb-1"
              style={{ gridTemplateColumns: "1.75rem repeat(5, minmax(2.75rem, 3.5rem))" }}
            >
              <div
                role="rowheader"
                aria-label={t("risks.impactRow", { value: impact })}
                className="flex items-center justify-center text-[11px] text-ink-600 tnum"
              >
                {impact}
              </div>
              {[1, 2, 3, 4, 5].map((likelihood) => {
                const count = counts.get(`${likelihood}|${impact}`) ?? 0;
                const score = likelihood * impact;
                const token = severityToken(score);
                const selected = cell?.likelihood === likelihood && cell?.impact === impact;
                return (
                  <div key={likelihood} role="gridcell">
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={t("risks.cellAria", {
                        likelihood,
                        impact,
                        count,
                        severity: t(
                          `risks.severity.${score <= 6 ? "low" : score <= 12 ? "medium" : "high"}`
                        ),
                      })}
                      onClick={() =>
                        setCell(selected ? null : { likelihood, impact })
                      }
                      className={cn(
                        "flex h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tnum transition-transform duration-150 hover:-translate-y-0.5",
                        selected && "ring-2 ring-aqua-500"
                      )}
                      style={{
                        backgroundColor: count
                          ? `color-mix(in srgb, ${token} ${10 + score * 2.4}%, transparent)`
                          : "var(--color-mist-50)",
                        color: count ? token : "var(--color-ink-400)",
                        border: `1px solid color-mix(in srgb, ${token} ${count ? 40 : 14}%, transparent)`,
                      }}
                    >
                      {formatNumber(count, locale, { decimals: 0 })}
                    </button>
                  </div>
                );
              })}
              </div>
            ))}
          </div>
          <div
            className="grid gap-1 pt-0.5"
            style={{ gridTemplateColumns: "1.75rem repeat(5, minmax(2.75rem, 3.5rem))" }}
            aria-hidden
          >
            <span />
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className="text-center text-[11px] text-ink-600 tnum">
                {l}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">{t("risks.axes")}</p>
        {cell ? (
          <button
            type="button"
            onClick={() => setCell(null)}
            className="mt-2 cursor-pointer text-xs font-medium text-navy-700 underline-offset-4 hover:underline"
          >
            {tc("clearFilters")}
          </button>
        ) : null}
      </div>

      {shown.length ? (
        <div className="space-y-2">
          {shown.map((risk) => (
            <article
              key={risk.id}
              data-testid="risk-row"
              className="rounded-xl border border-mist-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {risk.code ? (
                    <p className="text-[11px] font-semibold text-navy-700 tnum">{risk.code}</p>
                  ) : null}
                  <h5 className="text-sm font-semibold text-ink-900">
                    {bi(locale, risk.titleEn, risk.titleAr)}
                  </h5>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="mist">
                    {t("risks.likelihoodChip", { value: risk.likelihood })}
                  </Chip>
                  <Chip tone="mist">{t("risks.impactChip", { value: risk.impact })}</Chip>
                  <Chip
                    tone={
                      risk.status === "closed"
                        ? "ok"
                        : risk.status === "mitigating"
                          ? "info"
                          : "warn"
                    }
                  >
                    {t(`risks.status.${risk.status}`)}
                  </Chip>
                </div>
              </div>
              {risk.descriptionEn || risk.descriptionAr ? (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                  {bi(locale, risk.descriptionEn, risk.descriptionAr)}
                </p>
              ) : null}
              {risk.mitigationEn || risk.mitigationAr ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-900">
                  <span className="font-semibold">{t("risks.mitigation")} </span>
                  {bi(locale, risk.mitigationEn, risk.mitigationAr)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {risk.owner ? (
                  <span className="flex items-center gap-2 text-xs text-ink-600">
                    <Avatar name={bi(locale, risk.owner.nameEn, risk.owner.nameAr)} size={22} />
                    {bi(locale, risk.owner.nameEn, risk.owner.nameAr)}
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">{t("risks.noOwner")}</span>
                )}
                {canEdit ? (
                  <label className="ms-auto flex items-center gap-2 text-xs text-ink-600">
                    <span>{t("risks.changeStatus")}</span>
                    <NativeSelect
                      className="h-8 w-36 cursor-pointer text-xs"
                      value={risk.status}
                      disabled={busy === risk.id}
                      aria-label={t("risks.changeStatusAria", {
                        risk: bi(locale, risk.titleEn, risk.titleAr),
                      })}
                      onChange={(e) => void setStatus(risk.id, e.target.value)}
                    >
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`risks.status.${s}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={tc("nothingHere")} hint={t("risks.emptyHint")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. prioritisation matrix                                             */
/* ------------------------------------------------------------------ */

const PW = 440;
const PH = 360;
const PPL = 50;
const PPR = 22;
const PPT = 22;
const PPB = 46;

const pfx = (feasibility: number) => PPL + ((clamp(feasibility, 1, 5) - 1) / 4) * (PW - PPL - PPR);
const pfy = (impact: number) => PH - PPB - ((clamp(impact, 1, 5) - 1) / 4) * (PH - PPT - PPB);

function PriorityMatrix({ data, canEdit }: { data: CouncilPageData; canEdit: boolean }) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [override, setOverride] = React.useState<
    Record<string, { impact: number; feasibility: number }>
  >({});
  const [drag, setDrag] = React.useState<{ id: string; impact: number; feasibility: number } | null>(
    null
  );
  const [hover, setHover] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const projects = React.useMemo(
    () => data.nodes.filter((n) => n.level === "project"),
    [data.nodes]
  );
  const placed = projects.filter(
    (p) => override[p.id] || (p.priorityImpact != null && p.priorityFeasibility != null)
  );
  const unplaced = projects.filter((p) => !placed.includes(p));
  const maxBudget = Math.max(1, ...placed.map((p) => p.budgetQar ?? 0));

  const coordsOf = React.useCallback(
    (project: CouncilNodeView) => {
      if (drag && drag.id === project.id) return { impact: drag.impact, feasibility: drag.feasibility };
      const o = override[project.id];
      if (o) return o;
      return {
        impact: project.priorityImpact ?? 3,
        feasibility: project.priorityFeasibility ?? 3,
      };
    },
    [drag, override]
  );

  const commit = React.useCallback(
    async (project: CouncilNodeView, impact: number, feasibility: number) => {
      const previous = override[project.id];
      setOverride((cur) => ({ ...cur, [project.id]: { impact, feasibility } }));
      setAnnounce(
        t("priority.moved", {
          code: project.code ?? "",
          title: bi(locale, project.titleEn, project.titleAr),
          impact,
          feasibility,
        })
      );
      const ok = await patchCouncil({
        kind: "node",
        id: project.id,
        priorityImpact: impact,
        priorityFeasibility: feasibility,
      });
      if (ok) {
        router.refresh();
      } else {
        setOverride((cur) => {
          const next = { ...cur };
          if (previous) next[project.id] = previous;
          else delete next[project.id];
          return next;
        });
        toast(tc("error"), "error");
      }
    },
    [override, router, t, tc, toast, locale]
  );

  function fromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const vx = ((clientX - rect.left) / rect.width) * PW;
    const vy = ((clientY - rect.top) / rect.height) * PH;
    return {
      feasibility: clamp(1 + ((vx - PPL) / (PW - PPL - PPR)) * 4, 1, 5),
      impact: clamp(1 + ((PH - PPB - vy) / (PH - PPT - PPB)) * 4, 1, 5),
    };
  }

  function onKeyDown(event: React.KeyboardEvent<SVGGElement>, project: CouncilNodeView) {
    if (!canEdit) return;
    const current = coordsOf(project);
    let impact = Math.round(current.impact);
    let feasibility = Math.round(current.feasibility);
    switch (event.key) {
      case "ArrowRight":
        feasibility = clamp(feasibility + 1, 1, 5);
        break;
      case "ArrowLeft":
        feasibility = clamp(feasibility - 1, 1, 5);
        break;
      case "ArrowUp":
        impact = clamp(impact + 1, 1, 5);
        break;
      case "ArrowDown":
        impact = clamp(impact - 1, 1, 5);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (impact === Math.round(current.impact) && feasibility === Math.round(current.feasibility)) {
      return;
    }
    void commit(project, impact, feasibility);
  }

  const hovered = hover ? projects.find((p) => p.id === hover) ?? null : null;

  return (
    <div>
      <p className="mb-3 text-xs text-ink-600">
        {canEdit ? t("priority.hintEditable") : t("priority.hint")}
      </p>
      <div className="relative" style={{ direction: "ltr" }} data-testid="priority-matrix">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PW} ${PH}`}
          className="h-auto w-full touch-none"
          role="group"
          aria-label={t("priority.aria")}
        >
          <rect
            x={PPL}
            y={PPT}
            width={PW - PPL - PPR}
            height={PH - PPT - PPB}
            fill="var(--color-mist-50)"
            stroke="var(--color-mist-300)"
          />
          <line
            x1={pfx(3)}
            y1={PPT}
            x2={pfx(3)}
            y2={PH - PPB}
            stroke="var(--color-mist-300)"
            strokeDasharray="4 4"
          />
          <line
            x1={PPL}
            y1={pfy(3)}
            x2={PW - PPR}
            y2={pfy(3)}
            stroke="var(--color-mist-300)"
            strokeDasharray="4 4"
          />
          <text x={PPL + 8} y={PPT + 16} fontSize={9} fill="var(--color-ink-400)">
            {t("priority.quadrant.planCarefully")}
          </text>
          <text
            x={PW - PPR - 8}
            y={PPT + 16}
            fontSize={9}
            fill="var(--color-ink-400)"
            textAnchor="end"
          >
            {t("priority.quadrant.doFirst")}
          </text>
          <text x={PPL + 8} y={PH - PPB - 8} fontSize={9} fill="var(--color-ink-400)">
            {t("priority.quadrant.reconsider")}
          </text>
          <text
            x={PW - PPR - 8}
            y={PH - PPB - 8}
            fontSize={9}
            fill="var(--color-ink-400)"
            textAnchor="end"
          >
            {t("priority.quadrant.quickWins")}
          </text>
          {[1, 2, 3, 4, 5].map((v) => (
            <text
              key={`px${v}`}
              x={pfx(v)}
              y={PH - PPB + 16}
              fontSize={10}
              textAnchor="middle"
              fill="var(--color-ink-600)"
            >
              {v}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((v) => (
            <text
              key={`py${v}`}
              x={PPL - 10}
              y={pfy(v) + 3}
              fontSize={10}
              textAnchor="end"
              fill="var(--color-ink-600)"
            >
              {v}
            </text>
          ))}
          <text
            x={PPL + (PW - PPL - PPR) / 2}
            y={PH - 8}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink-900)"
          >
            {t("priority.feasibilityAxis")}
          </text>
          <text
            x={14}
            y={PPT + (PH - PPT - PPB) / 2}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink-900)"
            transform={`rotate(-90 14 ${PPT + (PH - PPT - PPB) / 2})`}
          >
            {t("priority.impactAxis")}
          </text>

          {placed.map((project) => {
            const c = coordsOf(project);
            const token = STATUS_TOKEN[project.status] ?? "var(--color-ink-400)";
            const r = 7 + Math.sqrt((project.budgetQar ?? 0) / maxBudget) * 9;
            const isDragging = drag?.id === project.id;
            return (
              <g
                key={project.id}
                data-testid="priority-dot"
                tabIndex={canEdit ? 0 : -1}
                role={canEdit ? "button" : "img"}
                aria-label={t("priority.dotAria", {
                  code: project.code ?? "",
                  title: bi(locale, project.titleEn, project.titleAr),
                  impact: Math.round(c.impact),
                  feasibility: Math.round(c.feasibility),
                  status: t(`implementation.status.${project.status}`),
                })}
                className={cn(canEdit ? "cursor-grab" : "cursor-pointer", isDragging && "cursor-grabbing")}
                onKeyDown={(e) => onKeyDown(e, project)}
                onMouseEnter={() => setHover(project.id)}
                onMouseLeave={() => setHover((cur) => (cur === project.id ? null : cur))}
                onFocus={() => setHover(project.id)}
                onBlur={() => setHover((cur) => (cur === project.id ? null : cur))}
                onPointerDown={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ id: project.id, impact: c.impact, feasibility: c.feasibility });
                }}
                onPointerMove={(e) => {
                  if (!canEdit || drag?.id !== project.id) return;
                  const next = fromClient(e.clientX, e.clientY);
                  if (next) setDrag({ id: project.id, ...next });
                }}
                onPointerUp={(e) => {
                  if (!canEdit || drag?.id !== project.id) return;
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                  const impact = clamp(Math.round(drag.impact), 1, 5);
                  const feasibility = clamp(Math.round(drag.feasibility), 1, 5);
                  setDrag(null);
                  if (
                    impact !== project.priorityImpact ||
                    feasibility !== project.priorityFeasibility
                  ) {
                    void commit(project, impact, feasibility);
                  }
                }}
              >
                <circle
                  cx={pfx(c.feasibility)}
                  cy={pfy(c.impact)}
                  r={r}
                  fill={`color-mix(in srgb, ${token} 26%, transparent)`}
                  stroke={token}
                  strokeWidth={hover === project.id || isDragging ? 3 : 1.5}
                />
                <text
                  x={pfx(c.feasibility) + r + 4}
                  y={pfy(c.impact) + 3}
                  fontSize={9}
                  fill="var(--color-ink-900)"
                  fontWeight={600}
                >
                  {project.code ?? ""}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-mist-300 bg-white p-3 shadow-[var(--shadow-pop)]"
            style={{
              left: `${(pfx(coordsOf(hovered).feasibility) / PW) * 100}%`,
              top: `${(pfy(coordsOf(hovered).impact) / PH) * 100}%`,
              transform: "translate(-50%, -115%)",
            }}
          >
            <p className="text-[11px] font-semibold text-navy-700 tnum">{hovered.code ?? ""}</p>
            <p className="text-sm font-semibold leading-snug text-ink-900">
              {bi(locale, hovered.titleEn, hovered.titleAr)}
            </p>
            <p className="mt-1 text-[11px] text-ink-600 tnum">
              {t("priority.coords", {
                impact: Math.round(coordsOf(hovered).impact),
                feasibility: Math.round(coordsOf(hovered).feasibility),
              })}
            </p>
            {hovered.budgetQar != null ? (
              <p className="text-[11px] text-ink-600 tnum">
                {t("priority.budget", {
                  amount: formatNumber(hovered.budgetQar, locale, { compact: true }),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-600">
        {STATUS_KEYS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${STATUS_TOKEN[s]} 26%, transparent)`,
                border: `1px solid ${STATUS_TOKEN[s]}`,
              }}
              aria-hidden
            />
            {t(`implementation.status.${s}`)}
          </span>
        ))}
        <span>{t("priority.sizeHint")}</span>
      </div>

      {unplaced.length ? (
        <p className="mt-3 text-xs text-ink-400">
          {t("priority.unplaced", {
            count: unplaced.length,
            codes: unplaced.map((p) => p.code ?? "").filter(Boolean).join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the six sections                                                     */
/* ------------------------------------------------------------------ */

export function ReferenceSections({
  data,
  canEdit,
}: {
  data: CouncilPageData;
  canEdit: boolean;
}) {
  const t = useTranslations("council");
  const locale = useLocale();

  const projectCount = data.nodes.filter((n) => n.level === "project").length;
  const openRisks = data.risks.filter((r) => r.status !== "closed").length;

  return (
    <div className="space-y-3" data-testid="reference-sections">
      <Section
        testId="ref-situation"
        icon={<Lightbulb />}
        title={t("situation.title")}
        hint={t("situation.hint")}
        badge={formatNumber(data.analysis.swot.length, locale, { decimals: 0 })}
      >
        <SituationAnalysis data={data} />
      </Section>

      <Section
        testId="ref-implementation"
        icon={<ListOrdered />}
        title={t("implementation.title")}
        hint={t("implementation.hint")}
        badge={formatNumber(projectCount, locale, { decimals: 0 })}
      >
        <ImplementationPlan data={data} />
      </Section>

      <Section
        testId="ref-me"
        icon={<Gauge />}
        title={t("me.title")}
        hint={t("me.hint")}
        badge={formatNumber(data.indicators.length, locale, { decimals: 0 })}
      >
        <MonitoringFramework data={data} />
      </Section>

      <Section
        testId="ref-risks"
        icon={<ShieldAlert />}
        title={t("risks.title")}
        hint={t("risks.hint")}
        badge={formatNumber(openRisks, locale, { decimals: 0 })}
      >
        <RiskRegister data={data} canEdit={canEdit} />
      </Section>

      <Section
        testId="ref-governance"
        icon={<Landmark />}
        title={t("governance.title")}
        hint={t("governance.hint")}
        badge={formatNumber(data.governance.length, locale, { decimals: 0 })}
      >
        {data.governance.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.governance.map((body) => (
              <article key={body.id} className="rounded-xl border border-mist-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-ink-900">
                    {bi(locale, body.bodyNameEn, body.bodyNameAr)}
                  </h4>
                  {body.cadence ? (
                    <Chip tone="teal">
                      <CalendarDays className="size-3" aria-hidden />
                      {KNOWN_CADENCES.has(body.cadence)
                        ? t(`governance.cadence.${body.cadence}`)
                        : body.cadence}
                    </Chip>
                  ) : null}
                </div>
                {body.roleEn || body.roleAr ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    {bi(locale, body.roleEn, body.roleAr)}
                  </p>
                ) : null}
                {body.members.length ? (
                  <>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
                      <Users className="size-3.5" aria-hidden />
                      {t("governance.members")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {body.members.map((member, i) => (
                        <Chip key={i} tone="mist">
                          {bi(locale, member.en, member.ar)}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-ink-400">{t("governance.noMembers")}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{t("governance.empty")}</p>
        )}
      </Section>

      <Section
        testId="ref-priority"
        icon={<Target />}
        title={t("priority.title")}
        hint={t("priority.hint")}
        badge={formatNumber(projectCount, locale, { decimals: 0 })}
      >
        <PriorityMatrix data={data} canEdit={canEdit} />
      </Section>
    </div>
  );
}
