"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SignalBrief } from "@/lib/types";

interface BriefTabsProps {
  brief: SignalBrief;
  hasResume: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h3 className="signal-title text-2xl text-foreground">{title}</h3>
        <Separator />
      </div>
      {children}
    </section>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="signal-card-soft rounded-2xl p-5">
      <p className="signal-eyebrow">{label}</p>
      <div className="signal-copy mt-3 text-sm">{value}</div>
    </div>
  );
}

function BulletList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  if (!items.length) {
    return <p className="signal-copy text-sm">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="signal-copy flex gap-3 text-sm">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({
  items,
  copyEach = false,
  emptyMessage,
}: {
  items: string[];
  copyEach?: boolean;
  emptyMessage: string;
}) {
  if (!items.length) {
    return <p className="signal-copy text-sm">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li
          key={`${index + 1}-${item}`}
          className="signal-card-soft rounded-2xl p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/18 bg-accent/8 text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <p className="signal-copy text-sm">{item}</p>
            </div>
            {copyEach ? <CopyButton value={item} label="Copy" className="shrink-0" /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CopyCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="signal-callout rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="signal-eyebrow">{title}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{value}</p>
        </div>
        <CopyButton value={value} label="Copy" className="shrink-0" />
      </div>
    </div>
  );
}

export function BriefTabs({ brief, hasResume }: BriefTabsProps) {
  return (
    <Tabs defaultValue="intel">
      <TabsList>
        <TabsTrigger value="intel">Intel Brief</TabsTrigger>
        <TabsTrigger value="positioning">Your Positioning</TabsTrigger>
        <TabsTrigger value="hired">Get Hired</TabsTrigger>
      </TabsList>

      <TabsContent value="intel">
        <Card>
          <CardContent className="space-y-10 p-6 md:p-8">
            <Section title="Company Overview">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard
                  label="What They Actually Do"
                  value={
                    <div className="space-y-4">
                      <p>{brief.company_overview.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{brief.company_overview.industry}</Badge>
                        <Badge variant="secondary">
                          {brief.company_overview.public_or_private}
                        </Badge>
                        {brief.company_overview.stock_ticker ? (
                          <Badge>{brief.company_overview.stock_ticker}</Badge>
                        ) : null}
                      </div>
                    </div>
                  }
                />
                <InfoCard
                  label="Headquarters"
                  value={<p>{brief.company_overview.headquarters}</p>}
                />
                <InfoCard
                  label="Employee Count"
                  value={<p>{brief.company_overview.employee_count}</p>}
                />
                <InfoCard label="Founded" value={<p>{brief.company_overview.founded}</p>} />
              </div>
            </Section>

            <Section title="Recent News">
              <div className="space-y-4">
                {brief.recent_news.length ? (
                  brief.recent_news.map((item) => (
                    <div
                      key={`${item.headline}-${item.date}`}
                      className="signal-card-soft rounded-2xl p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary">{item.date}</Badge>
                        <h4 className="text-base font-semibold text-foreground">{item.headline}</h4>
                      </div>
                      <p className="signal-copy mt-3 text-sm">{item.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="signal-copy text-sm">
                    No major recent news items were returned.
                  </p>
                )}
              </div>
            </Section>

            <Section title="Culture & Values">
              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <InfoCard
                  label="The Real Deal"
                  value={<p>{brief.culture_and_values.the_real_deal}</p>}
                />
                <div className="grid gap-5">
                  <InfoCard
                    label="Glassdoor Rating"
                    value={<p>{brief.culture_and_values.glassdoor_rating}</p>}
                  />
                  <InfoCard
                    label="Interview Difficulty"
                    value={<p>{brief.culture_and_values.interview_difficulty}</p>}
                  />
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="signal-card-soft rounded-2xl p-5">
                  <p className="signal-eyebrow mb-4">
                    Pros
                  </p>
                  <BulletList
                    items={brief.culture_and_values.pros}
                    emptyMessage="No verified positive signals were returned."
                  />
                </div>
                <div className="signal-card-soft rounded-2xl p-5">
                  <p className="signal-eyebrow mb-4">
                    Cons
                  </p>
                  <BulletList
                    items={brief.culture_and_values.cons}
                    emptyMessage="No verified downside themes were returned."
                  />
                </div>
              </div>
            </Section>

            <Section title="Financial Health">
              <div className="grid gap-5 md:grid-cols-2">
                <InfoCard
                  label="Summary"
                  value={<p>{brief.financial_health.summary}</p>}
                />
                <InfoCard
                  label="Recent Developments"
                  value={<p>{brief.financial_health.recent_developments}</p>}
                />
              </div>
            </Section>

            {brief.red_flags.length ? (
              <Section title="Red Flags">
                <div className="signal-callout-quiet rounded-2xl p-5">
                  <BulletList
                    items={brief.red_flags}
                    emptyMessage="No red flags were returned."
                  />
                </div>
              </Section>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="positioning">
        <Card>
          <CardContent className="space-y-10 p-6 md:p-8">
            {!hasResume ? (
              <div className="signal-callout flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-sm leading-7 text-foreground">
                  Upload your resume to unlock personalized positioning.
                </p>
                <Button asChild variant="secondary">
                  <Link href="/profile">Upload your resume to unlock personalized positioning →</Link>
                </Button>
              </div>
            ) : null}

            <Section title="Your Strategy">
              <div className="grid gap-5 md:grid-cols-3">
                <InfoCard
                  label="Lead With"
                  value={<p>{brief.positioning_strategy.lead_with}</p>}
                />
                <InfoCard
                  label="How To Frame It"
                  value={<p>{brief.positioning_strategy.how_to_frame}</p>}
                />
                <InfoCard
                  label="Gap To Address"
                  value={<p>{brief.positioning_strategy.gap_to_address}</p>}
                />
              </div>
            </Section>

            <Section title="Your One-Liner">
              <CopyCard
                title="Career Fair Intro"
                value={brief.positioning_strategy.one_line_pitch}
              />
            </Section>

            <Section title="Talking Points">
              <NumberedList
                items={brief.talking_points}
                copyEach
                emptyMessage="No talking points were generated."
              />
            </Section>

            <Section title="Smart Questions">
              <NumberedList
                items={brief.smart_questions}
                emptyMessage="No smart questions were generated."
              />
            </Section>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hired">
        <Card>
          <CardContent className="space-y-10 p-6 md:p-8">
            <Section title="How To Get In">
              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="signal-card-soft rounded-2xl p-5">
                  <p className="signal-eyebrow mb-4">
                    Primary Channels
                  </p>
                  <BulletList
                    items={brief.paths_in.primary_channels}
                    emptyMessage="Could not verify specific channels."
                  />
                </div>
                <div className="grid gap-5">
                  <InfoCard
                    label="Active Postings"
                    value={<p>{brief.paths_in.active_postings_summary}</p>}
                  />
                  <InfoCard
                    label="Hiring Timeline"
                    value={<p>{brief.paths_in.hiring_timeline}</p>}
                  />
                  <InfoCard label="Pro Tip" value={<p>{brief.paths_in.pro_tip}</p>} />
                </div>
              </div>
            </Section>

            <Section title="Networking Playbook">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-5">
                  <InfoCard
                    label="Who To Reach Out To"
                    value={<p>{brief.networking_playbook.who_to_reach_out_to}</p>}
                  />
                  <InfoCard
                    label="Where To Find Them"
                    value={<p>{brief.networking_playbook.where_to_find_them}</p>}
                  />
                </div>
                <CopyCard
                  title="Outreach Template"
                  value={brief.networking_playbook.outreach_template}
                />
              </div>
            </Section>

            <Section title="Application Optimizer">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-5">
                  <div className="signal-card-soft rounded-2xl p-5">
                    <p className="signal-eyebrow mb-4">
                      Resume Tips
                    </p>
                    <BulletList
                      items={brief.application_optimizer.resume_tips}
                      emptyMessage="No resume rewrite suggestions were generated."
                    />
                  </div>
                  <div className="signal-card-soft rounded-2xl p-5">
                    <p className="signal-eyebrow mb-4">
                      Cover Letter Angles
                    </p>
                    <BulletList
                      items={brief.application_optimizer.cover_letter_angles}
                      emptyMessage="No cover letter angles were generated."
                    />
                  </div>
                </div>
                <div className="signal-card-soft rounded-2xl p-5">
                  <p className="signal-eyebrow mb-4">
                    Keywords To Include
                  </p>
                  {brief.application_optimizer.keywords_to_include.length ? (
                    <div className="flex flex-wrap gap-2">
                      {brief.application_optimizer.keywords_to_include.map((keyword) => (
                        <Badge key={keyword} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="signal-copy text-sm">
                      No keyword guidance was generated.
                    </p>
                  )}
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
