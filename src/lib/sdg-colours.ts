// CR08 4: fixed constants for the Indices board. The seventeen official SDG
// colours (the UN palette, used only as a small chip beside a goal card) and
// the group colour tokens mapped onto the theme utilities. Nothing else in the
// module carries a raw colour; the SDG hexes are the one sanctioned exception
// because they are the published identity of each goal.

export type SdgGoal = {
  n: number;
  colour: string;
  shortEn: string;
  shortAr: string;
};

export const SDG_GOALS: SdgGoal[] = [
  { n: 1, colour: "#E5243B", shortEn: "No poverty", shortAr: "القضاء على الفقر" },
  { n: 2, colour: "#DDA63A", shortEn: "Zero hunger", shortAr: "القضاء التام على الجوع" },
  { n: 3, colour: "#4C9F38", shortEn: "Good health", shortAr: "الصحة الجيدة والرفاه" },
  { n: 4, colour: "#C5192D", shortEn: "Quality education", shortAr: "التعليم الجيد" },
  { n: 5, colour: "#FF3A21", shortEn: "Gender equality", shortAr: "المساواة بين الجنسين" },
  { n: 6, colour: "#26BDE2", shortEn: "Clean water", shortAr: "المياه النظيفة والنظافة الصحية" },
  { n: 7, colour: "#FCC30B", shortEn: "Clean energy", shortAr: "طاقة نظيفة وبأسعار معقولة" },
  { n: 8, colour: "#A21942", shortEn: "Decent work", shortAr: "العمل اللائق ونمو الاقتصاد" },
  { n: 9, colour: "#FD6925", shortEn: "Industry and innovation", shortAr: "الصناعة والابتكار والهياكل الأساسية" },
  { n: 10, colour: "#DD1367", shortEn: "Reduced inequalities", shortAr: "الحد من أوجه عدم المساواة" },
  { n: 11, colour: "#FD9D24", shortEn: "Sustainable cities", shortAr: "مدن ومجتمعات محلية مستدامة" },
  { n: 12, colour: "#BF8B2E", shortEn: "Responsible consumption", shortAr: "الاستهلاك والإنتاج المسؤولان" },
  { n: 13, colour: "#3F7E44", shortEn: "Climate action", shortAr: "العمل المناخي" },
  { n: 14, colour: "#0A97D9", shortEn: "Life below water", shortAr: "الحياة تحت الماء" },
  { n: 15, colour: "#56C02B", shortEn: "Life on land", shortAr: "الحياة في البر" },
  { n: 16, colour: "#00689D", shortEn: "Peace and justice", shortAr: "السلام والعدل والمؤسسات القوية" },
  { n: 17, colour: "#19486A", shortEn: "Partnerships", shortAr: "عقد الشراكات لتحقيق الأهداف" },
];

export const SDG_COLOURS: Record<number, string> = Object.fromEntries(
  SDG_GOALS.map((g) => [g.n, g.colour])
);

export function sdgGoal(n: number | null | undefined): SdgGoal | null {
  if (n == null) return null;
  return SDG_GOALS.find((g) => g.n === n) ?? null;
}

/** Dark text reads on the light goal chips (6, 7, 11, 15), white on the rest. */
export function sdgTextOn(n: number): string {
  return [6, 7, 11, 15].includes(n) ? "#1f2328" : "#ffffff";
}

/* ------------------------------------------------------------------ */
/* group colour tokens                                                  */
/* ------------------------------------------------------------------ */

export const GROUP_COLOUR_TOKENS = ["maroon", "gulf", "gold", "ink", "ok", "info"] as const;
export type GroupColourToken = (typeof GROUP_COLOUR_TOKENS)[number];

export type GroupTokenStyle = {
  /** the thin bar over a section and the swatch in Settings */
  bar: string;
  /** eyebrow text; every pair reads AA on white (gold uses the warn ink) */
  text: string;
  /** the Chip tone that belongs to the token */
  chip: "maroon" | "gulf" | "gold" | "sand" | "ok" | "info";
  /** a faint wash for the active switcher pill and drop targets */
  soft: string;
  /** ring for the active switcher pill */
  ring: string;
};

export const GROUP_TOKEN_STYLES: Record<GroupColourToken, GroupTokenStyle> = {
  maroon: {
    bar: "bg-maroon-700",
    text: "text-maroon-700",
    chip: "maroon",
    soft: "bg-maroon-50",
    ring: "ring-maroon-300",
  },
  gulf: {
    bar: "bg-gulf-600",
    text: "text-gulf-600",
    chip: "gulf",
    soft: "bg-gulf-100/60",
    ring: "ring-gulf-400",
  },
  gold: {
    bar: "bg-gold-500",
    text: "text-warn",
    chip: "gold",
    soft: "bg-gold-100/70",
    ring: "ring-gold-300",
  },
  ink: {
    bar: "bg-ink-600",
    text: "text-ink-600",
    chip: "sand",
    soft: "bg-sand-100",
    ring: "ring-ink-200",
  },
  ok: {
    bar: "bg-ok",
    text: "text-ok",
    chip: "ok",
    soft: "bg-ok-light",
    ring: "ring-ok/40",
  },
  info: {
    bar: "bg-info",
    text: "text-info",
    chip: "info",
    soft: "bg-info-light",
    ring: "ring-info/40",
  },
};

export function groupStyle(token: string | null | undefined): GroupTokenStyle {
  return GROUP_TOKEN_STYLES[(token ?? "maroon") as GroupColourToken] ?? GROUP_TOKEN_STYLES.maroon;
}
