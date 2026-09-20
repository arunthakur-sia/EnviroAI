// CR08 2.2: the Studies page. Documents whose knowledge type is study,
// research or evaluation, read from Institutional Memory with the same
// clearance, department-scope and visibility rules as the library, shaped
// for a designed listing: a featured study, filter facets (type, topic,
// outcome, year) and a shelf per year.
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { canSeeDocument } from "@/server/auth/permissions";
import { toShelfDocs } from "@/server/services/documents";
import type { ShelfDoc } from "@/components/nexus/Shelf";

export const STUDY_TYPE_CODES = ["study", "research", "evaluation"] as const;
export type StudyTypeCode = (typeof STUDY_TYPE_CODES)[number];

/** Seeded illustrative studies carry this marker in `source_ref`. */
export const ILLUSTRATIVE_SOURCE_REF = "cr08-illustrative";

export type StudyTerm = { code: string; nameEn: string; nameAr: string };

export type StudyDoc = ShelfDoc & {
  topics: StudyTerm[];
  outcomes: StudyTerm[];
  departmentNameEn: string | null;
  departmentNameAr: string | null;
  illustrative: boolean;
  keyFacts: { text_en: string; text_ar: string; page: number | null }[];
  verifiedAt: string | null;
  createdAt: string;
};

export type StudyFilters = {
  type?: string;
  topic?: string;
  outcome?: string;
  year?: number;
  q?: string;
  limit?: number;
};

export type StudiesFacets = {
  types: (StudyTerm & { count: number })[];
  topics: (StudyTerm & { count: number })[];
  outcomes: (StudyTerm & { count: number })[];
  years: { year: number | null; count: number }[];
};

export type StudiesPage = {
  featured: StudyDoc | null;
  shelves: { year: number | null; docs: StudyDoc[] }[];
  facets: StudiesFacets;
  total: number;
  totalAll: number;
};

async function studyTypeTerms(): Promise<(StudyTerm & { id: string })[]> {
  const rows = await db
    .select({
      id: schema.taxonomyTerms.id,
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(schema.taxonomyDimensions, eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId))
    .where(
      and(
        eq(schema.taxonomyDimensions.code, "knowledge_type"),
        inArray(schema.taxonomyTerms.code, [...STUDY_TYPE_CODES])
      )
    );
  return rows;
}

function parseKeyFacts(raw: string | null): StudyDoc["keyFacts"] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f) => f && typeof f === "object")
      .map((f) => ({
        text_en: String(f.text_en ?? ""),
        text_ar: String(f.text_ar ?? ""),
        page: typeof f.page === "number" ? f.page : null,
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Every study the person may see, newest first, with its tags. */
export async function loadStudies(user: CurrentUser, limit = 300): Promise<StudyDoc[]> {
  const types = await studyTypeTerms();
  if (!types.length) return [];
  const typeIds = types.map((t) => t.id);

  const conds = [
    isNull(schema.documents.deletedAt),
    inArray(schema.documents.knowledgeTypeTermId, typeIds),
    sql`${schema.documents.classificationLevel} <= ${user.clearanceLevel}`,
  ];
  if (user.departmentScope === "own") {
    conds.push(
      or(
        isNull(schema.documents.departmentId),
        eq(schema.documents.departmentId, user.departmentId ?? "")
      )!
    );
  }
  const rows = (
    await db
      .select()
      .from(schema.documents)
      .where(and(...conds))
      .orderBy(desc(schema.documents.publishYear), desc(schema.documents.createdAt))
      .limit(Math.min(limit, 500))
  ).filter((d) => canSeeDocument(user, d));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [shelf, tags, units] = await Promise.all([
    toShelfDocs(rows),
    db
      .select({
        documentId: schema.taggings.resourceId,
        code: schema.taxonomyTerms.code,
        nameEn: schema.taxonomyTerms.nameEn,
        nameAr: schema.taxonomyTerms.nameAr,
        dimension: schema.taxonomyDimensions.code,
      })
      .from(schema.taggings)
      .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.taggings.termId))
      .innerJoin(schema.taxonomyDimensions, eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId))
      .where(and(eq(schema.taggings.resourceType, "document"), inArray(schema.taggings.resourceId, ids))),
    db
      .select({ id: schema.orgUnits.id, nameEn: schema.orgUnits.nameEn, nameAr: schema.orgUnits.nameAr })
      .from(schema.orgUnits),
  ]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const shelfById = new Map(shelf.map((s) => [s.id, s]));

  return rows.map((d) => {
    const own = tags.filter((t) => t.documentId === d.id);
    const dedupe = (list: typeof own) => {
      const seen = new Set<string>();
      return list.filter((t) => (seen.has(t.code) ? false : (seen.add(t.code), true)));
    };
    const unit = d.departmentId ? unitById.get(d.departmentId) : null;
    return {
      ...shelfById.get(d.id)!,
      topics: dedupe(own.filter((t) => t.dimension === "topic" || t.dimension === "sector")).map(
        ({ code, nameEn, nameAr }) => ({ code, nameEn, nameAr })
      ),
      outcomes: dedupe(own.filter((t) => t.dimension === "outcome")).map(({ code, nameEn, nameAr }) => ({
        code,
        nameEn,
        nameAr,
      })),
      departmentNameEn: unit?.nameEn ?? null,
      departmentNameAr: unit?.nameAr ?? null,
      illustrative: d.sourceRef === ILLUSTRATIVE_SOURCE_REF,
      keyFacts: parseKeyFacts(d.keyFactsJson),
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    };
  });
}

export function applyStudyFilters(docs: StudyDoc[], filters: StudyFilters): StudyDoc[] {
  let out = docs;
  if (filters.type) out = out.filter((d) => d.typeCode === filters.type);
  if (filters.topic) out = out.filter((d) => d.topics.some((t) => t.code === filters.topic));
  if (filters.outcome) out = out.filter((d) => d.outcomes.some((t) => t.code === filters.outcome));
  if (filters.year) out = out.filter((d) => d.publishYear === filters.year);
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    out = out.filter(
      (d) =>
        d.titleEn.toLowerCase().includes(needle) ||
        d.titleAr.includes(filters.q!) ||
        (d.summaryEn ?? "").toLowerCase().includes(needle) ||
        (d.summaryAr ?? "").includes(filters.q!)
    );
  }
  return filters.limit ? out.slice(0, filters.limit) : out;
}

