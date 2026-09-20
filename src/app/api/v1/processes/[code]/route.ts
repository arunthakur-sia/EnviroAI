// CR08 10.1: one process by code (P4.1) or id, with everything its panel shows.
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getProcess } from "@/server/services/operating-model";
import { fail, ok } from "../../operating-model/_shared";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { code } = await ctx.params;
  const data = await getProcess(user, decodeURIComponent(code));
  if (!data) return fail("not_found", 404);
  return ok(data);
}
