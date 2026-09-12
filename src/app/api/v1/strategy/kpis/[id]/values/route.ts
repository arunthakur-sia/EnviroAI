import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { addKpiValue } from "@/server/services/strategy";

const Body = z.object({
  period: z.string().min(4),
  value: z.number(),
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await addKpiValue(user, id, parsed.data.period, parsed.data.value, parsed.data.note);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 404 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
