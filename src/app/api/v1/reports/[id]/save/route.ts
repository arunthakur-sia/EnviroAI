// CR02 7.4: "Save to Vault": the report becomes a searchable, citable Vault
// document of type report with the scope recorded in key_facts.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { resolveDataPath } from "@/server/paths";
import { newId, nowIso } from "@/lib/ids";
import { put } from "@/server/storage";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!row || row.createdBy !== user.id || !row.filePath || row.status !== "done") {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  if (row.vaultDocumentId) {
    return NextResponse.json({ data: { documentId: row.vaultDocumentId }, error: null });
  }
  let buf: Buffer;
  try {
    buf = await fs.readFile(resolveDataPath(row.filePath));
  } catch {
    return NextResponse.json({ data: null, error: "file_missing" }, { status: 404 });
  }
  const scope = JSON.parse(row.scopeJson) as {
    kind: string;
    labelEn: string;
    labelAr: string;
    ids: string[];
  };
  // knowledge type: report
  const [dim] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  const [reportTerm] = dim
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(
          and(eq(schema.taxonomyTerms.dimensionId, dim.id), eq(schema.taxonomyTerms.code, "report"))
        )
        .limit(1)
    : [];

  const documentId = newId();
  const filename = `${row.title.replace(/[^\w؀-ۿ -]+/g, "").slice(0, 60) || "report"}.docx`;
  const storagePath = await put(documentId, filename, buf);
  const versionId = newId();
  await db.insert(schema.documents).values({
    id: documentId,
    titleEn: row.title,
    titleAr: row.title,
    titleArMachine: 0,
    summaryEn: `Extracted knowledge report on ${scope.labelEn}.`,
    summaryAr: `تقرير معرفي مستخرج عن ${scope.labelAr || scope.labelEn}.`,
    summaryMachine: 0,
    keyFactsJson: JSON.stringify([
      { text_en: `Report scope: ${scope.kind} · ${scope.labelEn}`, text_ar: `نطاق التقرير: ${scope.kind} · ${scope.labelAr || scope.labelEn}`, page: 1 },
      { text_en: `Scope ids: ${scope.ids.join(", ") || "filters"}`, text_ar: `معرفات النطاق: ${scope.ids.join(", ") || "مرشحات"}`, page: 1 },
    ]),
    knowledgeTypeTermId: reportTerm?.id ?? null,
    classificationLevel: row.classificationLevel,
    departmentId: user.departmentId,
    ownerUserId: user.id,
    languageOriginal: row.language === "ar" ? "ar" : "en",
    status: "under_review",
    sourceOrigin: "npc",
    publishYear: Number(nowIso().slice(0, 4)),
    originalFilename: filename,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: buf.length,
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
    note: `Extracted report ${row.id}`,
    createdAt: nowIso(),
  });
  await db
    .update(schema.reports)
    .set({ vaultDocumentId: documentId })
    .where(eq(schema.reports.id, id));
  await enqueue("ingest_document", { documentId });
  await audit(user.id, "create", "document", documentId, { fromReport: row.id });
  return NextResponse.json({ data: { documentId }, error: null });
}
