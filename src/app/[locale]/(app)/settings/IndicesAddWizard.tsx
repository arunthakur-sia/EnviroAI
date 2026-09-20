"use client";
// CR08 4.3: the three-step Add index wizard. Basics (name, publisher, scale,
// direction, frequency, category, groups, linked targets, responsible
// entity, linked Statistics Hub series), data (a CSV paste, a CSV or XLSX
// upload, a publisher URL fetched once, or manual rows) with a server-side
// preview and its warnings, then forecasting (on or off, mode, target).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Trash2, Upload } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, Input, Label, NativeSelect, Skeleton, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { groupStyle } from "@/lib/sdg-colours";
import { targetIsRank } from "@/lib/index-targets";

type Options = {
  entities: { id: string; nameEn: string; nameAr: string; shortEn: string | null; shortAr: string | null }[];
  groups: { id: string; code: string; nameEn: string; nameAr: string; colourToken: string }[];
  indicators: { id: string; code: string; nameEn: string; nameAr: string; unit: string | null }[];
  targets: { id: string; code: string | null; titleEn: string; titleAr: string }[];
  categories: string[];
  frequencies: string[];
  existingCodes: string[];
};

type Basics = {
  code: string;
  nameEn: string;
  nameAr: string;
  publisher: string;
  publisherUrl: string;
  scale: "rank" | "score" | "both";
  higherIsBetter: boolean;
  frequency: string;
  category: string;
  responsibleEntityId: string;
  linkedNodeIds: string[];
  linkedStatisticsIndicatorId: string;
  scoreMin: string;
  scoreMax: string;
};

type Mode = "paste" | "upload" | "url" | "manual";
type ManualRow = { country: string; year: string; rank: string; score: string };
type Preview = {
  rows: { country: string; year: number; rank: number | null; score: number | null; total: number | null }[];
  truncated: boolean;
  warnings: { code: string; count: number; examples: string[] }[];
  summary: { rows: number; countries: number; qatarYears: number; yearFrom: number | null; yearTo: number | null; withRank: number; withScore: number };
  sourceUrl: string | null;
};

const EMPTY_BASICS: Basics = {
  code: "",
  nameEn: "",
  nameAr: "",
  publisher: "",
  publisherUrl: "",
  scale: "both",
  higherIsBetter: true,
  frequency: "annual",
  category: "economy",
  responsibleEntityId: "",
  linkedNodeIds: [],
  linkedStatisticsIndicatorId: "",
  scoreMin: "",
  scoreMax: "",
};

const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/;
const YEAR = String(new Date().getFullYear());

