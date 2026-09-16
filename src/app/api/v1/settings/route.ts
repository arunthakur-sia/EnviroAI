import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getAiSettings, getFlags, getSetting, setSetting, DEFAULT_AI_SETTINGS, DEFAULT_FLAGS } from "@/server/settings";
import { getTrendsSettings, DEFAULT_TRENDS_SETTINGS } from "@/server/scan";
import { DEFAULT_QNV_PILLARS } from "@/server/services/strategy";
import { audit } from "@/server/auth/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const [
    ai,
    flags,
    trends,
    qnvPillars,
    lessonsSettings,
    lessonOfWeek,
    reflectionPrompts,
    allowedDomains,
    councilStrategyOffice,
  ] = await Promise.all([
    getAiSettings(),
    getFlags(),
    getTrendsSettings(),
    getSetting("qnv_pillars", DEFAULT_QNV_PILLARS),
    getSetting("lessons_settings", { learnModeEnabled: true, reclusterNightly: true }),
    getSetting("lesson_of_week", { schedule: [] }),
    getSetting("reflection_prompts", []),
    getSetting("allowed_domains", ["npc.qa"]),
    // CR07 2.1
    getSetting("council_strategy_office", { unitCode: "IDP" }),
  ]);
  return NextResponse.json({
    data: {
      ai,
      flags,
      trends,
      qnvPillars,
      lessonsSettings,
      lessonOfWeek,
      reflectionPrompts,
      allowedDomains,
      councilStrategyOffice,
    },
    error: null,
  });
}

const Body = z.object({
  ai: z
    .object({
      mockMode: z.boolean(),
      modelDefault: z.string(),
      modelBrief: z.string(),
      modelFast: z.string(),
      temperature: z.number().min(0).max(1),
      maxSources: z.number().min(2).max(20),
      allowSecretInAnswers: z.boolean(),
      dailyTokenBudget: z.number(),
    })
    .partial()
    .optional(),
  flags: z
    .object({
      gamification: z.boolean(),
      gapRadar: z.boolean(),
      signalScanner: z.boolean(),
      numeralsDefault: z.enum(["western", "eastern"]),
    })
    .partial()
    .optional(),
  trends: z
    .object({
      intervalHours: z.number().min(1).max(168),
      webSearchOn: z.boolean(),
      scanTokenBudget: z.number().min(10000),
    })
    .partial()
    .optional(),
  /* CR04 2.2: the QNV pillar mapping (Settings > Lessons and Strategy) */
  qnvPillars: z
    .array(
      z.object({
        key: z.enum(["human", "social", "economic", "environmental"]),
        outcomes: z.array(z.number().int().min(1).max(9)).max(9),
      })
    )
    .length(4)
    .optional(),
  /* CR04 3.7: Settings > Lessons */
  lessonsSettings: z
    .object({ learnModeEnabled: z.boolean(), reclusterNightly: z.boolean() })
    .partial()
    .optional(),
  lessonOfWeek: z
    .object({
      schedule: z
        .array(z.object({ weekStart: z.string(), lessonId: z.string() }))
        .max(26),
    })
    .optional(),
  reflectionPrompts: z
    .array(z.object({ en: z.string().max(300), ar: z.string().max(300) }))
    .max(10)
    .optional(),
  /* CR05 4.8: forecast assumption defaults */
  indexAssumption: z
    .object({ id: z.string().min(1), value: z.number() })
    .optional(),
  /* CR05 6.3: allowed sign-in domains */
  allowedDomains: z.array(z.string().min(3).max(60)).max(10).optional(),
  /* CR07 2.1: the unit whose members may edit the Council Strategy */
  councilStrategyOffice: z.object({ unitCode: z.string().min(1).max(40) }).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  if (parsed.data.ai) {
    const current = await getAiSettings();
    await setSetting("ai", { ...DEFAULT_AI_SETTINGS, ...current, ...parsed.data.ai });
  }
  if (parsed.data.flags) {
    const current = await getFlags();
    await setSetting("flags", { ...DEFAULT_FLAGS, ...current, ...parsed.data.flags });
  }
  if (parsed.data.trends) {
    const current = await getTrendsSettings();
    await setSetting("trends", { ...DEFAULT_TRENDS_SETTINGS, ...current, ...parsed.data.trends });
  }
  if (parsed.data.qnvPillars) {
    await setSetting("qnv_pillars", parsed.data.qnvPillars);
  }
  if (parsed.data.lessonsSettings) {
    const current = await getSetting("lessons_settings", {
      learnModeEnabled: true,
      reclusterNightly: true,
    });
    await setSetting("lessons_settings", { ...current, ...parsed.data.lessonsSettings });
  }
  if (parsed.data.lessonOfWeek) {
    await setSetting("lesson_of_week", parsed.data.lessonOfWeek);
  }
  if (parsed.data.reflectionPrompts) {
    await setSetting("reflection_prompts", parsed.data.reflectionPrompts);
  }
  if (parsed.data.councilStrategyOffice) {
    await setSetting("council_strategy_office", parsed.data.councilStrategyOffice);
  }
  if (parsed.data.indexAssumption) {
    const { db, schema } = await import("@/server/db/client");
    const { eq } = await import("drizzle-orm");
    const a = parsed.data.indexAssumption;
    const [row] = await db
      .select()
      .from(schema.indexForecastAssumptions)
      .where(eq(schema.indexForecastAssumptions.id, a.id))
      .limit(1);
    if (row) {
      const clamped = Math.max(row.min, Math.min(row.max, a.value));
      await db
        .update(schema.indexForecastAssumptions)
        .set({ value: clamped })
        .where(eq(schema.indexForecastAssumptions.id, a.id));
    }
  }
  if (parsed.data.allowedDomains) {
    await setSetting("allowed_domains", parsed.data.allowedDomains);
  }
  await audit(user.id, "edit", "settings", "global", parsed.data as Record<string, unknown>);
  return NextResponse.json({ data: { ok: true }, error: null });
}
