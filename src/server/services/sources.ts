// EnviroAI Source Library: the KSA environment, water and agriculture data
// source databank, as a searchable catalogue. Read-only. Rows are seeded from
// the databank by scripts/ksa-seed.ts; Arabic fields stay empty where the
// databank has none and the reader falls back to English.
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";

import {
  SOURCE_CATEGORIES,
  type AccessTag,
  type SourceCategory,
  type SourceFilters,
  type SourceItem,
  type SourceVerification,
  type SourcesPage,
  type VerificationItem,
} from "./sources-types";

export * from "./sources-types";

function parseTags(raw: string | null): AccessTag[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((t): t is AccessTag => t === "free" || t === "registration" || t === "paid") : [];
  } catch {
    return [];
  }
}
function parseIds(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function isCategory(v: string | null | undefined): v is SourceCategory {
  return Boolean(v) && (SOURCE_CATEGORIES as readonly string[]).includes(v as string);
}

/** Case-insensitive match across every text field a reader would search. */
function matches(s: SourceItem, q: string): boolean {
  const hay = [s.nameEn, s.nameAr, s.organizationEn, s.organizationAr, s.subCategoryEn, s.subCategoryAr, s.formats, s.languages, s.access, s.notesEn, s.notesAr, s.mainUrl, s.dataUrl]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export async function getSourcesPage(filters: SourceFilters = {}): Promise<SourcesPage> {
  const [rows, notes] = await Promise.all([
    db.select().from(schema.ksaSources).orderBy(asc(schema.ksaSources.category), asc(schema.ksaSources.sortOrder)),
    db.select().from(schema.ksaVerificationNotes).orderBy(asc(schema.ksaVerificationNotes.sortOrder)),
  ]);
  const verification: VerificationItem[] = notes.map((n) => ({
    id: n.id,
    item: n.item,
    tab: n.tab,
    category: isCategory(n.category) ? n.category : null,
    issue: n.issue,
    action: n.action,
    sourceIds: parseIds(n.sourceIdsJson),
  }));
  const flagsBySource = new Map<string, SourceVerification[]>();
  for (const v of verification) {
    for (const sid of v.sourceIds) {
      const list = flagsBySource.get(sid) ?? [];
      list.push({ id: v.id, issue: v.issue, action: v.action });
      flagsBySource.set(sid, list);
    }
  }
  const all: SourceItem[] = rows
    .filter((r) => isCategory(r.category))
    .map((r) => ({
      id: r.id,
      category: r.category as SourceCategory,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      organizationEn: r.organizationEn,
      organizationAr: r.organizationAr,
      subCategoryEn: r.subCategoryEn,
      subCategoryAr: r.subCategoryAr,
      mainUrl: r.mainUrl,
      dataUrl: r.dataUrl,
      dataHint: r.dataHint,
      formats: r.formats,
      languages: r.languages,
      access: r.access,
      accessTags: parseTags(r.accessTags),
      unverified: r.unverified === 1,
      notesEn: r.notesEn,
      notesAr: r.notesAr,
      flags: flagsBySource.get(r.id) ?? [],
    }));

  const counts = {
    all: all.length,
    flagged: all.filter((s) => s.flags.length > 0 || s.unverified).length,
    verification: verification.length,
    regulatory: 0,
    scientific: 0,
    initiatives: 0,
    portals: 0,
    indices: 0,
  };
  for (const s of all) counts[s.category]++;

  let items = all;
  if (isCategory(filters.category)) items = items.filter((s) => s.category === filters.category);
  if (filters.access && ["free", "registration", "paid"].includes(filters.access)) {
    items = items.filter((s) => s.accessTags.includes(filters.access as AccessTag));
  }
  if (filters.flagged) items = items.filter((s) => s.flags.length > 0 || s.unverified);
  const q = filters.q?.trim();
  if (q) items = items.filter((s) => matches(s, q));
  return { items, verification, counts };
}

export async function getSourceById(id: string): Promise<SourceItem | null> {
  const [row] = await db.select({ id: schema.ksaSources.id }).from(schema.ksaSources).where(eq(schema.ksaSources.id, id)).limit(1);
  if (!row) return null;
  const page = await getSourcesPage();
  return page.items.find((s) => s.id === id) ?? null;
}
