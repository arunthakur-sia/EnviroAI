"use client";
// CR04 3.7 + 2.2: Settings > Lessons and Strategy. Lesson of the week
// schedule, theme re-clustering (run now, nightly on/off), Learn mode on/off,
// the reflection prompts editor, and the QNV pillar mapping used by the
// Strategy Canvas. Self-contained: loads and saves through /api/v1/settings.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Play, Plus, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Button, Input, Label, NativeSelect } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

type Pillar = { key: "human" | "social" | "economic" | "environmental"; outcomes: number[] };
type ScheduleRow = { weekStart: string; lessonId: string };
type Prompt = { en: string; ar: string };
type LessonLite = { id: string; titleEn: string; titleAr: string; status: string; reuseCount: number };

const PILLAR_ORDER = ["human", "social", "economic", "environmental"] as const;

export function LessonsSettingsTab() {
  const t = useTranslations("settings");
  const ts = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [reclustering, setReclustering] = React.useState(false);
  const [pillars, setPillars] = React.useState<Pillar[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleRow[]>([]);
  const [prompts, setPrompts] = React.useState<Prompt[]>([]);
  const [learnModeEnabled, setLearnModeEnabled] = React.useState(true);
  const [reclusterNightly, setReclusterNightly] = React.useState(true);
  const [lessons, setLessons] = React.useState<LessonLite[]>([]);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/v1/settings").then((r) => r.json()),
      fetch("/api/v1/lessons").then((r) => r.json()),
    ])
      .then(([settings, lessonList]) => {
        if (!alive) return;
        setPillars(settings.data?.qnvPillars ?? []);
        setSchedule(settings.data?.lessonOfWeek?.schedule ?? []);
        setPrompts(settings.data?.reflectionPrompts ?? []);
        setLearnModeEnabled(settings.data?.lessonsSettings?.learnModeEnabled !== false);
        setReclusterNightly(settings.data?.lessonsSettings?.reclusterNightly !== false);
        setLessons(lessonList.data ?? []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qnvPillars: pillars,
          lessonsSettings: { learnModeEnabled, reclusterNightly },
          lessonOfWeek: { schedule: schedule.filter((s) => s.weekStart && s.lessonId) },
          reflectionPrompts: prompts.filter((p) => p.en.trim() && p.ar.trim()),
        }),
      });
      if (res.ok) toast(t("saved"), "success");
      else toast(tc("error"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function reclusterNow() {
    setReclustering(true);
    try {
      const res = await fetch("/api/v1/lessons/recluster", { method: "POST" });
      const json = await res.json();
      if (res.ok) toast(t("lessonsTab.reclustered", { count: json.data?.themes ?? 0 }), "success");
      else toast(tc("error"), "error");
    } finally {
      setReclustering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center" aria-busy>
        <Loader2 className="size-5 animate-spin text-maroon-700" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lesson of the week schedule */}
      <div className="card p-5">
        <h3 className="text-base font-medium">{t("lessonsTab.lowTitle")}</h3>
        <p className="mt-0.5 text-xs text-ink-600">{t("lessonsTab.lowHint")}</p>
        <div className="mt-3 flex flex-col gap-2">
          {schedule.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={row.weekStart}
                onChange={(e) =>
                  setSchedule((prev) => prev.map((r, j) => (j === i ? { ...r, weekStart: e.target.value } : r)))
                }
                className="w-40"
                aria-label={t("lessonsTab.weekStart")}
              />
              <NativeSelect
                value={row.lessonId}
                onChange={(e) =>
                  setSchedule((prev) => prev.map((r, j) => (j === i ? { ...r, lessonId: e.target.value } : r)))
                }
                className="min-w-0 flex-1"
                aria-label={t("lessonsTab.lesson")}
              >
                <option value="">{tc("none")}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {bi(locale, l.titleEn, l.titleAr).slice(0, 80)}
                  </option>
                ))}
              </NativeSelect>
              <button
                onClick={() => setSchedule((prev) => prev.filter((_, j) => j !== i))}
                aria-label={tc("delete")}
                className="rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSchedule((prev) => [...prev, { weekStart: "", lessonId: "" }])}
          >
            <Plus /> {t("lessonsTab.addWeek")}
          </Button>
        </div>
      </div>

      {/* themes + learn mode */}
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium">{t("lessonsTab.themesTitle")}</h3>
            <p className="mt-0.5 text-xs text-ink-600">{t("lessonsTab.themesHint")}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={reclusterNow} disabled={reclustering}>
            {reclustering ? <Loader2 className="animate-spin" /> : <Play />} {t("lessonsTab.reclusterNow")}
          </Button>
        </div>
        {/* a Radix switch is a button: the wrapping label does not name it */}
        <label className="flex items-center justify-between gap-3 text-sm">
          {t("lessonsTab.reclusterNightly")}
          <Switch checked={reclusterNightly} onCheckedChange={setReclusterNightly} aria-label={t("lessonsTab.reclusterNightly")} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t("lessonsTab.learnMode")}
          <Switch checked={learnModeEnabled} onCheckedChange={setLearnModeEnabled} aria-label={t("lessonsTab.learnMode")} />
        </label>
      </div>

      {/* reflection prompts */}
      <div className="card p-5">
        <h3 className="text-base font-medium">{t("lessonsTab.promptsTitle")}</h3>
        <div className="mt-3 flex flex-col gap-3">
          {prompts.map((p, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`reflection-prompt-${i}-en`}>{t("lessonsTab.promptEn")}</Label>
                <Input
                  id={`reflection-prompt-${i}-en`}
                  value={p.en}
                  onChange={(e) => setPrompts((prev) => prev.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))}
                  dir="ltr"
                />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor={`reflection-prompt-${i}-ar`}>{t("lessonsTab.promptAr")}</Label>
                <Input
                  id={`reflection-prompt-${i}-ar`}
                  value={p.ar}
                  onChange={(e) => setPrompts((prev) => prev.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))}
                  dir="rtl"
                />
              </div>
              <button
                onClick={() => setPrompts((prev) => prev.filter((_, j) => j !== i))}
                aria-label={tc("delete")}
                className="mt-6 rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setPrompts((prev) => [...prev, { en: "", ar: "" }])}>
            <Plus /> {t("lessonsTab.addPrompt")}
          </Button>
        </div>
      </div>

      {/* QNV pillar mapping (CR04 2.2) */}
      <div className="card p-5">
        <h3 className="text-base font-medium">{t("lessonsTab.pillarsTitle")}</h3>
        <p className="mt-0.5 text-xs text-ink-600">{t("lessonsTab.pillarsHint")}</p>
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-[560px] flex-col gap-1.5">
            {PILLAR_ORDER.map((key) => {
              const pillar = pillars.find((p) => p.key === key) ?? { key, outcomes: [] };
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 text-xs font-medium text-ink-900">
                    {ts(`canvas.pillars.${key}` as never)}
                  </span>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                    const on = pillar.outcomes.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() =>
                          setPillars((prev) => {
                            const next = PILLAR_ORDER.map(
                              (k) => prev.find((p) => p.key === k) ?? { key: k, outcomes: [] as number[] }
                            );
                            const target = next.find((p) => p.key === key)!;
                            target.outcomes = on
                              ? target.outcomes.filter((x) => x !== n)
                              : [...target.outcomes, n].sort((a, b) => a - b);
                            return next;
                          })
                        }
                        aria-pressed={on}
                        className={cn(
                          "size-8 rounded-full border text-xs font-semibold transition-colors cursor-pointer tnum",
                          on
                            ? "border-maroon-700 bg-maroon-700 text-white"
                            : "border-sand-300 bg-white text-ink-600 hover:border-maroon-300"
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
