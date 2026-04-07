import { NextResponse } from "next/server";

import {
  discoverSuggestedRoles,
  getOpenAIErrorMessage,
} from "@/lib/openai";
import { getRuntimeCacheValue, setRuntimeCacheValue } from "@/lib/runtime-cache";
import {
  suggestedRoleSeedsResponseSchema,
  type SuggestedRoleCategorySeed,
} from "@/lib/types";
import {
  SUGGESTED_CACHE_TTL_MS,
  getAuthorizedProfile,
  getSuggestedRoleSeedsCacheKey,
  normalizeSuggestedCategorySeed,
} from "@/app/api/discover/shared";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const cacheKey = getSuggestedRoleSeedsCacheKey(profile);

    if (!forceRefresh) {
      const cached = getRuntimeCacheValue<SuggestedRoleCategorySeed[]>(
        cacheKey,
        SUGGESTED_CACHE_TTL_MS,
      );

      if (cached) {
        return NextResponse.json(
          suggestedRoleSeedsResponseSchema.parse({
            categories: cached,
          }),
        );
      }
    }

    const rawSuggestions = await discoverSuggestedRoles(profile);
    const categories = rawSuggestions.categories.map((category) =>
      normalizeSuggestedCategorySeed(category),
    );
    const payload = suggestedRoleSeedsResponseSchema.parse({
      categories,
    });

    setRuntimeCacheValue(cacheKey, payload.categories);

    return NextResponse.json(payload);
  } catch (requestError) {
    const normalized = getOpenAIErrorMessage(requestError);

    return NextResponse.json(
      { error: normalized.message },
      { status: normalized.status },
    );
  }
}
