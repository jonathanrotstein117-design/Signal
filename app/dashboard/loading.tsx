import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="signal-shell min-h-screen">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-14 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl space-y-6">
          <p className="signal-eyebrow">Dashboard</p>
          <Skeleton className="h-16 w-full max-w-3xl" />
          <Skeleton className="h-8 w-full max-w-2xl" />
          <Skeleton className="h-20 w-full rounded-[20px]" />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </section>

        <section className="space-y-6 pt-4">
          <div className="max-w-2xl">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-12 w-full max-w-xl" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-12 w-80" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="surface-panel rounded-2xl p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-7 w-2/3" />
                <Skeleton className="mt-4 h-6 w-28 rounded-full" />
                <Skeleton className="mt-5 h-16 w-full" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
