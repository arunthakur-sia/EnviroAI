// Nightly daily-card job: builds tomorrow's "Did you know Qatar" card from a random
// headline indicator. Seeded cards cover the first month even if this never runs.
import { desc, eq, and } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, todayIso } from "@/lib/ids";
import { callJson } from "./client";

export async function generateDailyCard(date?: string): Promise<void> {
  const target = date ?? todayIso();
  const existing = await db
    .select({ id: schema.dailyCards.id })
    .from(schema.dailyCards)
    .where(eq(schema.dailyCards.date, target))
    .limit(1);
  if (existing.length) return;

  const headliners = await db
    .select()
    .from(schema.indicators)
    .where(eq(schema.indicators.isHeadline, 1));
  if (!headliners.length) return;
  const ind = headliners[Math.floor(Math.random() * headliners.length)];
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(
      and(
        eq(schema.indicatorValues.indicatorId, ind.id),
        eq(schema.indicatorValues.dimensionKey, "total")
      )
    )
    .orderBy(desc(schema.indicatorValues.period))
    .limit(12);
  if (!values.length) return;

  type CardOut = {
    big_number: string;
    fact_en: string;
    fact_ar: string;
    hook_en: string;
    hook_ar: string;
    quiz_question_en: string;
    quiz_question_ar: string;
    options: { en: string; ar: string }[];
    correct_index: number;
    explanation_en: string;
    explanation_ar: string;
  };
  const live = await callJson<CardOut>(
    "system_daily_card",
    JSON.stringify({
      indicator: { name_en: ind.nameEn, name_ar: ind.nameAr, unit: ind.unit },
      series: values.map((v) => ({ period: v.period, value: v.value })),
    }),
    { maxTokens: 1500 }
  );

  const latest = values[0];
  const fmt = latest.value.toLocaleString("en-US", { maximumFractionDigits: ind.decimals });
  const card: CardOut =
    live && live.options?.length === 3
      ? live
      : {
          big_number: fmt,
          fact_en: `${ind.unit ?? ""} recorded for ${ind.nameEn.toLowerCase()} in ${latest.period}`.trim(),
          fact_ar: `${ind.unit ?? ""} سجلت لمؤشر ${ind.nameAr} في ${latest.period}`.trim(),
          hook_en: `One number from the National Statistics Center, every morning.`,
          hook_ar: `رقم واحد من المركز الوطني للإحصاء كل صباح.`,
          quiz_question_en: `Which period recorded this value of ${ind.nameEn}?`,
          quiz_question_ar: `في أي فترة سجلت هذه القيمة لمؤشر ${ind.nameAr}؟`,
          options: [
            { en: latest.period, ar: latest.period },
            { en: values[1]?.period ?? "2025", ar: values[1]?.period ?? "2025" },
            { en: values[2]?.period ?? "2024", ar: values[2]?.period ?? "2024" },
          ],
          correct_index: 0,
          explanation_en: `The latest recorded period is ${latest.period}.`,
          explanation_ar: `أحدث فترة مسجلة هي ${latest.period}.`,
        };

  await db.insert(schema.dailyCards).values({
    id: newId(),
    date: target,
    indicatorId: ind.id,
    factEn: card.fact_en,
    factAr: card.fact_ar,
    hookEn: card.hook_en,
    hookAr: card.hook_ar,
    quizQuestionEn: card.quiz_question_en,
    quizQuestionAr: card.quiz_question_ar,
    optionsJson: JSON.stringify(card.options),
    correctIndex: card.correct_index,
    explanationEn: card.explanation_en,
    explanationAr: card.explanation_ar,
    bigNumber: card.big_number,
  });
}
