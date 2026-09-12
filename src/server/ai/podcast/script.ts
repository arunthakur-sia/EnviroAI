// CR02 4.4: podcast script generation. Content is gathered through the same
// analyst tools as Ask NPC (search_knowledge, get_node, get_lessons,
// get_indicator_series, get_deliverables), limited to the selected scope,
// then one model call (Sonnet; Opus for scopes over 10 items) writes the
// two-voice script. Deterministic mock when AI is not live.
import { getAiSettings } from "@/server/settings";
import { aiLive, getClient, loadPrompt, extractJson } from "@/server/ai/client";
import type { CurrentUser } from "@/server/auth/session";
import {
  AnalystState,
  runTool,
  type ToolContext,
  type SourceRef,
} from "@/server/ai/analyst/tools";
import { mockPodcastScript } from "@/server/ai/mock";

export type PodcastSegment = {
  speaker: "mariam" | "hamad";
  text: string;
  source_mention?: string | null;
};

export type PodcastScript = {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  segments: PodcastSegment[];
  estimated_seconds: number;
  sources: SourceRef[];
};

export type PodcastScope = {
  kind: "node" | "document" | "collection" | "lessons" | "topic" | "conversation";
  ids: string[];
  labelEn: string;
  labelAr: string;
  /* free-text topic query for kind=topic */
  query?: string;
};

export type PodcastOptions = {
  language: "ar" | "en";
  minutes: 3 | 5;
  focus: "overview" | "lessons" | "numbers" | "risks";
};

const WPM = { en: 150, ar: 130 } as const;

export function estimateSeconds(segments: PodcastSegment[], language: "ar" | "en"): number {
  const words = segments.reduce(
    (sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length,
    0
  );
  return Math.round((words / WPM[language]) * 60);
}

/** Gather grounded content for the scope through the analyst tools. */
export async function gatherScopeContent(
  user: CurrentUser,
  scope: PodcastScope,
  focus: PodcastOptions["focus"]
): Promise<{ material: string; state: AnalystState; itemCount: number }> {
  const state = new AnalystState();
  const ctx: ToolContext = { user, state };
  const parts: string[] = [];

  if (scope.kind === "node") {
    for (const id of scope.ids.slice(0, 3)) {
      parts.push(await runTool(ctx, "get_node", { id }));
      parts.push(await runTool(ctx, "get_deliverables", { node_id: id }));
      parts.push(await runTool(ctx, "get_lessons", { node_id: id }));
    }
    if (focus === "numbers") {
      parts.push(await runTool(ctx, "search_knowledge", { query: scope.labelEn, types: ["document"], limit: 3 }));
    }
    if (focus === "risks") {
      parts.push(await runTool(ctx, "get_signals", { text: scope.labelEn.slice(0, 40), days: 180 }));
    }
  } else if (scope.kind === "document") {
    for (const id of scope.ids.slice(0, 4)) {
      parts.push(await runTool(ctx, "get_document", { id }));
    }
  } else if (scope.kind === "lessons") {
    parts.push(await runTool(ctx, "get_lessons", { text: scope.query ?? scope.labelEn }));
    parts.push(
      await runTool(ctx, "search_knowledge", {
        query: scope.query ?? scope.labelEn,
        types: ["lesson", "decision"],
        limit: 5,
      })
    );
  } else if (scope.kind === "conversation") {
    // the Ask answer text arrives via query
    parts.push(`Ask NPC answer being discussed:\n${(scope.query ?? "").slice(0, 6000)}`);
    parts.push(await runTool(ctx, "search_knowledge", { query: scope.labelEn.slice(0, 80), limit: 4 }));
  } else {
    // topic or collection: hybrid search plus indicators
    parts.push(
      await runTool(ctx, "search_knowledge", { query: scope.query ?? scope.labelEn, limit: 6 })
    );
    parts.push(await runTool(ctx, "query_indicators", { text: (scope.query ?? scope.labelEn).slice(0, 50) }));
  }
  if (focus === "numbers") {
    parts.push(await runTool(ctx, "query_indicators", { text: (scope.query ?? scope.labelEn).slice(0, 50) }));
  }

  const material = parts
    .filter((p) => p && !/^No |^Unknown |failed:/.test(p))
    .join("\n\n---\n\n")
    .slice(0, 24000);
  return { material, state, itemCount: state.sources.length };
}

export async function generatePodcastScript(
  user: CurrentUser,
  scope: PodcastScope,
  options: PodcastOptions
): Promise<{ script: PodcastScript; live: boolean }> {
  const { material, state, itemCount } = await gatherScopeContent(user, scope, options.focus);
  const live = await aiLive();
  if (!live || !material.trim()) {
    const script = mockPodcastScript({
      labelEn: scope.labelEn,
      labelAr: scope.labelAr,
      material,
      language: options.language,
      minutes: options.minutes,
      focus: options.focus,
    });
    return {
      script: {
        ...script,
        estimated_seconds: estimateSeconds(script.segments, options.language),
        sources: state.sources,
      },
      live: false,
    };
  }

  const settings = await getAiSettings();
  // CR02 4.4: Opus for episodes built from more than 10 items
  const model = itemCount > 10 ? settings.modelBrief : settings.modelDefault;
  const { shared, specific } = loadPrompt("system_podcast_script");
  const maxWords = options.minutes * WPM[options.language];

  const request = [
    `Episode language: ${options.language === "ar" ? "Arabic" : "English"}.`,
    `Length: ${options.minutes} minutes, hard cap ${maxWords} words across all segments.`,
    `Focus: ${options.focus}.`,
    `Episode subject: ${scope.labelEn} / ${scope.labelAr}.`,
    `Selected content (numbered sources, the ONLY permitted facts):\n${material}`,
  ].join("\n\n");

  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 4000,
      system: [
        { type: "text", text: shared, cache_control: { type: "ephemeral" } },
        { type: "text", text: specific },
      ],
      messages: [{ role: "user", content: request }],
    });
    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    const parsed = extractJson<{
      title_en: string;
      title_ar: string;
      description_en: string;
      description_ar: string;
      segments: PodcastSegment[];
    }>(text);
    if (parsed?.segments?.length) {
      const segments = parsed.segments
        .filter((s) => (s.speaker === "mariam" || s.speaker === "hamad") && s.text?.trim())
        .slice(0, 24);
      // enforce the 5 minute hard cap: trim trailing beats, keep the close
      let est = estimateSeconds(segments, options.language);
      while (est > 5 * 60 && segments.length > 4) {
        segments.splice(segments.length - 3, 1);
        est = estimateSeconds(segments, options.language);
      }
      return {
        script: {
          title_en: parsed.title_en || scope.labelEn,
          title_ar: parsed.title_ar || scope.labelAr,
          description_en: parsed.description_en ?? "",
          description_ar: parsed.description_ar ?? "",
          segments,
          estimated_seconds: est,
          sources: state.sources,
        },
        live: true,
      };
    }
  } catch (e) {
    console.error("[podcast script] live call failed:", (e as Error)?.message);
  }
  const script = mockPodcastScript({
    labelEn: scope.labelEn,
    labelAr: scope.labelAr,
    material,
    language: options.language,
    minutes: options.minutes,
    focus: options.focus,
  });
  return {
    script: {
      ...script,
      estimated_seconds: estimateSeconds(script.segments, options.language),
      sources: state.sources,
    },
    live: false,
  };
}
