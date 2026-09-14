import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor } from "@/server/services/hr";
import { audit } from "@/server/auth/audit";
import { nowIso } from "@/lib/ids";

/* CR05 5.6.2: edit a department's responsibilities inline (HR Admin and the
   department head). */
const Body = z.object({
  departmentId: z.string().min(1),
  responsibilitiesEn: z.string().max(4000).nullable().optional(),
  responsibilitiesAr: z.string().max(4000).nullable().optional(),
  keyProjectsNote: z.string().max(1000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if (!scope.all && scope.departmentId !== b.departmentId) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const [dept] = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.id, b.departmentId))
    .limit(1);
  if (!dept) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db
    .update(schema.departments)
    .set({
      responsibilitiesEn:
        b.responsibilitiesEn === undefined ? dept.responsibilitiesEn : b.responsibilitiesEn,
      responsibilitiesAr:
        b.responsibilitiesAr === undefined ? dept.responsibilitiesAr : b.responsibilitiesAr,
      keyProjectsNote:
        b.keyProjectsNote === undefined ? dept.keyProjectsNote : b.keyProjectsNote,
      updatedAt: nowIso(),
    })
    .where(eq(schema.departments.id, b.departmentId));
  await audit(user.id, "department_responsibilities_set", "department", b.departmentId);
  return NextResponse.json({ data: { ok: true }, error: null });
}
