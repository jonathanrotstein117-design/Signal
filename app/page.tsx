import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, FileText, Sparkles, Target } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const featureCards = [
  {
    title: "Company Intel Briefs",
    description:
      "Real-time data from news, job postings, and reviews. Personalized to your resume.",
    icon: FileText,
  },
  {
    title: "Career Fair Mode",
    description:
      "Enter multiple companies, get a ranked game plan and swipeable pocket briefs for every booth.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Discover Roles",
    description:
      "Find internships and roles that actually match your background. No guessing.",
    icon: Target,
  },
];

const discoveryPoints = [
  {
    title: "Resume-matched roles",
    description:
      "Signal scans your resume and returns roles where your experience is a genuine fit.",
  },
  {
    title: "Live postings only",
    description: "No stale listings. Signal searches for active openings in real time.",
  },
  {
    title: "One click to prep",
    description:
      "Find a role you like? Generate a full company intel brief instantly.",
  },
];

const steps = [
  "Upload your resume",
  "Find matched internships",
  "Generate your intel brief",
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="signal-shell min-h-screen">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="section-grid absolute inset-0 opacity-60" />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(74,107,124,0.18),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(28,43,58,0.12),transparent_28%)]" />

          <div className="relative mx-auto grid max-w-[1280px] gap-14 px-6 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center lg:px-10 lg:py-24">
            <div className="max-w-3xl">
              <Badge>Internship discovery + interview prep</Badge>
              <h1 className="signal-display mt-6 text-[clamp(3.5rem,8vw,6.4rem)]">
                Stop Scrolling LinkedIn.
                <br />
                Find Roles That Actually Fit.
              </h1>
              <p className="signal-copy mt-6 max-w-2xl text-base sm:text-lg">
                Signal matches internships to your resume, then preps you for
                every company in under 60 seconds.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-w-[182px]">
                  <Link href="/explore">
                    Try Signal Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="min-w-[150px]">
                  <Link href="/login">Log In</Link>
                </Button>
              </div>
            </div>

            <div className="surface-panel rounded-[30px] p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="signal-eyebrow">Personalized brief</p>
                  <h2 className="signal-title mt-2 text-2xl sm:text-3xl">
                    Walk in with the context that matters.
                  </h2>
                </div>
                <span className="hidden rounded-full border border-border bg-white/80 px-3 py-2 text-xs font-medium text-secondary sm:inline-flex">
                  Under 60 seconds
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="signal-card-soft rounded-2xl p-4">
                  <div className="signal-icon-frame mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Resume-fit talking points</p>
                  <p className="signal-copy mt-2 text-sm">
                    Surface the projects, coursework, and experiences that actually connect
                    to the company you are meeting.
                  </p>
                </div>

                <div className="signal-card-soft rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Live inputs</p>
                    <span className="rounded-full bg-accent/8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
                      Fresh
                    </span>
                  </div>
                  <ul className="space-y-3 text-sm text-secondary">
                    <li className="flex items-center justify-between border-b border-border pb-3">
                      <span>News and announcements</span>
                      <span className="text-foreground">Included</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-border pb-3">
                      <span>Open roles and skills</span>
                      <span className="text-foreground">Matched</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Reviews and culture notes</span>
                      <span className="text-foreground">Ranked</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="signal-callout mt-4 rounded-2xl px-4 py-4 sm:px-5">
                <p className="text-sm font-medium text-foreground">
                  Signal turns scattered research into one clear interview game plan.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-10 lg:py-20">
            <div className="max-w-3xl">
              <p className="signal-eyebrow">Internship discovery</p>
              <h2 className="signal-title mt-4 text-[clamp(2.4rem,5vw,4rem)]">
                Stop Scrolling. Start Matching.
              </h2>
              <p className="signal-copy mt-5 max-w-2xl text-sm sm:text-base">
                Signal reads your resume and finds internships that actually
                match your background - not just your major.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {discoveryPoints.map((point) => (
                <article
                  key={point.title}
                  className="rounded-[26px] border border-border bg-white/62 p-6 backdrop-blur-sm sm:p-7"
                >
                  <div className="signal-eyebrow">Match point</div>
                  <h3 className="signal-title mt-6 text-2xl">{point.title}</h3>
                  <p className="signal-copy mt-4 text-sm sm:text-base">
                    {point.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex justify-start">
              <Button asChild size="lg" className="min-w-[200px]">
                <Link href="/explore">
                  Find Your Internship
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-10 lg:py-20">
            <div className="max-w-2xl">
              <p className="signal-eyebrow">Features</p>
              <h2 className="signal-title mt-4 text-[clamp(2.4rem,5vw,4rem)]">
                Everything you need to walk in prepared
              </h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="surface-panel rounded-[26px] p-6 sm:p-7"
                  >
                    <div className="signal-icon-frame flex h-12 w-12 items-center justify-center rounded-2xl">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="signal-title mt-8 text-2xl">{feature.title}</h3>
                    <p className="signal-copy mt-4 text-sm sm:text-base">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,107,124,0.12),transparent_28%)]" />

          <div className="relative mx-auto max-w-[1280px] px-6 py-16 lg:px-10 lg:py-20">
            <div className="max-w-2xl">
              <p className="signal-eyebrow">How it works</p>
              <h2 className="signal-title mt-4 text-[clamp(2.4rem,5vw,4rem)]">
                Three steps to your next opportunity
              </h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-[26px] border border-border bg-white/62 p-6 backdrop-blur-sm sm:p-7"
                >
                  <div className="signal-eyebrow">Step {index + 1}</div>
                  <p className="signal-title mt-8 text-2xl">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[960px] rounded-[32px] border border-border bg-white/78 px-6 py-12 text-center shadow-[0_20px_48px_rgba(28,43,58,0.06)] backdrop-blur-sm sm:px-10">
            <p className="signal-eyebrow justify-center">Get started</p>
            <h2 className="signal-title mt-4 text-[clamp(2.6rem,6vw,4.8rem)]">
              Your next interview starts here.
            </h2>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" className="min-w-[188px]">
                <Link href="/explore">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
