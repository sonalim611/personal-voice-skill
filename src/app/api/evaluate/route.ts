import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/auth";
import { evaluateContent } from "@/lib/gemini/evaluation";
import { getUserWritingSamples } from "@/lib/vector-search";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { data, error: dbError } = await supabase
    .from("evaluations")
    .select("*, generations(topic, output_type, generated_content)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) return errorResponse(dbError.message);
  return Response.json({ evaluations: data });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { generationId } = await request.json();
    if (!generationId) return errorResponse("generationId is required", 400);

    const { data: generation } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (!generation) return errorResponse("Generation not found", 404);

    const { data: profile } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) return errorResponse("Voice profile not found", 400);

    const samples = await getUserWritingSamples(user.id, 5);
    const result = await evaluateContent(generation.generated_content, profile, samples);

    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .insert({
        user_id: user.id,
        generation_id: generationId,
        tone_match: result.tone_match,
        vocabulary_match: result.vocabulary_match,
        structure_match: result.structure_match,
        overall_score: result.overall_score,
        feedback: result.feedback,
        raw_evaluation: result,
      })
      .select()
      .single();

    if (evalError) return errorResponse(evalError.message);

    return Response.json({ evaluation }, { status: 201 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Evaluation failed");
  }
}
