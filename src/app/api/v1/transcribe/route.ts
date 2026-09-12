// CR02 5.2: server-side transcription upgrade path. Only used when
// OPENAI_API_KEY is set; the browser's speech recognition is the default and
// mock path. Tries gpt-4o-transcribe, falls back to whisper-1.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";

export const maxDuration = 120;

export async function GET() {
  // capability probe for the client
  return NextResponse.json({
    data: { available: Boolean(process.env.OPENAI_API_KEY) },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ data: null, error: "no_key" }, { status: 501 });
  }
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof File)) {
    return NextResponse.json({ data: null, error: "audio_required" }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: "audio_too_large" }, { status: 413 });
  }
  const language = String(form.get("language") ?? ""); // "ar" | "en" | "" for mixed

  async function callModel(model: string) {
    const upstream = new FormData();
    upstream.set("file", audio as File, (audio as File).name || "recording.webm");
    upstream.set("model", model);
    if (language === "ar" || language === "en") upstream.set("language", language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: upstream,
    });
    if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`);
    const json = (await res.json()) as { text?: string };
    return json.text ?? "";
  }

  try {
    let text = "";
    try {
      text = await callModel("gpt-4o-transcribe");
    } catch {
      text = await callModel("whisper-1");
    }
    return NextResponse.json({ data: { text }, error: null });
  } catch (e) {
    return NextResponse.json(
      { data: null, error: `transcription_failed: ${String((e as Error)?.message).slice(0, 120)}` },
      { status: 502 }
    );
  }
}
