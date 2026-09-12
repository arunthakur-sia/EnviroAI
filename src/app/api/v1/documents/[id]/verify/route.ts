import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { verifyDocument } from "@/server/services/documents";

const Body = z.object({
  decision: z.enum(["verified", "needs_changes"]),
  note: z.string().optional(),
  bothLanguagesChecked: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await verifyDocument(
    user,
    id,
    body.data.decision,
    body.data.note,
    body.data.bothLanguagesChecked
  );
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 404 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
