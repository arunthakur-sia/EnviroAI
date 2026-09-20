// CR08 Phase B: the shape a page shows while its data is still coming. One
// component with a few shapes, so every route can flush a skeleton in its
// first paint instead of a blank column, and so the skeletons of the product
// look like one family rather than nineteen improvisations.
import { Skeleton } from "@/components/ui/primitives";

export type PageSkeletonShape =
  /** a toolbar over a grid of cards */
  | "cards"
  /** a toolbar over a list of rows */
  | "list"
  /** a wide canvas (chart, chain, map) under a title */
  | "canvas"
  /** two columns: a reading pane and a rail */
  | "reading"
  /** a form or a single wide panel */
  | "panel";

export function PageSkeleton({
  shape = "cards",
  rows = 6,
  title = true,
}: {
  shape?: PageSkeletonShape;
  rows?: number;
  title?: boolean;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>
      {title ? (
        <div className="mb-6">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
      ) : null}

      {shape === "cards" ? (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        </>
      ) : null}

      {shape === "list" ? (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28" />
            ))}
          </div>
          <div className="card divide-y divide-sand-100">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {shape === "canvas" ? (
        <>
          <Skeleton className="h-[420px] w-full rounded-[var(--radius-card)]" />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        </>
      ) : null}

      {shape === "reading" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3">
            {Array.from({ length: rows + 4 }).map((_, i) => (
              <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-3/5" : "h-4 w-full"} />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
          </div>
        </div>
      ) : null}

      {shape === "panel" ? (
        <div className="card space-y-4 p-6">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
