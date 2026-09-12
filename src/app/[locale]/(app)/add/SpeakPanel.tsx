"use client";
// CR02 5.2: the Speak input mode. MediaRecorder always captures the audio
// (so the original is never lost); browser speech recognition transcribes
// live when no Whisper key exists, and the /api/v1/transcribe upgrade path
// runs when it does. Live waveform from a Web Audio analyser.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Circle, Info, Mic, Pause, Play, RotateCcw, Square, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label, NativeSelect, Textarea } from "@/components/ui/primitives";

type RecState = "idle" | "recording" | "paused" | "stopped";
export type SpeakLanguage = "ar" | "en" | "mixed";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MAX_SECONDS = 15 * 60;

export function SpeakPanel({
  whisperAvailable,
  transcript,
  setTranscript,
  onAudioReady,
}: {
  whisperAvailable: boolean;
  transcript: string;
  setTranscript: (s: string) => void;
  onAudioReady: (file: File | null) => void;
}) {
  const t = useTranslations("addKnowledge");
  const locale = useLocale();
  const [recState, setRecState] = React.useState<RecState>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [language, setLanguage] = React.useState<SpeakLanguage>(locale === "ar" ? "ar" : "en");
  const [transcribing, setTranscribing] = React.useState(false);
  const [speechSupported, setSpeechSupported] = React.useState(true);

  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const committedRef = React.useRef("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!whisperAvailable) setSpeechSupported(Boolean(getRecognitionCtor()));
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    mediaRef.current?.state !== "inactive" && mediaRef.current?.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function drawWaveform(analyser: AnalyserNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const bars = 48;
      const step = Math.floor(data.length / bars);
      const barWidth = width / bars;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-maroon-700") || "#8a1538";
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const h = Math.max(3, v * height * 0.9);
        ctx.beginPath();
        ctx.roundRect(i * barWidth + 1.5, (height - h) / 2, barWidth - 3, h, 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
  }

  function startRecognition() {
    if (whisperAvailable) return; // whisper path transcribes on stop
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      return;
    }
    const rec = new Ctor();
    // Mixed runs recognition in the primary language; the structuring step
    // fixes mixed segments (CR02 5.2).
    const primary = language === "mixed" ? (locale === "ar" ? "ar" : "en") : language;
    rec.lang = primary === "ar" ? "ar-QA" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) committedRef.current += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      setTranscript((committedRef.current + interim).trim());
    };
    rec.onend = () => {
      // Chrome stops recognition every ~60s; restart while recording
      if (mediaRef.current?.state === "recording") {
        try {
          rec.start();
        } catch {
          /* already restarted */
        }
      }
    };
    rec.onerror = () => {};
    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {
      setSpeechSupported(false);
    }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      committedRef.current = transcript ? transcript + " " : "";
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], "voice-note.webm", { type: blob.type });
        onAudioReady(file);
        if (whisperAvailable && blob.size > 0) {
          await transcribeFile(file);
        }
      };
      recorder.start(1000);
      mediaRef.current = recorder;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      drawWaveform(analyser);

      startRecognition();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
      setRecState("recording");
    } catch {
      setSpeechSupported(false);
    }
  }

  function pause() {
    mediaRef.current?.pause();
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    setRecState("paused");
  }

  function resume() {
    mediaRef.current?.resume();
    startRecognition();
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
    setRecState("recording");
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecState("stopped");
  }

  function reRecord() {
    cleanup();
    chunksRef.current = [];
    committedRef.current = "";
    setTranscript("");
    onAudioReady(null);
    setElapsed(0);
    setRecState("idle");
  }

  async function transcribeFile(file: File) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.set("audio", file);
      form.set("language", language === "mixed" ? "" : language);
      const res = await fetch("/api/v1/transcribe", { method: "POST", body: form });
      const json = await res.json();
      if (res.ok && json.data?.text) {
        setTranscript((transcript ? transcript + "\n" : "") + json.data.text);
      }
    } finally {
      setTranscribing(false);
    }
  }

  function onUploadAudio(file: File | null) {
    if (!file) return;
    onAudioReady(file);
    setRecState("stopped");
    if (whisperAvailable) void transcribeFile(file);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div data-testid="speak-panel">
      <div className="flex flex-wrap items-center gap-3">
        {recState === "idle" || recState === "stopped" ? (
          <button
            onClick={recState === "idle" ? start : reRecord}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-700 text-white shadow-md transition-colors hover:bg-maroon-900 cursor-pointer"
            aria-label={recState === "idle" ? t("record") : t("reRecord")}
            data-testid="record-button"
          >
            {recState === "idle" ? <Mic className="size-7" /> : <RotateCcw className="size-6" />}
          </button>
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-maroon-700 text-maroon-700">
            <Circle className={cn("size-4 fill-current", recState === "recording" && "animate-pulse")} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            width={520}
            height={56}
            className="h-14 w-full rounded-lg bg-sand-50"
            aria-hidden
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-semibold text-ink-900 tnum" aria-live="polite">
            {mm}:{ss}
          </span>
          <span className="text-[10px] text-ink-600">
            {recState === "recording" ? t("recording") : recState === "paused" ? t("paused") : ""}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {recState === "recording" ? (
          <>
            <SpeakButton onClick={pause} icon={<Pause className="size-3.5" />}>
              {t("pause")}
            </SpeakButton>
            <SpeakButton onClick={stop} icon={<Square className="size-3.5" />}>
              {t("stopRecording")}
            </SpeakButton>
          </>
        ) : recState === "paused" ? (
          <>
            <SpeakButton onClick={resume} icon={<Play className="size-3.5" />}>
              {t("resume")}
            </SpeakButton>
            <SpeakButton onClick={stop} icon={<Square className="size-3.5" />}>
              {t("stopRecording")}
            </SpeakButton>
          </>
        ) : null}
        <span className="ms-auto flex items-center gap-2">
          <Label htmlFor="speak-lang" className="mb-0">
            {t("language")}
          </Label>
          <NativeSelect
            id="speak-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SpeakLanguage)}
            className="w-auto"
            disabled={recState === "recording" || recState === "paused"}
          >
            <option value="ar">{t("langAr")}</option>
            <option value="en">{t("langEn")}</option>
            <option value="mixed">{t("langMixed")}</option>
          </NativeSelect>
        </span>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {whisperAvailable
          ? t("audioAttached")
          : speechSupported
            ? `${t("browserNote")} ${t("maxRecording")}`
            : t("noSpeechSupport")}
      </p>

      <div className="mt-3">
        <Label htmlFor="speak-transcript">
          {t("transcriptLabel")}
          {transcribing ? <span className="ms-2 text-maroon-700">{t("transcribing")}</span> : null}
        </Label>
        <Textarea
          id="speak-transcript"
          rows={7}
          dir="auto"
          value={transcript}
          onChange={(e) => {
            committedRef.current = e.target.value + " ";
            setTranscript(e.target.value);
          }}
          placeholder={t("transcriptPlaceholder")}
          className="text-base"
        />
      </div>

      <div className="mt-2">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".mp3,.m4a,.wav,.webm,audio/*"
          onChange={(e) => onUploadAudio(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-maroon-700 hover:underline cursor-pointer"
        >
          <UploadCloud className="size-3.5" /> {t("uploadAudio")}
        </button>
      </div>
    </div>
  );
}

function SpeakButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
    >
      {icon}
      {children}
    </button>
  );
}
