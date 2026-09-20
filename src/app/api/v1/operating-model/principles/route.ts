// CR08 10.2 section 1: the operating principles. GET lists, POST creates,
// PATCH edits (id required), DELETE ?id= removes.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { deletePrinciple, getPrinciples, upsertPrinciple } from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../_shared";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  return ok(await getPrinciples());
}

const Body = z.object({
  id: z.string().min(1).optional(),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  textEn: z.string().max(1000).nullable().optional(),
  textAr: z.string().max(1000).nullable().optional(),
  sort: z.number().int().optional(),
});

async function write(req: NextRequest, requireId: boolean) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  if (requireId && !parsed.data.id) return fail("id_required", 400);
  try {
    return ok(await upsertPrinciple(user, parsed.data));
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
    await deletePrinciple(user, id);
    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
