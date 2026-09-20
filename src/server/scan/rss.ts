// Secondary scan source, always on: RSS/Atom feeds plus Google News queries.
// Feed XML is fetched with TLS verification relaxed because the corporate proxy
// on this machine re-signs public sites (see DECISIONS.md item 8); items are
// public news read-only. Haiku classifies relevance, Sonnet writes the card.
import Parser from "rss-parser";
import { fetch as undiciFetch, Agent } from "undici";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { nowIso } from "@/lib/ids";
import { callJson, aiLive } from "@/server/ai/client";
import { getAiSettings } from "@/server/settings";
import type { CandidateSignal } from "./extract";
import { normalizeUrl } from "./extract";

/** CR08 Phase A: the only place an unknown error is narrowed. */
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}


const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
const parser = new Parser({ timeout: 20000 });

const MIN_FETCH_INTERVAL_MS = 15 * 60 * 1000;

export type RssOutcome = {
  candidates: CandidateSignal[];
  feedsFetched: number;
  itemsSeen: number;
  tokensIn: number;
  tokensOut: number;
  errors: string[];
};

async function fetchXml(url: string): Promise<string> {
  const res = await undiciFetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SiaNexus-scan/1.0 (+local prototype)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
    dispatcher: insecureDispatcher,
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return await res.text();
}

export async function runRssScan(maxCandidates = 30): Promise<RssOutcome> {
  const out: RssOutcome = {
    candidates: [],
    feedsFetched: 0,
    itemsSeen: 0,
    tokensIn: 0,
    tokensOut: 0,
    errors: [],
  };
  const live = await aiLive();
  const settings = await getAiSettings();
  const feeds = await db.select().from(schema.feeds).where(eq(schema.feeds.isActive, 1));
  const now = Date.now();

  // existing URLs to skip before spending any tokens
  const existing = new Set(
    (
      await db.select({ url: schema.signals.url }).from(schema.signals)
    )
      .map((r) => normalizeUrl(r.url))
      .filter(Boolean) as string[]
  );

  for (const feed of feeds) {
    if (out.candidates.length >= maxCandidates) break;
    if (
      feed.lastFetchedAt &&
      now - new Date(feed.lastFetchedAt).getTime() < MIN_FETCH_INTERVAL_MS
    ) {
      continue; // one request per feed per run, 15 minute minimum interval
    }
    try {
      const xml = await fetchXml(feed.url);
      const parsed = await parser.parseString(xml);
      out.feedsFetched++;
      await db
        .update(schema.feeds)
        .set({ lastFetchedAt: nowIso(), lastError: null })
        .where(eq(schema.feeds.id, feed.id));

      const items = (parsed.items ?? []).slice(0, 12);
      out.itemsSeen += items.length;
      for (const item of items) {
        if (out.candidates.length >= maxCandidates) break;
        const link = normalizeUrl(item.link ?? null);
        if (!link || existing.has(link)) continue;
        const title = (item.title ?? "").trim();
        if (!title) continue;
        const snippet = (item.contentSnippet ?? item.content ?? "").slice(0, 600);

        if (!live) {
          // mock mode never fabricates cards from live feeds; the fixture covers the UI
          continue;
        }
        // Haiku relevance gate
        const relevance = await callJson<{
          relevant: boolean;
          outcome_codes: string[];
          signal_type: string;
        }>(
          "system_scan_relevance",
          `Source: ${feed.name}\nTitle: ${title}\nSnippet: ${snippet}`,
          { model: settings.modelFast, maxTokens: 200 }
        );
        if (!relevance?.relevant) continue;

        // Sonnet writes the bilingual card
        const card = await callJson<{ candidates: CandidateSignal[] }>(
          "system_scan_extract",
          `One feed item; produce at most one candidate.\nPublisher: ${feed.name}\nURL: ${item.link}\nPublished: ${item.isoDate ?? item.pubDate ?? ""}\nTitle: ${title}\nContent: ${snippet}\nRelevance hints: outcomes ${JSON.stringify(relevance.outcome_codes ?? [])}, type ${relevance.signal_type}`,
          { maxTokens: 1500 }
        );
        const c = card?.candidates?.[0];
        if (c) {
          c.url = item.link ?? c.url;
          c.publisher = c.publisher || feed.name;
          c.published_at =
            c.published_at || (item.isoDate ? item.isoDate.slice(0, 10) : null);
          c.source_excerpt = snippet;
          out.candidates.push(c);
          existing.add(link);
        }
      }
    } catch (e: unknown) {
      const msg = errMessage(e).slice(0, 200);
      out.errors.push(`${feed.name}: ${msg}`);
      await db
        .update(schema.feeds)
        .set({ lastError: msg, lastFetchedAt: nowIso() })
        .where(eq(schema.feeds.id, feed.id));
    }
  }
  return out;
}
