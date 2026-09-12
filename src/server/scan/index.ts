// Scan orchestrator: runs the active briefs through web search (primary) and the
// feed list (secondary), dedupes, persists, and writes a scan_runs row.
// Mock mode returns the seeded fixture so the UI always has data.
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";
import { aiLive } from "@/server/ai/client";
import { getSetting } from "@/server/settings";
import { mockScanCandidates } from "@/server/ai/mock";
import { runWebSearchBrief } from "./web-search";
import { runRssScan } from "./rss";
import { persistCandidates } from "./extract";

export type TrendsSettings = {
  intervalHours: number;
  webSearchOn: boolean;
  scanTokenBudget: number;
};

export const DEFAULT_TRENDS_SETTINGS: TrendsSettings = {
  intervalHours: 6,
  webSearchOn: true,
  scanTokenBudget: 500_000,
};

export async function getTrendsSettings(): Promise<TrendsSettings> {
  return getSetting<TrendsSettings>("trends", DEFAULT_TRENDS_SETTINGS);
}

export async function runScan(opts: {
  trigger: "manual" | "scheduled";
  userId?: string | null;
  /* CR02 6: Rescan runs only this brief (feeds are skipped) */
  briefId?: string | null;
}): Promise<{ runId: string; added: number; duplicates: number }> {
  const runId = newId();
  const startedAt = nowIso();
  await db.insert(schema.scanRuns).values({
    id: runId,
    startedAt,
    status: "running",
    trigger: opts.trigger,
  });

  const errors: string[] = [];
  let candidatesCount = 0;
  let added = 0;
  let duplicates = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let briefsRun = 0;

  try {
    const live = await aiLive();
    const settings = await getTrendsSettings();

    if (!live) {
      // AI Mock Mode: 12 plausible fixture signals with rotating dates
      const candidates = mockScanCandidates();
      candidatesCount = candidates.length;
      const res = await persistCandidates(candidates, {
        sourceKind: "web_search",
        scanRunId: runId,
        createdBy: opts.userId ?? null,
      });
      added = res.added.length;
      duplicates = res.duplicates;
    } else {
      let briefs = await db
        .select()
        .from(schema.scanBriefs)
        .where(eq(schema.scanBriefs.isActive, 1));
      if (opts.briefId) briefs = briefs.filter((b) => b.id === opts.briefId);

      // Source 1: Claude web search per brief (token-budgeted)
      if (settings.webSearchOn) {
        let webSearchUnavailable = false;
        for (const brief of briefs) {
          if (webSearchUnavailable) break;
          if (tokensIn + tokensOut > settings.scanTokenBudget) {
            errors.push("token budget reached, remaining briefs skipped");
            break;
          }
          briefsRun++;
          const outcome = await runWebSearchBrief({
            queryEn: brief.queryEn,
            queryAr: brief.queryAr,
            nameEn: brief.nameEn,
          });
          tokensIn += outcome.tokensIn;
          tokensOut += outcome.tokensOut;
          if (outcome.error) errors.push(`brief ${brief.nameEn}: ${outcome.error}`);
          if (outcome.toolUnavailable) {
            webSearchUnavailable = true;
            errors.push("web search tool unavailable, falling back to feeds");
          }
          candidatesCount += outcome.candidates.length;
          const res = await persistCandidates(outcome.candidates, {
            sourceKind: "web_search",
            scanRunId: runId,
            createdBy: opts.userId ?? null,
          });
          added += res.added.length;
          duplicates += res.duplicates;
          await db
            .update(schema.scanBriefs)
            .set({ lastRunAt: nowIso() })
            .where(eq(schema.scanBriefs.id, brief.id));
          // CR02 6: live progress for the inline card on /trends
          await db
            .update(schema.scanRuns)
            .set({ briefsRun, candidates: candidatesCount, acceptedNew: added, duplicates })
            .where(eq(schema.scanRuns.id, runId));
        }
      }

      // Source 2: RSS/Atom feeds (always on; skipped for a single-brief rescan)
      const rss = opts.briefId
        ? { tokensIn: 0, tokensOut: 0, errors: [] as string[], candidates: [] }
        : await runRssScan(30);
      tokensIn += rss.tokensIn;
      tokensOut += rss.tokensOut;
      errors.push(...rss.errors.slice(0, 15));
      candidatesCount += rss.candidates.length;
      const rssRes = await persistCandidates(rss.candidates, {
        sourceKind: "rss",
        scanRunId: runId,
        createdBy: opts.userId ?? null,
      });
      added += rssRes.added.length;
      duplicates += rssRes.duplicates;
    }

    await db
      .update(schema.scanRuns)
      .set({
        finishedAt: nowIso(),
        status: "done",
        briefsRun,
        candidates: candidatesCount,
        acceptedNew: added,
        duplicates,
        errorsJson: errors.length ? JSON.stringify(errors) : null,
        tokensIn,
        tokensOut,
      })
      .where(eq(schema.scanRuns.id, runId));
  } catch (e: any) {
    errors.push(String(e?.message ?? e).slice(0, 300));
    await db
      .update(schema.scanRuns)
      .set({
        finishedAt: nowIso(),
        status: "failed",
        briefsRun,
        candidates: candidatesCount,
        acceptedNew: added,
        duplicates,
        errorsJson: JSON.stringify(errors),
        tokensIn,
        tokensOut,
      })
      .where(eq(schema.scanRuns.id, runId));
  }
  return { runId, added, duplicates };
}
