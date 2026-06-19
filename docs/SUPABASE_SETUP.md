# Supabase Setup Guide

This guide walks you through configuring Supabase for Personal Voice Skill.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose an organization, name your project, set a database password, and select a region
4. Wait for the project to finish provisioning

## 2. Enable pgvector

1. In your Supabase dashboard, go to **Database → Extensions**
2. Search for `vector` and enable the **pgvector** extension
3. Alternatively, the migration script enables it automatically

## 3. Run the Database Migration

1. Go to **SQL Editor** in the Supabase dashboard
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL editor and click **Run**

This creates:
- `profiles` — user profiles linked to auth
- `documents` — uploaded writing samples
- `chunks` — text chunks from documents
- `embeddings` — vector embeddings (768 dimensions)
- `voice_profiles` — analyzed writing style
- `generations` — AI-generated content
- `evaluations` — voice consistency scores
- `match_chunks()` — vector similarity search function
- Row Level Security policies for all tables
- `writing-samples` storage bucket

## 4. Configure Authentication

1. Go to **Authentication → Providers**
2. Ensure **Email** provider is enabled
3. Under **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` (for local dev)
   - **Redirect URLs**: `http://localhost:3000/**`

For production, add your Vercel domain to both fields.

## 5. Verify Storage Bucket

1. Go to **Storage**
2. Confirm the `writing-samples` bucket exists
3. It should be **private** with a 10MB file size limit

## 6. Get API Keys

1. Go to **Project Settings → API**
2. Copy these values to your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Security**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. It is only used in server-side operations.

## 7. Verify Setup

Run these queries in the SQL Editor to confirm everything is in place:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'writing-samples';
```

Expected tables: `chunks`, `documents`, `embeddings`, `evaluations`, `generations`, `profiles`, `voice_profiles`.

## Troubleshooting

### "extension vector does not exist"
Enable pgvector in Database → Extensions before running the migration.

### RLS policy errors
Ensure you are authenticated when testing. RLS policies restrict data access to the owning user.

### Storage upload fails
Verify the `writing-samples` bucket exists and RLS policies on `storage.objects` were created by the migration.

### Vector search returns no results
Confirm embeddings were created after document upload. Check the `embeddings` table has rows with 768-dimensional vectors.
