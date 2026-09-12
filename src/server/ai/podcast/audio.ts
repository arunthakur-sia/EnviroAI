// CR02 4.5: podcast audio generation through ElevenLabs
// (eleven_multilingual_v2). Voice ids come from ELEVENLABS_VOICE_MARIAM and
// ELEVENLABS_VOICE_HAMAD; when unset, two library voices (one female, one
// male) are picked once, stored in Settings, and logged. The Text to Dialogue
// endpoint is tried first; otherwise per-segment text-to-speech with a 600ms
// break tag opening each turn, stitched by a minimal MPEG frame concatenator
// that drops ID3 tags. Intro and outro tones are skipped: no mp3 encoder is
// available in pure JS, which the CR allows (DECISIONS 45).
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getSetting, setSetting } from "@/server/settings";
import { nowIso } from "@/lib/ids";
import type { PodcastSegment } from "./script";

const API = "https://api.elevenlabs.io";
const MODEL = "eleven_multilingual_v2";

function apiKey(): string | null {
  const raw = process.env.ELEVENLABS_API_KEY ?? "";
  const cleaned = raw.replace(/^['"]|['"]$/g, "").trim();
  return cleaned || null;
}

export function studioAvailable(): boolean {
  return Boolean(apiKey());
}

/* Render progress, readable by the episode API while a render job runs.
   The job worker lives in the same process, so a module map suffices. */
export const renderProgress = new Map<string, { done: number; total: number }>();

type VoicePair = { mariam: string; hamad: string; source: string };

export async function pickVoices(): Promise<VoicePair | null> {
  const key = apiKey();
  if (!key) return null;
  const envMariam = (process.env.ELEVENLABS_VOICE_MARIAM ?? "").replace(/^['"]|['"]$/g, "").trim();
  const envHamad = (process.env.ELEVENLABS_VOICE_HAMAD ?? "").replace(/^['"]|['"]$/g, "").trim();
  if (envMariam && envHamad) return { mariam: envMariam, hamad: envHamad, source: "env" };

  const stored = await getSetting<VoicePair | null>("podcast_voices", null);
  if (stored?.mariam && stored?.hamad) return stored;

  const res = await fetch(`${API}/v1/voices`, { headers: { "xi-api-key": key } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    voices: {
      voice_id: string;
      name: string;
      labels?: Record<string, string>;
      verified_languages?: { language: string }[];
    }[];
  };
  const voices = json.voices ?? [];
  const speaksArabic = (v: (typeof voices)[number]) =>
    (v.verified_languages ?? []).some((l) => l.language?.toLowerCase().startsWith("ar")) ||
    (v.labels?.language ?? "").toLowerCase().includes("arabic");
  // multilingual v2 speaks Arabic with any voice; prefer explicitly Arabic
  // voices, fall back to gender labels across the library.
  const pool = voices.filter(speaksArabic).length >= 2 ? voices.filter(speaksArabic) : voices;
  const female =
    pool.find((v) => (v.labels?.gender ?? "").toLowerCase() === "female") ??
    voices.find((v) => (v.labels?.gender ?? "").toLowerCase() === "female");
  const male =
    pool.find(
      (v) => (v.labels?.gender ?? "").toLowerCase() === "male" && v.voice_id !== female?.voice_id
    ) ??
    voices.find(
      (v) => (v.labels?.gender ?? "").toLowerCase() === "male" && v.voice_id !== female?.voice_id
    );
  if (!female || !male) return null;
  const pair: VoicePair = { mariam: female.voice_id, hamad: male.voice_id, source: "library" };
  await setSetting("podcast_voices", { ...pair, mariamName: female.name, hamadName: male.name });
  console.log(
    `[podcast] picked library voices: Mariam=${female.name} (${female.voice_id}), Hamad=${male.name} (${male.voice_id})`
  );
  return pair;
}

/* ---------------- minimal MPEG frame tools ---------------- */

/** Strip an ID3v2 header and ID3v1 trailer, returning the raw frame bytes. */
export function stripId3(buf: Buffer): Buffer {
  let start = 0;
  if (buf.length > 10 && buf.toString("latin1", 0, 3) === "ID3") {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    start = 10 + size;
  }
  let end = buf.length;
  if (end - start > 128 && buf.toString("latin1", end - 128, end - 125) === "TAG") {
    end -= 128;
  }
  return buf.subarray(start, end);
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const SAMPLE_RATES = [44100, 48000, 32000];

/** Duration in seconds by walking MPEG-1 Layer III frame headers. */
export function mp3DurationSeconds(buf: Buffer): number {
  let i = 0;
  let frames = 0;
  let sampleRate = 44100;
  while (i + 4 < buf.length) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const bitrateIdx = (buf[i + 2] >> 4) & 0x0f;
      const srIdx = (buf[i + 2] >> 2) & 0x03;
      const padding = (buf[i + 2] >> 1) & 0x01;
      if (bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) {
        i++;
        continue;
      }
      sampleRate = SAMPLE_RATES[srIdx];
      const bitrate = BITRATES[bitrateIdx] * 1000;
      const frameLen = Math.floor((144 * bitrate) / sampleRate) + padding;
      if (frameLen <= 0) {
        i++;
        continue;
      }
      frames++;
      i += frameLen;
    } else {
      i++;
    }
  }
  return Math.round((frames * 1152) / sampleRate);
}

export function concatMp3(parts: Buffer[]): Buffer {
  return Buffer.concat(parts.map(stripId3));
}

/* ---------------- rendering ---------------- */

async function ttsSegment(
  key: string,
  voiceId: string,
  text: string,
  withBreak: boolean
): Promise<Buffer> {
  const body = {
    text: withBreak ? `<break time="0.6s" /> ${text}` : text,
    model_id: MODEL,
  };
  const res = await fetch(
    `${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`text-to-speech ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function tryDialogue(
  key: string,
  voices: VoicePair,
  segments: PodcastSegment[]
): Promise<Buffer | null> {
  try {
    const res = await fetch(`${API}/v1/text-to-dialogue?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        model_id: "eleven_v3",
        inputs: segments.map((s) => ({
          text: s.text,
          voice_id: s.speaker === "mariam" ? voices.mariam : voices.hamad,
        })),
      }),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Renders an episode's audio. Returns the provider actually used. */
export async function renderEpisodeAudio(
  episodeId: string
): Promise<{ provider: "elevenlabs" | "browser"; durationSec: number; error?: string }> {
  const [episode] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(eq(schema.podcastEpisodes.id, episodeId))
    .limit(1);
  if (!episode?.scriptJson) return { provider: "browser", durationSec: 0, error: "no_script" };
  const script = JSON.parse(episode.scriptJson) as { segments: PodcastSegment[] };
  const segments = (script.segments ?? []).filter((s) => s.text?.trim());
  const key = apiKey();

  const fallback = async (error?: string) => {
    await db
      .update(schema.podcastEpisodes)
      .set({ audioProvider: "browser", status: "published", updatedAt: nowIso() })
      .where(eq(schema.podcastEpisodes.id, episodeId));
    return { provider: "browser" as const, durationSec: episode.durationSec, error };
  };

  if (!key || !segments.length) return fallback(key ? "empty_script" : "no_key");
  const voices = await pickVoices();
  if (!voices) return fallback("no_voices");

  renderProgress.set(episodeId, { done: 0, total: segments.length });
  try {
    let audio = await tryDialogue(key, voices, segments);
    if (audio) {
      renderProgress.set(episodeId, { done: segments.length, total: segments.length });
    } else {
      const parts: Buffer[] = [];
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const voiceId = s.speaker === "mariam" ? voices.mariam : voices.hamad;
        // retry once, then fail over (CR02 0.2: retry twice total, then fallback)
        let part: Buffer;
        try {
          part = await ttsSegment(key, voiceId, s.text, i > 0);
        } catch {
          part = await ttsSegment(key, voiceId, s.text, i > 0);
        }
        parts.push(part);
        renderProgress.set(episodeId, { done: i + 1, total: segments.length });
      }
      audio = concatMp3(parts);
    }
    const durationSec = mp3DurationSeconds(stripId3(audio)) || episode.durationSec;
    const dir = path.join(process.cwd(), "data", "podcasts");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${episodeId}.mp3`);
    await fs.writeFile(filePath, audio);
    await db
      .update(schema.podcastEpisodes)
      .set({
        audioPath: `podcasts/${episodeId}.mp3`,
        audioProvider: "elevenlabs",
        durationSec,
        status: "published",
        updatedAt: nowIso(),
      })
      .where(eq(schema.podcastEpisodes.id, episodeId));
    return { provider: "elevenlabs", durationSec };
  } catch (e) {
    console.error("[podcast audio] render failed:", (e as Error)?.message);
    return fallback(String((e as Error)?.message).slice(0, 160));
  } finally {
    setTimeout(() => renderProgress.delete(episodeId), 30_000);
  }
}
