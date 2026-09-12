// Re-embeds any chunks or records not in the primary (Voyage) vector space.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema, rawClient } = await import("../src/server/db/client");
  const { embedTexts, float32ToBuffer, embeddingModelName } = await import(
    "../src/server/ai/embeddings"
  );
  const { ne, eq, or, isNull } = await import("drizzle-orm");
  const target = embeddingModelName();

  const chunks = await db
    .select({ id: schema.documentChunks.id, text: schema.documentChunks.text })
    .from(schema.documentChunks)
    .where(
      or(isNull(schema.documentChunks.embeddingModel), ne(schema.documentChunks.embeddingModel, target))
    );
  console.log(`re-embedding ${chunks.length} chunks to ${target}`);
  for (let i = 0; i < chunks.length; i += 48) {
    const batch = chunks.slice(i, i + 48);
    const { vectors, model } = await embedTexts(batch.map((b) => b.text));
    if (model !== target) throw new Error(`provider fell back to ${model}; aborting`);
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.documentChunks)
        .set({ embedding: float32ToBuffer(vectors[j]), embeddingModel: model })
        .where(eq(schema.documentChunks.id, batch[j].id));
    }
  }

  const records = await db
    .select({ id: schema.searchIndex.id, text: schema.searchIndex.text })
    .from(schema.searchIndex)
    .where(or(isNull(schema.searchIndex.embeddingModel), ne(schema.searchIndex.embeddingModel, target)));
  console.log(`re-embedding ${records.length} records to ${target}`);
  for (let i = 0; i < records.length; i += 48) {
    const batch = records.slice(i, i + 48);
    const { vectors, model } = await embedTexts(batch.map((b) => b.text));
    if (model !== target) throw new Error(`provider fell back to ${model}; aborting`);
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.searchIndex)
        .set({ embedding: float32ToBuffer(vectors[j]), embeddingModel: model })
        .where(eq(schema.searchIndex.id, batch[j].id));
    }
  }
  console.log("done");
  rawClient.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
