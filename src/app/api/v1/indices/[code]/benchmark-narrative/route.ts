import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getAiSettings } from "@/server/settings";
import { callJson } from "@/server/ai/client";

/* CR05 4.7: the "Where Qatar leads and lags" narrative, written by the AI
   from the benchmark data (mock: templated from the same numbers). */
const Body = z.object({
  countries: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(30),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { code } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const [index] = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.code, code))
    .limit(1);
  if (!index) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const setCodes = [...new Set(["QAT", ...parsed.data.countries])];
  const obs = await db
    .select()
    .from(schema.indexObservations)
    .where(
      and(
        eq(schema.indexObservations.indexId, index.id),
        inArray(schema.indexObservations.countryCode, setCodes)
      )
    );
  const higher = index.higherIsBetter === 1;
  const latestOf = (c: string) =>
    obs
      .filter((o) => o.countryCode === c && (o.score != null || o.rank != null))
      .sort((a, b) => b.year - a.year)[0] ?? null;
  const rows = setCodes
    .map((c) => ({ c, o: latestOf(c) }))
    .filter((r) => r.o) as { c: string; o: (typeof obs)[number] }[];
  const value = (o: (typeof obs)[number]) =>
    o.rank != null ? -o.rank : higher ? o.score ?? -Infinity : -(o.score ?? Infinity);
  const sorted = rows.sort((a, b) => value(b.o) - value(a.o));
  const qatPos = sorted.findIndex((r) => r.c === "QAT") + 1;
  const leader = sorted[0];
  const behindQatar = sorted.slice(qatPos).map((r) => r.c);
  const aheadOfQatar = sorted.slice(0, qatPos - 1).map((r) => r.c);
  const qat = rows.find((r) => r.c === "QAT")!;

  const facts = {
    index: { en: index.nameEn, ar: index.nameAr },
    year: qat.o.year,
    qatar: { rank: qat.o.rank, score: qat.o.score },
    position: qatPos,
    of: sorted.length,
    leader: leader.c,
    leaderValue: { rank: leader.o.rank, score: leader.o.score },
    ahead: aheadOfQatar,
    behind: behindQatar,
  };

  const settings = await getAiSettings();
  if (!settings.mockMode) {
    const live = await callJson<{ en: string; ar: string }>(
      "system_index_forecast",
      JSON.stringify({
        task: "benchmark_narrative",
        instruction:
          "Write a short 'Where Qatar leads and lags' narrative (3-4 sentences per language) strictly from these benchmark facts. Return {\"en\": \"...\", \"ar\": \"...\"}.",
        facts,
      })
    );
    if (live?.en && live?.ar) return NextResponse.json({ data: live, error: null });
  }

  const en = [
    `In the ${index.nameEn} (${facts.year}), Qatar stands ${qatPos} of ${sorted.length} in this group${
      qat.o.rank != null ? ` with a global rank of ${qat.o.rank}` : ""
    }${qat.o.score != null ? ` and a score of ${qat.o.score}` : ""}.`,
    qatPos === 1
      ? `Qatar leads the group ahead of ${behindQatar.slice(0, 3).join(", ")}.`
      : `${leader.c} leads the group${leader.o.rank != null ? ` at rank ${leader.o.rank}` : ""}; Qatar sits ahead of ${
          behindQatar.length ? behindQatar.slice(0, 3).join(", ") : "none of the group"
        } and behind ${aheadOfQatar.slice(0, 3).join(", ")}.`,
    `Figures are the latest published values for each country; comparisons across different edition years are noted in the history table.`,
  ].join(" ");
  const ar = [
    `في ${index.nameAr} (${facts.year})، تحل قطر في الموقع ${qatPos} من ${sorted.length} ضمن هذه المجموعة${
      qat.o.rank != null ? ` بمرتبة عالمية ${qat.o.rank}` : ""
    }${qat.o.score != null ? ` ودرجة ${qat.o.score}` : ""}.`,
    qatPos === 1
      ? `تتصدر قطر المجموعة متقدمةً على ${behindQatar.slice(0, 3).join("، ")}.`
      : `تتصدر ${leader.c} المجموعة${leader.o.rank != null ? ` بمرتبة ${leader.o.rank}` : ""}؛ وتتقدم قطر على ${
          behindQatar.length ? behindQatar.slice(0, 3).join("، ") : "لا أحد في المجموعة"
        } وتأتي خلف ${aheadOfQatar.slice(0, 3).join("، ")}.`,
    `الأرقام هي أحدث القيم المنشورة لكل دولة، والمقارنات بين سنوات إصدار مختلفة مبيَّنة في جدول السلسلة.`,
  ].join(" ");
  return NextResponse.json({ data: { en, ar }, error: null });
}
