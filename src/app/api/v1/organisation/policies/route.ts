// CR07 3.5: the unit head decides who may see each policy, procedure, form or
// service. Visibility sits on top of the classification level and is enforced
// everywhere by canSeeDocument().
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

const PatchBody = z
  .object({
    documentId: z.string().min(1).optional(),
    documentIds: z.array(z.string().min(1)).max(100).optional(),
    visibilityScope: z.enum(["all_staff", "unit_only", "restricted"]),
    /** user ids and role ids allowed when the scope is restricted */
    allow: z.array(z.string()).max(50).optional(),
  })
  .refine((b) => Boolean(b.documentId || b.documentIds?.length), {
    message: "a document is required",
  });

/** The unit head of the document's unit, or an administrator. */
async function mayChange(
  userId: string,
  isAdmin: boolean,
  documentIds: string[]
): Promise<boolean> {
  if (isAdmin) return true;
  const docs = await db
    .select({ id: schema.documents.id, departmentId: schema.documents.departmentId })
    .from(schema.documents)
    .where(inArray(schema.documents.id, documentIds));
  const unitIds = [...new Set(docs.map((d) => d.departmentId).filter(Boolean))] as string[];
  if (!unitIds.length) return false;
  const units = await db
    .select({ id: schema.orgUnits.id, headUserId: schema.orgUnits.headUserId })
    .from(schema.orgUnits)
    .where(inArray(schema.orgUnits.id, unitIds));
  return units.length === unitIds.length && units.every((u) => u.headUserId === userId);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { visibilityScope, allow } = parsed.data;
  const ids = parsed.data.documentIds?.length
    ? parsed.data.documentIds
    : [parsed.data.documentId!];

  const isAdmin = can(user, "manage", "settings") || can(user, "edit_any", "organisation");
  if (!(await mayChange(user.id, isAdmin, ids))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  for (const id of ids) {
    await db
      .update(schema.documents)
      .set({
        visibilityScope,
        visibilityAllowJson:
          visibilityScope === "restricted" ? JSON.stringify(allow ?? [user.id]) : null,
        updatedAt: nowIso(),
      })
      .where(eq(schema.documents.id, id));
    await audit(user.id, "policy_visibility_set", "document", id, { visibilityScope });
  }
  return NextResponse.json({ data: { updated: ids.length, visibilityScope }, error: null });
}

const PostBody = z.object({
  documentId: z.string().min(1),
  unitId: z.string().min(1),
  effectiveFrom: z.string().optional(),
  versionLabel: z.string().optional(),
  reviewCycleMonths: z.number().int().min(1).max(120).optional(),
  supersedesDocumentId: z.string().optional(),
  visibilityScope: z.enum(["all_staff", "unit_only", "restricted"]).optional(),
});

/** Attaches an uploaded document to a unit as a policy and stamps its fields. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const isAdmin = can(user, "manage", "settings") || can(user, "edit_any", "organisation");
  const [unit] = await db
    .select()
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.id, b.unitId))
    .limit(1);
  if (!unit) return NextResponse.json({ data: null, error: "unit_not_found" }, { status: 404 });
  if (!isAdmin && unit.headUserId !== user.id && !can(user, "create", "vault")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  await db
    .update(schema.documents)
    .set({
      departmentId: unit.id,
      effectiveFrom: b.effectiveFrom ?? null,
      versionLabel: b.versionLabel ?? null,
      reviewCycleMonths: b.reviewCycleMonths ?? null,
      supersedesDocumentId: b.supersedesDocumentId ?? null,
      visibilityScope: b.visibilityScope ?? "all_staff",
      updatedAt: nowIso(),
    })
    .where(eq(schema.documents.id, b.documentId));

  const [existingLink] = await db
    .select()
    .from(schema.documentUnitLinks)
    .where(eq(schema.documentUnitLinks.documentId, b.documentId))
    .limit(1);
  if (!existingLink) {
    await db.insert(schema.documentUnitLinks).values({
      id: newId(),
      documentId: b.documentId,
      unitId: unit.id,
      createdAt: nowIso(),
    });
  }
  // a new version supersedes the old one: the previous item drops out of the tab
  if (b.supersedesDocumentId) {
    await db
      .update(schema.documents)
      .set({ status: "archived", updatedAt: nowIso() })
      .where(eq(schema.documents.id, b.supersedesDocumentId));
  }
  await audit(user.id, "policy_attached", "document", b.documentId, { unitId: unit.id });
  return NextResponse.json({ data: { ok: true }, error: null });
}
