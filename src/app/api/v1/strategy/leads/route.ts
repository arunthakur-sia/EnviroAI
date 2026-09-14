import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { loadLeadsFor } from "@/server/services/strategy";
import { newId, nowIso } from "@/lib/ids";

/* CR05 2.2: read and replace a node's leads (the node editor's pickers).
   CR06: ?list=departments feeds the Set-department-owner picker. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (req.nextUrl.searchParams.get("list") === "departments") {
    const deps = await db
      .select({
        id: schema.departments.id,
        code: schema.departments.code,
        nameEn: schema.departments.nameEn,
        nameAr: schema.departments.nameAr,
      })
      .from(schema.departments)
      .orderBy(asc(schema.departments.nameEn));
    return NextResponse.json({ data: deps, error: null });
  }
  const nodeId = req.nextUrl.searchParams.get("nodeId") ?? "";
  if (!nodeId) return NextResponse.json({ data: null, error: "node_required" }, { status: 400 });
  const leads = (await loadLeadsFor([nodeId])).get(nodeId) ?? [];
  return NextResponse.json({ data: leads, error: null });
}

/* CR06 4: set an outcome's department owner without touching entity leads
   or supporting rows (unlike PUT, which replaces everything). */
const PostBody = z.object({
  nodeId: z.string().min(1),
  action: z.literal("set_department_owner"),
  departmentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "edit_any", "strategy") && !can(user, "create", "strategy")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { nodeId, departmentId } = parsed.data;
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (!node) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const [dep] = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.id, departmentId))
    .limit(1);
  if (!dep) return NextResponse.json({ data: null, error: "department_not_found" }, { status: 404 });

  await db
    .delete(schema.nodeLeads)
    .where(
      and(
        eq(schema.nodeLeads.nodeId, nodeId),
        eq(schema.nodeLeads.leadKind, "department"),
        eq(schema.nodeLeads.role, "lead")
      )
    );
  await db.insert(schema.nodeLeads).values({
    id: newId(),
    nodeId,
    leadKind: "department",
    departmentId,
    role: "lead",
    sort: 0,
    verified: 1, // a human set it
    createdAt: nowIso(),
  });
  await audit(user.id, "node_department_owner_set", "node", nodeId, { departmentId });
  const fresh = (await loadLeadsFor([nodeId])).get(nodeId) ?? [];
  return NextResponse.json({ data: fresh, error: null });
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
