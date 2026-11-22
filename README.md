# Personal Voice Skill

An AI-powered writing assistant that builds a profile of your writing style from your own writing samples, then uses that profile and relevant examples to help draft new content in a consistent voice.

Instead of relying on a generic prompt, the app combines **voice analysis, embeddings, vector retrieval (RAG), and LLM-based evaluation** in one workflow.

## Product Overview

Personal Voice Skill is designed around five steps:

1. **Add writing samples** — upload PDF or TXT files, or paste text.
2. **Process the samples** — extract text, split it into overlapping chunks, and generate vector embeddings.
3. **Build your voice profile** — analyze tone, sentence structure, vocabulary, formality, recurring phrases, and writing strengths.
4. **Generate content** — choose a topic and format; the app retrieves relevant writing examples and combines them with your voice profile to guide Gemini.
5. **Evaluate the result** — use an LLM-as-a-Judge workflow to score how closely the generated content matches your style and receive improvement feedback.

## Features

- **Authentication:** Email/password authentication using Supabase Auth.
- **Writing sample ingestion:** Paste text or upload PDF and TXT files (up to 10 MB).
- **Text extraction and chunking:** Extract text, split it into approximately 500-token chunks, and use overlap to preserve context between chunks.
- **Embeddings:** Generate vector embeddings with Google's `gemini-embedding-001` model.
- **Voice profile analysis:** Use Gemini to identify tone, sentence structure, vocabulary patterns, formality, recurring phrases, writing strengths, and an overall style summary.
- **RAG-based content generation:** Retrieve relevant chunks from the user's own samples through Supabase pgvector similarity search.
- **Multiple output formats:** Generate LinkedIn posts, blog posts, emails, and Twitter/X threads.
- **Voice consistency evaluation:** Score tone, vocabulary, structure, and overall similarity on a 0–100 scale, with written feedback.
- **Per-user data isolation:** Store user-owned documents, chunks, embeddings, profiles, generations, and evaluations in Supabase with Row Level Security policies.

## Architecture

### High-level workflow

```text
Writing samples
(PDF / TXT / pasted text)
        |
        v
Text extraction
        |
        v
Chunking (~500 tokens, overlap)
        |
        v
Gemini embeddings
(gemini-embedding-001)
        |
        v
Supabase PostgreSQL + pgvector
        |
        +------------------------------+
        |                              |
        v                              v
Voice profile analysis          Topic entered
(Gemini)                              |
        |                             v
        |                       Query embedding
        |                             |
        |                             v
        |                       Vector similarity search
        |                             |
        +--------------+--------------+
                       |
                       v
             Voice profile + retrieved
                writing examples
                       |
                       v
               Gemini content generation
                       |
                       v
                Generated content
                       |
                       v
             LLM-as-a-Judge evaluation
                       |
                       v
           Scores + actionable feedback
```

### Retrieval-augmented generation (RAG)

For each content request, the application:

1. Generates an embedding for the user's topic.
2. Searches the current user's stored writing chunks using the Supabase `match_chunks()` vector-search function.
3. Retrieves up to five relevant examples.
4. Combines those examples with the user's voice profile and format-specific instructions.
5. Sends the prompt to Gemini to generate the requested content.

The generated record stores the topic, output type, content, prompt used, retrieved chunk IDs, and associated voice profile.

### Voice evaluation

The evaluation workflow compares generated content against the saved voice profile and up to five writing samples. Gemini returns:

- Tone match
- Vocabulary match
- Structure match
- Overall score
- Written feedback

Scores are constrained to the 0–100 range in the application. These are model-generated assessments, not independently validated or objective measurements of authorship.

## Supported Content Formats

| Format | Generation guidance |
|---|---|
| LinkedIn post | 150–300 words, hook-led, readable line breaks, suitable closing |
| Blog post | 500–800 words, title, introduction, sections, and conclusion |
| Email | Professional, concise email with subject, greeting, body, and sign-off |
| Twitter/X thread | 3–5 numbered posts, each under 280 characters |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework and routing | Next.js 15 App Router |
| UI | React 19 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 4 |
| Database | Supabase PostgreSQL |
| Vector search | pgvector |
| Authentication | Supabase Auth with `@supabase/ssr` |
| File storage | Supabase Storage |
| Generative AI and embeddings | Google Gemini API via `@google/generative-ai` |
| PDF extraction | `pdf-parse` |
| Validation | Zod |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key

### 1. Clone the repository

```bash
git clone https://github.com/sonalim611/personal-voice-skill.git
cd personal-voice-skill
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the following values in `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_GENERATION_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The model variables are configurable; the values above match the repository's example configuration. Keep `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-side. Never commit real credentials or expose the service-role key through a `NEXT_PUBLIC_` variable.

