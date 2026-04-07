import { after, NextResponse } from "next/server";

import {
  appendCompaniesToCareerFair,
  buildCareerFairPayload,
  createCareerFair,
  getCareerFairForUser,
  getProfileForUser,
  processCareerFair,
} from "@/lib/career-fair-server";
import {
  dedupeCompanies,
  getCareerFairStatus,
  normalizeCompanyName,
} from "@/lib/career-fair";
import { createClient } from "@/lib/supabase/server";
import { careerFairGenerateSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to generate a career fair game plan." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = careerFairGenerateSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const normalizedCompanies = dedupeCompanies(
    parsedBody.data.companies.map(normalizeCompanyName).filter(Boolean),
  );

  if (!parsedBody.data.fairId && normalizedCompanies.length < 2) {
    return NextResponse.json(
      { error: "Enter at least 2 companies to build a game plan." },
      { status: 400 },
    );
  }

  if (!normalizedCompanies.length) {
    return NextResponse.json(
      { error: "Enter at least one company to continue." },
      { status: 400 },
    );
  }

  try {
    const profile = await getProfileForUser(supabase, user.id);
    let fair;

    if (parsedBody.data.fairId) {
      const existingFair = await getCareerFairForUser(
        supabase,
        user.id,
        parsedBody.data.fairId,
      );

      if (!existingFair) {
        return NextResponse.json(
          { error: "Career fair not found." },
          { status: 404 },
        );
      }

      if (
        getCareerFairStatus(existingFair.companies) === "processing" ||
        getCareerFairStatus(existingFair.companies) === "pending"
      ) {
        return NextResponse.json(
          {
            error:
              "This game plan is still processing. Please wait for it to finish before adding more companies.",
          },
          { status: 409 },
        );
      }

      fair = await appendCompaniesToCareerFair(
        supabase,
        user.id,
        parsedBody.data.fairId,
        parsedBody.data.fairName,
        normalizedCompanies,
      );

      if (fair.companies.length === existingFair.companies.length) {
        return NextResponse.json(
          { error: "Those companies are already in this game plan." },
          { status: 400 },
        );
      }
    } else {
      fair = await createCareerFair(
        supabase,
        user.id,
        parsedBody.data.fairName,
        normalizedCompanies,
      );
    }

    after(async () => {
      try {
        await processCareerFair(supabase, user.id, fair.id, profile);
      } catch (error) {
        console.error("Career fair processing failed", error);
      }
    });

    return NextResponse.json(buildCareerFairPayload(fair), { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Signal could not start the career fair game plan.",
      },
      { status: 500 },
    );
  }
}
