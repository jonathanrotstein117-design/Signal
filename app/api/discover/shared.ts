import { NextResponse } from "next/server";

import { replaceEmDashes } from "@/lib/generated-content";
import { generateRoleWhyYouFitCopy } from "@/lib/openai";
import { getProfileByUserId } from "@/lib/profile";
import { scoreRolePostings } from "@/lib/role-match";
import { createClient } from "@/lib/supabase/server";
import type {
  DiscoveredRole,
  ProfileRecord,
  RolePosting,
  SuggestedRoleCategorySeed,
} from "@/lib/types";

export const SUGGESTED_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const SUGGESTED_CACHE_VERSION = "active-posting-progressive-v3";

function normalizeCacheToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function limitToWordCount(value: string, maxWords: number) {
  const words = replaceEmDashes(value).trim().split(/\s+/);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ").replace(/[,.]+$/, "")}.`;
}

export function normalizeSuggestedCategorySeed(seed: SuggestedRoleCategorySeed) {
  return {
    title: replaceEmDashes(seed.title),
    reason: limitToWordCount(seed.reason, 20),
  } satisfies SuggestedRoleCategorySeed;
}

export async function hydrateRoleWhyYouFit(
  postings: RolePosting[],
  profile: ProfileRecord,
) {
  const scoredRoles = scoreRolePostings(postings, profile).slice(0, 4);

  if (!scoredRoles.length) {
    return [] satisfies DiscoveredRole[];
  }

  const generatedRoles = await generateRoleWhyYouFitCopy(scoredRoles, profile);

  return generatedRoles
    .map((role) => ({
      ...role,
      why_you_fit: limitToWordCount(role.why_you_fit, 29),
    }))
    .sort((left, right) => right.match_score - left.match_score);
}

export function getSuggestedRoleSeedsCacheKey(profile: ProfileRecord) {
  return `signal:discover:suggested-seeds:${SUGGESTED_CACHE_VERSION}:${profile.id}:${profile.updated_at ?? "unknown"}`;
}

export function getSuggestedRoleCategoryCacheKey(profile: ProfileRecord, title: string) {
  return `signal:discover:suggested-category:${SUGGESTED_CACHE_VERSION}:${profile.id}:${profile.updated_at ?? "unknown"}:${normalizeCacheToken(title)}`;
}

export async function getAuthorizedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "You must be logged in to discover roles." },
        { status: 401 },
      ),
      profile: null,
    };
  }

  const { profile: profileData, error: profileError } = await getProfileByUserId(
    supabase,
    user.id,
  );

  if (profileError || !profileData) {
    return {
      error: NextResponse.json(
        { error: "Signal could not load your profile yet." },
        { status: 400 },
      ),
      profile: null,
    };
  }

  return {
    error: null,
    profile: profileData as ProfileRecord,
  };
}
