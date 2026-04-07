import OpenAI from "openai";
import { z } from "zod";

import {
  replaceEmDashes,
  sanitizeGeneratedContent,
  sanitizeGeneratedJsonText,
} from "@/lib/generated-content";
import { applyInterestAlignmentScore } from "@/lib/role-match";
import {
  analyzeResumeText,
  type StructuredResume,
  type StructuredResumeEvidence,
} from "@/lib/resume";
import {
  careerFairDiscoveryResponseSchema,
  careerFairMatchSchema,
  opportunityDiscoveryResponseSchema,
  rolePostingSchema,
  roleSearchRequestSchema,
  signalBriefSchema,
  type CareerFairDiscoveryResponse,
  type CareerFairMatch,
  type DiscoveredRole,
  type OpportunityDiscoveryResponse,
  type ProfileRecord,
  type RoleSearchRequest,
  type RolePosting,
  type SignalBrief,
} from "@/lib/types";

class InvalidBriefError extends Error {}

const userLocation = {
  type: "approximate",
  country: "US",
  region: "New Jersey",
  city: "New Brunswick",
  timezone: "America/New_York",
} as const;

const researchStrategyConfigs = [
  {
    model: "gpt-4o",
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        user_location: userLocation,
      },
    ],
  },
  {
    model: "gpt-4o-search-preview",
    tools: [
      {
        type: "web_search_preview",
        search_context_size: "medium",
        user_location: userLocation,
      },
    ],
  },
] as const;

const stringListSchema = z.array(z.string().trim().min(1));

const companyResearchSchema = z.object({
  company_overview: z.object({
    official_company_name: z.string().trim().min(1),
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
    pros: stringListSchema,
    cons: stringListSchema,
  }),
  financial_health: z.object({
    summary: z.string(),
    recent_developments: z.string(),
  }),
  red_flags: stringListSchema.default([]),
  smart_questions: z.array(z.string().trim().min(1)).min(3).max(5),
  paths_in: z.object({
    primary_channels: stringListSchema,
    active_postings_summary: z.string(),
    hiring_timeline: z.string(),
    pro_tip: z.string(),
  }),
  student_recruiting_context: z.object({
    likely_team_or_division: z.string(),
    entry_level_hiring_values: z.array(z.string().trim().min(1)).min(2).max(6),
    current_priorities: z.array(z.string().trim().min(1)).min(2).max(6),
    differentiators: z.array(z.string().trim().min(1)).min(2).max(6),
    competitors: z.array(z.string().trim().min(1)).min(1).max(6),
  }),
});

const personalizedSectionsSchema = z.object({
  evidence_map: z
    .array(
      z.object({
        company_need: z.string(),
        resume_evidence: z.string(),
        why_it_matters_here: z.string(),
      }),
    )
    .length(3),
  positioning_strategy: z.object({
    lead_with: z.string(),
    how_to_frame: z.string(),
    gap_to_address: z.string(),
    one_line_pitch: z.string(),
  }),
  talking_points: z.array(z.string().trim().min(1)).length(3),
  networking_playbook: z.object({
    who_to_reach_out_to: z.string(),
    where_to_find_them: z.string(),
    outreach_template: z.string(),
  }),
  application_optimizer: z.object({
    resume_tips: stringListSchema.min(2).max(4),
    cover_letter_angles: stringListSchema.min(2).max(4),
    keywords_to_include: stringListSchema.min(4).max(10),
  }),
});

type CompanyResearch = z.infer<typeof companyResearchSchema>;
type PersonalizedSections = z.infer<typeof personalizedSectionsSchema>;

const companyResearchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "company_overview",
    "recent_news",
    "culture_and_values",
    "financial_health",
    "red_flags",
    "smart_questions",
    "paths_in",
    "student_recruiting_context",
  ],
  properties: {
    company_overview: {
      type: "object",
      additionalProperties: false,
      required: [
        "official_company_name",
        "description",
        "industry",
        "headquarters",
        "employee_count",
        "founded",
        "public_or_private",
        "stock_ticker",
      ],
      properties: {
        official_company_name: { type: "string" },
        description: { type: "string" },
        industry: { type: "string" },
        headquarters: { type: "string" },
        employee_count: { type: "string" },
        founded: { type: "string" },
        public_or_private: { type: "string" },
        stock_ticker: { type: ["string", "null"] },
      },
    },
    recent_news: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "summary", "date"],
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          date: { type: "string" },
        },
      },
    },
    culture_and_values: {
      type: "object",
      additionalProperties: false,
      required: [
        "the_real_deal",
        "glassdoor_rating",
        "interview_difficulty",
        "pros",
        "cons",
      ],
      properties: {
        the_real_deal: { type: "string" },
        glassdoor_rating: { type: "string" },
        interview_difficulty: { type: "string" },
        pros: { type: "array", items: { type: "string" } },
        cons: { type: "array", items: { type: "string" } },
      },
    },
    financial_health: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "recent_developments"],
      properties: {
        summary: { type: "string" },
        recent_developments: { type: "string" },
      },
    },
    red_flags: {
      type: "array",
      items: { type: "string" },
    },
    smart_questions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" },
    },
    paths_in: {
      type: "object",
      additionalProperties: false,
      required: [
        "primary_channels",
        "active_postings_summary",
        "hiring_timeline",
        "pro_tip",
      ],
      properties: {
        primary_channels: {
          type: "array",
          items: { type: "string" },
        },
        active_postings_summary: { type: "string" },
        hiring_timeline: { type: "string" },
        pro_tip: { type: "string" },
      },
    },
    student_recruiting_context: {
      type: "object",
      additionalProperties: false,
      required: [
        "likely_team_or_division",
        "entry_level_hiring_values",
        "current_priorities",
        "differentiators",
        "competitors",
      ],
      properties: {
        likely_team_or_division: { type: "string" },
        entry_level_hiring_values: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        current_priorities: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        differentiators: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        competitors: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
      },
    },
  },
} as const;

const personalizedSectionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "evidence_map",
    "positioning_strategy",
    "talking_points",
    "networking_playbook",
    "application_optimizer",
  ],
  properties: {
    evidence_map: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company_need", "resume_evidence", "why_it_matters_here"],
        properties: {
          company_need: { type: "string" },
          resume_evidence: { type: "string" },
          why_it_matters_here: { type: "string" },
        },
      },
    },
    positioning_strategy: {
      type: "object",
      additionalProperties: false,
      required: ["lead_with", "how_to_frame", "gap_to_address", "one_line_pitch"],
      properties: {
        lead_with: { type: "string" },
        how_to_frame: { type: "string" },
        gap_to_address: { type: "string" },
        one_line_pitch: { type: "string" },
      },
    },
    talking_points: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    networking_playbook: {
      type: "object",
      additionalProperties: false,
      required: ["who_to_reach_out_to", "where_to_find_them", "outreach_template"],
      properties: {
        who_to_reach_out_to: { type: "string" },
        where_to_find_them: { type: "string" },
        outreach_template: { type: "string" },
      },
    },
    application_optimizer: {
      type: "object",
      additionalProperties: false,
      required: ["resume_tips", "cover_letter_angles", "keywords_to_include"],
      properties: {
        resume_tips: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" },
        },
        cover_letter_angles: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" },
        },
        keywords_to_include: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: { type: "string" },
        },
      },
    },
  },
} as const;

const careerFairMatchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["match_score", "why_you_match", "pocket_brief"],
  properties: {
    match_score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    why_you_match: { type: "string" },
    pocket_brief: {
      type: "object",
      additionalProperties: false,
      required: [
        "one_liner",
        "top_talking_point",
        "best_question",
        "key_fact",
        "pro_tip",
      ],
      properties: {
        one_liner: { type: "string" },
        top_talking_point: { type: "string" },
        best_question: { type: "string" },
        key_fact: { type: "string" },
        pro_tip: { type: "string" },
      },
    },
  },
} as const;

const careerFairDiscoveryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fairs"],
  properties: {
    fairs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "date", "source_url", "description", "companies_found"],
        properties: {
          name: { type: "string" },
          date: { type: "string" },
          source_url: { type: "string" },
          description: { type: "string" },
          companies_found: {
            type: ["array", "null"],
            items: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const opportunityDiscoveryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company_name",
          "industry",
          "why_you_fit",
          "what_they_hire_for",
          "match_strength",
          "hidden_gem",
        ],
        properties: {
          company_name: { type: "string" },
          industry: { type: "string" },
          why_you_fit: { type: "string" },
          what_they_hire_for: { type: "string" },
          match_strength: {
            type: "string",
            enum: ["Strong", "Good", "Worth Exploring"],
          },
          hidden_gem: { type: "boolean" },
        },
      },
    },
  },
} as const;

const liveRoleSearchSchema = z.object({
  postings: z.array(rolePostingSchema).max(10),
});

const suggestedRoleDiscoverySchema = z.object({
  categories: z
    .array(
      z.object({
        title: z.string(),
        reason: z.string(),
      }),
    )
    .min(1)
    .max(5),
});

type SuggestedRoleDiscoveryRaw = z.infer<typeof suggestedRoleDiscoverySchema>;

const roleWhyYouFitBatchSchema = z.object({
  roles: z.array(
    z.object({
      index: z.number().int().min(0),
      why_you_fit: z.string(),
      interest_alignment_score: z.number().int().min(0).max(15),
    }),
  ).max(24),
});

const liveRoleSearchJsonSchema = {
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
          "role_title",
          "company_name",
          "location",
          "apply_url",
          "key_requirements",
          "industry",
          "company_size",
        ],
        properties: {
          role_title: { type: "string" },
          company_name: { type: "string" },
          location: { type: "string" },
          apply_url: { type: "string" },
          key_requirements: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: { type: "string" },
          },
          industry: { type: "string" },
          company_size: { type: "string" },
        },
      },
    },
  },
} as const;

const suggestedRoleDiscoveryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categories"],
  properties: {
    categories: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

const roleWhyYouFitBatchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["roles"],
  properties: {
    roles: {
      type: "array",
      minItems: 1,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "why_you_fit", "interest_alignment_score"],
        properties: {
          index: { type: "integer", minimum: 0 },
          why_you_fit: { type: "string" },
          interest_alignment_score: { type: "integer", minimum: 0, maximum: 15 },
        },
      },
    },
  },
} as const;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.includes("<paste-")) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local before generating briefs.",
    );
  }

  return new OpenAI({ apiKey });
}

function formatProfileValue(
  value: string | number | null | undefined,
  fallback = "Not provided",
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "number") {
    return String(value);
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());
}

function getStructuredResume(profile?: ProfileRecord | null) {
  if (!profile?.resume_text?.trim()) {
    return null;
  }

  return analyzeResumeText(profile.resume_text.trim(), {
    graduationYear: profile.graduation_year,
    major: profile.major,
  });
}

function buildStudentIdentity(profile?: ProfileRecord | null) {
  return `Name: ${formatProfileValue(profile?.full_name)}
University: ${formatProfileValue(profile?.university, "Rutgers University")}
Major: ${formatProfileValue(profile?.major)}
Minor: ${formatProfileValue(profile?.minor)}
Double Major: ${formatProfileValue(profile?.double_major)}
Graduation: ${formatProfileValue(profile?.graduation_year)}
Career Interests: ${formatProfileValue(profile?.career_interests)}`;
}

function buildStudentProfileSummary(profile?: ProfileRecord | null) {
  const structuredResume = getStructuredResume(profile);

  if (!structuredResume) {
    return `${buildStudentIdentity(profile)}

Structured resume signals: Resume not uploaded yet. Score fit based on the profile only, and stay conservative about proof points.`;
  }

  return `${buildStudentIdentity(profile)}

Structured resume signals:
${JSON.stringify(structuredResume, null, 2)}`;
}

const matchingStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "their",
  "they",
  "them",
  "your",
  "you",
  "about",
  "work",
  "team",
  "teams",
  "company",
  "student",
  "students",
  "entry",
  "level",
  "across",
  "through",
  "using",
  "used",
  "need",
  "needs",
  "focus",
  "focused",
  "current",
  "priorities",
  "priority",
]);

function tokenizeForMatching(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map((token) => token.trim())
        .filter((token) => {
          if (!token) {
            return false;
          }

          if (token.length <= 2 && !["ai", "bi", "esg"].includes(token)) {
            return false;
          }

          return !matchingStopWords.has(token);
        }),
    ),
  );
}

interface RankedResumeEvidence extends StructuredResumeEvidence {
  score: number;
  matched_terms: string[];
  selection_reason: string;
}

function buildMatchingPhrases(companyResearch: CompanyResearch) {
  return [
    {
      value: companyResearch.student_recruiting_context.likely_team_or_division,
      weight: 5,
    },
    ...companyResearch.student_recruiting_context.current_priorities.map((value) => ({
      value,
      weight: 5,
    })),
    ...companyResearch.student_recruiting_context.entry_level_hiring_values.map((value) => ({
      value,
      weight: 4,
    })),
    ...companyResearch.student_recruiting_context.differentiators.map((value) => ({
      value,
      weight: 3,
    })),
    ...companyResearch.student_recruiting_context.competitors.map((value) => ({
      value,
      weight: 7,
    })),
    {
      value: companyResearch.company_overview.description,
      weight: 3,
    },
    {
      value: companyResearch.paths_in.active_postings_summary,
      weight: 3,
    },
    {
      value: companyResearch.culture_and_values.the_real_deal,
      weight: 2,
    },
  ];
}

