// CR07 1.3: link a lesson to strategy nodes. GET searches the two strategy
// stores for the picker, POST links, PATCH promotes a link to primary,
// DELETE unlinks. Every write goes through canEditLessonLinks (the lesson's
// author, the node's owner, or a verifier).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import {
  linkLessonToNode,
  unlinkLesson,
  setPrimaryLink,
  loadLinksForLessons,
  canEditLessonLinks,
} from "@/server/services/lesson-links";

/** GET ?lessonId= returns the lesson's links.
    GET ?q=&store=nds|council searches nodes for the picker.
    GET ?tree=nds|council returns the drill-down tree. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;

  const lessonId = sp.get("lessonId");
  if (lessonId) {
    const links = (await loadLinksForLessons([lessonId])).get(lessonId) ?? [];
    const canEdit = await canEditLessonLinks(user, lessonId);
    return NextResponse.json({ data: { links, canEdit }, error: null });
  }

  const store = sp.get("store") === "council" ? "council" : "nds";
  const tree = sp.get("tree");
  if (tree) {
    if (store === "council") {
      const rows = await db
        .select({
          id: schema.councilNodes.id,
          parentId: schema.councilNodes.parentId,
          code: schema.councilNodes.code,
          titleEn: schema.councilNodes.titleEn,
          titleAr: schema.councilNodes.titleAr,
          level: schema.councilNodes.level,
        })
        .from(schema.councilNodes)
        .orderBy(schema.councilNodes.sort);
      return NextResponse.json({ data: rows.map((r) => ({ ...r, kind: "council" })), error: null });
    }
    const rows = await db
      .select({
        id: schema.strategyNodes.id,
        parentId: schema.strategyNodes.parentId,
        code: schema.strategyNodes.code,
        titleEn: schema.strategyNodes.titleEn,
        titleAr: schema.strategyNodes.titleAr,
        level: schema.strategyNodes.nodeType,
        editionId: schema.strategyNodes.editionId,
      })
      .from(schema.strategyNodes)
      .orderBy(schema.strategyNodes.sort);
    const editions = await db.select().from(schema.strategyEditions);
    const codeOf = new Map(editions.map((e) => [e.id, e.code]));
    return NextResponse.json({
      data: rows.map((r) => ({ ...r, kind: "nds", edition: codeOf.get(r.editionId) ?? null })),
      error: null,
    });
  }

  const q = (sp.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ data: [], error: null });
  const pattern = `%${q}%`;
  if (store === "council") {
    const rows = await db
      .select({
        id: schema.councilNodes.id,
        code: schema.councilNodes.code,
        titleEn: schema.councilNodes.titleEn,
        titleAr: schema.councilNodes.titleAr,
        level: schema.councilNodes.level,
      })
      .from(schema.councilNodes)
      .where(
        and(
          inArray(schema.councilNodes.level, ["project", "output"]),
          or(
            like(schema.councilNodes.titleEn, pattern),
            like(schema.councilNodes.titleAr, pattern),
            like(schema.councilNodes.code, pattern)
          )
        )
      )
      .limit(10);
    return NextResponse.json({
      data: rows.map((r) => ({ ...r, kind: "council", edition: null })),
      error: null,
    });
  }
  const rows = await db
    .select({
      id: schema.strategyNodes.id,
      code: schema.strategyNodes.code,
      titleEn: schema.strategyNodes.titleEn,
      titleAr: schema.strategyNodes.titleAr,
      level: schema.strategyNodes.nodeType,
      editionId: schema.strategyNodes.editionId,
    })
    .from(schema.strategyNodes)
    .where(
      and(
        inArray(schema.strategyNodes.nodeType, ["project", "initiative"]),
        or(
          like(schema.strategyNodes.titleEn, pattern),
          like(schema.strategyNodes.titleAr, pattern),
          like(schema.strategyNodes.code, pattern)
        )
      )
    )
    .limit(10);
  const editions = await db.select().from(schema.strategyEditions);
  const codeOf = new Map(editions.map((e) => [e.id, e.code]));
  return NextResponse.json({
    data: rows.map((r) => ({ ...r, kind: "nds", edition: codeOf.get(r.editionId) ?? null })),
    error: null,
  });
}

const PostBody = z.object({
  lessonId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeKind: z.enum(["nds", "council"]).optional(),
  makePrimary: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const result = await linkLessonToNode(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 400 }
    );
  }
  return NextResponse.json({ data: result.link, error: null });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { linkId?: string } | null;
  if (!body?.linkId) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const result = await setPrimaryLink(user, body.linkId);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 400 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const linkId = req.nextUrl.searchParams.get("linkId") ?? "";
  if (!linkId) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const result = await unlinkLesson(user, linkId);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 400 }
    );
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}

/** Lessons of a node, direct then inherited (used by the tabs and drawers). */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { nodeId?: string } | null;
  if (!body?.nodeId) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { getLessonsForNode } = await import("@/server/services/lesson-links");
  const data = await getLessonsForNode(user, body.nodeId);
  return NextResponse.json({ data, error: null });
}