/** The API and the Ask NPC tool read through this. */
export async function listStudies(user: CurrentUser, filters: StudyFilters = {}): Promise<StudyDoc[]> {
  return applyStudyFilters(await loadStudies(user), filters);
}

function facetsOf(docs: StudyDoc[]): StudiesFacets {
  const count = <T extends StudyTerm>(pick: (d: StudyDoc) => T[]) => {
    const map = new Map<string, T & { count: number }>();
    for (const d of docs) {
      for (const term of pick(d)) {
        const cur = map.get(term.code) ?? { ...term, count: 0 };
        cur.count++;
        map.set(term.code, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.nameEn.localeCompare(b.nameEn));
  };
  const years = new Map<number | null, number>();
  for (const d of docs) years.set(d.publishYear ?? null, (years.get(d.publishYear ?? null) ?? 0) + 1);
  return {
    types: count((d) =>
      d.typeCode ? [{ code: d.typeCode, nameEn: d.typeNameEn ?? d.typeCode, nameAr: d.typeNameAr ?? d.typeCode }] : []
    ),
    topics: count((d) => d.topics),
    outcomes: count((d) => d.outcomes),
    years: [...years.entries()]
      .map(([year, c]) => ({ year, count: c }))
      .sort((a, b) => (b.year ?? -1) - (a.year ?? -1)),
  };
}

/** One call for /studies: the featured study, the facets, a shelf per year. */
export async function getStudiesPage(user: CurrentUser, filters: StudyFilters): Promise<StudiesPage> {
  const all = await loadStudies(user);
  const docs = applyStudyFilters(all, filters);

  // the featured study is the latest verified one among what is shown
  const featured =
    [...docs]
      .filter((d) => d.status === "verified")
      .sort((a, b) => (b.verifiedAt ?? b.createdAt).localeCompare(a.verifiedAt ?? a.createdAt))[0] ?? null;

  const byYear = new Map<number | null, StudyDoc[]>();
  for (const d of docs) {
    const key = d.publishYear ?? null;
    (byYear.get(key) ?? byYear.set(key, []).get(key)!).push(d);
  }
  const shelves = [...byYear.entries()]
    .map(([year, list]) => ({ year, docs: list }))
    .sort((a, b) => (b.year ?? -1) - (a.year ?? -1));

  return { featured, shelves, facets: facetsOf(all), total: docs.length, totalAll: all.length };
}
