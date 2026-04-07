import * as openaiModule from "../lib/openai";
import { searchJobsForCategory, searchJobsForRequest } from "../lib/jobs";
import { analyzeResumeText } from "../lib/resume";
import { scoreRolePostings } from "../lib/role-match";
import type { ProfileRecord } from "../lib/types";

const { discoverSuggestedRoles, generateRoleWhyYouFitCopy } = openaiModule;

const profile: ProfileRecord = {
  id: "test-profile",
  full_name: "Jonathan Rotstein",
  university: "Rutgers University",
  major: "Economics",
  minor: "Data Science",
  double_major: null,
  graduation_year: 2027,
  career_interests: "consulting, ESG, sustainability strategy, analytics",
  resume_text: `Jonathan Rotstein
Tenafly, NJ
jonathanrotstein117@gmail.com | linkedin.com/in/jonathanrotstein

EDUCATION
Rutgers University | B.A. Economics, Minor in Data Science | May 2027

EXPERIENCE
Risk Advisory Intern, KPMG
- Built an Excel and Power BI controls-testing tracker used by 5 associates across 12 client workstreams, cutting weekly status prep by 30%.
- Presented findings to a client-facing manager and summarized control gaps across SOX testing for retail and industrial accounts.

Sustainability Research Assistant, Rutgers Business School
- Analyzed 40+ ESG reports and SASB disclosures for public companies, then built a JSON dataset to compare materiality topics across sectors.
- Wrote 2 briefing memos on Scope 3 disclosure trends and assurance adoption for a student-led sustainability project.

Peer Mentor, Rutgers Center for Students with Disabilities
- Supported 8 students with executive-function or learning accommodations and adapted weekly study plans based on changing needs.

PROJECTS
AI Automation Project
- Built a Python tool that scraped public CSR news, summarized updates, and auto-tagged them by reporting theme, reducing manual review time by 60%.
- Created a Tableau dashboard to track sustainability initiatives across 25 firms.

Campus Vintage Resale Business
- Ran an Instagram and Shopify side business while taking a full course load, fulfilled 120+ orders, and kept the return rate under 3%.

SKILLS
Python, Excel, Power BI, Tableau, JSON, SQL`,
  resume_filename: "test-resume.pdf",
  updated_at: new Date().toISOString(),
};

async function main() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("<paste-")) {
    console.log("OPENAI_API_KEY is missing, skipping live role discovery verification.");
    process.exit(0);
  }

  const structuredResume = analyzeResumeText(profile.resume_text ?? "", {
    graduationYear: profile.graduation_year,
    major: profile.major,
  });
  const resumeEvidenceDump = JSON.stringify(structuredResume);

  console.log(
    `Header stripped: name=${/jonathan rotstein/i.test(resumeEvidenceDump)} city=${/tenafly/i.test(resumeEvidenceDump)}`,
  );
  const suggested = await discoverSuggestedRoles(profile);
  const searchResults = await searchJobsForRequest({
    query: "ESG Intern",
    location: "New York",
    industry: "Any",
    company_size: "Any",
  });

  console.log(`Suggested categories: ${suggested.categories.length}`);

  const suggestedScored = suggested.categories.slice(0, 3).map((category) => ({
    ...category,
    roles: [],
  }));
  const suggestedRoleGroups = await Promise.all(
    suggestedScored.map(async (category) => {
      const searchResult = await searchJobsForCategory(category.title);

      console.log(
        `Category search outcome: ${category.title} | status=${searchResult.status} | source=${searchResult.source}`,
      );

      return scoreRolePostings(searchResult.postings, profile).slice(0, 2);
    }),
  );
  const suggestedGenerated = await generateRoleWhyYouFitCopy(
    suggestedRoleGroups.flat(),
    profile,
  );
  let suggestedOffset = 0;

  suggestedScored.forEach((category, index) => {
    const generatedRoles = suggestedGenerated.slice(
      suggestedOffset,
      suggestedOffset + suggestedRoleGroups[index].length,
    );
    suggestedOffset += suggestedRoleGroups[index].length;
    console.log(`Category ${index + 1}: ${category.title} | ${category.reason}`);
    generatedRoles.forEach((role) => {
      console.log(
        `- ${role.role_title} @ ${role.company_name} | ${role.match_score}% | ${role.why_you_fit}`,
      );
    });
  });

  const scoredSearch = scoreRolePostings(searchResults, profile).slice(0, 5);
  const generatedSearch = await generateRoleWhyYouFitCopy(scoredSearch, profile);

  console.log(`Search roles found: ${scoredSearch.length}`);
  generatedSearch.forEach((role) => {
    console.log(
      `- ${role.role_title} @ ${role.company_name} | ${role.match_score}% | ${role.why_you_fit}`,
    );
  });

  const allWhyYouFit = [...suggestedGenerated, ...generatedSearch].map(
    (role) => role.why_you_fit,
  );
  const whyYouFitDump = allWhyYouFit.join("\n");
  const uniqueSentences = new Set(
    allWhyYouFit.map((sentence) => sentence.trim().toLowerCase()),
  ).size;

  console.log(`WHY YOU FIT CHECKS:`);
  console.log(`- name present: ${/jonathan rotstein/i.test(whyYouFitDump)}`);
  console.log(`- city present: ${/tenafly/i.test(whyYouFitDump)}`);
  console.log(`- em dash present: ${whyYouFitDump.includes("—")}`);
  console.log(`- unique sentences: ${uniqueSentences}/${allWhyYouFit.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
