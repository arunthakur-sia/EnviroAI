// The EnviroAI analyst: a tool-using loop (Sonnet by default, Opus for complex
// questions) that plans, gathers evidence through real tools, and streams a
// structured answer workspace. Runs fully in mock mode with the same tools.
import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { getAiSettings } from "@/server/settings";
import { aiLive, getClient, loadPrompt, callJson, noteAiFailure } from "@/server/ai/client";
import {
  mockAnalystPlan,
  mockAnalystAnswer,
  mockAnalystFollowUps,
  type MockPlannedTool,
} from "@/server/ai/mock";
import { AnalystState, TOOL_DEFINITIONS, runTool, type Workspace, type SourceRef } from "./tools";
import { isArabicText } from "@/lib/utils";

const MAX_TOOL_CALLS = 8;
const GATHER_BUDGET_MS = 60_000;

export type AnalystEvent =
  | { type: "chip"; labelEn: string; labelAr: string }
  | { type: "workspace"; workspace: Workspace }
  | { type: "sources"; citations: SourceRef[] }
  | { type: "delta"; text: string }
  | {
      type: "final";
      markdown: string;
      citations: SourceRef[];
      confidence: "high" | "medium" | "low";
      followUps: string[];
      workspace: Workspace;
      includesSecret: boolean;
    };

/* ---------------- chip labels ---------------- */

function chipFor(name: string, input: Record<string, unknown>): { labelEn: string; labelAr: string } {
  switch (name) {
    case "search_knowledge":
      return { labelEn: "Searching Institutional Memory", labelAr: "يبحث في مكتبة المعرفة" };
    case "get_document":
      return { labelEn: "Reading a document", labelAr: "يقرأ وثيقة" };
    case "query_strategy":
      return input.count_by
        ? { labelEn: "Counting in the strategy", labelAr: "يحصي في الاستراتيجية" }
        : { labelEn: "Reading the Living Strategy", labelAr: "يقرأ الاستراتيجية الحية" };
    case "get_node":
      return { labelEn: "Opening a strategy node", labelAr: "يفتح عنصراً من الاستراتيجية" };
    case "query_indicators":
      return { labelEn: "Scanning the indicator catalog", labelAr: "يستعرض فهرس المؤشرات" };
    case "get_indicator_series":
      return { labelEn: "Reading the numbers", labelAr: "يقرأ الأرقام" };
    case "compute":
      return { labelEn: "Calculating", labelAr: "يحسب" };
    case "find_experts":
      return { labelEn: "Matching experts", labelAr: "يبحث عن الخبراء" };
    case "get_lessons":
      return { labelEn: "Collecting lessons learned", labelAr: "يجمع الدروس المستفادة" };
    case "get_signals":
      return { labelEn: "Checking recent signals", labelAr: "يفحص الإشارات الحديثة" };
    case "what_changed":
      return { labelEn: "Tracing what changed", labelAr: "يتتبع ما تغير" };
    case "compare_editions":
      return { labelEn: "Comparing strategy editions", labelAr: "يقارن نسخ الاستراتيجية" };
    default:
      return { labelEn: "Working", labelAr: "يعمل" };
  }
}

/* ---------------- history ---------------- */

async function conversationHistory(conversationId: string): Promise<{
  turns: { role: "user" | "assistant"; content: string }[];
  summary: string | null;
  lastUserMessage: string | null;
}> {
  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, conversationId))
    .limit(1);
  const rows = await db
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, conversationId))
    .orderBy(desc(schema.aiMessages.createdAt))
    .limit(24);
  const ordered = rows.reverse();
  const turns = ordered
    .filter((r) => r.role === "user" || r.role === "assistant")
    .slice(-12)
    .map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content.slice(0, r.role === "assistant" ? 1200 : 600),
    }));
  const lastUser = [...ordered].reverse().find((r) => r.role === "user");
  return {
    turns,
    summary: conv?.summary ?? null,
    lastUserMessage: lastUser?.content ?? null,
  };
}

/** Summarise older turns with Haiku once a conversation grows beyond 12 turns. */
export async function maybeSummarise(conversationId: string): Promise<void> {
  const rows = await db
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, conversationId));
  if (rows.length <= 12) return;
  if (!(await aiLive())) return;
  const settings = await getAiSettings();
  const older = rows.slice(0, rows.length - 12);
  const text = older
    .map((r) => `${r.role}: ${r.content.slice(0, 400)}`)
    .join("\n")
    .slice(0, 12000);
  try {
    const response = await getClient().messages.create({
      model: settings.modelFast,
      max_tokens: 500,
      system:
        "Summarise this analyst conversation's older turns in under 120 words: topics covered, key numbers found, open threads. Plain text.",
      messages: [{ role: "user", content: text }],
    });
    let summary = "";
    for (const b of response.content) if (b.type === "text") summary += b.text;
    if (summary) {
      await db
        .update(schema.aiConversations)
        .set({ summary: summary.slice(0, 2000) })
        .where(eq(schema.aiConversations.id, conversationId));
    }
  } catch {
    /* summary is best-effort */
  }
}

