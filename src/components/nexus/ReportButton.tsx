"use client";
// CR02 7.1/7.2: the "Extract report" entry point. Opens a selection panel
// (scope summary, refine controls, audience, language, options), runs the
// generation job with progress, then previews with Download and Save to
// Vault.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileOutput, Library, Loader2 } from "lucide-react";
import { bi } from "@/lib/utils";
import {
  Button,
  Chip,
  Input,
  Label,
  NativeSelect,
} from "@/components/ui/primitives";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export type ReportScope = {
  kind: "signals" | "lessons" | "vault" | "node" | "ask" | "podcast" | "collection" | "indices" | "hr";
  ids: string[];
  labelEn: string;
  labelAr: string;
  filters?: Record<string, string>;
};

type Phase = "form" | "generating" | "done" | "failed";

export function ReportButton({
  scope,
  trigger,
}: {
  scope: ReportScope;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("form");
  const [audience, setAudience] = React.useState<"leadership" | "working">("working");
  const [language, setLanguage] = React.useState<"en" | "ar" | "both">(
    locale === "ar" ? "ar" : "en"
  );
  const [summaryLength, setSummaryLength] = React.useState<"short" | "full">("short");
  const [includeCharts, setIncludeCharts] = React.useState(true);
  const [includeSources, setIncludeSources] = React.useState(true);
  const [includeLessons, setIncludeLessons] = React.useState(true);
  const [includeSignals, setIncludeSignals] = React.useState(scope.kind === "signals");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [progress, setProgress] = React.useState("");
  const [report, setReport] = React.useState<{
    id: string;
    title: string;
    itemCount: number;
    savedDocumentId?: string | null;
  } | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function generate() {
    setPhase("generating");
    setProgress(t("progressQueued"));
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          options: {
            audience,
            language,
            summaryLength,
            includeCharts,
            includeSources,
            includeLessons,
            includeSignals,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const id = json.data.id as string;
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`/api/v1/reports/${id}`);
          const pj = await poll.json();
          const row = pj.data;
          if (!row) return;
          if (row.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setReport({ id, title: row.title, itemCount: row.itemCount ?? 0 });
            setPhase("done");
          } else if (row.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("failed");
          } else {
            setProgress(row.progress || t("progressWriting"));
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch {
      setPhase("failed");
    }
  }

  async function saveToVault() {
    if (!report) return;
    const res = await fetch(`/api/v1/reports/${report.id}/save`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setReport({ ...report, savedDocumentId: json.data.documentId });
      toast(t("savedToVault"), "points");
    } else {
      toast(t("saveFailed"), "error");
    }
  }

  const counts = scope.ids.length;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o && pollRef.current) clearInterval(pollRef.current);
    }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" data-testid="extract-report">
            <FileOutput /> {t("extract")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="start-auto end-0 top-0 h-full w-[min(480px,94vw)] translate-x-0 translate-y-0 rtl:translate-x-0 overflow-y-auto rounded-none border-s border-sand-300"
        title={t("extract")}
      >
        {/* Scope summary */}
        <div className="mb-4 rounded-xl bg-sand-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            {t("scope")}
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900">
            {bi(locale, scope.labelEn, scope.labelAr)}
          </p>
          <p className="mt-0.5 text-xs text-ink-600 tnum">
            {t(`kinds.${scope.kind}` as never)}
            {counts > 1 ? ` · ${t("itemCount", { count: counts })}` : ""}
          </p>
        </div>

        {phase === "form" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("audience")}</Label>
                <NativeSelect
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as never)}
                >
                  <option value="working">{t("audienceWorking")}</option>
                  <option value="leadership">{t("audienceLeadership")}</option>
                </NativeSelect>
              </div>
              <div>
                <Label>{t("language")}</Label>
                <NativeSelect
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as never)}
                >
                  <option value="en">{t("langEn")}</option>
                  <option value="ar">{t("langAr")}</option>
                  <option value="both">{t("langBoth")}</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("dateFrom")}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>{t("dateTo")}</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("summaryLength")}</Label>
              <NativeSelect
                value={summaryLength}
                onChange={(e) => setSummaryLength(e.target.value as never)}
              >
                <option value="short">{t("summaryShort")}</option>
                <option value="full">{t("summaryFull")}</option>
              </NativeSelect>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-medium text-ink-600">{t("options")}</legend>
              {(
                [
                  ["charts", includeCharts, setIncludeCharts],
                  ["sources", includeSources, setIncludeSources],
                  ["lessons", includeLessons, setIncludeLessons],
                  ["signals", includeSignals, setIncludeSignals],
                ] as const
              ).map(([key, value, setter]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-900">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="size-4 accent-[var(--color-maroon-700)]"
                  />
                  {t(`include.${key}` as never)}
                </label>
              ))}
            </fieldset>
            <Button onClick={generate} data-testid="generate-report">
              <FileOutput /> {t("generate")}
            </Button>
          </div>
        ) : null}

        {phase === "generating" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-maroon-700" />
            <p className="text-sm text-ink-600" aria-live="polite">
              {progress}
            </p>
          </div>
        ) : null}

        {phase === "done" && report ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-ok bg-ok-light px-4 py-3">
              <p className="text-sm font-medium text-ink-900">{report.title}</p>
              <p className="mt-0.5 text-xs text-ink-600 tnum">
                {t("itemCount", { count: report.itemCount })}
              </p>
            </div>
            <a href={`/api/v1/reports/${report.id}/download`} className="w-full">
              <Button className="w-full">
                <Download /> {t("download")}
              </Button>
            </a>
            <Button
              variant="secondary"
              onClick={saveToVault}
              disabled={Boolean(report.savedDocumentId)}
            >
              <Library /> {report.savedDocumentId ? t("savedToVault") : t("saveToVault")}
            </Button>
            {report.savedDocumentId ? (
              <Chip tone="ok">{t("searchable")}</Chip>
            ) : null}
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="flex flex-col gap-3 py-6 text-center">
            <p className="text-sm text-danger">{t("failed")}</p>
            <Button variant="secondary" onClick={() => setPhase("form")}>
              {t("tryAgain")}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
