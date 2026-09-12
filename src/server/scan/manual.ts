// Manual scan source: paste a URL or upload a PDF/report; the same extraction
// prompt turns the fetched or parsed text into signal candidates.
import { fetch as undiciFetch, Agent } from "undici";
import { callJson, aiLive } from "@/server/ai/client";
import { mockManualSignal } from "@/server/ai/mock";
import type { CandidateSignal } from "./extract";
import { persistCandidates } from "./extract";

const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function fetchPageText(url: string): Promise<{ text: string; title: string }> {
  const res = await undiciFetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SiaNexus-scan/1.0 (+local prototype)",
      accept: "text/html,application/xhtml+xml,*/*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
    dispatcher: insecureDispatcher,
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const html = await res.text();
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? url;
  return { text: stripHtml(html).slice(0, 16000), title };
}

/** Extracts signals from arbitrary text (a fetched page or a parsed document). */
export async function extractSignalsFromText(input: {
  text: string;
  url?: string | null;
  title?: string | null;
  publisher?: string | null;
  userId: string;
}): Promise<{ added: string[]; duplicates: number }> {
  let candidates: CandidateSignal[] = [];
  if (await aiLive()) {
    const parsed = await callJson<{ candidates: CandidateSignal[] }>(
      "system_scan_extract",
      `Manual submission.\nURL: ${input.url ?? "none"}\nTitle: ${input.title ?? ""}\nPublisher hint: ${input.publisher ?? ""}\n\nText:\n${input.text.slice(0, 14000)}`,
      { maxTokens: 4000 }
    );
    candidates = parsed?.candidates ?? [];
  }
  if (!candidates.length) {
    candidates = [mockManualSignal(input.text, input.title ?? null, input.url ?? null, input.publisher ?? null)];
  }
  for (const c of candidates) {
    if (input.url && !c.url) c.url = input.url;
    if (!c.source_excerpt) c.source_excerpt = input.text.slice(0, 600);
  }
  const res = await persistCandidates(candidates, {
    sourceKind: "manual",
    createdBy: input.userId,
  });
  return { added: res.added, duplicates: res.duplicates };
}
