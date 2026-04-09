"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react";

import { InternshipSearchPanel } from "@/components/InternshipSearchPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DiscoveredRole,
  ProfileRecord,
  SuggestedRoleCategoryHydration,
  SuggestedRoleCategorySeed,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const DISCOVER_CACHE_VERSION = "active-posting-preferred-boards-v6";

interface DiscoverWorkspaceProps {
  profile: ProfileRecord | null;
}

type SuggestedCategoryStatus = SuggestedRoleCategoryHydration["status"] | "loading";

interface SuggestedCategoryView {
  title: string;
  reason: string;
  roles: DiscoveredRole[];
  status: SuggestedCategoryStatus;
  message: string | null;
}

interface CachedSuggestedPayload {
  createdAt: number;
  categories: SuggestedCategoryView[];
}

function isPersistableSuggestedCategory(category: SuggestedCategoryView) {
  return category.status === "ready" || category.status === "empty";
}

function buildSuggestedCategoryMap(categories: SuggestedCategoryView[]) {
  return new Map(categories.map((category) => [category.title, category]));
}

function mergeSuggestedCategoriesForCache(
  resolvedCategories: SuggestedCategoryView[],
  previousCategories: SuggestedCategoryView[],
) {
  const previousByTitle = buildSuggestedCategoryMap(previousCategories);

  return resolvedCategories.flatMap((category) => {
    if (isPersistableSuggestedCategory(category)) {
      return [category];
    }

    const previous = previousByTitle.get(category.title);

    if (previous && isPersistableSuggestedCategory(previous)) {
      return [previous];
    }

    return [];
  });
}

function collectPersistableSuggestedCategories(...groups: SuggestedCategoryView[][]) {
  const collected = new Map<string, SuggestedCategoryView>();

  groups.flat().forEach((category) => {
    if (!isPersistableSuggestedCategory(category)) {
      return;
    }

    collected.set(category.title, category);
  });

  return Array.from(collected.values());
}

function isCachedSuggestedPayload(value: unknown): value is CachedSuggestedPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    createdAt?: unknown;
    categories?: unknown;
  };

  return (
    typeof candidate.createdAt === "number" &&
    Array.isArray(candidate.categories) &&
    candidate.categories.every((category) => {
      if (!category || typeof category !== "object") {
        return false;
      }

      const typedCategory = category as {
        title?: unknown;
        reason?: unknown;
        roles?: unknown;
        status?: unknown;
        message?: unknown;
      };

      return (
        typeof typedCategory.title === "string" &&
        typeof typedCategory.reason === "string" &&
        Array.isArray(typedCategory.roles) &&
        (typedCategory.status === "ready" ||
          typedCategory.status === "empty" ||
          typedCategory.status === "error") &&
        (typedCategory.message === null ||
          typedCategory.message === undefined ||
          typeof typedCategory.message === "string")
      );
    })
  );
}

