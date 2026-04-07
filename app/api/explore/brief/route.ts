import { NextResponse } from "next/server";

import { generateSignalBrief, getOpenAIErrorMessage } from "@/lib/openai";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import {
  briefRequestSchema,
  resolveBriefCompanyName,
  type ProfileRecord,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedBody = briefRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profile: ProfileRecord | null = null;

    if (user) {
      const { profile: profileData, error: profileError } = await getProfileByUserId(
        supabase,
        user.id,
      );

      if (!profileError && profileData) {
        profile = profileData as ProfileRecord;
      }
    }

    const brief = await generateSignalBrief(parsedBody.data.companyName, profile);
    const resolvedCompanyName = resolveBriefCompanyName(
      brief,
      parsedBody.data.companyName,
    );

    return NextResponse.json({
      brief,
      companyName: resolvedCompanyName,
    });
  } catch (error) {
    const normalized = getOpenAIErrorMessage(error);

    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
