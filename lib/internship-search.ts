import "server-only";

import { Agent, fetch as undiciFetch } from "undici";
import { z } from "zod";

import {
  internshipJobSchema,
  internshipSearchRequestSchema,
  internshipSearchResponseSchema,
  type InternshipJob,
  type InternshipSearchRequest,
} from "@/lib/internship-search-shared";

const JSEARCH_API_URL = "https://api.openwebninja.com/jsearch/search";
const INTERNSHIP_PATTERN = /intern/i;

// OpenWeb Ninja's API rejects HTTP/1.1 with 401; force HTTP/2 via undici.
const h2Dispatcher = new Agent({ allowH2: true });

const rapidApiJobSchema = z.object({
  job_id: z.union([z.string(), z.number()]).optional().nullable(),
  job_title: z.string().nullish(),
  employer_name: z.string().nullish(),
  job_city: z.string().nullish(),
  job_state: z.string().nullish(),
  job_employment_type: z.string().nullish(),
  job_apply_link: z.string().nullish(),
  job_description: z.string().nullish(),
});

const rapidApiSearchResponseSchema = z.object({
  data: z.array(rapidApiJobSchema).default([]),
});

export class InternshipSearchError extends Error {
  status: number;

  constructor(
    message = "Job search is temporarily unavailable. Please try again later.",
    status = 503,
  ) {
    super(message);
    this.name = "InternshipSearchError";
    this.status = status;
  }
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildCombinedQuery(request: InternshipSearchRequest) {
  return [normalizeText(request.query), normalizeText(request.location)]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternshipPosting(job: z.infer<typeof rapidApiJobSchema>) {
  return (
    INTERNSHIP_PATTERN.test(normalizeText(job.job_title)) ||
    INTERNSHIP_PATTERN.test(normalizeText(job.job_description))
  );
}

function mapRapidApiJob(job: z.infer<typeof rapidApiJobSchema>) {
  const jobTitle = normalizeText(job.job_title);
  const applyLink = normalizeText(job.job_apply_link);

  if (!jobTitle || !applyLink) {
    return null;
  }

  const employerName = normalizeText(job.employer_name) || "Company not listed";
  const jobId =
    typeof job.job_id === "number"
      ? String(job.job_id)
      : normalizeText(job.job_id) || `${employerName}-${jobTitle}-${applyLink}`;

  return internshipJobSchema.parse({
    job_id: jobId,
    job_title: jobTitle,
    employer_name: employerName,
    job_city: normalizeText(job.job_city) || null,
    job_state: normalizeText(job.job_state) || null,
    job_employment_type: normalizeText(job.job_employment_type) || null,
    job_apply_link: applyLink,
  });
}

export async function searchInternshipJobs(input: InternshipSearchRequest) {
  const request = internshipSearchRequestSchema.parse(input);
  const apiKey = normalizeText(process.env.RAPIDAPI_KEY);

  if (!apiKey || apiKey === "your_rapidapi_key_here") {
    throw new InternshipSearchError(
      "Set RAPIDAPI_KEY in .env.local to enable internship search.",
      500,
    );
  }

  const upstreamUrl = new URL(JSEARCH_API_URL);
  upstreamUrl.searchParams.set("query", buildCombinedQuery(request));
  upstreamUrl.searchParams.set("num_pages", "1");
  upstreamUrl.searchParams.set("date_posted", "month");

  const response = await undiciFetch(upstreamUrl, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
    },
    dispatcher: h2Dispatcher,
  });

  const responseBody = await response.text();

  if (!response.ok) {
    const isDev = process.env.NODE_ENV === "development";
    let devHint = "";

    if (isDev) {
      if (response.status === 403) {
        devHint = " (dev: JSearch 403 — RAPIDAPI_KEY account is not subscribed to this API)";
      } else if (response.status === 429) {
        devHint = " (dev: JSearch 429 — quota exceeded, wait or upgrade RapidAPI plan)";
      } else {
        devHint = ` (dev: JSearch ${response.status})`;
      }
    }

    console.error(
      `[internship-search] JSearch error ${response.status}:`,
      responseBody.slice(0, 300),
    );
    throw new InternshipSearchError(
      `Job search is temporarily unavailable. Please try again later.${devHint}`,
      503,
    );
  }

  const payload = rapidApiSearchResponseSchema.parse(JSON.parse(responseBody));
  const seenLinks = new Set<string>();
  const results: InternshipJob[] = [];

  for (const job of payload.data) {
    if (!isInternshipPosting(job)) {
      continue;
    }

    const mappedJob = mapRapidApiJob(job);

    if (!mappedJob) {
      continue;
    }

    const dedupeKey = mappedJob.job_apply_link.toLowerCase();

    if (seenLinks.has(dedupeKey)) {
      continue;
    }

    seenLinks.add(dedupeKey);
    results.push(mappedJob);

    if (results.length >= 25) {
      break;
    }
  }

  return internshipSearchResponseSchema.parse({
    results,
  });
}