function readCachedPayload<T>(
  cacheKey: string,
  validate: (value: unknown) => value is T,
) {
  const cachedRaw = window.localStorage.getItem(cacheKey);

  if (!cachedRaw) {
    return null;
  }

  try {
    const cached = JSON.parse(cachedRaw) as unknown;

    if (!validate(cached)) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return cached;
  } catch {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
}

function getMatchBadgeClasses(score: number) {
  if (score >= 75) {
    return "border-accent/18 bg-accent/8 text-accent";
  }

  if (score >= 50) {
    return "border-foreground/12 bg-foreground/5 text-foreground";
  }

  return "border-border bg-background-soft text-secondary";
}

function RoleCard({ role }: { role: DiscoveredRole }) {
  const metadataTags = [role.source_site, role.industry, role.company_size].filter(
    (value) => value && value !== "Could not verify" && value !== "JSearch",
  );

  return (
    <div className="surface-panel rounded-2xl p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            {role.company_logo ? (
              <div className="signal-icon-frame flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={role.company_logo}
                  alt={`${role.company_name} logo`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}

            <div className="min-w-0">
              <h3 className="signal-title text-2xl text-foreground">{role.role_title}</h3>
              <p className="signal-copy mt-2 text-sm">
                {role.company_name}, {role.location}
              </p>
            </div>
          </div>
        </div>

        <Badge className={cn("normal-case tracking-[0.04em]", getMatchBadgeClasses(role.match_score))}>
          {role.match_score}% match
        </Badge>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {role.key_requirements.slice(0, 4).map((requirement, index) => (
          <div
            key={`${role.job_id}-requirement-${index}`}
            className="rounded-full border border-border bg-background-soft px-3 py-1.5 text-xs font-medium text-secondary"
          >
            {requirement}
          </div>
        ))}
      </div>

      <div className="signal-card-soft mt-5 rounded-2xl p-4">
        <p className="signal-eyebrow">Why you fit</p>
        <p className="signal-copy mt-3 text-sm">{role.why_you_fit}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {metadataTags.map((tag, index) => (
            <div
              key={`${role.job_id}-tag-${index}`}
              className="rounded-full border border-border bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-secondary"
            >
              {tag}
            </div>
          ))}
        </div>

        <Button asChild>
          <a href={role.apply_url} target="_blank" rel="noreferrer noopener">
            Apply
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function RoleCardSkeleton() {
  return (
    <div className="surface-panel rounded-2xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <Skeleton className="mt-5 h-24 w-full rounded-[22px]" />

      <div className="mt-5 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function DiscoverWorkspace({ profile }: DiscoverWorkspaceProps) {
  const hasResume = Boolean(profile?.resume_text?.trim());
  const [activeTab, setActiveTab] = useState(hasResume ? "suggested" : "search");
  const [suggestedCategories, setSuggestedCategories] = useState<SuggestedCategoryView[]>([]);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);
  const [isSuggestedLoading, setIsSuggestedLoading] = useState(Boolean(profile?.resume_text?.trim()));
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);
  const suggestedRequestIdRef = useRef(0);

  const suggestedCacheKey = useMemo(() => {
    if (!profile?.id) {
      return null;
    }

    return `signal:discover:roles:suggested:${DISCOVER_CACHE_VERSION}:${profile.id}:${profile.updated_at ?? "unknown"}`;
  }, [profile?.id, profile?.updated_at]);

  const hydrateSuggestedCategory = async (
    seed: SuggestedRoleCategorySeed,
    forceRefresh: boolean,
  ): Promise<SuggestedCategoryView> => {
    try {
      const response = await fetch(`/api/discover/category${forceRefresh ? "?refresh=1" : ""}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(seed),
      });
      const payload = (await response.json()) as {
        category?: SuggestedRoleCategoryHydration;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Signal could not load this role category right now.");
      }

      const category = payload.category;

      if (!category) {
        throw new Error("Signal returned an invalid category response.");
      }

      return {
        title: category.title,
        reason: category.reason,
        roles: category.roles,
        status: category.status,
        message: category.message ?? null,
      };
    } catch (error) {
      return {
        ...seed,
        roles: [],
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Signal could not load this role category right now.",
      };
    }
  };

  const fetchSuggestedRoles = async (forceRefresh = false) => {
    if (!hasResume || !suggestedCacheKey) {
      return;
    }

    const requestId = suggestedRequestIdRef.current + 1;
    suggestedRequestIdRef.current = requestId;
    const cachedPayload = readCachedPayload(suggestedCacheKey, isCachedSuggestedPayload);
    const previousCategories = collectPersistableSuggestedCategories(
      cachedPayload?.categories ?? [],
      suggestedCategories,
    );
    const previousByTitle = buildSuggestedCategoryMap(previousCategories);

    try {
      if (!forceRefresh && cachedPayload?.categories.length) {
        setSuggestedCategories(cachedPayload.categories);
        setSuggestedError(null);
        setIsSuggestedLoading(false);

        if (Date.now() - cachedPayload.createdAt < CACHE_TTL_MS) {
          return;
        }
      }

      if (forceRefresh) {
        setIsRefreshingSuggestions(true);
      } else if (!cachedPayload?.categories.length) {
        setIsSuggestedLoading(true);
      }

      const response = await fetch(`/api/discover${forceRefresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        categories?: SuggestedRoleCategorySeed[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Signal could not load personalized role suggestions.",
        );
      }

      if (suggestedRequestIdRef.current !== requestId) {
        return;
      }

      const seeds = payload.categories ?? [];

      if (!seeds.length) {
        if (!previousCategories.length) {
          setSuggestedCategories([]);
          setSuggestedError(null);
        }
        return;
      }

      const loadingCategories: SuggestedCategoryView[] = seeds.map(
        (seed) =>
          previousByTitle.get(seed.title) ??
          ({
            ...seed,
            roles: [],
            status: "loading",
            message: null,
          } satisfies SuggestedCategoryView),
      );
      const resolvedCategories: SuggestedCategoryView[] = [...loadingCategories];

      setSuggestedCategories(loadingCategories);
      setSuggestedError(null);

      if (!forceRefresh) {
        setIsSuggestedLoading(false);
      }

      const hydrationPromises = seeds.map(async (seed, index) => {
        const hydratedCategory = await hydrateSuggestedCategory(seed, forceRefresh);
        resolvedCategories[index] = hydratedCategory;

        if (suggestedRequestIdRef.current === requestId) {
          setSuggestedCategories((current) => {
            if (suggestedRequestIdRef.current !== requestId) {
              return current;
            }

            const next = [...current];
            next[index] = hydratedCategory;
            return next;
          });
        }

        return hydratedCategory;
      });

      await Promise.allSettled(hydrationPromises);

      if (suggestedRequestIdRef.current !== requestId) {
        return;
      }

      const cacheableCategories = mergeSuggestedCategoriesForCache(
        resolvedCategories,
        previousCategories,
      );

      if (cacheableCategories.length) {
        window.localStorage.setItem(
          suggestedCacheKey,
          JSON.stringify({
            createdAt: Date.now(),
            categories: cacheableCategories,
          } satisfies CachedSuggestedPayload),
        );
      }
    } catch (fetchError) {
      if (!previousCategories.length) {
        setSuggestedError(
          fetchError instanceof Error
            ? fetchError.message
            : "Signal could not load personalized role suggestions.",
        );
      }
    } finally {
      if (suggestedRequestIdRef.current === requestId) {
        setIsSuggestedLoading(false);
        setIsRefreshingSuggestions(false);
      }
    }
  };

  const fetchSuggestedRef = useRef(fetchSuggestedRoles);
  fetchSuggestedRef.current = fetchSuggestedRoles;

  useEffect(() => {
    if (!hasResume || !suggestedCacheKey) {
      setIsSuggestedLoading(false);
      return;
    }

    void fetchSuggestedRef.current();
  }, [hasResume, suggestedCacheKey]);

  return (
    <div className="space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="space-y-3">
          <p className="signal-copy text-sm">
            Personalized matches when you have a resume, plus live internship search
            for everyone.
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="suggested">Suggested For You</TabsTrigger>
              <TabsTrigger value="search">Search Internships</TabsTrigger>
            </TabsList>

            {hasResume ? (
              <Button
                variant="secondary"
                onClick={() => {
                  void fetchSuggestedRoles(true);
                }}
                disabled={isRefreshingSuggestions}
                className="w-full justify-center lg:w-auto"
              >
                {isRefreshingSuggestions ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {isRefreshingSuggestions ? "Refreshing..." : "Refresh Suggestions"}
              </Button>
            ) : null}
          </div>
        </div>

        <TabsContent value="suggested" className="space-y-6">
          {!hasResume ? (
            <section className="surface-panel rounded-2xl p-6 md:p-8">
              <Badge>Resume needed</Badge>
              <h3 className="signal-title mt-5 text-3xl text-foreground sm:text-4xl">
                Upload your resume in Profile to get personalized role suggestions.
              </h3>
              <p className="signal-copy mt-4 max-w-2xl text-base">
                Signal uses your resume, major, minor, and interests to suggest role
                categories and rank real postings by fit.
              </p>
              <div className="mt-8">
                <Button asChild>
                  <Link href="/profile">Upload Resume →</Link>
                </Button>
              </div>
            </section>
          ) : null}

          {hasResume && isSuggestedLoading ? (
            <section className="space-y-8">
              {Array.from({ length: 3 }).map((_, sectionIndex) => (
                <div key={sectionIndex} className="space-y-4">
                  <Skeleton className="h-7 w-56" />
                  <Skeleton className="h-4 w-72" />
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, cardIndex) => (
                      <RoleCardSkeleton key={cardIndex} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {hasResume && !isSuggestedLoading && suggestedError ? (
            <section className="signal-callout-quiet rounded-2xl p-5 text-sm text-foreground">
              {suggestedError}
            </section>
          ) : null}

          {hasResume && !isSuggestedLoading && !suggestedError && suggestedCategories.length ? (
            <section className="space-y-8">
              {suggestedCategories.map((category) => (
                <div
                  key={category.title}
                  className="surface-panel rounded-2xl p-6"
                >
                  <div className="flex flex-col gap-3 border-b border-border pb-5">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4 text-accent" />
                      <h3 className="signal-title text-2xl text-foreground">{category.title}</h3>
                    </div>
                    <p className="signal-copy text-sm">{category.reason}</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {category.status === "loading"
                      ? Array.from({ length: 2 }).map((_, index) => (
                          <RoleCardSkeleton key={`${category.title}-loading-${index}`} />
                        ))
                      : null}

                    {category.status === "ready"
                      ? category.roles.map((role) => (
                          <RoleCard
                            key={`${category.title}-${role.job_id}`}
                            role={role}
                          />
                        ))
                      : null}

                    {category.status === "empty" ? (
                      <div className="signal-empty-state rounded-2xl p-5 text-sm text-secondary">
                        {category.message ?? "No active postings found for this category right now."}
                      </div>
                    ) : null}

                    {category.status === "error" ? (
                      <div className="signal-callout-quiet rounded-2xl p-5 text-sm text-foreground">
                        {category.message ?? "Signal could not load this role category right now."}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {hasResume &&
          !isSuggestedLoading &&
          !suggestedError &&
          !suggestedCategories.length ? (
            <section className="signal-empty-state rounded-2xl p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-accent" />
              <p className="signal-title mt-4 text-2xl text-foreground">No role suggestions yet</p>
              <p className="signal-copy mx-auto mt-3 max-w-2xl text-sm">
                Refresh suggestions and Signal will search for a new set of role
                categories and active postings based on your profile.
              </p>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <InternshipSearchPanel mode="discover" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
