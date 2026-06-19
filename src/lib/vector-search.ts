import { createClient } from "@/lib/supabase/server";
import type { MatchedChunk } from "@/types/database";

export async function searchSimilarChunks(
  userId: string,
  queryEmbedding: number[],
  matchCount: number = 5
): Promise<MatchedChunk[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: matchCount,
    match_threshold: 0.3,
  });

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data ?? []) as MatchedChunk[];
}

export async function getUserWritingSamples(userId: string, limit: number = 10): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chunks")
    .select("content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch writing samples: ${error.message}`);
  }

  return (data ?? []).map((c) => c.content);
}
