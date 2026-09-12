"use client";
// CR02 4.6: the persistent mini-player docked at the bottom of the app shell.
// 56px high: play/pause, scrub, speed (1x, 1.25x, 1.5x), title, close.
// Plays rendered mp3 audio through an <audio> element, or reads the script
// with two browser voices (speechSynthesis) when audio_provider is browser.
// Playback survives navigation because the shell persists across routes.
// Dispatches "sia:podcast:segment" events so the episode page can highlight
// the line being spoken.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Pause, Play, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";

type Segment = { speaker: "mariam" | "hamad"; text: string };
type Episode = {
  id: string;
  titleEn: string;
  titleAr: string;
  language: string;
  audioProvider: string;
  audioPath: string | null;
  durationSec: number;
  segments: Segment[];
};

const SPEEDS = [1, 1.25, 1.5] as const;

function pickVoices(lang: string): { mariam: SpeechSynthesisVoice | null; hamad: SpeechSynthesisVoice | null } {
  const all = window.speechSynthesis?.getVoices() ?? [];
  const forLang = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const pool = forLang.length ? forLang : all;
  if (!pool.length) return { mariam: null, hamad: null };
  const femaleHint = /female|zira|salma|hoda|aria|jenny|sara|amina|layla|zariyah/i;
  const maleHint = /male|david|naayf|hamed|guy|mark|fahad/i;
  const female = pool.find((v) => femaleHint.test(v.name)) ?? pool[0];
  const male =
    pool.find((v) => maleHint.test(v.name) && v !== female) ??
    pool.find((v) => v !== female) ??
    pool[0];
  return { mariam: female, hamad: male };
}

