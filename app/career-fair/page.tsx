import { redirect } from "next/navigation";

import { CareerFairWorkspace } from "@/components/CareerFairWorkspace";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import {
  getCareerFairForUser,
  getLatestCareerFairForUser,
  getProfileForUser,
} from "@/lib/career-fair-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CareerFairPage({
  searchParams,
}: {
  searchParams: Promise<{ fair?: string }>;
}) {
  const { fair } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let initialFair = null;
  let loadError: string | null = null;

  try {
    initialFair = fair
      ? await getCareerFairForUser(supabase, user.id, fair)
      : await getLatestCareerFairForUser(supabase, user.id);
  } catch {
    loadError =
      "Signal could not load career fair mode yet. If you have not created the table, run the SQL in supabase/schema.sql and refresh.";
  }

  const profile = await getProfileForUser(supabase, user.id);
  const hasResume = Boolean(profile?.resume_text?.trim());

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user.email} />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl">
          <Badge>Career Fair Mode</Badge>
          <h1 className="signal-display mt-5 max-w-4xl text-[clamp(2.8rem,6vw,5rem)]">
            Enter the companies attending your next career fair and Signal will
            turn them into a ranked game plan.
          </h1>
          <p className="signal-copy mt-5 max-w-3xl text-lg">
            Signal will research all of them, rank your best matches, and build
            pocket briefs you can pull up at each booth.
          </p>
        </section>

        <CareerFairWorkspace
          initialFair={initialFair}
          hasResume={hasResume}
          userId={user.id}
          universityName={profile?.university ?? null}
          initialLoadError={loadError}
        />
      </main>
    </div>
  );
}
