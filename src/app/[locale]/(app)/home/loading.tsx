// CR03 4: Home loading skeletons matching the bento: greeting + ask hero,
// the quote band, the Row C bento (tall number card, quiz, podcast, timeline),
// four lesson cards, the mini library beside the progress panel.
import { Skeleton, ShelfSkeleton } from "@/components/ui/primitives";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-[1240px]" aria-busy>
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-12 items-center gap-6">
          <div className="col-span-12 lg:col-span-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="mt-2 h-4 w-44" />
          </div>
          <div className="col-span-12 lg:col-span-8">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="mt-2.5 flex gap-1.5">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-6 w-44" />
            </div>
          </div>
        </section>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <section className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 h-[480px] rounded-[0.875rem] lg:col-span-5" />
          <Skeleton className="col-span-12 h-56 rounded-[0.875rem] sm:col-span-6 lg:col-span-3" />
          <Skeleton className="col-span-12 h-56 rounded-[0.875rem] sm:col-span-6 lg:col-span-4" />
          <Skeleton className="col-span-12 h-52 rounded-[0.875rem] lg:col-span-7 lg:col-start-6" />
        </section>
        <section>
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-44 rounded-[0.875rem]" />
            <Skeleton className="h-44 rounded-[0.875rem]" />
            <Skeleton className="h-44 rounded-[0.875rem]" />
            <Skeleton className="h-44 rounded-[0.875rem]" />
          </div>
        </section>
        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <Skeleton className="mb-4 h-4 w-40" />
            <ShelfSkeleton count={8} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="h-72 rounded-[0.875rem]" />
          </div>
        </section>
      </div>
    </div>
  );
}
