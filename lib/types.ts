import { z } from "zod";

import { sanitizeGeneratedContent } from "@/lib/generated-content";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const briefRequestSchema = z.object({
  companyName: z.string().trim().min(1, "Enter a company name.").max(120),
  briefId: z.string().uuid("Invalid brief reference.").optional(),
});

export const careerFairDiscoveryRequestSchema = z.object({
  universityName: z.string().trim().min(1, "University name is required.").max(160),
});

const stringList = z.array(z.string().trim().min(1)).default([]);

export const roleIndustryOptions = [
  "Any",
  "Finance",
  "Consulting",
  "Tech",
  "Healthcare",
  "Energy",
  "Consumer Goods",
  "Nonprofit",
  "Government",
  "Other",
] as const;

export const companySizeOptions = [
  "Any",
  "Startup (1-50)",
  "Small (51-200)",
  "Mid-size (201-1000)",
  "Large (1000+)",
] as const;

export const roleSearchRequestSchema = z.object({
  query: z.string().trim().min(1, "Enter a role title.").max(120),
  location: z.string().trim().max(120).optional().default(""),
  industry: z.enum(roleIndustryOptions).default("Any"),
  company_size: z.enum(companySizeOptions).default("Any"),
});

export type RoleSearchRequest = z.infer<typeof roleSearchRequestSchema>;

export const signalBriefSchema = z.object({
  company_overview: z.object({
    official_company_name: z.string().trim().min(1).default("Could not verify"),
    description: z.string(),
    industry: z.string(),
    headquarters: z.string(),
    employee_count: z.string(),
    founded: z.string(),
    public_or_private: z.string(),
    stock_ticker: z.string().nullable(),
  }),
  recent_news: z
    .array(
      z.object({
        headline: z.string(),
        summary: z.string(),
        date: z.string(),
      }),
    )
    .default([]),
  culture_and_values: z.object({
    the_real_deal: z.string(),
    glassdoor_rating: z.string(),
    interview_difficulty: z.string(),
    pros: stringList,
    cons: stringList,
  }),
  financial_health: z.object({
    summary: z.string(),
    recent_developments: z.string(),
  }),
  red_flags: stringList,
  positioning_strategy: z.object({
    lead_with: z.string(),
    how_to_frame: z.string(),
    gap_to_address: z.string(),
    one_line_pitch: z.string(),
  }),
  talking_points: stringList,
  smart_questions: stringList,
  paths_in: z.object({
    primary_channels: stringList,
    active_postings_summary: z.string(),
    hiring_timeline: z.string(),
    pro_tip: z.string(),
  }),
  networking_playbook: z.object({
    who_to_reach_out_to: z.string(),
    where_to_find_them: z.string(),
    outreach_template: z.string(),
  }),
  application_optimizer: z.object({
    resume_tips: stringList,
    cover_letter_angles: stringList,
    keywords_to_include: stringList,
  }),
});

export type SignalBrief = z.infer<typeof signalBriefSchema>;

export const pocketBriefSchema = z.object({
  one_liner: z.string(),
  top_talking_point: z.string(),
  best_question: z.string(),
  key_fact: z.string(),
  pro_tip: z.string(),
});

export type PocketBrief = z.infer<typeof pocketBriefSchema>;

export const careerFairCompanyStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "error",
]);

export type CareerFairCompanyStatus = z.infer<typeof careerFairCompanyStatusSchema>;

export const careerFairCompanySchema = z.object({
  name: z.string().trim().min(1),
  match_score: z.number().int().min(0).max(100).nullable().optional(),
  brief_id: z.string().uuid().nullable().optional(),
  status: careerFairCompanyStatusSchema.default("pending"),
  why_you_match: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  pocket_brief: pocketBriefSchema.nullable().optional(),
  error_message: z.string().nullable().optional(),
});

export type CareerFairCompany = z.infer<typeof careerFairCompanySchema>;

export const careerFairMatchSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  why_you_match: z.string(),
  pocket_brief: pocketBriefSchema,
});

export type CareerFairMatch = z.infer<typeof careerFairMatchSchema>;

export const careerFairDiscoveryFairSchema = z.object({
  name: z.string(),
  date: z.string(),
  source_url: z.string().url(),
  description: z.string(),
  companies_found: z.array(z.string()).nullable(),
});

export type CareerFairDiscoveryFair = z.infer<typeof careerFairDiscoveryFairSchema>;

export const careerFairDiscoveryResponseSchema = z.object({
  fairs: z.array(careerFairDiscoveryFairSchema),
});

export type CareerFairDiscoveryResponse = z.infer<
  typeof careerFairDiscoveryResponseSchema
>;

