import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPendingCompanies,
  getCareerFairProgress,
  getCareerFairStatus,
  normalizeCompanyName,
} from "@/lib/career-fair";
import {
  generateCareerFairMatch,
  generateSignalBrief,
  getOpenAIErrorMessage,
} from "@/lib/openai";
import { getProfileByUserId } from "@/lib/profile";
import {
  normalizeBriefRecord,
  normalizeCareerFairRecord,
  type BriefRecord,
  type CareerFairCompany,
  type CareerFairRecord,
  type Database,
  type NormalizedBriefRecord,
  type NormalizedCareerFairRecord,
  type ProfileRecord,
  type SignalBrief,
} from "@/lib/types";

type SupabaseServerClient = SupabaseClient<Database>;

function getCompanyKey(name: string) {
  return normalizeCompanyName(name).toLocaleLowerCase();
}

function formatProcessingError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Signal could not process this company right now.";
}

async function loadRecentBriefs(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const cache = new Map<string, NormalizedBriefRecord>();

  for (const item of (data as BriefRecord[] | null) ?? []) {
    const normalized = normalizeBriefRecord(item);
    const key = getCompanyKey(normalized.company_name);

    if (!cache.has(key)) {
      cache.set(key, normalized);
    }
  }

  return cache;
}

async function saveBrief(
  supabase: SupabaseServerClient,
  userId: string,
  companyName: string,
  brief: SignalBrief,
) {
  const { data, error } = await supabase
    .from("briefs")
    .insert({
      user_id: userId,
      company_name: companyName,
      brief_data: brief,
      created_at: new Date().toISOString(),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      "The brief was generated but could not be saved. Make sure the briefs table exists and allows inserts for the signed-in user.",
    );
  }

  return normalizeBriefRecord(data as BriefRecord);
}

async function resolveBriefForCompany(
  supabase: SupabaseServerClient,
  userId: string,
  companyName: string,
  profile: ProfileRecord | null,
  recentBriefs: Map<string, NormalizedBriefRecord>,
) {
  const cached = recentBriefs.get(getCompanyKey(companyName));

  if (cached) {
    return {
      briefId: cached.id,
      brief: cached.brief_data,
      cached: true,
    };
  }

  const brief = await generateSignalBrief(companyName, profile);
  const savedBrief = await saveBrief(supabase, userId, companyName, brief);
  recentBriefs.set(getCompanyKey(companyName), savedBrief);

  return {
    briefId: savedBrief.id,
    brief: savedBrief.brief_data,
    cached: false,
  };
}

async function loadCareerFairRow(
  supabase: SupabaseServerClient,
  userId: string,
  fairId: string,
) {
  const { data, error } = await supabase
    .from("career_fairs")
    .select("*")
    .eq("id", fairId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Career fair not found.");
  }

  return data as CareerFairRecord;
}

