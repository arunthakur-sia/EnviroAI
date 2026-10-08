// CR01 5.3: rough notes in, structured knowledge out. Sonnet with vision for
// images; deterministic mock (mock.ts) when AI is not live.
import Anthropic from "@anthropic-ai/sdk";
import { aiLive, getClient, loadPrompt, extractJson } from "@/server/ai/client";
import { getAiSettings } from "@/server/settings";
import { getAllTerms } from "@/server/services/taxonomy";
import { mockKnowledgeStructure } from "@/server/ai/mock";

export type KnowledgeItem = {
  types: string[];
  title_en: string;
  title_ar: string;
  cleaned_en: string;
  cleaned_ar: string;
  lesson?: {
    context_en: string;
    context_ar: string;
    learning_en: string;
    learning_ar: string;
    recommendation_en: string;
    recommendation_ar: string;
  };
  signal?: {
    publisher: string;
    signal_type: string;
    impact: string;
    horizon: string;
    why_en: string;
    why_ar: string;
  };
  decision?: {
    decision_en: string;
    decision_ar: string;
    rationale_en: string;
    rationale_ar: string;
  };
  document?: {
    summary_en: string;
    summary_ar: string;
    key_facts: { text_en: string; text_ar: string }[];
  };
  expert?: {
    name_en: string;
    name_ar: string;
    organisation_en: string;
    organisation_ar: string;
    position_en: string;
    position_ar: string;
    email: string;
    domains: string[];
  };
  /* CR02 3.3: suggested lesson category (delivery|external|expert|institutional) */
  category?: string | null;
  /* CR02 3.2: the pre-filled delivery node for Delivery Lessons */
  node_link?: { id: string; code: string | null; title_en: string; title_ar: string } | null;
  topic_codes: string[];
  outcome_links: { code: string; reason_en: string; reason_ar: string }[];
  indicator_codes: string[];
  classification_level: number;
  confidence: number;
  next_step_en: string;
  next_step_ar: string;
  /** set server-side when the item came from an uploaded file */
  file_ref?: {
    storagePath: string;
    filename: string;
    mime: string;
    sizeBytes: number;
  } | null;
  machine?: boolean;
};

export type StructureInput = {
  notes: string;
  whereFrom: string;
  parsedFiles: { filename: string; text: string; mime: string }[];
  images: { filename: string; mediaType: string; base64: string }[];
  pages: { url: string; title: string; text: string }[];
  /* CR02 3.3: opened from an initiative or project page */
  nodeContext?: { id: string; code: string | null; title_en: string; title_ar: string } | null;
  categoryHint?: string | null;
};

const LESSON_CATEGORIES = new Set(["delivery", "external", "expert", "institutional"]);

/** Deterministic category fallback shared by the live post-processing and the mock. */
export function inferLessonCategory(text: string, hasNode: boolean): string {
  if (hasNode) return "delivery";
  const q = text.toLowerCase();
  if (/conference|forum|summit|study visit|delegation|external report|benchmark|مؤتمر|منتدى|زيارة|وفد|تجربة دولية/i.test(q)) {
    return "external";
  }
  if (/interview|handover|retiring|expert|professor|dr\.|mentioned|told me|مقابلة|تسليم مهام|خبير|أخبرني|الدكتور/i.test(q)) {
    return "expert";
  }
  if (/process|governance|procedure|policy of the council|ways of working|approval|عملية|حوكمة|إجراء|اعتماد|آلية عمل/i.test(q)) {
    return "institutional";
  }
  if (/project|initiative|delivery|rollout|pilot|مشروع|مبادرة|تنفيذ|تجريبي/i.test(q)) {
    return "delivery";
  }
  return "institutional";
}

