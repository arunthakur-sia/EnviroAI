import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getAiSettings, getFlags, setSetting, DEFAULT_AI_SETTINGS, DEFAULT_FLAGS } from "@/server/settings";
import { getTrendsSettings, DEFAULT_TRENDS_SETTINGS } from "@/server/scan";
import { audit } from "@/server/auth/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const [ai, flags, trends] = await Promise.all([
    getAiSettings(),
    getFlags(),
    getTrendsSettings(),
  ]);
  return NextResponse.json({ data: { ai, flags, trends }, error: null });
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
  await audit(user.id, "edit", "settings", "global", parsed.data as Record<string, unknown>);
  return NextResponse.json({ data: { ok: true }, error: null });
}
