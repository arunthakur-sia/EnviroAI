// CR08 9.1: the person card behind OwnerControl. ?itemType=&itemId= names the
// item in view so the HR backup owner is the item's own.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPersonCard } from "@/server/services/people";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const itemType = sp.get("itemType");
  const itemId = sp.get("itemId");
  const card = await getPersonCard(user, id, itemType && itemId ? { type: itemType, id: itemId } : null);
  if (!card) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: card, error: null });
}
