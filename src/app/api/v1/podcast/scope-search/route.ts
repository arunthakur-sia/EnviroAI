// CR02 4.3: the composer's knowledge picker. Searches nodes, documents,
// lessons, collections, and topics by name for the "Choose knowledge" step.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ data: [], error: null });
  const pat = `%${q}%`;

  const [nodes, documents, lessons, collections, topics] = await Promise.all([
    db
      .select()
      .from(schema.strategyNodes)
      .where(
        or(
          like(schema.strategyNodes.titleEn, pat),
          like(schema.strategyNodes.titleAr, pat),
          like(schema.strategyNodes.code, pat)
        )
      )
      .limit(6),
    db
      .select()
      .from(schema.documents)
      .where(
        and(
          isNull(schema.documents.deletedAt),
          sql`${schema.documents.classificationLevel} <= ${user.clearanceLevel}`,
          or(like(schema.documents.titleEn, pat), like(schema.documents.titleAr, pat))
        )
      )
      .limit(5),
    db
      .select()
      .from(schema.lessons)
      .where(
        and(
          sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`,
          or(like(schema.lessons.titleEn, pat), like(schema.lessons.titleAr, pat))
        )
      )
      .limit(5),
    db
      .select()
      .from(schema.collections)
      .where(or(like(schema.collections.nameEn, pat), like(schema.collections.nameAr, pat)))
      .limit(4),
    db
      .select({
        id: schema.taxonomyTerms.id,
        code: schema.taxonomyTerms.code,
        nameEn: schema.taxonomyTerms.nameEn,
        nameAr: schema.taxonomyTerms.nameAr,
        dimension: schema.taxonomyDimensions.code,
      })
      .from(schema.taxonomyTerms)
      .innerJoin(
        schema.taxonomyDimensions,
        eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
      )
      .where(
        and(
          eq(schema.taxonomyDimensions.code, "topic"),
          or(like(schema.taxonomyTerms.nameEn, pat), like(schema.taxonomyTerms.nameAr, pat))
        )
      )
      .limit(4),
  ]);

  const results = [
    ...nodes.map((n) => ({
      kind: "node" as const,
      id: n.id,
      labelEn: `${n.code ? n.code + " " : ""}${n.titleEn}`,
      labelAr: `${n.code ? n.code + " " : ""}${n.titleAr}`,
      sub: n.nodeType,
    })),
    ...documents.map((d) => ({
      kind: "document" as const,
      id: d.id,
      labelEn: d.titleEn,
      labelAr: d.titleAr || d.titleEn,
      sub: "document",
    })),
    ...lessons.map((l) => ({
      kind: "lessons" as const,
      id: l.id,
      labelEn: l.titleEn,
      labelAr: l.titleAr || l.titleEn,
      sub: "lesson",
    })),
    ...collections.map((c) => ({
      kind: "collection" as const,
      id: c.id,
      labelEn: c.nameEn,
      labelAr: c.nameAr || c.nameEn,
      sub: "collection",
    })),
    ...topics.map((t) => ({
      kind: "topic" as const,
      id: t.code,
      labelEn: t.nameEn,
      labelAr: t.nameAr,
      sub: "topic",
    })),
  ];
  return NextResponse.json({ data: results.slice(0, 18), error: null });
}
