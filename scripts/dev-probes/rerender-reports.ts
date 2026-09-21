/* eslint-disable no-console */
// Re-renders the Word documents of every report from its stored sections.
// Nothing is regenerated: the prose is what it already was, only the files are
// written again. Used after a file was lost from the data directory.
//   npx tsx scripts/dev-probes/rerender-reports.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { isNotNull } = await import("drizzle-orm");
  const { runSectionRebuild, RENDER_ONLY } = await import("../../src/server/reports/build");

  const reports = await db
    .select({ id: schema.reports.id, title: schema.reports.titleEn, status: schema.reports.status })
    .from(schema.reports)
    .where(isNotNull(schema.reports.typeId));

  console.log(`re-rendering ${reports.length} reports`);
  let ok = 0;
  for (const r of reports) {
    try {
      await runSectionRebuild(r.id, RENDER_ONLY, { forceMock: true });
      ok++;
      console.log(`  ${r.id.slice(0, 10)}  ${String(r.title).slice(0, 62)}`);
    } catch (e) {
      console.error(`  ${r.id.slice(0, 10)} FAILED: ${String((e as Error)?.message ?? e).slice(0, 100)}`);
    }
  }
  const { closePngRenderer } = await import("../../src/server/reports/template/png");
  await closePngRenderer();
  console.log(`\n${ok} of ${reports.length} re-rendered`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
