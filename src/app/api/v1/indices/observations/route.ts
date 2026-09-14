import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

/* CR05 4.8: manual observation entry and correction. Manual rows carry the
   `manual` status and are never clobbered by a refresh. */
const Body = z.object({
  indexCode: z.string().min(2),
  country: z.string().regex(/^[A-Z]{3}$/),
  year: z.number().int().min(2000).max(2100),
  rank: z.number().int().min(1).nullable().optional(),
  score: z.number().nullable().optional(),
  totalCountries: z.number().int().min(1).nullable().optional(),
  sourceUrl: z.string().optional(),
  verify: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if (b.rank == null && b.score == null) {
    return NextResponse.json({ data: null, error: "value_required" }, { status: 400 });
  }
  const [index] = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.code, b.indexCode))
    .limit(1);
  if (!index) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const [existing] = await db
    .select()
    .from(schema.indexObservations)
    .where(
      and(
        eq(schema.indexObservations.indexId, index.id),
        eq(schema.indexObservations.countryCode, b.country),
        eq(schema.indexObservations.year, b.year)
      )
    )
    .limit(1);
  const status = b.verify ? "verified" : "manual";
  if (existing) {
    await db
      .update(schema.indexObservations)
      .set({
        rank: b.rank ?? null,
        score: b.score ?? null,
        totalCountries: b.totalCountries ?? existing.totalCountries,
        sourceUrl: b.sourceUrl ?? existing.sourceUrl,
        status,
        fetchedAt: nowIso(),
      })
      .where(eq(schema.indexObservations.id, existing.id));
  } else {
    await db.insert(schema.indexObservations).values({
      id: newId(),
      indexId: index.id,
      countryCode: b.country,
      year: b.year,
      rank: b.rank ?? null,
      score: b.score ?? null,
      totalCountries: b.totalCountries ?? null,
      sourceUrl: b.sourceUrl ?? null,
      fetchedAt: nowIso(),
      status,
    });
  }
  await audit(user.id, "index_observation_set", "index", index.id, {
    country: b.country,
    year: b.year,
    status,
  });
  return NextResponse.json({ data: { ok: true }, error: null });
}
