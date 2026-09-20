"use client";
// CR08 6.2: the AI knowledge capture interview. One panel per topic (a
// project, a tacit topic, or a general interview): the AI question in both
// languages, the answer by text or by voice (the Speak panel's recorder
// and transcription), the transcript, Complete. Used by My Handover, by the
// administrator on behalf of an external, and by the token workspace.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Languages, MessageSquareText, Mic, Sparkles } from "lucide-react";
import { Button, Chip, Label, Textarea, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import type { InterviewTopic, InterviewView } from "@/server/services/handover";
import { SpeakPanel } from "../../add/SpeakPanel";
import { api } from "./bits";

type Mode = { kind: "user"; handoverId: string } | { kind: "token"; token: string };

export function InterviewPanel({
  mode,
  topics,
  interviews,
  required,
  readOnly,
  onChange,
}: {
  mode: Mode;
  topics: InterviewTopic[];
  interviews: InterviewView[];
  required: boolean;
  readOnly?: boolean;
  onChange?: () => void;
}) {
  const t = useTranslations("handover.interview");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [voice, setVoice] = React.useState(false);
  const [showOther, setShowOther] = React.useState(false);
  const [local, setLocal] = React.useState<Record<string, InterviewView>>({});
  const [done, setDone] = React.useState<Record<string, boolean>>({});

  const active = topics.find((x) => x.key === activeKey) ?? null;
  const interviewOf = (topic: InterviewTopic): InterviewView | null => {
    if (topic.interviewId && local[topic.interviewId]) return local[topic.interviewId];
    return interviews.find((i) => i.id === topic.interviewId) ?? null;
  };

  async function call<T>(userPath: string, userInit: RequestInit, tokenBody: Record<string, unknown>) {
    if (mode.kind === "user") return api<T>(`/api/v1/handover/${mode.handoverId}/interviews${userPath}`, userInit);
    return api<T>(`/api/v1/handover/access/${mode.token}`, { method: "POST", body: JSON.stringify(tokenBody) });
  }

  async function start(topic: InterviewTopic) {
    setBusy(topic.key);
    try {
      const body = { topic: topic.topic, refType: topic.refType === "topic" && !topic.refId ? "general" : topic.refType, refId: topic.refId };
      const res = await call<InterviewView>("", { method: "POST", body: JSON.stringify(body) }, { action: "interview_start", ...body });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      setLocal((m) => ({ ...m, [res.data!.id]: res.data! }));
      topic.interviewId = res.data.id;
      setActiveKey(topic.key);
      onChange?.();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function send(iv: InterviewView) {
    const text = answer.trim();
    if (!text) return;
    setBusy("answer");
    try {
      const res = await call<InterviewView & { done: boolean }>("", { method: "PATCH", body: JSON.stringify({ action: "answer", interviewId: iv.id, text }) }, { action: "interview_answer", interviewId: iv.id, text });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      setLocal((m) => ({ ...m, [iv.id]: res.data! }));
      setDone((d) => ({ ...d, [iv.id]: Boolean(res.data!.done) }));
      setAnswer("");
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function complete(iv: InterviewView) {
    setBusy("complete");
    try {
      const res = await call<InterviewView>("", { method: "PATCH", body: JSON.stringify({ action: "complete", interviewId: iv.id }) }, { action: "interview_complete", interviewId: iv.id });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      setLocal((m) => ({ ...m, [iv.id]: res.data! }));
      toast(t("completedToast"), "success");
      onChange?.();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  const complete_ = topics.filter((x) => interviewOf(x)?.status === "complete").length;

  return (
    <section className="card p-5" data-testid="interview-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink-900">{t("title")}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={required ? "maroon" : "sand"}>{required ? t("mandatory") : t("optional")}</Chip>
          <Chip tone={complete_ ? "ok" : "sand"} className="tnum">
            {t("completeCount", { complete: complete_, total: topics.length })}
          </Chip>
        </div>
      </div>

      {!topics.length ? (
        <EmptyState icon={<MessageSquareText />} title={t("noTopics")} hint={t("noTopicsHint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* a person with many projects has many topics: the list scrolls
              instead of pushing the question panel down the page */}
          <ul className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pe-1" role="list" aria-label={t("topics")}>
            {topics.map((topic) => {
              const iv = interviewOf(topic);
              const status = iv?.status ?? "pending";
              const isActive = activeKey === topic.key;
              return (
                <li key={topic.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(topic.key)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                      isActive ? "border-maroon-300 bg-maroon-50" : "border-sand-200 bg-white hover:border-maroon-300"
                    )}
                    aria-pressed={isActive}
                    data-testid="interview-topic"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                        status === "complete" ? "bg-ok text-white" : status === "in_progress" ? "bg-gulf-100 text-gulf-600" : "bg-sand-100 text-ink-400"
                      )}
                      aria-hidden
                    >
                      {status === "complete" ? <Check className="size-3" /> : status === "in_progress" ? iv?.answers ?? 0 : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{bi(locale, topic.topic, topic.topicAr)}</span>
                    <span className="text-[10px] text-ink-400">{t(`state.${status}` as never)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-h-64 rounded-xl border border-sand-200 bg-sand-50/60 p-4">
            {!active ? (
              <p className="flex h-full items-center justify-center text-sm text-ink-600">{t("pickTopic")}</p>
            ) : (
              <TopicView
                topic={active}
                interview={interviewOf(active)}
                readOnly={Boolean(readOnly)}
                busy={busy}
                answer={answer}
                setAnswer={setAnswer}
                voice={voice}
                setVoice={setVoice}
                showOther={showOther}
                setShowOther={setShowOther}
                onStart={() => start(active)}
                onSend={(iv) => send(iv)}
                onComplete={(iv) => complete(iv)}
                isDone={(iv) => Boolean(done[iv.id])}
                reduced={Boolean(reduced)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function TopicView({
  topic,
  interview,
  readOnly,
  busy,
  answer,
  setAnswer,
  voice,
  setVoice,
  showOther,
  setShowOther,
  onStart,
  onSend,
  onComplete,
  isDone,
  reduced,
}: {
  topic: InterviewTopic;
  interview: InterviewView | null;
  readOnly: boolean;
  busy: string | null;
  answer: string;
  setAnswer: (s: string) => void;
  voice: boolean;
  setVoice: (v: boolean) => void;
  showOther: boolean;
  setShowOther: (v: boolean) => void;
  onStart: () => void;
  onSend: (iv: InterviewView) => void;
  onComplete: (iv: InterviewView) => void;
  isDone: (iv: InterviewView) => boolean;
  reduced: boolean;
}) {
  const t = useTranslations("handover.interview");
  const locale = useLocale();
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const transcript = interview?.transcript ?? [];
  const lastAi = [...transcript].reverse().find((e) => e.role === "ai") ?? null;
  const questionText = (e: { en?: string; ar?: string; text: string }) => (locale === "ar" ? e.ar ?? e.text : e.en ?? e.text);
  const otherText = (e: { en?: string; ar?: string; text: string }) => (locale === "ar" ? e.en ?? e.text : e.ar ?? e.text);

  if (!interview) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-3">
        <p className="font-medium text-ink-900">{bi(locale, topic.topic, topic.topicAr)}</p>
        <p className="max-w-md text-sm text-ink-600">{t("startHint")}</p>
        {readOnly ? (
          <Chip tone="sand">{t("state.pending")}</Chip>
        ) : (
          <Button onClick={onStart} loading={busy === topic.key} data-testid="interview-start">
            <Sparkles /> {t("start")}
          </Button>
        )}
      </div>
    );
  }

  if (interview.status === "complete") {
    const s = interview.structured;
    return (
      <div className="flex flex-col gap-3" data-testid="interview-complete">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ok">
            <Check className="size-3" /> {t("state.complete")}
          </Chip>
          <span className="text-xs text-ink-600 tnum">{t("answersCount", { count: interview.answers })}</span>
          {interview.insightLessonId ? (
            <Link href={`/lessons?lesson=${interview.insightLessonId}` as never} className="link-draw ms-auto text-xs font-medium text-maroon-700">
              {t("openInsight")}
            </Link>
          ) : null}
        </div>
        {s ? (
          <div className="rounded-lg bg-white p-4 text-sm leading-relaxed text-ink-900">
            <p className="font-medium">{bi(locale, s.titleEn, s.titleAr)}</p>
            <p className="mt-1 text-ink-600">{bi(locale, s.summaryEn, s.summaryAr)}</p>
            {(["decisions", "contacts", "pitfalls", "locations"] as const).map((k) =>
              s[k].length ? (
                <div key={k} className="mt-3">
                  <p className="text-[11px] font-semibold uppercase text-ink-400">{t(`areas.${k}`)}</p>
                  <ul className="mt-1 list-disc ps-5 text-ink-900">
                    {s[k].map((line, i) => (
                      <li key={i}>{bi(locale, line.en, line.ar)}</li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        ) : null}
        <TranscriptToggle open={transcriptOpen} setOpen={setTranscriptOpen} transcript={transcript} questionText={questionText} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="interview-active">
      <AnimatePresence mode="wait" initial={false}>
        {lastAi ? (
          <motion.div
            key={lastAi.at}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="rounded-xl border border-maroon-100 bg-white p-4"
          >
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-maroon-700">
              <Sparkles className="size-3.5" aria-hidden /> {t("aiAsks")}
              <button
                type="button"
                onClick={() => setShowOther(!showOther)}
                className="ms-auto inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case text-ink-600 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-gold-500"
                aria-pressed={showOther}
              >
                <Languages className="size-3.5" aria-hidden /> {t("otherLanguage")}
              </button>
            </p>
            <p className="text-base leading-relaxed text-ink-900" data-testid="interview-question">
              {questionText(lastAi)}
            </p>
            {showOther ? (
              <p className="mt-2 border-t border-sand-100 pt-2 text-sm leading-relaxed text-ink-600" dir="auto">
                {otherText(lastAi)}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {readOnly ? null : isDone(interview) ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-600">{t("readyToComplete")}</p>
          <Button onClick={() => onComplete(interview)} loading={busy === "complete"} data-testid="interview-complete-button">
            <Check /> {t("complete")}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <Label htmlFor="interview-answer" className="mb-0">
              {t("yourAnswer")}
            </Label>
            <button
              type="button"
              onClick={() => setVoice(!voice)}
              className={cn(
                "ms-auto inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                voice ? "border-maroon-300 bg-maroon-50 text-maroon-900" : "border-sand-300 text-ink-600 hover:text-ink-900"
              )}
              aria-pressed={voice}
              data-testid="interview-voice-toggle"
            >
              <Mic className="size-3.5" aria-hidden /> {t("byVoice")}
            </button>
          </div>
          {voice ? (
            <SpeakPanel whisperAvailable={false} transcript={answer} setTranscript={setAnswer} onAudioReady={() => {}} />
          ) : (
            <Textarea
              id="interview-answer"
              rows={4}
              dir="auto"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t("answerPlaceholder")}
              data-testid="interview-answer"
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onSend(interview)} loading={busy === "answer"} disabled={!answer.trim()} data-testid="interview-send">
              {t("send")}
            </Button>
            {interview.answers >= 3 ? (
              <Button size="sm" variant="secondary" onClick={() => onComplete(interview)} loading={busy === "complete"} data-testid="interview-complete-early">
                <Check /> {t("complete")}
              </Button>
            ) : null}
            <span className="ms-auto text-xs text-ink-400 tnum">{t("answersCount", { count: interview.answers })}</span>
          </div>
        </div>
      )}

      <TranscriptToggle open={transcriptOpen} setOpen={setTranscriptOpen} transcript={transcript} questionText={questionText} />
    </div>
  );
}

function TranscriptToggle({
  open,
  setOpen,
  transcript,
  questionText,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  transcript: { role: "ai" | "person"; text: string; en?: string; ar?: string; at: string }[];
  questionText: (e: { en?: string; ar?: string; text: string }) => string;
}) {
  const t = useTranslations("handover.interview");
  const id = React.useId();
  if (!transcript.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-gold-500"
        aria-expanded={open}
        aria-controls={id}
        data-testid="interview-transcript-toggle"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden /> {t("transcript")}
        <span className="tnum text-ink-400">({transcript.length})</span>
      </button>
      {open ? (
        <ol id={id} className="mt-2 flex flex-col gap-1.5" data-testid="interview-transcript">
          {transcript.map((e, i) => (
            <li
              key={i}
              className={cn("max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed", e.role === "ai" ? "bg-white text-ink-900" : "ms-auto bg-maroon-100/60 text-maroon-900")}
              dir="auto"
            >
              {e.role === "ai" ? questionText(e) : e.text}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function InterviewSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-5 w-48" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
