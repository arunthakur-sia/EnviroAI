import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { routeToExpert } from "@/server/services/ask";

const Body = z.object({
  questionId: z.string().nullable().optional(),
  expertId: z.string(),
  reason: z.string().optional(),
  queryText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await routeToExpert(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ data: { questionId: result.questionId }, error: null });
}
