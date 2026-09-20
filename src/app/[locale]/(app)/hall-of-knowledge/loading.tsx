// CR08 8: the Hall skeleton in the shape of the page: title, the featured
// card, then a month label and three gallery cards.
import { Skeleton } from "@/components/ui/primitives";

export default function HallLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-64 w-full rounded-[0.875rem]" />
      <Skeleton className="mt-8 h-3 w-32" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-[0.875rem]" />
        ))}
      </div>
    </div>
  );
}
