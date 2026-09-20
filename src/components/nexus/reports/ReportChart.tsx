"use client";
// CR08 5: a ChartSpec drawn with Recharts in the app's chart style: maroon
// primary, gulf comparison, dashed gold target, dashed maroon forecast. One
// y axis, thin marks, recessive grid, a hover tooltip, a legend for two or
// more series, text in ink tokens only. The plot stays left to right in
// Arabic because time reads the same way (as the Statistics Hub does).
import * as React from "react";
import { useLocale } from "next-intl";
import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec, Lang } from "@/server/reports/spec";
import { formatNumber, formatPeriod } from "@/lib/format";
import { pick } from "./shared";

type Role = "primary" | "comparison" | "target" | "forecast";

const ROLE_COLOUR: Record<Role, string> = {
  primary: "var(--color-maroon-700)",
  comparison: "var(--color-gulf-600)",
  target: "var(--color-gold-500)",
  forecast: "var(--color-maroon-700)",
};
const ROLE_DASH: Partial<Record<Role, string>> = { target: "6 4", forecast: "4 4" };
const ROLE_WIDTH: Record<Role, number> = { primary: 2, comparison: 1.5, target: 1.5, forecast: 1.5 };
/** Series without a role take a fixed order of hues, never a cycled one. */
const FALLBACK_ROLES: Role[] = ["primary", "comparison", "target", "forecast"];

export function ReportChart({
  chart,
  lang,
  height = 240,
}: {
  chart: ChartSpec;
  lang: Lang;
  height?: number;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [animate, setAnimate] = React.useState(!reduced);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const series = chart.series.map((s, i) => ({
    ...s,
    key: `s${i}`,
    role: (s.role ?? FALLBACK_ROLES[Math.min(i, FALLBACK_ROLES.length - 1)]) as Role,
    label: pick(lang, s.name),
  }));
  const xs: string[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!seen.has(p.x)) {
        seen.add(p.x);
        xs.push(p.x);
      }
    }
  }
  xs.sort();
  const data = xs.map((x) => {
    const row: Record<string, string | number | null> = { x };
    for (const s of series) row[s.key] = s.points.find((p) => p.x === x)?.y ?? null;
    return row;
  });

  const fmt = (v: number) =>
    formatNumber(v, locale, {
      decimals: Math.abs(v) >= 1000 ? 0 : 1,
      compact: Math.abs(v) >= 100000,
    });
  const isBar = chart.type === "bar" || chart.type === "stacked";
  const isArea = chart.type === "area";
  const domain: [number | "auto", number | "auto"] = [chart.yMin ?? "auto", chart.yMax ?? "auto"];
  const tickProps = { fontSize: 11, fill: "var(--color-ink-400)" };
  const axisProps = {
    xAxis: (
      <XAxis
        dataKey="x"
        tickFormatter={(p) => formatPeriod(String(p), locale)}
        tick={tickProps}
        tickLine={false}
        axisLine={{ stroke: "var(--color-sand-300)" }}
        minTickGap={24}
      />
    ),
    yAxis: (
      <YAxis
        tickFormatter={fmt}
        tick={tickProps}
        tickLine={false}
        axisLine={false}
        width={48}
        domain={domain}
      />
    ),
    grid: <CartesianGrid vertical={false} stroke="var(--color-sand-200)" />,
    tooltip: (
      <Tooltip
        formatter={(v: any, name: any) => [`${fmt(Number(v))}${chart.unit ? ` ${chart.unit}` : ""}`, String(name)]}
        labelFormatter={(p) => formatPeriod(String(p), locale)}
        contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "var(--color-sand-300)" }}
        cursor={isBar ? { fill: "var(--color-sand-100)" } : { stroke: "var(--color-sand-300)" }}
      />
    ),
  };
  const margin = { top: 12, right: 16, bottom: 4, left: 4 };

  return (
    <div data-testid="report-chart">
      <div dir="ltr" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {isBar ? (
            <BarChart data={data} margin={margin} barCategoryGap="22%" barGap={2}>
              {axisProps.grid}
              {axisProps.xAxis}
              {axisProps.yAxis}
              {axisProps.tooltip}
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={ROLE_COLOUR[s.role]}
                  radius={chart.type === "stacked" ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                  stackId={chart.type === "stacked" ? "stack" : undefined}
                  maxBarSize={36}
                  isAnimationActive={animate}
                />
              ))}
            </BarChart>
          ) : isArea ? (
            <AreaChart data={data} margin={margin}>
              {axisProps.grid}
              {axisProps.xAxis}
              {axisProps.yAxis}
              {axisProps.tooltip}
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={ROLE_COLOUR[s.role]}
                  strokeWidth={ROLE_WIDTH[s.role]}
                  strokeDasharray={ROLE_DASH[s.role]}
                  fill={ROLE_COLOUR[s.role]}
                  fillOpacity={s.role === "primary" ? 0.12 : 0.06}
                  dot={false}
                  connectNulls
                  isAnimationActive={animate}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={margin}>
              {axisProps.grid}
              {axisProps.xAxis}
              {axisProps.yAxis}
              {axisProps.tooltip}
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={ROLE_COLOUR[s.role]}
                  strokeWidth={ROLE_WIDTH[s.role]}
                  strokeDasharray={ROLE_DASH[s.role]}
                  dot={false}
                  activeDot={{ r: 3.5, fill: ROLE_COLOUR[s.role] }}
                  connectNulls
                  isAnimationActive={animate}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {series.length > 1 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-4 shrink-0 rounded-sm"
                style={
                  isBar
                    ? { background: ROLE_COLOUR[s.role] }
                    : {
                        borderTop: `${ROLE_WIDTH[s.role]}px ${ROLE_DASH[s.role] ? "dashed" : "solid"} ${ROLE_COLOUR[s.role]}`,
                        height: 0,
                      }
                }
              />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
