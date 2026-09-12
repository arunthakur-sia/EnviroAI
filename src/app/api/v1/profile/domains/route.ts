import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { record } from "@/server/gamification/engine";

const Body = z.object({
  domainId: z.string(),
  action: z.enum(["accept", "dismiss"]),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });

  const [expert] = await db
    .select()
    .from(schema.experts)
    .where(eq(schema.experts.userId, user.id))
    .limit(1);
  if (!expert) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const [domain] = await db
    .select()
    .from(schema.expertDomains)
    .where(
      and(eq(schema.expertDomains.id, parsed.data.domainId), eq(schema.expertDomains.expertId, expert.id))
    )
    .limit(1);
  if (!domain) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  if (parsed.data.action === "accept") {
    await db
      .update(schema.expertDomains)
      .set({ accepted: 1 })
      .where(eq(schema.expertDomains.id, domain.id));
    await record({
      userId: user.id,
      type: "expert_profile_domain_accepted",
      resourceType: "expert_domain",
      resourceId: domain.id,
    });
  } else {
    await db.delete(schema.expertDomains).where(eq(schema.expertDomains.id, domain.id));
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}
