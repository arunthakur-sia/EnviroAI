// CR08 10.2 section 7: the operational KPI scorecard. GET the cards,
// POST { kpiId | code, period: "2026-09", value } enters a monthly value,
// PATCH upserts a KPI definition.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { enterOpsKpiValue, getOpsKpis, upsertOpsKpi } from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../_shared";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  return ok(await getOpsKpis());
}

const ValueBody = z
  .object({
    kpiId: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    value: z.number().nullable(),
  })
  .refine((b) => b.kpiId || b.code, { message: "kpiId or code" });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = ValueBody.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  try {
    return ok(await enterOpsKpiValue(user, parsed.data));
  } catch (e) {
    return failFrom(e);
  }
}

const KpiBody = z.object({
  id: z.string().min(1).optional(),
  code: z.string().min(1).max(60),
  nameEn: z.string().min(1).max(200),
  nameAr: z.string().min(1).max(200),
  unit: z.string().max(40).nullable().optional(),
  direction: z.enum(["up_good", "down_good"]).optional(),
  sourceKind: z.enum(["auto", "manual"]).optional(),
  targetValue: z.number().nullable().optional(),
  sort: z.number().int().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = KpiBody.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  try {
    return ok(await upsertOpsKpi(user, parsed.data));
  } catch (e) {
    return failFrom(e);
  }
}