async function persistCareerFairCompanies(
  supabase: SupabaseServerClient,
  userId: string,
  fairId: string,
  companies: CareerFairCompany[],
) {
  const { error } = await supabase
    .from("career_fairs")
    .update({
      companies,
    } as never)
    .eq("id", fairId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

function getNextCompanyToProcess(companies: CareerFairCompany[]) {
  return companies.find(
    (company) => company.status === "pending" || company.status === "processing",
  );
}

function updateCompanyRecord(
  companies: CareerFairCompany[],
  companyName: string,
  updater: (company: CareerFairCompany) => CareerFairCompany,
) {
  const key = getCompanyKey(companyName);

  return companies.map((company) =>
    getCompanyKey(company.name) === key ? updater(company) : company,
  );
}

export async function getProfileForUser(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { profile: data, error } = await getProfileByUserId(supabase, userId);

  if (error) {
    return null;
  }

  return (data as ProfileRecord | null) ?? null;
}

export async function getCareerFairForUser(
  supabase: SupabaseServerClient,
  userId: string,
  fairId: string,
) {
  const { data, error } = await supabase
    .from("career_fairs")
    .select("*")
    .eq("id", fairId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeCareerFairRecord(data as CareerFairRecord) : null;
}

export async function getLatestCareerFairForUser(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("career_fairs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeCareerFairRecord(data as CareerFairRecord) : null;
}

export function buildCareerFairPayload(fair: NormalizedCareerFairRecord) {
  return {
    fair,
    status: getCareerFairStatus(fair.companies),
    progress: getCareerFairProgress(fair.companies),
  };
}

export async function createCareerFair(
  supabase: SupabaseServerClient,
  userId: string,
  fairName: string,
  companies: string[],
) {
  const { data, error } = await supabase
    .from("career_fairs")
    .insert({
      user_id: userId,
      fair_name: fairName,
      companies: createPendingCompanies(companies),
      created_at: new Date().toISOString(),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      "Signal could not create the career fair record. Make sure the career_fairs table exists and allows inserts for the signed-in user.",
    );
  }

  return normalizeCareerFairRecord(data as CareerFairRecord);
}

export async function appendCompaniesToCareerFair(
  supabase: SupabaseServerClient,
  userId: string,
  fairId: string,
  fairName: string,
  companies: string[],
) {
  const fair = await getCareerFairForUser(supabase, userId, fairId);

  if (!fair) {
    throw new Error("Career fair not found.");
  }

  const existingKeys = new Set(
    fair.companies.map((company) => getCompanyKey(company.name)),
  );
  const newCompanies = companies.filter(
    (company) => !existingKeys.has(getCompanyKey(company)),
  );

  if (!newCompanies.length) {
    return fair;
  }

  const updatedCompanies = [
    ...fair.companies,
    ...createPendingCompanies(newCompanies),
  ];

  const { data, error } = await supabase
    .from("career_fairs")
    .update({
      fair_name: fairName,
      companies: updatedCompanies,
    } as never)
    .eq("id", fairId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Signal could not update the career fair.");
  }

  return normalizeCareerFairRecord(data as CareerFairRecord);
}

export async function processCareerFair(
  supabase: SupabaseServerClient,
  userId: string,
  fairId: string,
  profile: ProfileRecord | null,
) {
  const recentBriefs = await loadRecentBriefs(supabase, userId);

  while (true) {
    const row = await loadCareerFairRow(supabase, userId, fairId);
    const fair = normalizeCareerFairRecord(row);
    const company = getNextCompanyToProcess(fair.companies);

    if (!company) {
      return;
    }

    const processingCompanies = updateCompanyRecord(
      fair.companies,
      company.name,
      (current) => ({
        ...current,
        status: "processing",
        error_message: null,
      }),
    );

    await persistCareerFairCompanies(
      supabase,
      userId,
      fairId,
      processingCompanies,
    );

    let briefId: string | null = company.brief_id ?? null;
    let industry: string | null = company.industry ?? null;

    try {
      const resolvedBrief = await resolveBriefForCompany(
        supabase,
        userId,
        company.name,
        profile,
        recentBriefs,
      );

      briefId = resolvedBrief.briefId;
      industry = resolvedBrief.brief.company_overview.industry;

      const match = await generateCareerFairMatch(
        company.name,
        resolvedBrief.brief,
        profile,
      );

      const completedCompanies = updateCompanyRecord(
        processingCompanies,
        company.name,
        (current) => ({
          ...current,
          status: "completed",
          match_score: match.match_score,
          brief_id: briefId,
          why_you_match: match.why_you_match,
          industry,
          pocket_brief: match.pocket_brief,
          error_message: null,
        }),
      );

      await persistCareerFairCompanies(
        supabase,
        userId,
        fairId,
        completedCompanies,
      );
    } catch (error) {
      const normalizedError =
        error instanceof Error &&
        "status" in getOpenAIErrorMessage(error)
          ? getOpenAIErrorMessage(error).message
          : formatProcessingError(error);

      const erroredCompanies = updateCompanyRecord(
        processingCompanies,
        company.name,
        (current) => ({
          ...current,
          status: "error",
          brief_id: briefId,
          industry,
          pocket_brief: null,
          error_message: normalizedError,
        }),
      );

      await persistCareerFairCompanies(
        supabase,
        userId,
        fairId,
        erroredCompanies,
      );
    }
  }
}
