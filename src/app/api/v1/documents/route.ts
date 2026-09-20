// POST: multipart upload -> draft document + parse + AI enrichment + duplicate check.
// GET: list documents (JSON API mirror of the Vault page).
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { isAllowedUpload, put } from "@/server/storage";
import { parseDocument, mimeFromFilename } from "@/server/ingest/parse";
import { enrichContent } from "@/server/ai";
import { getAllTerms } from "@/server/services/taxonomy";
import { embedQuery } from "@/server/ai/embeddings";
import { searchSimilarRecords } from "@/server/search/vector";
import { audit } from "@/server/auth/audit";
import { listDocuments, toShelfDocs } from "@/server/services/documents";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const { documents, nextCursor } = await listDocuments(user, {
    q: sp.get("q") ?? undefined,
    knowledgeType: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    sort: (sp.get("sort") as never) ?? undefined,
    limit: Number(sp.get("limit") ?? 60),
    cursor: Number(sp.get("cursor") ?? 0),
  });
  return NextResponse.json({
    data: await toShelfDocs(documents),
    error: null,
    meta: { nextCursor },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "vault")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ data: null, error: "file_required" }, { status: 400 });
  }
  // CR08 Phase A: refuse what the product cannot read, before storing it
  if (!isAllowedUpload(file.name)) {
    return NextResponse.json({ data: null, error: "file_type_not_allowed" }, { status: 415 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 100 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: "file_too_large" }, { status: 413 });
  }
  const mime = file.type || mimeFromFilename(file.name);
  const documentId = newId();
  const storagePath = await put(documentId, file.name, buf);

  const parsed = await parseDocument(buf, file.name, mime);

  // enrichment (live model or deterministic mock)
  const terms = await getAllTerms();
  const enrichment = await enrichContent({
    filename: file.name,
    text: parsed.text,
    pages: parsed.pages,
    lang: parsed.lang,
    terms: terms.map((t) => ({
      code: t.code,
      nameEn: t.nameEn,
      nameAr: t.nameAr,
      dimension: t.dimension,
    })),
    sourceOrigin: "npc",
  });

  // duplicate detection: the new document's opening text against existing chunks.
  // Re-uploading the same file makes near-identical chunks (similarity ~0.99).
  let duplicate: { id: string; titleEn: string; titleAr: string; similarity: number } | null = null;
  try {
    const { chunkDocument } = await import("@/server/ingest/chunker");
    const firstChunks = chunkDocument(parsed).slice(0, 2);
    const probeText = firstChunks.map((c) => c.text).join("\n").slice(0, 6000) || file.name;
    const { embedTexts } = await import("@/server/ai/embeddings");
    const { searchSimilarChunks } = await import("@/server/search/vector");
    const { vectors } = await embedTexts([probeText], "document");
    const hits = await searchSimilarChunks(
      vectors[0],
      { maxClassification: user.clearanceLevel },
      3
    );
    const best = hits.find((h) => h.score >= 0.92);
    if (best) {
      const [dup] = await db
        .select({ id: schema.documents.id, titleEn: schema.documents.titleEn, titleAr: schema.documents.titleAr })
        .from(schema.documents)
        .where(eq(schema.documents.id, best.documentId))
        .limit(1);
      if (dup) duplicate = { ...dup, similarity: best.score };
    }
  } catch {
    /* duplicate detection is best-effort */
  }

  const versionId = newId();
  await db.insert(schema.documents).values({
    id: documentId,
    titleEn: enrichment.title_en || file.name,
    titleAr: enrichment.title_ar || "",
    titleArMachine: enrichment.machine && enrichment.title_ar ? 1 : 0,
    summaryEn: enrichment.summary_en || null,
    summaryAr: enrichment.summary_ar || null,
    summaryMachine: enrichment.machine ? 1 : 0,
    keyFactsJson: JSON.stringify(enrichment.key_facts ?? []),
    classificationLevel: enrichment.classification_level ?? 2,
    departmentId: user.departmentId,
    ownerUserId: user.id,
    languageOriginal: parsed.lang,
    status: "draft",
    sourceOrigin: "npc",
    publishYear: enrichment.publish_year,
    originalFilename: file.name,
    mime,
    sizeBytes: buf.length,
    pageCount: parsed.pageCount,
    storagePath,
    currentVersionId: versionId,
    isSeeded: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await db.insert(schema.documentVersions).values({
    id: versionId,
    documentId,
    versionNo: 1,
    storagePath,
    uploadedBy: user.id,
    createdAt: nowIso(),
  });
  await audit(user.id, "create", "document", documentId, { filename: file.name, draft: true });

  // related documents by similarity (top 3)
  let related: { id: string; titleEn: string; titleAr: string }[] = [];
  try {
    const { vector } = await embedQuery(parsed.text.slice(0, 1200) || file.name);
    const hits = await searchSimilarRecords(
      vector,
      { maxClassification: user.clearanceLevel, resourceTypes: ["document"] },
      4
    );
    const ids = hits.map((h) => h.resourceId).filter((id) => id !== documentId).slice(0, 3);
    if (ids.length) {
      const { inArray } = await import("drizzle-orm");
      related = await db
        .select({ id: schema.documents.id, titleEn: schema.documents.titleEn, titleAr: schema.documents.titleAr })
        .from(schema.documents)
        .where(inArray(schema.documents.id, ids));
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    data: {
      documentId,
      parsed: { pageCount: parsed.pageCount, lang: parsed.lang, tables: parsed.tables.length },
      enrichment,
      duplicate,
      related,
    },
    error: null,
  });
}
