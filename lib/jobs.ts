import OpenAI from "openai";
import { z } from "zod";

import {
  replaceEmDashes,
  sanitizeGeneratedContent,
  sanitizeGeneratedJsonText,
} from "@/lib/generated-content";
import {
  deleteRuntimeCacheValue,
  getRuntimeCacheValue,
  setRuntimeCacheValue,
} from "@/lib/runtime-cache";
import {
  roleSearchRequestSchema,
  rolePostingSchema,
  type RolePosting,
  type RoleSearchRequest,
} from "@/lib/types";

const JSEARCH_ENDPOINT = "https://jsearch.p.rapidapi.com/search";
const JOB_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const ACTIVE_LINK_PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const INACTIVE_LINK_PROBE_CACHE_TTL_MS = 30 * 60 * 1_000;
const JOB_CACHE_VERSION = "active-posting-preferred-boards-v5";
const LINK_PROBE_CACHE_VERSION = "active-posting-preferred-boards-v4";
const APPLY_LINK_PROBE_TIMEOUT_MS = 3_000;
const APPLY_LINK_PROBE_MAX_BODY_CHARS = 16_000;
const CATEGORY_TARGET_COUNT = 10;
const FALLBACK_SEARCH_CONCURRENCY = 2;
const FALLBACK_SEARCH_MAX_ATTEMPTS = 2;
const LINKEDIN_DETAIL_FETCH_CONCURRENCY = 4;
const LINKEDIN_GUEST_SEARCH_ENDPOINT =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const LINKEDIN_GUEST_JOB_POSTING_ENDPOINT =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const TRACKING_QUERY_PARAM_PREFIXES = ["utm_"];
const TRACKING_QUERY_PARAM_KEYS = new Set([
  "trk",
  "trkinfo",
  "trackingid",
  "tracking_id",
  "mcid",
  "mcd",
  "mkt_tok",
  "gclid",
  "fbclid",
  "ref",
  "refid",
  "source",
  "src",
  "campaign",
]);
const GENERIC_SEARCH_QUERY_PARAM_KEYS = new Set([
  "q",
  "query",
  "keywords",
  "keyword",
  "l",
  "location",
  "where",
  "what",
  "search",
  "searchterm",
]);
const DIRECT_JOB_QUERY_PARAM_KEYS = new Set([
  "jk",
  "vjk",
  "jobid",
  "job_id",
  "jobkey",
  "gh_jid",
  "gh_src",
  "requisitionid",
  "requisition_id",
  "reqid",
  "postingid",
  "posting_id",
  "jid",
  "pid",
  "opportunityid",
  "opportunity_id",
  "vacancyid",
  "vacancy_id",
]);
const GENERIC_COMPANY_INDEX_SEGMENTS = new Set([
  "job",
  "jobs",
  "career",
  "careers",
  "position",
  "positions",
  "opening",
  "openings",
  "opportunity",
  "opportunities",
  "employment",
  "search",
  "results",
  "listings",
  "all",
]);
const REMOVED_LINKEDIN_PAGE_PATTERNS = [
  /job id provided may not be valid/i,
  /job posting has been removed/i,
  /unable to load the page/i,
] as const;
const COMMON_INACTIVE_POSTING_PATTERNS = [
  /no longer accepting applications/i,
  /applications? (?:for this (?:job|position|role) )?(?:are|is) closed/i,
  /job (?:posting )?has expired/i,
  /job is closed/i,
  /job is no longer available/i,
  /role is no longer available/i,
  /position has been filled/i,
  /this position has been filled/i,
  /this role has been filled/i,
  /opportunity is no longer available/i,
] as const;
const INDEED_INACTIVE_POSTING_PATTERNS = [
  /no longer available on indeed/i,
  /this job has expired/i,
  /job expired/i,
  /we are no longer accepting applications/i,
] as const;
const COMPANY_INACTIVE_POSTING_PATTERNS = [
  /this position is closed/i,
  /job posting is no longer active/i,
  /this requisition is closed/i,
  /this opening is closed/i,
] as const;
const COMMON_SKILL_PATTERNS = [
  { label: "Excel", pattern: /\bexcel\b/i },
  { label: "SQL", pattern: /\bsql\b/i },
  { label: "Python", pattern: /\bpython\b/i },
  { label: "R", pattern: /\br\b(?=.*\banalytics|\bstatistics|\bdata)/i },
  { label: "Tableau", pattern: /\btableau\b/i },
  { label: "Power BI", pattern: /\bpower\s?bi\b/i },
  { label: "Looker", pattern: /\blooker\b/i },
  { label: "Data Analysis", pattern: /\bdata analys(?:is|t)\b/i },
  { label: "Financial Modeling", pattern: /\bfinancial modeling\b/i },
  { label: "PowerPoint", pattern: /\bpowerpoint\b/i },
  { label: "Sustainability", pattern: /\bsustainability\b/i },
  { label: "ESG", pattern: /\besg\b/i },
  { label: "Marketing Analytics", pattern: /\bmarketing analytics\b/i },
  { label: "Statistics", pattern: /\bstatistics?\b/i },
  { label: "Project Management", pattern: /\bproject management\b/i },
  { label: "Salesforce", pattern: /\bsalesforce\b/i },
] as const;

type PostingOrigin = "jsearch" | "fallback";
export type JobSearchSource = PostingOrigin | "mixed" | "none";
export type JobSearchStatus = "ready" | "empty" | "source_unavailable";
export type JobSearchReason =
  | "no_active_postings"
  | "jsearch_unavailable"
  | "fallback_unavailable"
  | "all_sources_unavailable";
type ValidationFailureReason =
  | "invalid_url"
  | "timeout"
  | "network_error"
  | "http_error"
  | "redirected_to_invalid_page"
  | "inactive_page";

interface NormalizedJobApplyUrl {
  normalizedUrl: string;
  sourceSite: string;
  sourceKind: "linkedin" | "indeed" | "company";
  identityKey: string;
  listingId: string | null;
}

interface SourcedRolePosting extends RolePosting {
  origin: PostingOrigin;
}

interface PostingValidationResult {
  posting: SourcedRolePosting;
  isActive: boolean;
  reason?: ValidationFailureReason;
}

export interface JobSearchResult {
  postings: RolePosting[];
  status: JobSearchStatus;
  source: JobSearchSource;
  reason: JobSearchReason | null;
}

interface LinkedInGuestSearchCard {
  jobId: string;
  roleTitle: string;
  companyName: string;
  companyLogo: string | null;
  location: string;
  applyUrl: string;
  postedAt: string | null;
}

const openAiSearchUserLocation = {
  type: "approximate",
  country: "US",
  region: "New Jersey",
  city: "New Brunswick",
  timezone: "America/New_York",
} as const;

const preferredBoardSearchStrategies = [
  {
    model: "gpt-4o",
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        user_location: openAiSearchUserLocation,
      },
    ],
  },
  {
    model: "gpt-4o-search-preview",
    tools: [
      {
        type: "web_search_preview",
        search_context_size: "medium",
        user_location: openAiSearchUserLocation,
      },
    ],
  },
] as const;

