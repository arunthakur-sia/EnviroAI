// CR02 7.3: the report narrative. Sonnet for working level, Opus for
// Leadership; extractive mock with identical shape when AI is not live.
import { aiLive, getClient, loadPrompt, extractJson } from "@/server/ai/client";
import { getAiSettings } from "@/server/settings";
import type { ReportItem, ReportOptionsInput, ReportScopeInput } from "./gather";

export type ReportNarrative = {
  title: string;
  executive_summary: string[];
  key_findings: string[];
  implications: { text: string; codes: string[] }[];
  actions: { text: string; owner: string }[];
  syntheses: Record<string, string>;
  assessment_note: string;
};

function firstSentences(text: string, n: number): string {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?؟])\s/)
    .filter(Boolean);
  return parts.slice(0, n).join(" ").trim();
}

/** Extractive mock: item summaries stitched under the same headings. */
export function mockNarrative(
  scope: ReportScopeInput,
  options: ReportOptionsInput,
  items: ReportItem[],
  lang: "en" | "ar"
): ReportNarrative {
  const ar = lang === "ar";
  const text = (i: ReportItem) => (ar ? i.textAr || i.textEn : i.textEn || i.textAr);
  const title = ar
    ? `تقرير معرفي: ${scope.labelAr || scope.labelEn}`
    : `Knowledge report: ${scope.labelEn}`;
  const syntheses: Record<string, string> = {};
  for (const i of items) {
    syntheses[i.id] =
      firstSentences(text(i), 3) ||
      (ar ? "لا يتوفر نص كافٍ لهذا العنصر." : "No usable text is available for this item.");
  }
  const summaryPool = items
    .map((i) => firstSentences(text(i), 1))
    .filter(Boolean)
    .slice(0, options.summaryLength === "full" ? 6 : 3);
  const executive = ar
    ? [
        `يجمع هذا التقرير ${items.length} عنصراً من EnviroAI حول ${scope.labelAr || scope.labelEn}. ${summaryPool.join(" ")}`,
      ]
    : [
        `This report brings together ${items.length} items from EnviroAI on ${scope.labelEn}. ${summaryPool.join(" ")}`,
      ];
  const findings = items
    .slice(0, 8)
    .map((i, idx) => {
      const line = firstSentences(text(i), 1);
      return ar
        ? `${line || (i.titleAr || i.titleEn)} (العنصر ${idx + 1})`
        : `${line || i.titleEn} (item ${idx + 1})`;
    });
  const codes = [
    ...new Set(
      items.flatMap((i) => {
        const m = (i.titleEn + " " + i.metaEn).match(/\bO\d(?:\.T\d)?\b/g);
        return m ?? [];
      })
    ),
  ].slice(0, 5);
  return {
    title,
    executive_summary: executive,
    key_findings: findings,
    implications: codes.length
      ? [
          {
            text: ar
              ? `ترتبط هذه العناصر مباشرة بالرموز الاستراتيجية ${codes.join(", ")}.`
              : `These items relate directly to strategy codes ${codes.join(", ")}.`,
            codes,
          },
        ]
      : [],
    actions: [
      ar
        ? { text: "مراجعة العناصر المدرجة وتحديث سجل الدروس والمخاطر بما يستجد.", owner: "الإدارة المعنية" }
        : {
            text: "Review the listed items and update the lessons and risk registers with what is new.",
            owner: "The responsible directorate",
          },
    ],
    syntheses,
    assessment_note: ar
      ? "هذا السرد استخلاصي آلي من نصوص العناصر نفسها؛ ما عدا الاقتباسات المباشرة يعد تلخيصاً."
      : "This narrative is extractive from the items' own text; everything except direct quotes is summary.",
  };
}

export async function writeNarrative(
  scope: ReportScopeInput,
  options: ReportOptionsInput,
  items: ReportItem[],
  lang: "en" | "ar"
): Promise<{ narrative: ReportNarrative; live: boolean }> {
  const live = await aiLive();
  if (!live || !items.length) {
    return { narrative: mockNarrative(scope, options, items, lang), live: false };
  }
  const settings = await getAiSettings();
  const model = options.audience === "leadership" ? settings.modelBrief : settings.modelDefault;
  const { shared, specific } = loadPrompt("system_report_narrative");
  const itemBlock = items
    .map(
      (i, idx) =>
        `Item ${idx + 1} [id ${i.id}] (${i.type}) "${lang === "ar" ? i.titleAr || i.titleEn : i.titleEn}" ${i.date ? `dated ${i.date.slice(0, 10)}` : ""} ${i.metaEn}\n${(lang === "ar" ? i.textAr || i.textEn : i.textEn || i.textAr).slice(0, 1200)}`
    )
    .join("\n\n");
  const request = [
    `Report language: ${lang === "ar" ? "Arabic" : "English"}.`,
    `Audience: ${options.audience}.`,
    `Executive summary: ${options.summaryLength}.`,
    `Scope: ${scope.labelEn} / ${scope.labelAr} (${scope.kind}).`,
    `Selected items (${items.length}):\n${itemBlock}`,
  ].join("\n\n");
  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 6000,
      system: [
        { type: "text", text: shared, cache_control: { type: "ephemeral" } },
        { type: "text", text: specific },
      ],
      messages: [{ role: "user", content: request.slice(0, 60000) }],
    });
    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    const parsed = extractJson<ReportNarrative>(text);
    if (parsed?.title && parsed.key_findings?.length) {
      const mock = mockNarrative(scope, options, items, lang);
      return {
        narrative: {
          ...parsed,
          executive_summary: parsed.executive_summary?.length
            ? parsed.executive_summary
            : mock.executive_summary,
          implications: parsed.implications ?? [],
          actions: parsed.actions ?? [],
          syntheses: { ...mock.syntheses, ...(parsed.syntheses ?? {}) },
          assessment_note: parsed.assessment_note ?? mock.assessment_note,
        },
        live: true,
      };
    }
  } catch (e) {
    console.error("[report narrative] live call failed:", (e as Error)?.message);
  }
  return { narrative: mockNarrative(scope, options, items, lang), live: false };
}
