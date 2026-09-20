// CR08 10.2 section 6: interfaces. GET ?unit=<id or code> (one unit's flows)
// or the whole section; POST { kind: "internal" | "external" | "change_request" }
// creates; PATCH { kind: "internal" | "external" } edits (id required) and
// { kind: "resolve", id, status } settles a change request.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { findUnit } from "@/server/services/organisation";
import {
  getOperatingModelSection,
  getUnitInterfaces,
  proposeInterfaceChange,
  resolveInterfaceChange,
  upsertEntityInterface,
  upsertUnitInterface,
} from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../_shared";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const unitParam = req.nextUrl.searchParams.get("unit");
  if (unitParam) {
    const unit = await findUnit(unitParam);
    if (!unit) return fail("not_found", 404);
    const data = await getUnitInterfaces(user, unit.id);
    if (!data) return fail("not_found", 404);
    return ok(data);
  }
  return ok(await getOperatingModelSection(user, "interfaces"));
}

const Internal = z.object({
  kind: z.literal("internal"),
  id: z.string().min(1).optional(),
  fromUnitId: z.string().min(1),
  toUnitId: z.string().min(1),
  flowKind: z.enum(["data", "input", "approval", "review", "deliverable"]),
  descriptionEn: z.string().max(1000).nullable().optional(),
  descriptionAr: z.string().max(1000).nullable().optional(),
  triggerEn: z.string().max(300).nullable().optional(),
  triggerAr: z.string().max(300).nullable().optional(),
  cadence: z.string().max(60).nullable().optional(),
  serviceLevel: z.string().max(200).nullable().optional(),
  processId: z.string().nullable().optional(),
  focalFromUserId: z.string().nullable().optional(),
  focalToUserId: z.string().nullable().optional(),
  status: z.enum(["active", "retired"]).optional(),
});
const External = z.object({
  kind: z.literal("external"),
  id: z.string().min(1).optional(),
  entityId: z.string().min(1),
  providesEn: z.string().max(1000).nullable().optional(),
  providesAr: z.string().max(1000).nullable().optional(),
  receivesEn: z.string().max(1000).nullable().optional(),
  receivesAr: z.string().max(1000).nullable().optional(),
  focalNpcUserId: z.string().nullable().optional(),
  focalEntityName: z.string().max(200).nullable().optional(),
  legalBasisEn: z.string().max(500).nullable().optional(),
  legalBasisAr: z.string().max(500).nullable().optional(),
  cadence: z.string().max(60).nullable().optional(),
  processIds: z.array(z.string()).max(20).optional(),
});
const ChangeRequest = z.object({
  kind: z.literal("change_request"),
  interfaceId: z.string().nullable().optional(),
  fromUnitId: z.string().nullable().optional(),
  toUnitId: z.string().nullable().optional(),
  text: z.string().min(5).max(2000),
});
const Resolve = z.object({
  kind: z.literal("resolve"),
  id: z.string().min(1),
  status: z.enum(["approved", "declined"]),
});

const PostBody = z.discriminatedUnion("kind", [Internal, External, ChangeRequest]);
const PatchBody = z.discriminatedUnion("kind", [Internal, External, Resolve]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = PostBody.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  const body = parsed.data;
  try {
    if (body.kind === "internal") return ok(await upsertUnitInterface(user, { ...body, id: undefined }));
    if (body.kind === "external") return ok(await upsertEntityInterface(user, { ...body, id: undefined }));
    return ok(await proposeInterfaceChange(user, body));
  } catch (e) {
    return failFrom(e);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = PatchBody.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  const body = parsed.data;
  try {
    if (body.kind === "resolve") {
      await resolveInterfaceChange(user, body.id, body.status);
      return ok({ ok: true });
    }
    if (!body.id) return fail("id_required", 400);
    if (body.kind === "internal") return ok(await upsertUnitInterface(user, body));
    return ok(await upsertEntityInterface(user, body));
  } catch (e) {
    return failFrom(e);
  }
}
