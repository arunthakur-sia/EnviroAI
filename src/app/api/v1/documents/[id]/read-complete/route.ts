import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getDocument, documentTags } from "@/server/services/documents";
import { record } from "@/server/gamification/engine";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { doc, allowed } = await getDocument(user, id);
  if (!doc || !allowed) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const tags = await documentTags(id);
  const outcomes = tags.filter((t) => t.dimension === "outcome").map((t) => t.code);
  const result = await record({
    userId: user.id,
    type: "document_read_fully",
    resourceType: "document",
    resourceId: id,
    meta: { outcomes },
  });
  return NextResponse.json({ data: { points: result.points }, error: null });
}
