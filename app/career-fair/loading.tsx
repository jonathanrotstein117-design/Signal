import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CareerFairLoading() {
  return (
    <div className="signal-shell min-h-screen">
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl">
          <Badge>Career Fair Mode</Badge>
          <Skeleton className="mt-5 h-16 w-full max-w-4xl" />
          <Skeleton className="mt-5 h-8 w-full max-w-3xl" />
        </section>

        <section className="surface-panel rounded-2xl p-6 md:p-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-5 h-12 w-full max-w-3xl" />
          <Skeleton className="mt-4 h-16 w-full max-w-3xl" />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-[28px]" />
            <Skeleton className="h-56 w-full rounded-[28px]" />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <Skeleton className="h-[480px] w-full rounded-2xl" />
          <Skeleton className="h-[480px] w-full rounded-2xl" />
        </section>
      </main>
    </div>
  );
}
