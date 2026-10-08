/* eslint-disable no-console */
// CR06 4 seeds: one department owner per NES theme (a department-kind
// lead row on the outcome node, from the CR05 department pools) and two
// directly assigned experts per outcome (node_stakeholders rows with the
// theme as node_id), preferring experts whose domains match the theme's
// taxonomy term. Deterministic and idempotent; run standalone
// (npx tsx scripts/cr06-seed.ts) or from seed.ts block 12f.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import { OUTCOME_DEPTS, EXPERT_NOTES } from "./cr05-seed";
import { findHomeEdition } from "./data/edition";

const now = () => new Date().toISOString();

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export async function seedCr06OutcomeStakeholders(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { outcomeNodeMap } = await import("../src/server/scan/extract");

  const edition = await findHomeEdition(db, schema);
  if (!edition) {
    console.log("cr06: no strategy edition; skipping");
    return;
  }
  const outcomes = await db
    .select()
    .from(schema.strategyNodes)
    .where(
      and(
        eq(schema.strategyNodes.editionId, edition.id),
        eq(schema.strategyNodes.nodeType, "outcome")
      )
    )
    .orderBy(asc(schema.strategyNodes.sort));
  const outcomeIds = outcomes.map((o) => o.id);
  const numberOf = (o: (typeof outcomes)[number]): number => {
    const m = /(\d+)/.exec(o.code ?? "");
    if (m) return Math.min(7, Math.max(1, Number(m[1])));
    return Math.min(7, (o.sort ?? 0) + 1);
  };

  /* 0. every department needs a head for the owner card: fill the missing
     ones deterministically from that department's own people (named accounts
     over the shared role logins) */
  const departments = await db.select().from(schema.departments);
  const deptByCode = new Map(departments.map((d) => [d.code, d]));
  const users = await db.select().from(schema.users);
  const alive = users.filter((u) => !u.deletedAt);
  const ROLE_LOGINS = new Set([
    "admin@enviroai.demo",
    "knowledge@enviroai.demo",
    "verifier@enviroai.demo",
    "analyst@enviroai.demo",
    "reader@enviroai.demo",
    "hr@enviroai.demo",
  ]);
  let headsSet = 0;
  for (const d of departments) {
    if (d.headUserId) continue;
    const own = alive.filter((u) => u.departmentId === d.id);
    const pool = own.filter((u) => !ROLE_LOGINS.has(u.email));
    const pick = (pool.length ? pool : own).sort((a, b) => a.email.localeCompare(b.email))[
      hashOf(d.id) % Math.max(1, (pool.length ? pool : own).length)
    ];
    if (!pick) continue;
    await db
      .update(schema.departments)
      .set({ headUserId: pick.id, updatedAt: now() })
      .where(eq(schema.departments.id, d.id));
    d.headUserId = pick.id;
    headsSet++;
  }
  if (headsSet) console.log(`cr06: ${headsSet} department heads filled in`);

  /* 1. one department owner per outcome */
  const ownerRows = outcomeIds.length
    ? await db
        .select()
        .from(schema.nodeLeads)
        .where(
          and(
            inArray(schema.nodeLeads.nodeId, outcomeIds),
            eq(schema.nodeLeads.leadKind, "department"),
            eq(schema.nodeLeads.role, "lead")
          )
        )
    : [];
  let owners = 0;
  for (const o of outcomes) {
    if (ownerRows.some((r) => r.nodeId === o.id)) continue;
    const codes = OUTCOME_DEPTS[numberOf(o)] ?? ["planning_policies"];
    const dept = deptByCode.get(codes[0]);
    if (!dept) continue;
    await db.insert(schema.nodeLeads).values({
      id: ulid(),
      nodeId: o.id,
      leadKind: "department",
      departmentId: dept.id,
      role: "lead",
      sort: 0,
      verified: 1,
      createdAt: now(),
    });
    owners++;
  }

  /* 2. two directly assigned experts per outcome */
  const existing = outcomeIds.length
    ? await db
        .select()
        .from(schema.nodeStakeholders)
        .where(
          and(
            inArray(schema.nodeStakeholders.nodeId, outcomeIds),
            eq(schema.nodeStakeholders.role, "expert")
          )
        )
    : [];
  const experts = await db.select().from(schema.experts);
  const domains = await db.select().from(schema.expertDomains);
  const domainsOf = new Map<string, string[]>();
  for (const d of domains) {
    (domainsOf.get(d.expertId) ?? domainsOf.set(d.expertId, []).get(d.expertId)!).push(d.termId);
  }
  const expertsWithDomains = experts.filter((e) => domainsOf.has(e.id));
  // the theme's taxonomy term, for domain-matched picks
  const taxMap = await outcomeNodeMap(); // tax code -> node id
  const taxOfNode = new Map<string, string>();
  for (const [tax, nodeId] of taxMap) taxOfNode.set(nodeId, tax);
  const terms = await db
    .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"));
  const termIdOfTax = new Map(terms.map((t) => [t.code, t.id]));

  let seeded = 0;
  for (const o of outcomes) {
    const have = existing.filter((r) => r.nodeId === o.id);
    if (have.length >= 2) continue;
    const tax = taxOfNode.get(o.id);
    const termId = tax ? termIdOfTax.get(tax) : undefined;
    const matched = termId
      ? expertsWithDomains.filter((e) => (domainsOf.get(e.id) ?? []).includes(termId))
      : [];
    const pool = matched.length >= 2 ? matched : expertsWithDomains.length ? expertsWithDomains : experts;
    if (!pool.length) continue;
    const h = hashOf(o.id);
    const picked = new Set(have.map((r) => r.expertId).filter(Boolean) as string[]);
    let salt = 0;
    for (let i = have.length; i < 2 && salt < pool.length + 8; salt++) {
      const ex = pool[(h + salt * 7919) % pool.length];
      if (picked.has(ex.id)) continue;
      picked.add(ex.id);
      const note = EXPERT_NOTES[(h + i) % EXPERT_NOTES.length];
      await db.insert(schema.nodeStakeholders).values({
        id: ulid(),
        nodeId: o.id,
        personKind: "expert",
        expertId: ex.id,
        role: "expert",
        roleNoteEn: note[0],
        roleNoteAr: note[1],
        domainTermId: termId ?? domainsOf.get(ex.id)?.[0] ?? null,
        sinceDate: "2024-09-01",
        sort: i,
        createdAt: now(),
      });
      seeded++;
      i++;
    }
  }
  console.log(
    `cr06 outcome stakeholders: ${owners} department owners set, ${seeded} direct experts added across ${outcomes.length} outcomes`
  );
}

export async function seedCr06(): Promise<void> {
  await seedCr06OutcomeStakeholders();
}

// standalone entry
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/cr06-seed.ts")) {
  seedCr06()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
