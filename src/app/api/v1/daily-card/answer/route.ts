import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";

const Body = z.object({ cardId: z.string(), chosenIndex: z.number().min(0).max(2) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const [card] = await db
    .select()
    .from(schema.dailyCards)
    .where(eq(schema.dailyCards.id, parsed.data.cardId))
    .limit(1);
  if (!card) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const isCorrect = card.correctIndex === parsed.data.chosenIndex;
  try {
    await db.insert(schema.dailyCardAnswers).values({
      id: newId(),
      userId: user.id,
      cardId: card.id,
      chosenIndex: parsed.data.chosenIndex,
      isCorrect: isCorrect ? 1 : 0,
      answeredAt: nowIso(),
    });
  } catch {
    return NextResponse.json({ data: null, error: "already_answered" }, { status: 409 });
  }
  const game = await record({
    userId: user.id,
    type: isCorrect ? "daily_quiz_correct" : "daily_quiz_wrong",
    resourceType: "daily_card",
    resourceId: card.id,
  });
  return NextResponse.json({
    data: {
      isCorrect,
      correctIndex: card.correctIndex,
      explanationEn: card.explanationEn,
      explanationAr: card.explanationAr,
      points: game.points,
    },
    error: null,
  });
}
