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
      await runScan({ trigger: "scheduled" });
      await scheduleNextScan();
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
  // seed the recurring scan schedule (CR01 2.3)
  scheduleNextScan();
  console.log("[jobs] worker started");
}

export function stopWorker(): void {
  stopping = true;
}
