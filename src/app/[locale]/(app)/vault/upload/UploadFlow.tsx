"use client";
// Upload flow: drop files, watch the AI enrichment panel fill in live, confirm in
// one screen, press "Upload to Vault". Optimistic exit back to the shelf.
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CircleAlert,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import {
  Button,
  Input,
  Textarea,
  Label,
  NativeSelect,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { takePendingFiles } from "@/components/nexus/GlobalDropZone";

type Term = { code: string; nameEn: string; nameAr: string };

type Enrichment = {
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  key_facts: { text_en: string; text_ar: string; page: number | null }[];
  knowledge_type_code: string;
  outcome_codes: string[];
  sector_codes: string[];
  topic_codes: string[];
  classification_level: number;
  classification_reason: string;
  publish_year: number | null;
};

type FileJob = {
  file: File;
  phase: "parsing" | "ready" | "saving" | "done" | "error";
  progressHint: number;
  documentId?: string;
  enrichment?: Enrichment;
  duplicate?: { id: string; titleEn: string; titleAr: string; similarity: number } | null;
  related?: { id: string; titleEn: string; titleAr: string }[];
  parsed?: { pageCount: number; lang: string; tables: number };
  error?: string;
};

const PHASE_STEPS = ["extract", "language", "pages", "tables", "enrich"] as const;

export function UploadFlow({
  terms,
  collections,
}: {
  terms: Record<string, Term[]>;
  collections: { id: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("upload");
  const router = useRouter();
  const { toast } = useToast();
  const [jobs, setJobs] = React.useState<FileJob[]>([]);

  const startUpload = React.useCallback(async (files: File[]) => {
    for (const file of files) {
      setJobs((prev) => [...prev, { file, phase: "parsing", progressHint: 0 }]);
      // staged progress hint while the server parses + enriches
      const interval = setInterval(() => {
        setJobs((prev) =>
          prev.map((j) =>
            j.file === file && j.phase === "parsing"
              ? { ...j, progressHint: Math.min(0.9, j.progressHint + 0.07) }
              : j
          )
        );
      }, 600);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/v1/documents", { method: "POST", body: form });
        const json = await res.json();
        clearInterval(interval);
        if (!res.ok) throw new Error(json.error ?? "upload_failed");
        setJobs((prev) =>
          prev.map((j) =>
            j.file === file
              ? {
                  ...j,
                  phase: "ready",
                  progressHint: 1,
                  documentId: json.data.documentId,
                  enrichment: json.data.enrichment,
                  duplicate: json.data.duplicate,
                  related: json.data.related,
                  parsed: json.data.parsed,
                }
              : j
          )
        );
      } catch (e) {
        clearInterval(interval);
        setJobs((prev) =>
          prev.map((j) =>
            j.file === file ? { ...j, phase: "error", error: String((e as Error).message) } : j
          )
        );
      }
    }
  }, []);

  React.useEffect(() => {
    const pending = takePendingFiles();
    if (pending.length) startUpload(pending);
  }, [startUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: startUpload,
    multiple: true,
  });

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-sand-300 bg-white px-6 py-12 text-center transition-colors",
          isDragActive && "border-maroon-500 bg-maroon-50"
        )}
      >
        <input {...getInputProps()} aria-label={t("dropLabel")} />
        <UploadCloud className="size-10 text-maroon-700" />
        <p className="font-medium text-ink-900">{t("dropTitle")}</p>
        <p className="text-sm text-ink-600">{t("dropHint")}</p>
      </div>

      {jobs.map((job, i) => (
        <FileCard
          key={i}
          job={job}
          terms={terms}
          collections={collections}
          onDone={(points) => {
            toast(t("uploadedToast", { points }), "points");
            router.push("/vault");
          }}
          onUpdate={(patch) =>
            setJobs((prev) => prev.map((j) => (j === job ? { ...j, ...patch } : j)))
          }
        />
      ))}
    </div>
  );
}

