// CR08 7.2: the People board's role exclusions and the quiet-mode rule,
// stored under the settings key `leaderboard_settings`. Super Admin only.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { getLeaderboardSettings, saveLeaderboardSettings } from "@/server/services/leaderboard";

async function payload() {
  const [settings, roles] = await Promise.all([
    getLeaderboardSettings(),
    db
      .select({ id: schema.roles.id, nameEn: schema.roles.nameEn, nameAr: schema.roles.nameAr })
      .from(schema.roles)
      .orderBy(schema.roles.nameEn),
  ]);
  return { ...settings, roles };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data: await payload(), error: null });
}

const Body = z.object({
  excludeRoles: z.array(z.string().min(1).max(60)).max(20).optional(),
  quietModeHidesBoard: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  await saveLeaderboardSettings(parsed.data);
  await audit(user.id, "edit", "settings", "leaderboard_settings", parsed.data);
  return NextResponse.json({ data: await payload(), error: null });
}
