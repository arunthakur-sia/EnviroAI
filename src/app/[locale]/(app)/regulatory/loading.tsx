// Regulatory Overview skeleton: header, directory cards, timeline, table.
import { Skeleton } from "@/components/ui/primitives";

export default function RegulatoryLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-96" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-48 w-full rounded-xl" />
      <Skeleton className="mt-6 h-64 w-full rounded-xl" />
    </div>
  );
}
