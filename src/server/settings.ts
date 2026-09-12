import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";

export type AiSettings = {
  mockMode: boolean;
  modelDefault: string;
  modelBrief: string;
  modelFast: string;
  temperature: number;
  maxSources: number;
  allowSecretInAnswers: boolean;
  dailyTokenBudget: number;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  mockMode: false,
  modelDefault: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
  modelBrief: "claude-opus-4-6",
  modelFast: "claude-haiku-4-5",
  temperature: 0.3,
  maxSources: 8,
  allowSecretInAnswers: false,
  dailyTokenBudget: 2_000_000,
};

const cacheStore = new Map<string, { value: unknown; at: number }>();
const TTL = 10_000;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cacheStore.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  let value: T = fallback;
  if (rows.length) {
    try {
      const parsed = JSON.parse(rows[0].valueJson);
      // arrays are returned as-is; objects merge over the fallback's defaults
      value = Array.isArray(parsed)
        ? (parsed as T)
        : ({ ...(fallback as object), ...parsed } as T);
    } catch {
      value = fallback;
    }
  }
  cacheStore.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  const existing = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  if (existing.length) {
    await db
      .update(schema.settings)
      .set({ valueJson: json })
      .where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, valueJson: json });
  }
  cacheStore.delete(key);
}

export async function getAiSettings(): Promise<AiSettings> {
  return getSetting<AiSettings>("ai", DEFAULT_AI_SETTINGS);
}

export type FeatureFlags = {
  gamification: boolean;
  gapRadar: boolean;
  signalScanner: boolean;
  numeralsDefault: "western" | "eastern";
};

export const DEFAULT_FLAGS: FeatureFlags = {
  gamification: true,
  gapRadar: false,
  signalScanner: false,
  numeralsDefault: "western",
};

export async function getFlags(): Promise<FeatureFlags> {
  return getSetting<FeatureFlags>("flags", DEFAULT_FLAGS);
}
