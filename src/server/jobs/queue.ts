import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";

export type JobType =
  | "ingest_document"
  | "embed_document"
  | "embed_records"
  | "translate_document"
  | "daily_card"
  | "digest"
  | "scan_run"
  | "reembed_all"
  | "podcast_render" // CR02 4.5
  | "report_generate" // CR02 7
  | "lessons_recluster" // CR04 3.7
  | "indices_fetch" // CR05 4.3
  | "indices_forecast_nightly" // CR05 4.6.11
  | "hr_risks_recompute" // CR05 5.5
  | "report_build" // CR08 5.4: a Reports-module report, section by section
  | "report_section_rebuild" // CR08 5.4: regenerate one section
  | "leaderboard_refresh" // CR08 7.2: every ten minutes and on demand
  | "kow_rollover" // CR08 8: activate the week's pick, archive the last
  | "handover_nightly"; // CR08 6: reminders, link expiry, completion

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { runAfter?: string } = {}
): Promise<string> {
  const id = newId();
  await db.insert(schema.jobs).values({
    id,
    type,
    payloadJson: JSON.stringify(payload),
    status: "queued",
    attempts: 0,
    runAfter: opts.runAfter ?? null,
    createdAt: nowIso(),
  });
  return id;
}

export async function claimNextJob() {
  const now = nowIso();
  const candidates = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.status, "queued"),
        or(isNull(schema.jobs.runAfter), lte(schema.jobs.runAfter, now))
      )
    )
    .orderBy(asc(schema.jobs.createdAt))
    .limit(1);
  if (!candidates.length) return null;
  const job = candidates[0];
  // Optimistic claim; a second worker would fail the guard.
  const res = await db
    .update(schema.jobs)
    .set({ status: "running", attempts: sql`${schema.jobs.attempts} + 1` })
    .where(and(eq(schema.jobs.id, job.id), eq(schema.jobs.status, "queued")));
  if ((res as unknown as { rowsAffected?: number }).rowsAffected === 0) return null;
  return job;
}

export async function completeJob(id: string): Promise<void> {
  await db
    .update(schema.jobs)
    .set({ status: "done", finishedAt: nowIso(), error: null })
    .where(eq(schema.jobs.id, id));
}

export async function failJob(id: string, error: string, attempts: number): Promise<void> {
  const status = attempts >= 3 ? "failed" : "queued";
  const runAfter =
    status === "queued" ? new Date(Date.now() + 30_000 * attempts).toISOString() : null;
  await db
    .update(schema.jobs)
    .set({ status, error: error.slice(0, 2000), runAfter, finishedAt: status === "failed" ? nowIso() : null })
    .where(eq(schema.jobs.id, id));
}
