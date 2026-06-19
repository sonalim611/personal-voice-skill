import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/auth";
import { chunkText } from "@/lib/text/chunking";
import { generateEmbeddings } from "@/lib/gemini/embeddings";
import { EMBEDDING_MODEL } from "@/lib/gemini/client";
import { extractText } from "@/lib/text/extraction";
import type { SourceType } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "writing-samples";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET() {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { data, error: dbError } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) return errorResponse(dbError.message);
  return Response.json({ documents: data });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { title, text, sourceType = "paste" } = body as {
        title: string;
        text: string;
        sourceType?: SourceType;
      };

      if (!text?.trim()) return errorResponse("Text content is required", 400);

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          title: title || "Pasted Text",
          source_type: sourceType,
          raw_text: text,
          status: "processing",
        })
        .select()
        .single();

      if (docError || !doc) return errorResponse(docError?.message ?? "Failed to create document");

      await processDocument(doc.id, user.id, text, supabase);
      return Response.json({ document: doc }, { status: 201 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || file?.name || "Untitled";

    if (!file) return errorResponse("No file provided", 400);
    if (file.size > MAX_FILE_SIZE) return errorResponse("File exceeds 10MB limit", 400);

    const mimeType = file.type || "text/plain";
    const isPdf = mimeType === "application/pdf";
    const isTxt = mimeType === "text/plain" || mimeType === "text/markdown";
    if (!isPdf && !isTxt) return errorResponse("Only PDF and TXT files are supported", 400);

    const sourceType: SourceType = isPdf ? "pdf" : "txt";
    const storagePath = `${user.id}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType });

    if (uploadError) return errorResponse(uploadError.message);

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

    if (docError || !doc) return errorResponse(docError?.message ?? "Failed to create document");

    const text = await extractText(buffer, mimeType);
    if (!text.trim()) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Could not extract text" })
        .eq("id", doc.id);
      return errorResponse("Could not extract text from file", 400);
    }

    await processDocument(doc.id, user.id, text, supabase);
    return Response.json({ document: doc }, { status: 201 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Upload failed");
  }
}

async function processDocument(
  documentId: string,
  userId: string,
  text: string,
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"]
) {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: "No text content found" })
      .eq("id", documentId);
    return;
  }

  const { data: insertedChunks, error: chunkError } = await supabase
    .from("chunks")
    .insert(
      chunks.map((c) => ({
        document_id: documentId,
        user_id: userId,
        content: c.content,
        chunk_index: c.index,
        token_count: c.tokenCount,
        metadata: {},
      }))
    )
    .select("id, content");

  if (chunkError || !insertedChunks) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: chunkError?.message })
      .eq("id", documentId);
    return;
  }

  const embeddings = await generateEmbeddings(insertedChunks.map((c) => c.content));

  await supabase.from("embeddings").insert(
    insertedChunks.map((chunk, i) => ({
      chunk_id: chunk.id,
      user_id: userId,
      embedding: embeddings[i],
      model: EMBEDDING_MODEL,
    }))
  );

  await supabase
    .from("documents")
    .update({ status: "completed", raw_text: text })
    .eq("id", documentId);
}
