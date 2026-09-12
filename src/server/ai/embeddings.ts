// Embedding provider: Voyage voyage-multilingual-2 when the key exists,
// otherwise the deterministic local embedder. One vector space per model;
// the model name is stored beside every vector.
import { localEmbed, LOCAL_MODEL_NAME } from "@/server/search/local-embedder";

export const VOYAGE_MODEL = "voyage-multilingual-2";

export function embeddingModelName(): string {
  return process.env.VOYAGE_API_KEY ? VOYAGE_MODEL : LOCAL_MODEL_NAME;
}

export function float32ToBuffer(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function bufferToFloat32(b: Buffer | Uint8Array): Float32Array {
  const buf = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/** Token-aware batching: Voyage caps a batch at 120k tokens; stay well under. */
function* voyageBatches(texts: string[]): Generator<{ start: number; batch: string[] }> {
  const MAX_ITEMS = 48;
  const MAX_CHARS = 280_000; // ~90k tokens at ~3.2 chars/token, safety margin
  let start = 0;
  while (start < texts.length) {
    const batch: string[] = [];
    let chars = 0;
    while (
      start + batch.length < texts.length &&
      batch.length < MAX_ITEMS &&
      chars < MAX_CHARS
    ) {
      const t = texts[start + batch.length].slice(0, 7000) || " ";
      batch.push(t);
      chars += t.length;
    }
    yield { start, batch };
    start += batch.length;
  }
}

async function voyageEmbed(
  texts: string[],
  inputType: "document" | "query"
): Promise<Float32Array[]> {
  const key = process.env.VOYAGE_API_KEY!;
  const out: Float32Array[] = [];
  for (const { batch } of voyageBatches(texts)) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ input: batch, model: VOYAGE_MODEL, input_type: inputType }),
        });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const json = (await res.json()) as { data: { embedding: number[] }[] };
        for (const d of json.data) out.push(Float32Array.from(d.embedding));
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (lastError) throw lastError;
  }
  return out;
}

export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<{ vectors: Float32Array[]; model: string }> {
  if (!texts.length) return { vectors: [], model: embeddingModelName() };
  if (process.env.VOYAGE_API_KEY) {
    try {
      const vectors = await voyageEmbed(texts, inputType);
      return { vectors, model: VOYAGE_MODEL };
    } catch (e) {
      console.error("[embeddings] voyage failed, using local fallback:", e);
    }
  }
  return { vectors: texts.map((t) => localEmbed(t)), model: LOCAL_MODEL_NAME };
}

export async function embedQuery(text: string): Promise<{ vector: Float32Array; model: string }> {
  const { vectors, model } = await embedTexts([text], "query");
  return { vector: vectors[0], model };
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}
