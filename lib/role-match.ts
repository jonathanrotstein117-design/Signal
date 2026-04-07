import { replaceEmDashes } from "@/lib/generated-content";
import {
  analyzeResumeText,
  type StructuredResume,
  type StructuredResumeEvidence,
} from "@/lib/resume";
import type {
  DiscoveredRole,
  ProfileRecord,
  RoleMatchBreakdown,
  RolePosting,
} from "@/lib/types";

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "their",
  "role",
  "roles",
  "work",
  "team",
  "using",
  "used",
  "will",
  "are",
  "our",
  "you",
  "job",
  "jobs",
  "entry",
  "level",
  "internship",
  "intern",
  "associate",
  "analyst",
  "candidate",
]);

const profileKeywordMap: Record<string, string[]> = {
  economics: [
    "economics",
    "finance",
    "financial",
    "risk",
    "policy",
    "strategy",
    "consulting",
    "analytics",
    "business",
    "operations",
    "esg",
    "sustainability",
  ],
  business: [
    "business",
    "operations",
    "strategy",
    "consulting",
    "marketing",
    "finance",
    "sales",
  ],
  accounting: ["accounting", "audit", "assurance", "tax", "controls", "compliance"],
  finance: ["finance", "financial", "investment", "valuation", "banking", "risk"],
  marketing: ["marketing", "brand", "growth", "content", "communications", "consumer"],
  "data science": [
    "data",
    "analytics",
    "analyst",
    "sql",
    "python",
    "automation",
    "machine",
    "learning",
    "ai",
    "insights",
  ],
  "computer science": [
    "software",
    "engineering",
    "developer",
    "data",
    "ai",
    "automation",
    "cloud",
    "product",
  ],
  environmental: [
    "environmental",
    "climate",
    "energy",
    "esg",
    "sustainability",
    "reporting",
  ],
  sustainability: [
    "esg",
    "sustainability",
    "climate",
    "reporting",
    "disclosure",
    "carbon",
    "scope",
  ],
  psychology: ["psychology", "behavior", "research", "people", "healthcare", "support"],
  biology: ["biology", "healthcare", "clinical", "lab", "research", "science"],
  political: ["policy", "government", "public", "research", "analysis", "regulatory"],
};

const prioritizedFactors: RoleMatchBreakdown["top_factor"][] = [
  "skills",
  "experience",
  "education",
  "interests",
];

export interface RoleMatchContext {
  profile: ProfileRecord;
  structuredResume: StructuredResume | null;
  resumeTokens: Set<string>;
  profileFieldTokens: Set<string>;
  interestTokens: Set<string>;
  evidenceItems: StructuredResumeEvidence[];
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function tokenize(value: string) {
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

          return !stopWords.has(token);
        }),
    ),
  );
}

function addMappedKeywords(target: Set<string>, value: string | null | undefined) {
  if (!value) {
    return;
  }

  const normalized = value.toLowerCase();
  tokenize(value).forEach((token) => target.add(token));

  Object.entries(profileKeywordMap).forEach(([key, keywords]) => {
    if (normalized.includes(key)) {
      keywords.forEach((keyword) => target.add(keyword));
    }
  });
}

function buildResumeTokens(profile: ProfileRecord, structuredResume: StructuredResume | null) {
  const tokens = new Set<string>();
  const fieldTokens = new Set<string>();
  const interestTokens = new Set<string>();

  addMappedKeywords(fieldTokens, profile.major);
  addMappedKeywords(fieldTokens, profile.minor);
  addMappedKeywords(fieldTokens, profile.double_major);
  addMappedKeywords(interestTokens, profile.career_interests);

  fieldTokens.forEach((token) => tokens.add(token));
  interestTokens.forEach((token) => tokens.add(token));

  if (!structuredResume) {
    return {
      resumeTokens: tokens,
      profileFieldTokens: fieldTokens,
      interestTokens,
      evidenceItems: [],
    };
  }

  structuredResume.technical_skills.explicit.forEach((skill) =>
    tokenize(skill).forEach((token) => tokens.add(token)),
  );
  structuredResume.technical_skills.implied.forEach((skill) =>
    tokenize(skill).forEach((token) => tokens.add(token)),
  );
  structuredResume.positioning_signals.forEach((signal) =>
    tokenize(signal).forEach((token) => tokens.add(token)),
  );
  structuredResume.education_details.forEach((detail) =>
    tokenize(detail).forEach((token) => tokens.add(token)),
  );
  structuredResume.extracurricular_activities.forEach((activity) =>
    tokenize(activity).forEach((token) => tokens.add(token)),
  );
  structuredResume.relevant_experience.forEach((item) =>
    tokenize(item.evidence).forEach((token) => tokens.add(token)),
  );
  structuredResume.quantified_achievements.forEach((item) =>
    tokenize(item.evidence).forEach((token) => tokens.add(token)),
  );

  return {
    resumeTokens: tokens,
    profileFieldTokens: fieldTokens,
    interestTokens,
    evidenceItems: [
      ...structuredResume.relevant_experience,
      ...structuredResume.quantified_achievements,
    ],
  };
}

