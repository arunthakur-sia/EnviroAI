/* eslint-disable no-console */
// Why does completing a pending in-scope item not move the percentage?
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const q = async (sql: string, args: unknown[] = []) =>
    (await db.execute({ sql, args: args as never[] })).rows;

  const rows = await q(
    `select h.id, h.status, h.completion_pct,
            (select count(*) from handover_items i where i.handover_id = h.id) total,
            (select count(*) from handover_items i where i.handover_id = h.id and coalesce(i.in_scope,1) = 1) inScope,
            (select count(*) from handover_items i where i.handover_id = h.id and coalesce(i.in_scope,1) = 1 and i.status = 'pending') pendingInScope,
            (select count(*) from handover_items i where i.handover_id = h.id and coalesce(i.in_scope,1) = 1 and i.status != 'pending') doneInScope
     from handovers h where h.status != 'complete'`
  );
  for (const r of rows) {
    console.log(
      `${String(r.id).slice(0, 8)} status=${r.status} pct=${r.completion_pct} total=${r.total} inScope=${r.inScope} pending=${r.pendingInScope} done=${r.doneInScope} -> computed ${Math.round((100 * Number(r.doneInScope)) / Math.max(1, Number(r.inScope)))}`
    );
  }
  db.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
