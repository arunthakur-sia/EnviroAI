"use client";
// CR08 8: "Set as Knowledge of the Week" for Super Admins and Knowledge
// Admins on a verified document, lesson, study or report page. The dialog
// picks the week (this week, next week, or any Monday), takes the note in
// both languages, shows the reveal exactly as colleagues will see it, and
// asks before replacing a week that already has a pick.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Star, AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button, Input, Label, Textarea, Skeleton, Chip } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { KowCard, KowResourceType } from "@/server/services/knowledge-of-week";
import { KowCardBody } from "./KowCardBody";
import { addDaysIso, mondayOf, resetKowIds } from "./client";

type Existing = { id: string; titleEn: string; titleAr: string; weekStart: string; status: string };
type Preview = KowCard & { eligible: boolean };
type WeekMode = "this" | "next" | "custom";

export function SetKnowledgeOfWeekButton({
  resourceType,
  resourceId,
  titleEn,
  titleAr,
  numerals,
  size = "sm",
  className,
}: {
  resourceType: KowResourceType;
  resourceId: string;
  titleEn: string;
  titleAr: string;
  numerals?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("kow");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const thisWeek = React.useMemo(() => mondayOf(new Date()), []);
  const nextWeek = React.useMemo(() => addDaysIso(thisWeek, 7), [thisWeek]);

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<WeekMode>("this");
  const [custom, setCustom] = React.useState(addDaysIso(thisWeek, 14));
  const [snapped, setSnapped] = React.useState(false);
  const [noteEn, setNoteEn] = React.useState("");
  const [noteAr, setNoteAr] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewState, setPreviewState] = React.useState<"loading" | "ready" | "error">("loading");
  const [taken, setTaken] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [conflict, setConflict] = React.useState<Existing | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const weekStart = mode === "this" ? thisWeek : mode === "next" ? nextWeek : custom;
  const fmt = (iso: string) => formatDate(iso, locale, { style: "medium", numerals });

  // the preview: the item as the reveal will show it
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreviewState("loading");
    fetch(`/api/v1/knowledge-of-week?view=preview&type=${resourceType}&id=${encodeURIComponent(resourceId)}&week=${weekStart}`)
      .then(async (r) => {
        const json = (await r.json().catch(() => ({ data: null }))) as { data: Preview | null };
        if (cancelled) return;
        if (!r.ok || !json.data) {
          setPreviewState("error");
          return;
        }
        setPreview(json.data);
        setPreviewState("ready");
      })
      .catch(() => {
        if (!cancelled) setPreviewState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, resourceType, resourceId, weekStart]);

  // which weeks already have a pick, so the choice is informed before the
  // replace confirmation has to say it
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/v1/knowledge-of-week?view=schedule")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data?: { weekStart: string }[] }) => {
        if (!cancelled) setTaken(new Set((json.data ?? []).map((c) => c.weekStart)));
      })
      .catch(() => {
        /* the confirmation still catches a taken week */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const previewCard: KowCard | null = preview
    ? { ...preview, weekStart, weekEnd: addDaysIso(weekStart, 6), noteEn: noteEn || null, noteAr: noteAr || null, titleEn: preview.titleEn || titleEn, titleAr: preview.titleAr || titleAr }
    : null;

  const onCustom = (value: string) => {
    if (!value) return;
    const monday = mondayOf(new Date(value + "T12:00:00"));
    setSnapped(monday !== value);
    setCustom(monday < thisWeek ? thisWeek : monday);
    setMode("custom");
  };

  const submit = async (replace = false) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/knowledge-of-week", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, weekStart, noteEn, noteAr, replace }),
      });
      const json = (await res.json().catch(() => ({ data: null, error: "error" }))) as { data: Existing | null; error: string | null };
      if (res.status === 409 && json.data) {
        setConflict(json.data);
        return;
      }
      if (!res.ok) {
        setError(
          json.error === "not_eligible" ? t("set.notEligible")
          : json.error === "forbidden" ? t("set.forbidden")
          : json.error === "bad_week" ? t("set.badWeek")
          : t("set.errorGeneric")
        );
        return;
      }
      resetKowIds();
      toast(t("set.done", { date: fmt(weekStart) }), "success");
      setOpen(false);
      setConflict(null);
      router.refresh();
    } catch {
      setError(t("set.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const weekChip = (key: WeekMode, label: string, iso: string) => (
    <button
      type="button"
      onClick={() => setMode(key)}
      aria-pressed={mode === key}
      data-testid={`kow-week-${key}`}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start rounded-lg border px-3 py-2 text-start transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500",
        mode === key ? "border-navy-500 bg-navy-100/60 text-navy-900" : "border-mist-300 bg-white text-ink-900 hover:border-navy-300"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-ink-600 tnum">{fmt(iso)}</span>
      {taken.has(iso) ? <span className="mt-0.5 text-[11px] font-medium text-warn">{t("set.taken")}</span> : null}
    </button>
  );

  return (
    <>
      <Button
        variant="aqua"
        size={size}
        className={className}
        onClick={() => {
          setConflict(null);
          setError(null);
          setOpen(true);
        }}
        data-testid="kow-set-button"
      >
        <Star /> {t("set.button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("set.title")} className="max-h-[92vh] w-[min(880px,94vw)] overflow-y-auto">
          <p className="-mt-2 mb-4 text-sm text-ink-600">{t("set.intro")}</p>

          {conflict ? (
            <div
              className="mb-4 rounded-lg border border-warn/40 bg-warn-light p-4"
              role="alert"
              data-testid="kow-conflict"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-warn">
                <AlertTriangle className="size-4" aria-hidden /> {t("set.conflictTitle")}
              </p>
              <p className="mt-1 text-sm text-ink-900">
                {t("set.conflictBody", { title: bi(locale, conflict.titleEn, conflict.titleAr), date: fmt(conflict.weekStart) })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => submit(true)} loading={submitting} data-testid="kow-replace">
                  {t("set.replace")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConflict(null)}>
                  {t("set.keep")}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex flex-col gap-4">
              <div>
                {/* names the week chips and the date field together, so it is a
                    group caption rather than the label of one control */}
                <span id="kow-week-label" className="mb-1.5 block text-xs font-medium text-ink-600">
                  {t("set.week")}
                </span>
                <div className="flex gap-2" role="group" aria-labelledby="kow-week-label">
                  {weekChip("this", t("thisWeek"), thisWeek)}
                  {weekChip("next", t("nextWeek"), nextWeek)}
                </div>
                <div className="mt-2">
                  {/* the native control draws its own calendar indicator, so no
                      decorative icon is added beside it */}
                  <Input
                    type="date"
                    aria-label={t("chooseMonday")}
                    min={thisWeek}
                    step={7}
                    value={custom}
                    onChange={(e) => onCustom(e.target.value)}
                    onFocus={() => setMode("custom")}
                    className={cn("tnum", mode === "custom" && "border-navy-500 ring-2 ring-navy-100")}
                    data-testid="kow-week-custom"
                  />
                </div>
                {mode === "custom" && taken.has(custom) ? (
                  <p className="mt-1 text-xs font-medium text-warn">{t("set.taken")}</p>
                ) : null}
                {snapped && mode === "custom" ? <p className="mt-1 text-xs text-ink-600">{t("mondayOnly")}</p> : null}
              </div>

              <div>
                <Label htmlFor="kow-note-en">{t("set.noteEn")}</Label>
                <Textarea
                  id="kow-note-en"
                  dir="ltr"
                  lang="en"
                  value={noteEn}
                  maxLength={600}
                  onChange={(e) => setNoteEn(e.target.value)}
                  placeholder={t("set.notePlaceholderEn")}
                  className="min-h-20"
                  data-testid="kow-note-en"
                />
              </div>
              <div>
                <Label htmlFor="kow-note-ar">{t("set.noteAr")}</Label>
                <Textarea
                  id="kow-note-ar"
                  dir="rtl"
                  lang="ar"
                  value={noteAr}
                  maxLength={600}
                  onChange={(e) => setNoteAr(e.target.value)}
                  placeholder={t("set.notePlaceholderAr")}
                  className="min-h-20"
                  data-testid="kow-note-ar"
                />
              </div>

              {preview && !preview.eligible ? (
                <p className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger" role="alert">
                  {t("set.notEligible")}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger" role="alert" data-testid="kow-set-error">
                  {error}
                </p>
              ) : null}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">
                {t("set.preview")}
                <Chip tone="mist">{t("set.previewHint")}</Chip>
              </p>
              <div className="rounded-[var(--radius-card)] border border-aqua-300 bg-mist-50 p-3 sm:p-4" data-testid="kow-preview">
                {previewState === "loading" || !previewCard ? (
                  previewState === "error" ? (
                    <p className="p-4 text-sm text-danger">{t("set.previewError")}</p>
                  ) : (
                    <div className="flex flex-col gap-3 p-2" aria-busy>
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-7 w-4/5" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-8 w-56 rounded-full" />
                    </div>
                  )
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-aqua-300/60 bg-white p-4 shadow-[var(--shadow-paper)]">
                    <KowCardBody card={previewCard} size="preview" numerals={numerals} />
                    <div className="mt-4 flex gap-2" aria-hidden>
                      <span className="inline-flex h-8 items-center rounded-lg bg-navy-700 px-3 text-xs font-medium text-white">{t("readNow")}</span>
                      <span className="inline-flex h-8 items-center rounded-lg border border-mist-300 bg-white px-3 text-xs font-medium text-ink-900">{t("later")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("set.cancel")}
            </Button>
            <Button
              onClick={() => submit(false)}
              loading={submitting}
              disabled={previewState !== "ready" || Boolean(preview && !preview.eligible) || Boolean(conflict)}
              data-testid="kow-set-submit"
            >
              <Star /> {t("set.submit", { date: fmt(weekStart) })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
