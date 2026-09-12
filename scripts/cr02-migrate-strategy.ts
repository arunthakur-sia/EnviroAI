/* eslint-disable no-console */
// CR02 2.1: migrate strategy nodes to Outcomes > Targets > Initiatives and
// Projects. NDS3 only; the archives (NDS2 sector strategies, NDS1 outcome
// areas) keep their historical shape and the navigator adapts (DECISIONS 39).
//
// Rules (deterministic, idempotent via the cr02_strategy_migrated setting):
// - initiative parented to an outcome: reparent to one of that outcome's
//   targets, round-robin in sort order (the seed gave no target, but leaving
//   56 initiatives outcome-level would empty pane 3 for every target).
// - initiative parented to a cluster: keep the membership as a relations row
//   (in_cluster), then reparent into the cluster's outcome's targets the same
//   way.
// - initiative parented to an enabler: keep the membership as a relations row
//   (under_enabler), then attach to an outcome round-robin ACROSS outcomes at
//   outcome level. These carry the "Outcome-level" label in the navigator.
// - projects stay under their initiatives and inherit the target through them.
import { createClient } from "@libsql/client";
import path from "node:path";
import { ulid } from "ulid";

const dbPath = path.join(process.cwd(), "data", "nexus.db").replace(/\\/g, "/");

export async function migrateStrategyCr02(): Promise<Record<string, number>> {
  const db = createClient({ url: `file:${dbPath}` });
  const counts: Record<string, number> = {
    toTargets: 0,
    outcomeLevel: 0,
    inClusterRelations: 0,
    underEnablerRelations: 0,
  };

  const done = await db.execute(
    "select value_json from settings where key='cr02_strategy_migrated'"
  );
  if (done.rows.length) {
    console.log("cr02 strategy migration already applied, skipping");
    db.close();
    return counts;
  }

  const nds3 = (
    await db.execute("select id from strategy_editions where code='nds3'")
  ).rows[0];
  if (!nds3) {
    console.log("no nds3 edition, nothing to migrate");
    db.close();
    return counts;
  }
  const editionId = String(nds3.id);

  const nodes = (
    await db.execute({
      sql: "select id, parent_id, node_type, code, sort from strategy_nodes where edition_id=? order by sort",
      args: [editionId],
    })
  ).rows.map((r) => ({
    id: String(r.id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    nodeType: String(r.node_type),
    code: r.code ? String(r.code) : null,
    sort: Number(r.sort),
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outcomes = nodes.filter((n) => n.nodeType === "outcome").sort((a, b) => a.sort - b.sort);
  const targetsByOutcome = new Map<string, typeof nodes>();
  for (const t of nodes.filter((n) => n.nodeType === "target")) {
    if (!t.parentId) continue;
    const list = targetsByOutcome.get(t.parentId) ?? [];
    list.push(t);
    targetsByOutcome.set(t.parentId, list);
  }
  for (const list of targetsByOutcome.values()) list.sort((a, b) => a.sort - b.sort);

  const rrByOutcome = new Map<string, number>();
  let enablerRR = 0;
  const now = new Date().toISOString();

  async function relate(fromId: string, toId: string, relation: string) {
    await db.execute({
      sql: `insert into relations (id, from_type, from_id, to_type, to_id, relation, source, confidence, created_at)
            values (?, 'node', ?, 'node', ?, ?, 'migration', null, ?)`,
      args: [ulid(), fromId, toId, relation, now],
    });
  }
  async function reparent(nodeId: string, newParentId: string) {
    await db.execute({
      sql: "update strategy_nodes set parent_id=?, updated_at=? where id=?",
      args: [newParentId, now, nodeId],
    });
  }
  function nextTarget(outcomeId: string): string | null {
    const targets = targetsByOutcome.get(outcomeId) ?? [];
    if (!targets.length) return null;
    const i = rrByOutcome.get(outcomeId) ?? 0;
    rrByOutcome.set(outcomeId, i + 1);
    return targets[i % targets.length].id;
  }

  for (const ini of nodes.filter((n) => n.nodeType === "initiative")) {
    const parent = ini.parentId ? byId.get(ini.parentId) : null;
    if (!parent) continue;
    if (parent.nodeType === "outcome") {
      const target = nextTarget(parent.id);
      if (target) {
        await reparent(ini.id, target);
        counts.toTargets++;
      } else {
        counts.outcomeLevel++;
      }
    } else if (parent.nodeType === "cluster") {
      await relate(ini.id, parent.id, "in_cluster");
      counts.inClusterRelations++;
      const outcomeId = parent.parentId;
      const target = outcomeId ? nextTarget(outcomeId) : null;
      if (target) {
        await reparent(ini.id, target);
        counts.toTargets++;
      } else if (outcomeId) {
        await reparent(ini.id, outcomeId);
        counts.outcomeLevel++;
      }
    } else if (parent.nodeType === "enabler") {
      await relate(ini.id, parent.id, "under_enabler");
      counts.underEnablerRelations++;
      const outcome = outcomes[enablerRR++ % outcomes.length];
      await reparent(ini.id, outcome.id);
      counts.outcomeLevel++;
    }
    // parent.nodeType target: already migrated shape, leave alone
  }

  await db.execute({
    sql: "insert into settings (key, value_json) values ('cr02_strategy_migrated', ?)",
    args: [JSON.stringify({ at: now, counts })],
  });
  console.log("cr02 strategy migration:", JSON.stringify(counts));
  db.close();
  return counts;
}

const isMain = process.argv[1] && /cr02-migrate-strategy\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  migrateStrategyCr02().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