/** Apply node context, category hints, and validation to structured items. */
export function applyCategoryAndNode(
  items: KnowledgeItem[],
  input: StructureInput
): KnowledgeItem[] {
  return items.map((item) => {
    const isLessonish =
      item.types[0] === "lesson" || item.types[0] === "insight" || item.types[0] === "indicator_observation";
    if (!isLessonish) return { ...item, category: null, node_link: item.node_link ?? null };
    let category = item.category && LESSON_CATEGORIES.has(item.category) ? item.category : null;
    const nodeLink = input.nodeContext ?? item.node_link ?? null;
    if (input.categoryHint && LESSON_CATEGORIES.has(input.categoryHint)) {
      category = input.categoryHint;
    }
    if (!category) {
      category = inferLessonCategory(
        `${item.title_en} ${item.cleaned_en} ${input.whereFrom}`,
        Boolean(nodeLink)
      );
    }
    return { ...item, category, node_link: nodeLink };
  });
}

const IMAGE_MEDIA = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function structureKnowledge(input: StructureInput): Promise<{
  items: KnowledgeItem[];
  live: boolean;
}> {
  const live = await aiLive();
  if (!live) {
    return { items: applyCategoryAndNode(mockKnowledgeStructure(input), input), live: false };
  }
  const settings = await getAiSettings();
  const terms = await getAllTerms();
  const topicList = terms
    .filter((t) => t.dimension === "topic")
    .map((t) => `${t.code} (${t.nameEn})`)
    .join(", ");
  const { shared, specific } = loadPrompt("system_knowledge_structurer");

  const content: Anthropic.ContentBlockParam[] = [];
  const textParts: string[] = [
    `Where is this from: ${input.whereFrom || "not stated"}`,
    `Available topic codes: ${topicList}`,
    `Outcome codes: eco_growth, fiscal_sust, workforce, cohesive_society, quality_life, env_sust, gov_excellence`,
    `Indicator codes: pop_total, gdp_real_growth, gdp_nonhydro_share, cpi_inflation, unemployment_rate, trade_balance, building_permits, lfpr_national, fdi_inflows, ghg_per_capita, solar_capacity, digital_services_share, labour_productivity_growth`,
  ];
  if (input.nodeContext) {
    textParts.push(
      `Delivery-node context: this material was captured from ${input.nodeContext.code ?? ""} "${input.nodeContext.title_en}". Lesson items are Delivery Lessons of this node unless the material clearly says otherwise.`
    );
  }
  if (input.notes.trim()) textParts.push(`Typed notes:\n${input.notes.slice(0, 12000)}`);
  for (const f of input.parsedFiles) {
    textParts.push(`File "${f.filename}":\n${f.text.slice(0, 8000)}`);
  }
  for (const p of input.pages) {
    textParts.push(`Web page "${p.title}" (${p.url}):\n${p.text.slice(0, 6000)}`);
  }
  content.push({ type: "text", text: textParts.join("\n\n---\n\n").slice(0, 60000) });
  for (const img of input.images.slice(0, 5)) {
    if (!IMAGE_MEDIA.has(img.mediaType)) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/png",
        data: img.base64,
      },
    });
    content.push({
      type: "text",
      text: `The image above is "${img.filename}". Read any text in it (it may be handwritten or slides) and include what it says in the items.`,
    });
  }

  try {
    const response = await getClient().messages.create({
      model: settings.modelDefault,
      max_tokens: 8000,
      system: [
        { type: "text", text: shared, cache_control: { type: "ephemeral" } },
        { type: "text", text: specific },
      ],
      messages: [{ role: "user", content }],
    });
    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    const parsed = extractJson<{ items: KnowledgeItem[] }>(text);
    if (parsed?.items?.length) {
      return {
        items: applyCategoryAndNode(
          parsed.items.slice(0, 8).map((i) => ({ ...i, machine: true })),
          input
        ),
        live: true,
      };
    }
  } catch (e) {
    console.error("[knowledge_structurer] live call failed:", (e as Error)?.message);
  }
  return { items: applyCategoryAndNode(mockKnowledgeStructure(input), input), live: false };
}
