import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/server/db/client";

export type TermLite = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  dimension: string;
};

export const getAllTerms = cache(async (): Promise<TermLite[]> => {
  const rows = await db
    .select({
      id: schema.taxonomyTerms.id,
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
      dimension: schema.taxonomyDimensions.code,
      isActive: schema.taxonomyTerms.isActive,
      sort: schema.taxonomyTerms.sort,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .orderBy(schema.taxonomyTerms.sort);
  return rows.filter((r) => r.isActive === 1);
});

export async function termsByDimension(): Promise<Record<string, TermLite[]>> {
  const all = await getAllTerms();
  const grouped: Record<string, TermLite[]> = {};
  for (const t of all) {
    (grouped[t.dimension] ??= []).push(t);
  }
  return grouped;
}

export async function termByCode(dimension: string, code: string): Promise<TermLite | null> {
  const all = await getAllTerms();
  return all.find((t) => t.dimension === dimension && t.code === code) ?? null;
}

export const getDepartmentsLite = cache(async () => {
  return db
    .select({
      id: schema.departments.id,
      code: schema.departments.code,
      nameEn: schema.departments.nameEn,
      nameAr: schema.departments.nameAr,
    })
    .from(schema.departments);
});
