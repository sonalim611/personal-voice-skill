export type SourceType = "pdf" | "txt" | "paste" | "linkedin";
export type DocumentStatus = "pending" | "processing" | "completed" | "failed";
export type OutputType = "linkedin_post" | "blog_post" | "email" | "tweet_thread";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  source_type: SourceType;
  storage_path: string | null;
  original_filename: string | null;
  file_size: number | null;
  mime_type: string | null;
  raw_text: string | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  chunk_index: number;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Embedding {
  id: string;
  chunk_id: string;
  user_id: string;
  embedding: number[];
  model: string;
  created_at: string;
}

export interface VoiceProfile {
  id: string;
  user_id: string;
  tone: string | null;
  sentence_structure: string | null;
  vocabulary_patterns: string | null;
  formality_level: string | null;
  recurring_phrases: string[];
  writing_strengths: string[];
  summary: string | null;
  raw_analysis: Record<string, unknown> | null;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  topic: string;
  output_type: OutputType;
  generated_content: string;
  prompt_used: string | null;
  retrieved_chunk_ids: string[];
  voice_profile_id: string | null;
  created_at: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  generation_id: string;
  tone_match: number;
  vocabulary_match: number;
  structure_match: number;
  overall_score: number;
  feedback: string | null;
  raw_evaluation: Record<string, unknown> | null;
  created_at: string;
}

export interface MatchedChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
}

export interface VoiceAnalysis {
  tone: string;
  sentence_structure: string;
  vocabulary_patterns: string;
  formality_level: string;
  recurring_phrases: string[];
  writing_strengths: string[];
  summary: string;
}

export interface EvaluationResult {
  tone_match: number;
  vocabulary_match: number;
  structure_match: number;
  overall_score: number;
  feedback: string;
}

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  linkedin_post: "LinkedIn Post",
  blog_post: "Blog Post",
  email: "Email",
  tweet_thread: "Tweet / X Thread",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  pdf: "PDF",
  txt: "Text File",
  paste: "Pasted Text",
  linkedin: "LinkedIn Post",
};
