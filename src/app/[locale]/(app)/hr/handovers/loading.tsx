import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