function getOverlap(left: Iterable<string>, right: Set<string>) {
  const matches: string[] = [];

  for (const token of left) {
    if (right.has(token)) {
      matches.push(token);
    }
  }

  return matches;
}

function findBestEvidence(
  requirement: string,
  evidenceItems: StructuredResumeEvidence[],
  profileFieldTokens: Set<string>,
) {
  const requirementTokens = tokenize(requirement);
  let best: { evidence: StructuredResumeEvidence; overlap: string[] } | null = null;

  for (const evidence of evidenceItems) {
    const evidenceTokens = new Set([
      ...tokenize(evidence.evidence),
      ...evidence.technical_skills.flatMap((skill) => tokenize(skill)),
      ...evidence.implied_soft_skills.flatMap((skill) => tokenize(skill)),
      ...profileFieldTokens,
    ]);
    const overlap = getOverlap(requirementTokens, evidenceTokens);

    if (!overlap.length) {
      continue;
    }

    if (!best || overlap.length > best.overlap.length) {
      best = { evidence, overlap };
    }
  }

  return best;
}

function getRoleTokens(posting: RolePosting) {
  return tokenize(
    [
      posting.job_description,
      posting.role_title,
      posting.industry,
      posting.company_size,
      posting.key_requirements.join(" "),
      posting.qualifications.join(" "),
      posting.required_skills.join(" "),
      posting.responsibilities.join(" "),
    ].join(" "),
  );
}

function getRequirementTexts(posting: RolePosting) {
  return unique(
    [
      ...posting.required_skills,
      ...posting.qualifications,
      ...posting.key_requirements,
    ]
      .map((value) => value.trim())
      .filter(Boolean),
  ).slice(0, 8);
}

function calculatePartialMatchScore(requirementTokens: string[], resumeTokens: Set<string>) {
  if (!requirementTokens.length) {
    return 0;
  }

  const overlap = getOverlap(requirementTokens, resumeTokens);
  return overlap.length / Math.max(requirementTokens.length, 2);
}

function scoreSkills(posting: RolePosting, context: RoleMatchContext) {
  const requirements = getRequirementTexts(posting);
  const matched: string[] = [];
  let bestRequirement = requirements[0] ?? posting.role_title;
  let bestEvidence: StructuredResumeEvidence | null = null;
  let bestOverlap = 0;
  let weightedMatches = 0;
  let totalWeight = 0;

  for (const requirement of requirements) {
    const requirementTokens = tokenize(requirement);
    const overlap = getOverlap(requirementTokens, context.resumeTokens);
    const partialMatch = calculatePartialMatchScore(requirementTokens, context.resumeTokens);
    const isRequiredSkill = posting.required_skills.includes(requirement);
    const isQualification = posting.qualifications.includes(requirement);
    const weight = isRequiredSkill ? 1.4 : isQualification ? 1.1 : 1;
    totalWeight += weight;

    if (overlap.length || partialMatch >= 0.22) {
      matched.push(requirement);
    }

    if (partialMatch >= 0.6) {
      weightedMatches += weight;
    } else if (partialMatch >= 0.33) {
      weightedMatches += weight * 0.72;
    } else if (partialMatch >= 0.18) {
      weightedMatches += weight * 0.35;
    }

    const evidenceMatch = findBestEvidence(
      requirement,
      context.evidenceItems,
      context.profileFieldTokens,
    );

    if (evidenceMatch && evidenceMatch.overlap.length > bestOverlap) {
      bestRequirement = requirement;
      bestEvidence = evidenceMatch.evidence;
      bestOverlap = evidenceMatch.overlap.length;
    }
  }

  const score = totalWeight
    ? Math.min(40, Math.round((weightedMatches / totalWeight) * 40))
    : 0;

  return {
    score,
    matchedRequirements: matched,
    bestRequirement,
    bestEvidence,
  };
}

