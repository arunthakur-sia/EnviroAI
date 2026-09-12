// CR01 3.1: the onboarding quest was removed. This endpoint is retired
// (the file remains because deletion is blocked in this environment).
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { data: null, error: "onboarding_quest_removed" },
    { status: 410 }
  );
}