function rankResumeEvidence(
  companyName: string,
  companyResearch: CompanyResearch,
  structuredResume: StructuredResume | null,
): RankedResumeEvidence[] {
  if (!structuredResume) {
    return [];
  }

  const candidates = Array.from(
    new Map(
      [...structuredResume.relevant_experience, ...structuredResume.quantified_achievements].map(
        (item) => [item.evidence, item],
      ),
    ).values(),
  );

  const matchingPhrases = buildMatchingPhrases(companyResearch);
  const normalizedCompanyName = companyName.toLowerCase();
  const bigFourFirms = ["pwc", "kpmg", "deloitte", "ey"];
  const isBigFourTarget = bigFourFirms.some((firm) => normalizedCompanyName.includes(firm));
  const companyContextText = [
    companyResearch.company_overview.description,
    companyResearch.student_recruiting_context.likely_team_or_division,
    companyResearch.student_recruiting_context.current_priorities.join(" "),
  ].join(" ");
  const isAdvisoryFirm =
    /\badvisory\b|\bconsulting\b|\bassurance\b|\baudit\b|\bprofessional services\b|\bclient\b/i.test(
      companyContextText,
    );
  const isResearchOrg =
    /\bresearch\b|\bbenchmark(?:ing)?\b|\binstitute\b|\breporting\b|\bdatabase\b|\binsights\b/i.test(
      companyContextText,
    );

  return candidates
    .map((candidate) => {
      const candidateText = [
        candidate.evidence,
        candidate.metrics.join(" "),
        candidate.technical_skills.join(" "),
        candidate.implied_soft_skills.join(" "),
      ].join(" ");
      const candidateTokens = new Set(tokenizeForMatching(candidateText));
      const matchedTerms = new Set<string>();
      let score = candidate.source_section === "Experience" ? 3 : 1;

      for (const phrase of matchingPhrases) {
        const phraseTokens = tokenizeForMatching(phrase.value);
        const overlap = phraseTokens.filter((token) => candidateTokens.has(token));

        if (!overlap.length) {
          continue;
        }

        score += phrase.weight + overlap.length;
        overlap.forEach((token) => matchedTerms.add(token));
      }

      if (candidate.metrics.length) {
        score += 1;
      }

      if (candidate.technical_skills.length) {
        score += 1;
      }

      if (candidate.implied_soft_skills.length) {
        score += 1;
      }

      if (
        companyResearch.student_recruiting_context.competitors.some((competitor) =>
          new RegExp(escapeRegExp(competitor), "i").test(candidate.evidence),
        )
      ) {
        score += isAdvisoryFirm ? 25 : 10;
      }

      if (
        isBigFourTarget &&
        bigFourFirms.some(
          (firm) =>
            !normalizedCompanyName.includes(firm) &&
            new RegExp(`\\b${escapeRegExp(firm)}\\b`, "i").test(candidate.evidence),
        )
      ) {
        score += 50;
      }

      if (
        isAdvisoryFirm &&
        /\bclient\b|\bmanager\b|\bsox\b|\bcontrols?\b|\brisk\b|\badvisory\b/i.test(
          candidate.evidence,
        )
      ) {
        score += 15;
      }

      if (
        isResearchOrg &&
        /\besg\b|\bsasb\b|\bscope 3\b|\bdisclosure\b|\breport(?:ing|s)?\b|\bbenchmark(?:ing)?\b|\bdataset\b|\bmemo\b/i.test(
          candidate.evidence,
        )
      ) {
        score += 10;
      }

      if (isAdvisoryFirm && candidate.source_section !== "Experience") {
        score -= 2;
      }

      const matchedTermsList = Array.from(matchedTerms).slice(0, 6);

      return {
        ...candidate,
        score,
        matched_terms: matchedTermsList,
        selection_reason: matchedTermsList.length
          ? `Matched company terms: ${matchedTermsList.join(", ")}.`
          : "Selected because it shows concrete work that could transfer to this company.",
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function buildRankedResumeEvidenceContext(
  companyName: string,
  companyResearch: CompanyResearch,
  profile?: ProfileRecord | null,
) {
  const rankedEvidence = rankResumeEvidence(
    companyName,
    companyResearch,
    getStructuredResume(profile),
  );

  if (!rankedEvidence.length) {
    return "No resume uploaded. Use the student profile only and keep every claim conservative.";
  }

  return rankedEvidence
    .map(
      (item, index) => `${index + 1}. Source section: ${item.source_section}
Evidence: ${item.evidence}
Matched terms: ${item.matched_terms.join(", ") || "None extracted"}
Why Signal pre-ranked it: ${item.selection_reason}`,
    )
    .join("\n\n");
}

function buildStudentResearchSnapshot(profile?: ProfileRecord | null) {
  return `${buildStudentIdentity(profile)}

Use this snapshot only to infer the most likely team or division this student would pursue. Do not choose resume proof points yet.`;
}

function buildCompanyResearchContext(
  companyName: string,
  companyResearch: CompanyResearch,
) {
  const currentPriorities = companyResearch.student_recruiting_context.current_priorities
    .map((item) => `- ${item}`)
    .join("\n");

  const entryLevelValues = companyResearch.student_recruiting_context.entry_level_hiring_values
    .map((item) => `- ${item}`)
    .join("\n");

  const differentiators = companyResearch.student_recruiting_context.differentiators
    .map((item) => `- ${item}`)
    .join("\n");

  const competitors = companyResearch.student_recruiting_context.competitors
    .map((item) => `- ${item}`)
    .join("\n");

  const recentNews = companyResearch.recent_news
    .slice(0, 3)
    .map((item) => `- ${item.date}: ${item.headline}. ${item.summary}`)
    .join("\n");

  return `Company: ${companyName}
Official company name: ${companyResearch.company_overview.official_company_name}
What they do: ${companyResearch.company_overview.description}
Industry position: ${companyResearch.company_overview.industry}
Headquarters: ${companyResearch.company_overview.headquarters}
Company size: ${companyResearch.company_overview.employee_count}
Founded: ${companyResearch.company_overview.founded}
Ownership: ${companyResearch.company_overview.public_or_private}
Culture signals: ${companyResearch.culture_and_values.the_real_deal}
Likely team or division for this student: ${companyResearch.student_recruiting_context.likely_team_or_division}
What they value in entry-level hires:
${entryLevelValues || "- Could not verify"}
Current priorities and initiatives:
${currentPriorities || "- Could not verify"}
Competitors:
${competitors || "- Could not verify"}
What makes them different:
${differentiators || "- Could not verify"}
Recent news:
${recentNews || "- Could not verify"}
Hiring channels: ${companyResearch.paths_in.primary_channels.join(", ") || "Could not verify"}
Active postings summary: ${companyResearch.paths_in.active_postings_summary}
Hiring timeline: ${companyResearch.paths_in.hiring_timeline}
Red flags: ${companyResearch.red_flags.join("; ") || "None verified"}`;
}

function buildCompanyResearchSystemPrompt(profile?: ProfileRecord | null) {
  const currentYear = new Date().getFullYear();
  const currentDate = formatCurrentDate();

  return `You are Signal's company research desk.

Your job is to research the company deeply before anyone looks at the student's resume for evidence.

RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Start from the company, not the resume.
- Use the student snapshot only to infer the likely team or division, not to choose talking points.
- Be direct. No filler and no corporate fluff.
- If you cannot verify something, say "Could not verify".
- Reference competitors and what makes this company different from them.
- Focus on what matters to a student recruiting for internships or entry-level roles right now.

SEARCH INSTRUCTIONS:
- You must search the web for current information, not rely on memory.
- Search for "[company name] news ${currentYear}" to find recent developments.
- Search for "[company name] careers internship" and "[company name] university recruiting" to understand current entry-level hiring.
- Search for "[company name] glassdoor reviews" and "[company name] interview questions glassdoor" to ground culture and interview expectations.
- Search for competitors or peer firms so you can explain what makes this company distinct.

TODAY: ${currentDate}

STUDENT SNAPSHOT:
${buildStudentResearchSnapshot(profile)}

Return only valid JSON that matches the schema exactly.`;
}

function buildCompanyResearchUserPrompt(companyName: string, retry = false) {
  return `Research "${companyName}" for a student recruiting brief.

You must verify:
- the correct official company name, even if the user input is misspelled or shorthand
- what the company actually does
- how big it is and where it sits in the market
- what they care about right now, based on recent news or initiatives
- what entry-level hires are expected to do
- which team or division this student would most likely join
- how the company differs from close competitors
- how students actually get in, including channels and timing
- smart questions a student could ask that prove real research

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Search the web first, then return only valid JSON."}`;
}

function buildPersonalizedSectionsSystemPrompt(
  companyName: string,
  companyResearch: CompanyResearch,
  profile?: ProfileRecord | null,
) {
  const structuredResume = getStructuredResume(profile);

  return `You are an elite career strategist who has personally placed 500+ students into top companies. You give advice that sounds like a mentor who spent 30 minutes researching both the company and the student, not a template.

RULES:
- Never use em dashes. Use commas, periods, or semicolons instead.
- Never use the same "Lead With" advice for two different companies. Every recommendation must be unique to this company's specific needs and culture.
- Never start from the resume and force-fit it to the company. Start from the company and find the best evidence in the resume.
- Reference specific company details, including size, recent projects, industry position, competitors, and what makes them different from similar firms.
- When referencing resume items, go beyond the project name. Explain why that experience matters to this company in a way that would not apply somewhere else.
- Be direct. No filler phrases like "you're well-positioned" or "your experience aligns well."
- Work in this order internally: first identify what ${companyName} needs right now, second choose the 2-3 best resume proof points, third write the advice.
- If the same advice could plausibly work for a different company, rewrite it until it becomes company-locked.
- Prefer the proof point that most closely mirrors the company's actual client work, deliverables, or current initiatives, not just the flashiest project title.
- Direct domain evidence outranks generic technical projects when both are available.
- For advisory firms, client-facing work, competitor experience, or real business process improvement usually outranks school projects.
- For sustainability research or reporting firms, ESG disclosures, SASB, Scope 3, assurance, or regulatory-tracking evidence usually outranks general automation work.
- If the student has experience at a direct competitor or in a nearly identical client-service environment, rank that evidence first unless the company context names a more direct current initiative.
- If the company primarily sells research, benchmarking, or reporting insight, rank disclosure analysis, memo writing, framework fluency, or regulatory tracking ahead of generic tooling.

COMPANY CONTEXT (use this to drive all advice):
${buildCompanyResearchContext(companyName, companyResearch)}

STUDENT RESUME:
${structuredResume ? JSON.stringify(structuredResume, null, 2) : "Resume not uploaded. Use only the student profile and keep every claim conservative."}

PRE-SCORED RESUME MATCHES:
${buildRankedResumeEvidenceContext(companyName, companyResearch, profile)}

STUDENT PROFILE:
- Major: ${formatProfileValue(profile?.major)}
- Minor: ${formatProfileValue(profile?.minor)}
- Career interests: ${formatProfileValue(profile?.career_interests)}
- University: ${formatProfileValue(profile?.university, "Rutgers University")}

Generate the following sections:

MATCHED EVIDENCE MAP (generate 3 first):
Rank the three strongest company-to-resume pairings. Start from the pre-scored resume matches above unless another resume item is clearly closer to the company context. For each one, state the exact company need, the exact resume evidence, and why that evidence matters here. The first ranked item should be the evidence used for Lead With.

LEAD WITH:
Identify the single strongest connection between this student's background and what this specific company needs right now. Use the first ranked item from the matched evidence map. This should reference a concrete company need, not a generic industry need, and a specific student experience. The advice should be obviously wrong if applied to a different company.

HOW TO FRAME IT:
Give the student a narrative angle for their entire candidacy at this company. This is not about listing skills. It is about telling them what story to tell and why that story resonates with this company's values, challenges, or goals. Be specific to the company.

GAP TO ADDRESS:
Identify the most important gap between the student's current profile and what this company expects. Give a concrete, actionable fix they can do in under a week, not "learn more about X" but "read [specific resource], then mention [specific concept] in your cover letter because [specific reason it matters to this company]".

YOUR ONE-LINER (Career Fair Intro):
Write a 1-2 sentence introduction the student can say at a career fair booth for this company. It must:
- Include their name, university, and major
- Reference something specific about the company, not just the industry
- Connect one concrete experience to a specific company need
- Sound natural when spoken out loud, not like a pitch script
- Use the student's actual name. Never use placeholders like [Your Name]
- Never use em dashes

TALKING POINTS (generate 3):
Each talking point should be a specific claim the student can make in conversation, backed by a resume detail and a company-specific reason why it matters. Each one should be different enough that the student can use them across a 5-minute conversation without repeating themselves. Format as natural sentences, not bullet templates. Never use em dashes.

NETWORKING PLAYBOOK:
Recommend the best role titles to target, where to find them, and a short outreach template that uses the strongest company-specific angle from this student's background.

APPLICATION OPTIMIZER:
Write resume tips, cover letter angles, and keywords that reflect this company's actual language, priorities, and current roles. Every suggestion must be specific enough that it would look strange if reused for another company.`;
}

function buildPersonalizedSectionsUserPrompt(retry = false) {
  return retry
    ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly."
    : "Generate the personalized sections and return only valid JSON.";
}

function buildBriefSummary(companyName: string, brief: SignalBrief) {
  const recentNews = brief.recent_news
    .slice(0, 3)
    .map((item) => `- ${item.date}: ${item.headline}. ${item.summary}`)
    .join("\n");

  const talkingPoints = brief.talking_points
    .slice(0, 3)
    .map((item) => `- ${item}`)
    .join("\n");

  const smartQuestions = brief.smart_questions
    .slice(0, 2)
    .map((item) => `- ${item}`)
    .join("\n");

  return `Company: ${companyName}
Industry: ${brief.company_overview.industry}
Overview: ${brief.company_overview.description}
Headquarters: ${brief.company_overview.headquarters}
Employee count: ${brief.company_overview.employee_count}
Culture: ${brief.culture_and_values.the_real_deal}
Financial health: ${brief.financial_health.summary}
Recent developments: ${brief.financial_health.recent_developments}
Lead with: ${brief.positioning_strategy.lead_with}
Frame it: ${brief.positioning_strategy.how_to_frame}
Gap to address: ${brief.positioning_strategy.gap_to_address}
One-line pitch: ${brief.positioning_strategy.one_line_pitch}
Paths in: ${brief.paths_in.active_postings_summary}
Hiring timeline: ${brief.paths_in.hiring_timeline}
Pro tip: ${brief.paths_in.pro_tip}

Recent news:
${recentNews || "- Could not verify recent news in this brief."}

Talking points:
${talkingPoints || "- Could not verify talking points in this brief."}

Smart questions:
${smartQuestions || "- Could not verify smart questions in this brief."}`;
}

function buildCareerFairMatchSystemPrompt() {
  return `You are Signal's career fair ranking engine.

Score fit honestly. A 90+ match should feel rare and clearly justified.

OUTPUT RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Return only valid JSON matching the schema.
- match_score must be an integer from 0 to 100.
- why_you_match must be exactly 1 sentence.
- Keep every pocket brief field concise and specific.
- one_liner should sound like the student's actual introduction at the booth.
- top_talking_point should be the single best proof point to lead with.
- best_question should sound researched, not generic.
- key_fact should reference a recent or notable fact from the brief.
- pro_tip should be practical and company-specific.
- If the student has limited direct fit, score conservatively and explain the nearest angle honestly.

SCORING CALIBRATION:
- If the student has a confirmed internship or job offer at this company, score 90-100.
- If the student has an internship at a direct competitor or in the same industry, score 80-90.
- If the student's major and career interests directly align with the company's core business, score 70-85.
- If there is partial alignment through transferable skills or an adjacent industry, score 50-69.
- If there is minimal alignment, score 30-49.
- Below 30 should be reserved for completely unrelated companies.
- Be generous but honest. Most students approaching a company at a career fair should score 50 or higher.`;
}

function buildCareerFairMatchUserPrompt(
  companyName: string,
  brief: SignalBrief,
  profile?: ProfileRecord | null,
  retry = false,
) {
  return `Given this student's profile and structured resume signals:
${buildStudentProfileSummary(profile)}

And this company brief:
${buildBriefSummary(companyName, brief)}

Rate how well this student matches this company on a scale of 0-100. Consider:
- skills alignment with what the company is hiring for
- industry or interest match
- experience relevance
- career trajectory fit

Also provide:
- a 1-sentence why_you_match explanation
- a pocket_brief with one_liner, top_talking_point, best_question, key_fact, and pro_tip

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Return only valid JSON."}`;
}

function buildCareerFairDiscoverySystemPrompt(universityName: string) {
  const currentYear = new Date().getFullYear();
  const currentDate = formatCurrentDate();

  return `You are Signal's campus recruiting scout.

Today is ${currentDate}. Search the web for upcoming career fairs at ${universityName}.

SEARCH INSTRUCTIONS:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Search for "${universityName} career fair ${currentYear}".
- Search for "${universityName} career fair upcoming".
- Search multiple sources, including university career center pages, Handshake listings, and event pages when available.
- Focus on fairs that are upcoming or recently announced relative to ${currentDate}.
- Be specific about the official fair name and the exact date.
- If you find a company list, include it as companies_found.
- If you cannot verify a company list, return companies_found as null.
- Prefer fairs that students can actually attend for internships, entry-level recruiting, or employer networking.

Return only valid JSON matching the schema. If nothing credible is found, return {"fairs": []}.`;
}

function buildCareerFairDiscoveryUserPrompt(universityName: string, retry = false) {
  return `Find upcoming career fairs for ${universityName}.

For each fair, return:
- the official fair name
- the date
- a source URL
- a short description
- companies_found if a verified company list is available

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Search the web first, then return only valid JSON."}`;
}

function buildOpportunityDiscoverySystemPrompt() {
  const currentDate = formatCurrentDate();

  return `You are Signal's opportunity discovery engine.

Today is ${currentDate}. Use web search to recommend 8-10 companies this student should be targeting for internships or entry-level roles.

RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Search for companies that are actively hiring in fields relevant to this student.
- Mix well-known companies with hidden gems the student probably has not considered.
- Include a mix of company sizes, including large, mid-size, and startup.
- Prioritize companies with active internship or entry-level hiring.
- For why_you_fit, explain the match using the student's structured resume signals, coursework, and interests.
- Avoid generic reasons like "they hire business majors" unless backed by a specific fit angle from the student's profile.
- what_they_hire_for should name the relevant roles, teams, or functions.
- hidden_gem should be true only when the company is meaningfully less obvious than the biggest household names.
- Return only valid JSON matching the schema.`;
}

function buildOpportunityDiscoveryUserPrompt(
  profile: ProfileRecord,
  retry = false,
) {
  return `Recommend 8-10 companies for this student.

STUDENT PROFILE:
${buildStudentProfileSummary(profile)}

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Search the web first, then return only valid JSON."}`;
}

function buildSearchRolesSystemPrompt() {
  const currentDate = formatCurrentDate();

  return `You are Signal's live role search engine.

Today is ${currentDate}. Use web search to find real, currently active job postings for college students and recent grads.

RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Search for actual active job postings, not career advice articles or company homepages unless the homepage is the job post itself.
- Prioritize LinkedIn and Indeed direct listing URLs.
- If a board listing is unavailable, a direct company careers posting URL is acceptable.
- Find up to 10 postings.
- Each posting must include a real, fully qualified apply URL that starts with http or https.
- Do not return labels like "Apply on company site" or "Submit online" in apply_url.
- Never return search-result URLs, including Indeed /q-..., Indeed /jobs?..., or LinkedIn /jobs/search....
- Never return a generic jobs index or careers index page. apply_url must be a specific posting page.
- Exclude postings that say they are closed, expired, removed, unavailable, or no longer accepting applications.
- role_title should be the exact posting title.
- location should be the city/state or Remote label shown in the posting.
- key_requirements should be 3-5 concise requirements or qualifications pulled from the posting.
- industry should be a short, useful label.
- company_size should be one of: Startup (1-50), Small (51-200), Mid-size (201-1000), Large (1000+), or Could not verify.
- Respect the role query and filters, but if the search is narrow and results are scarce, slightly broaden wording while staying relevant.
- Remove duplicates.
- Return only valid JSON matching the schema. If nothing active is found, return {"postings": []}.`;
}

function buildSearchRolesUserPrompt(
  request: RoleSearchRequest,
  retry = false,
) {
  const location = request.location.trim() || "Any location";
  const companySize = request.company_size === "Any" ? "Any company size" : request.company_size;
  const industry = request.industry === "Any" ? "Any industry" : request.industry;

  return `Search for active job postings for this request:

Role title: ${request.query}
Location: ${location}
Industry filter: ${industry}
Company size filter: ${companySize}

Use multiple searches that cover:
- "${request.query} internship ${location} 2026"
- "${request.query} entry level ${industry} jobs"
- "${request.query} ${companySize} hiring ${location}"

Only include postings that are live and clearly relevant.
Never include generic job-search result pages as apply_url.
Exclude postings that are closed, expired, removed, unavailable, or no longer accepting applications.

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Search the web first, then return only valid JSON."}`;
}

function buildSuggestedRolesSystemPrompt() {
  return `You are Signal's personalized role discovery strategist.

RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Infer 3-5 role categories the student should target.
- Role category titles must be specific, not generic. Good examples: "ESG Advisory Analyst Intern", "Sustainability Data Analyst", "Climate Risk Associate", "Strategy and Analytics Intern".
- Avoid generic titles like "Business Intern", "Finance Intern", or "Analyst".
- Each category reason must be one line under 20 words and must mention a real student signal, such as a skill, project, experience area, major, or interest.
- Do not search the web. Do not include job postings.
- Return only valid JSON matching the schema.
- If fewer than 5 categories are credible, return fewer. Quality matters more than count.`;
}

function buildSuggestedRolesUserPrompt(profile: ProfileRecord, retry = false) {
  return `Generate suggested role categories for this student.

STUDENT PROFILE:
${buildStudentProfileSummary(profile)}

You should infer categories from the student's actual resume evidence, major, minor, and interests.

${retry ? "Your previous output was invalid. Return only valid JSON that matches the schema exactly." : "Return only valid JSON."}`;
}

function buildDiscoverStudentFitContext(profile: ProfileRecord) {
  const structuredResume = getStructuredResume(profile);

  if (!structuredResume) {
    return `Academic profile:
- University: ${formatProfileValue(profile.university, "Rutgers University")}
- Major: ${formatProfileValue(profile.major)}
- Minor: ${formatProfileValue(profile.minor)}
- Graduation year: ${formatProfileValue(profile.graduation_year)}
- Career interests: ${formatProfileValue(profile.career_interests)}

Structured resume data: Resume not uploaded.`;
  }

  return `Academic profile:
- University: ${formatProfileValue(profile.university, "Rutgers University")}
- Major: ${formatProfileValue(profile.major)}
- Minor: ${formatProfileValue(profile.minor)}
- Graduation year: ${formatProfileValue(profile.graduation_year)}
- Career interests: ${formatProfileValue(profile.career_interests)}

Structured resume data:
${JSON.stringify(
    {
      education_details: structuredResume.education_details,
      relevant_experience: structuredResume.relevant_experience,
      quantified_achievements: structuredResume.quantified_achievements,
      extracurricular_activities: structuredResume.extracurricular_activities,
      soft_skills: structuredResume.soft_skills,
      technical_skills: structuredResume.technical_skills,
      positioning_signals: structuredResume.positioning_signals,
    },
    null,
    2,
  )}`;
}

function buildRoleWhyYouFitSystemPrompt() {
  return `You write Signal's "Why you fit" copy for live role cards.

RULES:
- Never use em dashes. Use commas, periods, semicolons, or colons instead.
- Write exactly one sentence per role, under 30 words.
- Also assign an interest_alignment_score from 0 to 15.
- Never mention the student's name, hometown, address, email, phone number, LinkedIn, or any other personal header detail.
- Use only the structured resume data and academic profile provided. Do not invent experience.
- Every sentence must connect one concrete resume proof point, skill, project, achievement, coursework signal, or extracurricular to one specific role requirement.
- Do not use a fill-in-the-blank template like "Your experience with X matches Y's need for Z."
- Avoid repeating the same sentence structure across roles.
- If direct evidence is limited, ground the sentence in the student's major, minor, interests, or extracurricular evidence without overstating the match.
- interest_alignment_score should reflect how closely the student's stated career interests match the job description and responsibilities, not just the title.
- Keep the tone direct and natural.
- Return the same roles in the same order by index.`;
}

function buildRoleWhyYouFitUserPrompt(
  roles: DiscoveredRole[],
  profile: ProfileRecord,
  retry = false,
) {
  const summarizedRoles = roles.map((role, index) => ({
    index,
    role_title: role.role_title,
    company_name: role.company_name,
    location: role.location,
    key_requirements: role.key_requirements,
    qualifications: role.qualifications,
    required_skills: role.required_skills,
    responsibilities: role.responsibilities,
    job_description: role.job_description,
    experience_months: role.experience_months,
    no_experience_required: role.no_experience_required,
    education_requirements: role.education_requirements,
    industry: role.industry,
    company_size: role.company_size,
    match_score: role.match_score,
    top_factor: role.match_breakdown.top_factor,
  }));

  return `Write "Why you fit" sentences for these discovered roles.

STUDENT CONTEXT:
${buildDiscoverStudentFitContext(profile)}

ROLES:
${JSON.stringify(summarizedRoles, null, 2)}

For each role:
- Choose the strongest supporting evidence from the structured resume data.
- Tie that evidence to one requirement from the role card.
- Keep the explanation specific enough that it would not make equal sense for every other role in the list.
- Score the student's interest alignment from 0 to 15 using their stated career interests against the job description and responsibilities.

Return only valid JSON that matches the schema exactly.${retry ? " Your previous output was invalid, so be stricter about the schema and the one-sentence limit." : ""}`;
}

function parseStructuredOutput<T>(
  output: string,
  schema: z.ZodType<T>,
  errorMessage: string,
) {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(sanitizeGeneratedJsonText(output));
  } catch {
    throw new InvalidBriefError("OpenAI returned invalid JSON.");
  }

  const parsed = schema.safeParse(sanitizeGeneratedContent(parsedJson));

  if (!parsed.success) {
    throw new InvalidBriefError(errorMessage);
  }

  return parsed.data;
}

function parseCompanyResearch(output: string) {
  return parseStructuredOutput(
    output,
    companyResearchSchema,
    "OpenAI returned JSON that did not match the company research schema.",
  );
}

function parsePersonalizedSections(output: string) {
  return parseStructuredOutput(
    output,
    personalizedSectionsSchema,
    "OpenAI returned JSON that did not match the personalized sections schema.",
  );
}

function parseCareerFairMatch(output: string): CareerFairMatch {
  return parseStructuredOutput(
    output,
    careerFairMatchSchema,
    "OpenAI returned JSON that did not match the career fair schema.",
  );
}

function parseCareerFairDiscovery(output: string): CareerFairDiscoveryResponse {
  return parseStructuredOutput(
    output,
    careerFairDiscoveryResponseSchema,
    "OpenAI returned JSON that did not match the fair discovery schema.",
  );
}

function parseOpportunityDiscovery(output: string): OpportunityDiscoveryResponse {
  return parseStructuredOutput(
    output,
    opportunityDiscoveryResponseSchema,
    "OpenAI returned JSON that did not match the opportunity discovery schema.",
  );
}

function isDirectApplyPostingUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    const hasSearchQuery = ["q", "query", "keywords", "keyword", "location", "l", "search"].some(
      (key) => parsed.searchParams.has(key),
    );
    const hasDirectJobParam = [
      "jk",
      "vjk",
      "jobid",
      "job_id",
      "jobkey",
      "gh_jid",
      "reqid",
      "requisitionid",
      "requisition_id",
      "postingid",
      "posting_id",
      "jid",
      "pid",
    ].some((key) => parsed.searchParams.has(key));

    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) {
      if (pathname.startsWith("/jobs/search") || pathname === "/jobs") {
        return false;
      }

      if (!pathname.startsWith("/jobs/view/")) {
        return false;
      }

      return /(\d{6,})(?:$|\/)/.test(pathname);
    }

    if (hostname === "indeed.com" || hostname.endsWith(".indeed.com")) {
      if (pathname.startsWith("/q-") || pathname === "/jobs" || pathname.startsWith("/jobs")) {
        return false;
      }

      if (/^\/(m\/)?viewjob(?:\/|$)/.test(pathname)) {
        return Boolean(parsed.searchParams.get("jk") || parsed.searchParams.get("vjk"));
      }

      if (/^\/job-detail\//.test(pathname) || /^\/job\//.test(pathname)) {
        return Boolean(parsed.searchParams.get("jk") || parsed.searchParams.get("vjk")) || /[a-z0-9]{12,}/.test(pathname);
      }

      return false;
    }

    if (pathname === "/" || pathname === "/jobs" || pathname === "/careers") {
      return false;
    }

    if (!hasDirectJobParam && hasSearchQuery) {
      return false;
    }

    if (
      pathname.includes("/search") ||
      pathname.includes("/results") ||
      pathname.includes("/jobs/search") ||
      pathname.includes("/careers/search")
    ) {
      return false;
    }

    if (hasDirectJobParam || /\d{4,}/.test(pathname)) {
      return true;
    }

    const segments = pathname.split("/").filter(Boolean);
    const hasJobContext = segments.some((segment) =>
      /job|career|position|opening|opportunit|vacanc|requisition|posting|intern|analyst|associate/.test(
        segment,
      ),
    );
    const hasDetailedSlug = segments.some((segment) => {
      const normalized = segment.replace(/\.[a-z0-9]{2,5}$/i, "");
      const words = normalized.split("-").filter(Boolean);
      return normalized.length >= 14 && words.length >= 3;
    });

    return hasJobContext && hasDetailedSlug;
  } catch {
    return false;
  }
}

