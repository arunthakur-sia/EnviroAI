"use client";
// The centre column: PDF pages on canvas via pdfjs, docx as HTML, sheets as tables.
// Reports "read fully" once the reader reaches the end.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Copy, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { Button, Skeleton } from "@/components/ui/primitives";

type TableData = { caption: string | null; columns: string[]; rows: string[][] };

export function Reader({
  documentId,
  kind,
  pageCount,
  initialPage,
  tables,
  page,
  onPageChange,
}: {
  documentId: string;
  kind: "pdf" | "html" | "tables" | "text";
  pageCount: number;
  initialPage: number;
  tables: TableData[];
  /** controlled page, so the outline can move the viewer; omit for a self-managed viewer */
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const readReported = React.useRef(false);

  const reportRead = React.useCallback(() => {
    if (readReported.current) return;
    readReported.current = true;
    fetch(`/api/v1/documents/${documentId}/read-complete`, { method: "POST" }).catch(() => {});
  }, [documentId]);

  return (
    <div className="min-w-0">
      {kind === "pdf" ? (
        <PdfViewer
          documentId={documentId}
          pageCount={pageCount}
          initialPage={initialPage}
          onLastPage={reportRead}
          page={page}
          onPageChange={onPageChange}
        />
      ) : kind === "html" ? (
        <HtmlViewer documentId={documentId} onEnd={reportRead} />
      ) : kind === "tables" ? (
        <div className="space-y-6">
          {tables.map((tb, i) => (
            <div key={i} className="card overflow-hidden">
              {tb.caption ? (
                <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-medium text-ink-900">
                  {tb.caption}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-mist-50 text-start">
                      {tb.columns.map((c, j) => (
                        <th key={j} className="px-3 py-2 text-start text-xs font-semibold text-ink-600">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.slice(0, 200).map((r, j) => (
                      <tr key={j} className="border-t border-mist-100">
                        {r.map((cell, k) => (
                          <td key={k} className="px-3 py-1.5 text-ink-900 tnum">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <TextViewer documentId={documentId} onEnd={reportRead} />
      )}
    </div>
  );
}

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200] as const;

function PdfViewer({
  documentId,
  pageCount,
  initialPage,
  onLastPage,
  page: controlledPage,
  onPageChange,
}: {
  documentId: string;
  pageCount: number;
  initialPage: number;
  onLastPage: () => void;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const t = useTranslations("reader");
  const tk = useTranslations("ksaReader.toolbar");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const shellRef = React.useRef<HTMLDivElement>(null);
  const [localPage, setLocalPage] = React.useState(Math.min(Math.max(1, initialPage), pageCount || 1));
  const [total, setTotal] = React.useState(pageCount || 1);
  const [loading, setLoading] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [zoom, setZoom] = React.useState<number>(100);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const pdfRef = React.useRef<any>(null);
  const renderTaskRef = React.useRef<any>(null);

  const controlled = controlledPage !== undefined;
  const page = Math.min(Math.max(1, controlled ? controlledPage : localPage), total || 1);
  const setPage = React.useCallback(
    (next: number | ((p: number) => number)) => {
      const value = typeof next === "function" ? next(page) : next;
      if (controlled) onPageChange?.(value);
      else setLocalPage(value);
    },
    [controlled, onPageChange, page]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument(`/api/v1/documents/${documentId}/download?inline=1`)
          .promise;
        if (cancelled) return;
        pdfRef.current = doc;
        setTotal(doc.numPages);
        setReady(true);
      } catch (e) {
        console.error("pdf load failed", e);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      pdfRef.current?.destroy?.();
    };
  }, [documentId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = pdfRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!ready || !doc || !canvas || !container) return;
      setLoading(true);
      try {
        renderTaskRef.current?.cancel?.();
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const containerWidth = container.clientWidth - 2;
        const viewport0 = pdfPage.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const scale = (containerWidth / viewport0.width) * (zoom / 100) * dpr;
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        const ctx = canvas.getContext("2d")!;
        renderTaskRef.current = pdfPage.render({ canvasContext: ctx, viewport });
        await renderTaskRef.current.promise;
      } catch {
        /* cancelled render */
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (page >= total) onLastPage();
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, page, total, zoom, fullscreen, onLastPage]);

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function stepZoom(dir: 1 | -1) {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const cur = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, cur + dir));
    setZoom(ZOOM_STEPS[next]);
  }
  function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }
  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(page));
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const tbBtn =
    "grid size-8 place-items-center rounded-lg border border-mist-300 bg-white text-ink-600 transition-colors hover:border-navy-300 hover:text-navy-700 disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500";

  return (
    <div ref={shellRef} className={fullscreen ? "flex h-full flex-col overflow-auto bg-mist-50 p-4" : undefined}>
      <div
        role="toolbar"
        aria-label={tk("label")}
        className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2"
        data-testid="reader-toolbar"
      >
        <button type="button" className={tbBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label={t("prevPage")}>
          <ChevronLeft className="size-4 flip-rtl" />
        </button>
        <span className="min-w-16 text-center text-sm text-ink-600 tnum" dir="ltr" data-testid="reader-page">
          {page} / {total}
        </span>
        <button type="button" className={tbBtn} onClick={() => setPage((p) => Math.min(total, p + 1))} disabled={page >= total} aria-label={t("nextPage")}>
          <ChevronRight className="size-4 flip-rtl" />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-mist-300" />
        <button type="button" className={tbBtn} onClick={() => stepZoom(-1)} disabled={zoom <= ZOOM_STEPS[0]} aria-label={tk("zoomOut")}>
          <Minus className="size-4" />
        </button>
        <span className="min-w-12 text-center text-sm text-ink-600 tnum" dir="ltr" data-testid="reader-zoom">{zoom}%</span>
        <button type="button" className={tbBtn} onClick={() => stepZoom(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label={tk("zoomIn")}>
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(100)}
          className="h-8 cursor-pointer rounded-lg border border-mist-300 bg-white px-3 text-xs font-medium text-ink-600 transition-colors hover:border-navy-300 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500"
        >
          {tk("fitWidth")}
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-mist-300" />
        <button type="button" className={tbBtn} onClick={toggleFullscreen} aria-label={fullscreen ? tk("exitFullscreen") : tk("fullscreen")}>
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button type="button" className={tbBtn} onClick={copyLink} aria-label={tk("copyLink")} title={copied ? tk("copied") : tk("copyLink")}>
          <Copy className="size-4" />
        </button>
        <span role="status" className="sr-only">{copied ? tk("copied") : ""}</span>
      </div>
      <div ref={containerRef} className="card overflow-auto" style={fullscreen ? undefined : { maxHeight: "calc(100vh - 14rem)" }}>
        {loading ? <Skeleton className="aspect-[1/1.35] w-full" /> : null}
        <canvas ref={canvasRef} className={loading ? "hidden" : "block"} />
      </div>
    </div>
  );
}

function HtmlViewer({ documentId, onEnd }: { documentId: string; onEnd: () => void }) {
  const [html, setHtml] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch(`/api/v1/documents/${documentId}/content?kind=html`)
      .then((r) => r.json())
      .then((j) => setHtml(j.data?.html ?? ""))
      .catch(() => setHtml(""));
  }, [documentId]);
  return (
    <ScrollEndDetector onEnd={onEnd}>
      <div className="card measure mx-auto px-8 py-8">
        {html === null ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div
            className="prose-sm leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_h1]:mt-4 [&_h2]:mt-3 [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-mist-200 [&_td]:px-2 [&_td]:py-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </ScrollEndDetector>
  );
}

function TextViewer({ documentId, onEnd }: { documentId: string; onEnd: () => void }) {
  const [text, setText] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch(`/api/v1/documents/${documentId}/content?kind=text`)
      .then((r) => r.json())
      .then((j) => setText(j.data?.text ?? ""))
      .catch(() => setText(""));
  }, [documentId]);
  return (
    <ScrollEndDetector onEnd={onEnd}>
      <div className="card measure mx-auto whitespace-pre-wrap px-8 py-8 text-sm leading-relaxed text-ink-900">
        {text === null ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          text || "-"
        )}
      </div>
    </ScrollEndDetector>
  );
}

function ScrollEndDetector({
  children,
  onEnd,
}: {
  children: React.ReactNode;
  onEnd: () => void;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onEnd();
      },
      { threshold: 0.9 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onEnd]);
  return (
    <div>
      {children}
      <div ref={endRef} className="h-2" />
    </div>
  );
}
