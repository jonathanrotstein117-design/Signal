import { searchJobsForRequest } from "../lib/jobs";

async function main() {
  const results = await searchJobsForRequest(
    {
      query: "Data Analyst",
      location: "New York",
      industry: "Any",
      company_size: "Any",
    },
    { forceRefresh: true },
  );

  console.log(`Search results: ${results.length}`);

  for (const role of results.slice(0, 5)) {
    console.log(`- ${role.role_title} | ${role.company_name} | ${role.location}`);
    console.log(`  ${role.apply_url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
