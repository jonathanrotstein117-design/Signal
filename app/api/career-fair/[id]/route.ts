import { NextResponse } from "next/server";

import {
  buildCareerFairPayload,
  getCareerFairForUser,
} from "@/lib/career-fair-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view this career fair." },
      { status: 401 },
    );
  }

  try {
    const fair = await getCareerFairForUser(supabase, user.id, id);

    if (!fair) {
      return NextResponse.json(
        { error: "Career fair not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(buildCareerFairPayload(fair));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Signal could not load this career fair yet.",
      },
      { status: 500 },
    );
  }
}
