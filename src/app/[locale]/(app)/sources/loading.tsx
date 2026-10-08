// Source Library skeleton: title, search, chip row, then table rows.
import { Skeleton } from "@/components/ui/primitives";

export default function SourcesLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-5 h-10 w-full max-w-xl rounded-lg" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-lg" />
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
