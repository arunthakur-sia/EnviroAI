"use client";
// Hand-tuned Recharts: thin maroon line, gulf comparison, dashed gold target,
// direct end labels, draw-in on first view only.
import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useLocale } from "next-intl";
import { formatNumber, formatPeriod } from "@/lib/format";

export type SeriesPoint = { period: string; value: number | null; compare?: number | null };

export function IndicatorChart({
  data,
  unit,
  target,
  decimals = 1,
  height = 260,
  kind = "line",
  compareLabel,
}: {
  data: SeriesPoint[];
  unit?: string | null;
  target?: number | null;
  decimals?: number;
  height?: number;
  kind?: "line" | "bar";
  compareLabel?: string;
}) {
  const locale = useLocale();
  const [animate, setAnimate] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const fmt = (v: number) => {
    const compact = Math.abs(v) >= 100000;
    // compact ticks need finer decimals or a 3.0M-3.15M range all reads "3M"
    return formatNumber(v, locale, { decimals: compact ? 2 : decimals, compact });
  };
  const last = data.filter((d) => d.value !== null).at(-1);

  const Chart = kind === "bar" ? BarChart : LineChart;

  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 12, right: 52, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="period"
            tickFormatter={(p) => formatPeriod(String(p), locale)}
            tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-sand-300)" }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(v: number) => [`${fmt(v)}${unit ? ` ${unit}` : ""}`, ""]}
            labelFormatter={(p) => formatPeriod(String(p), locale)}
            separator=""
            contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "var(--color-sand-300)" }}
          />
          {target !== null && target !== undefined ? (
            <ReferenceLine
              y={target}
              stroke="var(--color-gold-500)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: fmt(target),
                position: "right",
                fill: "var(--color-gold-500)",
                fontSize: 11,
              }}
            />
          ) : null}
          {/* Series must be DIRECT children: recharts does not unwrap fragments. */}
          {kind === "bar" ? (
            <Bar
              dataKey="value"
              fill="var(--color-maroon-700)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={animate}
            />
          ) : null}
          {kind !== "bar" &&
          data.some((d) => d.compare !== undefined && d.compare !== null) ? (
            <Line
              type="monotone"
              dataKey="compare"
              stroke="var(--color-gulf-600)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={animate}
              name={compareLabel}
            />
          ) : null}
          {kind !== "bar" ? (
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-maroon-700)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, fill: "var(--color-maroon-700)" }}
              isAnimationActive={animate}
              label={(props: any) => {
                // direct end label on the last point
                if (!last || props.index !== data.length - 1 || props.value === null) return <g />;
                return (
                  <text
                    x={props.x + 6}
                    y={props.y + 4}
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--color-maroon-900)"
                    className="tnum"
                  >
                    {fmt(props.value)}
                  </text>
                );
              }}
            />
          ) : null}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  data,
  width = 96,
  height = 30,
  stroke = "var(--color-maroon-500)",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (data.length < 2) return <span style={{ width, height }} className="inline-block" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / range) * (height - 6)}`
    )
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden style={{ direction: "ltr" }} className="shrink-0">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