function FileCard({
  job,
  terms,
  collections,
  onDone,
  onUpdate,
}: {
  job: FileJob;
  terms: Record<string, Term[]>;
  collections: { id: string; nameEn: string; nameAr: string }[];
  onDone: (points: number) => void;
  onUpdate: (patch: Partial<FileJob>) => void;
}) {
  const t = useTranslations("upload");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [form, setForm] = React.useState<Enrichment | null>(null);
  const [reviewMonths, setReviewMonths] = React.useState(12);
  const [collectionId, setCollectionId] = React.useState("");
  const [asVersion, setAsVersion] = React.useState(false);

  React.useEffect(() => {
    if (job.enrichment && !form) setForm(job.enrichment);
  }, [job.enrichment, form]);

  async function confirm() {
    if (!form || !job.documentId) return;
    onUpdate({ phase: "saving" });
    try {
      const res = await fetch(`/api/v1/documents/${job.documentId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          review_months: reviewMonths,
          collection_id: collectionId || null,
          as_new_version_of: asVersion && job.duplicate ? job.duplicate.id : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdate({ phase: "done" });
      onDone(json.data.points ?? 20);
    } catch (e) {
      onUpdate({ phase: "error", error: String((e as Error).message) });
    }
  }

  const toggleCode = (key: "outcome_codes" | "sector_codes" | "topic_codes", code: string) => {
    if (!form) return;
    const list = form[key];
    setForm({
      ...form,
      [key]: list.includes(code) ? list.filter((c) => c !== code) : [...list, code],
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-sand-100 px-5 py-3.5">
        <FileText className="size-5 text-maroon-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{job.file.name}</p>
          <p className="text-xs text-ink-400 tnum">
            {(job.file.size / 1024 / 1024).toFixed(1)} MB
            {job.parsed ? ` · ${t("pages", { count: job.parsed.pageCount })}` : ""}
          </p>
        </div>
        {job.phase === "parsing" ? (
          <span className="flex items-center gap-2 text-xs text-ink-600">
            <Sparkles className="size-4 animate-pulse text-gold-500" />
            {t("phases." + PHASE_STEPS[Math.min(PHASE_STEPS.length - 1, Math.floor(job.progressHint * PHASE_STEPS.length))])}
          </span>
        ) : job.phase === "done" ? (
          <Check className="size-5 text-ok" />
        ) : null}
      </div>

      {job.phase === "parsing" ? (
        <div className="px-5 py-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-sand-100">
            <div
              className="h-full rounded-full bg-maroon-700 transition-all duration-500"
              style={{ width: `${job.progressHint * 100}%` }}
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      ) : null}

      {job.phase === "error" ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-danger">
          <CircleAlert className="size-4" /> {t("failed")} ({job.error})
        </div>
      ) : null}

      {(job.phase === "ready" || job.phase === "saving") && form ? (
        <div className="flex flex-col gap-4 px-5 py-4">
          {job.duplicate ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn bg-warn-light px-4 py-3 text-sm">
              <CircleAlert className="size-4 shrink-0 text-warn" />
              <span className="text-ink-900">
                {t("duplicateWarning", {
                  title: bi(locale, job.duplicate.titleEn, job.duplicate.titleAr),
                  pct: Math.round(job.duplicate.similarity * 100),
                })}
              </span>
              <label className="ms-auto flex cursor-pointer items-center gap-2 text-ink-900">
                <input
                  type="checkbox"
                  checked={asVersion}
                  onChange={(e) => setAsVersion(e.target.checked)}
                  className="accent-maroon-700"
                />
                {t("addAsVersion")}
              </label>
            </div>
          ) : null}

          {!asVersion ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("titleEn")}</Label>
                  <Input
                    value={form.title_en}
                    dir="ltr"
                    onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("titleAr")}</Label>
                  <Input
                    value={form.title_ar}
                    dir="rtl"
                    onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("summaryEn")}</Label>
                  <Textarea
                    value={form.summary_en}
                    dir="ltr"
                    rows={4}
                    onChange={(e) => setForm({ ...form, summary_en: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("summaryAr")}</Label>
                  <Textarea
                    value={form.summary_ar}
                    dir="rtl"
                    rows={4}
                    onChange={(e) => setForm({ ...form, summary_ar: e.target.value })}
                  />
                </div>
              </div>

              {form.key_facts.length ? (
                <div>
                  <Label>{t("keyFacts")}</Label>
                  <ul className="space-y-1.5 rounded-xl bg-sand-50 px-4 py-3">
                    {form.key_facts.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-ink-900">
                        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold-500" />
                        <span>
                          {bi(locale, f.text_en, f.text_ar)}
                          {f.page ? (
                            <span className="ms-1 text-xs text-ink-400 tnum">
                              ({t("page")} {f.page})
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("knowledgeType")}</Label>
                  <NativeSelect
                    value={form.knowledge_type_code}
                    onChange={(e) => setForm({ ...form, knowledge_type_code: e.target.value })}
                  >
                    {(terms.knowledge_type ?? []).map((k) => (
                      <option key={k.code} value={k.code}>
                        {bi(locale, k.nameEn, k.nameAr)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>{t("classificationLabel")}</Label>
                  <NativeSelect
                    value={String(form.classification_level)}
                    onChange={(e) =>
                      setForm({ ...form, classification_level: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4].map((l) => (
                      <option key={l} value={l}>
                        {tc(`classification.${l}` as never)}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="mt-1 text-[11px] text-ink-400">{form.classification_reason}</p>
                </div>
                <div>
                  <Label>{t("reviewDate")}</Label>
                  <NativeSelect
                    value={String(reviewMonths)}
                    onChange={(e) => setReviewMonths(Number(e.target.value))}
                  >
                    {[6, 12, 24, 36].map((m) => (
                      <option key={m} value={m}>
                        {t("reviewMonths", { count: m })}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <TagPicker
                label={t("outcomes")}
                list={terms.outcome ?? []}
                selected={form.outcome_codes}
                onToggle={(c) => toggleCode("outcome_codes", c)}
              />
              <TagPicker
                label={t("topics")}
                list={[...(terms.sector ?? []), ...(terms.topic ?? [])]}
                selected={[...form.sector_codes, ...form.topic_codes]}
                onToggle={(c) => {
                  const isSector = (terms.sector ?? []).some((s) => s.code === c);
                  toggleCode(isSector ? "sector_codes" : "topic_codes", c);
                }}
                collapsible
              />

              <div>
                <Label>{t("collection")}</Label>
                <NativeSelect
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="max-w-xs"
                >
                  <option value="">{t("noCollection")}</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {bi(locale, c.nameEn, c.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {job.related?.length ? (
                <p className="text-xs text-ink-600">
                  {t("relatedHint")}{" "}
                  {job.related.map((r, i) => (
                    <span key={r.id} className="text-maroon-700">
                      {bi(locale, r.titleEn, r.titleAr)}
                      {i < job.related!.length - 1 ? "، " : ""}
                    </span>
                  ))}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-sand-100 pt-4">
            <Button loading={job.phase === "saving"} onClick={confirm} size="lg">
              {asVersion ? t("addVersionCta") : t("uploadCta")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TagPicker({
  label,
  list,
  selected,
  onToggle,
  collapsible,
}: {
  label: string;
  list: Term[];
  selected: string[];
  onToggle: (code: string) => void;
  collapsible?: boolean;
}) {
  const locale = useLocale();
  const [open, setOpen] = React.useState(!collapsible);
  const visible = open ? list : list.filter((l) => selected.includes(l.code));
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Label className="mb-0">{label}</Label>
        {collapsible ? (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center text-xs text-maroon-700 cursor-pointer"
            type="button"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(visible.length || open ? visible : list.slice(0, 8)).map((term) => {
          const active = selected.includes(term.code);
          return (
            <button
              key={term.code}
              type="button"
              onClick={() => onToggle(term.code)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer",
                active
                  ? "border-maroon-700 bg-maroon-100 font-medium text-maroon-900"
                  : "border-sand-300 bg-white text-ink-600 hover:border-maroon-300"
              )}
            >
              {bi(locale, term.nameEn, term.nameAr)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
