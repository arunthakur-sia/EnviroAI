import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor } from "@/server/services/hr";
import { audit } from "@/server/auth/audit";
import { nowIso } from "@/lib/ids";

/* CR05 5.6.3: set an employee's status (HR Admin everywhere, a Department
   Head inside their department). */
const Body = z.object({
  userId: z.string().min(1),
  status: z.enum(["active", "leaving", "transferring", "long_leave"]),
  effectiveDate: z.string().nullable().optional(),
  targetDepartmentId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, b.userId)).limit(1);
  if (!target) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (!scope.all && target.departmentId !== scope.departmentId) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const [existing] = await db
    .select()
    .from(schema.employeeStatus)
    .where(eq(schema.employeeStatus.userId, b.userId))
    .limit(1);
  const values = {
    status: b.status,
    effectiveDate: b.effectiveDate ?? null,
    targetDepartmentId: b.targetDepartmentId ?? null,
    note: b.note ?? null,
    setBy: user.id,
    setAt: nowIso(),
  };
  if (existing) {
    await db.update(schema.employeeStatus).set(values).where(eq(schema.employeeStatus.userId, b.userId));
  } else {
    await db.insert(schema.employeeStatus).values({ userId: b.userId, ...values });
  }
  await audit(user.id, "employee_status_set", "user", b.userId, { status: b.status });
  return NextResponse.json({ data: { ok: true }, error: null });
}
