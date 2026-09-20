// Zod schemas for JSON columns stored as text.
import { z } from "zod";

export const KeyFact = z.object({
  text_en: z.string(),
  text_ar: z.string().optional().default(""),
  page: z.number().nullable().optional(),
});
export const KeyFacts = z.array(KeyFact);
export type KeyFact = z.infer<typeof KeyFact>;

export const Citation = z.object({
  n: z.number(),
  chunk_id: z.string().optional(),
  resource_type: z.string().default("document"),
  resource_id: z.string(),
  title: z.string().default(""),
  page: z.number().nullable().optional(),
  excerpt: z.string().optional().default(""),
  lang: z.string().optional(),
  edition: z.string().optional(),
});
export const Citations = z.array(Citation);
export type Citation = z.infer<typeof Citation>;

export const MODULES = [
  "vault",
  "strategy",
  "statistics",
  "experts",
  "ask",
  "lessons",
  "foresight",
  "settings",
  "analytics",
  "gamification",
  // CR07: the Council Strategy and the Organisation are their own modules so
  // editing rights can be granted without opening the whole strategy module
  "council",
  "organisation",
  // CR08: the Reports module, messaging, the process architecture and the
  // Operating Model carry their own editing rights
  "reports",
  "messaging",
  "processes",
  "operating_model",
] as const;

/* CR05 6.1: portals are the top-level modules in the rail, in rail order.
   CR08 2.2: the rail is grouped; RAIL_GROUPS below carries the order. */
export const PORTALS = [
  "home",
  // Strategy Hub
  "council",
  "strategy",
  // Data and Insights
  "statistics",
  "indices",
  "trends",
  // Knowledge Hub
  "vault",
  "processes",
  "studies",
  "lessons",
  "podcast",
  "reports",
  // People and Organisation
  "experts",
  "organisation",
  "operating_model",
  "hr",
  "leaderboard",
  // reached from the bar, the launcher and the top bar, not the rail
  "ask",
  "handover",
  "inbox",
  "settings",
] as const;
export type Portal = (typeof PORTALS)[number];

/* CR08 2.2: the rail groups, in order; Home and Settings stand alone. */
export const RAIL_GROUPS: ReadonlyArray<{
  key: "strategy_hub" | "data" | "knowledge" | "people";
  portals: ReadonlyArray<Portal>;
}> = [
  { key: "strategy_hub", portals: ["council", "strategy"] },
  { key: "data", portals: ["statistics", "indices", "trends"] },
  { key: "knowledge", portals: ["vault", "processes", "studies", "lessons", "podcast", "reports"] },
  { key: "people", portals: ["experts", "organisation", "operating_model", "hr", "leaderboard"] },
];
export const ACTIONS = [
  "read",
  "create",
  "edit_own",
  "edit_any",
  "verify",
  "delete",
  "manage",
] as const;
export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];

export const PermissionsMatrix = z.record(
  z.string(),
  z.record(z.string(), z.boolean())
);
export type PermissionsMatrix = Record<string, Record<string, boolean>>;

export const StringList = z.array(z.string());

export const RiskItem = z.object({
  text_en: z.string(),
  text_ar: z.string().optional().default(""),
  severity: z.enum(["low", "medium", "high"]).optional().default("medium"),
});
export const RiskItems = z.array(RiskItem);

export const StepItem = z.object({
  text_en: z.string(),
  text_ar: z.string().optional().default(""),
});
export const StepItems = z.array(StepItem);

export const QuizOptions = z.array(
  z.object({ en: z.string(), ar: z.string() })
);

export const EducationItem = z.object({
  degree: z.string(),
  institution: z.string(),
  year: z.number().nullable().optional(),
});
export const EducationList = z.array(EducationItem);

export const Breadth = z.record(z.string(), z.number());

export const OnboardingState = z.object({
  profile: z.boolean().default(false),
  upload: z.boolean().default(false),
  question: z.boolean().default(false),
  follows: z.boolean().default(false),
  tag: z.boolean().default(false),
  lesson: z.boolean().default(false),
  quiz: z.boolean().default(false),
  completedAt: z.string().nullable().default(null),
  dismissed: z.boolean().default(false),
});
export type OnboardingState = z.infer<typeof OnboardingState>;

export function parseJson<T>(
  schema: { parse: (v: unknown) => T },
  raw: string | null | undefined,
  fallback: T
): T {
  if (!raw) return fallback;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}
