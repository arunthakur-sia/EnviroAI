// CR02 7: the report_generate job. Gather, write the narrative (per language
// part), lay out the docx, save data/reports/{id}.docx, award points.
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { dataPath } from "@/server/paths";
import { nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { gatherReportItems, type ReportOptionsInput, type ReportScopeInput } from "./gather";
import { writeNarrative } from "./narrative";
import { buildReportDocx } from "./docx";

/* Progress readable by the polling API; the worker shares the process. */
export const reportProgress = new Map<string, string>();

export async function generateReport(reportId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, reportId))
    .limit(1);
  if (!row) return;
  const scope = JSON.parse(row.scopeJson) as ReportScopeInput;
  const options = JSON.parse(row.optionsJson ?? "{}") as ReportOptionsInput;
  const [creator] = row.createdBy
    ? await db.select().from(schema.users).where(eq(schema.users.id, row.createdBy)).limit(1)
    : [];
  try {
    await db
      .update(schema.reports)
      .set({ status: "running" })
      .where(eq(schema.reports.id, reportId));
    reportProgress.set(reportId, "gathering");

    // gather as the creating user (clearance filters)
    const { getUserById } = await import("@/server/auth/session");
    const user = creator ? await getUserById(creator.id) : null;
    if (!user) throw new Error("creator_missing");
    const { items, charts } = await gatherReportItems(user, scope, options);
    if (!items.length) throw new Error("no_items");

    reportProgress.set(reportId, "writing");
    const langs: ("en" | "ar")[] =
      options.language === "both" ? ["en", "ar"] : [options.language];
    const parts: { lang: "en" | "ar"; narrative: Awaited<ReturnType<typeof writeNarrative>>["narrative"] }[] = [];
    for (const lang of langs) {
      const { narrative } = await writeNarrative(scope, options, items, lang);
      parts.push({ lang, narrative });
    }

    reportProgress.set(reportId, "layout");
    const classification = Math.max(2, row.classificationLevel);
    const generatedAt = nowIso();
    const buf = await buildReportDocx({
      parts,
      items,
      charts,
      scope,
      options,
      classification,
      generatedAt,
    });
    const dir = dataPath("reports");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${reportId}.docx`), buf);

    await db
      .update(schema.reports)
      .set({
        status: "done",
        title: parts[0].narrative.title,
        filePath: `reports/${reportId}.docx`,
        narrativeJson: JSON.stringify({ parts, itemCount: items.length }),
        finishedAt: nowIso(),
      })
      .where(eq(schema.reports.id, reportId));

    if (row.createdBy) {
      await record({
        userId: row.createdBy,
        type: "report_extracted",
        resourceType: "report",
        resourceId: reportId,
        meta: { departmentId: user.departmentId },
      });
    }
  } catch (e) {
    console.error("[report] generation failed:", (e as Error)?.message);
    await db
      .update(schema.reports)
      .set({
        status: "failed",
        error: String((e as Error)?.message ?? e).slice(0, 300),
        finishedAt: nowIso(),
      })
      .where(eq(schema.reports.id, reportId));
  } finally {
    setTimeout(() => reportProgress.delete(reportId), 30_000);
  }
}
