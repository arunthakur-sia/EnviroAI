// CR08 5.4: the report_build job. Loads the request from `reports`, runs each
// selected section (load then write) with per-section progress in
// `report_sections`, assembles the ReportDocumentModel, renders the docx per
// language through the template, stores docx_path and preview images, writes
// a report_versions row and notifies the requester. runSectionRebuild
// regenerates one section, keeps every other section as stored (manual
// edits included) and re-renders. Owned by the Reports builder agent.
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, rawClient, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";
import { aiLive } from "@/server/ai/client";
import { getUserById, type CurrentUser } from "@/server/auth/session";
import { notify } from "@/server/gamification/engine";
import { renderDocxPreviews, renderReportDocx } from "./template";
import { aggregateSources, orderSections, SECTION_LIBRARY } from "./sections";
import { periodLabel, yearMarkOf } from "./sections/_shared";
import {
  bi,
  type Audience,
  type BiText,
  type Lang,
  type LanguageMode,
  type ReportDocumentModel,
  type ReportFamily,
  type ReportPeriod,
  type ReportRequest,
  type ReportScope,
  type SectionCode,
  type SectionContent,
  type SectionContext,
} from "./spec";

/* ------------------------------------------------------------------ */
/* progress and status vocabulary (the review UI reads these)           */
/* ------------------------------------------------------------------ */

export type ProgressNote = { at: string; code?: string; en: string; ar: string };
export type ProgressState = {
  done: number;
  total: number;
  /** the section being written, null between steps and when finished */
  current: string | null;
  /** "rendering", "previews" or a section code while running; "finished" or "failed" at the end */
  stage: string;
  notes: ProgressNote[];
  /** true when the template could not render (docx pending) */
  templateUnavailable?: boolean;
  startedAt: string;
  finishedAt?: string;
};

/** Sentinel section code: re-render the docx from the stored sections only. */
export const RENDER_ONLY = "__render__";

export type BuildOptions = {
  /** force the mock writer even when the AI is live (seeds, probes) */
  forceMock?: boolean;
};

type ReportRow = typeof schema.reports.$inferSelect;
type TypeRow = typeof schema.reportTypes.$inferSelect;

const MODULE_DIR = path.join(process.cwd(), "data", "reports", "module");

/* A build writes a section row every few seconds while the worker may be
   ingesting a freshly published report; SQLite allows one writer, so the
   connection waits for the lock instead of failing with SQLITE_BUSY. */
rawClient.execute("PRAGMA busy_timeout = 8000;").catch(() => {});

/** Retries a write that hit a busy database (the status writes must land). */
async function persist<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const text = String((e as Error)?.message ?? e);
      if (!/SQLITE_BUSY|database is locked/i.test(text)) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last;
}

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** The ReportRequest a stored row describes. */
export function requestFromRow(row: ReportRow, type: TypeRow | null): ReportRequest {
  const period = parse<ReportPeriod>(row.periodJson, { kind: "year", year: new Date().getUTCFullYear(), label: bi("", "") });
  if (!period.label?.en) period.label = periodLabel(period);
  const scope = parse<ReportScope>(row.scopeJson, { kind: "npc", label: bi("National Planning Council", "المجلس الوطني للتخطيط") });
  const family = ((type?.family as ReportFamily | undefined) ?? "internal") as ReportFamily;
  return {
    reportId: row.id,
    typeCode: type?.code ?? "custom",
    family,
    period,
    scope,
    audience: (row.audience as Audience) ?? "working",
    languageMode: (row.languageMode as LanguageMode) ?? "en",
    sectionCodes: orderSections(parse<string[]>(row.sectionsJson, [])),
    classification: row.classificationLevel,
    requestedBy: row.requestedBy ?? row.createdBy ?? "",
  };
}

async function loadReport(reportId: string): Promise<{ row: ReportRow; type: TypeRow | null } | null> {
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).limit(1);
  if (!row) return null;
  const [type] = row.typeId
    ? await db.select().from(schema.reportTypes).where(eq(schema.reportTypes.id, row.typeId)).limit(1)
    : [];
  return { row, type: type ?? null };
}

async function saveProgress(reportId: string, progress: ProgressState): Promise<void> {
  await db
    .update(schema.reports)
    .set({ progressJson: JSON.stringify(progress), updatedAt: nowIso() })
    .where(eq(schema.reports.id, reportId));
}

function note(progress: ProgressState, en: string, ar: string, code?: string): void {
  progress.notes.push({ at: nowIso(), code, en, ar });
  if (progress.notes.length > 60) progress.notes.splice(0, progress.notes.length - 60);
}

