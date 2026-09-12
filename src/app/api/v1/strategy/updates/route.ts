import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createStatusUpdate } from "@/server/services/strategy";

const Body = z.object({
  nodeId: z.string(),
  status: z.enum(["not_started", "on_track", "at_risk", "delayed", "completed"]),
  progressPct: z.number().min(0).max(100),
  summaryEn: z.string().optional(),
  summaryAr: z.string().optional(),
  risks: z
    .array(z.object({ text_en: z.string(), text_ar: z.string().optional(), severity: z.string().optional() }))
    .optional(),
  nextSteps: z.array(z.object({ text_en: z.string(), text_ar: z.string().optional() })).optional(),
  evidenceDocumentIds: z.array(z.string()).optional(),
  period: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createStatusUpdate(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 404 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
