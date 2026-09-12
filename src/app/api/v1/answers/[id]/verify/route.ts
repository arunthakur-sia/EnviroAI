import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { verifyAnswer } from "@/server/services/ask";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const result = await verifyAnswer(user, id);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 404 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