/** The honest placeholder a failed section leaves in the document. */
function failedSection(code: SectionCode, message: string): SectionContent {
  const def = SECTION_LIBRARY[code];
  return {
    code,
    title: def.name,
    layout: def.layout === "cover" || def.layout === "contents" || def.layout === "closing" ? def.layout : "body",
    blocks: [
      {
        kind: "paragraph",
        style: "note",
        text: bi(
          `This section could not be generated (${message.slice(0, 160)}). Regenerate it from the review screen.`,
          `تعذر توليد هذا القسم (${message.slice(0, 160)}). أعد توليده من شاشة المراجعة.`
        ),
      },
    ],
    sources: [],
    meta: { failed: true, error: message.slice(0, 300) },
  };
}

/** Numerals "01", "02"... for everything between the contents and the closing. */
function numberSections(sections: SectionContent[]): SectionContent[] {
  let n = 0;
  return sections.map((s) => {
    if (s.code === "cover" || s.code === "contents" || s.code === "closing") return { ...s, numeral: undefined };
    n += 1;
    return { ...s, numeral: String(n).padStart(2, "0") };
  });
}

function titleOf(row: ReportRow, type: TypeRow | null, request: ReportRequest): BiText {
  if (row.titleEn && row.titleAr) return bi(row.titleEn, row.titleAr);
  const typeName = type ? bi(type.nameEn, type.nameAr) : bi("Report", "تقرير");
  return composeTitle(typeName, request.scope, request.period);
}

/** "Type: scope, period" for a scoped report, "Type period" for the Council. */
export function composeTitle(typeName: BiText, scope: ReportScope, period: ReportPeriod): BiText {
  const p = periodLabel(period);
  if (scope.kind === "npc" || scope.kind === "period") {
    return bi(`${typeName.en} ${p.en}`, `${typeName.ar} ${p.ar}`);
  }
  return bi(`${typeName.en}: ${scope.label.en}, ${p.en}`, `${typeName.ar}: ${scope.label.ar}، ${p.ar}`);
}

function assembleModel(
  row: ReportRow,
  type: TypeRow | null,
  request: ReportRequest,
  user: CurrentUser,
  sections: SectionContent[]
): ReportDocumentModel {
  const typeName = type ? bi(type.nameEn, type.nameAr) : bi("Custom report", "تقرير مخصص");
  const cover = sections.find((s) => s.code === "cover");
  return {
    request,
    typeName,
    title: titleOf(row, type, request),
    subtitle: cover?.lead,
    periodLabel: periodLabel(request.period),
    yearMark: yearMarkOf(request.period),
    classification: request.classification,
    generatedAt: nowIso(),
    // the template prints "Generated by SiaNexus, <date>" and then "Prepared by: <this>"
    preparedBy: bi(user.nameEn, user.nameAr),
    sections: numberSections(sections),
    coverFigure: cover?.keyFigure,
  };
}

/* ------------------------------------------------------------------ */
/* rendering                                                             */
/* ------------------------------------------------------------------ */

async function renderAll(
  reportId: string,
  model: ReportDocumentModel,
  progress: ProgressState
): Promise<{ docxPath: string | null; previews: string[]; paths: Partial<Record<Lang, string>> }> {
  const langs: Lang[] = model.request.languageMode === "both" ? ["en", "ar"] : [model.request.languageMode];
  await fs.mkdir(MODULE_DIR, { recursive: true });
  const paths: Partial<Record<Lang, string>> = {};
  let templateUnavailable = false;
  for (const lang of langs) {
    progress.stage = "rendering";
    progress.current = null;
    await saveProgress(reportId, progress);
    const abs = path.join(MODULE_DIR, `${reportId}-${lang}.docx`);
    try {
      const buf = await renderReportDocx(model, { lang, outPath: abs });
      // the template may write the file itself; make sure it exists either way
      try {
        await fs.access(abs);
      } catch {
        await fs.writeFile(abs, buf);
      }
      paths[lang] = `reports/module/${reportId}-${lang}.docx`;
      note(progress, `Rendered the ${lang === "en" ? "English" : "Arabic"} document.`, `تم إخراج المستند ${lang === "en" ? "الإنجليزي" : "العربي"}.`);
    } catch (e) {
      templateUnavailable = true;
      const message = String((e as Error)?.message ?? e);
      note(
        progress,
        `Template unavailable for ${lang}: ${message.slice(0, 120)}. The sections are ready; the document renders once the template lands.`,
        `القالب غير متاح للغة ${lang === "en" ? "الإنجليزية" : "العربية"}: ${message.slice(0, 120)}. الأقسام جاهزة، ويُخرج المستند عند توفر القالب.`
      );
    }
  }
  progress.templateUnavailable = templateUnavailable;
  const primary = paths[langs[0]] ?? paths.en ?? paths.ar ?? null;
  let previews: string[] = [];
  if (primary) {
    progress.stage = "previews";
    await saveProgress(reportId, progress);
    try {
      previews = await renderDocxPreviews(path.join(process.cwd(), "data", primary));
      if (previews.length) note(progress, `${previews.length} preview pages captured.`, `تم التقاط ${previews.length} صفحات معاينة.`);
      else note(progress, "No page previews: no converter is available on this machine.", "لا توجد معاينات للصفحات: لا يتوفر محول على هذا الجهاز.");
    } catch (e) {
      note(progress, `Previews skipped: ${String((e as Error)?.message ?? e).slice(0, 120)}`, "تم تخطي المعاينات.");
    }
  }
  return { docxPath: primary, previews, paths };
}

