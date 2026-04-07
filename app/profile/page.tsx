import { redirect } from "next/navigation";

import { Navbar } from "@/components/Navbar";
import { ProfileForm } from "@/components/ProfileForm";
import { Badge } from "@/components/ui/badge";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profile: ProfileRecord | null = null;
  let loadError: string | null = null;

  const { profile: profileData, error, usedLegacySchema } = await getProfileByUserId(
    supabase,
    user.id,
  );

  if (error) {
    loadError =
      "Signal could not load your profile yet. Make sure the profiles table exists in Supabase, then refresh this page.";
  } else if (profileData) {
    profile = profileData as ProfileRecord;
  }

  if (!loadError && usedLegacySchema) {
    loadError =
      "Minor and double major will unlock after you run the latest profiles SQL in Supabase. The rest of your profile is ready to use now.";
  }

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user.email} />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl">
          <Badge>Student setup</Badge>
          <h1 className="signal-display mt-5 max-w-3xl text-[clamp(2.8rem,6vw,5rem)]">
            Set up your profile once, then let every brief adapt to you.
          </h1>
          <p className="signal-copy mt-5 max-w-2xl text-lg">
            Add your background, upload your resume text, and Signal will tighten
            your positioning instead of giving you the same advice as everyone
            else.
          </p>
        </section>

        <ProfileForm userId={user.id} initialProfile={profile} loadError={loadError} />
      </main>
    </div>
  );
}
