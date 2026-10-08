/* eslint-disable no-console */
// CR08 1: org_levels from the standard levels, a first snapshot, two sample
// change requests from the seeded department head. Owned by the Organisation
// agent. Idempotent: levels are upserted by code, the snapshot is only taken
// when none exists, and each request is matched on its text.
//   npx tsx scripts/cr08-org-seed.ts
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq } from "drizzle-orm";
import { ulid } from "ulid";

const now = () => new Date().toISOString();

/** The levels of the Programme Office structure, with formal bilingual names. The
    top level keeps its stored code; its label is the Programme Director. */
export const PUBLISHED_LEVELS = [
  { code: "secretary_general", nameEn: "Programme Director", nameAr: "مدير البرنامج" },
  { code: "sector", nameEn: "Sector", nameAr: "القطاع" },
  { code: "office", nameEn: "Office", nameAr: "المكتب" },
  { code: "department", nameEn: "Department", nameAr: "الإدارة" },
  { code: "section", nameEn: "Section", nameAr: "القسم" },
] as const;

const SAMPLE_REQUESTS = [
  {
    what: "Rename the unit to Data Systems and Platforms Department to reflect the platform work it now carries.",
    why: "The department has run the environmental data platforms since 2025 and its current name no longer describes the mandate.",
    status: "open" as const,
    daysAgo: 3,
  },
  {
    what: "Add a Data Engineering Section under the department with the four engineers who joined in Q2.",
    why: "The section exists in practice; recording it lets the HR dashboard and the handover process see the team.",
    status: "resolved" as const,
    daysAgo: 21,
  },
];

export default async function seedCr08Org(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { takeSnapshot } = await import("../src/server/services/organisation");

  /* 1. the levels */
  const existingLevels = await db.select().from(schema.orgLevels).orderBy(asc(schema.orgLevels.sort));
  let levelsWritten = 0;
  for (let i = 0; i < PUBLISHED_LEVELS.length; i++) {
    const level = PUBLISHED_LEVELS[i];
    const found = existingLevels.find((l) => l.code === level.code);
    if (found) {
      // names are the administrator's to edit; only the sort of an untouched
      // level is kept in published order
      continue;
    }
    await db.insert(schema.orgLevels).values({ id: ulid(), ...level, sort: i });
    levelsWritten++;
  }
  // any level a unit uses that the table does not know gets a row so the
  // editor never shows a unit without a level
  const units = await db.select().from(schema.orgUnits);
  const known = new Set((await db.select().from(schema.orgLevels)).map((l) => l.code));
  const strays = [...new Set(units.map((u) => u.level))].filter((code) => !known.has(code));
  for (const code of strays) {
    await db.insert(schema.orgLevels).values({
      id: ulid(),
      code,
      nameEn: code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      nameAr: code,
      sort: known.size + strays.indexOf(code),
    });
    levelsWritten++;
  }

  /* 2. the first snapshot */
  const snapshots = await db.select({ id: schema.orgSnapshots.id }).from(schema.orgSnapshots).limit(1);
  let snapshotTaken = false;
  if (!snapshots.length) {
    await takeSnapshot(null, "initial Programme Office structure (CR08 seed)");
    snapshotTaken = true;
  }

  /* 3. two sample change requests from the seeded department head */
  const [head] = await db
    .select({ id: schema.users.id, departmentId: schema.users.departmentId })
    .from(schema.users)
    .where(eq(schema.users.email, "head.stats@enviroai.demo"))
    .limit(1);
  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "admin@enviroai.demo"))
    .limit(1);
  let requestsWritten = 0;
  if (head?.departmentId) {
    for (const sample of SAMPLE_REQUESTS) {
      const [existing] = await db
        .select({ id: schema.orgChangeRequests.id })
        .from(schema.orgChangeRequests)
        .where(
          and(
            eq(schema.orgChangeRequests.requestedBy, head.id),
            eq(schema.orgChangeRequests.what, sample.what)
          )
        )
        .limit(1);
      if (existing) continue;
      const createdAt = new Date(Date.now() - sample.daysAgo * 86400000).toISOString();
      const resolved = sample.status === "resolved";
      await db.insert(schema.orgChangeRequests).values({
        id: ulid(),
        unitId: head.departmentId,
        requestedBy: head.id,
        what: sample.what,
        why: sample.why,
        status: sample.status,
        resolvedBy: resolved ? admin?.id ?? null : null,
        resolvedAt: resolved ? new Date(Date.now() - (sample.daysAgo - 2) * 86400000).toISOString() : null,
        createdAt,
      });
      requestsWritten++;
    }
  } else {
    console.log("cr08 org: head.stats@enviroai.demo has no department, change requests skipped");
  }

  console.log(
    `cr08 org: ${levelsWritten} levels written (${known.size} present), snapshot ${snapshotTaken ? "taken" : "already present"}, ${requestsWritten} change requests written at ${now().slice(0, 19)}`
  );
}

const isMain = process.argv[1] && /cr08-org-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Org()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
