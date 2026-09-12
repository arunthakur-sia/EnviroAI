import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createQuestion, listQuestions } from "@/server/services/ask";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const rows = await listQuestions(user, {
    status: sp.get("status")?.split(",").filter(Boolean),
    communityId: sp.get("community") ?? undefined,
    limit: Number(sp.get("limit") ?? 40),
  });
  return NextResponse.json({ data: rows, error: null });
}

const Body = z.object({
  title: z.string().min(4).max(300),
  body: z.string().max(4000).optional(),
  communityId: z.string().nullable().optional(),
  aiAnswer: z
    .object({
      markdown: z.string(),
      citationsJson: z.string(),
      confidence: z.string(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createQuestion(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ data: { id: result.id }, error: null });
}
