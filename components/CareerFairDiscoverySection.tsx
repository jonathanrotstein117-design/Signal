"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { CareerFairDiscoveryFair } from "@/lib/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

interface CareerFairDiscoverySectionProps {
  userId: string;
  universityName: string | null;
  onUniversitySaved: (universityName: string) => void;
  onUseFair: (fair: CareerFairDiscoveryFair) => void;
}

interface CachedDiscoveryPayload {
  createdAt: number;
  fairs: CareerFairDiscoveryFair[];
}

export function CareerFairDiscoverySection({
  userId,
  universityName,
  onUniversitySaved,
  onUseFair,
}: CareerFairDiscoverySectionProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [fairs, setFairs] = useState<CareerFairDiscoveryFair[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(universityName));
  const [error, setError] = useState<string | null>(null);
  const [draftUniversityName, setDraftUniversityName] = useState(universityName ?? "");
  const [isSavingUniversity, setIsSavingUniversity] = useState(false);

  useEffect(() => {
    setDraftUniversityName(universityName ?? "");
  }, [universityName]);

  const cacheKey = useMemo(() => {
    const normalizedUniversity = universityName?.trim().toLocaleLowerCase();
    const year = new Date().getFullYear();

    return normalizedUniversity
      ? `signal:career-fair-discovery:${normalizedUniversity}:${year}`
      : null;
  }, [universityName]);

  useEffect(() => {
    if (!universityName?.trim() || !cacheKey) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const cachedRaw = window.localStorage.getItem(cacheKey);

        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as CachedDiscoveryPayload;

          if (Date.now() - cached.createdAt < CACHE_TTL_MS) {
            if (!cancelled) {
              setFairs(cached.fairs);
              setError(null);
              setIsLoading(false);
            }
            return;
          }
        }

        setIsLoading(true);
        const response = await fetch("/api/career-fair/discover", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ universityName }),
        });

        const payload = (await response.json()) as {
          fairs?: CareerFairDiscoveryFair[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Signal could not discover fairs right now.");
        }

        const nextFairs = payload.fairs ?? [];

        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({
            createdAt: Date.now(),
            fairs: nextFairs,
          } satisfies CachedDiscoveryPayload),
        );

        if (!cancelled) {
          setFairs(nextFairs);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Signal could not discover fairs right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, universityName]);

  const handleSaveUniversity = async () => {
    const normalizedUniversityName = draftUniversityName.trim();

    if (!normalizedUniversityName) {
      toast.error("Enter your university first.");
      return;
    }

    setIsSavingUniversity(true);

    try {
      const { error: saveError } = await supabase
        .from("profiles" as never)
        .upsert({
          id: userId,
          university: normalizedUniversityName,
          updated_at: new Date().toISOString(),
        } as never);

      if (saveError) {
        throw saveError;
      }

      onUniversitySaved(normalizedUniversityName);
      setError(null);
      toast.success("University saved");
      router.refresh();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Signal could not save your university yet.",
      );
    } finally {
      setIsSavingUniversity(false);
    }
  };

  return (
    <section className="surface-panel rounded-2xl p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Auto-discovery</Badge>
        <p className="signal-eyebrow">
          Upcoming fairs
        </p>
      </div>

      <div className="mt-5 max-w-3xl">
        <h2 className="signal-title text-3xl text-foreground sm:text-4xl">
          Upcoming Fairs at {universityName ?? "Your University"}
        </h2>
        <p className="signal-copy mt-4 text-base">
          Signal can scout the next recruiting events for you, pull in the fair
          name, and sometimes even preload the company list.
        </p>
      </div>

      {!universityName?.trim() ? (
        <div className="signal-card-soft mt-6 rounded-2xl p-5">
          <label
            htmlFor="career-fair-university"
            className="text-sm font-medium text-foreground"
          >
            What school do you go to?
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              id="career-fair-university"
              value={draftUniversityName}
              onChange={(event) => setDraftUniversityName(event.target.value)}
              placeholder="Rutgers University"
              className="h-12 rounded-[14px] text-base"
              disabled={isSavingUniversity}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSaveUniversity();
                }
              }}
            />
            <Button
              onClick={() => void handleSaveUniversity()}
              disabled={isSavingUniversity || !draftUniversityName.trim()}
            >
              {isSavingUniversity ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {isSavingUniversity ? "Saving..." : "Save and Search"}
            </Button>
          </div>
          <p className="mt-3 text-sm text-secondary">
            We&apos;ll save this to your profile and use it for career fair searches from now on.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-secondary">
            <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
            Searching for upcoming fairs at {universityName}...
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="surface-panel rounded-2xl p-5"
              >
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-4 h-4 w-1/3" />
                <Skeleton className="mt-5 h-16 w-full" />
                <div className="mt-5 flex gap-3">
                  <Skeleton className="h-10 w-28 rounded-full" />
                  <Skeleton className="h-10 w-32 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="signal-callout-quiet mt-8 rounded-2xl p-5 text-sm text-foreground">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && !fairs.length && universityName ? (
        <div className="signal-empty-state mt-8 rounded-2xl p-6 text-sm text-secondary">
          No upcoming fairs found. You can set one up manually below.
        </div>
      ) : null}

      {!isLoading && fairs.length ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {fairs.map((fair) => (
            <div
              key={`${fair.name}-${fair.date}`}
              className="surface-panel rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{fair.date}</Badge>
                <Badge variant={fair.companies_found?.length ? "success" : "warning"}>
                  {fair.companies_found?.length
                    ? `${fair.companies_found.length} companies found`
                    : "Company list not available"}
                </Badge>
              </div>

              <h3 className="signal-title mt-5 text-2xl text-foreground">{fair.name}</h3>
              <p className="signal-copy mt-3 text-sm">{fair.description}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    onUseFair(fair);
                    toast.success(`Loaded ${fair.name}`);
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Use this fair →
                </Button>
                <Button asChild variant="ghost">
                  <Link href={fair.source_url} target="_blank" rel="noreferrer">
                    Source
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
