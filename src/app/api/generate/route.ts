import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/auth";
import { generateQueryEmbedding } from "@/lib/gemini/embeddings";
import { buildGenerationPrompt, generateContent } from "@/lib/gemini/generation";
import { searchSimilarChunks } from "@/lib/vector-search";
import type { OutputType } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_OUTPUT_TYPES: OutputType[] = [
  "linkedin_post",
  "blog_post",
  "email",
  "tweet_thread",
];

export async function GET() {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { data, error: dbError } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) return errorResponse(dbError.message);
  return Response.json({ generations: data });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { topic, outputType } = await request.json();

    if (!topic?.trim()) return errorResponse("Topic is required", 400);
    if (!VALID_OUTPUT_TYPES.includes(outputType)) {
      return errorResponse("Invalid output type", 400);
    }

    const { data: profile } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) return errorResponse("Create a voice profile first", 400);

    const queryEmbedding = await generateQueryEmbedding(topic);
    const matchedChunks = await searchSimilarChunks(user.id, queryEmbedding, 5);
    const examples = matchedChunks.map((c) => c.content);

    const prompt = buildGenerationPrompt(topic, outputType, profile, examples);
    const content = await generateContent(prompt);

    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        topic,
        output_type: outputType,
        generated_content: content,
        prompt_used: prompt,
        retrieved_chunk_ids: matchedChunks.map((c) => c.id),
        voice_profile_id: profile.id,
      })
      .select()
      .single();

    if (genError) return errorResponse(genError.message);

    return Response.json({ generation }, { status: 201 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Generation failed");
  }
}
