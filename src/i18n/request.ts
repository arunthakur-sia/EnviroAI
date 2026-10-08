import fs from "node:fs";
import path from "node:path";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Deep merge: later files add keys and override leaves, objects merge. */
export function deepMerge(base: Json, extra: Json): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k] as Json, v) : v;
  }
  return out;
}

const MESSAGES_DIR = path.join(process.cwd(), "messages");

/** Every messages/ksa-<name>.<locale>.json, sorted by name so the merge order
    is stable. A missing directory, an unreadable file or invalid JSON is
    skipped: the base messages always load. */
export function ksaMessageFiles(locale: string): string[] {
  try {
    const suffix = `.${locale}.json`;
    return fs
      .readdirSync(MESSAGES_DIR)
      .filter((f) => f.startsWith("ksa-") && f.endsWith(suffix))
      .sort()
      .map((f) => path.join(MESSAGES_DIR, f));
  } catch {
    return [];
  }
}

export function loadKsaMessages(locale: string): Json {
  let merged: Json = {};
  for (const file of ksaMessageFiles(locale)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
      if (isObject(parsed)) merged = deepMerge(merged, parsed);
    } catch {
      /* tolerate a half-written or missing file */
    }
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../../messages/${locale}.json`)).default as Json;
  return {
    locale,
    messages: deepMerge(base, loadKsaMessages(locale)),
  };
});
