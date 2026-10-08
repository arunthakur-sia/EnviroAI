// CR08 3: the Expert Network skeleton: title, the two segments, the filter
// row, then a unit group header with a row of cards.
import { Skeleton } from "@/components/ui/primitives";

export default function ExpertsLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-mist-100 p-1.5 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Skeleton className="h-9.5 w-full max-w-md rounded-lg" />
        <Skeleton className="h-9.5 w-36 rounded-lg" />
        <Skeleton className="h-9.5 w-36 rounded-lg" />
        <Skeleton className="h-9.5 w-28 rounded-lg" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="mt-6">
          <Skeleton className="h-5 w-64" />
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-[0.875rem]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
