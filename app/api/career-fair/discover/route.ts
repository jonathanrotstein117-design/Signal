import { NextResponse } from "next/server";

import { discoverCareerFairs, getOpenAIErrorMessage } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import {
  careerFairDiscoveryRequestSchema,
  type ProfileRecord,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to discover career fairs." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = careerFairDiscoveryRequestSchema.safeParse(body);

  let universityName = parsedBody.success ? parsedBody.data.universityName : "";

  if (!universityName) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("university")
      .eq("id", user.id)
      .maybeSingle();

    universityName =
      ((profileData as Pick<ProfileRecord, "university"> | null)?.university ?? "").trim();
  }

  if (!universityName) {
    return NextResponse.json(
      { error: "Add your university in your profile to discover upcoming fairs." },
      { status: 400 },
    );
  }

  try {
    const fairs = await discoverCareerFairs(universityName);

    return NextResponse.json(fairs);
  } catch (error) {
    const normalized = getOpenAIErrorMessage(error);

    return NextResponse.json(
      { error: normalized.message },
      { status: normalized.status },
    );
  }
}
