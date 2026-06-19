import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/auth";
import { analyzeVoiceProfile } from "@/lib/gemini/voice-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { data, error: dbError } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (dbError && dbError.code !== "PGRST116") {
    return errorResponse(dbError.message);
  }

  return Response.json({ profile: data });
}

export async function POST() {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { data: documents } = await supabase
      .from("documents")
      .select("raw_text")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("raw_text", "is", null);

    if (!documents?.length) {
      return errorResponse("Upload at least one writing sample first", 400);
    }

    const samples = documents.map((d) => d.raw_text!).filter(Boolean);
    const analysis = await analyzeVoiceProfile(samples);

    const profileData = {
      user_id: user.id,
      tone: analysis.tone,
      sentence_structure: analysis.sentence_structure,
      vocabulary_patterns: analysis.vocabulary_patterns,
      formality_level: analysis.formality_level,
      recurring_phrases: analysis.recurring_phrases,
      writing_strengths: analysis.writing_strengths,
      summary: analysis.summary,
      raw_analysis: analysis,
      document_count: documents.length,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("voice_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let profile;
    if (existing) {
      const { data, error: updateError } = await supabase
        .from("voice_profiles")
        .update(profileData)
        .eq("user_id", user.id)
        .select()
        .single();
      if (updateError) return errorResponse(updateError.message);
      profile = data;
    } else {
      const { data, error: insertError } = await supabase
        .from("voice_profiles")
        .insert(profileData)
        .select()
        .single();
      if (insertError) return errorResponse(insertError.message);
      profile = data;
    }

    return Response.json({ profile }, { status: existing ? 200 : 201 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Voice profile creation failed");
  }
}
