// CR08 5.4: the report page skeleton: the header, the cover and metadata
// strip, the contents rail and two section cards.
import { Skeleton } from "@/components/ui/primitives";

export default function ReportLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-8 w-2/3 max-w-xl" />
      <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <Skeleton className="aspect-[5/7] w-full rounded-xl" />
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1.5 h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-[5/7] w-[88px] rounded-md" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-[0.875rem]" />
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-[0.875rem]" />
          <Skeleton className="h-64 rounded-[0.875rem]" />
        </div>
      </div>
    </div>
  );
}
