// CR07 2.4: the arithmetic of the Programme Strategy, with no database import,
// so the server service and the client views share one implementation instead
// of keeping two copies in step.

export type Cadence = "monthly" | "quarterly" | "yearly";
export type Rag = "on_target" | "at_risk" | "behind" | "no_data";
export type IndicatorPoint = { period: string; target: number | null; actual: number | null };

/** Direction-aware comparison of an actual against its target. */
export function ragOf(
  actual: number | null | undefined,
  target: number | null | undefined,
  direction: string
): { rag: Rag; attainment: number | null } {
  if (actual == null || target == null) return { rag: "no_data", attainment: null };
  const down = direction === "down_good";
  // guard the zero target: fall back to an absolute comparison
  let ratio: number;
  if (down) {
    ratio = actual <= 0 ? 1 : target <= 0 ? (actual <= 0 ? 1 : 0) : target / actual;
  } else {
    ratio = target === 0 ? (actual >= 0 ? 1 : 0) : actual / target;
  }
  if (!Number.isFinite(ratio)) return { rag: "no_data", attainment: null };
  const attainment = Math.max(0, ratio);
  const rag: Rag = attainment >= 0.95 ? "on_target" : attainment >= 0.8 ? "at_risk" : "behind";
  return { rag, attainment };
}

/** The period key an indicator of this cadence reports for a given date. */
export function periodFor(cadence: Cadence, date = new Date()): string {
  const y = date.getUTCFullYear();
  if (cadence === "yearly") return String(y);
  if (cadence === "quarterly") return `${y}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return `${y}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Whether a period key belongs to the monthly, quarterly or yearly cadence. */
export function periodCadence(period: string): Cadence {
  if (/^\d{4}$/.test(period)) return "yearly";
  if (/^\d{4}-Q[1-4]$/.test(period)) return "quarterly";
  return "monthly";
}

/** Periods of one cadence within a window, oldest first. */
export function periodRange(cadence: Cadence, from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  if (cadence === "yearly") {
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) out.push(String(y));
    return out;
  }
  if (cadence === "quarterly") {
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
      for (let q = 1; q <= 4; q++) out.push(`${y}-Q${q}`);
    }
    return out;
  }
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    for (let m = 1; m <= 12; m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/** The newest period that carries an actual. */
export function latestReported(series: IndicatorPoint[]): IndicatorPoint | null {
  const withActual = series.filter((p) => p.actual != null);
  return withActual.length ? withActual[withActual.length - 1] : null;
}
