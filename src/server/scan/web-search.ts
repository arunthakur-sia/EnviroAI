// Primary scan source: Claude with the server-side web search tool runs each
// scan brief, reads results, and returns structured signal candidates.
import { aiLive, getClient, loadPrompt, extractJson } from "@/server/ai/client";
import { getAiSettings } from "@/server/settings";
import type { CandidateSignal } from "./extract";

export type WebSearchOutcome = {
  candidates: CandidateSignal[];
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  toolUnavailable: boolean;
};

/**
 * Runs one brief through Claude web search. The CR pins `web_search_20250305`;
 * if the account/model rejects that tool type we retry once with the newer
 * variant before reporting the tool unavailable (the caller then falls back to RSS).
 */
export async function runWebSearchBrief(
  brief: { queryEn: string; queryAr: string | null; nameEn: string },
  toolTypes: string[] = ["web_search_20250305", "web_search_20260209"]
): Promise<WebSearchOutcome> {
  if (!(await aiLive())) {
    return { candidates: [], tokensIn: 0, tokensOut: 0, error: "ai_not_live", toolUnavailable: true };
  }
  const settings = await getAiSettings();
  const { shared, specific } = loadPrompt("system_scan_extract");
  let lastError: string | null = null;

  for (const toolType of toolTypes) {
    try {
      const response = await getClient().messages.create({
        model: settings.modelDefault,
        max_tokens: 6000,
        system: [
          { type: "text", text: shared, cache_control: { type: "ephemeral" } },
          { type: "text", text: specific },
        ],
        tools: [
          {
            type: toolType,
            name: "web_search",
            max_uses: 4,
          } as never,
        ],
        messages: [
          {
            role: "user",
            content: `Scan brief: ${brief.nameEn}\nSearch the web now (use the web_search tool, up to 4 searches) for recent news, reports, announcements, and research matching this brief, then return the candidates JSON.\nEnglish query: ${brief.queryEn}\nArabic query: ${brief.queryAr ?? ""}\nToday's date: ${new Date().toISOString().slice(0, 10)}. Prefer items from the last 60 days.`,
          },
        ],
      });
      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }
      const parsed = extractJson<{ candidates: CandidateSignal[] }>(text);
      return {
        candidates: (parsed?.candidates ?? []).slice(0, 10),
        tokensIn: response.usage.input_tokens ?? 0,
        tokensOut: response.usage.output_tokens ?? 0,
        error: null,
        toolUnavailable: false,
      };
    } catch (e: any) {
      lastError = String(e?.message ?? e).slice(0, 300);
      const msg = lastError.toLowerCase();
      // wrong/unknown tool type: try the next variant; other errors: stop
      if (e?.status === 400 && /tool|web_search/.test(msg)) continue;
      return { candidates: [], tokensIn: 0, tokensOut: 0, error: lastError, toolUnavailable: false };
    }
  }
  return {
    candidates: [],
    tokensIn: 0,
    tokensOut: 0,
    error: lastError,
    toolUnavailable: true,
  };
}
