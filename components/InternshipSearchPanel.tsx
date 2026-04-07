"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  LoaderCircle,
  MapPin,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatInternshipLocation,
  type InternshipJob,
  type InternshipSearchRequest,
  type InternshipSearchResponse,
} from "@/lib/internship-search-shared";
import { cn } from "@/lib/utils";

const CACHE_TTL_MS = 15 * 60 * 1_000;

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
type SearchMode = "discover" | "public";

interface InternshipSearchPanelProps {
  mode: SearchMode;
  className?: string;
  showSignupBanner?: boolean;
}

interface DiscoverSearchState {
  query: string;
  location: string;
}

interface PublicExploreState {
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

  return typeof candidate.createdAt === "number" && Array.isArray(candidate.results);
}

function readCachedPayload(cacheKey: string) {
  const cachedRaw = window.localStorage.getItem(cacheKey);

  if (!cachedRaw) {
    return null;
  }

  try {
    const cached = JSON.parse(cachedRaw) as unknown;

    if (!isCachedSearchPayload(cached)) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return cached;
  } catch {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
}

function getPublicCareerInterestValue(state: PublicExploreState) {
  return state.careerInterest === "Other"
    ? state.customCareerInterest.trim()
    : state.careerInterest;
}

function buildPublicRequests(state: PublicExploreState): InternshipSearchRequest[] {
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

function InternshipJobCard({ job }: { job: InternshipJob }) {
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
    </article>
  );
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
      <div className="mt-6 h-11 w-28 rounded-[10px] bg-background-soft" />
    </div>
  );
}

export function InternshipSearchPanel({
  mode,
  className,
  showSignupBanner = false,
}: InternshipSearchPanelProps) {
  const [discoverState, setDiscoverState] = useState<DiscoverSearchState>({
    query: "",
    location: "",
  });
  const [publicState, setPublicState] = useState<PublicExploreState>({
    major: "",
    year: "Freshman",
    careerInterest: "Finance",
    customCareerInterest: "",
    location: "",
  });
  const [results, setResults] = useState<InternshipJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const requestBodies = useMemo<InternshipSearchRequest[]>(() => {
    if (mode === "discover") {
      return [
        {
          query: discoverState.query,
          location: discoverState.location,
        },
      ];
    }

    return buildPublicRequests(publicState);
  }, [discoverState.location, discoverState.query, mode, publicState]);

  const cacheKey = useMemo(
    () => `signal:internship-search:v2:${mode}:${JSON.stringify(requestBodies)}`,
    [mode, requestBodies],
  );

  const isSearchReady =
    mode === "discover"
      ? Boolean(discoverState.query.trim())
      : Boolean(
          publicState.major.trim() &&
            publicState.year &&
            getPublicCareerInterestValue(publicState) &&
            publicState.location.trim(),
        );

  const buttonLabel = mode === "discover" ? "Search internships" : "Find internships";

  const handleSearch = async () => {
    if (!isSearchReady) {
      return;
    }

    setHasSearched(true);
    setIsSearching(true);
    setError(null);

    try {
      const cached = readCachedPayload(cacheKey);

      if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
        setResults(cached.results);
        return;
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

      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          createdAt: Date.now(),
          results: nextResults,
        } satisfies CachedSearchPayload),
      );

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

  return (
    <div className={cn("space-y-6", className)}>
      <section className="surface-panel rounded-[28px] p-6 md:p-8">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
        >
          {mode === "discover" ? (
            <>
              <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr_auto]">
                <Input
                  aria-label="Role"
                  value={discoverState.query}
                  onChange={(event) =>
                    setDiscoverState((current) => ({
                      ...current,
                      query: event.target.value,
                    }))
                  }
                  placeholder="Role, e.g. Software Engineering Intern"
                />
                <Input
                  aria-label="Location"
                  value={discoverState.location}
                  onChange={(event) =>
                    setDiscoverState((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Location, e.g. New York or Remote"
                />
                <Button type="submit" disabled={!isSearchReady || isSearching} className="w-full md:w-auto">
                  {isSearching ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? "Searching..." : buttonLabel}
                </Button>
              </div>

              <p className="signal-copy text-sm">
                Live internship search from JSearch, filtered to postings from the last month.
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  aria-label="Major"
                  value={publicState.major}
                  onChange={(event) =>
                    setPublicState((current) => ({
                      ...current,
                      major: event.target.value,
                    }))
                  }
                  placeholder="Major"
                />

                <select
                  aria-label="Year"
                  value={publicState.year}
                  onChange={(event) =>
                    setPublicState((current) => ({
                      ...current,
                      year: event.target.value as PublicExploreYear,
                    }))
                  }
                  className={selectClassName}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year} className="bg-white text-foreground">
                      {year}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Career Interests"
                  value={publicState.careerInterest}
                  onChange={(event) =>
                    setPublicState((current) => ({
                      ...current,
                      careerInterest: event.target.value as PublicCareerInterest,
                    }))
                  }
                  className={selectClassName}
                >
                  {careerInterestOptions.map((option) => (
                    <option key={option} value={option} className="bg-white text-foreground">
                      {option}
                    </option>
                  ))}
                </select>

                <Input
                  aria-label="Location"
                  value={publicState.location}
                  onChange={(event) =>
                    setPublicState((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Location"
                />

                {publicState.careerInterest === "Other" ? (
                  <Input
                    aria-label="Custom Career Interests"
                    value={publicState.customCareerInterest}
                    onChange={(event) =>
                      setPublicState((current) => ({
                        ...current,
                        customCareerInterest: event.target.value,
                      }))
                    }
                    placeholder="Enter your career interest"
                    className="md:col-span-2"
                  />
                ) : null}
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="signal-copy max-w-2xl text-sm">
                  Signal searches your career interest first, then broadens with
                  your major if the first pass comes back empty.
                </p>

                <Button type="submit" size="lg" disabled={!isSearchReady || isSearching}>
                  {isSearching ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isSearching ? "Searching..." : buttonLabel}
                </Button>
              </div>
            </>
          )}
        </form>
      </section>

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

      {!isSearching && !error && results.length ? (
        <section className="space-y-4">
          {results.map((job) => (
            <InternshipJobCard key={job.job_id} job={job} />
          ))}
        </section>
      ) : null}

      {showSignupBanner && hasSearched && !isSearching && !error && results.length ? (
        <section className="rounded-[28px] border border-border bg-white/88 p-6 shadow-[0_18px_40px_rgba(28,43,58,0.08)]">
          <p className="signal-title text-2xl text-foreground">
            Get a personalized intel brief for any of these companies —{" "}
            <Link href="/signup" className="signal-link">
              Sign up free
            </Link>
          </p>
        </section>
      ) : null}

      {hasSearched && !isSearching && !error && !results.length ? (
        <section className="signal-empty-state rounded-2xl p-8 text-center">
          <Search className="mx-auto h-8 w-8 text-accent" />
          <p className="signal-title mt-4 text-2xl text-foreground">
            No internships found for this search.
          </p>
          <p className="signal-copy mx-auto mt-3 max-w-2xl text-sm">
            Try a broader role, another location, or a slightly wider set of career
            interests.
          </p>
        </section>
      ) : null}
    </div>
  );
}
