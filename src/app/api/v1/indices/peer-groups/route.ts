import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";

/* CR05 4.7: user-saved custom peer groups (shared presets are seeded). */
const Body = z.object({
  nameEn: z.string().min(1).max(80),
  nameAr: z.string().min(1).max(80),
  countries: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(30),
  isDefaultPreset: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const id = newId();
  await db.insert(schema.peerGroups).values({
    id,
    nameEn: parsed.data.nameEn,
    nameAr: parsed.data.nameAr,
    countryCodesJson: JSON.stringify(parsed.data.countries),
    isDefault: 0,
    ownerUserId: user.id,
    createdAt: nowIso(),
  });
  return NextResponse.json({
    data: { id, nameEn: parsed.data.nameEn, nameAr: parsed.data.nameAr, countries: parsed.data.countries },
    error: null,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  await db
    .delete(schema.peerGroups)
    .where(and(eq(schema.peerGroups.id, id), eq(schema.peerGroups.ownerUserId, user.id)));
  return NextResponse.json({ data: { ok: true }, error: null });
}
