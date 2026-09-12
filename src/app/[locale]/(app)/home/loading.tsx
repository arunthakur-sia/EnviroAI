// CR02 1.3.6: Home loading skeletons that match the final shapes exactly:
// hero ask box, three equal Today cards, four lesson cards, one shelf, one
// progress panel.
import { Skeleton, ShelfSkeleton } from "@/components/ui/primitives";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-[1200px]" aria-busy>
      <div className="flex flex-col gap-12">
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="mx-auto w-full max-w-3xl">
            <Skeleton className="h-20 w-full rounded-[0.875rem]" />
            <div className="mt-3 flex justify-center gap-1.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="mx-auto mt-2.5 h-4 w-72" />
          </div>
        </section>
        <section>
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-56 rounded-[0.875rem]" />
            <Skeleton className="h-56 rounded-[0.875rem]" />
            <Skeleton className="h-56 rounded-[0.875rem]" />
          </div>
        </section>
        <section>
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-40 rounded-[0.875rem]" />
            <Skeleton className="h-40 rounded-[0.875rem]" />
            <Skeleton className="h-40 rounded-[0.875rem]" />
            <Skeleton className="h-40 rounded-[0.875rem]" />
          </div>
        </section>
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <Skeleton className="mb-4 h-4 w-24" />
            <ShelfSkeleton count={8} />
          </div>
          <div>
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="h-72 rounded-[0.875rem]" />
          </div>
        </section>
      </div>
    </div>
  );
}
