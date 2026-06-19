import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/auth";
import { generateEmbedding } from "@/lib/gemini/embeddings";
import { EMBEDDING_MODEL } from "@/lib/gemini/client";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { chunkId, text } = await request.json();

    if (!chunkId && !text) {
      return errorResponse("Either chunkId or text is required", 400);
    }

    let content = text as string | undefined;

    if (chunkId) {
      const { data: chunk, error: chunkError } = await supabase
        .from("chunks")
        .select("content")
        .eq("id", chunkId)
        .eq("user_id", user.id)
        .single();

      if (chunkError || !chunk) return errorResponse("Chunk not found", 404);
      content = chunk.content;
    }

    const embedding = await generateEmbedding(content!);

    if (chunkId) {
      const { error: embedError } = await supabase.from("embeddings").insert({
        chunk_id: chunkId,
        user_id: user.id,
        embedding,
        model: EMBEDDING_MODEL,
      });

      if (embedError) return errorResponse(embedError.message);
    }

    return Response.json({ embedding, dimensions: embedding.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Embedding generation failed");
  }
}
