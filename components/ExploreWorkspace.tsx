"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  LoaderCircle,
  Lock,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { BriefTabs } from "@/components/BriefTabs";
import { LoadingBrief, loadingBriefSteps } from "@/components/LoadingBrief";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatInternshipLocation,
  internshipSearchResponseSchema,
  type InternshipJob,
  type InternshipSearchRequest,
  type InternshipSearchResponse,
} from "@/lib/internship-search-shared";
import type { SignalBrief } from "@/lib/types";
import { cn } from "@/lib/utils";

const CACHE_TTL_MS = 15 * 60 * 1_000;
const GUEST_SEARCH_USED_KEY = "signal:explore:guest-free-search-used";
const GUEST_BRIEF_USED_KEY = "signal:explore:guest-free-brief-used";
const GUEST_RESULTS_KEY = "signal:explore:guest-search-results";
const GUEST_FORM_KEY = "signal:explore:guest-search-form";

const yearOptions = ["Freshman", "Sophomore", "Junior", "Senior"] as const;
const careerInterestOptions = [
  "Finance",
  "Financial Analyst",
  "Investment Banking",
  "Accounting",
  "Consulting",
  "Software Engineering",
  "Data Analytics",
  "Product Management",
  "Marketing",
  "Sales",
  "Operations",
  "Research",
  "UX Design",
  "Other",
] as const;

type PublicExploreYear = (typeof yearOptions)[number];
type PublicCareerInterest = (typeof careerInterestOptions)[number];

interface ExploreWorkspaceProps {
  isAuthed: boolean;
  hasResume: boolean;
  heroContent: ReactNode;
}

interface ExploreSearchState {
  major: string;
  year: PublicExploreYear;
  careerInterest: PublicCareerInterest;
  customCareerInterest: string;
  location: string;
}

interface CachedSearchPayload {
  createdAt: number;
  results: InternshipJob[];
}

interface BriefOverlayState {
  companyName: string;
  brief: SignalBrief;
}

const defaultSearchState: ExploreSearchState = {
  major: "",
  year: "Freshman",
  careerInterest: "Finance",
  customCareerInterest: "",
  location: "",
};

const selectClassName =
  "flex h-12 w-full rounded-[14px] border border-input-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-ring";

function isCachedSearchPayload(value: unknown): value is CachedSearchPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    createdAt?: unknown;
    results?: unknown;
  };

  const parsedResults = internshipSearchResponseSchema.safeParse({
    results: candidate.results,
  });

  return typeof candidate.createdAt === "number" && parsedResults.success;
}

function isExploreSearchState(value: unknown): value is ExploreSearchState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.major === "string" &&
    typeof candidate.year === "string" &&
    yearOptions.includes(candidate.year as PublicExploreYear) &&
    typeof candidate.careerInterest === "string" &&
    careerInterestOptions.includes(candidate.careerInterest as PublicCareerInterest) &&
    typeof candidate.customCareerInterest === "string" &&
    typeof candidate.location === "string"
  );
}

