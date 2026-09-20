import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId } from "@/lib/ids";

/* CR08 4.2: membership and order. PUT replaces the ordered member list of
   each listed group (the board's edit mode sends the source and the target
   group of a drag together, so a move is one request). Super Admin only. */

const GroupList = z.object({
  groupId: z.string().min(1),
  indexIds: z.array(z.string().min(1)).max(400),
});

const Body = z.union([
  z.object({ groups: z.array(GroupList).min(1).max(40) }),
  GroupList,
]);

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const lists = "groups" in parsed.data ? parsed.data.groups : [parsed.data];

  const groupIds = [...new Set(lists.map((l) => l.groupId))];
  const groups = await db
    .select({ id: schema.indexGroups.id, code: schema.indexGroups.code })
    .from(schema.indexGroups)
    .where(inArray(schema.indexGroups.id, groupIds));
  if (groups.length !== groupIds.length) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const wantedIndexIds = [...new Set(lists.flatMap((l) => l.indexIds))];
  const known = new Set(
    wantedIndexIds.length
      ? (
          await db
            .select({ id: schema.indices.id })
            .from(schema.indices)
            .where(inArray(schema.indices.id, wantedIndexIds))
        ).map((r) => r.id)
      : []
  );
  if (wantedIndexIds.some((id) => !known.has(id))) {
    return NextResponse.json({ data: null, error: "unknown_index" }, { status: 400 });
  }

  const result: { groupId: string; count: number }[] = [];
  for (const list of lists) {
    const ids = [...new Set(list.indexIds)];
    await db.delete(schema.indexGroupMembers).where(eq(schema.indexGroupMembers.groupId, list.groupId));
    for (let i = 0; i < ids.length; i++) {
      await db.insert(schema.indexGroupMembers).values({
        id: newId(),
        groupId: list.groupId,
        indexId: ids[i],
        sort: i + 1,
      });
    }
    result.push({ groupId: list.groupId, count: ids.length });
  }
  await audit(user.id, "index_group_members_set", "index_group", groupIds.join(","), {
    groups: result,
  });
  return NextResponse.json({ data: { groups: result }, error: null });
}
