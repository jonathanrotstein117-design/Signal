import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <div className="signal-shell min-h-screen">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl">
          <p className="signal-eyebrow">Opportunity Discovery</p>
          <Skeleton className="mt-4 h-16 w-full max-w-4xl" />
          <Skeleton className="mt-5 h-8 w-full max-w-3xl" />
        </section>

        <section className="surface-panel rounded-2xl p-6 md:p-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-5 h-12 w-full max-w-3xl" />
          <Skeleton className="mt-4 h-16 w-full max-w-3xl" />
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
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