function scoreEducation(posting: RolePosting, context: RoleMatchContext) {
  const educationText = [
    posting.role_title,
    posting.qualifications.join(" "),
    posting.key_requirements.join(" "),
    posting.job_description,
  ].join(" ");
  const roleTokens = new Set(tokenize(educationText));
  const overlap = getOverlap(context.profileFieldTokens, roleTokens);
  let score = 4;

  if (posting.education_requirements.bachelors_degree && context.profile.major?.trim()) {
    score = 10;
  }

  if (overlap.length >= 5) {
    return 25;
  }

  if (overlap.length >= 3) {
    return Math.max(score, 21);
  }

  if (overlap.length >= 2) {
    return Math.max(score, 17);
  }

  if (overlap.length >= 1) {
    return Math.max(score, 12);
  }

  if (posting.education_requirements.bachelors_degree && context.profile.university?.trim()) {
    return Math.max(score, 9);
  }

  return score;
}

function scoreExperience(posting: RolePosting, context: RoleMatchContext) {
  const roleText = [
    posting.role_title,
    posting.key_requirements.join(" "),
    posting.qualifications.join(" "),
    posting.job_description,
  ]
    .join(" ")
    .toLowerCase();
  let score = 10;

  if (posting.no_experience_required) {
    score = 20;
  } else if (typeof posting.experience_months === "number") {
    if (posting.experience_months <= 12) {
      score = 18;
    } else if (posting.experience_months <= 24) {
      score = 14;
    } else if (posting.experience_months <= 36) {
      score = 9;
    } else {
      score = 4;
    }
  } else if (/\bsenior\b|\bmanager\b|\bdirector\b|\blead\b|\bprincipal\b/.test(roleText)) {
    score = 2;
  } else if (/\bintern\b|\binternship\b|\bco-?op\b|\bstudent\b/.test(roleText)) {
    score = 18;
  } else if (
    /\bentry\b|\bnew grad\b|\bassociate\b|\banalyst\b|\bassistant\b|\bcoordinator\b|\bspecialist\b/.test(
      roleText,
    )
  ) {
    score = 15;
  } else if (/\bconsultant\b|\badvisor\b|\bresearch\b|\boperations\b/.test(roleText)) {
    score = 12;
  }

  if (
    context.evidenceItems.some((item) =>
      tokenize(item.evidence).some((token) => roleText.includes(token)),
    )
  ) {
    score += 4;
  }

  if (context.profile.graduation_year) {
    const distance = context.profile.graduation_year - new Date().getFullYear();

    if (
      distance >= 0 &&
      distance <= 2 &&
      /\bintern\b|\bassociate\b|\banalyst\b|\bentry\b|\bstudent\b/.test(roleText)
    ) {
      score += 2;
    }
  }

  return Math.min(20, Math.max(0, score));
}

function scoreInterests(posting: RolePosting, context: RoleMatchContext) {
  const roleTokens = new Set(getRoleTokens(posting));
  const overlap = getOverlap(context.interestTokens, roleTokens);

  if (overlap.length >= 4) {
    return 15;
  }

  if (overlap.length >= 2) {
    return 11;
  }

  if (overlap.length >= 1) {
    return 7;
  }

  return 2;
}

function determineTopFactor(
  factorValues: Omit<RoleMatchBreakdown, "top_factor">,
): RoleMatchBreakdown["top_factor"] {
  return (
    prioritizedFactors.find(
      (factor) => factorValues[factor] === Math.max(...Object.values(factorValues)),
    ) ?? "skills"
  );
}

function getMatchScore(
  factorValues: Omit<RoleMatchBreakdown, "top_factor">,
) {
  return Math.max(
    0,
    Math.min(
      100,
      factorValues.skills +
        factorValues.education +
        factorValues.experience +
        factorValues.interests,
    ),
  );
}

function trimToWordCount(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/);

  if (words.length <= maxWords) {
    return value.trim();
  }

  return `${words.slice(0, maxWords).join(" ").replace(/[,.]+$/, "")}.`;
}

function formatListSummary(items: string[], maxItems = 2) {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  if (!normalized.length) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  return `${normalized.slice(0, -1).join(", ")} and ${normalized.at(-1)}`;
}

