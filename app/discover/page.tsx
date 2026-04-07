import { redirect } from "next/navigation";

import { DiscoverWorkspace } from "@/components/DiscoverWorkspace";
import { Navbar } from "@/components/Navbar";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profile: ProfileRecord | null = null;

  const { profile: profileData } = await getProfileByUserId(supabase, user.id);

  if (profileData) {
    profile = profileData as ProfileRecord;
  }

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user.email} />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl space-y-4">
          <p className="signal-eyebrow">Opportunity Discovery</p>
          <h1 className="signal-display max-w-4xl text-[clamp(2.8rem,6vw,5rem)]">
            See where your background is already a <em>fit</em>.
          </h1>
          <p className="signal-copy max-w-3xl text-lg">
            Browse roles matched to your resume or search live postings with a
            cleaner, more focused discovery workspace.
          </p>
        </section>

        <DiscoverWorkspace profile={profile} />
      </main>
    </div>
  );
}
