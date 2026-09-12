import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { profileCompletion } from "@/server/services/experts";
import { enqueue } from "@/server/jobs/queue";

const Body = z.object({
  localePref: z.enum(["en", "ar"]).optional(),
  numeralsPref: z.enum(["western", "eastern"]).optional(),
  quietMode: z.boolean().optional(),
  bioEn: z.string().optional(),
  bioAr: z.string().optional(),
  positionEn: z.string().optional(),
  positionAr: z.string().optional(),
  availability: z.enum(["available", "limited", "unavailable"]).optional(),
  languages: z.array(z.string()).optional(),
  yearsExperience: z.number().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const b = parsed.data;

  const userPatch: Record<string, unknown> = { updatedAt: nowIso() };
  if (b.localePref) userPatch.localePref = b.localePref;
  if (b.numeralsPref) userPatch.numeralsPref = b.numeralsPref;
  if (b.quietMode !== undefined) userPatch.quietMode = b.quietMode ? 1 : 0;
  if (b.positionEn !== undefined) userPatch.positionEn = b.positionEn;
  if (b.positionAr !== undefined) userPatch.positionAr = b.positionAr;
  await db.update(schema.users).set(userPatch).where(eq(schema.users.id, user.id));

  // expert profile fields
  const [expert] = await db
    .select()
    .from(schema.experts)
    .where(eq(schema.experts.userId, user.id))
    .limit(1);
  if (expert) {
    const expertPatch: Record<string, unknown> = { updatedAt: nowIso() };
    if (b.bioEn !== undefined) expertPatch.bioEn = b.bioEn;
    if (b.bioAr !== undefined) expertPatch.bioAr = b.bioAr;
    if (b.positionEn !== undefined) expertPatch.positionEn = b.positionEn;
    if (b.positionAr !== undefined) expertPatch.positionAr = b.positionAr;
    if (b.availability) expertPatch.availability = b.availability;
    if (b.languages) expertPatch.languagesJson = JSON.stringify(b.languages);
    if (b.yearsExperience !== undefined) expertPatch.yearsExperience = b.yearsExperience;
    await db.update(schema.experts).set(expertPatch).where(eq(schema.experts.id, expert.id));

    // completion award
    const [fresh] = await db.select().from(schema.experts).where(eq(schema.experts.id, expert.id)).limit(1);
    const domainRows = await db
      .select()
      .from(schema.expertDomains)
      .where(eq(schema.expertDomains.expertId, expert.id));
    const completion = profileCompletion(fresh, domainRows.filter((d) => d.accepted === 1).length);
    if (completion >= 0.999) {
      await record({
        userId: user.id,
        type: "expert_profile_completed",
        resourceType: "expert",
        resourceId: expert.id,
      });
    }
    await enqueue("embed_records", { resourceType: "expert", resourceId: expert.id });
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
