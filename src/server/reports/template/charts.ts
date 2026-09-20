// CR08 5.5: SVG chart builders in the app's chart style (IndicatorChart.tsx):
// maroon primary, gulf comparison, gold dashed target, maroon dashed forecast,
// hairline solid gridlines, recessive axes, a legend for two or more series,
// one direct end label on the primary series. The plot stays left-to-right in
// both languages (time runs the same way); labels take the language's face.
// The docx renders the title, note and source natively around the image.
import type { ChartSeries, ChartSpec, Lang } from "../spec";
import { C, PX, esc, hex, isAr } from "./theme";

export const CHART = { w: PX.textW, h: 340 } as const;

type Role = NonNullable<ChartSeries["role"]>;

const SANS = (lang: Lang) => (isAr(lang) ? "'IBM Plex Sans Arabic', 'Inter', sans-serif" : "'Inter', 'Segoe UI', sans-serif");

const EXTRA = [C.maroon300, C.gulf400, C.ink400, C.gold];

function roleOf(s: ChartSeries, i: number): Role {
  if (s.role) return s.role;
  return i === 0 ? "primary" : i === 1 ? "comparison" : "primary";
}

function colourOf(role: Role, i: number, stacked: boolean): string {
  if (stacked) return [C.maroon, C.gulf, C.gold, C.maroon300, C.gulf400, C.ink400][i % 6];
  switch (role) {
    case "comparison":
      return C.gulf;
    case "target":
      return C.gold;
    case "forecast":
      return C.maroon;
    default:
      return i <= 1 ? C.maroon : EXTRA[(i - 2) % EXTRA.length];
  }
}

export function fmtNum(v: number): string {
  const a = Math.abs(v);
  const trim = (s: string) => s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  if (a >= 1e9) return `${trim((v / 1e9).toFixed(1))}B`;
  if (a >= 1e6) return `${trim((v / 1e6).toFixed(1))}M`;
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: a < 10 ? 2 : 1 });
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    min = min === 0 ? 0 : min - Math.abs(min) * 0.1;
    max = max === 0 ? 1 : max + Math.abs(max) * 0.1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Rounded-top bar path (square at the baseline). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
}

