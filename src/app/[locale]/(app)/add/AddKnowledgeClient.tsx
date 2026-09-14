"use client";
// CR01 5 + CR02 5.2: three input modes (Write, Upload, Speak) in; a stack of
// editable proposed items out. Publish sends each item to its module; spoken
// submissions keep their original audio and earn the voice bonus.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useDropzone } from "react-dropzone";
import {
  Sparkles,
  UploadCloud,
  X,
  Copy,
  Rows2,
  Eye,
  Send,
  FileText,
  Lightbulb,
  Radar,
  Gavel,
  UserRound,
  PenLine,
  Mic,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import {
  Button,
  Textarea,
  Input,
  Label,
  Chip,
  NativeSelect,
  EmptyState,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { KnowledgeItem } from "@/server/ai/knowledge_structurer";
import { SpeakPanel } from "./SpeakPanel";

type Topic = { code: string; nameEn: string; nameAr: string };
type Mode = "write" | "upload" | "speak";

const OUTCOME_CODES = [
  "eco_growth",
  "fiscal_sust",
  "workforce",
  "cohesive_society",
  "quality_life",
  "env_sust",
  "gov_excellence",
];

const LESSON_CATEGORIES = ["delivery", "external", "expert", "institutional"] as const;
const LESSONISH = new Set(["lesson", "insight", "indicator_observation"]);

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lesson: Lightbulb,
  insight: Lightbulb,
  signal: Radar,
  decision: Gavel,
  document: FileText,
  expert: UserRound,
  indicator_observation: FileText,
};

type AudioRef = { storagePath: string; filename: string; mime: string; sizeBytes: number };

export function AddKnowledgeClient({
  topics,
  nodeContext,
  categoryHint,
  initialMode,
  whisperAvailable,
  handoverId = null,
}: {
  topics: Topic[];
  nodeContext: { id: string; code: string | null; titleEn: string; titleAr: string } | null;
  categoryHint: string | null;
  initialMode: Mode;
  whisperAvailable: boolean;
  /* CR05 5.6.4: a capture session opened from a handover */
  handoverId?: string | null;
}) {
  const t = useTranslations("addKnowledge");
  const tl = useTranslations("lessons");
  const tt = useTranslations("trends");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();

  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [notes, setNotes] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [audioRef, setAudioRef] = React.useState<AudioRef | null>(null);
  const [wasVoice, setWasVoice] = React.useState(false);
  const [whereFrom, setWhereFrom] = React.useState("");
  const [urls, setUrls] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [structuring, setStructuring] = React.useState(false);
  const [items, setItems] = React.useState<KnowledgeItem[] | null>(null);
  const [showOriginal, setShowOriginal] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [publishedLinks, setPublishedLinks] = React.useState<{ type: string; id: string }[]>([]);

  // reader "draft a lesson from this" hand-off
  React.useEffect(() => {
    const draft = sessionStorage.getItem("nexus-lesson-draft");
    if (draft) {
      setNotes(draft);
      sessionStorage.removeItem("nexus-lesson-draft");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles((f) => [...f, ...accepted].slice(0, 8)),
    noClick: false,
  });

  const effectiveNotes =
    mode === "speak" || transcript.trim()
      ? [notes.trim(), transcript.trim()].filter(Boolean).join("\n\n")
      : notes;
  const canStructure = Boolean(effectiveNotes.trim() || files.length || urls.trim());

  async function structure() {
    if (!canStructure || structuring) return;
    setStructuring(true);
    try {
      const form = new FormData();
      form.set("notes", effectiveNotes);
      form.set("whereFrom", whereFrom);
      form.set("urls", urls);
      if (nodeContext) form.set("nodeId", nodeContext.id);
      if (categoryHint) form.set("category", categoryHint);
      for (const f of files) form.append("files", f);
      if (audioFile) form.set("audio", audioFile);
      const res = await fetch("/api/v1/knowledge/structure", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setItems(json.data.items);
      if (json.data.audioRef) setAudioRef(json.data.audioRef);
      if (mode === "speak" || audioFile) setWasVoice(true);
    } catch (e: any) {
      toast(e?.message === "nothing_to_structure" ? t("nothingToStructure") : tc("error"), "error");
    } finally {
      setStructuring(false);
    }
  }

  function patchItem(index: number, patch: Partial<KnowledgeItem>) {
    setItems((prev) => (prev ? prev.map((it, i) => (i === index ? { ...it, ...patch } : it)) : prev));
  }

  function removeItem(index: number) {
    setItems((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function splitItem(index: number) {
    setItems((prev) => {
      if (!prev) return prev;
      const item = prev[index];
      const copy: KnowledgeItem = JSON.parse(JSON.stringify(item));
      copy.title_en = copy.title_en ? `${copy.title_en} (2)` : copy.title_en;
      copy.title_ar = copy.title_ar ? `${copy.title_ar} (2)` : copy.title_ar;
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  function mergeWithPrevious(index: number) {
    setItems((prev) => {
      if (!prev || index === 0) return prev;
      const merged = { ...prev[index - 1] };
      const cur = prev[index];
      merged.cleaned_en = [merged.cleaned_en, cur.cleaned_en].filter(Boolean).join("\n\n");
      merged.cleaned_ar = [merged.cleaned_ar, cur.cleaned_ar].filter(Boolean).join("\n\n");
      merged.topic_codes = [...new Set([...merged.topic_codes, ...cur.topic_codes])];
      merged.outcome_links = [
        ...merged.outcome_links,
        ...cur.outcome_links.filter((l) => !merged.outcome_links.some((m) => m.code === l.code)),
      ];
      return prev.map((it, i) => (i === index - 1 ? merged : it)).filter((_, i) => i !== index);
    });
  }

  async function publish(only?: number) {
    if (!items?.length) return;
    const toPublish = only !== undefined ? [items[only]] : items;
    setPublishing(true);
    try {
      const res = await fetch("/api/v1/knowledge/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: toPublish, whereFrom, voice: wasVoice, audioRef, handoverId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("publishedToast", { count: json.data.published.length, points: json.data.points }), "points");
      if (only !== undefined) {
        removeItem(only);
        setPublishedLinks((p) => [...p, ...json.data.published]);
      } else {
        setPublishedLinks(json.data.published);
        setItems([]);
      }
    } catch {
      toast(tc("error"), "error");
    } finally {
      setPublishing(false);
    }
  }

  const topicName = (code: string) => {
    const topic = topics.find((x) => x.code === code);
    return topic ? bi(locale, topic.nameEn, topic.nameAr) : code;
  };

  const contextChip = nodeContext ? (
    <p className="mb-3">
      <Chip tone="maroon">
        {t("deliveryContext", {
          node: `${nodeContext.code ?? ""} ${bi(locale, nodeContext.titleEn, nodeContext.titleAr)}`.trim(),
        })}
      </Chip>
    </p>
  ) : null;

  /* ---------------- input stage ---------------- */
  if (items === null) {
    return (
      <div className="mx-auto max-w-3xl">
        {contextChip}
        {/* CR02 5.2: Write | Upload | Speak */}
        <div
          className="mb-4 inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1"
          role="tablist"
          data-testid="add-modes"
        >
          {(
            [
              ["write", PenLine],
              ["upload", UploadCloud],
              ["speak", Mic],
            ] as const
          ).map(([m, Icon]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
                mode === m
                  ? "bg-white font-medium text-maroon-900 shadow-sm"
                  : "text-ink-600 hover:text-ink-900"
              )}
            >
              <Icon className="size-4" /> {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        <div className="card p-5">
          {mode === "write" ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("pastePlaceholder")}
              rows={10}
              className="text-base"
              aria-label={t("pastePlaceholder")}
            />
          ) : null}

          {mode === "upload" ? (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-sand-300 px-4 py-14 text-sm text-ink-600 transition-colors hover:border-maroon-300",
                  isDragActive && "border-maroon-500 bg-maroon-50"
                )}
              >
                <input {...getInputProps()} />
                <UploadCloud className="size-5 text-maroon-500" />
                {t("dropHint")}
              </div>
              {files.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <Chip key={i} tone="sand">
                      {f.name}
                      <button
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={tc("delete")}
                        className="ms-1 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </Chip>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "speak" ? (
            <SpeakPanel
              whisperAvailable={whisperAvailable}
              transcript={transcript}
              setTranscript={setTranscript}
              onAudioReady={setAudioFile}
            />
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="add-from">{t("whereFrom")}</Label>
              <Input
                id="add-from"
                value={whereFrom}
                onChange={(e) => setWhereFrom(e.target.value)}
                placeholder={t("whereFromPlaceholder")}
              />
            </div>
            {mode !== "speak" ? (
              <div>
                <Label htmlFor="add-urls">{t("urls")}</Label>
                <Input
                  id="add-urls"
                  dir="ltr"
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end">
            <Button size="lg" onClick={structure} loading={structuring} disabled={!canStructure}>
              <Sparkles /> {t("structureCta")}
            </Button>
          </div>
        </div>
        {publishedLinks.length ? (
          <div className="card mt-5 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">
              {t("justPublished")}
            </p>
            <PublishedList links={publishedLinks} />
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------------- review stage ---------------- */
  return (
    <div className="mx-auto max-w-3xl">
      {contextChip}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setItems(null)}>
          {t("backToInput")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowOriginal((v) => !v)}>
          <Eye /> {showOriginal ? t("hideOriginal") : t("showOriginal")}
        </Button>
        {wasVoice ? (
          <Chip tone="gold">
            <Mic className="size-3" /> {t("modes.speak")}
          </Chip>
        ) : null}
        <span className="ms-auto">
          <Button onClick={() => publish()} loading={publishing} disabled={!items.length}>
            <Send /> {t("publishAll", { count: items.length })}
          </Button>
        </span>
      </div>

      {showOriginal && effectiveNotes.trim() ? (
        <div className="card mb-4 bg-sand-50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-600">
            {t("original")}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{effectiveNotes}</p>
        </div>
      ) : null}

      {!items.length ? (
        <EmptyState
          title={t("allPublished")}
          hint={t("allPublishedHint")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setItems(null);
                setNotes("");
                setTranscript("");
                setFiles([]);
                setAudioFile(null);
                setAudioRef(null);
                setWasVoice(false);
              }}
            >
              {t("addMore")}
            </Button>
          }
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {items.map((item, i) => {
          const Icon = TYPE_ICONS[item.types[0]] ?? Lightbulb;
          const lessonish = LESSONISH.has(item.types[0]);
          return (
            <div key={i} className="card p-5" data-testid="knowledge-item">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Icon className="size-4 text-gold-500" />
                <NativeSelect
                  value={item.types[0]}
                  onChange={(e) => patchItem(i, { types: [e.target.value, ...item.types.slice(1)] })}
                  className="w-auto"
                  aria-label={t("itemType")}
                >
                  {["lesson", "insight", "signal", "decision", "document", "expert", "indicator_observation"].map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`types.${ty}` as never)}
                    </option>
                  ))}
                </NativeSelect>
                {/* CR02 3.3: the suggested category, confirmed by the user */}
                {lessonish ? (
                  <NativeSelect
                    value={item.category ?? "institutional"}
                    onChange={(e) => patchItem(i, { category: e.target.value })}
                    className="w-auto"
                    aria-label={t("categoryField")}
                    data-testid="category-select"
                  >
                    {LESSON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {tl(`categories.${c}` as never)}
                      </option>
                    ))}
                  </NativeSelect>
                ) : null}
                {lessonish && item.node_link ? (
                  <Chip tone="maroon">
                    {item.node_link.code ?? bi(locale, item.node_link.title_en, item.node_link.title_ar)}
                    <button
                      onClick={() => patchItem(i, { node_link: null })}
                      aria-label={tc("delete")}
                      className="ms-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </Chip>
                ) : null}
                <button
                  onClick={() =>
                    patchItem(i, { classification_level: item.classification_level === 1 ? 2 : 1 })
                  }
                  className="cursor-pointer"
                  aria-label={t("toggleClassification")}
                >
                  <Chip tone={item.classification_level === 1 ? "gulf" : "sand"}>
                    {tc(`classification.${item.classification_level}` as never)}
                  </Chip>
                </button>
                {item.machine ? <Chip tone="gold">{tc("aiTranslation")}</Chip> : null}
                {item.file_ref ? <Chip tone="sand">{item.file_ref.filename}</Chip> : null}
                <span className="ms-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => splitItem(i)} aria-label={t("split")}>
                    <Copy />
                  </Button>
                  {i > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => mergeWithPrevious(i)} aria-label={t("merge")}>
                      <Rows2 />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => removeItem(i)} aria-label={tc("delete")}>
                    <X />
                  </Button>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>{t("titleEn")}</Label>
                  <Input
                    dir="ltr"
                    value={item.title_en}
                    onChange={(e) => patchItem(i, { title_en: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("titleAr")}</Label>
                  <Input
                    dir="rtl"
                    value={item.title_ar}
                    onChange={(e) => patchItem(i, { title_ar: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>{locale === "ar" ? t("cleanedAr") : t("cleanedEn")}</Label>
                <Textarea
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  rows={4}
                  value={locale === "ar" ? item.cleaned_ar || item.cleaned_en : item.cleaned_en || item.cleaned_ar}
                  onChange={(e) =>
                    locale === "ar"
                      ? patchItem(i, { cleaned_ar: e.target.value })
                      : patchItem(i, { cleaned_en: e.target.value })
                  }
                />
              </div>

              {/* tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {item.topic_codes.map((code) => (
                  <Chip key={code} tone="sand">
                    {topicName(code)}
                    <button
                      onClick={() =>
                        patchItem(i, { topic_codes: item.topic_codes.filter((c) => c !== code) })
                      }
                      aria-label={tc("delete")}
                      className="ms-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </Chip>
                ))}
                <NativeSelect
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !item.topic_codes.includes(e.target.value)) {
                      patchItem(i, { topic_codes: [...item.topic_codes, e.target.value].slice(0, 5) });
                    }
                  }}
                  className="h-7 w-auto text-xs"
                  aria-label={t("addTag")}
                >
                  <option value="">{t("addTag")}</option>
                  {topics.map((topic) => (
                    <option key={topic.code} value={topic.code}>
                      {bi(locale, topic.nameEn, topic.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {/* NDS3 links with reasons */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.outcome_links.map((link) => (
                  <Chip key={link.code} tone="maroon">
                    {tt(`outcomes.${link.code}` as never)}
                    <span className="ms-1 text-[10px] opacity-70">
                      {bi(locale, link.reason_en, link.reason_ar)}
                    </span>
                    <button
                      onClick={() =>
                        patchItem(i, {
                          outcome_links: item.outcome_links.filter((l) => l.code !== link.code),
                        })
                      }
                      aria-label={tc("delete")}
                      className="ms-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </Chip>
                ))}
                <NativeSelect
                  value=""
                  onChange={(e) => {
                    const code = e.target.value;
                    if (code && !item.outcome_links.some((l) => l.code === code)) {
                      patchItem(i, {
                        outcome_links: [
                          ...item.outcome_links,
                          { code, reason_en: "Added by the author.", reason_ar: "أضيف من قبل الكاتب." },
                        ].slice(0, 5),
                      });
                    }
                  }}
                  className="h-7 w-auto text-xs"
                  aria-label={t("addNdsLink")}
                >
                  <option value="">{t("addNdsLink")}</option>
                  {OUTCOME_CODES.map((code) => (
                    <option key={code} value={code}>
                      {tt(`outcomes.${code}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {(item.next_step_en || item.next_step_ar) ? (
                <p className="mt-3 rounded-lg bg-gulf-100/50 px-3 py-2 text-xs leading-relaxed text-gulf-600">
                  {bi(locale, item.next_step_en, item.next_step_ar)}
                </p>
              ) : null}

              <div className="mt-3 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => publish(i)} loading={publishing}>
                  <Send /> {t("publishOne")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {publishedLinks.length ? (
        <div className="card mt-5 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-600">
            {t("justPublished")}
          </p>
          <PublishedList links={publishedLinks} />
        </div>
      ) : null}
    </div>
  );
}

function PublishedList({ links }: { links: { type: string; id: string }[] }) {
  const t = useTranslations("addKnowledge");
  const href = (l: { type: string; id: string }) =>
    l.type === "lesson"
      ? `/lessons/${l.id}`
      : l.type === "signal"
        ? `/trends/${l.id}`
        : l.type === "document"
          ? `/vault/${l.id}`
          : l.type === "expert"
            ? `/experts/${l.id}`
            : "/lessons";
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l, i) => (
        <Link
          key={i}
          href={href(l) as never}
          className="rounded-lg bg-maroon-100 px-2.5 py-1 text-xs font-medium text-maroon-900 hover:bg-maroon-700 hover:text-white"
        >
          {t(`types.${l.type}` as never)} ↗
        </Link>
      ))}
    </div>
  );
}
