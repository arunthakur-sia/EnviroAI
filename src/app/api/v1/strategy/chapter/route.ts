import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getSetting } from "@/server/settings";
import type { ChapterInfo } from "@/server/services/strategy";

/* CR04 2.3: "Read the chapter" full text, served from the existing document
   chunks of the NES document, paginated by source page. No new storage. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const outcome = req.nextUrl.searchParams.get("outcome") ?? "";
  const locale = req.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "en";
  const chapters = await getSetting<Record<string, ChapterInfo>>("outcome_chapters", {});
  const chapter = chapters[outcome];
  if (!chapter) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  const documentId =
    locale === "ar" && chapter.documentIdAr ? chapter.documentIdAr : chapter.documentId;
  const [doc] = await db
    .select({
      id: schema.documents.id,
      titleEn: schema.documents.titleEn,
      titleAr: schema.documents.titleAr,
      classificationLevel: schema.documents.classificationLevel,
    })
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc || doc.classificationLevel > user.clearanceLevel) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }

  const chunks = await db
    .select({
      pageFrom: schema.documentChunks.pageFrom,
      chunkIndex: schema.documentChunks.chunkIndex,
      text: schema.documentChunks.text,
    })
    .from(schema.documentChunks)
    .where(
      and(
        eq(schema.documentChunks.documentId, documentId),
        gte(schema.documentChunks.pageFrom, chapter.pageFrom),
        lte(schema.documentChunks.pageFrom, chapter.pageTo)
      )
    )
    .orderBy(asc(schema.documentChunks.chunkIndex));

  // group by source page (all of a page's chunks in one block), reading order
  const byPage = new Map<number, string>();
  for (const chunk of chunks) {
    const page = chunk.pageFrom ?? chapter.pageFrom;
    byPage.set(page, (byPage.get(page) ? byPage.get(page) + "\n\n" : "") + chunk.text);
  }
  const pages = [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, text]) => ({ page, text }));

  return NextResponse.json({
    data: {
      documentId,
      documentTitleEn: doc.titleEn,
      documentTitleAr: doc.titleAr,
      pageFrom: chapter.pageFrom,
      pageTo: chapter.pageTo,
      pages: pages.slice(0, 30),
    },
    error: null,
  });
}
