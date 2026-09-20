// CR08 5.4: the builder skeleton: the stepper, a grid of type cards and the
// structure preview aside.
import { Skeleton } from "@/components/ui/primitives";

export default function BuilderLoading() {
  return (
    <div aria-busy>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      <div className="mt-5 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-36 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-72 rounded-[0.875rem]" />
      </div>
    </div>
  );
}