function safeReadLocalStorage<T>(
  key: string,
  validate: (value: unknown) => value is T,
) {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!validate(parsedValue)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsedValue;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function getPublicCareerInterestValue(state: ExploreSearchState) {
  return state.careerInterest === "Other"
    ? state.customCareerInterest.trim()
    : state.careerInterest;
}

function buildSearchRequests(state: ExploreSearchState): InternshipSearchRequest[] {
  const major = state.major.trim();
  const careerInterest = getPublicCareerInterestValue(state);
  const location = state.location.trim();
  const candidateQueries = [
    [careerInterest, "internship"].filter(Boolean).join(" "),
    [major, careerInterest, "internship"].filter(Boolean).join(" "),
    [major, "internship"].filter(Boolean).join(" "),
  ]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return Array.from(new Set(candidateQueries)).map((query) => ({
    query,
    location,
  }));
}

function InternshipJobCardSkeleton() {
  return (
    <div className="surface-panel rounded-[24px] p-6">
      <div className="h-7 w-2/3 rounded-full bg-background-soft" />
      <div className="mt-3 h-4 w-1/3 rounded-full bg-background-soft" />
      <div className="mt-6 flex flex-wrap gap-2">
        <div className="h-8 w-40 rounded-full bg-background-soft" />
        <div className="h-8 w-28 rounded-full bg-background-soft" />
      </div>
      <div className="mt-6 flex gap-3">
        <div className="h-11 w-36 rounded-[10px] bg-background-soft" />
        <div className="h-11 w-28 rounded-[10px] bg-background-soft" />
      </div>
    </div>
  );
}

function SignupGateModal() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,32,0.28)] px-6">
      <div className="w-full max-w-2xl rounded-[28px] border border-border bg-white p-8 shadow-[0_28px_80px_rgba(19,29,39,0.22)]">
        <Badge>Unlock Signal</Badge>
        <h2 className="signal-title mt-5 text-3xl text-foreground sm:text-4xl">
          You&apos;ve seen what Signal can do.
        </h2>
        <p className="signal-copy mt-4 max-w-2xl text-base">
          Create a free account to unlock unlimited searches and intel briefs for
          every company.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Sign Up Free</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function BriefPreviewOverlay({
  companyName,
  brief,
  hasResume,
  onClose,
}: {
  companyName: string;
  brief: SignalBrief;
  hasResume: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[rgba(15,23,32,0.52)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] items-start justify-center">
        <div className="w-full rounded-[28px] border border-border bg-background shadow-[0_28px_80px_rgba(19,29,39,0.28)]">
          <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 backdrop-blur-xl sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>Free Intel Brief</Badge>
                  <Badge variant="secondary">
                    {brief.company_overview.industry}
                  </Badge>
                </div>
                <h2 className="signal-display mt-4 text-[clamp(2.2rem,4vw,4rem)]">
                  {companyName}
                </h2>
                <p className="signal-copy mt-4 max-w-2xl text-base">
                  {brief.company_overview.description}
                </p>
              </div>

              <Button variant="secondary" onClick={onClose} className="w-full lg:w-auto">
                <X className="h-4 w-4" />
                Back to results
              </Button>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8">
            <BriefTabs brief={brief} hasResume={hasResume} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InternshipJobCard({
  job,
  canOpenBrief,
  onOpenBrief,
  isBriefLoading,
  activeBriefCompany,
}: {
  job: InternshipJob;
  canOpenBrief: boolean;
  onOpenBrief: (companyName: string) => void;
  isBriefLoading: boolean;
  activeBriefCompany: string | null;
}) {
  const isLoadingThisCompany = isBriefLoading && activeBriefCompany === job.employer_name;

  return (
    <article className="surface-panel rounded-[24px] p-6 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="signal-title text-2xl text-foreground">{job.job_title}</h3>
          <p className="signal-copy text-base text-foreground/84">{job.employer_name}</p>
        </div>

        <Button asChild className="shrink-0">
          <a href={job.job_apply_link} target="_blank" rel="noreferrer noopener">
            Apply
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-secondary">
          <MapPin className="h-3.5 w-3.5" />
          {formatInternshipLocation(job)}
        </div>

        {job.job_employment_type ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background-soft px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-secondary">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {job.job_employment_type}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={() => onOpenBrief(job.employer_name)}
          disabled={!canOpenBrief || isBriefLoading}
          className="w-full sm:w-auto"
        >
          {isLoadingThisCompany ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isLoadingThisCompany ? "Loading brief..." : "View Intel Brief"}
        </Button>
      </div>
    </article>
  );
}

export function ExploreWorkspace({
  isAuthed,
  hasResume,
  heroContent,
}: ExploreWorkspaceProps) {
  const [searchState, setSearchState] = useState<ExploreSearchState>(defaultSearchState);
  const [results, setResults] = useState<InternshipJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isGuestStateReady, setIsGuestStateReady] = useState(isAuthed);
  const [guestSearchUsed, setGuestSearchUsed] = useState(false);
  const [guestBriefUsed, setGuestBriefUsed] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [briefOverlay, setBriefOverlay] = useState<BriefOverlayState | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [briefStep, setBriefStep] = useState(0);
  const [activeBriefCompany, setActiveBriefCompany] = useState<string | null>(null);

  const requestBodies = useMemo(() => buildSearchRequests(searchState), [searchState]);
  const cacheKey = useMemo(
    () => `signal:explore-search:v1:${JSON.stringify(requestBodies)}`,
    [requestBodies],
  );

  const isSearchReady = Boolean(
    searchState.major.trim() &&
      searchState.year &&
      getPublicCareerInterestValue(searchState) &&
      searchState.location.trim(),
  );
  const canUseSearch = isAuthed || !guestSearchUsed;
  const showSearchForm = isAuthed || !guestSearchUsed;
  const showGuestUnlockMessage = !isAuthed && guestSearchUsed && !showSignupModal;
  const isLocked = !isAuthed && showSignupModal;

  useEffect(() => {
    if (!isBriefLoading) {
      setBriefStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setBriefStep((value) =>
        value < loadingBriefSteps.length - 1 ? value + 1 : value,
      );
    }, 1600);

    return () => window.clearInterval(interval);
  }, [isBriefLoading]);

  useEffect(() => {
    if (isAuthed) {
      setGuestSearchUsed(false);
      setGuestBriefUsed(false);
      setShowSignupModal(false);
      setIsGuestStateReady(true);
      return;
    }

    const storedSearchUsed = window.localStorage.getItem(GUEST_SEARCH_USED_KEY) === "1";
    const storedBriefUsed = window.localStorage.getItem(GUEST_BRIEF_USED_KEY) === "1";
    const storedResults = safeReadLocalStorage(GUEST_RESULTS_KEY, isCachedSearchPayload);
    const storedForm = safeReadLocalStorage(GUEST_FORM_KEY, isExploreSearchState);

    if (storedForm) {
      setSearchState(storedForm);
    }

    if (storedResults) {
      setResults(storedResults.results);
      setHasSearched(true);
    } else if (storedSearchUsed) {
      setHasSearched(true);
    }

    setGuestSearchUsed(storedSearchUsed);
    setGuestBriefUsed(storedBriefUsed);
    setShowSignupModal(storedSearchUsed && storedBriefUsed);
    setIsGuestStateReady(true);
  }, [isAuthed]);

  const persistGuestSnapshot = (nextResults: InternshipJob[]) => {
    window.localStorage.setItem(GUEST_SEARCH_USED_KEY, "1");
    window.localStorage.setItem(
      GUEST_RESULTS_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        results: nextResults,
      } satisfies CachedSearchPayload),
    );
    window.localStorage.setItem(GUEST_FORM_KEY, JSON.stringify(searchState));
  };

  const searchInternships = async () => {
    if (!isSearchReady || !canUseSearch) {
      return;
    }

    setHasSearched(true);
    setIsSearching(true);
    setError(null);
    setBriefError(null);

    try {
      if (isAuthed) {
        const cached = safeReadLocalStorage(cacheKey, isCachedSearchPayload);

        if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
          setResults(cached.results);
          return;
        }
      }

      let nextResults: InternshipJob[] = [];

      for (const requestBody of requestBodies) {
        const response = await fetch("/api/jobs", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const payload = (await response.json()) as Partial<InternshipSearchResponse> & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Signal could not search internships right now.");
        }

        nextResults = payload.results ?? [];

        if (nextResults.length) {
          break;
        }
      }

      if (isAuthed) {
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({
            createdAt: Date.now(),
            results: nextResults,
          } satisfies CachedSearchPayload),
        );
      } else {
        persistGuestSnapshot(nextResults);
        setGuestSearchUsed(true);
      }

      setResults(nextResults);
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Signal could not search internships right now.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const openBrief = async (companyName: string) => {
    if (!isAuthed && guestBriefUsed) {
      setShowSignupModal(true);
      return;
    }

    setBriefError(null);
    setIsBriefLoading(true);
    setActiveBriefCompany(companyName);

    try {
      const response = await fetch("/api/explore/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyName }),
      });

      const payload = (await response.json()) as {
        brief?: SignalBrief;
        companyName?: string;
        error?: string;
      };

      if (!response.ok || !payload.brief) {
        throw new Error(payload.error ?? "Signal could not generate the brief.");
      }

      if (!isAuthed) {
        setGuestBriefUsed(true);
        window.localStorage.setItem(GUEST_BRIEF_USED_KEY, "1");
      }

      setBriefOverlay({
        companyName: payload.companyName ?? companyName,
        brief: payload.brief,
      });
    } catch (requestError) {
      setBriefError(
        requestError instanceof Error
          ? requestError.message
          : "Signal could not generate the brief.",
      );
    } finally {
      setIsBriefLoading(false);
      setActiveBriefCompany(null);
    }
  };

  const handleBriefClose = () => {
    setBriefOverlay(null);

    if (!isAuthed && guestSearchUsed && guestBriefUsed) {
      setShowSignupModal(true);
    }
  };

  if (!isGuestStateReady) {
    return (
      <div className="space-y-6">
        <section className="surface-panel rounded-[28px] p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 rounded-[14px] bg-background-soft" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "space-y-6 transition duration-200",
          isLocked && "pointer-events-none blur-sm select-none",
        )}
      >
        <section className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div className="max-w-4xl">{heroContent}</div>

          <div className="w-full lg:justify-self-end lg:self-start">
            {showSearchForm ? (
              <section className="surface-panel rounded-[28px] p-6 md:p-8">
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchInternships();
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      aria-label="Major"
                      value={searchState.major}
                      onChange={(event) =>
                        setSearchState((current) => ({
                          ...current,
                          major: event.target.value,
                        }))
                      }
                      placeholder="Major"
                      disabled={isSearching}
                    />

                    <select
                      aria-label="Year"
                      value={searchState.year}
                      onChange={(event) =>
                        setSearchState((current) => ({
                          ...current,
                          year: event.target.value as PublicExploreYear,
                        }))
                      }
                      className={selectClassName}
                      disabled={isSearching}
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year} className="bg-white text-foreground">
                          {year}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Career Interests"
                      value={searchState.careerInterest}
                      onChange={(event) =>
                        setSearchState((current) => ({
                          ...current,
                          careerInterest: event.target.value as PublicCareerInterest,
                        }))
                      }
                      className={selectClassName}
                      disabled={isSearching}
                    >
                      {careerInterestOptions.map((option) => (
                        <option key={option} value={option} className="bg-white text-foreground">
                          {option}
                        </option>
                      ))}
                    </select>

                    <Input
                      aria-label="Location"
                      value={searchState.location}
                      onChange={(event) =>
                        setSearchState((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                      placeholder="Location"
                      disabled={isSearching}
                    />

                    {searchState.careerInterest === "Other" ? (
                      <Input
                        aria-label="Custom Career Interests"
                        value={searchState.customCareerInterest}
                        onChange={(event) =>
                          setSearchState((current) => ({
                            ...current,
                            customCareerInterest: event.target.value,
                          }))
                        }
                        placeholder="Enter your career interest"
                        className="md:col-span-2"
                        disabled={isSearching}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="signal-copy max-w-2xl text-sm">
                      {isAuthed
                        ? "Search internships and open as many company intel briefs as you want."
                        : "You get one free internship search and one full company intel brief preview."}
                    </p>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={!isSearchReady || isSearching || !canUseSearch}
                    >
                      {isSearching ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      {isSearching ? "Searching..." : "Find internships"}
                    </Button>
                  </div>
                </form>
              </section>
            ) : null}

          </div>
        </section>

        {showGuestUnlockMessage ? (
          <section className="surface-panel rounded-[24px] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge>Free Access Unlocked</Badge>
                <p className="signal-title mt-4 text-2xl text-foreground">
                  Your one free search is ready below.
                </p>
                <p className="signal-copy mt-3 max-w-2xl text-sm">
                  Pick one company to open one full intel brief for free. After that,
                  we&apos;ll ask you to create an account to keep going.
                </p>
              </div>
              <Lock className="h-6 w-6 text-accent" />
            </div>
          </section>
        ) : null}

        {isSearching ? (
          <section className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <InternshipJobCardSkeleton key={index} />
            ))}
          </section>
        ) : null}

        {!isSearching && error ? (
          <section className="signal-callout-quiet rounded-2xl p-5 text-sm text-foreground">
            {error}
          </section>
        ) : null}

        {!isSearching && briefError ? (
          <section className="signal-callout-quiet rounded-2xl p-5 text-sm text-foreground">
            {briefError}
          </section>
        ) : null}

        {!isSearching && !error && results.length ? (
          <section className="space-y-4">
            {results.map((job) => (
              <InternshipJobCard
                key={`${job.job_id}-${job.employer_name}`}
                job={job}
                canOpenBrief={isAuthed || !guestBriefUsed}
                onOpenBrief={openBrief}
                isBriefLoading={isBriefLoading}
                activeBriefCompany={activeBriefCompany}
              />
            ))}
          </section>
        ) : null}

        {hasSearched && !isSearching && !error && !results.length ? (
          <section className="signal-empty-state rounded-2xl p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-accent" />
            <p className="signal-title mt-4 text-2xl text-foreground">
              No internships found for this search.
            </p>
            <p className="signal-copy mx-auto mt-3 max-w-2xl text-sm">
              Try a broader location or a wider career interest.
            </p>
          </section>
        ) : null}

      </div>

      {isBriefLoading ? (
        <div className="fixed inset-0 z-[65] overflow-y-auto bg-[rgba(15,23,32,0.52)] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center">
            <div className="w-full">
              <div className="mb-5 flex items-center justify-between rounded-[22px] border border-border bg-white/94 px-5 py-4 backdrop-blur-xl">
                <div>
                  <p className="signal-eyebrow">Generating Brief</p>
                  <p className="signal-copy mt-2 text-sm">
                    Building the full intel brief for {activeBriefCompany ?? "this company"}.
                  </p>
                </div>
                <LoaderCircle className="h-5 w-5 animate-spin text-accent" />
              </div>
              <LoadingBrief currentStep={briefStep} />
            </div>
          </div>
        </div>
      ) : null}

      {briefOverlay ? (
        <BriefPreviewOverlay
          companyName={briefOverlay.companyName}
          brief={briefOverlay.brief}
          hasResume={hasResume}
          onClose={handleBriefClose}
        />
      ) : null}

      {isLocked ? <SignupGateModal /> : null}
    </>
  );
}
