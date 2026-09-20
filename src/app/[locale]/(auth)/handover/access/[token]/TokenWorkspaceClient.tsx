"use client";
// CR08 6.2: the token holder's minimal workspace.
import * as React from "react";
import { useTranslations } from "next-intl";
import { FileUp, Plus } from "lucide-react";
import { SiaLogo } from "@/components/nexus/Logo";
import { Button, Chip, Input, Label, Textarea } from "@/components/ui/primitives";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverDetail } from "@/server/services/handover";
import { api, Countdown, Eyebrow, KindChip, ProgressBar } from "@/app/[locale]/(app)/handover/_components/bits";
import { Checklist } from "@/app/[locale]/(app)/handover/_components/Checklist";
import { InterviewPanel } from "@/app/[locale]/(app)/handover/_components/InterviewPanel";

export function TokenWorkspaceClient(props: { token: string; initial: HandoverDetail; locale: string }) {
  return (
    <ToastProvider>
      <Workspace {...props} />
    </ToastProvider>
  );
}

function Workspace({ token, initial, locale }: { token: string; initial: HandoverDetail; locale: string }) {
  const t = useTranslations("handover.token");
  const th = useTranslations("handover");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [ws, setWs] = React.useState(initial);
  const [mode, setMode] = React.useState<"text" | "upload">("text");
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [note, setNote] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const base = `/api/v1/handover/access/${token}`;

  const reload = React.useCallback(async () => {
    const res = await api<HandoverDetail>(base);
    if (res.ok && res.data) setWs(res.data);
  }, [base]);

  async function saveNote(itemId: string, value: string) {
    const res = await api(base, { method: "POST", body: JSON.stringify({ action: "note", itemId, note: value }) });
    if (!res.ok) {
      toast(tc("error"), "error");
      return;
    }
    toast(th("checklist.noteSaved"), "success");
    await reload();
  }

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      let res;
      if (mode === "upload") {
        if (!file) return;
        const form = new FormData();
        form.set("title", title);
        form.set("note", note);
        form.set("file", file);
        res = await api(base, { method: "POST", body: form });
      } else {
        res = await api(base, { method: "POST", body: JSON.stringify({ action: "add_text", title, text, note: note || null }) });
      }
      if (!res.ok) throw new Error(res.error ?? "error");
      toast(t("added"), "success");
      setTitle("");
      setText("");
      setNote("");
      setFile(null);
      await reload();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          <SiaLogo variant="full" height={26} />
          <span className="text-xs text-ink-400">{t("eyebrow")}</span>
          <Link href={`/handover/access/${token}` as never} locale={otherLocale} className="ms-auto text-xs font-medium text-maroon-700 hover:underline" data-testid="token-locale">
            {otherLocale === "ar" ? "العربية" : "English"}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8" data-testid="token-workspace">
        <section className="card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
              <h1 className="mt-1 font-display text-3xl text-ink-900">{t("title", { name: locale === "ar" ? ws.person.nameAr : ws.person.nameEn })}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <KindChip kind={ws.kind} />
                {ws.person.organisationEn ? <Chip tone="sand">{locale === "ar" ? ws.person.organisationAr ?? ws.person.organisationEn : ws.person.organisationEn}</Chip> : null}
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">{t("intro")}</p>
            </div>
            <div className="w-full shrink-0 rounded-xl bg-sand-50 p-4 md:w-72">
              <Eyebrow>{th("lastWorkingDay")}</Eyebrow>
              <div className="mt-1">
                <Countdown days={ws.daysToLastWorkingDay} lastWorkingDay={ws.lastWorkingDay} />
              </div>
              {ws.access.expiresAt ? (
                <p className="mt-1 text-xs text-ink-600 tnum">
                  {/* end of the last working day, shown as that day */}
                  {t("expires")}: {formatDate(ws.access.expiresAt.slice(0, 10), locale)}
                </p>
              ) : null}
              <div className="mt-3">
                <ProgressBar value={ws.progress.items.pct} label={th("progress.items")} detail={`${ws.progress.items.done}/${ws.progress.items.total}`} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-ink-900">{t("checklist")}</h2>
          <Checklist categories={ws.categories} canEditNotes onSaveNote={saveNote} showRecipient={false} showFiling={false} />
        </section>

        <section className="card p-5" data-testid="token-add">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg text-ink-900">{t("addTitle")}</h2>
            <div className="inline-flex items-center gap-1 rounded-xl bg-sand-100 p-1" role="tablist">
              {(["text", "upload"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500", mode === m ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900")}
                  data-testid={`token-mode-${m}`}
                >
                  {t(`mode.${m}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="token-title">{t("itemTitle")}</Label>
              <Input id="token-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="token-title" />
            </div>
            {mode === "text" ? (
              <div>
                <Label htmlFor="token-text">{t("itemText")}</Label>
                <Textarea id="token-text" rows={5} dir="auto" value={text} onChange={(e) => setText(e.target.value)} data-testid="token-text" />
              </div>
            ) : (
              <div>
                <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="token-file" />
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileUp /> {t("chooseFile")}
                </Button>
                {file ? <span className="ms-2 text-xs text-ink-600">{file.name}</span> : null}
              </div>
            )}
            <div>
              <Label htmlFor="token-note">{t("itemNote")}</Label>
              <Textarea id="token-note" rows={2} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={th("checklist.notePlaceholder")} data-testid="token-note" />
            </div>
            <div>
              <Button onClick={add} loading={busy} disabled={!title.trim() || (mode === "upload" && !file)} data-testid="token-add-submit">
                <Plus /> {t("addSubmit")}
              </Button>
            </div>
          </div>
        </section>

        <InterviewPanel mode={{ kind: "token", token }} topics={ws.topics} interviews={ws.interviews} required={ws.interviewRequired} onChange={reload} />
        <p className="text-center text-xs text-ink-400">{t("footer")}</p>
      </main>
    </div>
  );
}