/* ------------------------------------------------------------------ */
/* the jobs                                                              */
/* ------------------------------------------------------------------ */

export async function runReportBuild(reportId: string, opts: BuildOptions = {}): Promise<void> {
  const loaded = await loadReport(reportId);
  if (!loaded) throw new Error(`report ${reportId} not found`);
  const { row, type } = loaded;
  const request = requestFromRow(row, type);
  const codes = orderSections(request.sectionCodes);
  const progress: ProgressState = {
    done: 0,
    total: codes.length,
    current: null,
    stage: "starting",
    notes: [],
    startedAt: nowIso(),
  };
  const user = request.requestedBy ? await getUserById(request.requestedBy) : null;
  try {
    if (!user) throw new Error("requester_missing");
    if (!codes.length) throw new Error("no_sections_selected");
    await db
      .update(schema.reports)
      .set({ status: "generating", error: null, progressJson: JSON.stringify(progress), updatedAt: nowIso() })
      .where(eq(schema.reports.id, reportId));

    // one row per selected section, in canonical order
    const existing = await db.select().from(schema.reportSections).where(eq(schema.reportSections.reportId, reportId));
    for (const [i, code] of codes.entries()) {
      const hit = existing.find((s) => s.sectionCode === code);
      if (hit) {
        await db.update(schema.reportSections).set({ sort: i, updatedAt: nowIso() }).where(eq(schema.reportSections.id, hit.id));
      } else {
        await db.insert(schema.reportSections).values({ id: newId(), reportId, sectionCode: code, sort: i, status: "pending", updatedAt: nowIso() });
      }
    }

    const live = opts.forceMock ? false : await aiLive();
    note(progress, live ? "Writer: Claude, grounded in the loaded facts." : "Writer: deterministic mock (AI off).", live ? "الكاتب: كلود، مستنداً إلى الحقائق المحملة." : "الكاتب: المولد الحتمي (الذكاء الاصطناعي متوقف).");
    const ctx: SectionContext = {
      request,
      user,
      aiLive: live,
      progress: (text) => {
        progress.stage = text;
      },
    };

    const contents: SectionContent[] = [];
    for (const code of codes) {
      progress.current = code;
      progress.stage = code;
      await saveProgress(reportId, progress);
      await db
        .update(schema.reportSections)
        .set({ status: "generating", error: null, updatedAt: nowIso() })
        .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
      // keep manual edits when a full rebuild is re-run on a reviewed report
      const stored = existing.find((s) => s.sectionCode === code);
      if (stored?.status === "edited" && stored.contentJson) {
        const kept = parse<SectionContent | null>(stored.contentJson, null);
        if (kept) {
          contents.push(kept);
          await db
            .update(schema.reportSections)
            .set({ status: "edited", updatedAt: nowIso() })
            .where(eq(schema.reportSections.id, stored.id));
          progress.done += 1;
          note(progress, `Kept the edited ${code}.`, `تم الإبقاء على القسم المحرر ${code}.`, code);
          continue;
        }
      }
      try {
        const def = SECTION_LIBRARY[code];
        const data = await def.load(ctx);
        const content = await def.write(ctx, data);
        contents.push(content);
        await db
          .update(schema.reportSections)
          .set({ status: "ready", contentJson: JSON.stringify(content), error: null, updatedAt: nowIso() })
          .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
      } catch (e) {
        const message = String((e as Error)?.message ?? e);
        console.error(`[report_build] section ${code} failed:`, message);
        const placeholder = failedSection(code, message);
        contents.push(placeholder);
        await db
          .update(schema.reportSections)
          .set({ status: "failed", contentJson: JSON.stringify(placeholder), error: message.slice(0, 500), updatedAt: nowIso() })
          .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
        note(progress, `Section ${code} failed: ${message.slice(0, 120)}`, `فشل القسم ${code}.`, code);
      }
      progress.done += 1;
    }
    progress.current = null;

    // the appendix sees every other section
    const final = await finaliseSections(reportId, contents);
    const model = assembleModel(row, type, request, user, final);
    const rendered = await renderAll(reportId, model, progress);

    const version = row.version ?? 1;
    await db.insert(schema.reportVersions).values({
      id: newId(),
      reportId,
      version,
      docxPath: rendered.docxPath,
      snapshotJson: JSON.stringify({ model: { ...model, sections: model.sections.map((s) => ({ ...s, blocks: s.blocks.map((b) => (b.kind === "figure" ? { ...b, svg: undefined, pngBase64: undefined } : b)) })) }, paths: rendered.paths }),
      createdBy: user.id,
      createdAt: nowIso(),
    });
    progress.stage = "finished";
    progress.finishedAt = nowIso();
    note(progress, "Ready for review.", "جاهز للمراجعة.");
    await db
      .update(schema.reports)
      .set({
        status: "draft",
        docxPath: rendered.docxPath,
        previewImagesJson: JSON.stringify(rendered.previews),
        progressJson: JSON.stringify(progress),
        titleEn: row.titleEn ?? model.title.en,
        titleAr: row.titleAr ?? model.title.ar,
        error: null,
        finishedAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(schema.reports.id, reportId));
    await notify(
      user.id,
      "report_ready",
      `Report ready for review: ${model.title.en}`,
      `التقرير جاهز للمراجعة: ${model.title.ar}`,
      `/reports/${reportId}`,
      rendered.docxPath
        ? { en: "Every section is written and the document is rendered.", ar: "كل الأقسام مكتوبة والمستند مُخرج." }
        : { en: "Every section is written; the document renders once the template is available.", ar: "كل الأقسام مكتوبة؛ ويُخرج المستند عند توفر القالب." }
    );
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    console.error("[report_build] failed:", message);
    progress.stage = "failed";
    progress.current = null;
    progress.finishedAt = nowIso();
    note(progress, `Build failed: ${message.slice(0, 160)}`, `فشل البناء: ${message.slice(0, 160)}`);
    await persist(() =>
      db
        .update(schema.reports)
        .set({ status: "failed", error: message.slice(0, 500), progressJson: JSON.stringify(progress), finishedAt: nowIso(), updatedAt: nowIso() })
        .where(eq(schema.reports.id, reportId))
    );
    await persist(() =>
      db
        .update(schema.reportSections)
        .set({ status: "failed", error: "build aborted", updatedAt: nowIso() })
        .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.status, "generating")))
    );
    if (user) {
      await notify(user.id, "report_failed", "Report generation failed", "فشل توليد التقرير", `/reports/${reportId}`, { en: message.slice(0, 200), ar: "تعذر إكمال البناء؛ راجع تفاصيل التقرير." });
    }
  }
}

