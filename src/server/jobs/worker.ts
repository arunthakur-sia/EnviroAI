// In-process job worker, started once from instrumentation.ts alongside the dev server.
import { claimNextJob, completeJob, failJob } from "./queue";

let started = false;
let stopping = false;

async function handle(job: {
  id: string;
  type: string;
  payloadJson: string | null;
}): Promise<void> {
  const payload = job.payloadJson ? JSON.parse(job.payloadJson) : {};
  switch (job.type) {
    case "ingest_document": {
      const { runIngest } = await import("@/server/ingest/pipeline");
      await runIngest(payload.documentId, payload);
      break;
    }
    case "embed_document": {
      const { embedDocumentChunks } = await import("@/server/ingest/pipeline");
      await embedDocumentChunks(payload.documentId);
      break;
    }
    case "translate_document": {
      const { translateDocumentFields } = await import("@/server/ingest/pipeline");
      await translateDocumentFields(payload.documentId);
      break;
    }
    case "embed_records": {
      const { embedStructuredRecords } = await import("@/server/search/records");
      await embedStructuredRecords(payload.resourceType, payload.resourceId);
      break;
    }
    case "daily_card": {
      const { generateDailyCard } = await import("@/server/ai/daily-card");
      await generateDailyCard();
      break;
    }
    case "scan_run": {
      const { runScan } = await import("@/server/scan");
      await runScan({
        trigger: payload.trigger ?? "scheduled",
        userId: payload.userId ?? null,
        briefId: payload.briefId ?? null,
      });
      await scheduleNextScan();
      break;
    }
    case "podcast_render": {
      // CR02 4.5: studio audio for one episode, progress in renderProgress
      const { renderEpisodeAudio } = await import("@/server/ai/podcast/audio");
      await renderEpisodeAudio(payload.episodeId);
      break;
    }
    case "report_generate": {
      // CR02 7: narrative + designed docx for one report row
      const { generateReport } = await import("@/server/reports/generate");
      await generateReport(payload.reportId);
      break;
    }
    case "lessons_recluster": {
      // CR04 3.7: nightly theme re-clustering (and on demand from Settings)
      const { getSetting } = await import("@/server/settings");
      const settings = await getSetting<{ reclusterNightly?: boolean }>("lessons_settings", {});
      if (settings.reclusterNightly !== false) {
        const { reclusterLessons } = await import("@/server/services/lessons");
        const made = await reclusterLessons();
        console.log(`[jobs] lesson themes reclustered: ${made}`);
      }
      await scheduleNextRecluster();
      break;
    }
    case "indices_fetch": {
      // CR05 4.3/4.8: Settings > Indices > Refresh data, then recompute
      const { runIndicesFetch } = await import("@/server/indices/fetcher");
      const report = await runIndicesFetch({ download: true });
      const total = report.perIndex.reduce((s, r) => s + r.inserted, 0);
      console.log(`[jobs] indices refreshed: +${total} observations`);
      const { computeAllForecasts } = await import("@/server/indices/compute");
      const done = await computeAllForecasts();
      console.log(`[jobs] index forecasts recomputed: ${done}`);
      break;
    }
    case "indices_forecast_nightly": {
      // CR05 4.6.11: the nightly recompute
      const { computeAllForecasts } = await import("@/server/indices/compute");
      const done = await computeAllForecasts();
      console.log(`[jobs] nightly index forecasts: ${done}`);
      await scheduleNextIndicesForecast();
      break;
    }
    case "hr_risks_recompute": {
      // CR05 5.5: the nightly HR risk materialisation (and Recompute button)
      const { recomputeHrRisks } = await import("@/server/services/hr");
      const n = await recomputeHrRisks();
      console.log(`[jobs] hr risks recomputed: ${n} open`);
      if (payload.nightly) await scheduleNextHrRisks();
      break;
    }
    default:
      throw new Error(`Unknown job type ${job.type}`);
  }
}

/** Keeps exactly one future scheduled scan in the queue (interval from Settings). */
async function scheduleNextScan(): Promise<void> {
  try {
    const { db, schema } = await import("@/server/db/client");
    const { and, eq, gt } = await import("drizzle-orm");
    const { enqueue } = await import("./queue");
    const { getTrendsSettings } = await import("@/server/scan");
    const pending = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.type, "scan_run"), eq(schema.jobs.status, "queued")))
      .limit(1);
    if (pending.length) return;
    const settings = await getTrendsSettings();
    const runAfter = new Date(
      Date.now() + Math.max(1, settings.intervalHours) * 3600_000
    ).toISOString();
    await enqueue("scan_run", {}, { runAfter });
  } catch (e) {
    console.error("[jobs] scheduleNextScan failed", e);
  }
}

/** Keeps exactly one future nightly recluster in the queue (CR04 3.7). */
async function scheduleNextRecluster(): Promise<void> {
  try {
    const { db, schema } = await import("@/server/db/client");
    const { and, eq } = await import("drizzle-orm");
    const { enqueue } = await import("./queue");
    const pending = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.type, "lessons_recluster"), eq(schema.jobs.status, "queued")))
      .limit(1);
    if (pending.length) return;
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(2, 0, 0, 0); // a quiet hour
    await enqueue("lessons_recluster", {}, { runAfter: next.toISOString() });
  } catch (e) {
    console.error("[jobs] scheduleNextRecluster failed", e);
  }
}

/** Keeps exactly one future nightly index-forecast recompute queued (CR05). */
async function scheduleNextIndicesForecast(): Promise<void> {
  try {
    const { db, schema } = await import("@/server/db/client");
    const { and, eq } = await import("drizzle-orm");
    const { enqueue } = await import("./queue");
    const pending = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.type, "indices_forecast_nightly"), eq(schema.jobs.status, "queued")))
      .limit(1);
    if (pending.length) return;
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(2, 30, 0, 0);
    await enqueue("indices_forecast_nightly", {}, { runAfter: next.toISOString() });
  } catch (e) {
    console.error("[jobs] scheduleNextIndicesForecast failed", e);
  }
}

/** Keeps exactly one future nightly HR risk recompute queued (CR05 5.5). */
async function scheduleNextHrRisks(): Promise<void> {
  try {
    const { db, schema } = await import("@/server/db/client");
    const { and, eq } = await import("drizzle-orm");
    const { enqueue } = await import("./queue");
    const pending = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.type, "hr_risks_recompute"), eq(schema.jobs.status, "queued")))
      .limit(1);
    if (pending.length) return;
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(3, 0, 0, 0);
    await enqueue("hr_risks_recompute", { nightly: true }, { runAfter: next.toISOString() });
  } catch (e) {
    console.error("[jobs] scheduleNextHrRisks failed", e);
  }
}

export function startWorker(): void {
  if (started) return;
  started = true;
  const loop = async () => {
    while (!stopping) {
      try {
        const job = await claimNextJob();
        if (!job) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        try {
          await handle(job);
          await completeJob(job.id);
        } catch (e: any) {
          console.error(`[jobs] ${job.type} failed:`, e?.message || e);
          await failJob(job.id, String(e?.stack || e), job.attempts + 1);
        }
      } catch (e) {
        // Never let the loop die.
        console.error("[jobs] loop error", e);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };
  loop();
  // seed the recurring schedules (CR01 2.3 scan, CR04 3.7 recluster,
  // CR05 index forecasts and HR risks)
  scheduleNextScan();
  scheduleNextRecluster();
  scheduleNextIndicesForecast();
  scheduleNextHrRisks();
  console.log("[jobs] worker started");
}

export function stopWorker(): void {
  stopping = true;
}
