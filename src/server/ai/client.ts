// Anthropic client wrapper: prompt loading with caching, JSON calls with robust
// parsing, and streaming. Callers fall back to mock.ts when null is returned.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { getAiSettings } from "@/server/settings";

let client: Anthropic | null = null;

export function anthropicKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiLive(): Promise<boolean> {
  if (!anthropicKeyPresent()) return false;
  const settings = await getAiSettings();
  return !settings.mockMode;
}

export function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const promptCache = new Map<string, string>();

export function loadPrompt(name: string): { shared: string; specific: string } {
  const dir = path.resolve(process.cwd(), "src", "server", "ai", "prompts");
  const read = (file: string) => {
    const key = file;
    const hit = promptCache.get(key);
    if (hit !== undefined) return hit;
    let text = "";
    try {
      text = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      text = "";
    }
    promptCache.set(key, text);
    return text;
  };
  return { shared: read("_shared.md"), specific: read(`${name}.md`) };
}

export function extractJson<T = unknown>(text: string): T | null {
  // Finds the outermost JSON object in a model response.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // try to fix trailing commas
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1")) as T;
    } catch {
      return null;
    }
  }
}

export type JsonCallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Non-streaming JSON capability call. Returns null on any failure so callers
 * can fall back to the deterministic mock.
 */
export async function callJson<T = unknown>(
  promptName: string,
  userContent: string,
  opts: JsonCallOptions = {}
): Promise<T | null> {
  if (!(await aiLive())) return null;
  const settings = await getAiSettings();
  const { shared, specific } = loadPrompt(promptName);
  try {
    const response = await getClient().messages.create({
      model: opts.model || settings.modelDefault,
      max_tokens: opts.maxTokens ?? 4000,
      // temperature intentionally omitted: rejected with a 400 on current models
      system: [
        { type: "text", text: shared, cache_control: { type: "ephemeral" } },
        { type: "text", text: specific },
      ],
      messages: [{ role: "user", content: userContent }],
    });
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }
    return extractJson<T>(text);
  } catch (e) {
    console.error(`[ai] ${promptName} call failed:`, (e as Error)?.message);
    return null;
  }
}

/** Streaming call for Ask. Returns the SDK stream or null when AI is not live. */
export async function streamPrompt(
  promptName: string,
  userContent: string,
  opts: JsonCallOptions = {}
) {
  if (!(await aiLive())) return null;
  const settings = await getAiSettings();
  const { shared, specific } = loadPrompt(promptName);
  try {
    return getClient().messages.stream({
      model: opts.model || settings.modelDefault,
      max_tokens: opts.maxTokens ?? 3000,
      system: [
        { type: "text", text: shared, cache_control: { type: "ephemeral" } },
        { type: "text", text: specific },
      ],
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e) {
    console.error(`[ai] stream ${promptName} failed:`, (e as Error)?.message);
    return null;
  }
}