export function MiniPlayer() {
  const t = useTranslations("podcast");
  const locale = useLocale();
  const [episode, setEpisode] = React.useState<Episode | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]>(1);
  const [segmentIndex, setSegmentIndex] = React.useState(0);

  const audioRef = React.useRef<HTMLAudioElement>(null);
  const ttsIndexRef = React.useRef(0);
  const ttsActiveRef = React.useRef(false);
  const listenedRef = React.useRef(0);
  const completedRef = React.useRef(false);
  const speedRef = React.useRef<(typeof SPEEDS)[number]>(1);
  const episodeRef = React.useRef<Episode | null>(null);
  episodeRef.current = episode;
  speedRef.current = speed;

  const isBrowserVoice = episode ? episode.audioProvider === "browser" || !episode.audioPath : false;

  /* segment boundaries by word share, for mp3 highlight events */
  const boundaries = React.useMemo(() => {
    if (!episode) return [];
    const words = episode.segments.map((s) => s.text.split(/\s+/).filter(Boolean).length);
    const total = Math.max(1, words.reduce((a, b) => a + b, 0));
    let acc = 0;
    return words.map((w) => (acc += w) / total);
  }, [episode]);

  const emitSegment = React.useCallback((index: number) => {
    setSegmentIndex(index);
    window.dispatchEvent(new CustomEvent("sia:podcast:segment", { detail: { index } }));
  }, []);

  const reportListen = React.useCallback(
    (seconds: number, completed: boolean) => {
      const ep = episodeRef.current;
      if (!ep) return;
      fetch(`/api/v1/podcast/${ep.id}/listen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seconds, completed }),
      }).catch(() => {});
    },
    []
  );

  /* ------- browser voice engine ------- */
  const speakFrom = React.useCallback(
    (index: number) => {
      const ep = episodeRef.current;
      if (!ep) return;
      ttsActiveRef.current = true;
      const synth = window.speechSynthesis;
      const voices = pickVoices(ep.language);
      const next = (i: number) => {
        if (!ttsActiveRef.current || !episodeRef.current) return;
        if (i >= ep.segments.length) {
          setPlaying(false);
          ttsActiveRef.current = false;
          completedRef.current = true;
          reportListen(listenedRef.current, true);
          return;
        }
        ttsIndexRef.current = i;
        emitSegment(i);
        const seg = ep.segments[i];
        const u = new SpeechSynthesisUtterance(seg.text);
        u.lang = ep.language === "ar" ? "ar-QA" : "en-US";
        const voice = seg.speaker === "mariam" ? voices.mariam : voices.hamad;
        if (voice) u.voice = voice;
        u.rate = speedRef.current;
        u.onend = () => {
          listenedRef.current += seg.text.split(/\s+/).length / 2.4;
          setTime(listenedRef.current);
          // the same 600ms pause between speakers as the studio render
          setTimeout(() => next(i + 1), 600);
        };
        synth.speak(u);
      };
      synth.cancel();
      next(index);
    },
    [emitSegment, reportListen]
  );

  const stopAll = React.useCallback(() => {
    ttsActiveRef.current = false;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  /* ------- load and play on the shell event ------- */
  React.useEffect(() => {
    async function onPlay(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      stopAll();
      try {
        const res = await fetch(`/api/v1/podcast/${id}`);
        const json = await res.json();
        if (!res.ok) return;
        const ep = json.data.episode as {
          id: string;
          titleEn: string;
          titleAr: string;
          language: string;
          audioProvider: string;
          audioPath: string | null;
          durationSec: number;
        };
        const segments = (json.data.script?.segments ?? []) as Segment[];
        const full: Episode = { ...ep, segments };
        listenedRef.current = 0;
        completedRef.current = false;
        setTime(0);
        setDuration(ep.durationSec);
        setSegmentIndex(0);
        setEpisode(full);
        setPlaying(true);
        if (ep.audioProvider !== "browser" && ep.audioPath) {
          requestAnimationFrame(() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = speedRef.current;
              void audioRef.current.play();
            }
          });
        } else {
          episodeRef.current = full;
          speakFrom(0);
        }
      } catch {
        /* leave the player as is */
      }
    }
    window.addEventListener("sia:podcast:play", onPlay);
    return () => window.removeEventListener("sia:podcast:play", onPlay);
  }, [speakFrom, stopAll]);

  /* periodic listen reporting for mp3 */
  React.useEffect(() => {
    if (!playing || !episode) return;
    const interval = setInterval(() => {
      const seconds = isBrowserVoice ? listenedRef.current : audioRef.current?.currentTime ?? 0;
      reportListen(seconds, false);
    }, 15000);
    return () => clearInterval(interval);
  }, [playing, episode, isBrowserVoice, reportListen]);

  if (!episode) return null;

  function toggle() {
    if (isBrowserVoice) {
      if (playing) {
        window.speechSynthesis.pause();
        setPlaying(false);
      } else if (window.speechSynthesis.paused && ttsActiveRef.current) {
        window.speechSynthesis.resume();
        setPlaying(true);
      } else {
        speakFrom(ttsIndexRef.current);
        setPlaying(true);
      }
    } else {
      const el = audioRef.current;
      if (!el) return;
      if (playing) el.pause();
      else void el.play();
    }
  }

  function close() {
    stopAll();
    reportListen(
      isBrowserVoice ? listenedRef.current : audioRef.current?.currentTime ?? 0,
      completedRef.current
    );
    setEpisode(null);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const progress = isBrowserVoice
    ? episode.segments.length
      ? (segmentIndex + 1) / episode.segments.length
      : 0
    : duration
      ? time / duration
      : 0;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-t border-sand-300 bg-white/95 px-4 backdrop-blur"
      data-testid="mini-player"
      role="region"
      aria-label={t("nowPlaying")}
    >
      {!isBrowserVoice && episode.audioPath ? (
        <audio
          ref={audioRef}
          src={`/api/v1/podcast/${episode.id}/audio`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            setTime(el.currentTime);
            if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
            const ratio = el.duration ? el.currentTime / el.duration : 0;
            const idx = boundaries.findIndex((b) => ratio <= b);
            if (idx >= 0 && idx !== segmentIndex) emitSegment(idx);
          }}
          onEnded={() => {
            setPlaying(false);
            completedRef.current = true;
            reportListen(duration, true);
          }}
        />
      ) : null}
      <button
        onClick={toggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-maroon-700 text-white hover:bg-maroon-900 cursor-pointer"
        aria-label={playing ? t("pauseCta") : t("play")}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <Link
          href={`/podcast/${episode.id}` as never}
          className="block truncate text-sm font-medium text-ink-900 hover:text-maroon-700"
        >
          {bi(locale, episode.titleEn, episode.titleAr)}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          {isBrowserVoice ? (
            <span
              className="h-1 flex-1 overflow-hidden rounded-full bg-sand-200"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="block h-full rounded-full bg-maroon-500 transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          ) : (
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(duration))}
              value={Math.round(time)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = v;
                setTime(v);
              }}
              className="h-1 flex-1 cursor-pointer accent-[var(--color-maroon-700)]"
              aria-label={t("nowPlaying")}
            />
          )}
          <span className="shrink-0 text-[11px] text-ink-600 tnum">
            {isBrowserVoice
              ? `${segmentIndex + 1}/${episode.segments.length}`
              : `${mm(time)} / ${mm(duration)}`}
          </span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="shrink-0 rounded-lg border border-sand-300 px-2 py-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer tnum"
        aria-label={`${speed}x`}
      >
        {speed}x
      </button>
      {isBrowserVoice ? (
        <span className={cn("hidden shrink-0 text-[11px] text-ink-600 md:block")}>
          {t("browserVoice")}
        </span>
      ) : null}
      <button
        onClick={close}
        className="shrink-0 rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 hover:text-ink-900 cursor-pointer"
        aria-label={t("closePlayer")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
