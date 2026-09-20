// CR08 2.2: the Studies skeleton: title, the featured hero, four chip rows,
// then a shelf.
import { Skeleton, ShelfSkeleton } from "@/components/ui/primitives";

export default function StudiesLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-5 h-56 w-full rounded-[0.875rem]" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Skeleton className="mb-3 h-4 w-32" />
        <ShelfSkeleton count={8} />
      </div>
    </div>
  );
}
