import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { triageSignal, convertSignal } from "@/server/services/signals";

const Body = z.object({
  action: z.enum(["accept", "dismiss", "convert"]),
  target: z.enum(["lesson", "risk", "document"]).optional(),
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

  if (parsed.data.action === "convert") {
    if (!parsed.data.target) {
      return NextResponse.json({ data: null, error: "target_required" }, { status: 400 });
    }
    const result = await convertSignal(user, id, parsed.data.target);
    if (!result.ok) {
      return NextResponse.json(
        { data: null, error: result.error },
        { status: result.error === "forbidden" ? 403 : 422 }
      );
    }
    return NextResponse.json({ data: result, error: null });
  }
  const result = await triageSignal(user, id, parsed.data.action);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 404 }
    );
  }
  if (parsed.data.action === "accept") {
    // CR05 4.6.11: forecasts recompute when an accepted signal touches an index
    try {
      const { recomputeForSignal } = await import("@/server/indices/compute");
      await recomputeForSignal(id);
    } catch (e) {
      console.error("index recompute after signal accept failed:", (e as Error)?.message);
    }
  }
  return NextResponse.json({ data: result, error: null });
}