/* ---------------- follow-up extraction ---------------- */

function splitFollowUps(text: string): { markdown: string; followUps: string[] } {
  const m = /\nFOLLOWUPS:\s*(\[[\s\S]*\])\s*$/.exec(text);
  if (!m) return { markdown: text.trim(), followUps: [] };
  let followUps: string[] = [];
  try {
    followUps = (JSON.parse(m[1]) as string[]).filter((f) => typeof f === "string").slice(0, 3);
  } catch {
    followUps = [];
  }
  return { markdown: text.slice(0, m.index).trim(), followUps };
}

function computeAnalystConfidence(
  markdown: string,
  sources: SourceRef[]
): "high" | "medium" | "low" {
  if (!sources.length) return "low";
  const citedNs = new Set([...markdown.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])));
  if (!citedNs.size) return "low";
  const citedVerified = sources.filter((s) => citedNs.has(s.n) && s.verified).length;
  return citedVerified >= 2 ? "high" : "medium";
}

/* CR08 9.1: the person responsible for each cited document, strategy node or
   lesson, resolved in one bulk pass so the answer's source cards carry the
   same person chip the item's own page does. Never fails the answer. */
async function attachSourceOwners(sources: SourceRef[]): Promise<void> {
  const wanted = sources.filter((s) =>
    ["document", "node", "lesson"].includes(s.resource_type)
  );
  if (!wanted.length) return;
  try {
    const { ownerKey, resolveOwners } = await import("@/server/services/owner-lookup");
    const owners = await resolveOwners(
      wanted.map((s) => ({ type: s.resource_type, id: s.resource_id }))
    );
    for (const s of wanted) {
      const owner = owners[ownerKey(s.resource_type, s.resource_id)];
      if (owner) s.owner = owner;
    }
  } catch {
    /* an answer is worth more than a person chip */
  }
}

/* ---------------- the loop ---------------- */

/* CR08 2.3: the item the reader is looking at when asking from the panel */
export type AnalystContextItem = {
  kind: string;
  id: string;
  code?: string | null;
  title: string;
};

/** One line prepended to the user turn so "this project" resolves. */
function contextItemLine(item: AnalystContextItem | null | undefined): string {
  if (!item) return "";
  const kind = item.kind.replace(/_/g, " ");
  return `The user is looking at ${kind} ${item.title}${item.code ? ` (${item.code})` : ""}; "this" and "it" refer to that item.\n`;
}

/** Mock mode: read the item directly before the planned tools run. */
function contextItemTool(
  item: AnalystContextItem | null | undefined
): { name: string; input: Record<string, unknown> } | null {
  if (!item) return null;
  switch (item.kind) {
    case "document":
      return { name: "get_document", input: { id: item.id } };
    case "project":
    case "initiative":
    case "outcome":
    case "target":
      return { name: "get_node", input: { id: item.id } };
    case "indicator":
      return { name: "get_indicator_series", input: { indicator_id: item.id } };
    case "index":
      return { name: "get_index", input: { code: item.code ?? item.title } };
    case "council_node":
      return { name: "get_council_node", input: { id: item.id } };
    case "unit":
      return { name: "get_org_unit", input: { name_or_code: item.code ?? item.title } };
    default:
      return { name: "search_knowledge", input: { query: item.title, limit: 5 } };
  }
}

/**
 * The planned tools, run directly. This is the whole gather in mock mode, and
 * it is also the rescue when a live gather call fails: without it the answer
 * would be written from nothing and would tell the reader the memory holds
 * no answer, when in truth only the model call failed.
 */
