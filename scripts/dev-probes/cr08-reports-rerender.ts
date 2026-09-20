/* eslint-disable no-console */
// CR08 5: re-renders every module report from its stored sections (docx in
// each language plus the page previews) after a template or cover change,
// without regenerating any text and without changing the report's status.
// For published reports the Institutional Memory copy of the primary docx
// is refreshed in place so the library and the gallery agree.
//   npx tsx scripts/dev-probes/cr08-reports-rerender.ts [reportId ...]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { and, eq, isNotNull, like } = await import("drizzle-orm");
  const { runSectionRebuild } = await import("../../src/server/reports/build");
  const { put } = await import("../../src/server/storage");
  const { nowIso } = await import("../../src/lib/ids");

  const wanted = process.argv.slice(2);
  const rows = (await db.select().from(schema.reports).where(isNotNull(schema.reports.typeId))).filter(
    (r) => (!wanted.length || wanted.includes(r.id)) && (r.status === "draft" || r.status === "in_review" || r.status === "approved" || r.status === "published")
  );
  console.log(`re-rendering ${rows.length} module reports`);
  for (const r of rows) {
    const t0 = Date.now();
    // the cover is deterministic (no model call) and regenerating it also
    // re-renders the whole document; the status it found is restored after
    await runSectionRebuild(r.id, "cover");
    await db.update(schema.reports).set({ status: r.status, approvedBy: r.approvedBy, approvedAt: r.approvedAt, updatedAt: nowIso() }).where(eq(schema.reports.id, r.id));
    await db
      .delete(schema.notifications)
      .where(and(eq(schema.notifications.kind, "report_section_ready"), like(schema.notifications.link, `/reports/${r.id}%`)));
    const [after] = await db.select().from(schema.reports).where(eq(schema.reports.id, r.id)).limit(1);
    let previews = 0;
    try {
      previews = JSON.parse(after?.previewImagesJson ?? "[]").length;
    } catch {
      previews = 0;
    }
    let refreshed = "";
    if (after?.publishedDocumentId && after.docxPath) {
      const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, after.publishedDocumentId)).limit(1);
      if (doc) {
        const buf = await fs.readFile(path.join(process.cwd(), "data", after.docxPath));
        const filename = doc.originalFilename ?? "report.docx";
        const storagePath = await put(doc.id, filename, buf);
        await db.update(schema.documents).set({ storagePath, sizeBytes: buf.length, updatedAt: nowIso() }).where(eq(schema.documents.id, doc.id));
        refreshed = ", library copy refreshed";
      }
    }
    console.log(`  ${r.id} "${after?.titleEn}" status=${after?.status} v${after?.version} docx=${after?.docxPath ? "ok" : "pending"} previews=${previews}${refreshed} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