export const opportunityRecommendationSchema = z.object({
  company_name: z.string(),
  industry: z.string(),
  why_you_fit: z.string(),
  what_they_hire_for: z.string(),
  match_strength: z.enum(["Strong", "Good", "Worth Exploring"]),
  hidden_gem: z.boolean(),
});

export type OpportunityRecommendation = z.infer<
  typeof opportunityRecommendationSchema
>;

export const opportunityDiscoveryResponseSchema = z.object({
  recommendations: z.array(opportunityRecommendationSchema).min(1).max(10),
});

export type OpportunityDiscoveryResponse = z.infer<
  typeof opportunityDiscoveryResponseSchema
>;

export const rolePostingSchema = z.object({
  job_id: z.string(),
  role_title: z.string(),
  company_name: z.string(),
  company_logo: z.string().trim().url().nullable().optional(),
  location: z.string(),
  apply_url: z.string().trim().url(),
  key_requirements: z.array(z.string().trim().min(1)).min(1).max(5),
  industry: z.string(),
  company_size: z.string(),
  job_description: z.string(),
  required_skills: z.array(z.string().trim().min(1)).default([]),
  qualifications: z.array(z.string().trim().min(1)).default([]),
  responsibilities: z.array(z.string().trim().min(1)).default([]),
  benefits: z.array(z.string().trim().min(1)).default([]),
  experience_months: z.number().int().min(0).nullable().optional(),
  no_experience_required: z.boolean().default(false),
  education_requirements: z.object({
    postgraduate_degree: z.boolean().default(false),
    professional_certification: z.boolean().default(false),
    high_school: z.boolean().default(false),
    associates_degree: z.boolean().default(false),
    bachelors_degree: z.boolean().default(false),
  }),
  is_remote: z.boolean().default(false),
  posted_at: z.string().nullable().optional(),
  source_site: z.string().default("JSearch"),
  employment_type: z.string().default(""),
});

export type RolePosting = z.infer<typeof rolePostingSchema>;

export const roleMatchBreakdownSchema = z.object({
  skills: z.number().int().min(0).max(40),
  education: z.number().int().min(0).max(25),
  experience: z.number().int().min(0).max(20),
  interests: z.number().int().min(0).max(15),
  top_factor: z.enum(["skills", "education", "experience", "interests"]),
});

export type RoleMatchBreakdown = z.infer<typeof roleMatchBreakdownSchema>;

export const discoveredRoleSchema = rolePostingSchema.extend({
  match_score: z.number().int().min(0).max(100),
  why_you_fit: z.string(),
  match_breakdown: roleMatchBreakdownSchema,
});

export type DiscoveredRole = z.infer<typeof discoveredRoleSchema>;

export const roleSearchResponseSchema = z.object({
  results: z.array(discoveredRoleSchema).max(10),
});

export type RoleSearchResponse = z.infer<typeof roleSearchResponseSchema>;

export const suggestedRoleCategorySeedSchema = z.object({
  title: z.string(),
  reason: z.string(),
});

export type SuggestedRoleCategorySeed = z.infer<typeof suggestedRoleCategorySeedSchema>;

export const suggestedRoleCategorySchema = suggestedRoleCategorySeedSchema.extend({
  roles: z.array(discoveredRoleSchema).max(4),
});

export type SuggestedRoleCategory = z.infer<typeof suggestedRoleCategorySchema>;

export const suggestedRoleCategoryHydrationSchema = suggestedRoleCategorySchema.extend({
  status: z.enum(["ready", "empty", "error"]),
  message: z.string().trim().min(1).nullable().optional(),
});

export type SuggestedRoleCategoryHydration = z.infer<
  typeof suggestedRoleCategoryHydrationSchema
>;

export const suggestedRoleSeedsResponseSchema = z.object({
  categories: z.array(suggestedRoleCategorySeedSchema).max(5),
});

export type SuggestedRoleSeedsResponse = z.infer<typeof suggestedRoleSeedsResponseSchema>;

export const suggestedRolesResponseSchema = z.object({
  categories: z.array(suggestedRoleCategorySchema).max(5),
});

export type SuggestedRolesResponse = z.infer<typeof suggestedRolesResponseSchema>;

export const suggestedRoleCategoryHydrationResponseSchema = z.object({
  category: suggestedRoleCategoryHydrationSchema,
});

export type SuggestedRoleCategoryHydrationResponse = z.infer<
  typeof suggestedRoleCategoryHydrationResponseSchema
>;

export const careerFairGenerateSchema = z
  .object({
    fairName: z.string().trim().min(1, "Enter a career fair name.").max(160),
    companies: z.array(z.string().trim().min(1)).min(1).max(20),
    fairId: z.string().uuid("Invalid career fair reference.").optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.fairId && value.companies.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companies"],
        message: "Enter at least 2 companies to build a game plan.",
      });
    }
  });

