-- =============================================================================
-- Personal Voice Skill — Complete Supabase Schema
-- =============================================================================
-- Run this entire script in: Supabase Dashboard → SQL Editor → New Query
--
-- Includes:
--   • pgvector extension
--   • profiles (user extension)
--   • documents, chunks, embeddings
--   • voice_profiles, generations, evaluations
--   • Vector similarity search (match_chunks)
--   • Row Level Security (RLS)
--   • Storage bucket for writing samples
--   • Auth trigger for auto profile creation
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- CUSTOM TYPES (optional enums for stricter typing)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.source_type AS ENUM ('pdf', 'txt', 'paste', 'linkedin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.output_type AS ENUM ('linkedin_post', 'blog_post', 'email', 'tweet_thread');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- PROFILES (extends auth.users — one row per authenticated user)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profile metadata linked to Supabase Auth users';

-- -----------------------------------------------------------------------------
-- DOCUMENTS (uploaded writing samples)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  source_type       TEXT NOT NULL CHECK (source_type IN ('pdf', 'txt', 'paste', 'linkedin')),
  storage_path      TEXT,
  original_filename TEXT,
  file_size         INTEGER CHECK (file_size IS NULL OR file_size >= 0),
  mime_type         TEXT,
  raw_text          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS 'Original writing samples: PDF, TXT, pasted text, or LinkedIn posts';
COMMENT ON COLUMN public.documents.storage_path IS 'Path in writing-samples bucket: {user_id}/{timestamp}-{filename}';
COMMENT ON COLUMN public.documents.raw_text IS 'Extracted plain text used for chunking and voice analysis';

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- -----------------------------------------------------------------------------
-- CHUNKS (logical text sections from documents)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) > 0),
  chunk_index  INTEGER NOT NULL CHECK (chunk_index >= 0),
  token_count  INTEGER CHECK (token_count IS NULL OR token_count >= 0),
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

COMMENT ON TABLE public.chunks IS 'Chunked document text for embedding and RAG retrieval';

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON public.chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_created_at ON public.chunks(created_at DESC);

-- -----------------------------------------------------------------------------
-- EMBEDDINGS (pgvector — Gemini gemini-embedding-001, 768 dimensions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id   UUID NOT NULL UNIQUE REFERENCES public.chunks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding  vector(768) NOT NULL,
  model      TEXT NOT NULL DEFAULT 'gemini-embedding-001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.embeddings IS 'Vector embeddings for semantic search over writing chunks';

CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON public.embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON public.embeddings(user_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.embeddings
  USING hnsw (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- VOICE PROFILES (analyzed writing style per user)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tone                 TEXT,
  sentence_structure   TEXT,
  vocabulary_patterns  TEXT,
  formality_level      TEXT,
  recurring_phrases    TEXT[] NOT NULL DEFAULT '{}',
  writing_strengths    TEXT[] NOT NULL DEFAULT '{}',
  summary              TEXT,
  raw_analysis         JSONB,
  document_count       INTEGER NOT NULL DEFAULT 0 CHECK (document_count >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.voice_profiles IS 'AI-extracted writing style profile (one per user)';

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON public.voice_profiles(user_id);

-- -----------------------------------------------------------------------------
-- GENERATIONS (AI-generated content in user voice)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic                TEXT NOT NULL CHECK (char_length(trim(topic)) > 0),
  output_type          TEXT NOT NULL
                       CHECK (output_type IN ('linkedin_post', 'blog_post', 'email', 'tweet_thread')),
  generated_content    TEXT NOT NULL CHECK (char_length(generated_content) > 0),
  prompt_used          TEXT,
  retrieved_chunk_ids  UUID[] NOT NULL DEFAULT '{}',
  voice_profile_id     UUID REFERENCES public.voice_profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.generations IS 'Content generated via RAG + voice profile';

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_voice_profile_id ON public.generations(voice_profile_id);

-- -----------------------------------------------------------------------------
-- EVALUATIONS (LLM-as-a-Judge voice consistency scores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id     UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  tone_match        NUMERIC(5,2) NOT NULL CHECK (tone_match BETWEEN 0 AND 100),
  vocabulary_match  NUMERIC(5,2) NOT NULL CHECK (vocabulary_match BETWEEN 0 AND 100),
  structure_match   NUMERIC(5,2) NOT NULL CHECK (structure_match BETWEEN 0 AND 100),
  overall_score     NUMERIC(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  feedback          TEXT,
  raw_evaluation    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.evaluations IS 'Voice consistency evaluation for generated content';

CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON public.evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_generation_id ON public.evaluations(generation_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at DESC);

-- -----------------------------------------------------------------------------
-- FUNCTIONS
-- -----------------------------------------------------------------------------

-- Vector similarity search for RAG
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(768),
  match_user_id   UUID,
  match_count     INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  content     TEXT,
  chunk_index INTEGER,
  similarity  FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    (1 - (e.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.chunks c
  INNER JOIN public.embeddings e ON e.chunk_id = c.id
  WHERE c.user_id = match_user_id
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_chunks IS 'Cosine similarity search over user embeddings for RAG';

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGERS
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS voice_profiles_updated_at ON public.voice_profiles;
CREATE TRIGGER voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations     ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Chunks
DROP POLICY IF EXISTS "Users can view own chunks" ON public.chunks;
CREATE POLICY "Users can view own chunks" ON public.chunks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chunks" ON public.chunks;
CREATE POLICY "Users can insert own chunks" ON public.chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chunks" ON public.chunks;
CREATE POLICY "Users can delete own chunks" ON public.chunks
  FOR DELETE USING (auth.uid() = user_id);

-- Embeddings
DROP POLICY IF EXISTS "Users can view own embeddings" ON public.embeddings;
CREATE POLICY "Users can view own embeddings" ON public.embeddings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own embeddings" ON public.embeddings;
CREATE POLICY "Users can insert own embeddings" ON public.embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own embeddings" ON public.embeddings;
CREATE POLICY "Users can delete own embeddings" ON public.embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- Voice profiles
DROP POLICY IF EXISTS "Users can view own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can view own voice profile" ON public.voice_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can insert own voice profile" ON public.voice_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can update own voice profile" ON public.voice_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can delete own voice profile" ON public.voice_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Generations
DROP POLICY IF EXISTS "Users can view own generations" ON public.generations;
CREATE POLICY "Users can view own generations" ON public.generations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;
CREATE POLICY "Users can insert own generations" ON public.generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own generations" ON public.generations;
CREATE POLICY "Users can delete own generations" ON public.generations
  FOR DELETE USING (auth.uid() = user_id);

-- Evaluations
DROP POLICY IF EXISTS "Users can view own evaluations" ON public.evaluations;
CREATE POLICY "Users can view own evaluations" ON public.evaluations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own evaluations" ON public.evaluations;
CREATE POLICY "Users can insert own evaluations" ON public.evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own evaluations" ON public.evaluations;
CREATE POLICY "Users can delete own evaluations" ON public.evaluations
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- GRANTS (authenticated users access tables via RLS)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chunks          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embeddings    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations   TO authenticated;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, UUID, INT, FLOAT) TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- STORAGE (writing sample file uploads)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'writing-samples',
  'writing-samples',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'writing-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'writing-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'writing-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- -----------------------------------------------------------------------------
-- VERIFICATION QUERY (optional — run after migration)
-- -----------------------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
