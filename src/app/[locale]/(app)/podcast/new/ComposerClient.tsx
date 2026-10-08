"use client";
// CR02 4.3: the three-step composer. 1 Choose knowledge, 2 Options,
// 3 Review script (editable), then Generate audio.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, ChevronRight, Loader2, Mic, Search, Sparkles, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import {
  Button,
  Chip,
  Input,
  Label,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export type ComposerScope = {
  kind: "node" | "document" | "collection" | "lessons" | "topic" | "conversation";
  ids: string[];
  labelEn: string;
  labelAr: string;
  query?: string;
};

type Segment = { speaker: "mariam" | "hamad"; text: string; source_mention?: string | null };
type Script = {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  segments: Segment[];
  estimated_seconds: number;
  sources: unknown[];
};

type PickerResult = {
  kind: ComposerScope["kind"];
  id: string;
  labelEn: string;
  labelAr: string;
  sub: string;
};

export function ComposerClient({
  initialScope,
  defaultLanguage,
}: {
  initialScope: ComposerScope | null;
  defaultLanguage: "ar" | "en";
}) {
  const t = useTranslations("podcast");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(initialScope ? 2 : 1);
  const [scope, setScope] = React.useState<ComposerScope | null>(initialScope);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PickerResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [language, setLanguage] = React.useState<"ar" | "en">(defaultLanguage);
  const [minutes, setMinutes] = React.useState<3 | 5>(5);
  const [focus, setFocus] = React.useState<"overview" | "lessons" | "numbers" | "risks">("overview");
  const [script, setScript] = React.useState<Script | null>(null);
  const [writing, setWriting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function onQueryChange(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/podcast/scope-search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        if (res.ok) setResults(json.data ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function writeScript() {
    if (!scope || writing) return;
    setWriting(true);
    try {
      const res = await fetch("/api/v1/podcast/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, options: { language, minutes, focus } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setScript(json.data.script);
      setStep(3);
    } catch {
      toast(tc("error"), "error");
    } finally {
      setWriting(false);
    }
  }

  async function save(render: "studio" | "browser") {
    if (!scope || !script || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/podcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, options: { language, minutes, focus }, script, render }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("episodeSaved", { points: json.data.points ?? 0 }), "points");
      router.push(`/podcast/${json.data.id}` as never);
    } catch {
      toast(tc("error"), "error");
      setSaving(false);
    }
  }

  function patchSegment(index: number, text: string) {
    setScript((prev) =>
      prev
        ? {
            ...prev,
            segments: prev.segments.map((s, i) => (i === index ? { ...s, text } : s)),
          }
        : prev
    );
  }

  const steps = [t("stepChoose"), t("stepOptions"), t("stepReview")] as const;

  return (
    <div className="mx-auto max-w-3xl">
      {/* stepper */}
      <ol className="mb-6 flex items-center gap-2" data-testid="composer-stepper">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const stateDone = step > n;
          const active = step === n;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (n < step) setStep(n);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-navy-100 font-medium text-navy-900"
                    : stateDone
                      ? "text-navy-700 cursor-pointer hover:bg-navy-100/60"
                      : "text-ink-600"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tnum",
                    active || stateDone ? "bg-navy-700 text-white" : "bg-mist-200 text-ink-600"
                  )}
                >
                  {stateDone ? <Check className="size-3" /> : n}
                </span>
                {label}
              </button>
              {i < steps.length - 1 ? (
                <ChevronRight className="size-4 flip-rtl text-ink-400" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Step 1: choose knowledge */}
      {step === 1 ? (
        <div className="card p-5">
          <p className="mb-3 text-sm text-ink-600">{t("chooseHint")}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-9"
              autoFocus
            />
          </div>
          {searching ? (
            <p className="mt-3 text-sm text-ink-600">
              <Loader2 className="me-1.5 inline size-4 animate-spin" /> {tc("loading")}
            </p>
          ) : null}
          {results.length ? (
            <div className="mt-3 flex flex-col divide-y divide-mist-100 overflow-hidden rounded-xl border border-mist-200">
              {results.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => {
                    setScope({
                      kind: r.kind,
                      ids: [r.id],
                      labelEn: r.labelEn,
                      labelAr: r.labelAr,
                      query: r.kind === "topic" || r.kind === "lessons" ? r.labelEn : undefined,
                    });
                    setStep(2);
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-start text-sm hover:bg-navy-50 cursor-pointer"
                >
                  <span className="min-w-0 flex-1 truncate text-ink-900">
                    {bi(locale, r.labelEn, r.labelAr)}
                  </span>
                  <Chip tone="ghost">{r.sub}</Chip>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Step 2: options */}
      {step === 2 && scope ? (
        <div className="card p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-600">
            {t("selected")}
          </p>
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-900">
            {bi(locale, scope.labelEn, scope.labelAr)}
            <button
              onClick={() => {
                setScope(null);
                setStep(1);
              }}
              className="text-ink-400 hover:text-danger cursor-pointer"
              aria-label={tc("delete")}
            >
              <X className="size-3.5" />
            </button>
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="composer-language">{t("languageLabel")}</Label>
              <NativeSelect id="composer-language" value={language} onChange={(e) => setLanguage(e.target.value as never)}>
                <option value="ar">{t("langNames.ar")}</option>
                <option value="en">{t("langNames.en")}</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="composer-length">{t("lengthLabel")}</Label>
              <NativeSelect
                id="composer-length"
                value={String(minutes)}
                onChange={(e) => setMinutes(Number(e.target.value) as 3 | 5)}
              >
                <option value="3">{t("len3")}</option>
                <option value="5">{t("len5")}</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="composer-focus">{t("focusLabel")}</Label>
              <NativeSelect id="composer-focus" value={focus} onChange={(e) => setFocus(e.target.value as never)}>
                {(["overview", "lessons", "numbers", "risks"] as const).map((f) => (
                  <option key={f} value={f}>
                    {t(`focus.${f}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={writeScript} loading={writing}>
              <Sparkles /> {writing ? t("generatingScript") : t("generateScript")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Step 3: review the script */}
      {step === 3 && script ? (
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-medium text-ink-900">
                {bi(locale, script.title_en, script.title_ar)}
              </p>
              <span className="text-xs text-ink-600 tnum">
                {t("estimated", { minutes: Math.max(1, Math.round(script.estimated_seconds / 60)) })}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-600">{t("editHint")}</p>
          </div>
          <div className="flex flex-col gap-2.5" data-testid="script-review">
            {script.segments.map((s, i) => (
              <div key={i} className="card flex items-start gap-3 p-3.5">
                <Chip tone={s.speaker === "mariam" ? "navy" : "teal"} className="mt-1 shrink-0">
                  {s.speaker === "mariam" ? t("mariam") : t("hamad")}
                </Chip>
                <Textarea
                  value={s.text}
                  onChange={(e) => patchSegment(i, e.target.value)}
                  rows={Math.min(6, Math.max(2, Math.ceil(s.text.length / 90)))}
                  className="min-h-0 border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus:ring-0"
                  dir={language === "ar" ? "rtl" : "ltr"}
                  aria-label={`${s.speaker} ${i + 1}`}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => save("browser")} loading={saving}>
              {t("generateBrowser")}
            </Button>
            <Button onClick={() => save("studio")} loading={saving}>
              <Mic /> {t("generateAudio")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
