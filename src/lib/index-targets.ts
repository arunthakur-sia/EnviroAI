// CR08 4.1: how a target value on an index reads. A target on a ranked index
// is a rank ("top 15") unless the index is forecast on its score; national
// indicators (target_gap) and score-only series are scores. Shared by the
// board service and the index page so a card and its page never disagree.
// Pure: safe to import from client components.

export function targetIsRank(
  forecastMode: string | null | undefined,
  rank: number | null,
  score: number | null
): boolean {
  if (forecastMode === "rank") return true;
  if (forecastMode === "score" || forecastMode === "target_gap") return false;
  if (rank != null) return true;
  return score == null;
}

/** Signed distance still to go: positive = short of the target. */
export function targetGap(
  targetValue: number,
  current: number | null,
  rankBased: boolean,
  higherIsBetter: boolean
): number | null {
  if (current == null) return null;
  const gap = rankBased
    ? current - targetValue
    : higherIsBetter
      ? targetValue - current
      : current - targetValue;
  return Math.round(gap * 100) / 100;
}
