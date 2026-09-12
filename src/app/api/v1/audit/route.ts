import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const conds = [];
  if (sp.get("action")) conds.push(eq(schema.auditLog.action, sp.get("action")!));
  if (sp.get("userId")) conds.push(eq(schema.auditLog.userId, sp.get("userId")!));
  if (sp.get("since")) conds.push(gte(schema.auditLog.createdAt, sp.get("since")!));

  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      resourceType: schema.auditLog.resourceType,
      resourceId: schema.auditLog.resourceId,
      createdAt: schema.auditLog.createdAt,
      userNameEn: schema.users.nameEn,
      userEmail: schema.users.email,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(Number(sp.get("limit") ?? 200));

  if (sp.get("format") === "csv") {
    const header = "timestamp,user,email,action,resource_type,resource_id";
    const lines = rows.map((r) =>
      [r.createdAt, r.userNameEn ?? "", r.userEmail ?? "", r.action, r.resourceType ?? "", r.resourceId ?? ""]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": "attachment; filename=audit-log.csv",
      },
    });
  }
  return NextResponse.json({ data: rows, error: null });
}
