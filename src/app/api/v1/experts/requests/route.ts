import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createExpertRequest } from "@/server/services/experts";

const Body = z.object({
  expertId: z.string(),
  subject: z.string().min(2),
  detail: z.string().optional(),
  questionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createExpertRequest(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
