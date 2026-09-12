// Next.js looks for instrumentation inside src/ when a src directory is used;
// the root-level instrumentation.ts was never picked up, so the job worker
// never started under `next start` (found during CR02 report testing). This
// is the real registration; the root file stays as an inert duplicate because
// file deletion is blocked in this environment.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("@/server/jobs/worker");
    startWorker();
  }
}
