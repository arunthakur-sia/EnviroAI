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
  // seed the recurring schedules (CR01 2.3 scan, CR04 3.7 recluster)
  scheduleNextScan();
  scheduleNextRecluster();
  console.log("[jobs] worker started");
}

export function stopWorker(): void {
  stopping = true;
}
