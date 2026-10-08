"use client";
// CR08 5.4: the report page and review tool. The cover preview, the metadata
// strip, the page filmstrip with its lightbox, the per-section progress list
// while the build runs (polled every two seconds), then every section with
// its content rendered from the SectionContent blocks, its comment thread,
// Regenerate section and manual editing of the text in both languages, and
// the lifecycle actions: Submit for review, and for the Super Admin Approve,
// Request changes and Publish, with Download per language.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ChevronLeft,
  Download,
  FileText,
  Languages,
  Library,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  Undo2,
} from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Button, Chip, ClassificationChip, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { ReportDetail, ReportSectionView } from "@/server/services/reports";
import { SetKnowledgeOfWeekButton } from "@/components/nexus/kow";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import { BlockRenderer } from "@/components/nexus/reports/BlockRenderer";
import { ButtonLink } from "@/components/nexus/reports/ButtonLink";
import { PlaceholderCover, useClassificationLabels } from "@/components/nexus/reports/CoverCard";
import { Filmstrip } from "@/components/nexus/reports/Filmstrip";
import { ProgressList } from "@/components/nexus/reports/ProgressList";
import { SectionEditor, type SectionPatch } from "@/components/nexus/reports/SectionEditor";
import { TimeAgo } from "@/components/nexus/reports/TimeAgo";
import { FAMILY_TONE, SECTION_STATUS_TONE, STATUS_TONE, downloadUrl, langOf, pick, previewUrl } from "@/components/nexus/reports/shared";

type StatusKey = "generating" | "draft" | "in_review" | "approved" | "published" | "failed";
type SectionStatusKey = "pending" | "generating" | "ready" | "edited" | "failed" | "needsEditing";
type ErrorKey = "locked" | "busy" | "invalid_state" | "docx_pending" | "sections_failed" | "forbidden" | "not_found" | "file_missing";
const ERROR_KEYS: ErrorKey[] = ["locked", "busy", "invalid_state", "docx_pending", "sections_failed", "forbidden", "not_found", "file_missing"];

function sectionStatus(s: ReportSectionView): SectionStatusKey {
  if (s.status === "ready" && s.content?.needsEditing) return "needsEditing";
  return (s.status as SectionStatusKey) ?? "pending";
}

const DOT: Record<SectionStatusKey, string> = {
  pending: "bg-ink-200",
  generating: "bg-info",
  ready: "bg-ok",
  edited: "bg-aqua-500",
  failed: "bg-danger",
  needsEditing: "bg-warn",
};

