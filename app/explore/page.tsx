import { ExploreWorkspace } from "@/components/ExploreWorkspace";
import { Navbar } from "@/components/Navbar";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasResume = false;

  if (user) {
    const { profile } = await getProfileByUserId(supabase, user.id);
    hasResume = Boolean(profile?.resume_text?.trim());
  }

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user?.email ?? null} />

      <main className="pb-24">
        <section className="relative overflow-hidden">
          <div className="section-grid absolute inset-0 opacity-60" />
          <div className="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_top_left,rgba(91,145,123,0.18),transparent_52%),radial-gradient(circle_at_top_right,rgba(205,166,98,0.18),transparent_44%)]" />

          <div className="relative mx-auto max-w-[1280px] px-6 pb-20 pt-10 lg:px-10 lg:pb-20 lg:pt-12">
            <ExploreWorkspace
              isAuthed={Boolean(user)}
              hasResume={hasResume}
              heroContent={
                <div className="max-w-4xl">
                  <h1 className="signal-display text-[clamp(3rem,7vw,6.1rem)]">
                    Find internships that fit where you&apos;re headed.
                  </h1>
                  <p className="signal-copy mt-16 max-w-3xl text-lg lg:mt-24">
                    Tell Signal what you study, what year you are, what you want
                    to do, and where you want to work. We&apos;ll search live
                    internship postings from the last month and open company intel
                    where it matters.
                  </p>
                </div>
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}
