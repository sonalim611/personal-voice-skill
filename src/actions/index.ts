"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chunkText } from "@/lib/text/chunking";
import { analyzeVoiceProfile } from "@/lib/gemini/voice-analysis";
import { buildGenerationPrompt, generateContent } from "@/lib/gemini/generation";
import { evaluateContent } from "@/lib/gemini/evaluation";
import { generateEmbeddings, generateQueryEmbedding } from "@/lib/gemini/embeddings";
import { EMBEDDING_MODEL } from "@/lib/gemini/client";
import { searchSimilarChunks, getUserWritingSamples } from "@/lib/vector-search";
import { extractText } from "@/lib/text/extraction";
import type { OutputType, SourceType } from "@/types/database";

const BUCKET = "writing-samples";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { user, supabase };
}

async function processDocumentText(
  documentId: string,
  userId: string,
  text: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: "No text content found" })
      .eq("id", documentId);
    return;
  }

  const chunkRows = chunks.map((chunk) => ({
    document_id: documentId,
    user_id: userId,
    content: chunk.content,
    chunk_index: chunk.index,
    token_count: chunk.tokenCount,
    metadata: {},
  }));

  const { data: insertedChunks, error: chunkError } = await supabase
    .from("chunks")
    .insert(chunkRows)
    .select("id, content");

  if (chunkError || !insertedChunks) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: chunkError?.message ?? "Chunk insert failed" })
      .eq("id", documentId);
    return;
  }

  const embeddings = await generateEmbeddings(insertedChunks.map((c) => c.content));

  const embeddingRows = insertedChunks.map((chunk, i) => ({
    chunk_id: chunk.id,
    user_id: userId,
    embedding: embeddings[i],
    model: EMBEDDING_MODEL,
  }));

  const { error: embedError } = await supabase.from("embeddings").insert(embeddingRows);

  if (embedError) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: embedError.message })
      .eq("id", documentId);
    return;
  }

  await supabase
    .from("documents")
    .update({ status: "completed", raw_text: text })
    .eq("id", documentId);
}

export async function uploadPastedText(title: string, text: string, sourceType: SourceType = "paste") {
  const { user, supabase } = await requireUser();

  if (!text.trim()) return { error: "Text content is required" };

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title,
      source_type: sourceType,
      raw_text: text,
      status: "processing",
    })
    .select()
    .single();

  if (error || !doc) return { error: error?.message ?? "Failed to create document" };

  try {
    await processDocumentText(doc.id, user.id, text, supabase);
    revalidatePath("/upload");
    revalidatePath("/dashboard");
    return { success: true, documentId: doc.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", doc.id);
    return { error: message };
  }
}

export async function uploadFile(formData: FormData) {
  const { user, supabase } = await requireUser();

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string) || file?.name || "Untitled";

  if (!file) return { error: "No file provided" };
  if (file.size > MAX_FILE_SIZE) return { error: "File exceeds 10MB limit" };

  const mimeType = file.type || "text/plain";
  const isPdf = mimeType === "application/pdf";
  const isTxt = mimeType === "text/plain" || mimeType === "text/markdown";

  if (!isPdf && !isTxt) {
    return { error: "Only PDF and TXT files are supported" };
  }

  const sourceType: SourceType = isPdf ? "pdf" : "txt";
  const storagePath = `${user.id}/${Date.now()}-${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title,
      source_type: sourceType,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: mimeType,
      status: "processing",
    })
    .select()
    .single();

  if (docError || !doc) return { error: docError?.message ?? "Failed to create document" };

  try {
    const text = await extractText(buffer, mimeType);
    if (!text.trim()) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Could not extract text from file" })
        .eq("id", doc.id);
      return { error: "Could not extract text from file" };
    }
    await processDocumentText(doc.id, user.id, text, supabase);
    revalidatePath("/upload");
    revalidatePath("/dashboard");
    return { success: true, documentId: doc.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", doc.id);
    return { error: message };
  }
}

export async function deleteDocument(documentId: string) {
  const { user, supabase } = await requireUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (doc?.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/upload");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createVoiceProfile() {
  const { user, supabase } = await requireUser();

  const { data: documents } = await supabase
    .from("documents")
    .select("raw_text")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .not("raw_text", "is", null);

  if (!documents || documents.length === 0) {
    return { error: "Upload at least one writing sample first" };
  }

  const samples = documents.map((d) => d.raw_text!).filter(Boolean);
  if (samples.length === 0) {
    return { error: "No text content found in uploaded documents" };
  }

  try {
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
      const { data, error } = await supabase
        .from("voice_profiles")
        .update(profileData)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) return { error: error.message };
      profile = data;
    } else {
      const { data, error } = await supabase
        .from("voice_profiles")
        .insert(profileData)
        .select()
        .single();
      if (error) return { error: error.message };
      profile = data;
    }

    revalidatePath("/voice-profile");
    revalidatePath("/dashboard");
    return { success: true, profile };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Voice analysis failed" };
  }
}

export async function generateStyledContent(topic: string, outputType: OutputType) {
  const { user, supabase } = await requireUser();

  if (!topic.trim()) return { error: "Topic is required" };

  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return { error: "Create a voice profile first" };
  }

  try {
    const queryEmbedding = await generateQueryEmbedding(topic);
    const matchedChunks = await searchSimilarChunks(user.id, queryEmbedding, 5);
    const examples = matchedChunks.map((c) => c.content);

    const prompt = buildGenerationPrompt(topic, outputType, profile, examples);
    const content = await generateContent(prompt);

    const { data: generation, error } = await supabase
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

    if (error) return { error: error.message };

    revalidatePath("/generate");
    revalidatePath("/evaluations");
    return { success: true, generation };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Generation failed" };
  }
}

export async function evaluateGeneration(generationId: string) {
  const { user, supabase } = await requireUser();

  const { data: generation } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .single();

  if (!generation) return { error: "Generation not found" };

  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Voice profile not found" };

  try {
    const samples = await getUserWritingSamples(user.id, 5);
    const result = await evaluateContent(generation.generated_content, profile, samples);

    const { data: evaluation, error } = await supabase
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

    if (error) return { error: error.message };

    revalidatePath("/evaluations");
    return { success: true, evaluation };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Evaluation failed" };
  }
}

export async function getDashboardStats() {
  const { user, supabase } = await requireUser();

  const [documents, profile, generations, evaluations] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("voice_profiles").select("id").eq("user_id", user.id).single(),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("evaluations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return {
    documentCount: documents.count ?? 0,
    hasVoiceProfile: !!profile.data,
    generationCount: generations.count ?? 0,
    evaluationCount: evaluations.count ?? 0,
  };
}

export async function getDocuments() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVoiceProfile() {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  return data;
}

export async function getGenerations() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getEvaluations() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("evaluations")
    .select("*, generations(topic, output_type, generated_content)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
