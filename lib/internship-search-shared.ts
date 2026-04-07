import { z } from "zod";

export const internshipSearchRequestSchema = z.object({
  query: z.string().trim().min(1, "Enter a search query.").max(220),
  location: z.string().trim().max(120).optional().default(""),
});

export type InternshipSearchRequest = z.infer<typeof internshipSearchRequestSchema>;

export const internshipJobSchema = z.object({
  job_id: z.string(),
  job_title: z.string(),
  employer_name: z.string(),
  job_city: z.string().nullable().optional(),
  job_state: z.string().nullable().optional(),
  job_employment_type: z.string().nullable().optional(),
  job_apply_link: z.string().trim().min(1),
});

export type InternshipJob = z.infer<typeof internshipJobSchema>;

export const internshipSearchResponseSchema = z.object({
  results: z.array(internshipJobSchema).max(25),
});

export type InternshipSearchResponse = z.infer<typeof internshipSearchResponseSchema>;

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function formatInternshipLocation(job: InternshipJob) {
  const location = [normalizeText(job.job_city), normalizeText(job.job_state)]
    .filter(Boolean)
    .join(", ");

  return location || "Location not listed";
}
