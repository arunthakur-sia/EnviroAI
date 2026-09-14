import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";

/* CR05 6.4: "Preview as" for the Super Admin. Sets a cookie the session
   loader honours; the middleware makes every non-GET API read-only while it
   is set (this route is allowlisted so the preview can end). */
const Body = z.object({
  action: z.enum(["start", "exit"]),
  userId: z.string().optional(),
  roleId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  // while previewing, the effective user is the target; the cookie's owner is
  // recorded in previewing.byUserId, so exit is allowed from that state too
  const isRealSuperAdmin = user?.role.nameEn === "Super Admin" || !!user?.previewing;
  if (!user || !isRealSuperAdmin) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const store = await cookies();
  if (parsed.data.action === "exit") {
    store.delete("nexus_preview");
    await audit(user.previewing?.byUserId ?? user.id, "preview_ended", "user", user.id);
    return NextResponse.json({ data: { ok: true }, error: null });
  }
  if (user.previewing) {
    return NextResponse.json({ data: null, error: "already_previewing" }, { status: 400 });
  }
  if (!parsed.data.userId && !parsed.data.roleId) {
    return NextResponse.json({ data: null, error: "target_required" }, { status: 400 });
  }
  store.set(
    "nexus_preview",
    JSON.stringify(
      parsed.data.userId ? { userId: parsed.data.userId } : { roleId: parsed.data.roleId }
    ),
    { httpOnly: true, sameSite: "lax", path: "/" }
  );
  await audit(user.id, "preview_started", "user", parsed.data.userId ?? parsed.data.roleId);
  return NextResponse.json({ data: { ok: true }, error: null });
}