const jSearchJobSchema = z
  .object({
    job_id: z.string().trim().min(1),
    job_title: z.string().trim().min(1),
    employer_name: z.string().trim().min(1),
    employer_logo: z.string().trim().url().nullable().optional(),
    employer_company_type: z.string().trim().nullable().optional(),
    job_city: z.string().trim().nullable().optional(),
    job_state: z.string().trim().nullable().optional(),
    job_country: z.string().trim().nullable().optional(),
    job_description: z.string().trim().nullable().optional(),
    job_is_remote: z.boolean().nullable().optional(),
    job_apply_link: z.string().trim().url().nullable().optional(),
    job_posted_at_datetime_utc: z.string().trim().nullable().optional(),
    job_publisher: z.string().trim().nullable().optional(),
    job_employment_type: z.string().trim().nullable().optional(),
    job_required_experience: z
      .object({
        no_experience_required: z.boolean().nullable().optional(),
        required_experience_in_months: z.number().int().min(0).nullable().optional(),
        experience_mentioned: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    job_required_skills: z.array(z.string().trim().min(1)).nullable().optional(),
    job_required_education: z
      .object({
        postgraduate_degree: z.boolean().nullable().optional(),
        professional_certification: z.boolean().nullable().optional(),
        high_school: z.boolean().nullable().optional(),
        associates_degree: z.boolean().nullable().optional(),
        bachelors_degree: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    job_highlights: z
      .object({
        Qualifications: z.array(z.string().trim().min(1)).nullable().optional(),
        Responsibilities: z.array(z.string().trim().min(1)).nullable().optional(),
        Benefits: z.array(z.string().trim().min(1)).nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const jSearchResponseSchema = z.object({
  data: z.array(jSearchJobSchema).default([]),
});

type JSearchJob = z.infer<typeof jSearchJobSchema>;

const preferredBoardSearchSchema = z.object({
  postings: z.array(rolePostingSchema).max(10),
});

interface JSearchSearchOptions {
  query: string;
  location?: string | null;
  industry?: string | null;
  companySize?: string | null;
  employmentType?: string | null;
  remoteOnly?: boolean;
  forceRefresh?: boolean;
  allowFallback?: boolean;
  sourceContext?: string | null;
}

export class JobSearchUnavailableError extends Error {
  status: number;

  constructor(message = "Job search is temporarily unavailable. Please try again later.", status = 503) {
    super(message);
    this.name = "JobSearchUnavailableError";
    this.status = status;
  }
}

class InvalidPreferredBoardSearchError extends Error {}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeText(value: string | null | undefined) {
  return replaceEmDashes(value?.trim() ?? "");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return normalizeText(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h\d|section|article)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<[^>]+>/g, " "),
    )
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " "),
  );
}

function extractFirstMatch(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  return match?.[1] ? normalizeText(stripHtml(match[1])) : "";
}

function normalizeIdentityText(value: string | null | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

function deleteTrackingQueryParams(parsed: URL) {
  for (const key of Array.from(parsed.searchParams.keys())) {
    const lowerKey = key.toLowerCase();
    const shouldDelete =
      TRACKING_QUERY_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix)) ||
      TRACKING_QUERY_PARAM_KEYS.has(lowerKey);

    if (shouldDelete) {
      parsed.searchParams.delete(key);
    }
  }
}

function sortSearchParams(searchParams: URLSearchParams) {
  const sorted = new URLSearchParams();
  const entries = Array.from(searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }

    return leftKey.localeCompare(rightKey);
  });

  for (const [key, value] of entries) {
    sorted.append(key, value);
  }

  return sorted;
}

function hasAnyQueryParam(searchParams: URLSearchParams, keys: Set<string>) {
  for (const key of searchParams.keys()) {
    if (keys.has(key.toLowerCase())) {
      return true;
    }
  }

  return false;
}

function isJobSlugSegment(segment: string) {
  const withoutExtension = segment.toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, "");

  if (withoutExtension.length < 14) {
    return false;
  }

  const parts = withoutExtension.split("-").filter(Boolean);
  const alphaParts = parts.filter((part) => /[a-z]/i.test(part));

  return parts.length >= 3 && alphaParts.length >= 3;
}

function extractLinkedInListingId(parsed: URL) {
  const pathname = normalizePathname(parsed.pathname);
  const lowerPathname = pathname.toLowerCase();

  if (
    lowerPathname === "/jobs" ||
    lowerPathname.startsWith("/jobs/search") ||
    lowerPathname.startsWith("/jobs/collections")
  ) {
    return null;
  }

  const viewMatch = pathname.match(/^\/jobs\/view\/(.+)$/i);

  if (!viewMatch) {
    return null;
  }

  const pathId = viewMatch[1].match(/(\d{6,})(?:\/)?$/)?.[1] ?? null;

  if (pathId) {
    return pathId;
  }

  const currentJobId =
    parsed.searchParams.get("currentJobId") ?? parsed.searchParams.get("jobId");

  return currentJobId && /^\d{6,}$/.test(currentJobId) ? currentJobId : null;
}

function extractIndeedListingId(parsed: URL) {
  const pathname = normalizePathname(parsed.pathname);
  const lowerPathname = pathname.toLowerCase();
  const jkParam = parsed.searchParams.get("jk") ?? parsed.searchParams.get("vjk");
  const normalizedJk = jkParam?.trim().toLowerCase();

  if (
    lowerPathname.startsWith("/q-") ||
    lowerPathname === "/jobs" ||
    lowerPathname.startsWith("/jobs/") ||
    lowerPathname.startsWith("/m/jobs")
  ) {
    return null;
  }

  if (/^\/(m\/)?viewjob(?:\/|$)/.test(lowerPathname)) {
    return normalizedJk && /^[a-z0-9]+$/.test(normalizedJk) ? normalizedJk : null;
  }

  if (
    /^\/job-detail\//.test(lowerPathname) ||
    /^\/job\//.test(lowerPathname) ||
    /^\/rc\/clk/.test(lowerPathname)
  ) {
    if (normalizedJk && /^[a-z0-9]+$/.test(normalizedJk)) {
      return normalizedJk;
    }

    const lastSegment = lowerPathname.split("/").filter(Boolean).at(-1) ?? "";
    const embeddedId = lastSegment.match(/([a-z0-9]{12,})/)?.[1];

    if (embeddedId) {
      return embeddedId;
    }
  }

  return null;
}

function isLikelySpecificCompanyPosting(parsed: URL) {
  const pathname = normalizePathname(parsed.pathname);
  const lowerPathname = pathname.toLowerCase();
  const segments = lowerPathname.split("/").filter(Boolean);
  const hasDirectJobParam = hasAnyQueryParam(parsed.searchParams, DIRECT_JOB_QUERY_PARAM_KEYS);
  const hasSearchQueryParam = hasAnyQueryParam(parsed.searchParams, GENERIC_SEARCH_QUERY_PARAM_KEYS);

  if (!segments.length) {
    return false;
  }

  if (!hasDirectJobParam && hasSearchQueryParam) {
    return false;
  }

  if (
    segments.includes("search") ||
    segments.includes("results") ||
    lowerPathname.includes("/jobs/search") ||
    lowerPathname.includes("/careers/search")
  ) {
    return false;
  }

  if (segments.length <= 2 && segments.every((segment) => GENERIC_COMPANY_INDEX_SEGMENTS.has(segment))) {
    return hasDirectJobParam;
  }

  const hasNumericId = segments.some((segment) => /\d{4,}/.test(segment));
  const hasUuidLikeId = segments.some((segment) =>
    /^[a-f0-9]{8,}(?:-[a-f0-9]{4,}){2,}$/i.test(segment),
  );
  const hasJobSlug = segments.some((segment) => isJobSlugSegment(segment));
  const hasJobContext = segments.some((segment) =>
    /job|career|position|opening|opportunit|vacanc|requisition|posting|intern|analyst|associate/.test(
      segment,
    ),
  );

  if (hasDirectJobParam || hasNumericId || hasUuidLikeId) {
    return true;
  }

  return hasJobContext && hasJobSlug;
}

function normalizeDirectJobPostingUrl(url: string): NormalizedJobApplyUrl | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.hash = "";
    parsed.pathname = normalizePathname(parsed.pathname);
    deleteTrackingQueryParams(parsed);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) {
      const listingId = extractLinkedInListingId(parsed);

      if (!listingId) {
        return null;
      }

      parsed.hostname = "www.linkedin.com";
      parsed.search = "";

      return {
        normalizedUrl: parsed.toString(),
        sourceSite: "LinkedIn",
        sourceKind: "linkedin",
        identityKey: `linkedin:${listingId}`,
        listingId,
      };
    }

    if (hostname === "indeed.com" || hostname.endsWith(".indeed.com")) {
      const listingId = extractIndeedListingId(parsed);

      if (!listingId) {
        return null;
      }

      const filtered = new URLSearchParams();

      if (parsed.searchParams.get("jk")) {
        filtered.set("jk", parsed.searchParams.get("jk") ?? "");
      } else if (parsed.searchParams.get("vjk")) {
        filtered.set("vjk", parsed.searchParams.get("vjk") ?? "");
      }

      parsed.hostname = "www.indeed.com";
      parsed.search = filtered.toString() ? `?${filtered.toString()}` : "";

      return {
        normalizedUrl: parsed.toString(),
        sourceSite: "Indeed",
        sourceKind: "indeed",
        identityKey: `indeed:${listingId}`,
        listingId,
      };
    }

    if (!isLikelySpecificCompanyPosting(parsed)) {
      return null;
    }

    const sorted = sortSearchParams(parsed.searchParams);
    parsed.search = sorted.toString() ? `?${sorted.toString()}` : "";

    return {
      normalizedUrl: parsed.toString(),
      sourceSite: "Company Careers",
      sourceKind: "company",
      identityKey: `company:${hostname}:${normalizePathname(parsed.pathname).toLowerCase()}:${parsed.search.toLowerCase()}`,
      listingId: null,
    };
  } catch {
    return null;
  }
}