async function* gatherFromPlan(
  ctx: { user: CurrentUser; state: AnalystState },
  plan: { tools: MockPlannedTool[] },
  contextItem: AnalystContextItem | null | undefined,
  toolOutputs: { name: string; output: string }[],
  deadline: number
): AsyncGenerator<AnalystEvent> {
  const { state } = ctx;
  const itemTool = contextItemTool(contextItem);
  const plannedTools =
    itemTool && !plan.tools.some((t) => t.name === itemTool.name) ? [itemTool, ...plan.tools] : plan.tools;
  for (const t of plannedTools) {
    if (state.toolCalls >= MAX_TOOL_CALLS || Date.now() > deadline) break;
    yield { type: "chip", ...chipFor(t.name, t.input) };
    const output = await runTool(ctx, t.name, t.input);
    toolOutputs.push({ name: t.name, output });
    if (t.name === "query_indicators" && !/No indicators matched/.test(output)) {
      const code = /code=([a-z0-9_]+)/i.exec(output)?.[1];
      if (code && state.toolCalls < MAX_TOOL_CALLS) {
        yield { type: "chip", ...chipFor("get_indicator_series", {}) };
        const seriesOut = await runTool(ctx, "get_indicator_series", { code });
        toolOutputs.push({ name: "get_indicator_series", output: seriesOut });
      }
    }
    // chain: at-risk list feeds what_changed already planned; node ids not needed
  }
}