### 4. Set up Supabase

Follow the [Supabase Setup Guide](docs/SUPABASE_SETUP.md).

In summary:

1. Create a Supabase project.
2. Enable the `vector` extension (pgvector).
3. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.
4. Confirm the private `writing-samples` storage bucket exists.
5. Enable the Email authentication provider.
6. Configure local Site URL and Redirect URLs for `http://localhost:3000`.

The migration creates the application's user profiles, documents, chunks, embeddings, voice profiles, generations, and evaluations tables, plus the vector-search function, storage bucket, and Row Level Security policies.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Typical User Journey

1. Sign up or sign in.
2. Open **Upload** and add writing samples by pasting text or uploading a PDF/TXT file.
3. Wait for document processing and embedding generation to complete.
4. Open **Voice Profile** and generate or refresh the profile from processed samples.
5. Open **Generate**, enter a topic, and select an output format.
6. Review the generated draft.
7. Open **Evaluations** and evaluate a saved generation to see voice-match scores and feedback.

## API Routes

All application API routes require an authenticated Supabase user.

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/documents` | List a user's documents; upload a file or submit pasted text and process it |
| POST | `/api/embeddings` | Generate an embedding for supplied text or a user's existing chunk |
| GET, POST | `/api/voice-profile` | Retrieve or create/update the user's voice profile |
| GET, POST | `/api/generate` | List generated content or create content using RAG |
| GET, POST | `/api/evaluate` | List evaluations or evaluate a saved generation |

### Example: Generate content

With the app running and a valid authenticated session:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "topic": "Lessons learned while leading a product release",
    "outputType": "linkedin_post"
  }'
```

Valid `outputType` values are `linkedin_post`, `blog_post`, `email`, and `tweet_thread`.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Project Structure

```text
personal-voice-skill/
├── src/
│   ├── actions/                  # Server actions used by the UI
│   ├── app/
│   │   ├── api/
│   │   │   ├── documents/        # Upload and list writing samples
│   │   │   ├── embeddings/       # Embedding endpoint
│   │   │   ├── evaluate/         # Voice evaluation endpoint
│   │   │   ├── generate/         # RAG content generation endpoint
│   │   │   └── voice-profile/    # Voice profile endpoint
│   │   ├── dashboard/
│   │   ├── evaluations/
│   │   ├── generate/
│   │   ├── login/
│   │   ├── upload/
│   │   └── voice-profile/
│   ├── components/               # React UI components
│   ├── lib/
│   │   ├── gemini/               # Gemini client, embeddings, analysis,
│   │   │                         # generation, and evaluation
│   │   ├── supabase/             # Supabase clients
│   │   ├── text/                 # PDF/TXT extraction and chunking
│   │   └── vector-search.ts      # Similarity search helpers
│   └── types/                    # Database and application types
├── supabase/
│   └── migrations/               # SQL schema, pgvector, RLS, storage
├── docs/
│   ├── LOCAL_DEVELOPMENT.md
│   ├── SUPABASE_SETUP.md
│   └── VERCEL_DEPLOYMENT.md
├── .env.example
├── next.config.ts
└── package.json
```

## Deployment

The application is configured for deployment to [Vercel](https://vercel.com).

1. Import the GitHub repository into Vercel.
2. Add the environment variables listed above in the Vercel project settings.
3. Apply the Supabase migration and configure the production authentication Site URL and Redirect URLs.
4. Deploy and verify sign-in, document upload, voice profile creation, generation, and evaluation.

See the [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md) for detailed instructions.

**Deployment note:** Gemini-backed processing routes can take time, particularly when embedding multiple chunks. The API routes declare function durations in the source; actual limits depend on the Vercel plan and deployment configuration.

## Current Scope and Considerations

- The app currently supports PDF, TXT, Markdown/plain-text MIME uploads, and pasted text; it does not directly import LinkedIn content from a LinkedIn account.
- Uploads are limited to 10 MB by the documents API.
- Voice profiles and generated content are based on the samples and retrieved chunks available for the authenticated user.
- Generation and evaluation use Gemini model outputs; similarity scores are model assessments and should be treated as guidance rather than ground-truth metrics.
- The application uses Supabase Auth, database, storage, and Row Level Security for user-scoped data access.
- The repository provides a working application workflow, but production readiness also depends on correct Supabase policies, secret management, API quotas, and deployment configuration.

## Further Documentation

- [Supabase Setup Guide](docs/SUPABASE_SETUP.md)
- [Local Development Guide](docs/LOCAL_DEVELOPMENT.md)
- [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md)

---

Built to explore how personal writing data, retrieval-augmented generation, and model-based evaluation can support more consistent AI-assisted writing.