/** Rebuilds the sources appendix from the other sections and stores it. */
async function finaliseSections(reportId: string, contents: SectionContent[]): Promise<SectionContent[]> {
  if (!contents.some((s) => s.code === "sources_appendix")) return contents;
  const appendix = aggregateSources(contents);
  await db
    .update(schema.reportSections)
    .set({ status: "ready", contentJson: JSON.stringify(appendix), error: null, updatedAt: nowIso() })
    .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, "sources_appendix")));
  return contents.map((s) => (s.code === "sources_appendix" ? appendix : s));
}

/** Every stored section of a report in the request's order. */
export async function storedSections(reportId: string, codes: SectionCode[]): Promise<SectionContent[]> {
  const rows = await db.select().from(schema.reportSections).where(eq(schema.reportSections.reportId, reportId));
  const out: SectionContent[] = [];
  for (const code of codes) {
    const row = rows.find((r) => r.sectionCode === code);
    const content = row ? parse<SectionContent | null>(row.contentJson, null) : null;
    out.push(content ?? failedSection(code, "not generated"));
  }
  return out;
}

/**
 * Regenerates a single section of an existing report (review screen) and
 * re-renders the document; every other section stays as stored, manual
 * edits included. With RENDER_ONLY as the code, only the render runs (after
 * a manual edit).
 */
