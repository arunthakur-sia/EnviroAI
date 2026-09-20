// Ingest pipeline: parse -> chunk -> embed -> index. Used by the upload flow,
// the job worker, and the seed.
// CR08 Phase B: the document parsers (pdf, docx, xlsx) must never be pulled
// into a browser bundle; importing this from a client component now fails the
// build instead of shipping megabytes.
import "@/server/server-only";
import { eq, isNull, and } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { get as storageGet, putText } from "@/server/storage";
import { parseDocument } from "./parse";
import { chunkDocument } from "./chunker";
import { embedTexts, float32ToBuffer } from "@/server/ai/embeddings";
import { translateFields } from "@/server/ai";
import { newId, nowIso } from "@/lib/ids";
import { enqueue } from "@/server/jobs/queue";

/** Parses the stored file, rebuilds chunks, embeds them, and indexes the document. */
export async function runIngest(
  documentId: string,
  opts: { skipEmbed?: boolean } = {}
): Promise<void> {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc || !doc.storagePath) return;

  const buf = await storageGet(doc.storagePath);
  const parsed = await parseDocument(buf, doc.originalFilename || "file", doc.mime || undefined);

  const textPath = await putText(documentId, "extracted.txt", parsed.text.slice(0, 2_000_000));
  if (parsed.html) await putText(documentId, "extracted.html", parsed.html);

  await db
    .update(schema.documents)
    .set({
      pageCount: parsed.pageCount,
      textPath,
      languageOriginal: doc.languageOriginal || parsed.lang,
      updatedAt: nowIso(),
    })
    .where(eq(schema.documents.id, documentId));

  // store detected tables
  await db.delete(schema.documentTables).where(eq(schema.documentTables.documentId, documentId));
  for (const t of parsed.tables.slice(0, 20)) {
    await db.insert(schema.documentTables).values({
      id: newId(),
      documentId,
      page: t.page,
      caption: t.caption,
      columnsJson: JSON.stringify(t.columns.slice(0, 60)),
      rowsJson: JSON.stringify(t.rows.slice(0, 500)),
    });
  }

  // rebuild chunks
  await db.delete(schema.documentChunks).where(eq(schema.documentChunks.documentId, documentId));
  const chunks = chunkDocument(parsed);
  for (const c of chunks) {
    await db.insert(schema.documentChunks).values({
      id: newId(),
      documentId,
      versionId: doc.currentVersionId,
      chunkIndex: c.index,
      pageFrom: c.pageFrom,
      pageTo: c.pageTo,
      heading: c.heading,
      text: c.text,
      lang: c.lang,
      tokenCount: c.tokenCount,
      embedding: null,
      embeddingModel: null,
    });
  }

  if (!opts.skipEmbed) {
    await embedDocumentChunks(documentId);
  }
  await enqueue("embed_records", { resourceType: "document", resourceId: documentId });
}

/** Embeds every chunk of the document that is missing a vector. Batched. */
export async function embedDocumentChunks(documentId: string): Promise<void> {
  const rows = await db
    .select({ id: schema.documentChunks.id, text: schema.documentChunks.text })
    .from(schema.documentChunks)
    .where(
      and(
        eq(schema.documentChunks.documentId, documentId),
        isNull(schema.documentChunks.embedding)
      )
    );
  for (let i = 0; i < rows.length; i += 64) {
    const batch = rows.slice(i, i + 64);
    const { vectors, model } = await embedTexts(batch.map((b) => b.text));
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.documentChunks)
        .set({ embedding: float32ToBuffer(vectors[j]), embeddingModel: model })
        .where(eq(schema.documentChunks.id, batch[j].id));
    }
  }
}

/** Fills in the missing language of title/summary via AI translation; flags as machine. */
export async function translateDocumentFields(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc) return;
  const fields: { key: string; text: string }[] = [];
  let from: "en" | "ar" = "en";
  let to: "en" | "ar" = "ar";
  if (doc.titleEn && !doc.titleAr) {
    fields.push({ key: "title", text: doc.titleEn });
    if (doc.summaryEn && !doc.summaryAr) fields.push({ key: "summary", text: doc.summaryEn });
  } else if (doc.titleAr && !doc.titleEn) {
    from = "ar";
    to = "en";
    fields.push({ key: "title", text: doc.titleAr });
    if (doc.summaryAr && !doc.summaryEn) fields.push({ key: "summary", text: doc.summaryAr });
  } else if (doc.summaryEn && !doc.summaryAr) {
    fields.push({ key: "summary", text: doc.summaryEn });
  } else if (doc.summaryAr && !doc.summaryEn) {
    from = "ar";
    to = "en";
    fields.push({ key: "summary", text: doc.summaryAr });
  }
  if (!fields.length) return;
  const translated = await translateFields(fields, from, to);
  if (!translated) return; // mock mode: leave original with "Original language" chip
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  for (const t of translated) {
    if (t.key === "title") {
      if (to === "ar") {
        patch.titleAr = t.text;
        patch.titleArMachine = 1;
      } else {
        patch.titleEn = t.text;
      }
    }
    if (t.key === "summary") {
      if (to === "ar") patch.summaryAr = t.text;
      else patch.summaryEn = t.text;
      patch.summaryMachine = 1;
    }
  }
  await db.update(schema.documents).set(patch).where(eq(schema.documents.id, documentId));
}
