// Deterministic local fallback embedder: feature-hashed word and character n-grams,
// L2-normalised, 256 dimensions. Used only when VOYAGE_API_KEY is absent so that
// search never breaks. Not cross-lingual; the Voyage provider is the real one.
const DIM = 256;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const LOCAL_MODEL_NAME = "local-hash-256";

export function localEmbed(text: string): Float32Array {
  const v = new Float32Array(DIM);
  const norm = text
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "") // Arabic diacritics
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = norm.split(" ").filter((w) => w.length > 1);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    v[hash("w:" + w) % DIM] += 2;
    if (i + 1 < words.length) v[hash("b:" + w + "_" + words[i + 1]) % DIM] += 1.5;
    for (let j = 0; j + 3 <= w.length; j++) {
      v[hash("c:" + w.slice(j, j + 3)) % DIM] += 1;
    }
  }
  let len = 0;
  for (let i = 0; i < DIM; i++) len += v[i] * v[i];
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= len;
  return v;
}
