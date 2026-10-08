// The seeds used to look the national strategy edition up by a hard coded code.
// The edition now belongs to the tenant content, so the seeds ask for the
// default (live) edition instead, falling back to the one with the latest end.
import { desc, eq } from "drizzle-orm";

export async function findHomeEdition(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  schema: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<{ id: string; code: string; nameEn: string; nameAr: string; periodFrom: number; periodTo: number } | undefined> {
  const [def] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.isDefault, 1))
    .limit(1);
  if (def) return def;
  const [latest] = await db
    .select()
    .from(schema.strategyEditions)
    .orderBy(desc(schema.strategyEditions.periodTo))
    .limit(1);
  return latest;
}
