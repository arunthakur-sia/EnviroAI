// Instant grouped suggestions for the top-bar search (FTS only, 300ms debounce client-side).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { ftsRecords } from "@/server/search/fts";
import { resolveResourceTitles } from "@/server/services/documents";
import { canReadResource } from "@/server/auth/permissions";
import { db, schema } from "@/server/db/client";
import { inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const locale = req.nextUrl.searchParams.get("locale") ?? "en";
  if (q.trim().length < 2) return NextResponse.json({ data: {}, error: null });

  const hits = await ftsRecords(q, 30);
  const items = hits.map((h) => ({ type: h.resourceType, id: h.resourceId }));
  const resolved = await resolveResourceTitles(items);

  // clearance filter for documents
  const docIds = resolved.filter((r) => r.type === "document").map((r) => r.id);
  const allowedDocs = new Set<string>();
  if (docIds.length) {
    const docs = await db
      .select({
        id: schema.documents.id,
        cls: schema.documents.classificationLevel,
        dept: schema.documents.departmentId,
        deleted: schema.documents.deletedAt,
      })
      .from(schema.documents)
      .where(inArray(schema.documents.id, docIds));
    for (const d of docs) {
      if (!d.deleted && canReadResource(user, { classificationLevel: d.cls, departmentId: d.dept }))
        allowedDocs.add(d.id);
    }
  }

  const groups: Record<string, { type: string; id: string; title: string }[]> = {};
  for (const r of resolved) {
    if (r.type === "document" && !allowedDocs.has(r.id)) continue;
    const title = locale === "ar" ? r.titleAr || r.titleEn : r.titleEn || r.titleAr;
    if (!title) continue;
    (groups[r.type] ??= []);
    if (groups[r.type].length < 4) groups[r.type].push({ type: r.type, id: r.id, title });
  }
  return NextResponse.json({ data: groups, error: null });
}
