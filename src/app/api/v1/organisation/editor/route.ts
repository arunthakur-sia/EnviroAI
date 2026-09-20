// CR08 1.2: the structure editor's API. Reads (levels, snapshots, change
// requests, the impact of a unit) on GET, and zod-validated mutations on POST,
// each answering with the inverse operation the client keeps for undo and the
// id of the snapshot the save produced. Super Admin only (can manage settings),
// except that a unit head may file a change request and anyone may read the
// levels.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import {
  OrgError,
  addUnit,
  applyOrgCsv,
  createChangeRequest,
  deleteLevel,
  editUnit,
  getOrgLevels,
  getUnitImpact,
  listChangeRequests,
  listSnapshots,
  moveUnit,
  previewOrgCsv,
  reorderLevels,
  resolveChangeRequest,
  restoreLevel,
  restoreSnapshot,
  restoreUnit,
  retireUnit,
  saveLevel,
  setUnitActive,
  takeSnapshot,
} from "@/server/services/organisation";

const json = (data: unknown, status = 200) => NextResponse.json({ data, error: null }, { status });
const fail = (error: string, status: number) => NextResponse.json({ data: null, error }, { status });

function isSuperAdmin(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): boolean {
  return can(user, "manage", "settings");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const view = req.nextUrl.searchParams.get("view") ?? "levels";
  if (view === "levels") return json(await getOrgLevels());
  if (!isSuperAdmin(user)) return fail("forbidden", 403);
  try {
    if (view === "snapshots") return json(await listSnapshots(30));
    if (view === "requests") {
      const status = req.nextUrl.searchParams.get("status") ?? undefined;
      return json(await listChangeRequests({ status, limit: 100 }));
    }
    if (view === "impact") {
      const id = req.nextUrl.searchParams.get("id") ?? "";
      if (!id) return fail("invalid", 400);
      return json(await getUnitImpact(id));
    }
  } catch (e) {
    if (e instanceof OrgError) return fail(e.code, e.status);
    throw e;
  }
  return fail("unknown_view", 400);
}

const Nullable = z.string().max(4000).nullable().optional();
const Patch = z.object({
  code: z.string().min(1).max(40).optional(),
  nameEn: z.string().min(1).max(300).optional(),
  nameAr: z.string().min(1).max(300).optional(),
  level: z.string().min(1).max(60).optional(),
  headUserId: z.string().max(60).nullable().optional(),
  headNameEn: z.string().max(200).nullable().optional(),
  headNameAr: z.string().max(200).nullable().optional(),
  headTitleEn: z.string().max(200).nullable().optional(),
  headTitleAr: z.string().max(200).nullable().optional(),
  mandateEn: Nullable,
  mandateAr: Nullable,
  responsibilitiesEn: Nullable,
  responsibilitiesAr: Nullable,
  sort: z.number().int().optional(),
});

