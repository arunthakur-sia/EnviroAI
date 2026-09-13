import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { reclusterLessons } from "@/server/services/lessons";
import { audit } from "@/server/auth/audit";

/* CR04 3.7: re-run the lesson theme clustering on demand from Settings. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const made = await reclusterLessons();
  await audit(user.id, "edit", "lesson_clusters", "recluster", { made });
  return NextResponse.json({ data: { themes: made }, error: null });
}
