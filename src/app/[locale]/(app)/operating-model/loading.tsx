// CR08 10.2: the streaming skeleton in the shape of the finished page: the
// hero band with its section nav, then the seven sections.
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy aria-label="Loading" data-testid="om-skeleton">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-9 w-72" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="mt-6 h-11 w-full" />
      <Skeleton className="mt-10 h-52 w-full rounded-2xl" />
      <Skeleton className="mt-12 h-96 w-full rounded-2xl" />
      <div className="mt-12 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-60 shrink-0" />
        ))}
      </div>
      <Skeleton className="mt-12 h-[420px] w-full rounded-xl" />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Skeleton className="mx-auto aspect-square w-full max-w-[520px] rounded-full" />
        <Skeleton className="h-96 w-full" />
      </div>
      <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    </div>
  );
}