export async function runSectionRebuild(reportId: string, sectionCode: string, opts: BuildOptions = {}): Promise<void> {
  const loaded = await loadReport(reportId);
  if (!loaded) throw new Error(`report ${reportId} not found`);
  const { row, type } = loaded;
  const request = requestFromRow(row, type);
  const codes = orderSections(request.sectionCodes);
  const progress: ProgressState = {
    ...parse<ProgressState>(row.progressJson, { done: codes.length, total: codes.length, current: null, stage: "finished", notes: [], startedAt: nowIso() }),
    current: sectionCode === RENDER_ONLY ? null : sectionCode,
    stage: sectionCode === RENDER_ONLY ? "rendering" : sectionCode,
    finishedAt: undefined,
  };
  const previousStatus = row.status;
  const user = request.requestedBy ? await getUserById(request.requestedBy) : null;
  try {
    if (!user) throw new Error("requester_missing");
    const renderOnly = sectionCode === RENDER_ONLY;
    if (!renderOnly && !codes.includes(sectionCode as SectionCode)) throw new Error(`section ${sectionCode} is not part of this report`);
    await db
      .update(schema.reports)
      .set({ status: "generating", error: null, progressJson: JSON.stringify(progress), updatedAt: nowIso() })
      .where(eq(schema.reports.id, reportId));

    if (!renderOnly) {
      const code = sectionCode as SectionCode;
      await db
        .update(schema.reportSections)
        .set({ status: "generating", error: null, updatedAt: nowIso() })
        .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
      const live = opts.forceMock ? false : await aiLive();
      const ctx: SectionContext = { request, user, aiLive: live, progress: (text) => { progress.stage = text; } };
      try {
        const def = SECTION_LIBRARY[code];
        const content = await def.write(ctx, await def.load(ctx));
        await db
          .update(schema.reportSections)
          .set({ status: "ready", contentJson: JSON.stringify(content), error: null, commentsJson: null, updatedAt: nowIso() })
          .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
        note(progress, `Regenerated ${code}.`, `أُعيد توليد ${code}.`, code);
      } catch (e) {
        const message = String((e as Error)?.message ?? e);
        await db
          .update(schema.reportSections)
          .set({ status: "failed", contentJson: JSON.stringify(failedSection(code, message)), error: message.slice(0, 500), updatedAt: nowIso() })
          .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
        note(progress, `Section ${code} failed: ${message.slice(0, 120)}`, `فشل القسم ${code}.`, code);
      }
    }

    const sections = await finaliseSections(reportId, await storedSections(reportId, codes));
    const model = assembleModel(row, type, request, user, sections);
    const rendered = await renderAll(reportId, model, progress);
    const version = (row.version ?? 1) + 1;
    await db.insert(schema.reportVersions).values({
      id: newId(),
      reportId,
      version,
      docxPath: rendered.docxPath,
      snapshotJson: JSON.stringify({ reason: renderOnly ? "re-render" : `regenerate ${sectionCode}`, paths: rendered.paths }),
      createdBy: user.id,
      createdAt: nowIso(),
    });
    progress.current = null;
    progress.stage = "finished";
    progress.finishedAt = nowIso();
    // an approved report goes back to draft when a section is regenerated; a
    // render-only pass changes no content and keeps the status it found
    const nextStatus =
      previousStatus === "generating" || previousStatus === "failed"
        ? "draft"
        : !renderOnly && (previousStatus === "approved" || previousStatus === "published")
          ? "draft"
          : previousStatus;
    await db
      .update(schema.reports)
      .set({
        status: nextStatus,
        version,
        docxPath: rendered.docxPath ?? row.docxPath,
        previewImagesJson: rendered.previews.length ? JSON.stringify(rendered.previews) : row.previewImagesJson,
        progressJson: JSON.stringify(progress),
        error: null,
        updatedAt: nowIso(),
      })
      .where(eq(schema.reports.id, reportId));
    if (!renderOnly) {
      await notify(user.id, "report_section_ready", `Section regenerated: ${SECTION_LIBRARY[sectionCode as SectionCode].name.en}`, `أُعيد توليد القسم: ${SECTION_LIBRARY[sectionCode as SectionCode].name.ar}`, `/reports/${reportId}`);
    }
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    console.error("[report_section_rebuild] failed:", message);
    progress.stage = "failed";
    progress.current = null;
    note(progress, `Rebuild failed: ${message.slice(0, 160)}`, `فشل إعادة البناء: ${message.slice(0, 160)}`);
    await persist(() =>
      db
        .update(schema.reports)
        .set({ status: previousStatus === "generating" ? "failed" : previousStatus, error: message.slice(0, 500), progressJson: JSON.stringify(progress), updatedAt: nowIso() })
        .where(eq(schema.reports.id, reportId))
    );
    await persist(() =>
      db
        .update(schema.reportSections)
        .set({ status: "failed", error: "rebuild aborted", updatedAt: nowIso() })
        .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.status, "generating")))
    );
  }
}