const legacySignalBriefSchema = z.object({
  company_overview: z.object({
    description: z.string(),
    industry: z.string(),
    headquarters: z.string(),
    size: z.string(),
    founded: z.string(),
    public_or_private: z.string(),
  }),
  recent_news: z
    .array(
      z.object({
        headline: z.string(),
        summary: z.string(),
        date: z.string(),
      }),
    )
    .default([]),
  culture_and_values: z.object({
    official_values: z.string(),
    employee_sentiment: z.string(),
    glassdoor_rating: z.string(),
    pros: stringList,
    cons: stringList,
  }),
  financial_health: z.object({
    summary: z.string(),
    growth_trajectory: z.string(),
    recent_developments: z.string(),
  }),
  red_flags: stringList,
  talking_points: stringList,
  smart_questions: stringList,
  paths_in: z.object({
    primary_channels: stringList,
    active_postings: stringList,
    hiring_timeline: z.string(),
  }),
  networking_playbook: z.object({
    target_roles: stringList,
    where_to_find: z.string(),
    outreach_template: z.string(),
  }),
  application_optimizer: z.object({
    resume_tips: stringList,
    cover_letter_angles: stringList,
    keywords_to_use: stringList,
  }),
});

type LegacySignalBrief = z.infer<typeof legacySignalBriefSchema>;

export interface BriefRecord {
  id: string;
  user_id: string | null;
  company_name: string;
  brief_data: Json;
  created_at: string;
}

export interface NormalizedBriefRecord extends Omit<BriefRecord, "brief_data"> {
  brief_data: SignalBrief;
}

export interface ProfileRecord {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  minor: string | null;
  double_major: string | null;
  graduation_year: number | null;
  career_interests: string | null;
  resume_text: string | null;
  resume_filename: string | null;
  updated_at: string | null;
}

export interface CareerFairRecord {
  id: string;
  user_id: string | null;
  fair_name: string;
  companies: Json;
  created_at: string;
}

export interface NormalizedCareerFairRecord
  extends Omit<CareerFairRecord, "companies"> {
  companies: CareerFairCompany[];
}

function normalizeLegacyBrief(brief: LegacySignalBrief): SignalBrief {
  const cultureSummary = [
    brief.culture_and_values.employee_sentiment,
    brief.culture_and_values.official_values,
  ]
    .filter(Boolean)
    .join(" ");

  const financialSummary = [
    brief.financial_health.summary,
    brief.financial_health.growth_trajectory,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    company_overview: {
      official_company_name: "Could not verify",
      description: brief.company_overview.description,
      industry: brief.company_overview.industry,
      headquarters: brief.company_overview.headquarters,
      employee_count: brief.company_overview.size,
      founded: brief.company_overview.founded,
      public_or_private: brief.company_overview.public_or_private,
      stock_ticker: null,
    },
    recent_news: brief.recent_news,
    culture_and_values: {
      the_real_deal:
        cultureSummary || "Could not verify the internal employee view from this saved brief.",
      glassdoor_rating: brief.culture_and_values.glassdoor_rating,
      interview_difficulty: "Could not verify",
      pros: brief.culture_and_values.pros,
      cons: brief.culture_and_values.cons,
    },
    financial_health: {
      summary:
        financialSummary ||
        "Could not verify the latest financial trajectory from this saved brief.",
      recent_developments: brief.financial_health.recent_developments,
    },
    red_flags: brief.red_flags,
    positioning_strategy: {
      lead_with:
        "Lead with the experience that looks most similar to the team or business problem this company is hiring around.",
      how_to_frame:
        "Translate your background into business impact, not just responsibilities, and tie it to the company’s current priorities.",
      gap_to_address:
        "If you are missing direct experience, acknowledge it and show the closest proof point from coursework, projects, or previous work.",
      one_line_pitch:
        "I’m excited by the work your team is doing, and I’d love to bring the strongest parts of my background into that environment.",
    },
    talking_points: brief.talking_points,
    smart_questions: brief.smart_questions,
    paths_in: {
      primary_channels: brief.paths_in.primary_channels,
      active_postings_summary:
        brief.paths_in.active_postings.join(" ") ||
        "Could not verify active postings in this saved brief.",
      hiring_timeline: brief.paths_in.hiring_timeline,
      pro_tip:
        "Use the most recent job posting language in your outreach and ask contacts about the exact team priorities behind it.",
    },
    networking_playbook: {
      who_to_reach_out_to:
        brief.networking_playbook.target_roles.join(", ") ||
        "Could not verify specific outreach targets.",
      where_to_find_them: brief.networking_playbook.where_to_find,
      outreach_template: brief.networking_playbook.outreach_template,
    },
    application_optimizer: {
      resume_tips: brief.application_optimizer.resume_tips,
      cover_letter_angles: brief.application_optimizer.cover_letter_angles,
      keywords_to_include: brief.application_optimizer.keywords_to_use,
    },
  };
}

