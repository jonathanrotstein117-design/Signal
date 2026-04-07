import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntelLoading() {
  return (
    <div className="signal-shell min-h-screen">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="mt-5 h-16 w-full max-w-5xl" />
          <Skeleton className="mt-5 h-8 w-full max-w-3xl" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="surface-panel rounded-[24px] p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-10 w-full max-w-lg" />
            <Skeleton className="mt-5 h-16 w-full" />
            <Skeleton className="mt-4 h-32 w-full rounded-[22px]" />
          </div>

          <div className="surface-panel rounded-[24px] p-6">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-4 h-8 w-full" />
            <Skeleton className="mt-4 h-20 w-full" />
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface-panel rounded-2xl p-5">
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
              <Skeleton className="mt-5 h-7 w-2/3" />
              <Skeleton className="mt-5 h-20 w-full" />
              <Skeleton className="mt-4 h-16 w-full" />
              <Skeleton className="mt-5 h-11 w-40 rounded-full" />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
