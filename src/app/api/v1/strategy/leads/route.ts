import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { loadLeadsFor } from "@/server/services/strategy";
import { newId, nowIso } from "@/lib/ids";

/* CR05 2.2: read and replace a node's leads (the node editor's pickers). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const nodeId = req.nextUrl.searchParams.get("nodeId") ?? "";
  if (!nodeId) return NextResponse.json({ data: null, error: "node_required" }, { status: 400 });
  const leads = (await loadLeadsFor([nodeId])).get(nodeId) ?? [];
  return NextResponse.json({ data: leads, error: null });
}

const PutBody = z.object({
  nodeId: z.string().min(1),
  leads: z
    .array(
      z.object({
        kind: z.enum(["department", "entity"]),
        id: z.string().min(1),
        role: z.enum(["lead", "supporting"]),
      })
    )
    .max(12),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "edit_any", "strategy") && !can(user, "create", "strategy")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { nodeId, leads } = parsed.data;
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (!node) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  await db.delete(schema.nodeLeads).where(eq(schema.nodeLeads.nodeId, nodeId));
  let sort = 0;
  for (const l of leads) {
    await db.insert(schema.nodeLeads).values({
      id: newId(),
      nodeId,
      leadKind: l.kind,
      departmentId: l.kind === "department" ? l.id : null,
      entityId: l.kind === "entity" ? l.id : null,
      role: l.role,
      sort: sort++,
      verified: 1, // a human set it
      createdAt: nowIso(),
    });
  }
  await audit(user.id, "node_leads_set", "node", nodeId, { count: leads.length });
  const fresh = (await loadLeadsFor([nodeId])).get(nodeId) ?? [];
  return NextResponse.json({ data: fresh, error: null });
}