export function normalizeSignalBrief(input: unknown): SignalBrief {
  const parsed = signalBriefSchema.safeParse(sanitizeGeneratedContent(input));

  if (parsed.success) {
    return parsed.data;
  }

  const legacyParsed = legacySignalBriefSchema.safeParse(sanitizeGeneratedContent(input));

  if (legacyParsed.success) {
    return normalizeLegacyBrief(legacyParsed.data);
  }

  return {
    company_overview: {
      official_company_name: "Could not verify",
      description: "Could not verify the company overview from the saved brief.",
      industry: "Unknown",
      headquarters: "Could not verify",
      employee_count: "Could not verify",
      founded: "Could not verify",
      public_or_private: "Could not verify",
      stock_ticker: null,
    },
    recent_news: [],
    culture_and_values: {
      the_real_deal: "Could not verify the culture details from the saved brief.",
      glassdoor_rating: "Could not verify",
      interview_difficulty: "Could not verify",
      pros: [],
      cons: [],
    },
    financial_health: {
      summary: "Could not verify the financial details from the saved brief.",
      recent_developments: "Could not verify",
    },
    red_flags: [],
    positioning_strategy: {
      lead_with:
        "Upload your resume and regenerate this brief to unlock company-specific positioning advice.",
      how_to_frame:
        "Focus on the experiences that most closely match the company’s current priorities.",
      gap_to_address:
        "Be direct about any missing experience and show the closest evidence that you can ramp quickly.",
      one_line_pitch:
        "I’d love to connect my background to the work your team is focused on right now.",
    },
    talking_points: [],
    smart_questions: [],
    paths_in: {
      primary_channels: [],
      active_postings_summary: "Could not verify",
      hiring_timeline: "Could not verify",
      pro_tip:
        "Regenerate this brief to refresh the hiring guidance with the current Signal schema.",
    },
    networking_playbook: {
      who_to_reach_out_to: "Could not verify",
      where_to_find_them: "Could not verify",
      outreach_template:
        "Hi [Name], I’m a student researching your team and would love to learn more about the work you’re doing. If you have 15 minutes, I’d really appreciate the chance to ask a few specific questions.",
    },
    application_optimizer: {
      resume_tips: [],
      cover_letter_angles: [],
      keywords_to_include: [],
    },
  };
}

export function normalizeBriefRecord(brief: BriefRecord): NormalizedBriefRecord {
  return {
    ...brief,
    brief_data: normalizeSignalBrief(brief.brief_data),
  };
}

export function resolveBriefCompanyName(
  brief: SignalBrief,
  fallbackCompanyName: string,
) {
  const officialCompanyName = brief.company_overview.official_company_name.trim();

  if (officialCompanyName && officialCompanyName !== "Could not verify") {
    return officialCompanyName;
  }

  const fallback = fallbackCompanyName.trim();
  return fallback || "Unknown company";
}

export function normalizeCareerFairCompanies(input: unknown): CareerFairCompany[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => {
    const parsed = careerFairCompanySchema.safeParse(sanitizeGeneratedContent(item));

    if (!parsed.success) {
      return [];
    }

    return [
      {
        ...parsed.data,
        match_score: parsed.data.match_score ?? null,
        brief_id: parsed.data.brief_id ?? null,
        why_you_match: parsed.data.why_you_match ?? null,
        industry: parsed.data.industry ?? null,
        pocket_brief: parsed.data.pocket_brief ?? null,
        error_message: parsed.data.error_message ?? null,
      },
    ];
  });
}

export function normalizeCareerFairRecord(
  fair: CareerFairRecord,
): NormalizedCareerFairRecord {
  return {
    ...fair,
    companies: normalizeCareerFairCompanies(fair.companies),
  };
}

export interface Database {
  public: {
    Tables: {
      briefs: {
        Row: BriefRecord;
        Insert: {
          id?: string;
          user_id?: string;
          company_name: string;
          brief_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          company_name?: string;
          brief_data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "briefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      career_fairs: {
        Row: CareerFairRecord;
        Insert: {
          id?: string;
          user_id?: string;
          fair_name: string;
          companies?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          fair_name?: string;
          companies?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_fairs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: ProfileRecord;
        Insert: {
          id: string;
          full_name?: string | null;
          university?: string | null;
          major?: string | null;
          minor?: string | null;
          double_major?: string | null;
          graduation_year?: number | null;
          career_interests?: string | null;
          resume_text?: string | null;
          resume_filename?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          university?: string | null;
          major?: string | null;
          minor?: string | null;
          double_major?: string | null;
          graduation_year?: number | null;
          career_interests?: string | null;
          resume_text?: string | null;
          resume_filename?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