export function ReportPage({
  initial,
  focusSection,
  canSetKnowledgeOfWeek = false,
  numerals,
}: {
  initial: ReportDetail;
  focusSection: string | null;
  /** CR08 8: a Knowledge Admin may make an approved report the week's pick */
  canSetKnowledgeOfWeek?: boolean;
  numerals?: string;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const lang = langOf(locale);
  const router = useRouter();
  const { toast } = useToast();
  const labels = useClassificationLabels();

  const [detail, setDetail] = React.useState<ReportDetail>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [showBoth, setShowBoth] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [changesOpen, setChangesOpen] = React.useState(false);
  const [changesNote, setChangesNote] = React.useState("");

  const report = detail.report;
  const generating = report.status === "generating";
  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal";

  const refresh = React.useCallback(async (): Promise<ReportDetail | null> => {
    try {
      const res = await fetch(`/api/v1/report-builder/${report.id}`, { cache: "no-store" });
      if (res.status === 404) {
        router.replace("/reports");
        return null;
      }
      const j = await res.json().catch(() => null);
      if (j?.data?.report) {
        setDetail(j.data as ReportDetail);
        return j.data as ReportDetail;
      }
    } catch {
      /* the next poll retries */
    }
    return null;
  }, [report.id, router]);

  /* the build streams its progress: poll while generating */
  React.useEffect(() => {
    if (!generating) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [generating, refresh]);

  /* ?section= deep link from a notification */
  React.useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(`section-${focusSection}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusSection]);

  const errorText = (key: string | null | undefined, detailText?: string | null): string => {
    if (key && (ERROR_KEYS as string[]).includes(key)) return t(`report.errors.${key as ErrorKey}`);
    return detailText || t("report.errors.generic");
  };

  async function act(body: Record<string, unknown>, key: string, success: string, tone: "success" | "points" | "info" = "success"): Promise<Record<string, unknown> | null> {
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/report-builder/${report.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(t("report.toasts.error", { detail: errorText(j?.error, j?.detail) }), "error");
        return null;
      }
      await refresh();
      toast(success, tone);
      return (j?.data ?? {}) as Record<string, unknown>;
    } catch {
      toast(t("report.toasts.error", { detail: t("report.errors.generic") }), "error");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const saveSection = async (code: string, patch: SectionPatch) => {
    const data = await act({ action: "edit_section", code, patch }, `edit:${code}`, t("report.toasts.saved"));
    if (data) setEditing(null);
  };
  const postComment = async (code: string) => {
    const text = (drafts[code] ?? "").trim();
    if (!text) return;
    const data = await act({ action: "comment", code, text }, `comment:${code}`, t("report.toasts.commented"));
    if (data) setDrafts((d) => ({ ...d, [code]: "" }));
  };
  const regenerate = (code: string) => act({ action: "regenerate_section", code }, `regen:${code}`, t("report.toasts.regenerating"), "info");
  const submit = () => act({ action: "submit" }, "submit", t("report.toasts.submitted"));
  const approve = () => act({ action: "approve" }, "approve", t("report.toasts.approved"));
  const publish = () => act({ action: "publish" }, "publish", t("report.toasts.published"), "points");
  const requestChanges = async () => {
    const data = await act({ action: "request_changes", note: changesNote.trim() || undefined }, "changes", t("report.toasts.changes"));
    if (data) {
      setChangesOpen(false);
      setChangesNote("");
    }
  };

  const title = bi(locale, report.titleEn, report.titleAr);
  const familyLabel = t(`families.${report.family as "public" | "internal" | "custom"}`);
  const scopeText = report.scope.kind === "org" || report.scope.kind === "period" ? t(`scopeKinds.${report.scope.kind}`) : bi(locale, report.scope.label.en, report.scope.label.ar);
  const hasContent = detail.sections.some((s) => s.content && s.content.blocks.length);
  const showProgress = generating || report.status === "failed";
  const locked = !detail.canEdit && (report.status === "in_review" || report.status === "approved");

  return (
    <div data-testid="report-page" data-report-id={report.id} data-status={report.status} data-ask-context={`report:${report.id}`}>
      {/* header */}
      <div className="mb-5">
        <ButtonLink href="/reports" variant="ghost" size="sm" className="-ms-2">
          <ChevronLeft className="flip-rtl" /> {t("report.back")}
        </ButtonLink>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className={eyebrow}>{bi(locale, report.typeNameEn, report.typeNameAr)}</p>
            <h1 className="mt-1 font-display text-2xl leading-tight text-ink-900 sm:text-3xl" data-testid="report-title">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone={STATUS_TONE[report.status] ?? "mist"} data-testid="status-chip">
                {t(`statuses.${report.status as StatusKey}`)}
              </Chip>
              {familyLabel !== labels[Math.min(3, Math.max(0, report.classification - 1))] ? <Chip tone={FAMILY_TONE[report.family] ?? "mist"}>{familyLabel}</Chip> : null}
              <ClassificationChip level={report.classification} labels={labels} />
              <span className="text-xs text-ink-400 tnum">{t("hub.version", { n: report.version })}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="report-actions">
            {report.languageMode === "both" ? (
              <Button variant="ghost" size="sm" onClick={() => setShowBoth((v) => !v)} aria-pressed={showBoth} data-testid="toggle-languages">
                <Languages /> {showBoth ? t("report.showOne") : t("report.showBoth")}
              </Button>
            ) : null}
            {report.hasDocx ? (
              <>
                {report.languageMode !== "ar" ? (
                  <ButtonLink href={downloadUrl(report.id, "en")} external variant="secondary" size="sm" data-testid="download-en">
                    <Download /> {report.languageMode === "both" ? t("report.downloadEn") : t("report.download")}
                  </ButtonLink>
                ) : null}
                {report.languageMode !== "en" ? (
                  <ButtonLink href={downloadUrl(report.id, "ar")} external variant="secondary" size="sm" data-testid="download-ar">
                    <Download /> {report.languageMode === "both" ? t("report.downloadAr") : t("report.download")}
                  </ButtonLink>
                ) : null}
              </>
            ) : !generating ? (
              <span className="text-xs text-ink-400">{t("report.downloadPending")}</span>
            ) : null}
            {detail.canSubmit ? (
              <Button size="sm" onClick={submit} loading={busy === "submit"} disabled={generating} data-testid="submit-review">
                <Send /> {t("report.submit")}
              </Button>
            ) : null}
            {detail.canRequestChanges ? (
              <Button variant="secondary" size="sm" onClick={() => setChangesOpen(true)} disabled={generating} data-testid="request-changes">
                <Undo2 /> {t("report.requestChanges")}
              </Button>
            ) : null}
            {detail.canApprove ? (
              <Button size="sm" onClick={approve} loading={busy === "approve"} disabled={generating} data-testid="approve">
                <Check /> {t("report.approve")}
              </Button>
            ) : null}
            {detail.canPublish ? (
              <Button size="sm" onClick={publish} loading={busy === "publish"} disabled={generating} data-testid="publish">
                <BookOpenCheck /> {t("report.publish")}
              </Button>
            ) : null}
            {report.publishedDocumentId ? (
              <ButtonLink href={`/vault/${report.publishedDocumentId}`} variant="aqua" size="sm" data-testid="memory-link">
                <Library /> {t("report.memoryDoc")}
              </ButtonLink>
            ) : null}
            {/* CR08 8: a settled report can become the week's pick */}
            {canSetKnowledgeOfWeek && (report.status === "approved" || report.status === "published") ? (
              <span data-testid="set-kow">
                <SetKnowledgeOfWeekButton resourceType="report" resourceId={report.id} titleEn={report.titleEn} titleAr={report.titleAr} numerals={numerals} />
              </span>
            ) : null}
          </div>
        </div>
        {locked ? <p className="mt-2 text-xs text-ink-600">{t("report.locked", { status: t(`statuses.${report.status as StatusKey}`) })}</p> : null}
      </div>

      {/* cover, metadata strip, filmstrip */}
      {/* grid-cols-1 keeps the narrow track at minmax(0,1fr): without it the
          implicit auto track takes the filmstrip's min-content and the page
          scrolls sideways on a phone */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[220px] md:mx-0" data-testid="report-cover">
          <div className="aspect-[5/7] w-full overflow-hidden rounded-xl border border-mist-300 bg-navy-900 shadow-[var(--shadow-paper)]">
            {report.previewCount > 0 ? (
              // the cover page rendered by the template, served by the module API
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${previewUrl(report.id, 0)}?v=${report.version}`} alt={t("report.cover")} className="h-full w-full object-cover object-top" />
            ) : (
              <PlaceholderCover title={title} period={bi(locale, report.period.label.en, report.period.label.ar)} />
            )}
          </div>
        </div>
        <div className="card min-w-0 p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="report-meta">
            <div>
              <dt className={eyebrow}>{t("report.meta.type")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{bi(locale, report.typeNameEn, report.typeNameAr)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.period")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900 tnum">{bi(locale, report.period.label.en, report.period.label.ar)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.scope")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{scopeText}</dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.audience")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{t(`audiences.${report.audience as "leadership" | "working" | "public"}`)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.language")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{t(`languages.${report.languageMode}`)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.classification")}</dt>
              <dd className="mt-1">
                <ClassificationChip level={report.classification} labels={labels} />
              </dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.version")}</dt>
              <dd className="mt-0.5 text-sm text-ink-900 tnum">
                {t("hub.version", { n: report.version })}
                {detail.versions.length ? (
                  <span className="ms-1.5 text-xs text-ink-400">{t("report.versions", { count: detail.versions.length })}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className={eyebrow}>{t("report.meta.status")}</dt>
              <dd className="mt-1">
                <Chip tone={STATUS_TONE[report.status] ?? "mist"}>{t(`statuses.${report.status as StatusKey}`)}</Chip>
              </dd>
            </div>
            {report.requesterNameEn ? (
              <div>
                <dt className={eyebrow}>{t("report.meta.requester")}</dt>
                {/* CR08 9.1: the requester as a person chip. The compact
                    variant carries no role eyebrow of its own, so the
                    definition term above is not said twice. */}
                {report.requestedBy && report.requesterColor ? (
                  <dd className="mt-1">
                    <OwnerControlCompact
                      owner={{
                        id: report.requestedBy,
                        nameEn: report.requesterNameEn,
                        nameAr: report.requesterNameAr ?? report.requesterNameEn,
                        avatarColor: report.requesterColor,
                      }}
                      item={{ type: "report", id: report.id, titleEn: report.titleEn, titleAr: report.titleAr, href: `/reports/${report.id}` }}
                      size="md"
                    />
                  </dd>
                ) : (
                  <dd className="mt-0.5 text-sm text-ink-900">{bi(locale, report.requesterNameEn, report.requesterNameAr)}</dd>
                )}
              </div>
            ) : null}
            {report.approvedAt ? (
              <div>
                <dt className={eyebrow}>{t("report.meta.approvedBy")}</dt>
                <dd className="mt-0.5 text-sm text-ink-900 tnum">{formatDate(report.approvedAt, locale)}</dd>
              </div>
            ) : null}
            {report.publishedDocumentId ? (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <Chip tone="ok">
                  <BookOpenCheck className="size-3" aria-hidden /> {t("report.published")}
                </Chip>
              </div>
            ) : null}
          </dl>
          <div className="mt-5 border-t border-mist-200 pt-4">
            <p className={cn(eyebrow, "mb-2")}>
              {t("report.pages")}
              {report.previewCount ? <span className="ms-1.5 normal-case tracking-normal text-ink-400 tnum">{t("report.previewsCount", { count: report.previewCount })}</span> : null}
            </p>
            {report.previewCount > 0 ? (
              <Filmstrip reportId={report.id} count={report.previewCount} version={report.version} />
            ) : (
              <p className="text-xs text-ink-600">{t("report.noPreviews")}</p>
            )}
          </div>
        </div>
      </div>

      {/* progress while the build runs */}
      {showProgress ? (
        <div className="mt-6">
          <ProgressList sections={detail.sections} progress={report.progress} failed={report.status === "failed"} error={report.error} />
        </div>
      ) : null}

      {/* sections */}
      {hasContent || !showProgress ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <nav className="hidden lg:sticky lg:top-6 lg:block" aria-label={t("report.contents")} data-testid="contents-nav">
            <div className="card p-4">
              <p className={eyebrow}>{t("report.contents")}</p>
              <ol className="mt-2 space-y-0.5">
                {detail.sections.map((s) => {
                  const st = sectionStatus(s);
                  return (
                    <li key={s.code}>
                      <a
                        href={`#section-${s.code}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-600 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", DOT[st])} aria-hidden />
                        <span className="w-6 shrink-0 text-[11px] text-ink-400 tnum">{s.content?.numeral ?? ""}</span>
                        <span className="min-w-0 flex-1 truncate">{pick(lang, s.content?.title ?? s.name)}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </div>
          </nav>

          <div className="min-w-0 space-y-5">
            {detail.sections.map((s) => {
              const st = sectionStatus(s);
              const content = s.content;
              const isEditing = editing === s.code;
              const draft = drafts[s.code] ?? "";
              return (
                <article
                  key={s.code}
                  id={`section-${s.code}`}
                  className={cn("card scroll-mt-6 p-5 sm:p-6", focusSection === s.code && "ring-1 ring-aqua-500")}
                  data-testid="report-section"
                  data-section-code={s.code}
                  data-section-status={st}
                >
                  <header className="flex flex-wrap items-start gap-3">
                    {content?.numeral ? (
                      <span className="font-display text-4xl leading-none text-navy-300 tnum" aria-hidden>
                        {content.numeral}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-xl text-ink-900">{pick(lang, content?.title ?? s.name)}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                        <Chip tone={SECTION_STATUS_TONE[st] ?? "mist"} data-testid="section-status">
                          {t(`sectionStatus.${st}`)}
                        </Chip>
                        <span className="text-ink-400">{bi(locale, s.name.en, s.name.ar)}</span>
                        <span className="text-ink-400 tnum">· {t("builder.pagesEach", { count: s.estimatedPages })}</span>
                        {content?.meta?.editedBy ? <span className="text-ink-400">· {t("report.editedBy")}</span> : null}
                      </p>
                    </div>
                    {detail.canEdit ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(isEditing ? null : s.code)} disabled={generating || !content} data-testid="edit-section">
                          <PenLine /> {isEditing ? t("report.cancel") : t("report.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => regenerate(s.code)} loading={busy === `regen:${s.code}`} disabled={generating} data-testid="regenerate-section">
                          <RefreshCw /> {t("report.regenerate")}
                        </Button>
                      </div>
                    ) : null}
                  </header>

                  {st === "needsEditing" ? (
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-warn-light px-3 py-2 text-xs text-warn">
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {t("report.needsEditingHint")}
                    </p>
                  ) : null}
                  {s.status === "failed" && s.error ? (
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">
                      <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {t("report.failedSection", { error: s.error })}
                    </p>
                  ) : null}

                  {isEditing && content ? (
                    <SectionEditor content={content} saving={busy === `edit:${s.code}`} onSave={(p) => saveSection(s.code, p)} onCancel={() => setEditing(null)} />
                  ) : content ? (
                    <div className="mt-4">
                      {content.lead ? <p className="font-display text-lg leading-relaxed text-ink-900">{pick(lang, content.lead)}</p> : null}
                      {content.keyFigure ? (
                        <div className="mt-3 inline-flex flex-col rounded-xl bg-navy-50 px-4 py-3">
                          <span className="font-display text-3xl leading-none text-navy-900 tnum" style={{ unicodeBidi: "plaintext" }}>
                            {content.keyFigure.value}
                          </span>
                          <span className="mt-1 text-xs text-ink-600">{pick(lang, content.keyFigure.label)}</span>
                        </div>
                      ) : null}
                      {content.blocks.length ? (
                        showBoth ? (
                          <div className="mt-2 grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <div dir="ltr" lang="en">
                              <BlockRenderer blocks={content.blocks} lang="en" />
                            </div>
                            <div dir="rtl" lang="ar">
                              <BlockRenderer blocks={content.blocks} lang="ar" />
                            </div>
                          </div>
                        ) : (
                          <BlockRenderer blocks={content.blocks} lang={lang} />
                        )
                      ) : st === "ready" || st === "edited" ? (
                        // the cover and the contents carry no blocks: the
                        // document template composes those pages, so say so
                        // instead of calling a finished section empty
                        <p className="mt-3 flex items-center gap-2 rounded-lg bg-mist-50 px-3 py-2 text-xs text-ink-600" data-testid="template-page">
                          <FileText className="size-3.5 shrink-0 text-ink-400" aria-hidden /> {t("report.templatePage")}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-ink-600">{t("report.empty")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-ink-600">{t("report.empty")}</p>
                  )}

                  {/* comments */}
                  <div className="mt-5 border-t border-mist-200 pt-4" data-testid="section-comments">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                      <MessageSquare className="size-3.5" aria-hidden /> {t("report.comments", { count: s.comments.length })}
                    </p>
                    {s.comments.length ? (
                      <ul className="mt-2 space-y-2">
                        {s.comments.map((c) => (
                          <li key={c.id} className="flex gap-2.5" data-testid="section-comment">
                            <Avatar name={bi(locale, c.nameEn, c.nameAr)} size={26} className="mt-0.5" />
                            <div className="min-w-0 flex-1 rounded-lg bg-mist-50 px-3 py-2">
                              <p className="text-xs text-ink-600">
                                <span className="font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</span>{" "}
                                <TimeAgo iso={c.at} className="text-ink-400" />
                              </p>
                              <p className="mt-0.5 text-sm text-ink-900" dir="auto">
                                {c.text}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-ink-400">{t("report.noComments")}</p>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        postComment(s.code);
                      }}
                      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                    >
                      <Textarea
                        rows={2}
                        value={draft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.code]: e.target.value }))}
                        placeholder={t("report.commentPlaceholder")}
                        aria-label={t("report.addComment")}
                        className="min-h-0 flex-1"
                        data-testid="comment-input"
                      />
                      <Button type="submit" variant="secondary" size="sm" loading={busy === `comment:${s.code}`} disabled={!draft.trim()} data-testid="comment-post">
                        <Send /> {t("report.post")}
                      </Button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* request changes */}
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent title={t("report.changesTitle")} data-testid="changes-dialog">
          <label className="mb-1.5 block text-xs font-medium text-ink-600" htmlFor="changes-note">
            {t("report.changesNote")}
          </label>
          <Textarea id="changes-note" value={changesNote} onChange={(e) => setChangesNote(e.target.value)} placeholder={t("report.changesPlaceholder")} data-testid="changes-note" />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setChangesOpen(false)} disabled={busy === "changes"}>
              {t("report.cancel")}
            </Button>
            <Button onClick={requestChanges} loading={busy === "changes"} data-testid="changes-send">
              <Send /> {t("report.send")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
