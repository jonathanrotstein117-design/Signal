import * as openaiModule from "../lib/openai";
import type { ProfileRecord } from "../lib/types";

const { generateSignalBrief } = openaiModule;

const profile: ProfileRecord = {
  id: "test-profile",
  full_name: "Avery Patel",
  university: "Rutgers University",
  major: "Economics",
  minor: "Data Science",
  double_major: null,
  graduation_year: 2027,
  career_interests: "consulting, ESG, sustainability strategy, analytics",
  resume_text: `EDUCATION
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
  const companies = ["PwC", "G&A Institute"];
  const briefs = await Promise.all(
    companies.map((company) => generateSignalBrief(company, profile)),
  );

  for (const [index, brief] of briefs.entries()) {
    const company = companies[index];
    const output = JSON.stringify(brief);

    console.log(`COMPANY: ${company}`);
    console.log(`LEAD WITH: ${brief.positioning_strategy.lead_with}`);
    console.log(`HOW TO FRAME IT: ${brief.positioning_strategy.how_to_frame}`);
    console.log(`ONE-LINER: ${brief.positioning_strategy.one_line_pitch}`);
    console.log(`EM DASHES: ${output.includes("—")}`);
    console.log("---");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