function parseLiveRoleSearch(output: string) {
  const parsed = parseStructuredOutput(
    output,
    liveRoleSearchSchema,
    "OpenAI returned JSON that did not match the live role search schema.",
  );

  return {
    postings: parsed.postings.filter((posting) => isDirectApplyPostingUrl(posting.apply_url)),
  };
}

function parseSuggestedRoleDiscovery(output: string) {
  return parseStructuredOutput(
    output,
    suggestedRoleDiscoverySchema,
    "OpenAI returned JSON that did not match the suggested role discovery schema.",
  );
}

function parseRoleWhyYouFitBatch(output: string) {
  return parseStructuredOutput(
    output,
    roleWhyYouFitBatchSchema,
    'OpenAI returned JSON that did not match the role "Why you fit" schema.',
  );
}

function composeSignalBrief(
  companyResearch: CompanyResearch,
  personalizedSections: PersonalizedSections,
) {
  const combined = sanitizeGeneratedContent({
    company_overview: companyResearch.company_overview,
    recent_news: companyResearch.recent_news,
    culture_and_values: companyResearch.culture_and_values,
    financial_health: companyResearch.financial_health,
    red_flags: companyResearch.red_flags,
    positioning_strategy: personalizedSections.positioning_strategy,
    talking_points: personalizedSections.talking_points,
    smart_questions: companyResearch.smart_questions,
    paths_in: companyResearch.paths_in,
    networking_playbook: personalizedSections.networking_playbook,
    application_optimizer: personalizedSections.application_optimizer,
  });

  const parsed = signalBriefSchema.safeParse(combined);

  if (!parsed.success) {
    throw new InvalidBriefError("OpenAI returned JSON that did not match the brief schema.");
  }

  return parsed.data;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getIndefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

function enforceStudentIdentityInIntro(
  value: string,
  profile?: ProfileRecord | null,
) {
  const name = profile?.full_name?.trim();
  const university = profile?.university?.trim();
  const major = profile?.major?.trim();

  if (!name && !university && !major) {
    return value;
  }

  const hasName = name ? new RegExp(escapeRegExp(name), "i").test(value) : true;
  const hasUniversity = university
    ? new RegExp(escapeRegExp(university), "i").test(value)
    : true;
  const hasMajor = major ? new RegExp(escapeRegExp(major), "i").test(value) : true;
  const hasPlaceholder = /\[\s*your name\s*\]/i.test(value);

  if (hasName && hasUniversity && hasMajor && !hasPlaceholder) {
    return value;
  }

  const identity =
    name && major && university
      ? `Hi, I'm ${name}, ${getIndefiniteArticle(major)} ${major} student at ${university}.`
      : name && university
        ? `Hi, I'm ${name} from ${university}.`
        : name && major
          ? `Hi, I'm ${name}, ${getIndefiniteArticle(major)} ${major} student.`
          : name
            ? `Hi, I'm ${name}.`
            : university && major
              ? `Hi, I'm ${getIndefiniteArticle(major)} ${major} student at ${university}.`
              : university
                ? `Hi, I'm a student at ${university}.`
                : `Hi, I'm ${getIndefiniteArticle(major ?? "student")} ${major ?? "student"}.`;

      const remainder = value
    .replace(/\[\s*your name\s*\]/gi, "")
    .replace(/^hi,\s*i['’]m\s+[^.?!]+[.?!]\s*/i, "")
    .replace(/^hello,\s*i['’]m\s+[^.?!]+[.?!]\s*/i, "")
    .replace(/^i['’]m\s+[^.?!]+[.?!]\s*/i, "")
    .trim();

  return remainder ? `${identity} ${remainder}` : identity;
}

async function researchCompany(
  client: OpenAI,
  companyName: string,
  profile?: ProfileRecord | null,
) {
  let lastError: unknown;

  for (const strategy of researchStrategyConfigs) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.responses.create(
          {
            model: strategy.model,
            input: [
              { role: "system", content: buildCompanyResearchSystemPrompt(profile) },
              {
                role: "user",
                content: buildCompanyResearchUserPrompt(companyName, attempt === 1),
              },
            ],
            tools: [...strategy.tools],
            include: ["web_search_call.action.sources"],
            text: {
              format: {
                type: "json_schema",
                name: "company_research",
                strict: true,
                schema: companyResearchJsonSchema,
              },
            },
          },
          {
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (!response.output_text) {
          throw new InvalidBriefError("OpenAI returned an empty response.");
        }

        return parseCompanyResearch(response.output_text.trim());
      } catch (error) {
        lastError = error;

        const isSchemaError = error instanceof InvalidBriefError;
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

  throw lastError;
}

async function generatePersonalizedSections(
  client: OpenAI,
  companyName: string,
  companyResearch: CompanyResearch,
  profile?: ProfileRecord | null,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: "gpt-4o",
          input: [
            {
              role: "system",
              content: buildPersonalizedSectionsSystemPrompt(
                companyName,
                companyResearch,
                profile,
              ),
            },
            {
              role: "user",
              content: buildPersonalizedSectionsUserPrompt(attempt === 1),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "personalized_sections",
              strict: true,
              schema: personalizedSectionsJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(45_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      return parsePersonalizedSections(response.output_text.trim());
    } catch (error) {
      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Signal could not personalize the brief right now.");
}

export async function generateSignalBrief(
  companyName: string,
  profile?: ProfileRecord | null,
) {
  const client = getOpenAIClient();
  const companyResearch = await researchCompany(client, companyName, profile);
  const personalizedSections = await generatePersonalizedSections(
    client,
    companyName,
    companyResearch,
    profile,
  );

  const brief = composeSignalBrief(companyResearch, personalizedSections);

  return {
    ...brief,
    company_overview: {
      ...brief.company_overview,
      official_company_name: companyResearch.company_overview.official_company_name,
    },
    positioning_strategy: {
      ...brief.positioning_strategy,
      one_line_pitch: enforceStudentIdentityInIntro(
        brief.positioning_strategy.one_line_pitch,
        profile,
      ),
    },
  };
}

export async function generateCareerFairMatch(
  companyName: string,
  brief: SignalBrief,
  profile?: ProfileRecord | null,
) {
  const client = getOpenAIClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: buildCareerFairMatchSystemPrompt() },
            {
              role: "user",
              content: buildCareerFairMatchUserPrompt(
                companyName,
                brief,
                profile,
                attempt === 1,
              ),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "career_fair_match",
              strict: true,
              schema: careerFairMatchJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      const match = parseCareerFairMatch(response.output_text.trim());

      return {
        ...match,
        pocket_brief: {
          ...match.pocket_brief,
          one_liner: enforceStudentIdentityInIntro(
            match.pocket_brief.one_liner,
            profile,
          ),
        },
      };
    } catch (error) {
      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Signal could not score this company match.");
}

export async function discoverCareerFairs(universityName: string) {
  const client = getOpenAIClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: "gpt-4o",
          input: [
            { role: "system", content: buildCareerFairDiscoverySystemPrompt(universityName) },
            {
              role: "user",
              content: buildCareerFairDiscoveryUserPrompt(
                universityName,
                attempt === 1,
              ),
            },
          ],
          tools: [
            {
              type: "web_search",
              search_context_size: "medium",
              user_location: userLocation,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "career_fair_discovery",
              strict: true,
              schema: careerFairDiscoveryJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(45_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      return parseCareerFairDiscovery(response.output_text.trim());
    } catch (error) {
      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Signal could not discover career fairs right now.");
}

export async function searchLiveRoles(request: RoleSearchRequest): Promise<RolePosting[]> {
  const client = getOpenAIClient();
  const parsedRequest = roleSearchRequestSchema.parse(request);
  let lastError: unknown;

  for (const strategy of researchStrategyConfigs) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.responses.create(
          {
            model: strategy.model,
            input: [
              { role: "system", content: buildSearchRolesSystemPrompt() },
              {
                role: "user",
                content: buildSearchRolesUserPrompt(parsedRequest, attempt === 1),
              },
            ],
            tools: [...strategy.tools],
            include: ["web_search_call.action.sources"],
            text: {
              format: {
                type: "json_schema",
                name: "live_role_search",
                strict: true,
                schema: liveRoleSearchJsonSchema,
              },
            },
          },
          {
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (!response.output_text) {
          throw new InvalidBriefError("OpenAI returned an empty response.");
        }

        return parseLiveRoleSearch(response.output_text.trim()).postings;
      } catch (error) {
        lastError = error;

        const isSchemaError = error instanceof InvalidBriefError;
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

  throw lastError;
}

export async function discoverSuggestedRoles(
  profile: ProfileRecord,
): Promise<SuggestedRoleDiscoveryRaw> {
  const client = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: "gpt-4o",
          input: [
            { role: "system", content: buildSuggestedRolesSystemPrompt() },
            {
              role: "user",
              content: buildSuggestedRolesUserPrompt(profile, attempt === 1),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "suggested_role_discovery",
              strict: true,
              schema: suggestedRoleDiscoveryJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      return parseSuggestedRoleDiscovery(response.output_text.trim());
    } catch (error) {
      lastError = error;

      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function generateRoleWhyYouFitCopy(
  roles: DiscoveredRole[],
  profile: ProfileRecord,
) {
  if (!roles.length) {
    return roles;
  }

  const client = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: researchStrategyConfigs[0]?.model ?? "gpt-4o",
          input: [
            { role: "system", content: buildRoleWhyYouFitSystemPrompt() },
            {
              role: "user",
              content: buildRoleWhyYouFitUserPrompt(roles, profile, attempt === 1),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "role_why_you_fit_batch",
              strict: true,
              schema: roleWhyYouFitBatchJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      const parsed = parseRoleWhyYouFitBatch(response.output_text.trim());
      const generatedByIndex = new Map(
        parsed.roles.map((item) => [
          item.index,
          {
            whyYouFit: replaceEmDashes(item.why_you_fit).trim(),
            interestScore: item.interest_alignment_score,
          },
        ]),
      );

      return roles.map((role, index) => {
          const generated = generatedByIndex.get(index);

          if (!generated) {
            return role;
          }

          return {
            ...applyInterestAlignmentScore(role, generated.interestScore),
            why_you_fit: generated.whyYouFit || role.why_you_fit,
          };
        });
    } catch (error) {
      lastError = error;

      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      break;
    }
  }

  console.error("Signal could not generate AI role fit copy, using fallback copy instead.", lastError);
  return roles;
}

export async function discoverOpportunities(profile: ProfileRecord) {
  const client = getOpenAIClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.create(
        {
          model: "gpt-4o",
          input: [
            { role: "system", content: buildOpportunityDiscoverySystemPrompt() },
            {
              role: "user",
              content: buildOpportunityDiscoveryUserPrompt(
                profile,
                attempt === 1,
              ),
            },
          ],
          tools: [
            {
              type: "web_search",
              search_context_size: "medium",
              user_location: userLocation,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "opportunity_discovery",
              strict: true,
              schema: opportunityDiscoveryJsonSchema,
            },
          },
        },
        {
          signal: AbortSignal.timeout(60_000),
        },
      );

      if (!response.output_text) {
        throw new InvalidBriefError("OpenAI returned an empty response.");
      }

      return parseOpportunityDiscovery(response.output_text.trim());
    } catch (error) {
      if (error instanceof InvalidBriefError && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Signal could not discover opportunities right now.");
}

export function getOpenAIErrorMessage(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return {
        status: 429,
        message:
          "OpenAI rate-limited the request. Please wait a moment and try again.",
      };
    }

    if (error.status === 401) {
      return {
        status: 500,
        message:
          "OpenAI authentication failed. Double-check your OPENAI_API_KEY in .env.local.",
      };
    }

    return {
      status: error.status ?? 500,
      message:
        error.message ||
        "OpenAI could not generate the brief right now. Please try again.",
    };
  }

  if (error instanceof InvalidBriefError) {
    return {
      status: 502,
      message:
        "Signal received an invalid response while building the brief. Please try again.",
    };
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      status: 504,
      message:
        "Brief generation took longer than 60 seconds. Please try again in a moment.",
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: "Something went wrong while generating the brief.",
  };
}
