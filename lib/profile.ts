import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ProfileRecord } from "@/lib/types";

const profileSelect = [
  "id",
  "full_name",
  "university",
  "major",
  "minor",
  "double_major",
  "graduation_year",
  "career_interests",
  "resume_text",
  "resume_filename",
  "updated_at",
].join(", ");

const legacyProfileSelect = [
  "id",
  "full_name",
  "university",
  "major",
  "graduation_year",
  "career_interests",
  "resume_text",
  "resume_filename",
  "updated_at",
].join(", ");

function isMissingOptionalProfileColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  return message.includes("minor") || message.includes("double_major");
}

export async function getProfileByUserId(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const currentProfileQuery = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .maybeSingle();

  if (!currentProfileQuery.error) {
    return {
      profile: (currentProfileQuery.data as ProfileRecord | null) ?? null,
      error: null,
      usedLegacySchema: false,
    };
  }

  if (!isMissingOptionalProfileColumnError(currentProfileQuery.error.message)) {
    return {
      profile: null,
      error: currentProfileQuery.error,
      usedLegacySchema: false,
    };
  }

  const legacyProfileQuery = await supabase
    .from("profiles")
    .select(legacyProfileSelect)
    .eq("id", userId)
    .maybeSingle();

  if (legacyProfileQuery.error) {
    return {
      profile: null,
      error: legacyProfileQuery.error,
      usedLegacySchema: true,
    };
  }

  return {
    profile: legacyProfileQuery.data
      ? ({
          ...(legacyProfileQuery.data as Record<string, unknown>),
          minor: null,
          double_major: null,
        } as ProfileRecord)
      : null,
    error: null,
    usedLegacySchema: true,
  };
}
