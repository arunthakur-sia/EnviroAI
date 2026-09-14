import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor, recomputeHrRisks } from "@/server/services/hr";
import { audit } from "@/server/auth/audit";
import { nowIso } from "@/lib/ids";

/* CR05 5.5/5.6.5: recompute the register on demand, resolve with a note. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope?.all) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const open = await recomputeHrRisks();
  await audit(user.id, "hr_risks_recomputed", "hr_risk", undefined, { open });
  return NextResponse.json({ data: { open }, error: null });
}

const ResolveBody = z.object({
  id: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = ResolveBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const [risk] = await db.select().from(schema.hrRisks).where(eq(schema.hrRisks.id, parsed.data.id)).limit(1);
  if (!risk) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (!scope.all && risk.departmentId !== scope.departmentId) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  await db
    .update(schema.hrRisks)
    .set({ resolvedAt: nowIso(), resolvedBy: user.id, resolutionNote: parsed.data.note ?? null })
    .where(eq(schema.hrRisks.id, parsed.data.id));
  await audit(user.id, "hr_risk_resolved", "hr_risk", parsed.data.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
