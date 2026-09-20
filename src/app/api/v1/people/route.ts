// CR08 9: people search for the compose recipient and the delegate picker.
// Any signed-in colleague may look a colleague up (name, email, unit).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { searchPeople } from "@/server/services/messaging";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const rows = await searchPeople(user, sp.get("q") ?? "", {
    limit: Math.min(25, Math.max(1, Number(sp.get("limit") ?? 12) || 12)),
    excludeSelf: sp.get("self") !== "1",
  });
  return NextResponse.json({ data: rows, error: null });
}
