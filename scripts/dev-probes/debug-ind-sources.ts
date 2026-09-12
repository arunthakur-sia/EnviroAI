import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { searchSimilarRecords } = await import("../../src/server/search/vector");
  const { ftsRecords } = await import("../../src/server/search/fts");
  const { embedQuery } = await import("../../src/server/ai/embeddings");
  const { db, schema, rawClient } = await import("../../src/server/db/client");
  const { inArray } = await import("drizzle-orm");

  const query = "كم بلغ معدل التضخم في قطر مؤخراً؟";
  const { vector } = await embedQuery(query);
  const keywordQuery = query
    .split(/\s+/)
    .filter((t) => t.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
    .join(" ");
  console.log("keywordQuery:", keywordQuery);
  const [vecHits, ftsHits] = await Promise.all([
    searchSimilarRecords(vector, { maxClassification: 4, resourceTypes: ["indicator"] }, 200),
    ftsRecords(keywordQuery, 60),
  ]);
  console.log("vec hits:", vecHits.length, "fts hits:", ftsHits.length);
  const keywordIds = new Set(
    ftsHits.filter((h) => h.resourceType === "indicator").map((h) => h.resourceId)
  );
  console.log("keyword indicator ids:", keywordIds.size);
  const vecById = new Map(vecHits.map((h) => [h.resourceId, h.score]));
  const candidateIds = new Set([...vecById.keys(), ...keywordIds]);
  const scored = [...candidateIds]
    .map((id) => {
      const cosine = vecById.get(id) ?? 0;
      return { id, cosine, score: cosine + (keywordIds.has(id) ? 0.2 : 0) };
    })
    .filter((h) => h.cosine >= 0.32 || keywordIds.has(h.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const rows = await db
    .select({ id: schema.indicators.id, nameEn: schema.indicators.nameEn })
    .from(schema.indicators)
    .where(inArray(schema.indicators.id, scored.map((s) => s.id)));
  const nameById = new Map(rows.map((r) => [r.id, r.nameEn]));
  for (const s of scored) {
    console.log(
      `${(nameById.get(s.id) ?? s.id).slice(0, 45).padEnd(45)} cosine=${s.cosine.toFixed(3)} kw=${keywordIds.has(s.id)} score=${s.score.toFixed(3)}`
    );
  }
  rawClient.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