export function chartSvg(spec: ChartSpec, lang: Lang, width = CHART.w, height = CHART.h): string {
  const ar = isAr(lang);
  const font = SANS(lang);
  const series = spec.series.filter((s) => s.points.length);
  const roles = series.map(roleOf);
  const stacked = spec.type === "stacked";
  const barLike = spec.type === "bar" || stacked;
  const colours = series.map((s, i) => colourOf(roles[i], i, stacked));

  // categories in first-appearance order
  const cats: string[] = [];
  for (const s of series) for (const p of s.points) if (!cats.includes(p.x)) cats.push(p.x);
  const n = Math.max(1, cats.length);

  // which series form the plot versus the overlays
  const isOverlay = (r: Role) => r === "target" || r === "forecast";
  const plotIdx = series.map((_, i) => i).filter((i) => !isOverlay(roles[i]));

  // y domain
  let lo = Infinity;
  let hi = -Infinity;
  if (stacked) {
    for (const c of cats) {
      let pos = 0;
      let neg = 0;
      for (const i of plotIdx) {
        const y = series[i].points.find((p) => p.x === c)?.y;
        if (y == null) continue;
        if (y >= 0) pos += y;
        else neg += y;
      }
      lo = Math.min(lo, neg);
      hi = Math.max(hi, pos);
    }
    for (const i of series.map((_, k) => k).filter((k) => isOverlay(roles[k]))) {
      for (const p of series[i].points) {
        if (p.y == null) continue;
        lo = Math.min(lo, p.y);
        hi = Math.max(hi, p.y);
      }
    }
  } else {
    for (const s of series) {
      for (const p of s.points) {
        if (p.y == null) continue;
        lo = Math.min(lo, p.y);
        hi = Math.max(hi, p.y);
      }
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  if (barLike || spec.type === "area") {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (spec.yMin != null) lo = spec.yMin;
  if (spec.yMax != null) hi = spec.yMax;
  if (spec.type === "line" && spec.yMin == null && spec.yMax == null && lo !== hi) {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  const ticks = niceTicks(lo, hi, 5);
  const yLo = spec.yMin ?? ticks[0];
  const yHi = spec.yMax ?? ticks[ticks.length - 1];

  // layout
  const legend = series.length >= 2;
  const top = legend ? 40 : spec.unit ? 30 : 16;
  const right = 68;
  const bottom = 30;
  const left = 8 + Math.max(...ticks.map((t) => fmtNum(t).length)) * 6.4 + 8;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const sy = (v: number) => top + plotH - ((v - yLo) / (yHi - yLo || 1)) * plotH;
  const band = plotW / n;
  const sx = (i: number) => left + band * (i + 0.5);
  const y0 = sy(Math.max(yLo, Math.min(0, yHi)));

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${font}">`);
  out.push(`<rect width="${width}" height="${height}" fill="#FFFFFF"/>`);

  // gridlines and y labels
  for (const t of ticks) {
    if (t < yLo - 1e-9 || t > yHi + 1e-9) continue;
    const y = sy(t);
    out.push(`<line x1="${left}" x2="${left + plotW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${hex(C.sandLine)}" stroke-width="1"/>`);
    out.push(`<text x="${left - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${hex(C.ink400)}">${fmtNum(t)}</text>`);
  }
  // baseline
  out.push(`<line x1="${left}" x2="${left + plotW}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="${hex(C.ink200)}" stroke-width="1"/>`);
  // x labels, thinned to at most eight
  const step = Math.ceil(n / 8);
  cats.forEach((c, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    if (i === n - 1 && (n - 1) % step !== 0 && n > 8 && (n - 1) % step < step / 2) return;
    out.push(`<text x="${sx(i).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="${hex(C.ink400)}">${esc(c)}</text>`);
  });

  const pointAt = (s: ChartSeries, c: string) => s.points.find((p) => p.x === c)?.y ?? null;

  // marks
  if (barLike) {
    if (stacked) {
      cats.forEach((c, ci) => {
        let posTop = 0;
        let negTop = 0;
        const w = Math.min(28, band * 0.6);
        const x = sx(ci) - w / 2;
        plotIdx.forEach((i, k) => {
          const v = pointAt(series[i], c);
          if (v == null || v === 0) return;
          const from = v > 0 ? posTop : negTop;
          const to = from + v;
          if (v > 0) posTop = to;
          else negTop = to;
          const yA = sy(Math.max(from, to));
          const yB = sy(Math.min(from, to));
          const gap = k === 0 ? 0 : 2;
          const hh = Math.max(0, yB - yA - gap);
          if (v > 0 && k === plotIdx.length - 1) out.push(`<path d="${barPath(x, yA, w, hh, 3)}" fill="${hex(colours[i])}"/>`);
          else out.push(`<rect x="${x}" y="${yA}" width="${w}" height="${hh}" fill="${hex(colours[i])}"/>`);
        });
      });
    } else {
      const k = Math.max(1, plotIdx.length);
      const groupW = Math.min(band * 0.72, 24 * k + 2 * (k - 1));
      const bw = (groupW - 2 * (k - 1)) / k;
      cats.forEach((c, ci) => {
        const gx = sx(ci) - groupW / 2;
        plotIdx.forEach((i, j) => {
          const v = pointAt(series[i], c);
          if (v == null) return;
          const x = gx + j * (bw + 2);
          const yA = sy(Math.max(0, v));
          const yB = sy(Math.min(0, v));
          out.push(`<path d="${barPath(x, yA, bw, yB - yA, 3)}" fill="${hex(colours[i])}"/>`);
        });
      });
      // value on the cap of the last primary bar only
      const pi = plotIdx[0];
      if (pi != null) {
        const lastIdx = [...cats.keys()].reverse().find((ci) => pointAt(series[pi], cats[ci]) != null);
        if (lastIdx != null) {
          const v = pointAt(series[pi], cats[lastIdx]) as number;
          const x = sx(lastIdx) - groupW / 2 + bw / 2;
          out.push(`<text x="${x.toFixed(1)}" y="${(sy(Math.max(0, v)) - 6).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${hex(C.ink)}">${fmtNum(v)}</text>`);
        }
      }
    }
  } else {
    plotIdx.forEach((i) => {
      const s = series[i];
      const col = hex(colours[i]);
      const segs: string[] = [];
      let d = "";
      let open = false;
      cats.forEach((c, ci) => {
        const v = pointAt(s, c);
        if (v == null) {
          if (open) segs.push(d);
          d = "";
          open = false;
          return;
        }
        d += `${open ? "L" : "M"}${sx(ci).toFixed(1)} ${sy(v).toFixed(1)} `;
        open = true;
      });
      if (open) segs.push(d);
      if (spec.type === "area" && roles[i] === "primary") {
        for (const seg of segs) {
          const pts = seg.trim().split(/[ML]/).filter(Boolean).map((p) => p.trim());
          if (pts.length < 2) continue;
          const first = pts[0].split(" ")[0];
          const last = pts[pts.length - 1].split(" ")[0];
          out.push(`<path d="${seg} L${last} ${y0.toFixed(1)} L${first} ${y0.toFixed(1)} Z" fill="${col}" opacity="0.10"/>`);
        }
      }
      const width2 = roles[i] === "comparison" ? 1.5 : 2;
      for (const seg of segs) out.push(`<path d="${seg}" fill="none" stroke="${col}" stroke-width="${width2}" stroke-linejoin="round" stroke-linecap="round"/>`);
    });
  }

  // overlays: target (gold dashed) and forecast (maroon dashed)
  series.forEach((s, i) => {
    if (!isOverlay(roles[i])) return;
    const col = hex(colours[i]);
    let d = "";
    let open = false;
    cats.forEach((c, ci) => {
      const v = pointAt(s, c);
      if (v == null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${sx(ci).toFixed(1)} ${sy(v).toFixed(1)} `;
      open = true;
    });
    if (!d) return;
    const dash = roles[i] === "target" ? "6 4" : "5 4";
    out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${roles[i] === "target" ? 1.5 : 2}" stroke-dasharray="${dash}" stroke-linejoin="round" stroke-linecap="round"/>`);
  });

  // direct end labels: the primary series, plus the target value
  const labelled: { y: number }[] = [];
  const hasForecast = roles.includes("forecast");
  const endLabel = (i: number, text: string, weight: number, colour: string, dot: boolean) => {
    const s = series[i];
    const lastIdx = [...cats.keys()].reverse().find((ci) => pointAt(s, cats[ci]) != null);
    if (lastIdx == null || barLike) return;
    const v = pointAt(s, cats[lastIdx]) as number;
    // above the point when a dashed forecast continues through the label's place
    let y = sy(v) - (dot && hasForecast ? 11 : 0);
    for (const l of labelled) if (Math.abs(l.y - y) < 12) y = l.y + (y >= l.y ? 12 : -12);
    labelled.push({ y });
    if (dot) out.push(`<circle cx="${sx(lastIdx).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="4" fill="${hex(colours[i])}" stroke="#FFFFFF" stroke-width="2"/>`);
    out.push(`<text x="${(sx(lastIdx) + 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="11" font-weight="${weight}" fill="${colour}">${esc(text)}</text>`);
  };
  const primary = plotIdx[0];
  if (primary != null) {
    const s = series[primary];
    const lastIdx = [...cats.keys()].reverse().find((ci) => pointAt(s, cats[ci]) != null);
    if (lastIdx != null) endLabel(primary, fmtNum(pointAt(s, cats[lastIdx]) as number), 600, hex(C.ink), true);
  }
  series.forEach((s, i) => {
    if (roles[i] !== "target") return;
    const lastIdx = [...cats.keys()].reverse().find((ci) => pointAt(s, cats[ci]) != null);
    if (lastIdx != null) endLabel(i, fmtNum(pointAt(s, cats[lastIdx]) as number), 500, hex(C.ink600), false);
  });

  // legend
  if (legend) {
    const items = series.map((s, i) => ({
      name: ar ? s.name.ar || s.name.en : s.name.en || s.name.ar,
      colour: hex(colours[i]),
      dashed: isOverlay(roles[i]),
      bar: barLike && !isOverlay(roles[i]),
    }));
    const widths = items.map((it) => it.name.length * (ar ? 6.4 : 6) + 32);
    let x = ar ? width - 4 : left;
    items.forEach((it, i) => {
      const w = widths[i];
      const x0 = ar ? x - w : x;
      const sw = x0;
      if (it.bar) out.push(`<rect x="${sw}" y="9" width="10" height="10" rx="2" fill="${it.colour}"/>`);
      else out.push(`<line x1="${sw}" x2="${sw + 16}" y1="14" y2="14" stroke="${it.colour}" stroke-width="2" ${it.dashed ? 'stroke-dasharray="4 3"' : ""}/>`);
      out.push(`<text x="${sw + (it.bar ? 16 : 22)}" y="17.5" font-size="11" fill="${hex(C.ink600)}">${esc(it.name)}</text>`);
      x = ar ? x0 - 14 : x + w + 14;
    });
  }
  // unit at the top of the y axis
  if (spec.unit && !legend) {
    out.push(`<text x="${left}" y="13" font-size="10" fill="${hex(C.ink400)}">${esc(spec.unit)}</text>`);
  }
  out.push("</svg>");
  return out.join("\n");
}
