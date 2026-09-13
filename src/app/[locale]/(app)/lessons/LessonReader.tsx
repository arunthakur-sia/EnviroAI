"use client";
// CR04 3.4: reading a lesson never leaves the page. The reader expands
// inline with the full lesson in either or both languages, its links,
// Ask about this, Listen, Save, and where it has been applied.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, FolderPlus, Headphones, Languages, Loader2, MessageCircleQuestion, Recycle, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Button, Chip } from "@/components/ui/primitives";
import { CATEGORY_TONES } from "@/components/nexus/LessonCard";
import { useToast } from "@/components/ui/toast";
import type { RoomLesson } from "@/server/services/lessons";

export function useListen() {
  const t = useTranslations("lessons");
  const locale = useLocale();
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function listen(input: { lessonId?: string; themeId?: string }) {
    const key = input.lessonId ?? input.themeId ?? "";
    setBusyId(key);
    try {
      const res = await fetch("/api/v1/lessons/listen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, locale }),
      });
      const json = await res.json();
      if (res.ok && json.data?.episodeId) {
        window.dispatchEvent(
          new CustomEvent("sia:podcast:play", { detail: { id: json.data.episodeId } })
        );
        toast(json.data.created ? t("room.episodeReady") : t("room.episodeReused"), "success");
      } else {
        toast(t("room.noResults"), "error");
      }
    } catch {
      /* the toast above covers the visible failure */
    } finally {
      setBusyId(null);
    }
  }
  return { listen, busyId };
}

export function LessonReader({
  lesson,
  onClose,
}: {
  lesson: RoomLesson;
  onClose: () => void;
}) {
  const t = useTranslations("lessons");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const { listen, busyId } = useListen();
  const [both, setBoth] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const field = (en: string | null, ar: string | null) =>
    both ? (
      <span className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <span dir="ltr" className="block text-start">{en}</span>
        <span dir="rtl" className="block text-start" style={{ fontFamily: "var(--font-arabic)" }}>{ar}</span>
      </span>
    ) : (
      bi(locale, en ?? "", ar ?? "")
    );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/collections");
      const collections = (await res.json()).data as { id: string }[];
      if (collections?.[0]) {
        const post = await fetch("/api/v1/collections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            collectionId: collections[0].id,
            resourceType: "lesson",
            resourceId: lesson.id,
          }),
        });
        if (post.ok) toast(t("room.savedToast"), "success");
        else toast(tc("error"), "error");
      }
    } catch {
      toast(tc("error"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
      data-testid="lesson-reader"
    >
      <div className="card relative mt-3 border-s-2 border-maroon-100 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <Chip tone={CATEGORY_TONES[lesson.category] ?? "sand"}>
                {t(`categories.${lesson.category}` as never)}
              </Chip>
              {lesson.status === "verified" ? (
                <BadgeCheck className="size-4 text-gulf-600" aria-label={tc("verified")} />
              ) : null}
              {lesson.topReuse ? <Chip tone="gold">{t("room.goldMark")}</Chip> : null}
              <span className="text-[11px] text-ink-600 tnum">
                {formatDate(lesson.createdAt, locale, { style: "short" })}
              </span>
            </p>
            <h3 className="mt-1.5 text-xl leading-snug">{field(lesson.titleEn, lesson.titleAr)}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setBoth((v) => !v)}
              aria-pressed={both}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs cursor-pointer",
                both ? "border-maroon-300 bg-maroon-50 text-maroon-900" : "border-sand-300 text-ink-600"
              )}
            >
              <Languages className="size-3.5" /> {t("room.bothLanguages")}
            </button>
            <button
              onClick={onClose}
              aria-label={t("room.close")}
              className="rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed">
          {(lesson.contextEn || lesson.contextAr) ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                {t("room.context")}
              </p>
              <p className="text-ink-900">{field(lesson.contextEn, lesson.contextAr)}</p>
            </div>
          ) : null}
          {(lesson.learningEn || lesson.learningAr) ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                {t("room.learning")}
              </p>
              <p className="text-ink-900">{field(lesson.learningEn, lesson.learningAr)}</p>
            </div>
          ) : null}
          {(lesson.recommendationEn || lesson.recommendationAr) ? (
            <div className="rounded-xl bg-gulf-100/50 p-3.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-gulf-600" style={{ fontFamily: "inherit" }}>
                {t("room.recommendation")}
              </p>
              <p className="text-ink-900">{field(lesson.recommendationEn, lesson.recommendationAr)}</p>
            </div>
          ) : null}
        </div>

        {/* links + applied in */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-3.5">
          {lesson.nodeId && lesson.nodeCode ? (
            <Link href={`/strategy/${lesson.nodeId}` as never}>
              <Chip tone="sand" className="hover:bg-maroon-100 hover:text-maroon-900">
                {lesson.nodeCode}
              </Chip>
            </Link>
          ) : null}
          {lesson.outcomeNameEn ? (
            <Chip tone="maroon">{bi(locale, lesson.outcomeNameEn, lesson.outcomeNameAr ?? "")}</Chip>
          ) : null}
          {lesson.documentIds.slice(0, 3).map((docId) => (
            <Link key={docId} href={`/vault/${docId}` as never}>
              <Chip tone="ghost" className="border border-sand-300 hover:text-maroon-700">doc</Chip>
            </Link>
          ))}
          <span className="ms-auto flex items-center gap-1.5 text-[11px] text-ink-600">
            {lesson.authorNameEn ? (
              <>
                <Avatar name={lesson.authorNameEn} color={lesson.authorColor ?? "maroon"} size={18} />
                {bi(locale, lesson.authorNameEn, lesson.authorNameAr ?? lesson.authorNameEn)}
              </>
            ) : null}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-600">
          <Recycle className="size-3" aria-hidden />
          {lesson.reuseCount > 0
            ? `${t("room.appliedIn")}: ${t("reused", { count: lesson.reuseCount })}`
            : t("room.appliedNowhere")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => listen({ lessonId: lesson.id })} disabled={busyId === lesson.id}>
            {busyId === lesson.id ? <Loader2 className="animate-spin" /> : <Headphones />} {t("room.listen")}
          </Button>
          <Link href={`/ask/c/new?q=${encodeURIComponent(`Tell me more about the lesson: ${lesson.titleEn}`)}` as never}>
            <Button size="sm" variant="secondary">
              <MessageCircleQuestion /> {t("room.askAboutThis")}
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <FolderPlus />} {t("room.saveLesson")}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
