"use client";
// CR04 3.5: Learn mode. The page fades into a guided five-lesson session:
// one full-width reading card at a time with progress dots, Got it / Save /
// Ask about this, arrow-key navigation, then a reflection prompt whose note
// saves privately, points, and streak credit. Progress resumes within the day.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, ChevronLeft, ChevronRight, FolderPlus, Loader2, MessageCircleQuestion } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, Textarea } from "@/components/ui/primitives";
import { CATEGORY_TONES } from "@/components/nexus/LessonCard";
import { useToast } from "@/components/ui/toast";
import type { RoomLesson } from "@/server/services/lessons";

type SessionPayload = {
  id: string;
  lessons: RoomLesson[];
  index: number;
  read: string[];
  completed: boolean;
  prompts: { en: string; ar: string }[];
};

export function LearnMode({ onLeave }: { onLeave: () => void }) {
  const t = useTranslations("lessons");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const [session, setSession] = React.useState<SessionPayload | null>(null);
  const [index, setIndex] = React.useState(0);
  const [read, setRead] = React.useState<Set<string>>(new Set());
  const [phase, setPhase] = React.useState<"reading" | "reflection" | "done">("reading");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [promptIndex] = React.useState(() => Math.floor(Math.random() * 3));

  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/learn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!alive || !json.data) return;
        const payload = json.data as SessionPayload;
        setSession(payload);
        setIndex(payload.index);
        setRead(new Set(payload.read));
        if (payload.completed) setPhase("done");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const lesson = session?.lessons[index] ?? null;
  const count = session?.lessons.length ?? 0;

  const gotIt = React.useCallback(async () => {
    if (!session || !lesson) return;
    if (!read.has(lesson.id)) {
      setRead((prev) => new Set(prev).add(lesson.id));
      void fetch("/api/v1/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "read",
          sessionId: session.id,
          lessonId: lesson.id,
          index: Math.min(index + 1, count - 1),
        }),
      });
    }
    if (index + 1 >= count) setPhase("reflection");
    else setIndex(index + 1);
  }, [session, lesson, read, index, count]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "reading") return;
      const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
      const fwd = locale === "ar" ? "ArrowLeft" : "ArrowRight";
      if (e.key === back && index > 0) setIndex(index - 1);
      if (e.key === fwd && index < count - 1) setIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, index, count, locale]);

  async function finish() {
    if (!session) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          sessionId: session.id,
          reflection:
            note.trim().length >= 8 && lesson
              ? { lessonId: session.lessons[count - 1]?.id ?? lesson.id, text: note.trim() }
              : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.data?.points) toast(t("room.sessionDone", { points: json.data.points }), "points");
        if (json.data?.reflectionPoints) {
          toast(t("room.reflectionSaved", { points: json.data.reflectionPoints }), "points");
        }
        setPhase("done");
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveLesson(lessonId: string) {
    try {
      const res = await fetch("/api/v1/collections");
      const collections = (await res.json()).data as { id: string }[];
      if (collections?.[0]) {
        await fetch("/api/v1/collections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ collectionId: collections[0].id, resourceType: "lesson", resourceId: lessonId }),
        });
        toast(t("room.savedToast"), "success");
      }
    } catch {
      toast(tc("error"), "error");
    }
  }

  const prompt = session?.prompts[promptIndex % Math.max(1, session.prompts.length)] ?? null;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl"
      data-testid="learn-session"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl">{t("room.sessionTitle")}</h2>
        <div className="flex items-center gap-3">
          {/* progress dots (1 of 5) */}
          <span className="flex items-center gap-1.5" aria-label={t("room.sessionOf", { index: Math.min(index + 1, count), count })}>
            {Array.from({ length: count }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i < index || phase !== "reading" ? "bg-navy-700" : i === index ? "bg-navy-500 ring-2 ring-navy-100" : "bg-mist-300"
                )}
                aria-hidden
              />
            ))}
          </span>
          <span className="text-xs text-ink-600 tnum">
            {t("room.sessionOf", { index: Math.min(index + 1, count), count: count || 5 })}
          </span>
          <Button size="sm" variant="ghost" onClick={onLeave} data-testid="leave-session">
            {t("room.leaveSession")}
          </Button>
        </div>
      </div>

      {!session ? (
        <div className="card flex h-64 items-center justify-center" aria-busy>
          <Loader2 className="size-6 animate-spin text-navy-700" />
        </div>
      ) : phase === "done" ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Check className="size-8 text-ok" />
          <p className="text-sm text-ink-600">{t("room.sessionCompletedToday")}</p>
          <Button size="sm" variant="secondary" onClick={onLeave}>
            {t("room.close")}
          </Button>
        </div>
      ) : phase === "reflection" ? (
        <div className="card p-6">
          <p className="text-lg" style={{ fontFamily: locale === "ar" ? "var(--font-kufi)" : "var(--font-display)" }}>
            {prompt ? bi(locale, prompt.en, prompt.ar) : t("room.reflectionTitle")}
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("room.reflectionPlaceholder")}
            rows={4}
            className="mt-3"
            data-testid="reflection-input"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={finish} loading={busy} data-testid="finish-session">
              {t("room.finishSession")}
            </Button>
          </div>
        </div>
      ) : lesson ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lesson.id}
            initial={reduced ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="card p-6"
          >
            <p className="flex flex-wrap items-center gap-2">
              <Chip tone={CATEGORY_TONES[lesson.category] ?? "mist"}>
                {t(`categories.${lesson.category}` as never)}
              </Chip>
              {lesson.nodeCode ? <Chip tone="mist">{lesson.nodeCode}</Chip> : null}
              {lesson.outcomeNameEn ? (
                <Chip tone="navy">{bi(locale, lesson.outcomeNameEn, lesson.outcomeNameAr ?? "")}</Chip>
              ) : null}
            </p>
            <h3 className="mt-2 text-xl leading-snug">{bi(locale, lesson.titleEn, lesson.titleAr)}</h3>
            {(lesson.contextEn || lesson.contextAr) ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {bi(locale, lesson.contextEn ?? "", lesson.contextAr ?? "")}
              </p>
            ) : null}
            {(lesson.learningEn || lesson.learningAr) ? (
              <p className="mt-3 text-[15px] leading-relaxed text-ink-900">
                {bi(locale, lesson.learningEn ?? "", lesson.learningAr ?? "")}
              </p>
            ) : null}
            {(lesson.recommendationEn || lesson.recommendationAr) ? (
              <p className="mt-3 rounded-xl bg-teal-100/50 p-3.5 text-sm leading-relaxed text-ink-900">
                {bi(locale, lesson.recommendationEn ?? "", lesson.recommendationAr ?? "")}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={gotIt} data-testid="got-it">
                <Check /> {t("room.gotIt")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => saveLesson(lesson.id)}>
                <FolderPlus /> {t("room.sessionSave")}
              </Button>
              <Link href={`/ask/c/new?q=${encodeURIComponent(`Tell me more about the lesson: ${lesson.titleEn}`)}` as never}>
                <Button size="sm" variant="secondary">
                  <MessageCircleQuestion /> {t("room.askAboutThis")}
                </Button>
              </Link>
              <span className="ms-auto flex items-center gap-1">
                <button
                  onClick={() => setIndex(Math.max(0, index - 1))}
                  disabled={index === 0}
                  aria-label={t("room.close")}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="size-4 flip-rtl" />
                </button>
                <button
                  onClick={() => setIndex(Math.min(count - 1, index + 1))}
                  disabled={index >= count - 1}
                  aria-label={t("room.gotIt")}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="size-4 flip-rtl" />
                </button>
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </motion.div>
  );
}
