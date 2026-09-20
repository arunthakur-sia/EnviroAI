/* eslint-disable no-console */
// CR08 9.1 (strategy and council owner placement): the one piece of data the
// placement pass needs and the base seed does not carry, a custodian on the
// strategy KPIs. No column and no table is added: `kpis.owner_user_id` has
// existed since CR02 and was simply never filled.
//
// The custodian of a KPI is the head of the department that leads the node the
// KPI hangs on, which is who answers for the figure today. Only rows with no
// custodian are touched, so a hand-set custodian survives and a rerun writes
// nothing.
//   npx tsx scripts/cr08-owners-strategy-seed.ts
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, eq, isNull } from "drizzle-orm";

export default async function seedCr08OwnersStrategy(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");

  const [kpis, leadRows, departments, users] = await Promise.all([
    db.select().from(schema.kpis),
    db
      .select()
      .from(schema.nodeLeads)
      .where(and(eq(schema.nodeLeads.role, "lead"), eq(schema.nodeLeads.leadKind, "department"))),
    db.select().from(schema.departments),
    db.select({ id: schema.users.id, deletedAt: schema.users.deletedAt }).from(schema.users),
  ]);
  const depById = new Map(departments.map((d) => [d.id, d]));
  const alive = new Set(users.filter((u) => !u.deletedAt).map((u) => u.id));
  /* the first lead department recorded on a node, in insertion order */
  const leadDepOfNode = new Map<string, string>();
  for (const row of leadRows) {
    if (!row.departmentId) continue;
    if (!leadDepOfNode.has(row.nodeId)) leadDepOfNode.set(row.nodeId, row.departmentId);
  }

  let written = 0;
  let already = 0;
  let noHead = 0;
  for (const kpi of kpis) {
    if (kpi.ownerUserId) {
      already++;
      continue;
    }
    const depId = leadDepOfNode.get(kpi.nodeId);
    const head = depId ? depById.get(depId)?.headUserId ?? null : null;
    if (!head || !alive.has(head)) {
      noHead++;
      continue;
    }
    await db
      .update(schema.kpis)
      .set({ ownerUserId: head })
      .where(and(eq(schema.kpis.id, kpi.id), isNull(schema.kpis.ownerUserId)));
    written++;
  }

  console.log(
    `cr08 owners (strategy): ${written} KPI custodians written, ${already} already set, ${noHead} left empty (no lead department head)`
  );
}

const isMain = process.argv[1] && /cr08-owners-strategy-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08OwnersStrategy()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
