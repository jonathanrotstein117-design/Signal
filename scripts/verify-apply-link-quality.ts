import { searchJobsForCategory } from "../lib/jobs";

const sampledCategories = [
  "ESG Legal Intern (Summer 2026)",
  "Sustainability Intern",
  "Sustainability Data Analyst",
];

const knownBrokenUrls = new Set(
  [
    "https://www.indeed.com/q-internship-esg-intern-jobs.html",
    "https://www.indeed.com/q-Esg-Intern-l-United-States-jobs.html",
    "https://www.indeed.com/q-data-analyst-remote-sustainability-jobs.html",
    "https://www.linkedin.com/jobs/view/sustainability-data-analyst-at-horizontal-talent-4374549375",
  ].map((url) => url.toLowerCase()),
);

const genericSearchUrlPatterns = [
  /indeed\.com\/q-[^/?#]+/i,
  /indeed\.com\/jobs(?:\?|$)/i,
  /linkedin\.com\/jobs\/search/i,
];
const inactivePostingPatterns = [
  /no longer accepting applications/i,
  /job posting has expired/i,
  /job is closed/i,
  /job is no longer available/i,
  /position has been filled/i,
  /job id provided may not be valid/i,
  /job posting has been removed/i,
  /unable to load the page/i,
];

function isLinkedInBrowserOnlyThrottle(url: string, status: number) {
  return /linkedin\.com\/jobs\/view\//i.test(url) && status === 429;
}

async function main() {
  const rapidApiKey = process.env.RAPIDAPI_KEY?.trim();
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  const hasRapidApiKey = Boolean(
    rapidApiKey && !rapidApiKey.includes("your_rapidapi_key_here"),
  );
  const hasOpenAiApiKey = Boolean(openAiApiKey && !openAiApiKey.includes("<paste-"));

  if (!hasRapidApiKey && !hasOpenAiApiKey) {
    console.log(
      "Skipping apply-link verification: configure RAPIDAPI_KEY or OPENAI_API_KEY first.",
    );
    process.exit(0);
  }

  const allReturnedUrls: string[] = [];

  for (const category of sampledCategories) {
    const searchResult = await searchJobsForCategory(category, { forceRefresh: true });
    const results = searchResult.postings;

    console.log(
      `${category}: ${results.length} role(s) [status=${searchResult.status}, source=${searchResult.source}]`,
    );

    if (searchResult.status === "source_unavailable") {
      throw new Error(
        `Category search is temporarily unavailable for "${category}" (${searchResult.reason ?? "unknown"}).`,
      );
    }

    results.forEach((role) => {
      allReturnedUrls.push(role.apply_url);
      console.log(`- ${role.company_name}: ${role.apply_url}`);
    });
  }

  const genericSearchMatches = allReturnedUrls.filter((url) =>
    genericSearchUrlPatterns.some((pattern) => pattern.test(url)),
  );
  const knownBrokenMatches = allReturnedUrls.filter((url) =>
    knownBrokenUrls.has(url.toLowerCase()),
  );

  const probeFailures = (
    await Promise.allSettled(
      allReturnedUrls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            cache: "no-store",
            signal: AbortSignal.timeout(3_000),
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.9",
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });

          if (response.status >= 400) {
            if (isLinkedInBrowserOnlyThrottle(url, response.status)) {
              return null;
            }

            return `${url} -> HTTP ${response.status}`;
          }

          const body = (await response.text().catch(() => "")).slice(0, 16_000);

          if (inactivePostingPatterns.some((pattern) => pattern.test(body))) {
            return `${url} -> inactive posting signal detected`;
          }

          return null;
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown probe failure";
          return `${url} -> ${message}`;
        }
      }),
    )
  )
    .map((result) => (result.status === "fulfilled" ? result.value : "probe task failed"))
    .filter((value): value is string => Boolean(value));

  const failures = [
    ...genericSearchMatches.map((url) => `Generic search URL returned: ${url}`),
    ...knownBrokenMatches.map((url) => `Known broken URL returned: ${url}`),
    ...probeFailures.map((value) => `Probe failure: ${value}`),
  ];

  if (failures.length) {
    console.error("\nApply-link quality failures:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log("\nApply-link quality checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
