"use client";
// CR08 6.2: "Add to handover" accepts everything Add Knowledge accepts. The
// notes, files or voice recording go through the Add Knowledge structurer
// (/api/v1/knowledge/structure), the reviewed items are published through
// /api/v1/knowledge/publish with the handover pre-linked, and the published
// resources are then filed as checklist items. A plain manual entry (a
// contact, a link, a tacit topic) skips the AI and lands as an item.
import * as React from "react";
import { useTranslations } from "next-intl";
import { FileUp, Mic, PenLine, Plus, Sparkles } from "lucide-react";
import { Button, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CATEGORIES, type ItemCategory } from "@/lib/handover-constants";
import type { KnowledgeItem } from "@/server/ai/knowledge_structurer";
import { SpeakPanel } from "../../add/SpeakPanel";
import { api } from "./bits";

type Mode = "write" | "upload" | "speak" | "manual";

export function AddToHandoverPanel({ handoverId, onAdded }: { handoverId: string; onAdded: () => void }) {
  const t = useTranslations("handover.add");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [mode, setMode] = React.useState<Mode>("write");
  const [notes, setNotes] = React.useState("");
  const [whereFrom, setWhereFrom] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [transcript, setTranscript] = React.useState("");
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [items, setItems] = React.useState<KnowledgeItem[] | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [busy, setBusy] = React.useState<"structure" | "publish" | "manual" | null>(null);
  const [manual, setManual] = React.useState({ title: "", category: "contact" as ItemCategory, note: "" });
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function structure() {
    setBusy("structure");
    try {
      const form = new FormData();
      form.set("notes", mode === "speak" ? transcript : notes);
      form.set("whereFrom", whereFrom);
      for (const f of files) form.append("files", f);
      if (audioFile) form.set("audio", audioFile);
      const res = await fetch("/api/v1/knowledge/structure", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "error");
      const list = (json.data.items as KnowledgeItem[]) ?? [];
      setItems(list);
      setSelected(new Set(list.map((_, i) => i)));
      if (!list.length) toast(t("nothingFound"), "info");
    } catch (e) {
      toast((e as Error).message === "nothing_to_structure" ? t("nothingToStructure") : tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!items) return;
    const toPublish = items.filter((_, i) => selected.has(i));
    if (!toPublish.length) return;
    setBusy("publish");
    try {
      const res = await fetch("/api/v1/knowledge/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: toPublish, whereFrom, voice: mode === "speak", handoverId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "error");
      const published = (json.data.published as { type: string; id: string }[]) ?? [];
      const linked = await api(`/api/v1/handover/${handoverId}`, { method: "PATCH", body: JSON.stringify({ action: "add_item", published, note: whereFrom || null }) });
      if (!linked.ok) throw new Error(linked.error ?? "error");
      toast(t("added", { count: published.length }), "success");
      setItems(null);
      setNotes("");
      setFiles([]);
      setTranscript("");
      setAudioFile(null);
      onAdded();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function addManual() {
    if (!manual.title.trim()) return;
    setBusy("manual");
    try {
      const res = await api(`/api/v1/handover/${handoverId}`, { method: "PATCH", body: JSON.stringify({ action: "add_item", title: manual.title, category: manual.category, note: manual.note || null }) });
      if (!res.ok) throw new Error(res.error ?? "error");
      toast(t("added", { count: 1 }), "success");
      setManual({ title: "", category: manual.category, note: "" });
      onAdded();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  const modes: { key: Mode; icon: React.ReactNode }[] = [
    { key: "write", icon: <PenLine className="size-4" aria-hidden /> },
    { key: "upload", icon: <FileUp className="size-4" aria-hidden /> },
    { key: "speak", icon: <Mic className="size-4" aria-hidden /> },
    { key: "manual", icon: <Plus className="size-4" aria-hidden /> },
  ];
  const canStructure = mode === "speak" ? Boolean(transcript.trim() || audioFile) : mode === "upload" ? files.length > 0 || notes.trim().length > 0 : notes.trim().length > 0;

  return (
    <section className="card p-5" data-testid="add-to-handover">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink-900">{t("title")}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl bg-sand-100 p-1" role="tablist" aria-label={t("modes")}>
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => {
                setMode(m.key);
                setItems(null);
              }}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                mode === m.key ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
              )}
              data-testid={`add-mode-${m.key}`}
            >
              {m.icon} {t(`mode.${m.key}`)}
            </button>
          ))}
        </div>
      </div>

      {mode === "manual" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <Label htmlFor="manual-title">{t("manualTitle")}</Label>
            <Input id="manual-title" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder={t("manualPlaceholder")} data-testid="manual-title" />
          </div>
          <div>
            <Label htmlFor="manual-category">{t("manualCategory")}</Label>
            <NativeSelect id="manual-category" value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value as ItemCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categoryOption.${c}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="manual-note">{t("manualNote")}</Label>
            <Textarea id="manual-note" rows={3} dir="auto" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} placeholder={t("notePlaceholder")} data-testid="manual-note" />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={addManual} loading={busy === "manual"} disabled={!manual.title.trim()} data-testid="manual-add">
              <Plus /> {t("addItem")}
            </Button>
          </div>
        </div>
      ) : items ? (
        <div data-testid="add-review">
          <p className="mb-2 text-sm text-ink-600">{t("reviewHint", { count: items.length })}</p>
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-sand-200 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 cursor-pointer accent-maroon-700"
                  checked={selected.has(i)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setSelected(next);
                  }}
                  aria-label={item.title_en || item.title_ar}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900" dir="auto">
                    {item.title_en || item.title_ar}
                  </span>
                  <span className="block text-xs text-ink-600">{item.types.join(", ")}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={publish} loading={busy === "publish"} disabled={!selected.size} data-testid="add-publish">
              <Plus /> {t("fileIntoHandover")}
            </Button>
            <Button variant="ghost" onClick={() => setItems(null)}>
              {tc("back")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mode === "speak" ? (
            <SpeakPanel whisperAvailable={false} transcript={transcript} setTranscript={setTranscript} onAudioReady={setAudioFile} />
          ) : (
            <>
              <div>
                <Label htmlFor="add-notes">{t("notes")}</Label>
                <Textarea id="add-notes" rows={mode === "upload" ? 2 : 5} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} data-testid="add-notes" />
              </div>
              {mode === "upload" ? (
                <div>
                  <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} data-testid="add-files" />
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <FileUp /> {t("chooseFiles")}
                  </Button>
                  {files.length ? <span className="ms-2 text-xs text-ink-600 tnum">{t("filesChosen", { count: files.length })}</span> : null}
                </div>
              ) : null}
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="add-where">{t("whereFrom")}</Label>
              <Input id="add-where" value={whereFrom} onChange={(e) => setWhereFrom(e.target.value)} placeholder={t("whereFromPlaceholder")} />
            </div>
            <Button onClick={structure} loading={busy === "structure"} disabled={!canStructure} data-testid="add-structure">
              <Sparkles /> {t("structure")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
