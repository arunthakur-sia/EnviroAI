// CR08 5: the Reports page skeleton: the hero, the filter row, a row of
// 3:4 covers, then two request rows.
import { Skeleton } from "@/components/ui/primitives";

export default function ReportsLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Skeleton className="h-9.5 w-56 rounded-xl" />
        <Skeleton className="h-9.5 w-40 rounded-lg" />
        <Skeleton className="h-9.5 w-32 rounded-lg" />
        <Skeleton className="h-9.5 w-64 rounded-lg" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
            <div className="p-3.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-10 h-6 w-40" />
      <Skeleton className="mt-3 h-14 w-full rounded-[0.875rem]" />
      <Skeleton className="mt-2 h-14 w-full rounded-[0.875rem]" />
    </div>
  );
}
