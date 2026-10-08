import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getAiSettings } from "@/server/settings";
import { callJson } from "@/server/ai/client";
import { HOME_ISO3, HOME_NAME_EN, HOME_SHORT_AR } from "@/server/indices/home";

/* CR05 4.7: the "Where Saudi Arabia leads and lags" narrative, written by the AI
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
  const setCodes = [...new Set([HOME_ISO3, ...parsed.data.countries])];
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
  const home = rows.find((r) => r.c === HOME_ISO3);
  // no published value for the home country: nothing to benchmark
  if (!home) return NextResponse.json({ data: null, error: "no_home_data" }, { status: 422 });
  const homePos = sorted.findIndex((r) => r.c === HOME_ISO3) + 1;
  const leader = sorted[0];
  const behindHome = sorted.slice(homePos).map((r) => r.c);
  const aheadOfHome = sorted.slice(0, homePos - 1).map((r) => r.c);

  const facts = {
    index: { en: index.nameEn, ar: index.nameAr },
    year: home.o.year,
    home: { rank: home.o.rank, score: home.o.score },
    position: homePos,
    of: sorted.length,
    leader: leader.c,
    leaderValue: { rank: leader.o.rank, score: leader.o.score },
    ahead: aheadOfHome,
    behind: behindHome,
  };

  const settings = await getAiSettings();
  if (!settings.mockMode) {
    const live = await callJson<{ en: string; ar: string }>(
      "system_index_forecast",
      JSON.stringify({
        task: "benchmark_narrative",
        instruction:
          "Write a short 'Where Saudi Arabia leads and lags' narrative (3-4 sentences per language) strictly from these benchmark facts. Return {\"en\": \"...\", \"ar\": \"...\"}.",
        facts,
      })
    );
    if (live?.en && live?.ar) return NextResponse.json({ data: live, error: null });
  }

  const en = [
    `In the ${index.nameEn} (${facts.year}), ${HOME_NAME_EN} stands ${homePos} of ${sorted.length} in this group${
      home.o.rank != null ? ` with a global rank of ${home.o.rank}` : ""
    }${home.o.score != null ? ` and a score of ${home.o.score}` : ""}.`,
    homePos === 1
      ? `${HOME_NAME_EN} leads the group ahead of ${behindHome.slice(0, 3).join(", ")}.`
      : `${leader.c} leads the group${leader.o.rank != null ? ` at rank ${leader.o.rank}` : ""}; ${HOME_NAME_EN} sits ahead of ${
          behindHome.length ? behindHome.slice(0, 3).join(", ") : "none of the group"
        } and behind ${aheadOfHome.slice(0, 3).join(", ")}.`,
    `Figures are the latest published values for each country; comparisons across different edition years are noted in the history table.`,
  ].join(" ");
  const ar = [
    `في ${index.nameAr} (${facts.year})، تحل ${HOME_SHORT_AR} في الموقع ${homePos} من ${sorted.length} ضمن هذه المجموعة${
      home.o.rank != null ? ` بمرتبة عالمية ${home.o.rank}` : ""
    }${home.o.score != null ? ` ودرجة ${home.o.score}` : ""}.`,
    homePos === 1
      ? `تتصدر ${HOME_SHORT_AR} المجموعة متقدمةً على ${behindHome.slice(0, 3).join("، ")}.`
      : `تتصدر ${leader.c} المجموعة${leader.o.rank != null ? ` بمرتبة ${leader.o.rank}` : ""}؛ وتتقدم ${HOME_SHORT_AR} على ${
          behindHome.length ? behindHome.slice(0, 3).join("، ") : "لا أحد في المجموعة"
        } وتأتي خلف ${aheadOfHome.slice(0, 3).join("، ")}.`,
    `الأرقام هي أحدث القيم المنشورة لكل دولة، والمقارنات بين سنوات إصدار مختلفة مبيَّنة في جدول السلسلة.`,
  ].join(" ");
  return NextResponse.json({ data: { en, ar }, error: null });
}
