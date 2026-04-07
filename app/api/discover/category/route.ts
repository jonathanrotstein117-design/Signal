import { NextResponse } from "next/server";

import {
  SUGGESTED_CACHE_TTL_MS,
  getAuthorizedProfile,
  getSuggestedRoleCategoryCacheKey,
  hydrateRoleWhyYouFit,
  normalizeSuggestedCategorySeed,
} from "@/app/api/discover/shared";
import { searchJobsForCategory, type JobSearchReason } from "@/lib/jobs";
import { getOpenAIErrorMessage } from "@/lib/openai";
import { getRuntimeCacheValue, setRuntimeCacheValue } from "@/lib/runtime-cache";
import {
  suggestedRoleCategoryHydrationResponseSchema,
  suggestedRoleCategoryHydrationSchema,
  suggestedRoleCategorySeedSchema,
} from "@/lib/types";

export const runtime = "nodejs";

function getFriendlyJobSearchError(reason: JobSearchReason | null) {
  if (reason === "jsearch_unavailable") {
    return "Signal could not reach the live job feed for this category right now. Try refreshing in a minute.";
  }

  return "Signal could not reach live job sources for this category right now. Try refreshing in a minute.";
}

export async function POST(request: Request) {
  const { error, profile } = await getAuthorizedProfile();

  if (error || !profile) {
    return error;
  }

  if (!profile.resume_text?.trim()) {
    return NextResponse.json(
      { error: "Upload your resume in Profile to get personalized role suggestions." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = suggestedRoleCategorySeedSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid suggested category request." },
      { status: 400 },
    );
  }

  const seed = normalizeSuggestedCategorySeed(parsedBody.data);

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const cacheKey = getSuggestedRoleCategoryCacheKey(profile, seed.title);

    if (!forceRefresh) {
      const cached = getRuntimeCacheValue(
        cacheKey,
        SUGGESTED_CACHE_TTL_MS,
      );

      if (cached) {
        return NextResponse.json(
          suggestedRoleCategoryHydrationResponseSchema.parse({
            category: cached,
          }),
        );
      }
    }

    const searchResult = await searchJobsForCategory(seed.title, {
      forceRefresh,
    });

    if (searchResult.status === "source_unavailable") {
      return NextResponse.json(
        suggestedRoleCategoryHydrationResponseSchema.parse({
          category: {
            ...seed,
            roles: [],
            status: "error",
            message: getFriendlyJobSearchError(searchResult.reason),
          },
        }),
      );
    }

    const roles =
      searchResult.status === "ready"
        ? await hydrateRoleWhyYouFit(searchResult.postings, profile)
        : [];
    const category = suggestedRoleCategoryHydrationSchema.parse(
      roles.length
        ? {
            ...seed,
            roles,
            status: "ready",
            message: null,
          }
        : {
            ...seed,
            roles: [],
            status: "empty",
            message: "No active postings found for this category right now.",
          },
    );

    setRuntimeCacheValue(cacheKey, category);

    return NextResponse.json(
      suggestedRoleCategoryHydrationResponseSchema.parse({
        category,
      }),
    );
  } catch (requestError) {
    const message = getOpenAIErrorMessage(requestError).message;

    return NextResponse.json(
      suggestedRoleCategoryHydrationResponseSchema.parse({
        category: {
          ...seed,
          roles: [],
          status: "error",
          message,
        },
      }),
    );
  }
}