function hasConfiguredRapidApiKey() {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();

  return Boolean(apiKey && !apiKey.includes("your_rapidapi_key_here"));
}

function getRapidApiKey() {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();

  if (!hasConfiguredRapidApiKey() || !apiKey) {
    throw new JobSearchUnavailableError();
  }

  return apiKey;
}

function hasConfiguredOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  return Boolean(apiKey && !apiKey.includes("<paste-"));
}

function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!hasConfiguredOpenAIApiKey() || !apiKey) {
    throw new JobSearchUnavailableError();
  }

  return apiKey;
}

function createConcurrencyLimiter(limit: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  async function acquire() {
    if (activeCount >= limit) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
      return;
    }

    activeCount += 1;
  }

  function release() {
    const next = queue.shift();

    if (next) {
      next();
      return;
    }

    activeCount -= 1;
  }

  return async function runWithLimit<T>(task: () => Promise<T>) {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}

const runFallbackSearchWithLimit = createConcurrencyLimiter(FALLBACK_SEARCH_CONCURRENCY);
const runLinkedInDetailFetchWithLimit = createConcurrencyLimiter(
  LINKEDIN_DETAIL_FETCH_CONCURRENCY,
);

function mergeSearchSources(sources: JobSearchSource[]) {
  const normalized = unique(
    sources.filter((source): source is Exclude<JobSearchSource, "none"> => source !== "none"),
  );

  if (!normalized.length) {
    return "none" satisfies JobSearchSource;
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  return "mixed" satisfies JobSearchSource;
}

function getSourceUnavailableReason(
  sawJSearchUnavailable: boolean,
  sawFallbackUnavailable: boolean,
) {
  if (sawJSearchUnavailable && sawFallbackUnavailable) {
    return "all_sources_unavailable" satisfies JobSearchReason;
  }

  if (sawFallbackUnavailable) {
    return "fallback_unavailable" satisfies JobSearchReason;
  }

  return "jsearch_unavailable" satisfies JobSearchReason;
}

function isFallbackUnavailableError(error: unknown) {
  if (error instanceof JobSearchUnavailableError || error instanceof OpenAI.APIError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    /timed out|timeout|network|fetch failed/i.test(error.message)
  );
}

function combineJobSearchResults(results: JobSearchResult[]): JobSearchResult {
  const successfulResults = results.filter((result) => result.status !== "source_unavailable");
  const readyPostings = successfulResults.flatMap((result) => result.postings);

  if (readyPostings.length) {
    return {
      postings: prioritizePostings(dedupePostings(readyPostings)).slice(0, CATEGORY_TARGET_COUNT),
      status: "ready",
      source: mergeSearchSources(successfulResults.map((result) => result.source)),
      reason: null,
    };
  }

  if (successfulResults.length) {
    return {
      postings: [],
      status: "empty",
      source: mergeSearchSources(successfulResults.map((result) => result.source)),
      reason: "no_active_postings",
    };
  }

  const sawJSearchUnavailable = results.some(
    (result) =>
      result.reason === "jsearch_unavailable" || result.reason === "all_sources_unavailable",
  );
  const sawFallbackUnavailable = results.some(
    (result) =>
      result.reason === "fallback_unavailable" || result.reason === "all_sources_unavailable",
  );

  return {
    postings: [],
    status: "source_unavailable",
    source: "none",
    reason: getSourceUnavailableReason(sawJSearchUnavailable, sawFallbackUnavailable),
  };
}

function buildJobSearchCacheKey(options: JSearchSearchOptions) {
  return `signal:jsearch:${JOB_CACHE_VERSION}:${JSON.stringify({
    query: options.query.trim().toLowerCase(),
    location: options.location?.trim().toLowerCase() ?? "",
    industry: options.industry?.trim().toLowerCase() ?? "",
    companySize: options.companySize?.trim().toLowerCase() ?? "",
    employmentType: options.employmentType?.trim().toLowerCase() ?? "",
    remoteOnly: Boolean(options.remoteOnly),
    allowFallback: options.allowFallback !== false,
  })}`;
}

function inferEmploymentType(query: string) {
  return /\bintern|internship|co-?op|apprentice|fellowship|student\b/i.test(query)
    ? "INTERN"
    : "FULLTIME";
}

function mapCompanyType(companySize: string | null | undefined) {
  if (!companySize || companySize === "Any") {
    return undefined;
  }

  if (companySize.startsWith("Startup")) {
    return "startup";
  }

  if (companySize.startsWith("Small")) {
    return "small_business";
  }

  if (companySize.startsWith("Mid-size")) {
    return "medium_business";
  }

  if (companySize.startsWith("Large")) {
    return "enterprise";
  }

  return undefined;
}

function buildRoleSearchQuery(request: RoleSearchRequest) {
  const parts = [request.query.trim()];
  const location = request.location.trim();

  if (location) {
    if (/remote/i.test(location)) {
      parts.push("remote");
    } else {
      parts.push(`in ${location}`);
    }
  }

  if (request.industry !== "Any") {
    parts.push(request.industry);
  }

  if (request.company_size !== "Any") {
    const sizeHint =
      request.company_size.startsWith("Startup")
        ? "startup"
        : request.company_size.startsWith("Small")
          ? "small company"
          : request.company_size.startsWith("Mid-size")
            ? "mid size company"
            : "large company";
    parts.push(sizeHint);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function buildCategoryQueryVariants(categoryTitle: string) {
  const normalized = categoryTitle
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const variants = new Set<string>();
  const cleaned = normalized.replace(/[,:]/g, " ").replace(/\s+/g, " ").trim();

  if (cleaned) {
    variants.add(cleaned);
  }

  const withoutModifiers = cleaned
    .replace(/\b(advisory|strategy|analytics|analysis|consulting|operations|insights|advisor)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutModifiers) {
    variants.add(withoutModifiers);
  }

  const topicalWords = cleaned
    .split(/\s+/)
    .filter(
      (word) =>
        !/^(intern|internship|analyst|associate|specialist|consultant|coordinator|advisor|advisory|strategy|analytics|analysis|consulting|operations|insights)$/i.test(
          word,
        ),
    )
    .slice(0, 3);

  if (topicalWords.length) {
    if (/\bintern|internship\b/i.test(cleaned)) {
      variants.add(`${topicalWords.join(" ")} Intern`);
    }

    if (/\banalyst\b/i.test(cleaned)) {
      variants.add(`${topicalWords.join(" ")} Analyst`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

function buildBroaderCategoryQueryVariants(categoryTitle: string) {
  const broaderTitle = categoryTitle
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:spring|summer|fall|winter)\b/gi, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return buildCategoryQueryVariants(broaderTitle);
}

function buildLinkedInGuestSearchUrl(options: JSearchSearchOptions, start = 0) {
  const url = new URL(LINKEDIN_GUEST_SEARCH_ENDPOINT);
  const keywords = [options.query.trim(), options.industry && options.industry !== "Any" ? options.industry : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  url.searchParams.set("keywords", keywords || options.query.trim());

  if (options.location?.trim()) {
    url.searchParams.set("location", options.location.trim());
  }

  if (options.remoteOnly) {
    url.searchParams.set("f_WT", "2");
  }

  url.searchParams.set("start", String(start));

  return url.toString();
}

function parseLinkedInGuestSearchCards(
  html: string,
  fallbackLocationLabel = "Location not listed",
) {
  const items = Array.from(html.matchAll(/<li>([\s\S]*?)<\/li>/gi)).slice(
    0,
    CATEGORY_TARGET_COUNT,
  );
  const cards: LinkedInGuestSearchCard[] = [];

  for (const [, itemHtml = ""] of items) {
    const jobId = itemHtml.match(/jobPosting:(\d{6,})/i)?.[1];
    const applyUrl = decodeHtmlEntities(
      itemHtml.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"]+)"/i)?.[1] ?? "",
    );
    const normalizedApplyUrl = normalizeDirectJobPostingUrl(applyUrl);

    if (!jobId || !normalizedApplyUrl || normalizedApplyUrl.sourceKind !== "linkedin") {
      continue;
    }

    const roleTitle =
      extractFirstMatch(itemHtml, /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
      extractFirstMatch(itemHtml, /<span[^>]*class="sr-only"[^>]*>([\s\S]*?)<\/span>/i);
    const companyName = extractFirstMatch(
      itemHtml,
      /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i,
    );
    const location = extractFirstMatch(
      itemHtml,
      /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const companyLogo =
      decodeHtmlEntities(
        itemHtml.match(/data-delayed-url="(https:\/\/[^"]+)"/i)?.[1] ??
          itemHtml.match(/src="(https:\/\/[^"]+)"/i)?.[1] ??
          "",
      ) || null;
    const postedAt = normalizeText(itemHtml.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] ?? "");

    if (!roleTitle || !companyName) {
      continue;
    }

    cards.push({
      jobId,
      roleTitle,
      companyName,
      companyLogo,
      location: location || fallbackLocationLabel,
      applyUrl: normalizedApplyUrl.normalizedUrl,
      postedAt: postedAt || null,
    });
  }

  const seen = new Set<string>();

  return cards.filter((card) => {
    const key = `${card.jobId}:${card.applyUrl}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractMonthsFromText(text: string) {
  const yearMatch = text.match(/(\d+)\+?\s*(?:years|year|yrs|yr)\b/i);

  if (yearMatch) {
    return Number(yearMatch[1]) * 12;
  }

  const monthMatch = text.match(/(\d+)\+?\s*months?\b/i);

  if (monthMatch) {
    return Number(monthMatch[1]);
  }

  return null;
}

function inferEducationRequirementsFromText(text: string) {
  const normalized = text.toLowerCase();

  return {
    postgraduate_degree: /\b(master'?s|mba|ph\.?d|doctorate|postgraduate)\b/.test(normalized),
    professional_certification: /\b(certification|cpa|cfa|pmp)\b/.test(normalized),
    high_school: /\bhigh school\b/.test(normalized),
    associates_degree: /\bassociate'?s\b/.test(normalized),
    bachelors_degree: /\b(bachelor'?s|undergraduate|college degree)\b/.test(normalized),
  };
}

function extractSkillsFromDescription(text: string) {
  return COMMON_SKILL_PATTERNS.filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label)
    .slice(0, 8);
}

function extractQualificationLines(text: string) {
  const lines = unique(
    text
      .split(/\n+/)
      .map((line) => normalizeText(line.replace(/^[-*•]\s*/, "")))
      .filter((line) => line.length >= 18),
  );
  const preferred = lines.filter((line) =>
    /\b(qualif|require|experience|skill|degree|proficien|ability|knowledge|background|understanding)\b/i.test(
      line,
    ),
  );

  return (preferred.length ? preferred : lines).slice(0, 5);
}

function extractResponsibilityLines(text: string) {
  const lines = unique(
    text
      .split(/\n+/)
      .map((line) => normalizeText(line.replace(/^[-*•]\s*/, "")))
      .filter((line) => line.length >= 18),
  );

  return lines
    .filter((line) =>
      /\b(build|support|analyz|develop|manage|create|prepare|coordinate|lead|partner|deliver|track|report)\b/i.test(
        line,
      ),
    )
    .slice(0, 5);
}

async function fetchLinkedInText(url: string) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new JobSearchUnavailableError();
  }

  return response.text();
}

async function fetchLinkedInGuestSearchCards(options: JSearchSearchOptions) {
  const html = await fetchLinkedInText(
    buildLinkedInGuestSearchUrl(
      options,
      0,
    ),
  );

  return parseLinkedInGuestSearchCards(
    html,
    options.remoteOnly ? "Remote" : "Location not listed",
  );
}

function extractLinkedInCriteria(detailHtml: string) {
  return Array.from(
    detailHtml.matchAll(
      /<li[^>]*class="[^"]*description__job-criteria-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
    ),
  ).reduce<Record<string, string>>((criteria, [, itemHtml = ""]) => {
    const key = extractFirstMatch(
      itemHtml,
      /<h3[^>]*class="[^"]*description__job-criteria-subheader[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
    ).toLowerCase();
    const value = extractFirstMatch(
      itemHtml,
      /<span[^>]*class="[^"]*description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );

    if (key && value) {
      criteria[key] = value;
    }

    return criteria;
  }, {});
}

async function fetchLinkedInGuestJobPosting(
  card: LinkedInGuestSearchCard,
  options: JSearchSearchOptions,
): Promise<RolePosting> {
  const detailHtml = await fetchLinkedInText(
    `${LINKEDIN_GUEST_JOB_POSTING_ENDPOINT}/${card.jobId}`,
  );
  const descriptionHtml =
    detailHtml.match(
      /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? "";
  const description = stripHtml(descriptionHtml);
  const criteria = extractLinkedInCriteria(detailHtml);
  const qualificationLines = extractQualificationLines(description);
  const responsibilityLines = extractResponsibilityLines(description);
  const requiredSkills = extractSkillsFromDescription(description);
  const keyRequirements =
    unique([...qualificationLines.slice(0, 4), ...requiredSkills]).slice(0, 4).length
      ? unique([...qualificationLines.slice(0, 4), ...requiredSkills]).slice(0, 4)
      : extractRequirementFallback(description);
  const normalizedApplyUrl = normalizeDirectJobPostingUrl(card.applyUrl);

  if (!normalizedApplyUrl || normalizedApplyUrl.sourceKind !== "linkedin") {
    throw new JobSearchUnavailableError();
  }

  return {
    job_id: card.jobId,
    role_title: card.roleTitle,
    company_name: card.companyName,
    company_logo: card.companyLogo,
    location: card.location,
    apply_url: normalizedApplyUrl.normalizedUrl,
    key_requirements:
      keyRequirements.length > 0
        ? keyRequirements
        : ["See the full LinkedIn posting for requirements"],
    industry: inferIndustryLabel(
      `${options.query} ${card.roleTitle} ${card.companyName} ${description}`,
      options.industry,
    ),
    company_size:
      options.companySize && options.companySize !== "Any"
        ? options.companySize
        : "Could not verify",
    job_description: description,
    required_skills: requiredSkills,
    qualifications: qualificationLines,
    responsibilities: responsibilityLines,
    benefits: [],
    experience_months: extractMonthsFromText(`${criteria["seniority level"] ?? ""} ${description}`),
    no_experience_required: /\bno experience required\b/i.test(description),
    education_requirements: inferEducationRequirementsFromText(description),
    is_remote: /remote/i.test(card.location) || /\bremote\b/i.test(description),
    posted_at: card.postedAt,
    source_site: "LinkedIn",
    employment_type:
      normalizeText(criteria["employment type"]) ||
      options.employmentType ||
      inferEmploymentType(options.query),
  };
}

async function searchLinkedInGuestJobs(options: JSearchSearchOptions): Promise<RolePosting[]> {
  const cards = await fetchLinkedInGuestSearchCards(options);

  if (!cards.length) {
    return [];
  }

  const settled = await Promise.allSettled(
    cards.slice(0, CATEGORY_TARGET_COUNT).map((card) =>
      runLinkedInDetailFetchWithLimit(() => fetchLinkedInGuestJobPosting(card, options)),
    ),
  );

  return dedupePostings(
    settled
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        const card = cards[index];
        const normalizedApplyUrl = normalizeDirectJobPostingUrl(card.applyUrl);

        if (!card || !normalizedApplyUrl || normalizedApplyUrl.sourceKind !== "linkedin") {
          return null;
        }

        return {
          job_id: card.jobId,
          role_title: card.roleTitle,
          company_name: card.companyName,
          company_logo: card.companyLogo,
          location: card.location,
          apply_url: normalizedApplyUrl.normalizedUrl,
          key_requirements: ["See the full LinkedIn posting for requirements"],
          industry: inferIndustryLabel(`${options.query} ${card.roleTitle}`, options.industry),
          company_size:
            options.companySize && options.companySize !== "Any"
              ? options.companySize
              : "Could not verify",
          job_description: "",
          required_skills: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
          experience_months: null,
          no_experience_required: false,
          education_requirements: {
            postgraduate_degree: false,
            professional_certification: false,
            high_school: false,
            associates_degree: false,
            bachelors_degree: false,
          },
          is_remote: /remote/i.test(card.location),
          posted_at: card.postedAt,
          source_site: "LinkedIn",
          employment_type: options.employmentType || inferEmploymentType(options.query),
        } satisfies RolePosting;
      })
      .filter((posting): posting is RolePosting => Boolean(posting)),
  ).slice(0, CATEGORY_TARGET_COUNT);
}

function inferIndustryLabel(text: string, fallback?: string | null) {
  if (fallback && fallback !== "Any") {
    return fallback;
  }

  const normalized = text.toLowerCase();

  if (/\besg\b|\bsustainability\b|\bclimate\b|\bcarbon\b|\benergy\b/.test(normalized)) {
    return "Energy";
  }

  if (/\bconsulting\b|\badvisory\b|\bstrategy\b|\bclient\b/.test(normalized)) {
    return "Consulting";
  }

  if (/\bsoftware\b|\bproduct\b|\bdata\b|\bai\b|\bmachine learning\b|\bcloud\b/.test(normalized)) {
    return "Tech";
  }

  if (/\bfinancial\b|\bfinance\b|\binvestment\b|\baccounting\b|\baudit\b/.test(normalized)) {
    return "Finance";
  }

  if (/\bhealth\b|\bclinical\b|\bmedical\b|\bbiotech\b/.test(normalized)) {
    return "Healthcare";
  }

  if (/\bgovernment\b|\bpublic sector\b|\bpolicy\b/.test(normalized)) {
    return "Government";
  }

  if (/\bnonprofit\b|\bmission\b|\bcommunity\b/.test(normalized)) {
    return "Nonprofit";
  }

  if (/\bbrand\b|\bconsumer\b|\bretail\b|\bmarketing\b|\becommerce\b/.test(normalized)) {
    return "Consumer Goods";
  }

  return "Other";
}

function normalizeCompanySize(
  rawCompanyType: string | null | undefined,
  requestedCompanySize?: string | null,
) {
  const normalized = rawCompanyType?.toLowerCase() ?? "";

  if (/\bstartup|start-up\b/.test(normalized)) {
    return "Startup (1-50)";
  }

  if (/\bsmall\b/.test(normalized)) {
    return "Small (51-200)";
  }

  if (/\bmedium|mid\b/.test(normalized)) {
    return "Mid-size (201-1000)";
  }

  if (/\benterprise|large\b/.test(normalized)) {
    return "Large (1000+)";
  }

  if (requestedCompanySize && requestedCompanySize !== "Any") {
    return requestedCompanySize;
  }

  return "Could not verify";
}

function buildLocation(job: JSearchJob) {
  if (job.job_is_remote) {
    return "Remote";
  }

  const parts = [job.job_city, job.job_state || job.job_country]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return parts.join(", ") || "Location not listed";
}

function extractRequirementFallback(description: string) {
  return unique(
    description
      .split(/[\n•]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 18)
      .slice(0, 4),
  );
}

function getRequirements(job: JSearchJob) {
  const qualifications = unique(
    (job.job_highlights?.Qualifications ?? []).map((item) => normalizeText(item)).filter(Boolean),
  );
  const requiredSkills = unique(
    (job.job_required_skills ?? []).map((item) => normalizeText(item)).filter(Boolean),
  );

  const combined = unique([...qualifications.slice(0, 4), ...requiredSkills.slice(0, 4)]).slice(
    0,
    4,
  );

  if (combined.length) {
    return {
      keyRequirements: combined,
      qualifications,
      requiredSkills,
    };
  }

  const descriptionFallback = extractRequirementFallback(normalizeText(job.job_description));

  return {
    keyRequirements: descriptionFallback.length
      ? descriptionFallback
      : ["See the full job listing for requirements"],
    qualifications: descriptionFallback,
    requiredSkills,
  };
}

function getSourceSite(applyUrl: string, publisher: string | null | undefined) {
  const normalized = normalizeDirectJobPostingUrl(applyUrl);

  if (normalized) {
    return normalized.sourceSite;
  }

  try {
    const domain = new URL(applyUrl).hostname.replace(/^www\./, "");

    if (domain) {
      return domain;
    }
  } catch {
    // fall through
  }

  return normalizeText(publisher) || "JSearch";
}

function createStableJobId(roleTitle: string, companyName: string, applyUrl: string) {
  const seed = `${roleTitle}|${companyName}|${applyUrl}`.toLowerCase();
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `signal-${hash.toString(36)}`;
}

function withPostingOrigin(postings: RolePosting[], origin: PostingOrigin): SourcedRolePosting[] {
  return postings.map((posting) => ({
    ...posting,
    origin,
  }));
}

function stripPostingOrigins(postings: SourcedRolePosting[]) {
  return postings.map((posting) => {
    const { origin, ...rolePosting } = posting;
    void origin;
    return rolePosting;
  });
}

function getPostingSourcePriority(posting: RolePosting) {
  const normalized = normalizeDirectJobPostingUrl(posting.apply_url);

  if (!normalized) {
    return 3;
  }

  if (normalized.sourceKind === "linkedin" || normalized.sourceKind === "indeed") {
    return 0;
  }

  return 1;
}

function getPostingIdentityKey(posting: RolePosting) {
  const normalized = normalizeDirectJobPostingUrl(posting.apply_url);

  if (normalized?.listingId) {
    return `job:${normalizeIdentityText(normalized.listingId)}`;
  }

  const normalizedJobId = normalizeIdentityText(posting.job_id);

  if (normalizedJobId) {
    return `job:${normalizedJobId}`;
  }

  if (normalized) {
    try {
      const parsed = new URL(normalized.normalizedUrl);
      const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
      const path = normalizePathname(parsed.pathname).toLowerCase();

      return `fallback:${normalizeIdentityText(posting.role_title)}:${normalizeIdentityText(posting.company_name)}:${hostname}:${path}`;
    } catch {
      return normalized.identityKey;
    }
  }

  try {
    const parsed = new URL(posting.apply_url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = normalizePathname(parsed.pathname).toLowerCase();

    return `fallback:${normalizeIdentityText(posting.role_title)}:${normalizeIdentityText(posting.company_name)}:${hostname}:${path}`;
  } catch {
    return `fallback:${normalizeIdentityText(posting.role_title)}:${normalizeIdentityText(posting.company_name)}:${normalizeIdentityText(posting.apply_url)}`;
  }
}

function dedupePostings<T extends RolePosting>(postings: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const posting of postings) {
    const identityKey = getPostingIdentityKey(posting);

    if (seen.has(identityKey)) {
      continue;
    }

    seen.add(identityKey);
    deduped.push(posting);
  }

  return deduped;
}

function prioritizePostings<T extends RolePosting>(postings: T[]) {
  return [...postings].sort((left, right) => {
    const sourcePriorityDifference =
      getPostingSourcePriority(left) - getPostingSourcePriority(right);

    if (sourcePriorityDifference !== 0) {
      return sourcePriorityDifference;
    }

    return normalizeIdentityText(left.role_title).localeCompare(
      normalizeIdentityText(right.role_title),
    );
  });
}

function buildApplyLinkProbeCacheKey(url: string, verdict: "active" | "inactive") {
  return `signal:apply-link-probe:${LINK_PROBE_CACHE_VERSION}:${verdict}:${url}`;
}

function getCachedApplyLinkVerdict(url: string) {
  const activeCacheKey = buildApplyLinkProbeCacheKey(url, "active");
  const inactiveCacheKey = buildApplyLinkProbeCacheKey(url, "inactive");
  const activeCached = getRuntimeCacheValue<true>(activeCacheKey, ACTIVE_LINK_PROBE_CACHE_TTL_MS);

  if (activeCached === true) {
    return true;
  }

  const inactiveCached = getRuntimeCacheValue<true>(
    inactiveCacheKey,
    INACTIVE_LINK_PROBE_CACHE_TTL_MS,
  );

  if (inactiveCached === true) {
    return false;
  }

  return null;
}

function setCachedApplyLinkVerdict(urls: string[], isActive: boolean) {
  for (const url of urls) {
    const activeCacheKey = buildApplyLinkProbeCacheKey(url, "active");
    const inactiveCacheKey = buildApplyLinkProbeCacheKey(url, "inactive");

    if (isActive) {
      deleteRuntimeCacheValue(inactiveCacheKey);
      setRuntimeCacheValue(activeCacheKey, true);
      continue;
    }

    deleteRuntimeCacheValue(activeCacheKey);
    setRuntimeCacheValue(inactiveCacheKey, true);
  }
}

function shouldInspectProbeBody(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  return (
    !contentType ||
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
  );
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    /aborted|timed out|timeout/i.test(error.message)
  );
}

function hasInactivePostingSignal(
  body: string,
  sourceKind: NormalizedJobApplyUrl["sourceKind"],
) {
  const sourceSpecificPatterns =
    sourceKind === "linkedin"
      ? [...COMMON_INACTIVE_POSTING_PATTERNS, ...REMOVED_LINKEDIN_PAGE_PATTERNS]
      : sourceKind === "indeed"
        ? [...COMMON_INACTIVE_POSTING_PATTERNS, ...INDEED_INACTIVE_POSTING_PATTERNS]
        : [...COMMON_INACTIVE_POSTING_PATTERNS, ...COMPANY_INACTIVE_POSTING_PATTERNS];

  return sourceSpecificPatterns.some((pattern) => pattern.test(body));
}

async function validatePostingLink(
  posting: SourcedRolePosting,
): Promise<PostingValidationResult> {
  const normalizedApplyUrl = normalizeDirectJobPostingUrl(posting.apply_url);

  if (!normalizedApplyUrl) {
    return {
      posting,
      isActive: false,
      reason: "invalid_url",
    };
  }

  const cachedVerdict = getCachedApplyLinkVerdict(normalizedApplyUrl.normalizedUrl);

  if (cachedVerdict !== null) {
    return {
      posting: {
        ...posting,
        apply_url: normalizedApplyUrl.normalizedUrl,
        source_site: normalizedApplyUrl.sourceSite,
      },
      isActive: cachedVerdict,
      reason: cachedVerdict ? undefined : "inactive_page",
    };
  }

  if (normalizedApplyUrl.sourceKind !== "company") {
    setCachedApplyLinkVerdict([normalizedApplyUrl.normalizedUrl], true);

    return {
      posting: {
        ...posting,
        apply_url: normalizedApplyUrl.normalizedUrl,
        source_site: normalizedApplyUrl.sourceSite,
      },
      isActive: true,
    };
  }

  let response: Response;

  try {
    response = await fetch(normalizedApplyUrl.normalizedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(APPLY_LINK_PROBE_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
  } catch (error) {
    setCachedApplyLinkVerdict([normalizedApplyUrl.normalizedUrl], false);

    return {
      posting: {
        ...posting,
        apply_url: normalizedApplyUrl.normalizedUrl,
        source_site: normalizedApplyUrl.sourceSite,
      },
      isActive: false,
      reason: isTimeoutError(error) ? "timeout" : "network_error",
    };
  }

  if (response.status >= 400) {
    setCachedApplyLinkVerdict([normalizedApplyUrl.normalizedUrl], false);

    return {
      posting: {
        ...posting,
        apply_url: normalizedApplyUrl.normalizedUrl,
        source_site: normalizedApplyUrl.sourceSite,
      },
      isActive: false,
      reason: "http_error",
    };
  }

  const finalUrl = response.url || normalizedApplyUrl.normalizedUrl;
  const finalNormalizedUrl = normalizeDirectJobPostingUrl(finalUrl);

  if (!finalNormalizedUrl) {
    setCachedApplyLinkVerdict([normalizedApplyUrl.normalizedUrl], false);

    return {
      posting: {
        ...posting,
        apply_url: normalizedApplyUrl.normalizedUrl,
        source_site: normalizedApplyUrl.sourceSite,
      },
      isActive: false,
      reason: "redirected_to_invalid_page",
    };
  }

  if (!shouldInspectProbeBody(response)) {
    setCachedApplyLinkVerdict(
      [normalizedApplyUrl.normalizedUrl, finalNormalizedUrl.normalizedUrl],
      true,
    );

    return {
      posting: {
        ...posting,
        apply_url: finalNormalizedUrl.normalizedUrl,
        source_site: finalNormalizedUrl.sourceSite,
      },
      isActive: true,
    };
  }

  const body = (await response.text().catch(() => "")).slice(0, APPLY_LINK_PROBE_MAX_BODY_CHARS);

  if (hasInactivePostingSignal(body, finalNormalizedUrl.sourceKind)) {
    setCachedApplyLinkVerdict(
      [normalizedApplyUrl.normalizedUrl, finalNormalizedUrl.normalizedUrl],
      false,
    );

    return {
      posting: {
        ...posting,
        apply_url: finalNormalizedUrl.normalizedUrl,
        source_site: finalNormalizedUrl.sourceSite,
      },
      isActive: false,
      reason: "inactive_page",
    };
  }

  setCachedApplyLinkVerdict(
    [normalizedApplyUrl.normalizedUrl, finalNormalizedUrl.normalizedUrl],
    true,
  );

  return {
    posting: {
      ...posting,
      apply_url: finalNormalizedUrl.normalizedUrl,
      source_site: finalNormalizedUrl.sourceSite,
    },
    isActive: true,
  };
}

function logValidationStats(context: string, results: PostingValidationResult[]) {
  for (const origin of ["jsearch", "fallback"] as const) {
    const originResults = results.filter((result) => result.posting.origin === origin);

    if (!originResults.length) {
      continue;
    }

    const rejectedCount = originResults.filter((result) => !result.isActive).length;
    const rejectionRate = rejectedCount / originResults.length;

    if (origin === "jsearch" && rejectionRate < 0.1) {
      console.info(
        `[Signal jobs] JSearch validation healthy for ${context}: ${rejectedCount}/${originResults.length} rejected (${Math.round(rejectionRate * 100)}%).`,
      );
    }

    if (origin === "jsearch" && rejectionRate > 0.3) {
      const reasonBreakdown = originResults
        .filter((result) => !result.isActive)
        .reduce<Record<string, number>>((accumulator, result) => {
          const key = result.reason ?? "unknown";
          accumulator[key] = (accumulator[key] ?? 0) + 1;
          return accumulator;
        }, {});

      console.warn(
        `[Signal jobs] High JSearch rejection rate for ${context}: ${rejectedCount}/${originResults.length} rejected (${Math.round(rejectionRate * 100)}%).`,
        reasonBreakdown,
      );
    }
  }
}

async function keepLiveDirectPostingLinks(
  postings: SourcedRolePosting[],
  context: string,
) {
  const settledResults = await Promise.allSettled(
    postings.map((posting) => validatePostingLink(posting)),
  );
  const validationResults = settledResults.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : ({
          posting: postings[index],
          isActive: false,
          reason: "network_error",
        } satisfies PostingValidationResult),
  );

  logValidationStats(context, validationResults);

  return validationResults
    .filter((result) => result.isActive)
    .map((result) => result.posting);
}

function parsePreferredBoardSearch(output: string) {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(sanitizeGeneratedJsonText(output));
  } catch {
    throw new InvalidPreferredBoardSearchError("OpenAI returned invalid JSON.");
  }

  const parsed = preferredBoardSearchSchema.safeParse(sanitizeGeneratedContent(parsedJson));

  if (!parsed.success) {
    throw new InvalidPreferredBoardSearchError("OpenAI returned an invalid posting shape.");
  }

  return dedupePostings(
    parsed.data.postings
      .map((posting) => {
        const normalizedApplyUrl = normalizeDirectJobPostingUrl(posting.apply_url);

        if (!normalizedApplyUrl || normalizedApplyUrl.sourceKind === "company") {
          return null;
        }

        const normalizedJobId = normalizeText(posting.job_id);

        return {
          ...posting,
          job_id:
            normalizedApplyUrl.listingId ||
            normalizedJobId ||
            createStableJobId(
              posting.role_title,
              posting.company_name,
              normalizedApplyUrl.normalizedUrl,
            ),
          apply_url: normalizedApplyUrl.normalizedUrl,
          source_site: normalizedApplyUrl.sourceSite,
        };
      })
      .filter((posting): posting is RolePosting => Boolean(posting)),
  );
}

function buildPreferredBoardSearchPrompt(options: JSearchSearchOptions) {
  const employmentType = options.employmentType || inferEmploymentType(options.query);
  const remotePreference = options.remoteOnly ? "Remote only" : "Remote or on-site";
  const industry = options.industry && options.industry !== "Any" ? options.industry : "Any";
  const companySize =
    options.companySize && options.companySize !== "Any" ? options.companySize : "Any";

  return `Find live U.S. job listings for this search:

Search query: ${options.query}
Employment type: ${employmentType}
Industry filter: ${industry}
Company size filter: ${companySize}
Remote preference: ${remotePreference}

Search instructions:
- Only return LinkedIn and Indeed direct listing URLs.
- Never return search-result URLs, including patterns like Indeed /q-..., Indeed /jobs?... or LinkedIn /jobs/search....
- Never return generic careers index pages. Return only a direct posting page.
- Each apply_url must be the exact listing URL for that same job card.
- Prefer active listings posted recently.
- Exclude any posting that appears closed, expired, removed, unavailable, or no longer accepting applications.
- Return up to 10 postings.
- If a result is not clearly the listing page itself, exclude it.

Return only valid JSON.`;
}

async function searchPreferredBoardsWithOpenAI(
  options: JSearchSearchOptions,
): Promise<RolePosting[]> {
  const client = new OpenAI({ apiKey: getOpenAIApiKey() });
  let lastError: unknown;

  for (const strategy of preferredBoardSearchStrategies) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.responses.create(
          {
            model: strategy.model,
            input: [
              {
                role: "system",
                content: `You are Signal's live role search engine.

RULES:
- Only return LinkedIn and Indeed direct listings.
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Each posting must include a direct listing URL in apply_url.
- apply_url must open the same job posting represented by the returned title and company.
- Do not return search-result URLs, including Indeed /q-..., Indeed /jobs?... or LinkedIn /jobs/search....
- Do not return generic careers index pages or query pages.
- Exclude postings that appear closed, expired, removed, unavailable, or no longer accepting applications.
- key_requirements should summarize 3-4 qualifications from the listing.
- required_skills should list explicit skills from the listing when available.
- qualifications should come from the listing.
- responsibilities should come from the listing.
- benefits can be empty if unavailable.
- company_size can be "Could not verify" if needed.
- company_logo can be null if unavailable.
- education_requirements must use booleans.
- experience_months can be null if not clear.
- no_experience_required should only be true when the listing makes that clear.
- source_site should be "LinkedIn" or "Indeed".
- Return only valid JSON matching the schema.`,
              },
              {
                role: "user",
                content: buildPreferredBoardSearchPrompt(options),
              },
            ],
            tools: [...strategy.tools],
            include: ["web_search_call.action.sources"],
            text: {
              format: {
                type: "json_schema",
                name: "preferred_board_role_search",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["postings"],
                  properties: {
                    postings: {
                      type: "array",
                      minItems: 0,
                      maxItems: 10,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: [
                          "job_id",
                          "role_title",
                          "company_name",
                          "company_logo",
                          "location",
                          "apply_url",
                          "key_requirements",
                          "industry",
                          "company_size",
                          "job_description",
                          "required_skills",
                          "qualifications",
                          "responsibilities",
                          "benefits",
                          "experience_months",
                          "no_experience_required",
                          "education_requirements",
                          "is_remote",
                          "posted_at",
                          "source_site",
                          "employment_type",
                        ],
                        properties: {
                          job_id: { type: "string" },
                          role_title: { type: "string" },
                          company_name: { type: "string" },
                          company_logo: { type: ["string", "null"] },
                          location: { type: "string" },
                          apply_url: { type: "string" },
                          key_requirements: {
                            type: "array",
                            minItems: 1,
                            maxItems: 5,
                            items: { type: "string" },
                          },
                          industry: { type: "string" },
                          company_size: { type: "string" },
                          job_description: { type: "string" },
                          required_skills: {
                            type: "array",
                            items: { type: "string" },
                          },
                          qualifications: {
                            type: "array",
                            items: { type: "string" },
                          },
                          responsibilities: {
                            type: "array",
                            items: { type: "string" },
                          },
                          benefits: {
                            type: "array",
                            items: { type: "string" },
                          },
                          experience_months: { type: ["integer", "null"] },
                          no_experience_required: { type: "boolean" },
                          education_requirements: {
                            type: "object",
                            additionalProperties: false,
                            required: [
                              "postgraduate_degree",
                              "professional_certification",
                              "high_school",
                              "associates_degree",
                              "bachelors_degree",
                            ],
                            properties: {
                              postgraduate_degree: { type: "boolean" },
                              professional_certification: { type: "boolean" },
                              high_school: { type: "boolean" },
                              associates_degree: { type: "boolean" },
                              bachelors_degree: { type: "boolean" },
                            },
                          },
                          is_remote: { type: "boolean" },
                          posted_at: { type: ["string", "null"] },
                          source_site: { type: "string" },
                          employment_type: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          {
            signal: AbortSignal.timeout(45_000),
          },
        );

        if (!response.output_text) {
          throw new InvalidPreferredBoardSearchError("OpenAI returned an empty response.");
        }

        return parsePreferredBoardSearch(response.output_text.trim()).slice(0, 10);
      } catch (error) {
        lastError = error;

        const isSchemaError = error instanceof InvalidPreferredBoardSearchError;
        const isCompatibilityError =
          error instanceof OpenAI.APIError &&
          (error.status === 400 || error.status === 404);

        if (isSchemaError && attempt === 0) {
          continue;
        }

        if (isCompatibilityError) {
          break;
        }

        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new JobSearchUnavailableError();
}

async function searchPreferredBoardsWithRetry(
  options: JSearchSearchOptions,
): Promise<RolePosting[]> {
  if (!hasConfiguredOpenAIApiKey()) {
    throw new JobSearchUnavailableError();
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < FALLBACK_SEARCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runFallbackSearchWithLimit(() => searchPreferredBoardsWithOpenAI(options));
    } catch (error) {
      lastError = error;

      if (attempt < FALLBACK_SEARCH_MAX_ATTEMPTS - 1 && isFallbackUnavailableError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new JobSearchUnavailableError();
}

function mapJSearchJobToPosting(
  job: JSearchJob,
  options: JSearchSearchOptions,
): RolePosting | null {
  const normalizedApplyUrl = normalizeDirectJobPostingUrl(normalizeText(job.job_apply_link));

  if (!normalizedApplyUrl || normalizedApplyUrl.sourceKind === "company") {
    return null;
  }

  const description = normalizeText(job.job_description);
  const { keyRequirements, qualifications, requiredSkills } = getRequirements(job);

  return {
    job_id:
      normalizedApplyUrl.listingId ||
      normalizeText(job.job_id) ||
      createStableJobId(
        normalizeText(job.job_title),
        normalizeText(job.employer_name),
        normalizedApplyUrl.normalizedUrl,
      ),
    role_title: normalizeText(job.job_title),
    company_name: normalizeText(job.employer_name),
    company_logo: job.employer_logo ?? null,
    location: buildLocation(job),
    apply_url: normalizedApplyUrl.normalizedUrl,
    key_requirements: keyRequirements,
    industry: inferIndustryLabel(
      `${job.job_title} ${description} ${qualifications.join(" ")} ${requiredSkills.join(" ")}`,
      options.industry,
    ),
    company_size: normalizeCompanySize(job.employer_company_type, options.companySize),
    job_description: description,
    required_skills: requiredSkills,
    qualifications,
    responsibilities: unique(
      (job.job_highlights?.Responsibilities ?? [])
        .map((item) => normalizeText(item))
        .filter(Boolean),
    ).slice(0, 5),
    benefits: unique(
      (job.job_highlights?.Benefits ?? []).map((item) => normalizeText(item)).filter(Boolean),
    ).slice(0, 5),
    experience_months: job.job_required_experience?.required_experience_in_months ?? null,
    no_experience_required: job.job_required_experience?.no_experience_required ?? false,
    education_requirements: {
      postgraduate_degree: job.job_required_education?.postgraduate_degree ?? false,
      professional_certification:
        job.job_required_education?.professional_certification ?? false,
      high_school: job.job_required_education?.high_school ?? false,
      associates_degree: job.job_required_education?.associates_degree ?? false,
      bachelors_degree: job.job_required_education?.bachelors_degree ?? false,
    },
    is_remote: job.job_is_remote ?? false,
    posted_at: job.job_posted_at_datetime_utc ?? null,
    source_site: getSourceSite(normalizedApplyUrl.normalizedUrl, job.job_publisher),
    employment_type:
      normalizeText(job.job_employment_type) || options.employmentType || inferEmploymentType(options.query),
  };
}

async function fetchJSearchResults(options: JSearchSearchOptions): Promise<RolePosting[]> {
  const apiKey = getRapidApiKey();
  const params = new URLSearchParams({
    query: options.query,
    page: "1",
    num_pages: "1",
    country: "us",
    date_posted: "month",
    employment_types: options.employmentType || inferEmploymentType(options.query),
  });

  if (options.remoteOnly) {
    params.set("remote_jobs_only", "true");
  }

  const companyType = mapCompanyType(options.companySize);

  if (companyType) {
    params.set("company_types", companyType);
  }

  const response = await fetch(`${JSEARCH_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    throw new JobSearchUnavailableError();
  }

  if (!response.ok) {
    throw new JobSearchUnavailableError();
  }

  const payload = await response.json().catch(() => null);
  const parsed = jSearchResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new JobSearchUnavailableError();
  }

  return parsed.data.data
    .map((job) => mapJSearchJobToPosting(job, options))
    .filter((job): job is RolePosting => Boolean(job))
    .slice(0, 10);
}

async function validatePostingBatch(
  postings: RolePosting[],
  origin: PostingOrigin,
  context: string,
) {
  if (!postings.length) {
    return [];
  }

  return keepLiveDirectPostingLinks(
    prioritizePostings(dedupePostings(withPostingOrigin(postings, origin))).slice(
      0,
      CATEGORY_TARGET_COUNT,
    ),
    context,
  );
}

export async function searchJobsWithJSearch(options: JSearchSearchOptions) {
  const result = await searchJobsWithJSearchDetailed(options);

  if (result.status === "source_unavailable") {
    throw new JobSearchUnavailableError();
  }

  return result.postings;
}

async function searchJobsWithJSearchDetailed(
  options: JSearchSearchOptions,
): Promise<JobSearchResult> {
  const normalizedQuery = options.query.trim();

  if (!normalizedQuery) {
    return {
      postings: [],
      status: "empty",
      source: "none",
      reason: "no_active_postings",
    };
  }

  const cacheKey = buildJobSearchCacheKey({
    ...options,
    query: normalizedQuery,
  });

  if (!options.forceRefresh) {
    const cached = getRuntimeCacheValue<JobSearchResult>(cacheKey, JOB_CACHE_TTL_MS);

    if (cached) {
      return cached;
    }
  }

  let jsearchPostings: RolePosting[] = [];
  let validatedPostings: SourcedRolePosting[] = [];
  const context = options.sourceContext?.trim() || normalizedQuery;
  let jsearchSuccessful = false;
  let fallbackSuccessful = false;
  let jsearchUnavailable = false;
  let fallbackUnavailable = false;

  if (!hasConfiguredRapidApiKey()) {
    jsearchUnavailable = true;
  } else {
    try {
      jsearchPostings = await fetchJSearchResults({
        ...options,
        query: normalizedQuery,
      });
      jsearchSuccessful = true;
    } catch (error) {
      if (!(error instanceof JobSearchUnavailableError)) {
        throw error;
      }

      jsearchUnavailable = true;
    }
  }

  if (jsearchPostings.length) {
    validatedPostings = await validatePostingBatch(jsearchPostings, "jsearch", context);
  }

  if (!validatedPostings.length && options.allowFallback !== false) {
    try {
      const linkedInPostings = await searchLinkedInGuestJobs({
        ...options,
        query: normalizedQuery,
      });

      fallbackSuccessful = true;

      if (linkedInPostings.length) {
        validatedPostings = await validatePostingBatch(
          linkedInPostings,
          "fallback",
          `${context} linkedin`,
        );
      }
    } catch (error) {
      if (!isFallbackUnavailableError(error)) {
        throw error;
      }
    }
  }

  if (!validatedPostings.length && options.allowFallback !== false) {
    try {
      const fallbackPostings = await searchPreferredBoardsWithRetry({
        ...options,
        query: normalizedQuery,
      });

      fallbackSuccessful = true;
      validatedPostings = await validatePostingBatch(
        fallbackPostings,
        "fallback",
        `${context} fallback`,
      );
    } catch (error) {
      if (!isFallbackUnavailableError(error)) {
        throw error;
      }

      fallbackUnavailable = true;
    }
  }

  const filteredPostings = stripPostingOrigins(
    prioritizePostings(dedupePostings(validatedPostings)).slice(0, CATEGORY_TARGET_COUNT),
  );

  const result: JobSearchResult = filteredPostings.length
    ? {
        postings: filteredPostings,
        status: "ready",
        source: mergeSearchSources(validatedPostings.map((posting) => posting.origin)),
        reason: null,
      }
    : jsearchSuccessful || fallbackSuccessful
      ? {
          postings: [],
          status: "empty",
          source: mergeSearchSources([
            ...(jsearchSuccessful ? (["jsearch"] as const) : []),
            ...(fallbackSuccessful ? (["fallback"] as const) : []),
          ]),
          reason: "no_active_postings",
        }
      : {
          postings: [],
          status: "source_unavailable",
          source: "none",
          reason: getSourceUnavailableReason(jsearchUnavailable, fallbackUnavailable),
        };

  if (result.status === "source_unavailable") {
    return result;
  }

  return setRuntimeCacheValue(cacheKey, result);
}

export async function searchJobsForRequest(
  request: RoleSearchRequest,
  options: { forceRefresh?: boolean } = {},
) {
  const parsedRequest = roleSearchRequestSchema.parse(request);

  return searchJobsWithJSearch({
    query: buildRoleSearchQuery(parsedRequest),
    location: parsedRequest.location,
    industry: parsedRequest.industry,
    companySize: parsedRequest.company_size,
    employmentType: inferEmploymentType(parsedRequest.query),
    remoteOnly: /remote/i.test(parsedRequest.location),
    forceRefresh: options.forceRefresh,
    allowFallback: true,
    sourceContext: `search:${parsedRequest.query.trim()}`,
  });
}

async function searchJobsForQueryVariants(
  variants: string[],
  options: Omit<JSearchSearchOptions, "query">,
  contextPrefix: string,
) {
  const variantResults: JobSearchResult[] = [];

  for (const query of variants) {
    const result = await searchJobsWithJSearchDetailed({
      ...options,
      query,
      sourceContext: `${contextPrefix}:${query}`,
    });
    variantResults.push(result);

    const combined = combineJobSearchResults(variantResults);

    if (combined.status === "ready" && combined.postings.length >= CATEGORY_TARGET_COUNT) {
      return combined;
    }
  }

  return combineJobSearchResults(variantResults);
}

export async function searchJobsForCategory(
  categoryTitle: string,
  options: {
    industry?: string | null;
    companySize?: string | null;
    forceRefresh?: boolean;
  } = {},
) {
  const variants = buildCategoryQueryVariants(categoryTitle);
  const broaderVariants = buildBroaderCategoryQueryVariants(categoryTitle);
  const employmentType = inferEmploymentType(categoryTitle);
  const remoteOnly = /\bremote\b/i.test(categoryTitle);
  const primaryResults = await searchJobsForQueryVariants(
    variants,
    {
      industry: options.industry,
      companySize: options.companySize,
      employmentType,
      remoteOnly,
      forceRefresh: options.forceRefresh,
      allowFallback: false,
    },
    `category-primary:${categoryTitle}`,
  );

  if (primaryResults.status === "ready") {
    return primaryResults;
  }

  const broaderResults = await searchJobsForQueryVariants(
    broaderVariants,
    {
      industry: null,
      companySize: null,
      employmentType,
      remoteOnly,
      forceRefresh: options.forceRefresh,
      allowFallback: false,
    },
    `category-broader:${categoryTitle}`,
  );

  if (broaderResults.status === "ready") {
    return broaderResults;
  }

  const fallbackVariants = unique([...variants, ...broaderVariants]);
  const fallbackResults = await searchJobsForQueryVariants(
    fallbackVariants,
    {
      industry: null,
      companySize: null,
      employmentType,
      remoteOnly,
      forceRefresh: options.forceRefresh,
      allowFallback: true,
    },
    `category-fallback:${categoryTitle}`,
  );

  return combineJobSearchResults([primaryResults, broaderResults, fallbackResults]);
}
