import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { isArabicText } from "@/lib/utils";
import { audit } from "@/server/auth/audit";

const Body = z.object({
  title: z.string().min(4),
  description: z.string().optional(),
  points: z.number().min(10).max(500).default(80),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(can(user, "manage", "gamification") || can(user, "manage", "settings"))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const b = parsed.data;
  const isAr = isArabicText(b.title);
  const id = newId();
  await db.insert(schema.bounties).values({
    id,
    titleEn: isAr ? "" : b.title,
    titleAr: isAr ? b.title : "",
    descriptionEn: isAr ? null : (b.description ?? null),
    descriptionAr: isAr ? (b.description ?? null) : null,
    source: "manual",
    points: b.points,
    status: "open",
    postedBy: user.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(user.id, "create", "bounty", id);
  return NextResponse.json({ data: { id }, error: null });
}
