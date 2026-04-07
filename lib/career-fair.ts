import type {
  CareerFairCompany,
  CareerFairCompanyStatus,
  PocketBrief,
} from "@/lib/types";

export const MAX_CAREER_FAIR_COMPANIES = 20;

export function normalizeCompanyName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseCompanyList(value: string) {
  return value
    .split(/[\n,]+/)
    .map(normalizeCompanyName)
    .filter(Boolean);
}

export function dedupeCompanies(companies: string[]) {
  const seen = new Set<string>();

  return companies.filter((company) => {
    const key = company.toLocaleLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function mergeCompanyLists(existing: string[], incoming: string[]) {
  return dedupeCompanies([...existing, ...incoming]).slice(
    0,
    MAX_CAREER_FAIR_COMPANIES,
  );
}

export function createPendingCompany(name: string): CareerFairCompany {
  return {
    name,
    match_score: null,
    brief_id: null,
    status: "pending",
    why_you_match: null,
    industry: null,
    pocket_brief: null,
    error_message: null,
  };
}

export function createPendingCompanies(names: string[]) {
  return names.map(createPendingCompany);
}

export function getCareerFairProgress(companies: CareerFairCompany[]) {
  const completed = companies.filter((company) => company.status === "completed").length;
  const errors = companies.filter((company) => company.status === "error").length;
  const processing = companies.filter((company) => company.status === "processing").length;
  const terminal = completed + errors;
  const remaining = Math.max(companies.length - terminal, 0);

  return {
    total: companies.length,
    completed,
    errors,
    processing,
    terminal,
    remaining,
  };
}

export function getCareerFairStatus(companies: CareerFairCompany[]): CareerFairCompanyStatus {
  if (companies.some((company) => company.status === "processing")) {
    return "processing";
  }

  if (companies.some((company) => company.status === "pending")) {
    return "pending";
  }

  if (companies.some((company) => company.status === "completed")) {
    return "completed";
  }

  return "error";
}

export function sortCareerFairCompanies(companies: CareerFairCompany[]) {
  return [...companies].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "completed") {
        return -1;
      }

      if (right.status === "completed") {
        return 1;
      }
    }

    const rightScore = right.match_score ?? -1;
    const leftScore = left.match_score ?? -1;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.name.localeCompare(right.name);
  });
}

export function estimateRemainingMinutes(companies: CareerFairCompany[]) {
  const { remaining } = getCareerFairProgress(companies);

  if (!remaining) {
    return 0;
  }

  return Math.max(1, Math.ceil(remaining * 0.7));
}

export function hasPocketBrief(
  pocketBrief: PocketBrief | null | undefined,
): pocketBrief is PocketBrief {
  return Boolean(pocketBrief);
}
