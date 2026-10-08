"use client";
// CR08 5: the page previews of a report as a horizontal filmstrip; a page
// opens a lightbox with previous and next (buttons and arrow keys).
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { previewUrl } from "./shared";

export function Filmstrip({ reportId, count, version }: { reportId: string; count: number; version: number }) {
  const t = useTranslations("reports");
  const [open, setOpen] = React.useState<number | null>(null);
  // the version busts the browser cache after a re-render of the document
  const src = (n: number) => `${previewUrl(reportId, n)}?v=${version}`;

  const step = React.useCallback(
    (delta: number) => setOpen((cur) => (cur === null ? cur : Math.min(count - 1, Math.max(0, cur + delta)))),
    [count]
  );

  if (count <= 0) return null;

  return (
    <div data-testid="filmstrip">
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]" role="list" aria-label={t("report.pages")}>
        {Array.from({ length: count }).map((_, n) => (
          <button
            key={n}
            type="button"
            role="listitem"
            onClick={() => setOpen(n)}
            className={cn(
              "group/page flex w-[88px] shrink-0 cursor-pointer flex-col gap-1 rounded-lg p-1 text-center transition-transform duration-200 ease-[var(--ease-paper)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
              n === 0 && "ms-0"
            )}
            aria-label={t("report.pagePreview", { n: n + 1 })}
            data-testid="filmstrip-page"
          >
            <span className="block aspect-[5/7] w-full overflow-hidden rounded-md border border-mist-300 bg-white shadow-[var(--shadow-paper)] group-hover/page:border-navy-300">
              {/* private PNG served by the module API */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(n)} alt="" loading={n > 5 ? "lazy" : "eager"} decoding="async" className="h-full w-full object-cover object-top" />
            </span>
            <span className="text-[11px] text-ink-600 tnum">{n + 1}</span>
          </button>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          title={t("report.lightbox.title", { n: (open ?? 0) + 1, total: count })}
          className="w-[min(920px,96vw)] p-4 sm:p-5"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          data-testid="lightbox"
        >
          {open !== null ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => step(-1)}
                disabled={open === 0}
                aria-label={t("report.lightbox.prev")}
                data-testid="lightbox-prev"
              >
                <ChevronLeft className="flip-rtl" />
              </Button>
              <div className="flex min-w-0 flex-1 justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={open}
                  src={src(open)}
                  alt={t("report.pagePreview", { n: open + 1 })}
                  className="max-h-[78vh] w-auto max-w-full rounded-lg border border-mist-300 bg-white object-contain shadow-[var(--shadow-paper)]"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => step(1)}
                disabled={open >= count - 1}
                aria-label={t("report.lightbox.next")}
                data-testid="lightbox-next"
              >
                <ChevronRight className="flip-rtl" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
