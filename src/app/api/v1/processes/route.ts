// CR08 10.1: the process map. GET ?view=process|unit|policy (default: the
// whole map), POST creates, PATCH edits, DELETE ?id= removes a childless
// process. Writes: the Strategy Office and Super Admins, or the head of the
// owning unit.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { deleteProcess, getProcessMap, upsertProcess } from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../operating-model/_shared";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const view = req.nextUrl.searchParams.get("view") ?? "all";
  const map = await getProcessMap(user);
  if (view === "process") return ok({ chain: map.chain, totals: map.totals, canEdit: map.canEdit });
  if (view === "unit") return ok({ byUnit: map.byUnit, totals: map.totals, canEdit: map.canEdit });
  if (view === "policy") return ok({ byPolicyType: map.byPolicyType, totals: map.totals, canEdit: map.canEdit });
  return ok(map);
}

const Io = z.object({ textEn: z.string().max(500), textAr: z.string().max(500), fromUnitCode: z.string().max(20).nullable().optional() });
const Step = z.object({
  n: z.number().int().min(1).max(99),
  textEn: z.string().max(1000),
  textAr: z.string().max(1000),
  roleUnitCode: z.string().max(20).nullable().optional(),
  system: z.string().max(120).nullable().optional(),
});
const Body = z.object({
  id: z.string().min(1).optional(),
  code: z.string().min(1).max(20),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  parentId: z.string().nullable().optional(),
  nameEn: z.string().min(1).max(300),
  nameAr: z.string().min(1).max(300),
  purposeEn: z.string().max(2000).nullable().optional(),
  purposeAr: z.string().max(2000).nullable().optional(),
  ownerUnitId: z.string().nullable().optional(),
  inputs: z.array(Io).max(20).optional(),
  outputs: z.array(Io).max(20).optional(),
  steps: z.array(Step).max(30).optional(),
  systems: z.array(z.object({ nameEn: z.string().max(120), nameAr: z.string().max(120) })).max(20).optional(),
  kpis: z
    .array(z.object({ nameEn: z.string().max(200), nameAr: z.string().max(200), target: z.union([z.string(), z.number()]).nullable().optional(), unit: z.string().max(40).nullable().optional() }))
    .max(12)
    .optional(),
  policyDocumentIds: z.array(z.string()).max(30).optional(),
  sopDocumentIds: z.array(z.string()).max(30).optional(),
  status: z.enum(["active", "draft", "retired"]).optional(),
  sort: z.number().int().optional(),
  isIllustrative: z.boolean().optional(),
});

async function write(req: NextRequest, requireId: boolean) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  if (requireId && !parsed.data.id) return fail("id_required", 400);
  try {
    return ok(await upsertProcess(user, parsed.data));
  } catch (e) {
    return failFrom(e);
  }
}

export async function POST(req: NextRequest) {
  return write(req, false);
}

export async function PATCH(req: NextRequest) {
  return write(req, true);
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return fail("id_required", 400);
  try {
    await deleteProcess(user, id);
    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