function cleanRequirementPhrase(requirement: string) {
  return requirement
    .trim()
    .replace(/\.$/, "")
    .replace(/^(experience in|experience with|background in|ability to|ability for|strong|proficiency in|proficient in|knowledge of|understanding of|interest in)\s+/i, "")
    .replace(/\s+/g, " ");
}

function buildEvidenceSummary(evidence: StructuredResumeEvidence) {
  const skillSummary = formatListSummary(evidence.technical_skills);

  if (skillSummary) {
    const prefix = evidence.source_section === "Projects" ? "project work in" : "experience using";
    return `${prefix} ${skillSummary}`;
  }

  if (evidence.implied_soft_skills.length) {
    return `${formatListSummary(
      evidence.implied_soft_skills.map((skill) => skill.toLowerCase()),
    )} from ${evidence.source_section.toLowerCase()} work`;
  }

  const fragment = evidence.evidence
    .replace(/\.$/, "")
    .split(/[;,]/)[0]
    .trim();

  if (!fragment) {
    return "relevant hands-on experience";
  }

  return fragment[0].toLowerCase() + fragment.slice(1);
}

function buildWhyYouFit(
  posting: RolePosting,
  breakdown: RoleMatchBreakdown,
  skillsInfo: ReturnType<typeof scoreSkills>,
  context: RoleMatchContext,
) {
  let sentence = "";

  if (breakdown.top_factor === "skills" && skillsInfo.bestEvidence) {
    sentence = `${buildEvidenceSummary(skillsInfo.bestEvidence)} fits this role's focus on ${cleanRequirementPhrase(skillsInfo.bestRequirement)}.`;
  } else if (breakdown.top_factor === "education") {
    const majorLabel = context.profile.minor?.trim()
      ? `${context.profile.major ?? "academic"} and ${context.profile.minor} training`
      : `${context.profile.major ?? "academic"} background`;
    sentence = `Your ${majorLabel} supports the field knowledge this ${posting.role_title.toLowerCase()} role expects.`;
  } else if (breakdown.top_factor === "experience") {
    sentence = `Your internship and project work fit the hands-on scope of this ${posting.role_title.toLowerCase()} role.`;
  } else {
    const interest = context.profile.career_interests?.split(",")[0]?.trim() || "this field";
    sentence = `Your interest in ${interest} aligns with the focus of this ${posting.role_title.toLowerCase()} opening.`;
  }

  return replaceEmDashes(trimToWordCount(sentence, 29));
}

export function createRoleMatchContext(profile: ProfileRecord): RoleMatchContext {
  const structuredResume = profile.resume_text?.trim()
    ? analyzeResumeText(profile.resume_text.trim(), {
        graduationYear: profile.graduation_year,
        major: profile.major,
      })
    : null;
  const resumeContext = buildResumeTokens(profile, structuredResume);

  return {
    profile,
    structuredResume,
    ...resumeContext,
  };
}

export function calculateRoleMatchScore(
  posting: RolePosting,
  context: RoleMatchContext,
): DiscoveredRole {
  const skills = scoreSkills(posting, context);
  const education = scoreEducation(posting, context);
  const experience = scoreExperience(posting, context);
  const interests = scoreInterests(posting, context);

  const factorValues: Omit<RoleMatchBreakdown, "top_factor"> = {
    skills: skills.score,
    education,
    experience,
    interests,
  };

  const match_breakdown: RoleMatchBreakdown = {
    ...factorValues,
    top_factor: determineTopFactor(factorValues),
  };

  return {
    ...posting,
    match_score: getMatchScore(factorValues),
    why_you_fit: buildWhyYouFit(posting, match_breakdown, skills, context),
    match_breakdown,
  };
}

export function applyInterestAlignmentScore(
  role: DiscoveredRole,
  interestsScore: number,
): DiscoveredRole {
  const factorValues: Omit<RoleMatchBreakdown, "top_factor"> = {
    skills: role.match_breakdown.skills,
    education: role.match_breakdown.education,
    experience: role.match_breakdown.experience,
    interests: Math.max(0, Math.min(15, Math.round(interestsScore))),
  };

  return {
    ...role,
    match_score: getMatchScore(factorValues),
    match_breakdown: {
      ...factorValues,
      top_factor: determineTopFactor(factorValues),
    },
  };
}

export function scoreRolePostings(postings: RolePosting[], profile: ProfileRecord) {
  const context = createRoleMatchContext(profile);

  return postings
    .map((posting) => calculateRoleMatchScore(posting, context))
    .sort((left, right) => right.match_score - left.match_score);
}
