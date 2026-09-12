"use client";
// The centre column: PDF pages on canvas via pdfjs, docx as HTML, sheets as tables.
// Reports "read fully" once the reader reaches the end.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Skeleton } from "@/components/ui/primitives";

type TableData = { caption: string | null; columns: string[]; rows: string[][] };

export function Reader({
  documentId,
  kind,
  pageCount,
  initialPage,
  tables,
}: {
  documentId: string;
  kind: "pdf" | "html" | "tables" | "text";
  pageCount: number;
  initialPage: number;
  tables: TableData[];
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
        />
      ) : kind === "html" ? (
        <HtmlViewer documentId={documentId} onEnd={reportRead} />
      ) : kind === "tables" ? (
        <div className="space-y-6">
          {tables.map((tb, i) => (
            <div key={i} className="card overflow-hidden">
              {tb.caption ? (
                <p className="border-b border-sand-100 px-4 py-2.5 text-sm font-medium text-ink-900">
                  {tb.caption}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sand-50 text-start">
                      {tb.columns.map((c, j) => (
                        <th key={j} className="px-3 py-2 text-start text-xs font-semibold text-ink-600">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.slice(0, 200).map((r, j) => (
                      <tr key={j} className="border-t border-sand-100">
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

function PdfViewer({
  documentId,
  pageCount,
  initialPage,
  onLastPage,
}: {
  documentId: string;
  pageCount: number;
  initialPage: number;
  onLastPage: () => void;
}) {
  const t = useTranslations("reader");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState(Math.min(Math.max(1, initialPage), pageCount || 1));
  const [total, setTotal] = React.useState(pageCount || 1);
  const [loading, setLoading] = React.useState(true);
  const pdfRef = React.useRef<any>(null);
  const renderTaskRef = React.useRef<any>(null);

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
      if (!doc || !canvas || !container) return;
      setLoading(true);
      try {
        renderTaskRef.current?.cancel?.();
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const containerWidth = container.clientWidth - 2;
        const viewport0 = pdfPage.getViewport({ scale: 1 });
        const scale = (containerWidth / viewport0.width) * (window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
        canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
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
  }, [page, total, onLastPage]);

  // re-render when the pdf finishes loading
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => {
      if (pdfRef.current) {
        setTick((x) => x + 1);
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }, []);
  React.useEffect(() => {
    if (tick > 0) setPage((p) => p); // trigger render effect
  }, [tick]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label={t("prevPage")}
        >
          <ChevronLeft className="flip-rtl" />
        </Button>
        <span className="text-sm text-ink-600 tnum" dir="ltr">
          {page} / {total}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPage((p) => Math.min(total, p + 1))}
          disabled={page >= total}
          aria-label={t("nextPage")}
        >
          <ChevronRight className="flip-rtl" />
        </Button>
      </div>
      <div ref={containerRef} className="card overflow-hidden">
        {loading ? <Skeleton className="aspect-[1/1.35] w-full" /> : null}
        <canvas ref={canvasRef} className={loading ? "hidden" : "block w-full"} />
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
            className="prose-sm leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_h1]:mt-4 [&_h2]:mt-3 [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-sand-200 [&_td]:px-2 [&_td]:py-1"
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
          text || "—"
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