export function IndicesAddWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}) {
  const t = useTranslations("settings.indicesTab.wizard");
  const ti = useTranslations("indices");
  const tc = useTranslations("common");
  // dynamic keys (warning codes from the server) go through an untyped call
  const td = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const { toast } = useToast();
  const [options, setOptions] = React.useState<Options | null>(null);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [basics, setBasics] = React.useState<Basics>(EMPTY_BASICS);
  const [groupIds, setGroupIds] = React.useState<string[]>([]);
  const [targetQuery, setTargetQuery] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("paste");
  const [csv, setCsv] = React.useState("");
  const [file, setFile] = React.useState<{ name: string; base64: string } | null>(null);
  const [url, setUrl] = React.useState("");
  const [manual, setManual] = React.useState<ManualRow[]>([{ country: "QAT", year: YEAR, rank: "", score: "" }]);
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [forecast, setForecast] = React.useState({ enabled: true, mode: "auto", targetValue: "", targetYear: "" });
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/v1/indices/create")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setOptions(j.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // any change to the data step invalidates the preview
  React.useEffect(() => {
    setPreview(null);
  }, [mode, csv, file, url, manual, sourceUrl]);

  function reset() {
    setStep(1);
    setBasics(EMPTY_BASICS);
    setGroupIds([]);
    setMode("paste");
    setCsv("");
    setFile(null);
    setUrl("");
    setManual([{ country: "QAT", year: YEAR, rank: "", score: "" }]);
    setSourceUrl("");
    setPreview(null);
    setForecast({ enabled: true, mode: "auto", targetValue: "", targetYear: "" });
    setError(null);
  }

  const codeTaken = !!options?.existingCodes.includes(basics.code);
  const codeInvalid = basics.code.length > 0 && !CODE_RE.test(basics.code);
  const basicsOk =
    CODE_RE.test(basics.code) && !codeTaken && basics.nameEn.trim().length >= 2 && basics.nameAr.trim().length >= 1;

  function basicsPayload() {
    return {
      code: basics.code,
      nameEn: basics.nameEn.trim(),
      nameAr: basics.nameAr.trim(),
      publisher: basics.publisher.trim() || undefined,
      publisherUrl: basics.publisherUrl.trim() || undefined,
      scale: basics.scale,
      higherIsBetter: basics.higherIsBetter,
      frequency: basics.frequency,
      category: basics.category,
      responsibleEntityId: basics.responsibleEntityId || null,
      linkedNodeIds: basics.linkedNodeIds,
      linkedStatisticsIndicatorId: basics.linkedStatisticsIndicatorId || null,
      scoreMin: basics.scoreMin ? Number(basics.scoreMin) : null,
      scoreMax: basics.scoreMax ? Number(basics.scoreMax) : null,
    };
  }

  function dataPayload() {
    if (mode === "paste") return { mode, csv, sourceUrl: sourceUrl || undefined };
    if (mode === "upload") return { mode, fileName: file?.name, fileBase64: file?.base64, sourceUrl: sourceUrl || undefined };
    if (mode === "url") return { mode, url };
    return {
      mode,
      rows: manual
        .filter((r) => r.country.trim())
        .map((r) => ({ country: r.country.trim().toUpperCase(), year: r.year, rank: r.rank || null, score: r.score || null })),
      sourceUrl: sourceUrl || undefined,
    };
  }

  function forecastingPayload() {
    return {
      enabled: forecast.enabled,
      mode: forecast.mode,
      targetValue: forecast.targetValue ? Number(forecast.targetValue) : null,
      targetYear: forecast.targetYear ? Number(forecast.targetYear) : null,
    };
  }

  async function runPreview() {
    setBusy("preview");
    setError(null);
    try {
      const res = await fetch("/api/v1/indices/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "preview", basics: basicsPayload(), data: dataPayload(), forecasting: forecastingPayload(), groupIds }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(t.has(`errors.${j.error}`) ? t(`errors.${j.error}` as never) : tc("error"));
        return;
      }
      setPreview(j.data);
    } catch {
      setError(tc("error"));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview?.rows.length) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await fetch("/api/v1/indices/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "commit",
          basics: basicsPayload(),
          // the rows the admin previewed are the rows that get written
          data: { mode: "manual", origin: mode, rows: preview.rows, sourceUrl: preview.sourceUrl ?? undefined },
          forecasting: forecastingPayload(),
          groupIds,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(t.has(`errors.${j.error}`) ? t(`errors.${j.error}` as never) : tc("error"));
        return;
      }
      toast(t("created", { code: j.data.code, count: j.data.observations }), "points");
      onCreated?.();
      onOpenChange(false);
      reset();
    } catch {
      setError(tc("error"));
    } finally {
      setBusy(null);
    }
  }

  function readFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.slice(result.indexOf(",") + 1) : result;
      setFile({ name: f.name, base64 });
    };
    reader.readAsDataURL(f);
  }

  const filteredTargets = (options?.targets ?? []).filter(
    (n) =>
      !targetQuery.trim() ||
      (n.code ?? "").toLowerCase().includes(targetQuery.toLowerCase()) ||
      n.titleEn.toLowerCase().includes(targetQuery.toLowerCase()) ||
      n.titleAr.includes(targetQuery)
  );

  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: t("steps.basics") },
    { n: 2, label: t("steps.data") },
    { n: 3, label: t("steps.forecast") },
  ];

  // the id is passed in and set on the control the caller builds, so the
  // caption names that control instead of only sitting above it
  const field = (id: string, label: string, node: React.ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {node}
      {hint ? <p className="mt-1 text-[11px] text-ink-400">{hint}</p> : null}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent title={t("title")} className="max-h-[90vh] w-[min(900px,95vw)] overflow-y-auto" data-testid="index-wizard">
        {/* step indicator */}
        <ol className="mb-4 flex flex-wrap items-center gap-2" aria-label={t("stepOf", { n: step })}>
          {steps.map((s) => (
            <li
              key={s.n}
              aria-current={step === s.n ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs",
                step === s.n ? "bg-maroon-100 font-medium text-maroon-900" : step > s.n ? "text-ok" : "text-ink-400"
              )}
              data-testid={`wizard-step-${s.n}`}
            >
              <span className="flex size-4 items-center justify-center rounded-full border border-current text-[10px] tnum">
                {step > s.n ? <Check className="size-3" /> : s.n}
              </span>
              {s.label}
            </li>
          ))}
        </ol>

        {!options ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : null}

        {/* step 1: basics */}
        {options && step === 1 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="wizard-basics">
            {field(
              "wizard-code",
              t("code"),
              <Input
                id="wizard-code"
                value={basics.code}
                dir="ltr"
                placeholder="gfci"
                onChange={(e) => setBasics((b) => ({ ...b, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                aria-invalid={codeTaken || codeInvalid}
                data-testid="wizard-code"
              />,
              codeTaken ? t("codeTaken") : codeInvalid ? t("codeInvalid") : t("codeHint")
            )}
            {field(
              "wizard-category",
              t("category"),
              <NativeSelect id="wizard-category" value={basics.category} onChange={(e) => setBasics((b) => ({ ...b, category: e.target.value }))}>
                {options.categories.map((c) => (
                  <option key={c} value={c}>
                    {ti(`categories.${c}` as never)}
                  </option>
                ))}
              </NativeSelect>
            )}
            {field("wizard-name-en", t("nameEn"), <Input id="wizard-name-en" value={basics.nameEn} dir="ltr" onChange={(e) => setBasics((b) => ({ ...b, nameEn: e.target.value }))} data-testid="wizard-name-en" />)}
            {field("wizard-name-ar", t("nameAr"), <Input id="wizard-name-ar" value={basics.nameAr} dir="rtl" onChange={(e) => setBasics((b) => ({ ...b, nameAr: e.target.value }))} data-testid="wizard-name-ar" />)}
            {field("wizard-publisher", t("publisher"), <Input id="wizard-publisher" value={basics.publisher} onChange={(e) => setBasics((b) => ({ ...b, publisher: e.target.value }))} data-testid="wizard-publisher" />)}
            {field("wizard-publisher-url", t("publisherUrl"), <Input id="wizard-publisher-url" value={basics.publisherUrl} dir="ltr" placeholder="https://" onChange={(e) => setBasics((b) => ({ ...b, publisherUrl: e.target.value }))} />)}
            {field(
              "wizard-scale",
              t("scale"),
              <NativeSelect id="wizard-scale" value={basics.scale} onChange={(e) => setBasics((b) => ({ ...b, scale: e.target.value as Basics["scale"] }))}>
                {(["rank", "score", "both"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`scales.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
            {field(
              "wizard-direction",
              t("direction"),
              <NativeSelect id="wizard-direction" value={basics.higherIsBetter ? "1" : "0"} onChange={(e) => setBasics((b) => ({ ...b, higherIsBetter: e.target.value === "1" }))}>
                <option value="1">{t("higherBetter")}</option>
                <option value="0">{t("lowerBetter")}</option>
              </NativeSelect>
            )}
            {field(
              "wizard-frequency",
              t("frequency"),
              <NativeSelect id="wizard-frequency" value={basics.frequency} onChange={(e) => setBasics((b) => ({ ...b, frequency: e.target.value }))}>
                {options.frequencies.map((f) => (
                  <option key={f} value={f}>
                    {t(`frequencies.${f}` as never)}
                  </option>
                ))}
              </NativeSelect>
            )}
            <div className="grid grid-cols-2 gap-2">
              {field("wizard-score-min", t("scoreMin"), <Input id="wizard-score-min" value={basics.scoreMin} dir="ltr" inputMode="decimal" onChange={(e) => setBasics((b) => ({ ...b, scoreMin: e.target.value }))} />)}
              {field("wizard-score-max", t("scoreMax"), <Input id="wizard-score-max" value={basics.scoreMax} dir="ltr" inputMode="decimal" onChange={(e) => setBasics((b) => ({ ...b, scoreMax: e.target.value }))} />)}
            </div>
            {field(
              "wizard-entity",
              t("entity"),
              <NativeSelect id="wizard-entity" value={basics.responsibleEntityId} onChange={(e) => setBasics((b) => ({ ...b, responsibleEntityId: e.target.value }))}>
                <option value="">{t("noEntity")}</option>
                {options.entities.map((en) => (
                  <option key={en.id} value={en.id}>
                    {bi(locale, en.shortEn ?? en.nameEn, en.shortAr ?? en.nameAr)}
                  </option>
                ))}
              </NativeSelect>
            )}
            {field(
              "wizard-statistics",
              t("statistics"),
              <NativeSelect id="wizard-statistics" value={basics.linkedStatisticsIndicatorId} onChange={(e) => setBasics((b) => ({ ...b, linkedStatisticsIndicatorId: e.target.value }))}>
                <option value="">{t("noStatistics")}</option>
                {options.indicators.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bi(locale, s.nameEn, s.nameAr)}
                    {s.unit ? ` (${s.unit})` : ""}
                  </option>
                ))}
              </NativeSelect>,
              t("statisticsHint")
            )}
            <div className="sm:col-span-2">
              {/* a caption over a set of toggle buttons, not one control */}
              <span id="wizard-groups-label" className="mb-1.5 block text-xs font-medium text-ink-600">{t("groups")}</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="wizard-groups-label" data-testid="wizard-groups">
                {options.groups.map((g) => {
                  const on = groupIds.includes(g.id);
                  const style = groupStyle(g.colourToken);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setGroupIds((cur) => (on ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                        on ? "border-maroon-500 bg-maroon-50 font-medium text-maroon-900" : "border-sand-300 text-ink-600 hover:text-ink-900"
                      )}
                      data-testid={`wizard-group-${g.code}`}
                    >
                      <span className={cn("size-2 rounded-full", style.bar)} aria-hidden />
                      {bi(locale, g.nameEn, g.nameAr)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wizard-targets-search">{t("targets")}</Label>
              <Input id="wizard-targets-search" value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder={t("targetsSearch")} className="mb-2 max-w-xs" />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-sand-200 p-2" role="group" aria-label={t("targets")}>
                {filteredTargets.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-ink-400">{t("noTargets")}</p>
                ) : (
                  filteredTargets.map((n) => {
                    const on = basics.linkedNodeIds.includes(n.id);
                    return (
                      <label key={n.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-sand-50">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setBasics((b) => ({
                              ...b,
                              linkedNodeIds: on ? b.linkedNodeIds.filter((x) => x !== n.id) : [...b.linkedNodeIds, n.id],
                            }))
                          }
                          className="size-3.5 accent-maroon-700"
                        />
                        <span className="tnum text-ink-400">{n.code}</span>
                        <span className="truncate text-ink-900">{bi(locale, n.titleEn, n.titleAr)}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-400">{t("targetsSelected", { count: basics.linkedNodeIds.length })}</p>
            </div>
          </div>
        ) : null}

        {/* step 2: data */}
        {options && step === 2 ? (
          <div className="flex flex-col gap-4" data-testid="wizard-data">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("steps.data")}>
              {(["paste", "upload", "url", "manual"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500",
                    mode === m ? "bg-maroon-100 font-medium text-maroon-900" : "bg-sand-100 text-ink-600 hover:text-ink-900"
                  )}
                  data-testid={`wizard-mode-${m}`}
                >
                  {t(`modes.${m}`)}
                </button>
              ))}
            </div>

            {mode === "paste" ? (
              <div>
                <Label htmlFor="wizard-csv">{t("pasteLabel")}</Label>
                <Textarea
                  id="wizard-csv"
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  dir="ltr"
                  rows={8}
                  placeholder={"country,year,rank,score\nQAT,2024,12,71.3\nARE,2024,9,74.0"}
                  className="font-mono text-xs"
                  data-testid="wizard-csv"
                />
                <p className="mt-1 text-[11px] text-ink-400">{t("pasteHint")}</p>
              </div>
            ) : null}

            {mode === "upload" ? (
              <div>
                {/* the file input is already named by the label that wraps it,
                    so this stays a caption rather than a second label */}
                <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("uploadLabel")}</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sand-300 px-4 py-5 text-sm text-ink-600 hover:border-maroon-300">
                  <Upload className="size-5 text-ink-400" aria-hidden />
                  <span>{file ? file.name : t("chooseFile")}</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFile(f);
                    }}
                    data-testid="wizard-file"
                  />
                </label>
                <p className="mt-1 text-[11px] text-ink-400">{t("uploadHint")}</p>
              </div>
            ) : null}

            {mode === "url" ? (
              <div>
                <Label htmlFor="wizard-url">{t("urlLabel")}</Label>
                <Input id="wizard-url" value={url} dir="ltr" placeholder="https://publisher.org/data/results.csv" onChange={(e) => setUrl(e.target.value)} data-testid="wizard-url" />
                <p className="mt-1 text-[11px] text-ink-400">{t("urlHint")}</p>
              </div>
            ) : null}

            {mode === "manual" ? (
              <div>
                {/* a caption over the manual rows grid; each cell input carries
                    its own aria-label */}
                <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("manualLabel")}</span>
                <div role="table" aria-label={t("manualLabel")} className="text-xs">
                  <div role="row" className="grid grid-cols-[90px_80px_80px_100px_32px] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-600 rtl:tracking-normal">
                    <span role="columnheader">{t("country")}</span>
                    <span role="columnheader">{t("year")}</span>
                    <span role="columnheader">{t("rank")}</span>
                    <span role="columnheader">{t("score")}</span>
                    <span role="columnheader" />
                  </div>
                  {manual.map((r, i) => (
                    <div key={i} role="row" className="mb-1.5 grid grid-cols-[90px_80px_80px_100px_32px] items-center gap-2 px-1">
                      <Input role="cell" value={r.country} dir="ltr" maxLength={3} className="h-8 text-xs" aria-label={t("country")} onChange={(e) => setManual((m) => m.map((x, k) => (k === i ? { ...x, country: e.target.value.toUpperCase() } : x)))} />
                      <Input role="cell" value={r.year} dir="ltr" className="h-8 text-xs" aria-label={t("year")} onChange={(e) => setManual((m) => m.map((x, k) => (k === i ? { ...x, year: e.target.value } : x)))} />
                      <Input role="cell" value={r.rank} dir="ltr" className="h-8 text-xs" aria-label={t("rank")} onChange={(e) => setManual((m) => m.map((x, k) => (k === i ? { ...x, rank: e.target.value } : x)))} />
                      <Input role="cell" value={r.score} dir="ltr" className="h-8 text-xs" aria-label={t("score")} onChange={(e) => setManual((m) => m.map((x, k) => (k === i ? { ...x, score: e.target.value } : x)))} />
                      <button
                        type="button"
                        role="cell"
                        onClick={() => setManual((m) => (m.length > 1 ? m.filter((_, k) => k !== i) : m))}
                        className="rounded-md p-1 text-ink-400 hover:text-danger cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                        aria-label={t("removeRow")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setManual((m) => [...m, { country: "", year: YEAR, rank: "", score: "" }])}>
                  <Plus /> {t("addRow")}
                </Button>
              </div>
            ) : null}

            {mode !== "url" ? (
              <div>
                <Label htmlFor="wizard-source-url">{t("sourceUrl")}</Label>
                <Input id="wizard-source-url" value={sourceUrl} dir="ltr" placeholder="https://" onChange={(e) => setSourceUrl(e.target.value)} />
                <p className="mt-1 text-[11px] text-ink-400">{t("sourceUrlHint")}</p>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                loading={busy === "preview"}
                disabled={
                  (mode === "paste" && !csv.trim()) ||
                  (mode === "upload" && !file) ||
                  (mode === "url" && !url.trim()) ||
                  (mode === "manual" && !manual.some((r) => r.country.trim()))
                }
                onClick={runPreview}
                data-testid="wizard-preview"
              >
                {t("preview")}
              </Button>
              {preview ? <Chip tone={preview.rows.length ? "ok" : "warn"}>{t("summary.rows", { count: preview.summary.rows })}</Chip> : null}
            </div>

            {preview ? (
              <div className="rounded-xl border border-sand-200 bg-sand-50 p-3" data-testid="wizard-preview-panel">
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6" data-testid="wizard-preview-summary">
                  {(
                    [
                      ["rows", preview.summary.rows],
                      ["countries", preview.summary.countries],
                      ["qatarYears", preview.summary.qatarYears],
                      ["years", preview.summary.yearFrom != null ? `${preview.summary.yearFrom} to ${preview.summary.yearTo}` : "-"],
                      ["withRank", preview.summary.withRank],
                      ["withScore", preview.summary.withScore],
                    ] as [string, string | number][]
                  ).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white px-2.5 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-ink-600 rtl:tracking-normal">{t(`summary.${k}Label` as never)}</p>
                      <p className="text-sm font-medium tnum text-ink-900">{v}</p>
                    </div>
                  ))}
                </div>
                {preview.warnings.length ? (
                  <ul className="mt-3 flex flex-col gap-1" data-testid="wizard-warnings">
                    {preview.warnings.map((w) => (
                      <li key={w.code} className="flex items-start gap-2 text-xs text-warn">
                        <Chip tone="warn" className="shrink-0">{w.count}</Chip>
                        <span>
                          {t.has(`warnings.${w.code}`) ? td(`warnings.${w.code}`, { count: w.count }) : w.code}
                          {w.examples.length ? <span className="text-ink-600"> ({w.examples.join(", ")})</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {preview.rows.length ? (
                  <div className="mt-3 overflow-x-auto rounded-lg bg-white">
                    <div role="table" aria-label={t("rowsTitle")} className="min-w-[420px] text-xs">
                      <div role="row" className="grid grid-cols-[90px_70px_70px_90px_70px] border-b border-sand-100 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600 rtl:tracking-normal">
                        <span role="columnheader">{t("country")}</span>
                        <span role="columnheader">{t("year")}</span>
                        <span role="columnheader">{t("rank")}</span>
                        <span role="columnheader">{t("score")}</span>
                        <span role="columnheader">{t("total")}</span>
                      </div>
                      {preview.rows.slice(0, 12).map((r) => (
                        <div key={`${r.country}-${r.year}`} role="row" className="grid grid-cols-[90px_70px_70px_90px_70px] border-b border-sand-100 px-2 py-1 tnum last:border-0" data-testid="wizard-preview-row">
                          <span role="cell" dir="ltr">{r.country}</span>
                          <span role="cell">{r.year}</span>
                          <span role="cell">{r.rank ?? "-"}</span>
                          <span role="cell">{r.score ?? "-"}</span>
                          <span role="cell">{r.total ?? "-"}</span>
                        </div>
                      ))}
                    </div>
                    {preview.rows.length > 12 ? (
                      <p className="px-2 py-1.5 text-[11px] text-ink-400">{t("moreRows", { count: preview.summary.rows - 12 })}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* step 3: forecasting */}
        {options && step === 3 ? (
          <div className="flex flex-col gap-4" data-testid="wizard-forecast">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-sand-200 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-ink-900">{t("forecastEnabled")}</span>
                <span className="block text-xs text-ink-600">{t("forecastEnabledHint")}</span>
              </span>
              {/* a Radix switch is a button: the wrapping label does not name it */}
              <Switch checked={forecast.enabled} onCheckedChange={(v) => setForecast((f) => ({ ...f, enabled: v }))} aria-label={t("forecastEnabled")} data-testid="wizard-forecast-switch" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {field(
                "wizard-forecast-mode",
                t("forecastMode"),
                <NativeSelect id="wizard-forecast-mode" value={forecast.mode} disabled={!forecast.enabled} onChange={(e) => setForecast((f) => ({ ...f, mode: e.target.value }))}>
                  {(["auto", "rank", "score", "target_gap"] as const).map((m) => (
                    <option key={m} value={m}>
                      {t(`forecastModes.${m}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {field("wizard-target-value", t("targetValue"), <Input id="wizard-target-value" value={forecast.targetValue} dir="ltr" inputMode="decimal" onChange={(e) => setForecast((f) => ({ ...f, targetValue: e.target.value }))} data-testid="wizard-target-value" />)}
              {field("wizard-target-year", t("targetYear"), <Input id="wizard-target-year" value={forecast.targetYear} dir="ltr" inputMode="numeric" placeholder="2030" onChange={(e) => setForecast((f) => ({ ...f, targetYear: e.target.value }))} />)}
            </div>
            {/* A target on an index that has both ranks and scores is
                ambiguous, so the basis the board and the page will read it on
                is stated here, from the same rule they use. */}
            {forecast.targetValue ? (
              <p className="text-[11px] text-ink-600" data-testid="wizard-target-basis">
                {t(
                  targetIsRank(forecast.mode, preview?.summary.withRank ? 1 : null, preview?.summary.withScore ? 1 : null)
                    ? "targetReadsAsRank"
                    : "targetReadsAsScore"
                )}
              </p>
            ) : null}
            <p className="text-[11px] text-ink-400">{t("forecastHint")}</p>
            <div className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-ink-900" data-testid="wizard-summary">
              {t("willCreate", {
                code: basics.code,
                name: bi(locale, basics.nameEn, basics.nameAr),
                rows: preview?.summary.rows ?? 0,
                groups: groupIds.length,
                forecast: forecast.enabled ? t("on") : t("off"),
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger" role="alert" data-testid="wizard-error">
            {error}
          </p>
        ) : null}

        {/* footer */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-xs text-ink-400">{t("stepOf", { n: step })}</span>
          <span className="flex items-center gap-2">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep((s) => (s === 3 ? 2 : 1))} data-testid="wizard-back">
                {t("back")}
              </Button>
            ) : null}
            {step < 3 ? (
              <Button
                disabled={step === 1 ? !basicsOk : !preview?.rows.length}
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                data-testid="wizard-next"
              >
                {t("next")}
              </Button>
            ) : (
              <Button loading={busy === "commit"} disabled={!preview?.rows.length} onClick={commit} data-testid="wizard-commit">
                {t("create")}
              </Button>
            )}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
