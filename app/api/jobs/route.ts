import { NextResponse } from "next/server";

import { internshipSearchRequestSchema } from "@/lib/internship-search-shared";
import {
  InternshipSearchError,
  searchInternshipJobs,
} from "@/lib/internship-search";

export const runtime = "nodejs";

function invalidRequestResponse(errorMessage: string) {
  return NextResponse.json({ error: errorMessage }, { status: 400 });
}

function searchErrorResponse(error: unknown) {
  if (error instanceof InternshipSearchError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: "Job search is temporarily unavailable. Please try again later." },
    { status: 500 },
  );
}

async function handleSearch(payload: unknown) {
  const parsedRequest = internshipSearchRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return invalidRequestResponse(
      parsedRequest.error.issues[0]?.message ?? "Invalid job search request.",
    );
  }

  try {
    const results = await searchInternshipJobs(parsedRequest.data);
    return NextResponse.json(results);
  } catch (error) {
    return searchErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return handleSearch(body);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  return handleSearch({
    query: searchParams.get("query") ?? "",
    location: searchParams.get("location") ?? "",
  });
}
