import { notFound, redirect } from "next/navigation";

import { BriefTabs } from "@/components/BriefTabs";
import { Navbar } from "@/components/Navbar";
import { RegenerateButton } from "@/components/RegenerateButton";
import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeBriefRecord,
  resolveBriefCompanyName,
  type BriefRecord,
  type ProfileRecord,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const brief = normalizeBriefRecord(data as BriefRecord);
  const briefTitle = resolveBriefCompanyName(brief.brief_data, brief.company_name);
  let hasResume = false;

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, resume_text")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileError) {
    hasResume = Boolean((profileData as Pick<ProfileRecord, "resume_text"> | null)?.resume_text);
  }

  return (
    <div className="signal-shell min-h-screen">
      <Navbar userEmail={user.email} />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-6 pb-20 pt-12 lg:px-10 lg:pt-16">
        <section className="max-w-4xl space-y-4">
          <div className="max-w-2xl">
            <p className="signal-eyebrow">
              Search Again
            </p>
            <h2 className="signal-title mt-3 text-3xl text-foreground">
              Generate another brief without leaving this page
            </h2>
          </div>
          <SearchBar compact />
        </section>

        <section className="flex flex-col gap-6 rounded-[24px] border border-border bg-white/78 p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{brief.brief_data.company_overview.industry}</Badge>
              <Badge variant="secondary">
                Generated {formatDate(brief.created_at)}
              </Badge>
            </div>
            <h1 className="signal-display mt-5 text-[clamp(2.8rem,6vw,4.8rem)]">
              {briefTitle}
            </h1>
            <p className="signal-copy mt-5 max-w-2xl text-lg">
              {brief.brief_data.company_overview.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RegenerateButton companyName={briefTitle} briefId={brief.id} />
          </div>
        </section>

        <BriefTabs brief={brief.brief_data} hasResume={hasResume} />
      </main>
    </div>
  );
}
