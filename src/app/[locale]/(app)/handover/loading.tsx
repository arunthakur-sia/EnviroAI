// CR08 6.2: the streaming skeleton for /handover, /handover/mine and
// /handover/[id]: the hero with its side panel, then the checklist rows.
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48 rounded-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl md:w-80" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
