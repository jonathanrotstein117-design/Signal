import { redirect } from "next/navigation";

import { BriefCard } from "@/components/BriefCard";
import { Navbar } from "@/components/Navbar";
import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeBriefRecord,
  type BriefRecord,
  type ProfileRecord,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IntelPage() {
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

  const { data: briefRows } = await supabase
    .from("briefs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const briefs = ((briefRows as BriefRecord[] | null) ?? []).map((brief) =>
    normalizeBriefRecord(brief),
  );

  const personalizationSignals = [
    profile?.resume_text?.trim() ? "Resume on file" : null,
    profile?.major?.trim() ? profile.major.trim() : null,
    profile?.career_interests?.trim() ? profile.career_interests.trim() : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user.email} />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl space-y-5">
          <Badge>Company Intel Briefs</Badge>
          <h1 className="signal-display max-w-5xl text-[clamp(2.8rem,6vw,5rem)]">
            Search any company and get the personalized intel before you walk in.
          </h1>
          <p className="signal-copy max-w-3xl text-lg">
            Signal uses live web research plus your resume, major, and career
            interests to generate a tailored brief for each company.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="space-y-5">
            <div className="max-w-2xl">
              <p className="signal-eyebrow">Generate a brief</p>
              <h2 className="signal-title mt-3 text-3xl text-foreground">
                Enter a company name and let Signal do the research.
              </h2>
            </div>
            <SearchBar />
          </div>

          <aside className="surface-panel rounded-[24px] p-6">
            <p className="signal-eyebrow">Personalization signals</p>
            <h2 className="signal-title mt-3 text-2xl">What Signal will tailor around you</h2>
            <p className="signal-copy mt-4 text-sm">
              The brief is customized using the profile information already saved
              in your account, so the positioning strategy and talking points fit
              your background.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {personalizationSignals.length ? (
                personalizationSignals.map((signal) => (
                  <Badge key={signal} variant="secondary" className="normal-case tracking-[0.04em]">
                    {signal}
                  </Badge>
                ))
              ) : (
                <Badge variant="warning" className="normal-case tracking-[0.04em]">
                  Add your profile details to personalize each brief even more.
                </Badge>
              )}
            </div>

            <div className="signal-callout mt-5 rounded-2xl px-4 py-4">
              <p className="text-sm font-medium text-foreground">
                Best results come from an uploaded resume and clear career interests.
              </p>
            </div>
          </aside>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="signal-eyebrow">Recent briefs</p>
              <h2 className="signal-title mt-3 text-3xl text-foreground">
                Pick up where you left off
              </h2>
            </div>
            {briefs.length ? (
              <p className="text-sm text-secondary">
                Your latest six saved intel briefs.
              </p>
            ) : null}
          </div>

          {briefs.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {briefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          ) : (
            <div className="signal-empty-state rounded-[24px] px-6 py-10">
              <p className="signal-title text-2xl">No intel briefs yet.</p>
              <p className="signal-copy mt-3 max-w-2xl text-sm sm:text-base">
                Search for a company above and Signal will generate your first
                personalized brief, then save it here so you can revisit it any time.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