export async function* analystStream(params: {
  user: CurrentUser;
  message: string;
  locale: string;
  conversationId: string;
  context?: { type: string; id: string } | null;
  contextItem?: AnalystContextItem | null;
}): AsyncGenerator<AnalystEvent> {
  const { user, message, locale, conversationId } = params;
  const settings = await getAiSettings();
  const live = await aiLive();
  const state = new AnalystState();
  const ctx = { user, state };
  const history = await conversationHistory(conversationId);

  /* plan */
  let plan = mockAnalystPlan(message, history.lastUserMessage);
  if (live) {
    const livePlan = await callJson<{
      lang: string;
      complexity: "simple" | "complex";
      refers_to_history: boolean;
      rewritten_query: string;
    }>(
      "system_analyst_planner",
      `Question: ${message}\nConversation summary: ${history.summary ?? "none"}\nRecent turns:\n${history.turns
        .slice(-6)
        .map((t) => `${t.role}: ${t.content.slice(0, 220)}`)
        .join("\n")}`,
      { model: settings.modelFast, maxTokens: 400 }
    );
    if (livePlan?.rewritten_query) {
      plan = {
        ...plan,
        lang: livePlan.lang ?? plan.lang,
        complexity: livePlan.complexity ?? plan.complexity,
        rewritten: livePlan.rewritten_query,
      };
    }
  }
  const answerLang = isArabicText(params.message)
    ? "ar"
    : plan.lang === "ar"
      ? "ar"
      : locale === "ar" && plan.lang !== "en"
        ? "ar"
        : plan.lang === "mixed"
          ? locale
          : "en";

  let contextNote = "";
  if (params.context?.type === "document") {
    contextNote = `\nContext: the user is asking about document id ${params.context.id}; call get_document on it first.`;
  } else if (params.context?.type === "signal") {
    const [s] = await db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.id, params.context.id))
      .limit(1);
    if (s) {
      contextNote = `\nContext: the user is asking about this signal: "${s.titleEn}" (${s.publisher ?? "-"}): ${s.descriptionEn ?? ""} Why it matters: ${s.whyItMattersEn ?? ""}. Use get_signals/search_knowledge for related material.`;
    }
  }

  const deadline = Date.now() + GATHER_BUDGET_MS;
  const toolOutputs: { name: string; output: string }[] = [];

  if (!live) {
    /* ---- mock gather: run the planned tools directly ---- */
    yield* gatherFromPlan(ctx, plan, params.contextItem, toolOutputs, deadline);
  } else {
    /* ---- live gather: Anthropic tool loop ---- */
    const { shared } = loadPrompt("system_analyst_planner");
    const { shared: sharedCtx, specific } = loadPrompt("system_analyst");
    void shared;
    const model = plan.complexity === "complex" ? settings.modelBrief : settings.modelDefault;
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: sharedCtx, cache_control: { type: "ephemeral" } },
      { type: "text", text: specific },
    ];
    const messages: Anthropic.MessageParam[] = [];
    if (history.summary) {
      messages.push({
        role: "user",
        content: `Summary of the earlier conversation: ${history.summary}`,
      });
      messages.push({ role: "assistant", content: "Understood." });
    }
    for (const t of history.turns) {
      messages.push({ role: t.role, content: t.content || "…" });
    }
    messages.push({
      role: "user",
      content: `${contextItemLine(params.contextItem)}Question (answer language: ${answerLang}): ${plan.rewritten}${contextNote}\nGather evidence now. Budget: ${MAX_TOOL_CALLS} tool calls, then reply READY.`,
    });

    let currentModel = model;
    let rounds = 0;
    while (state.toolCalls < MAX_TOOL_CALLS && Date.now() < deadline && rounds < 10) {
      rounds++;
      let response: Anthropic.Message;
      try {
        response = await getClient().messages.create({
          model: currentModel,
          max_tokens: 3000,
          system,
          tools: TOOL_DEFINITIONS as Anthropic.Tool[],
          messages,
        });
      } catch (e) {
        if (currentModel !== settings.modelDefault) {
          currentModel = settings.modelDefault; // opus unavailable: fall back
          continue;
        }
        noteAiFailure(e);
        console.error("[analyst] gather call failed", (e as Error)?.message);
        break;
      }
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (!toolUses.length || response.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (state.toolCalls >= MAX_TOOL_CALLS) {
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Tool budget exhausted; answer with what you have.",
          });
          continue;
        }
        yield { type: "chip", ...chipFor(tu.name, tu.input as Record<string, unknown>) };
        const output = await runTool(ctx, tu.name, tu.input as Record<string, unknown>);
        toolOutputs.push({ name: tu.name, output });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: output.slice(0, 6000) });
      }
      messages.push({ role: "user", content: results });
    }

    /* workspace + sources before the answer streams */
    await attachSourceOwners(state.sources);
    yield { type: "workspace", workspace: state.workspace };
    yield { type: "sources", citations: state.sources };

    /* ---- answer phase: streamed ---- */
    messages.push({
      role: "user",
      content: `Now write the final answer in ${answerLang === "ar" ? "Arabic (native MSA)" : "English"} following the answer phase protocol: under 180 words, [n] citations from the numbered sources above, facts vs calculations vs assessment kept distinct, then the FOLLOWUPS line.`,
    });
    let full = "";
    let sentUpTo = 0;
    const HOLDBACK = 16; // keep enough back that "FOLLOWUPS:" never leaks mid-stream
    try {
      const stream = getClient().messages.stream({
        model: currentModel,
        max_tokens: 2000,
        system,
        tools: TOOL_DEFINITIONS as Anthropic.Tool[],
        messages,
      });
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          full += ev.delta.text;
          const followIdx = full.indexOf("FOLLOWUPS:");
          const safeEnd = followIdx >= 0 ? followIdx : Math.max(0, full.length - HOLDBACK);
          if (safeEnd > sentUpTo) {
            yield { type: "delta", text: full.slice(sentUpTo, safeEnd) };
            sentUpTo = safeEnd;
          }
        }
      }
    } catch (e) {
      noteAiFailure(e);
      console.error("[analyst] answer stream failed", (e as Error)?.message);
    }
    if (full) {
      const { markdown, followUps } = splitFollowUps(full);
      if (markdown.length > sentUpTo) {
        yield { type: "delta", text: markdown.slice(sentUpTo) };
      }
      const finalFollowUps = followUps.length
        ? followUps
        : mockAnalystFollowUps([...new Set(toolOutputs.map((t) => t.name))], answerLang);
      yield {
        type: "final",
        markdown,
        citations: state.sources,
        confidence: computeAnalystConfidence(markdown, state.sources),
        followUps: finalFollowUps,
        workspace: state.workspace,
        includesSecret: state.sources.some((s) => (s.classification ?? 1) >= 4),
      };
      return;
    }
    // live answer failed entirely: fall through to the mock writer below
  }

  /* ---- mock answer path (also the live-failure fallback) ---- */
  /* A live gather whose calls all failed (an unreachable, refusing or
     out-of-credit API) leaves the analyst with no evidence at all, and the
     fallback writer would then tell the reader that EnviroAI holds nothing on
     the question. Run the planned tools first, so the fallback answer is
     grounded in the same real sources mock mode uses and the citations under
     it are genuine. */
  if (live && !toolOutputs.length) {
    yield* gatherFromPlan(ctx, plan, params.contextItem, toolOutputs, Date.now() + GATHER_BUDGET_MS);
  }
  await attachSourceOwners(state.sources);
  yield { type: "workspace", workspace: state.workspace };
  yield { type: "sources", citations: state.sources };
  const markdown = mockAnalystAnswer(toolOutputs, answerLang);
  for (let i = 0; i < markdown.length; i += 90) {
    yield { type: "delta", text: markdown.slice(i, i + 90) };
  }
  yield {
    type: "final",
    markdown,
    citations: state.sources,
    confidence: computeAnalystConfidence(markdown, state.sources),
    followUps: mockAnalystFollowUps([...new Set(toolOutputs.map((t) => t.name))], answerLang),
    workspace: state.workspace,
    includesSecret: state.sources.some((s) => (s.classification ?? 1) >= 4),
  };
}
