// Colour keys are stored in the database (avatar_color, colour_token,
// cover_style). Rows written before the Sia palette carry the old key names;
// this maps them onto the current ones so old data still renders.
const LEGACY: Record<string, string> = {
  maroon: "navy",
  gulf: "teal",
  gold: "aqua",
  sand: "mist",
  "maroon-weave": "navy",
  "gulf-weave": "teal",
};

export function colourKey(key: string | null | undefined, fallback = "navy"): string {
  if (!key) return fallback;
  return LEGACY[key] ?? key;
}