const SnapshotUnitBody = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  level: z.string().min(1),
  parentId: z.string().nullable(),
  sort: z.number().int(),
  isActive: z.number().int(),
  headUserId: z.string().nullable().optional(),
  headNameEn: z.string().nullable().optional(),
  headNameAr: z.string().nullable().optional(),
  headTitleEn: z.string().nullable().optional(),
  headTitleAr: z.string().nullable().optional(),
  mandateEn: z.string().nullable().optional(),
  mandateAr: z.string().nullable().optional(),
  mandateSourceUrl: z.string().nullable().optional(),
  mandateSourceUrlAr: z.string().nullable().optional(),
  mandateFetchedAt: z.string().nullable().optional(),
  responsibilitiesEn: z.string().nullable().optional(),
  responsibilitiesAr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  keyProjectsNote: z.string().nullable().optional(),
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("unit.move"), id: z.string().min(1), parentId: z.string().nullable(), sort: z.number().int().optional() }),
  z.object({
    action: z.literal("unit.add"),
    code: z.string().min(1).max(40),
    nameEn: z.string().min(1).max(300),
    nameAr: z.string().min(1).max(300),
    level: z.string().min(1).max(60),
    parentId: z.string().nullable(),
    headUserId: z.string().nullable().optional(),
    headNameEn: z.string().max(200).nullable().optional(),
    headNameAr: z.string().max(200).nullable().optional(),
    headTitleEn: z.string().max(200).nullable().optional(),
    headTitleAr: z.string().max(200).nullable().optional(),
    mandateEn: Nullable,
    mandateAr: Nullable,
    responsibilitiesEn: Nullable,
    responsibilitiesAr: Nullable,
    sort: z.number().int().optional(),
  }),
  z.object({ action: z.literal("unit.edit"), id: z.string().min(1), patch: Patch }),
  z.object({ action: z.literal("unit.retire"), id: z.string().min(1), mode: z.enum(["deactivate", "delete"]), reassignTo: z.string().nullable() }),
  z.object({ action: z.literal("unit.delete"), id: z.string().min(1), reassignTo: z.string().nullable() }),
  z.object({
    action: z.literal("unit.restore"),
    unit: SnapshotUnitBody,
    children: z.array(z.object({ id: z.string(), parentId: z.string().nullable() })).max(500),
    moved: z.array(z.object({ key: z.string(), id: z.string(), from: z.string(), deleted: z.boolean().optional() })).max(20000),
    wasDeleted: z.boolean(),
  }),
  z.object({ action: z.literal("unit.deactivateOnly"), id: z.string().min(1), active: z.boolean() }),
  z.object({ action: z.literal("levels.save"), id: z.string().optional(), code: z.string().min(1).max(60), nameEn: z.string().min(1).max(120), nameAr: z.string().min(1).max(120) }),
  z.object({ action: z.literal("levels.reorder"), ids: z.array(z.string()).max(50) }),
  z.object({ action: z.literal("levels.delete"), id: z.string().min(1) }),
  z.object({ action: z.literal("levels.restore"), id: z.string().min(1), code: z.string().min(1), nameEn: z.string().min(1), nameAr: z.string().min(1), sort: z.number().int() }),
  z.object({ action: z.literal("snapshots.take"), note: z.string().max(200).optional() }),
  z.object({ action: z.literal("snapshots.restore"), id: z.string().min(1) }),
  z.object({ action: z.literal("csv.preview"), text: z.string().min(1).max(400000) }),
  z.object({ action: z.literal("csv.apply"), text: z.string().min(1).max(400000) }),
  z.object({ action: z.literal("requests.create"), unitId: z.string().min(1), what: z.string().min(3).max(2000), why: z.string().max(2000).optional() }),
  z.object({ action: z.literal("requests.resolve"), id: z.string().min(1), status: z.enum(["resolved", "declined"]) }),
]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", 400);
  const b = parsed.data;

  // the one action a non-administrator may take
  if (b.action === "requests.create") {
    try {
      return json(await createChangeRequest(user, { unitId: b.unitId, what: b.what, why: b.why ?? null }));
    } catch (e) {
      if (e instanceof OrgError) return fail(e.code, e.status);
      throw e;
    }
  }
  if (!isSuperAdmin(user)) return fail("forbidden", 403);

  try {
    switch (b.action) {
      case "unit.move":
        return json(await moveUnit(user.id, b.id, b.parentId, b.sort));
      case "unit.add": {
        const { action: _a, ...input } = b;
        return json(await addUnit(user.id, input));
      }
      case "unit.edit":
        return json(await editUnit(user.id, b.id, b.patch));
      case "unit.retire":
        return json(await retireUnit(user.id, b.id, b.mode, b.reassignTo));
      case "unit.delete":
        return json(await retireUnit(user.id, b.id, "delete", b.reassignTo));
      case "unit.restore":
        return json(await restoreUnit(user.id, { action: "unit.restore", unit: b.unit, children: b.children, moved: b.moved, wasDeleted: b.wasDeleted }));
      case "unit.deactivateOnly":
        return json(await setUnitActive(user.id, b.id, b.active));
      case "levels.save":
        return json(await saveLevel(user.id, { id: b.id, code: b.code, nameEn: b.nameEn, nameAr: b.nameAr }));
      case "levels.reorder":
        return json(await reorderLevels(user.id, b.ids));
      case "levels.delete":
        return json(await deleteLevel(user.id, b.id));
      case "levels.restore":
        return json(await restoreLevel(user.id, { id: b.id, code: b.code, nameEn: b.nameEn, nameAr: b.nameAr, sort: b.sort }));
      case "snapshots.take": {
        const id = await takeSnapshot(user.id, b.note?.trim() || "manual snapshot");
        await audit(user.id, "org_snapshot_taken", "org_snapshot", id);
        return json({ id });
      }
      case "snapshots.restore":
        return json(await restoreSnapshot(user.id, b.id));
      case "csv.preview":
        return json(await previewOrgCsv(b.text));
      case "csv.apply":
        return json(await applyOrgCsv(user.id, b.text));
      case "requests.resolve":
        await resolveChangeRequest(user, b.id, b.status);
        return json({ ok: true });
    }
  } catch (e) {
    if (e instanceof OrgError) return fail(e.code, e.status);
    throw e;
  }
  return fail("invalid", 400);
}
