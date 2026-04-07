import { NextResponse } from "next/server";

import { generateSignalBrief, getOpenAIErrorMessage } from "@/lib/openai";
import { getProfileByUserId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { briefRequestSchema, type ProfileRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to generate a brief." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = briefRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    let profile: ProfileRecord | null = null;

    const { profile: profileData, error: profileError } = await getProfileByUserId(
      supabase,
      user.id,
    );

    if (!profileError && profileData) {
      profile = profileData as ProfileRecord;
    }

    const brief = await generateSignalBrief(parsedBody.data.companyName, profile);

    const timestamp = new Date().toISOString();
    const insertPayload = {
      user_id: user.id,
      company_name: parsedBody.data.companyName,
      brief_data: brief,
      created_at: timestamp,
    } as never;

    const saveNewBrief = async () => {
      const { data: savedBrief, error: saveError } = await supabase
        .from("briefs" as never)
        .insert(insertPayload)
        .select("id")
        .single();

      if (saveError || !savedBrief) {
        return null;
      }

      return (savedBrief as { id: string }).id;
    };

    if (parsedBody.data.briefId) {
      const { data: updatedBrief, error: updateError } = await supabase
        .from("briefs")
        .update({
          brief_data: brief,
          company_name: parsedBody.data.companyName,
          created_at: timestamp,
        } as never)
        .eq("id", parsedBody.data.briefId)
        .eq("user_id", user.id)
        .select("id")
        .single();

      if (!updateError && updatedBrief) {
        return NextResponse.json({
          id: (updatedBrief as { id: string }).id,
          brief,
        });
      }

      const fallbackBriefId = await saveNewBrief();

      if (fallbackBriefId) {
        return NextResponse.json({
          id: fallbackBriefId,
          brief,
        });
      }

      return NextResponse.json(
        {
          error:
            "The brief was generated but could not be saved. Make sure the briefs table allows inserts or updates for the signed-in user.",
        },
        { status: 500 },
      );
    }

    const briefId = await saveNewBrief();

    if (!briefId) {
      return NextResponse.json(
        {
          error:
            "The brief was generated but could not be saved. Make sure the briefs table exists and the RLS policies are enabled.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: briefId,
      brief,
    });
  } catch (error) {
    const normalized = getOpenAIErrorMessage(error);

    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
